package cli

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/narduk-enterprises/control-plane/cpctl/internal/api"
	"github.com/spf13/cobra"
)

var cmdTUI = &cobra.Command{
	Use:   "tui",
	Short: "Full-screen menu: all cpctl areas (fleet, doctor, status, apps, jobs, provision, audit, github)",
	RunE:  runTUI,
}

func runTUI(cmd *cobra.Command, args []string) error {
	_, err := tea.NewProgram(initialHub(), tea.WithAltScreen()).Run()
	return err
}

// --- shared messages ---

type errMsg struct{ err error }

type fetchDashMsg struct {
	apps   []api.FleetApp
	status []api.StatusRow
}

type refreshOneMsg struct {
	name string
	row  api.StatusRow
	err  error
}

type fleetRefreshMsg struct {
	rows []api.StatusRow
	err  error
}

type mutationMsg struct {
	text   string
	err    error
	reload bool
}

type toastClearMsg struct{}

type outputMsg struct {
	title string
	lines []string
	err   error
}

// popToMainMsg is sent from the fleet panel when user leaves (esc) back to main menu.
type popToMainMsg struct{}

// --- top-level navigation ---

type topScreen int

const (
	scrMain topScreen = iota
	scrFleet
	scrSubMenu
	scrOutput
	scrForm
)

type subMenuKind int

const (
	subStatus subMenuKind = iota
	subApps
	subProvision
	subAudit
)

type formKind int

const (
	formNone formKind = iota
	formStatusRefreshApp
	formAppName
	formAppURL
	formProvGetID
	formProvRetryID
	formProvStartName
	formProvStartDisplay
	formProvStartURL
	formProvStartDesc
	formProvStartOrg
	formGitHubRepo
)

// --- hub (main menu + routing) ---

type hubModel struct {
	width, height int
	top           topScreen
	mainCursor    int

	subKind subMenuKind
	subCur  int

	fleet fleetPanel

	outputTitle string
	outputLines []string
	outScroll   int

	formKind formKind
	formLbl   string
	formBuf   string
	formBack  topScreen // esc target from form (scrMain or scrSubMenu)
	// register app two-step
	pendAppName string
	// provision start
	wizName, wizDisplay, wizURL, wizDesc, wizOrg string

	err     error
	loading bool
}

func initialHub() hubModel {
	return hubModel{top: scrMain}
}

func (m hubModel) Init() tea.Cmd {
	return nil
}

func mainMenuItems() []string {
	return []string{
		"Fleet dashboard — browse apps, reachability, per-app actions",
		"Doctor — health, admin API, provision key",
		"Status — reachability list / refresh (cpctl status …)",
		"Apps — list registry / register (cpctl apps …)",
		"Provision jobs — recent jobs + logs (cpctl jobs list)",
		"Provision — get / retry / start (cpctl provision …)",
		"Audit — fleet HTML/analytics (cpctl audit)",
		"GitHub — workflow runs (cpctl github runs)",
	}
}

func (m hubModel) subMenuLabels() []string {
	switch m.subKind {
	case subStatus:
		return []string{
			"List reachability (status list)",
			"Refresh all URLs (status refresh)",
			"Refresh one app…",
			"Back",
		}
	case subApps:
		return []string{
			"List apps JSON (apps list)",
			"Register app…",
			"Back",
		}
	case subProvision:
		return []string{
			"Get job by ID (provision get)",
			"Retry job (provision retry)",
			"Start provision… (provision start)",
			"Back",
		}
	case subAudit:
		return []string{
			"Run audit (no --persist)",
			"Run audit with --persist",
			"Back",
		}
	default:
		return nil
	}
}

