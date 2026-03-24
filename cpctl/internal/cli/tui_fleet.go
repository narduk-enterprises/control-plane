package cli

import (
	"fmt"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/charmbracelet/bubbletea"
	"github.com/narduk-enterprises/control-plane/cpctl/internal/api"
)

// --- fleet sub-panel (cpctl tui → Fleet dashboard) ---

type fleetMode int

const (
	modeList fleetMode = iota
	modeActions
	modeDetail
	modeConfirmDelete
)

type fleetPanel struct {
	width, height int
	apps          []api.FleetApp
	status        map[string]api.StatusRow
	err           error
	loading       bool

	mode         fleetMode
	cursor       int
	scrollTop    int
	actionCursor int
	toast        string
}

func newFleetPanel(w, h int) fleetPanel {
	return fleetPanel{
		width: w, height: h,
		status: map[string]api.StatusRow{},
		mode:   modeList,
	}
}

func loadDashboard() tea.Msg {
	cfg := mergedConfig()
	if !cfg.HasAdmin() {
		return errMsg{fmt.Errorf("set CONTROL_PLANE_API_KEY")}
	}
	ac := api.NewAdmin(cfg)
	apps, err := ac.ListApps(false, false)
	if err != nil {
		return errMsg{err}
	}
	st, err := ac.FleetStatus(false)
	if err != nil {
		return errMsg{err}
	}
	return fetchDashMsg{apps: apps, status: st}
}

func cmdRefreshApp(name string) tea.Cmd {
	return func() tea.Msg {
		cfg := mergedConfig()
		ac := api.NewAdmin(cfg)
		out, err := ac.RefreshAppStatus(name)
		if err != nil {
			return refreshOneMsg{name: name, err: err}
		}
		return refreshOneMsg{name: name, row: out.Status}
	}
}

func cmdFleetRefresh() tea.Cmd {
	return func() tea.Msg {
		cfg := mergedConfig()
		ac := api.NewAdmin(cfg)
		out, err := ac.RefreshFleetStatus()
		if err != nil {
			return fleetRefreshMsg{err: err}
		}
		return fleetRefreshMsg{rows: out.Statuses}
	}
}

func cmdToggleActive(name string, makeActive bool) tea.Cmd {
	return func() tea.Msg {
		cfg := mergedConfig()
		ac := api.NewAdmin(cfg)
		_, err := ac.UpdateApp(name, api.UpdateAppBody{IsActive: &makeActive})
		if err != nil {
			return mutationMsg{err: err, reload: false}
		}
		action := "deactivated"
		if makeActive {
			action = "activated"
		}
		return mutationMsg{text: name + " " + action, reload: true}
	}
}

func cmdSoftDelete(name string) tea.Cmd {
	return func() tea.Msg {
		cfg := mergedConfig()
		ac := api.NewAdmin(cfg)
		_, err := ac.DeleteApp(name, false)
		if err != nil {
			return mutationMsg{err: err, reload: false}
		}
		return mutationMsg{text: name + " soft-deleted", reload: true}
	}
}

func cmdOpenURL(raw string) tea.Cmd {
	return func() tea.Msg {
		if raw == "" {
			return mutationMsg{text: "", err: fmt.Errorf("no URL"), reload: false}
		}
		var c *exec.Cmd
		switch runtime.GOOS {
		case "darwin":
			c = exec.Command("open", raw)
		case "windows":
			c = exec.Command("cmd", "/c", "start", "", raw)
		default:
			c = exec.Command("xdg-open", raw)
		}
		if err := c.Start(); err != nil {
			return mutationMsg{text: "", err: fmt.Errorf("open URL: %w", err), reload: false}
		}
		return mutationMsg{text: "opened URL in browser", reload: false}
	}
}

func scheduleToastClear() tea.Cmd {
	return tea.Tick(2*time.Second, func(time.Time) tea.Msg {
		return toastClearMsg{}
	})
}

func (p *fleetPanel) selectedApp() *api.FleetApp {
	if p.cursor < 0 || p.cursor >= len(p.apps) {
		return nil
	}
	return &p.apps[p.cursor]
}

func (p *fleetPanel) clampCursor() {
	if len(p.apps) == 0 {
		p.cursor = 0
		return
	}
	if p.cursor < 0 {
		p.cursor = 0
	}
	if p.cursor >= len(p.apps) {
		p.cursor = len(p.apps) - 1
	}
}

func (p *fleetPanel) listVisibleRows() int {
	reserved := 10
	if p.height > reserved {
		return p.height - reserved
	}
	return 8
}