func (m hubModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		if m.err != nil {
			k := strings.ToLower(msg.String())
			if k == "q" || k == "ctrl+c" {
				return m, tea.Quit
			}
			m.err = nil
			m.top = scrMain
			return m, nil
		}
	}

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.fleet.width = msg.Width
		m.fleet.height = msg.Height
		m.fleet.syncScroll()
		return m, nil

	case tea.KeyMsg:
		key := strings.ToLower(msg.String())
		if m.top == scrMain {
			return m.updateMainKeys(key, msg)
		}
		if m.top == scrSubMenu {
			return m.updateSubMenuKeys(key)
		}
		if m.top == scrOutput {
			return m.updateOutputKeys(key)
		}
		if m.top == scrForm {
			return m.updateFormKeys(msg)
		}
		if m.top == scrFleet {
			return m.updateFleetWrapped(msg)
		}

	case fetchDashMsg:
		m.fleet.loading = false
		m.fleet.apps = msg.apps
		m.fleet.status = map[string]api.StatusRow{}
		for _, s := range msg.status {
			m.fleet.status[s.App] = s
		}
		m.fleet.clampCursor()
		m.fleet.syncScroll()
		return m, nil

	case errMsg:
		m.loading = false
		m.fleet.loading = false
		m.err = msg.err
		return m, nil

	case refreshOneMsg:
		m.fleet.loading = false
		if msg.err != nil {
			m.fleet.toast = msg.err.Error()
		} else {
			m.fleet.status[msg.name] = msg.row
			m.fleet.toast = fmt.Sprintf("%s → %s (%d)", msg.name, msg.row.Status, msg.row.StatusCode)
		}
		return m, scheduleToastClear()

	case fleetRefreshMsg:
		m.fleet.loading = false
		if msg.err != nil {
			m.fleet.toast = msg.err.Error()
		} else {
			for _, s := range msg.rows {
				m.fleet.status[s.App] = s
			}
			m.fleet.toast = fmt.Sprintf("refreshed %d apps", len(msg.rows))
		}
		return m, scheduleToastClear()

	case mutationMsg:
		m.fleet.loading = false
		if msg.err != nil {
			m.fleet.toast = msg.err.Error()
			return m, scheduleToastClear()
		}
		m.fleet.toast = msg.text
		if msg.reload {
			m.fleet.loading = true
			m.fleet.mode = modeList
			m.fleet.actionCursor = 0
			return m, tea.Batch(scheduleToastClear(), loadDashboard)
		}
		return m, scheduleToastClear()

	case toastClearMsg:
		m.fleet.toast = ""
		return m, nil

	case outputMsg:
		m.loading = false
		m.top = scrOutput
		m.outputTitle = msg.title
		m.outScroll = 0
		if msg.err != nil {
			m.outputLines = []string{msg.err.Error()}
		} else {
			m.outputLines = msg.lines
		}
		return m, nil

	case popToMainMsg:
		m.top = scrMain
		m.fleet = fleetPanel{}
		m.err = nil
		return m, nil
	}

	return m, nil
}

func (m hubModel) updateMainKeys(key string, msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	items := mainMenuItems()
	switch key {
	case "q", "ctrl+c", "esc":
		return m, tea.Quit
	case "up", "k":
		if m.mainCursor > 0 {
			m.mainCursor--
		}
	case "down", "j":
		if m.mainCursor < len(items)-1 {
			m.mainCursor++
		}
	case "enter":
		return m.activateMainItem()
	}
	return m, nil
}

func (m hubModel) activateMainItem() (tea.Model, tea.Cmd) {
	switch m.mainCursor {
	case 0:
		m.top = scrFleet
		m.fleet = newFleetPanel(m.width, m.height)
		m.fleet.loading = true
		return m, loadDashboard
	case 1:
		m.loading = true
		return m, cmdDoctorLines()
	case 2:
		m.top = scrSubMenu
		m.subKind = subStatus
		m.subCur = 0
	case 3:
		m.top = scrSubMenu
		m.subKind = subApps
		m.subCur = 0
	case 4:
		m.loading = true
		return m, cmdJobsList()
	case 5:
		m.top = scrSubMenu
		m.subKind = subProvision
		m.subCur = 0
	case 6:
		m.top = scrSubMenu
		m.subKind = subAudit
		m.subCur = 0
	case 7:
		m.top = scrForm
		m.formBack = scrMain
		m.formKind = formGitHubRepo
		m.formLbl = "OWNER/REPO (e.g. narduk-enterprises/foo)"
		m.formBuf = ""
	default:
		break
	}
	return m, nil
}

func (m hubModel) updateSubMenuKeys(key string) (tea.Model, tea.Cmd) {
	labels := m.subMenuLabels()
	switch key {
	case "esc":
		m.top = scrMain
		return m, nil
	case "up", "k":
		if m.subCur > 0 {
			m.subCur--
		}
	case "down", "j":
		if m.subCur < len(labels)-1 {
			m.subCur++
		}
	case "enter":
		return m.activateSubItem()
	}
	return m, nil
}

func (m hubModel) activateSubItem() (tea.Model, tea.Cmd) {
	labels := m.subMenuLabels()
	if m.subCur == len(labels)-1 {
		m.top = scrMain
		return m, nil
	}
	cfg := mergedConfig()
	switch m.subKind {
	case subStatus:
		switch m.subCur {
		case 0:
			if !cfg.HasAdmin() {
				return m, showOutputCmd("status list", nil, fmt.Errorf("set CONTROL_PLANE_API_KEY"))
			}
			return m, cmdStatusListJSON()
		case 1:
			if !cfg.HasAdmin() {
				return m, showOutputCmd("status refresh", nil, fmt.Errorf("set CONTROL_PLANE_API_KEY"))
			}
			m.loading = true
			return m, cmdStatusRefreshAllOutput()
		case 2:
			m.top = scrForm
			m.formBack = scrSubMenu
			m.formKind = formStatusRefreshApp
			m.formLbl = "App name (slug)"
			m.formBuf = ""
		}
	case subApps:
		switch m.subCur {
		case 0:
			if !cfg.HasAdmin() {
				return m, showOutputCmd("apps list", nil, fmt.Errorf("set CONTROL_PLANE_API_KEY"))
			}
			return m, cmdAppsListJSON()
		case 1:
			m.top = scrForm
			m.formBack = scrSubMenu
			m.formKind = formAppName
			m.formLbl = "New app name (slug)"
			m.formBuf = ""
			m.pendAppName = ""
		}
	case subProvision:
		switch m.subCur {
		case 0:
			m.top = scrForm
			m.formBack = scrSubMenu
			m.formKind = formProvGetID
			m.formLbl = "Provision job ID"
			m.formBuf = ""
		case 1:
			if !cfg.HasAdmin() {
				return m, showOutputCmd("provision retry", nil, fmt.Errorf("set CONTROL_PLANE_API_KEY"))
			}
			m.top = scrForm
			m.formBack = scrSubMenu
			m.formKind = formProvRetryID
			m.formLbl = "Provision job ID to retry"
			m.formBuf = ""
		case 2:
			if !cfg.HasProvision() {
				return m, showOutputCmd("provision start", nil, fmt.Errorf("set PROVISION_API_KEY"))
			}
			m.top = scrForm
			m.formBack = scrSubMenu
			m.formKind = formProvStartName
			m.formLbl = "App slug (name)"
			m.formBuf = ""
			m.wizName, m.wizDisplay, m.wizURL, m.wizDesc, m.wizOrg = "", "", "", "", ""
		}
	case subAudit:
		switch m.subCur {
		case 0:
			if !cfg.HasAdmin() {
				return m, showOutputCmd("audit", nil, fmt.Errorf("set CONTROL_PLANE_API_KEY"))
			}
			m.loading = true
			return m, cmdAuditOutput(false)
		case 1:
			if !cfg.HasAdmin() {
				return m, showOutputCmd("audit --persist", nil, fmt.Errorf("set CONTROL_PLANE_API_KEY"))
			}
			m.loading = true
			return m, cmdAuditOutput(true)
		}
	}
	return m, nil
}

func (m hubModel) updateOutputKeys(key string) (tea.Model, tea.Cmd) {
	vis := m.outVisibleLines()
	switch key {
	case "esc", "q":
		m.top = scrMain
		m.outputLines = nil
		return m, nil
	case "up", "k":
		if m.outScroll > 0 {
			m.outScroll--
		}
	case "down", "j":
		if m.outScroll+vis < len(m.outputLines) {
			m.outScroll++
		}
	case "pgup":
		m.outScroll -= vis
		if m.outScroll < 0 {
			m.outScroll = 0
		}
	case "pgdown":
		m.outScroll += vis
		max := len(m.outputLines) - vis
		if max < 0 {
			max = 0
		}
		if m.outScroll > max {
			m.outScroll = max
		}
	}
	return m, nil
}