func (p *fleetPanel) syncScroll() {
	vis := p.listVisibleRows()
	if vis < 1 {
		return
	}
	if p.cursor < p.scrollTop {
		p.scrollTop = p.cursor
	}
	if p.cursor >= p.scrollTop+vis {
		p.scrollTop = p.cursor - vis + 1
	}
	if p.scrollTop < 0 {
		p.scrollTop = 0
	}
	maxScroll := len(p.apps) - vis
	if maxScroll < 0 {
		maxScroll = 0
	}
	if p.scrollTop > maxScroll {
		p.scrollTop = maxScroll
	}
}

func (p *fleetPanel) actionLabels() []string {
	a := p.selectedApp()
	if a == nil {
		return nil
	}
	act := "Deactivate"
	if !a.IsActive {
		act = "Reactivate"
	}
	return []string{
		"Re-check reachability",
		act + " app",
		"View full details",
		"Open URL in browser",
		"Soft-delete app…",
	}
}

func (p fleetPanel) updateFleet(msg tea.Msg) (fleetPanel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		p.width = msg.Width
		p.height = msg.Height
		p.syncScroll()
		return p, nil

	case tea.KeyMsg:
		key := strings.ToLower(msg.String())
		switch p.mode {
		case modeList:
			return p.updateListKeys(key, msg)
		case modeActions:
			return p.updateActionKeys(key, msg)
		case modeDetail:
			if key == "esc" || key == "q" {
				p.mode = modeList
				return p, nil
			}
			return p, nil
		case modeConfirmDelete:
			return p.updateConfirmKeys(key)
		}

	case fetchDashMsg:
		p.loading = false
		p.apps = msg.apps
		p.status = map[string]api.StatusRow{}
		for _, s := range msg.status {
			p.status[s.App] = s
		}
		p.clampCursor()
		p.syncScroll()
		return p, nil

	case errMsg:
		p.loading = false
		p.err = msg.err
		return p, nil

	case refreshOneMsg:
		p.loading = false
		if msg.err != nil {
			p.toast = msg.err.Error()
		} else {
			p.status[msg.name] = msg.row
			p.toast = fmt.Sprintf("%s → %s (%d)", msg.name, msg.row.Status, msg.row.StatusCode)
		}
		return p, tea.Batch(scheduleToastClear())

	case fleetRefreshMsg:
		p.loading = false
		if msg.err != nil {
			p.toast = msg.err.Error()
		} else {
			for _, s := range msg.rows {
				p.status[s.App] = s
			}
			p.toast = fmt.Sprintf("refreshed %d apps", len(msg.rows))
		}
		return p, tea.Batch(scheduleToastClear())

	case mutationMsg:
		p.loading = false
		if msg.err != nil {
			p.toast = msg.err.Error()
			return p, tea.Batch(scheduleToastClear())
		}
		p.toast = msg.text
		if msg.reload {
			p.loading = true
			p.mode = modeList
			p.actionCursor = 0
			return p, tea.Batch(scheduleToastClear(), loadDashboard)
		}
		return p, scheduleToastClear()

	case toastClearMsg:
		p.toast = ""
		return p, nil
	}
	return p, nil
}

func (p fleetPanel) updateListKeys(key string, msg tea.KeyMsg) (fleetPanel, tea.Cmd) {
	switch key {
	case "esc":
		return p, cmdPopMain()
	case "q", "ctrl+c":
		return p, tea.Quit
	case "r":
		p.loading = true
		p.err = nil
		return p, loadDashboard
	case "f":
		p.loading = true
		return p, cmdFleetRefresh()
	}

	if len(p.apps) == 0 && p.err == nil {
		return p, nil
	}

	switch key {
	case "up", "k":
		p.cursor--
		p.clampCursor()
		p.syncScroll()
	case "down", "j":
		p.cursor++
		p.clampCursor()
		p.syncScroll()
	case "home", "g":
		p.cursor = 0
		p.syncScroll()
	case "end":
		p.cursor = len(p.apps) - 1
		p.syncScroll()
	case "pgdown", "ctrl+d":
		p.cursor += p.listVisibleRows()
		p.clampCursor()
		p.syncScroll()
	case "pgup", "ctrl+u":
		p.cursor -= p.listVisibleRows()
		p.clampCursor()
		p.syncScroll()
	case "enter":
		if p.err != nil {
			return p, nil
		}
		p.mode = modeActions
		p.actionCursor = 0
		return p, nil
	}
	return p, nil
}