func (m hubModel) outVisibleLines() int {
	v := m.height - 8
	if v < 4 {
		v = 4
	}
	return v
}

func (m hubModel) updateFormKeys(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.Type {
	case tea.KeyEnter:
		return m.submitForm()
	case tea.KeyEsc:
		m.top = m.formBack
		m.formKind = formNone
		m.formBuf = ""
		return m, nil
	case tea.KeyBackspace:
		if len(m.formBuf) > 0 {
			r := []rune(m.formBuf)
			m.formBuf = string(r[:len(r)-1])
		}
		return m, nil
	case tea.KeyRunes:
		m.formBuf += string(msg.Runes)
		return m, nil
	default:
		return m, nil
	}
}

func (m hubModel) submitForm() (tea.Model, tea.Cmd) {
	s := strings.TrimSpace(m.formBuf)
	switch m.formKind {
	case formGitHubRepo:
		if s == "" {
			return m, nil
		}
		m.loading = true
		m.top = scrMain
		return m, cmdGitHubRuns(s, 10)
	case formStatusRefreshApp:
		if s == "" || !mergedConfig().HasAdmin() {
			return m, nil
		}
		m.loading = true
		m.top = scrMain
		return m, cmdStatusRefreshOneOutput(s)
	case formAppName:
		if s == "" {
			return m, nil
		}
		m.pendAppName = s
		m.formKind = formAppURL
		m.formLbl = "Production URL (https://…)"
		m.formBuf = ""
		return m, nil
	case formAppURL:
		if s == "" || m.pendAppName == "" {
			return m, nil
		}
		m.loading = true
		m.top = scrMain
		return m, cmdAppsCreateOutput(m.pendAppName, s)
	case formProvGetID:
		if s == "" {
			return m, nil
		}
		m.loading = true
		m.top = scrMain
		return m, cmdProvisionGetOutput(s)
	case formProvRetryID:
		if s == "" {
			return m, nil
		}
		m.loading = true
		m.top = scrMain
		return m, cmdProvisionRetryOutput(s)
	case formProvStartName:
		if s == "" {
			return m, nil
		}
		m.wizName = s
		m.formKind = formProvStartDisplay
		m.formLbl = "Display name (required)"
		m.formBuf = ""
		return m, nil
	case formProvStartDisplay:
		if s == "" {
			return m, nil
		}
		m.wizDisplay = s
		m.formKind = formProvStartURL
		m.formLbl = "Production URL (required)"
		m.formBuf = ""
		return m, nil
	case formProvStartURL:
		if s == "" {
			return m, nil
		}
		m.wizURL = s
		m.formKind = formProvStartDesc
		m.formLbl = "Description (optional, enter to skip)"
		m.formBuf = ""
		return m, nil
	case formProvStartDesc:
		m.wizDesc = s
		m.formKind = formProvStartOrg
		m.formLbl = "GitHub org (optional, enter to skip)"
		m.formBuf = ""
		return m, nil
	case formProvStartOrg:
		m.wizOrg = s
		m.loading = true
		m.top = scrMain
		return m, cmdProvisionStartOutput(m.wizName, m.wizDisplay, m.wizURL, m.wizDesc, m.wizOrg)
	default:
		return m, nil
	}
}

func (m hubModel) updateFleetWrapped(msg tea.Msg) (tea.Model, tea.Cmd) {
	fm, cmd := m.fleet.updateFleet(msg)
	m.fleet = fm
	return m, cmd
}

// --- async command helpers ---

func showOutputCmd(title string, lines []string, err error) tea.Cmd {
	return func() tea.Msg {
		return outputMsg{title: title, lines: lines, err: err}
	}
}

func cmdPopMain() tea.Cmd {
	return func() tea.Msg { return popToMainMsg{} }
}

func cmdDoctorLines() tea.Cmd {
	return func() tea.Msg {
		lines, err := DoctorReportLines(mergedConfig())
		return outputMsg{title: "doctor", lines: lines, err: err}
	}
}

func cmdStatusListJSON() tea.Cmd {
	return func() tea.Msg {
		c := api.NewAdmin(mergedConfig())
		rows, err := c.FleetStatus(false)
		if err != nil {
			return outputMsg{title: "status list", err: err}
		}
		lines, e2 := jsonLines(rows)
		if e2 != nil {
			return outputMsg{title: "status list", err: e2}
		}
		return outputMsg{title: "status list", lines: lines}
	}
}

func cmdStatusRefreshAllOutput() tea.Cmd {
	return func() tea.Msg {
		c := api.NewAdmin(mergedConfig())
		out, err := c.RefreshFleetStatus()
		if err != nil {
			return outputMsg{title: "status refresh", err: err}
		}
		lines, e2 := jsonLines(out)
		if e2 != nil {
			return outputMsg{title: "status refresh", err: e2}
		}
		return outputMsg{title: "status refresh", lines: lines}
	}
}

func cmdStatusRefreshOneOutput(app string) tea.Cmd {
	return func() tea.Msg {
		c := api.NewAdmin(mergedConfig())
		out, err := c.RefreshAppStatus(app)
		if err != nil {
			return outputMsg{title: "status refresh --app", err: err}
		}
		lines, e2 := jsonLines(out)
		if e2 != nil {
			return outputMsg{title: "status refresh --app", err: e2}
		}
		return outputMsg{title: "status refresh --app " + app, lines: lines}
	}
}

func cmdAppsListJSON() tea.Cmd {
	return func() tea.Msg {
		c := api.NewAdmin(mergedConfig())
		apps, err := c.ListApps(false, false)
		if err != nil {
			return outputMsg{title: "apps list", err: err}
		}
		lines, e2 := jsonLines(apps)
		if e2 != nil {
			return outputMsg{title: "apps list", err: e2}
		}
		return outputMsg{title: "apps list", lines: lines}
	}
}

func cmdAppsCreateOutput(name, url string) tea.Cmd {
	return func() tea.Msg {
		c := api.NewAdmin(mergedConfig())
		out, err := c.CreateApp(api.CreateAppBody{Name: name, URL: url})
		if err != nil {
			return outputMsg{title: "apps create", err: err}
		}
		lines, e2 := jsonLines(out)
		if e2 != nil {
			return outputMsg{title: "apps create", err: e2}
		}
		return outputMsg{title: "apps create " + name, lines: lines}
	}
}

func cmdJobsList() tea.Cmd {
	return func() tea.Msg {
		c := api.NewAdmin(mergedConfig())
		jobs, err := c.ListProvisionJobs()
		if err != nil {
			return outputMsg{title: "jobs list", err: err}
		}
		lines, e2 := jsonLines(jobs)
		if e2 != nil {
			return outputMsg{title: "jobs list", err: e2}
		}
		return outputMsg{title: "jobs list", lines: lines}
	}
}

func cmdProvisionGetOutput(id string) tea.Cmd {
	return func() tea.Msg {
		c := api.NewProvision(mergedConfig())
		row, err := c.GetProvision(id)
		if err != nil {
			return outputMsg{title: "provision get", err: err}
		}
		lines, e2 := jsonLines(row)
		if e2 != nil {
			return outputMsg{title: "provision get", err: e2}
		}
		return outputMsg{title: "provision get " + id, lines: lines}
	}
}

func cmdProvisionRetryOutput(id string) tea.Cmd {
	return func() tea.Msg {
		c := api.NewAdmin(mergedConfig())
		out, err := c.RetryProvision(id)
		if err != nil {
			return outputMsg{title: "provision retry", err: err}
		}
		lines, e2 := jsonLines(out)
		if e2 != nil {
			return outputMsg{title: "provision retry", err: e2}
		}
		return outputMsg{title: "provision retry " + id, lines: lines}
	}
}