func (p fleetPanel) updateActionKeys(key string, msg tea.KeyMsg) (fleetPanel, tea.Cmd) {
	labels := p.actionLabels()
	if len(labels) == 0 {
		p.mode = modeList
		return p, nil
	}
	switch key {
	case "esc":
		p.mode = modeList
		return p, nil
	case "up", "k":
		if p.actionCursor > 0 {
			p.actionCursor--
		}
	case "down", "j":
		if p.actionCursor < len(labels)-1 {
			p.actionCursor++
		}
	case "enter":
		return p.runSelectedAction()
	default:
		if len(key) == 1 && key[0] >= '1' && key[0] <= '5' {
			i := int(key[0] - '1')
			if i < len(labels) {
				p.actionCursor = i
				return p.runSelectedAction()
			}
		}
	}
	return p, nil
}

func (p fleetPanel) runSelectedAction() (fleetPanel, tea.Cmd) {
	a := p.selectedApp()
	if a == nil {
		p.mode = modeList
		return p, nil
	}
	switch p.actionCursor {
	case 0:
		p.mode = modeList
		p.loading = true
		return p, cmdRefreshApp(a.Name)
	case 1:
		p.mode = modeList
		p.loading = true
		next := !a.IsActive
		return p, cmdToggleActive(a.Name, next)
	case 2:
		p.mode = modeDetail
		return p, nil
	case 3:
		p.mode = modeList
		return p, cmdOpenURL(a.URL)
	case 4:
		p.mode = modeConfirmDelete
		return p, nil
	default:
		p.mode = modeList
		return p, nil
	}
}

func (p fleetPanel) updateConfirmKeys(key string) (fleetPanel, tea.Cmd) {
	switch key {
	case "esc", "n":
		p.mode = modeList
		return p, nil
	case "y":
		a := p.selectedApp()
		if a == nil {
			p.mode = modeList
			return p, nil
		}
		p.mode = modeList
		p.loading = true
		return p, cmdSoftDelete(a.Name)
	default:
		return p, nil
	}
}

func (p fleetPanel) viewFleet() string {
	title := styleTitle.Render("cpctl — fleet dashboard")
	help := styleHelp.Render("esc main menu · ↑↓/jk · enter actions · r reload · f refresh all · q quit")
	if p.err != nil {
		return title + "\n\n" + styleErr.Render(p.err.Error()) + "\n\n" + help
	}
	if p.loading && len(p.apps) == 0 {
		return title + "\n\nLoading…\n\n" + help
	}

	switch p.mode {
	case modeDetail:
		return p.viewFleetDetail(title)
	case modeActions:
		return p.viewFleetActions(title)
	case modeConfirmDelete:
		return p.viewFleetConfirm(title)
	default:
		return p.viewFleetList(title, help)
	}
}

func (p fleetPanel) viewFleetList(title, help string) string {
	var b strings.Builder
	b.WriteString(title)
	if p.toast != "" {
		b.WriteString("  ")
		b.WriteString(styleToast.Render(p.toast))
	}
	b.WriteString("\n\n")
	b.WriteString(help)
	b.WriteString("\n\n")

	header := fmt.Sprintf("%-2s %-26s %-8s %-6s %s", "", "app", "status", "code", "url")
	b.WriteString(styleHeader.Render(header))
	b.WriteString("\n")
	ruleW := min(p.width-4, 86)
	if ruleW < 40 {
		ruleW = 40
	}
	b.WriteString(styleDim.Render(strings.Repeat("─", ruleW)))
	b.WriteString("\n")

	vis := p.listVisibleRows()
	end := p.scrollTop + vis
	if end > len(p.apps) {
		end = len(p.apps)
	}
	for i := p.scrollTop; i < end; i++ {
		a := p.apps[i]
		st, ok := p.status[a.Name]
		stStr, code := "—", "—"
		if ok {
			stStr = st.Status
			code = fmt.Sprintf("%d", st.StatusCode)
		}
		url := a.URL
		maxU := 36
		if p.width > 90 {
			maxU = p.width - 54
		}
		if len(url) > maxU {
			url = url[:maxU-1] + "…"
		}
		if i == p.cursor {
			line := fmt.Sprintf("› %-25s %-8s %-6s %s", truncateRunes(a.Name, 25), stStr, code, url)
			b.WriteString(styleSel.Render(line))
			b.WriteString("\n")
		} else {
			line := fmt.Sprintf("  %-26s %-8s %-6s %s", truncateRunes(a.Name, 26), stStr, code, url)
			b.WriteString(line)
			b.WriteString("\n")
		}
	}

	if len(p.apps) == 0 {
		b.WriteString(styleDim.Render("(no apps)"))
		b.WriteString("\n")
	} else if len(p.apps) > vis {
		b.WriteString(styleDim.Render(fmt.Sprintf("… %d–%d of %d …", p.scrollTop+1, end, len(p.apps))))
		b.WriteString("\n")
	}

	b.WriteString("\n")
	if a := p.selectedApp(); a != nil && len(p.apps) > 0 {
		active := "active"
		if !a.IsActive {
			active = "inactive"
		}
		gh := a.GithubRepo
		if gh == "" {
			gh = "—"
		}
		dp := a.DopplerProject
		if dp == "" {
			dp = "—"
		}
		detail := fmt.Sprintf("%s · doppler %s · github %s · %s", active, dp, gh, truncateRunes(a.URL, 60))
		b.WriteString(styleDim.Render(detail))
		b.WriteString("\n")
	}

	if p.loading && len(p.apps) > 0 {
		b.WriteString(styleToast.Render("working…"))
		b.WriteString("\n")
	}
	return b.String()
}