func cmdProvisionStartOutput(name, display, url, desc, org string) tea.Cmd {
	return func() tea.Msg {
		body := api.ProvisionStartBody{
			Name:        name,
			DisplayName: display,
			URL:         url,
			Description: desc,
			GithubOrg:   org,
		}
		c := api.NewProvision(mergedConfig())
		out, err := c.StartProvision(body)
		if err != nil {
			return outputMsg{title: "provision start", err: err}
		}
		lines, e2 := jsonLines(out)
		if e2 != nil {
			return outputMsg{title: "provision start", err: e2}
		}
		return outputMsg{title: "provision start " + name, lines: lines}
	}
}

func cmdAuditOutput(persist bool) tea.Cmd {
	return func() tea.Msg {
		c := api.NewAdmin(mergedConfig())
		out, err := c.Audit(persist)
		if err != nil {
			title := "audit"
			if persist {
				title = "audit --persist"
			}
			return outputMsg{title: title, err: err}
		}
		var results []any
		for _, raw := range out.Results {
			var v any
			_ = json.Unmarshal(raw, &v)
			results = append(results, v)
		}
		var reconcile any
		_ = json.Unmarshal(out.Reconcile, &reconcile)
		payload := map[string]any{"results": results, "reconcile": reconcile}
		lines, e2 := jsonLines(payload)
		if e2 != nil {
			return outputMsg{title: "audit", err: e2}
		}
		title := "audit"
		if persist {
			title = "audit --persist"
		}
		return outputMsg{title: title, lines: lines}
	}
}

func cmdGitHubRuns(ownerRepo string, perPage int) tea.Cmd {
	return func() tea.Msg {
		cfg := mergedConfig()
		if cfg.GitHubToken == "" {
			return outputMsg{title: "github runs", err: fmt.Errorf("set GITHUB_TOKEN or GH_TOKEN")}
		}
		parts := strings.SplitN(ownerRepo, "/", 2)
		if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
			return outputMsg{title: "github runs", err: fmt.Errorf("use OWNER/REPO")}
		}
		// reuse HTTP logic inline
		u := fmt.Sprintf(
			"https://api.github.com/repos/%s/%s/actions/runs?per_page=%d",
			parts[0], parts[1], perPage,
		)
		req, err := http.NewRequest(http.MethodGet, u, nil)
		if err != nil {
			return outputMsg{title: "github runs", err: err}
		}
		req.Header.Set("Authorization", "Bearer "+cfg.GitHubToken)
		req.Header.Set("Accept", "application/vnd.github+json")
		req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
		req.Header.Set("User-Agent", "narduk-cpctl")
		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			return outputMsg{title: "github runs", err: err}
		}
		defer resp.Body.Close()
		body, err := io.ReadAll(resp.Body)
		status := resp.StatusCode
		if err != nil {
			return outputMsg{title: "github runs", err: err}
		}
		if status < 200 || status >= 300 {
			return outputMsg{title: "github runs", err: fmt.Errorf("GitHub HTTP %d: %s", status, strings.TrimSpace(string(body)))}
		}
		var decoded any
		if err := json.Unmarshal(body, &decoded); err != nil {
			return outputMsg{title: "github runs", err: err}
		}
		lines, e2 := jsonLines(decoded)
		if e2 != nil {
			return outputMsg{title: "github runs", err: e2}
		}
		return outputMsg{title: "github runs " + ownerRepo, lines: lines}
	}
}

func jsonLines(v any) ([]string, error) {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return nil, err
	}
	return strings.Split(string(b), "\n"), nil
}

// --- View ---

var (
	styleTitle   = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("205"))
	styleHelp    = lipgloss.NewStyle().Faint(true)
	styleErr     = lipgloss.NewStyle().Foreground(lipgloss.Color("196"))
	styleSel     = lipgloss.NewStyle().Foreground(lipgloss.Color("159")).Bold(true)
	styleDim     = lipgloss.NewStyle().Foreground(lipgloss.Color("240"))
	styleToast   = lipgloss.NewStyle().Foreground(lipgloss.Color("220"))
	styleHeader  = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("252"))
	styleMenuSel = lipgloss.NewStyle().Foreground(lipgloss.Color("212")).Bold(true)
	styleBorder  = lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).Padding(0, 1)
)