func (p fleetPanel) viewFleetActions(title string) string {
	a := p.selectedApp()
	if a == nil {
		return p.viewFleetList(title, styleHelp.Render("esc main menu · q quit"))
	}
	var b strings.Builder
	b.WriteString(title)
	b.WriteString("\n\n")
	b.WriteString(styleHeader.Render("Actions — " + a.Name))
	b.WriteString("\n\n")
	labels := p.actionLabels()
	for i, lab := range labels {
		num := fmt.Sprintf("%d. ", i+1)
		if i == p.actionCursor {
			b.WriteString(styleMenuSel.Render(num + lab))
		} else {
			b.WriteString(num + lab)
		}
		b.WriteString("\n")
	}
	b.WriteString("\n")
	b.WriteString(styleHelp.Render("↑↓/jk · enter run · 1-5 · esc back"))
	return b.String()
}

func (p fleetPanel) viewFleetConfirm(title string) string {
	a := p.selectedApp()
	name := ""
	if a != nil {
		name = a.Name
	}
	var b strings.Builder
	b.WriteString(title)
	b.WriteString("\n\n")
	box := styleBorder.Render(
		styleErr.Render("Soft-delete "+name+"?") +
			"\n\n" +
			styleHelp.Render("This sets the app inactive in the registry (not --hard).") +
			"\n\n" +
			"y confirm · n / esc cancel",
	)
	b.WriteString(box)
	return b.String()
}

func (p fleetPanel) viewFleetDetail(title string) string {
	a := p.selectedApp()
	if a == nil {
		return p.viewFleetList(title, styleHelp.Render("esc main menu · q quit"))
	}
	st, ok := p.status[a.Name]
	stLine := "—"
	if ok {
		stLine = fmt.Sprintf("%s (HTTP %d) · checked %s", st.Status, st.StatusCode, st.CheckedAt)
	}
	port := "—"
	if a.NuxtPort != nil {
		port = fmt.Sprintf("%d", *a.NuxtPort)
	}
	active := "true"
	if !a.IsActive {
		active = "false"
	}
	body := fmt.Sprintf(
		"name:          %s\nurl:           %s\nactive:        %s\ndoppler:       %s\nnuxt port:     %s\nga property:   %s\nga measurement: %s\ngithub:        %s\ndescription:   %s\ncreated:       %s\nupdated:       %s\n\nreachability:  %s",
		a.Name,
		a.URL,
		active,
		nonEmptyStr(a.DopplerProject),
		port,
		nonEmptyStr(a.GaPropertyID),
		nonEmptyStr(a.GaMeasurementID),
		nonEmptyStr(a.GithubRepo),
		nonEmptyStr(a.AppDescription),
		a.CreatedAt,
		a.UpdatedAt,
		stLine,
	)
	var b strings.Builder
	b.WriteString(title)
	b.WriteString("\n\n")
	b.WriteString(styleBorder.Render(body))
	b.WriteString("\n\n")
	b.WriteString(styleHelp.Render("esc back to list"))
	return b.String()
}

func nonEmptyStr(s string) string {
	if s == "" {
		return "—"
	}
	return s
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
</think>
Fixing fleet navigation: `esc` should return to the main menu, not quit. Adding `popToMainMsg` and completing `tui_fleet.go`.

<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
Read