func (m hubModel) View() string {
	if m.err != nil {
		return styleTitle.Render("cpctl") + "\n\n" + styleErr.Render(m.err.Error()) + "\n\n" + styleHelp.Render("q quit")
	}
	if m.loading {
		return styleTitle.Render("cpctl") + "\n\n" + styleToast.Render("Loading…") + "\n\n" + styleHelp.Render("esc back where applicable")
	}
	switch m.top {
	case scrMain:
		return m.viewMain()
	case scrSubMenu:
		return m.viewSubMenu()
	case scrOutput:
		return m.viewOutput()
	case scrForm:
		return m.viewForm()
	case scrFleet:
		return m.fleet.viewFleet()
	default:
		return ""
	}
}

func (m hubModel) viewMain() string {
	var b strings.Builder
	b.WriteString(styleTitle.Render("cpctl — main menu"))
	b.WriteString("\n\n")
	items := mainMenuItems()
	for i, it := range items {
		prefix := "  "
		line := fmt.Sprintf("%s%s", prefix, it)
		if i == m.mainCursor {
			b.WriteString(styleMenuSel.Render("› " + it))
		} else {
			b.WriteString(line)
		}
		b.WriteString("\n")
	}
	b.WriteString("\n")
	b.WriteString(styleHelp.Render("↑↓/jk · enter open · q quit"))
	return b.String()
}

func (m hubModel) viewSubMenu() string {
	var b strings.Builder
	title := "menu"
	switch m.subKind {
	case subStatus:
		title = "Status (cpctl status …)"
	case subApps:
		title = "Apps (cpctl apps …)"
	case subProvision:
		title = "Provision (cpctl provision …)"
	case subAudit:
		title = "Audit (cpctl audit)"
	}
	b.WriteString(styleTitle.Render(title))
	b.WriteString("\n\n")
	labels := m.subMenuLabels()
	for i, lab := range labels {
		if i == m.subCur {
			b.WriteString(styleMenuSel.Render("› " + lab))
		} else {
			b.WriteString("  " + lab)
		}
		b.WriteString("\n")
	}
	b.WriteString("\n")
	b.WriteString(styleHelp.Render("↑↓/jk · enter · esc main menu"))
	return b.String()
}

func (m hubModel) viewOutput() string {
	var b strings.Builder
	b.WriteString(styleTitle.Render("cpctl — " + m.outputTitle))
	b.WriteString("\n\n")
	vis := m.outVisibleLines()
	end := m.outScroll + vis
	if end > len(m.outputLines) {
		end = len(m.outputLines)
	}
	w := m.width - 4
	if w < 40 {
		w = 76
	}
	for i := m.outScroll; i < end; i++ {
		line := m.outputLines[i]
		if len(line) > w {
			line = line[:w-1] + "…"
		}
		b.WriteString(line)
		b.WriteString("\n")
	}
	if len(m.outputLines) == 0 {
		b.WriteString(styleDim.Render("(empty)"))
		b.WriteString("\n")
	} else {
		b.WriteString(styleDim.Render(fmt.Sprintf("lines %d–%d of %d", m.outScroll+1, end, len(m.outputLines))))
		b.WriteString("\n")
	}
	b.WriteString("\n")
	b.WriteString(styleHelp.Render("↑↓/jk scroll · pgup/pgdn · esc main menu"))
	return b.String()
}

func (m hubModel) viewForm() string {
	var b strings.Builder
	b.WriteString(styleTitle.Render("cpctl — input"))
	b.WriteString("\n\n")
	b.WriteString(styleHeader.Render(m.formLbl))
	b.WriteString("\n\n")
	b.WriteString(styleBorder.Render(m.formBuf + "▏"))
	b.WriteString("\n\n")
	b.WriteString(styleHelp.Render("type · enter submit · esc cancel"))
	return b.String()
}

func truncateRunes(s string, max int) string {
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	return string(r[:max-1]) + "…"
}

func init() {
	rootCmd.AddCommand(cmdTUI)
}
