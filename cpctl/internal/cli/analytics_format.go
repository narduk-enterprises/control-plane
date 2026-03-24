package cli

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"text/tabwriter"
)

type analyticsAppSnap struct {
	App struct {
		Name string `json:"name"`
		URL  string `json:"url"`
	} `json:"app"`
	Range struct {
		StartDate string `json:"startDate"`
		EndDate   string `json:"endDate"`
	} `json:"range"`
	GeneratedAt string `json:"generatedAt"`
	Health      struct {
		Status string `json:"status"`
	} `json:"health"`
	Ga struct {
		Status  string          `json:"status"`
		Message *string         `json:"message"`
		Metrics json.RawMessage `json:"metrics"`
	} `json:"ga"`
	Gsc struct {
		Status  string          `json:"status"`
		Message *string         `json:"message"`
		Metrics json.RawMessage `json:"metrics"`
	} `json:"gsc"`
	Posthog struct {
		Status  string          `json:"status"`
		Message *string         `json:"message"`
		Metrics json.RawMessage `json:"metrics"`
	} `json:"posthog"`
	Indexnow struct {
		Status  string          `json:"status"`
		Message *string         `json:"message"`
		Metrics json.RawMessage `json:"metrics"`
	} `json:"indexnow"`
}

type gaMetricsShort struct {
	Summary *struct {
		ActiveUsers     float64 `json:"activeUsers"`
		ScreenPageViews float64 `json:"screenPageViews"`
	} `json:"summary"`
}

type gscMetricsShort struct {
	Totals *struct {
		Clicks      float64 `json:"clicks"`
		Impressions float64 `json:"impressions"`
	} `json:"totals"`
}

type phMetricsShort struct {
	Summary map[string]float64 `json:"summary"`
}

func strMsg(p *string) string {
	if p == nil {
		return ""
	}
	return strings.TrimSpace(*p)
}

func gaUsersPV(m json.RawMessage) (users, pv string) {
	if len(m) == 0 {
		return "—", "—"
	}
	var g gaMetricsShort
	if json.Unmarshal(m, &g) != nil || g.Summary == nil {
		return "—", "—"
	}
	return fmtNum(g.Summary.ActiveUsers), fmtNum(g.Summary.ScreenPageViews)
}

func gscClicksImp(m json.RawMessage) (clicks, imp string) {
	if len(m) == 0 {
		return "—", "—"
	}
	var g gscMetricsShort
	if json.Unmarshal(m, &g) != nil || g.Totals == nil {
		return "—", "—"
	}
	return fmtNum(g.Totals.Clicks), fmtNum(g.Totals.Impressions)
}

func posthogEventTotal(m json.RawMessage) string {
	if len(m) == 0 {
		return "—"
	}
	var p phMetricsShort
	if json.Unmarshal(m, &p) != nil || len(p.Summary) == 0 {
		return "—"
	}
	var sum float64
	for _, v := range p.Summary {
		sum += v
	}
	if sum == 0 {
		return "—"
	}
	return fmtNum(sum)
}

func fmtNum(n float64) string {
	if n != n { // NaN
		return "—"
	}
	if n == float64(int64(n)) {
		return fmt.Sprintf("%.0f", n)
	}
	return fmt.Sprintf("%.2f", n)
}

// FormatAnalyticsSummaryBytes renders fleet analytics summary JSON as lines.
func FormatAnalyticsSummaryBytes(raw []byte) ([]string, error) {
	var s struct {
		StartDate   string `json:"startDate"`
		EndDate     string `json:"endDate"`
		GeneratedAt string `json:"generatedAt"`
		Totals      struct {
			GaUsers          float64 `json:"gaUsers"`
			GaPageviews      float64 `json:"gaPageviews"`
			GscClicks        float64 `json:"gscClicks"`
			GscImpressions   float64 `json:"gscImpressions"`
			PosthogEvents    float64 `json:"posthogEvents"`
			PosthogUsers     float64 `json:"posthogUsers"`
			HealthyProviders struct {
				Ga       int `json:"ga"`
				Gsc      int `json:"gsc"`
				Posthog  int `json:"posthog"`
				Indexnow int `json:"indexnow"`
			} `json:"healthyProviders"`
		} `json:"totals"`
		Insights []struct {
			Type     string `json:"type"`
			Severity string `json:"severity"`
			AppName  string `json:"appName"`
			Message  string `json:"message"`
			Metric   string `json:"metric"`
		} `json:"insights"`
		Apps map[string]json.RawMessage `json:"apps"`
		Meta *struct {
			CachedAt string `json:"cachedAt"`
			Stale    bool   `json:"stale"`
		} `json:"_meta"`
	}
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil, err
	}

	var lines []string
	lines = append(lines, "Fleet analytics summary", strings.Repeat("─", 56))
	lines = append(lines, fmt.Sprintf("Range: %s → %s", s.StartDate, s.EndDate))
	lines = append(lines, fmt.Sprintf("Generated: %s", s.GeneratedAt))
	if s.Meta != nil {
		lines = append(lines, fmt.Sprintf("Cache: %s  stale=%v", s.Meta.CachedAt, s.Meta.Stale))
	}
	lines = append(lines, "")
	lines = append(lines, "Totals",
		fmt.Sprintf("  GA users: %s  pageviews: %s", fmtNum(s.Totals.GaUsers), fmtNum(s.Totals.GaPageviews)),
		fmt.Sprintf("  GSC clicks: %s  impressions: %s", fmtNum(s.Totals.GscClicks), fmtNum(s.Totals.GscImpressions)),
		fmt.Sprintf("  PostHog users: %s  events: %s", fmtNum(s.Totals.PosthogUsers), fmtNum(s.Totals.PosthogEvents)),
		fmt.Sprintf("  Healthy providers (apps): GA=%d GSC=%d PostHog=%d IndexNow=%d",
			s.Totals.HealthyProviders.Ga, s.Totals.HealthyProviders.Gsc,
			s.Totals.HealthyProviders.Posthog, s.Totals.HealthyProviders.Indexnow),
		"",
	)

	names := make([]string, 0, len(s.Apps))
	for k := range s.Apps {
		names = append(names, k)
	}
	sort.Strings(names)

	var buf strings.Builder
	tw := tabwriter.NewWriter(&buf, 0, 0, 2, ' ', 0)
	_, _ = fmt.Fprintln(tw, "APP\tHLTH\tGA\tGA users\tGA PV\tGSC clk\tGSC imp\tPH evt\tGSC\tPH\tIDX")
	for _, name := range names {
		rawApp := s.Apps[name]
		var snap analyticsAppSnap
		if json.Unmarshal(rawApp, &snap) != nil {
			_, _ = fmt.Fprintf(tw, "%s\t(parse err)\t—\t—\t—\t—\t—\t—\t—\t—\t—\n", name)
			continue
		}
		u, pv := gaUsersPV(snap.Ga.Metrics)
		clk, imp := gscClicksImp(snap.Gsc.Metrics)
		phe := posthogEventTotal(snap.Posthog.Metrics)
		_, _ = fmt.Fprintf(tw, "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n",
			name,
			snap.Health.Status,
			snap.Ga.Status,
			u, pv,
			clk, imp,
			phe,
			snap.Gsc.Status,
			snap.Posthog.Status,
			snap.Indexnow.Status,
		)
	}
	_ = tw.Flush()
	for _, row := range strings.Split(strings.TrimRight(buf.String(), "\n"), "\n") {
		if row != "" {
			lines = append(lines, row)
		}
	}
	lines = append(lines, "")

	if len(s.Insights) > 0 {
		lines = append(lines, "Insights", strings.Repeat("─", 40))
		for _, in := range s.Insights {
			lines = append(lines, fmt.Sprintf("  [%s/%s] %s — %s", in.Severity, in.Type, in.AppName, in.Message))
		}
	}

	return lines, nil
}

// FormatAnalyticsInsightsBytes renders insights-only API JSON.
func FormatAnalyticsInsightsBytes(raw []byte) ([]string, error) {
	var s struct {
		StartDate   string `json:"startDate"`
		EndDate     string `json:"endDate"`
		GeneratedAt string `json:"generatedAt"`
		Insights    []struct {
			Type     string `json:"type"`
			Severity string `json:"severity"`
			AppName  string `json:"appName"`
			Message  string `json:"message"`
			Metric   string `json:"metric"`
		} `json:"insights"`
	}
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil, err
	}
	var lines []string
	lines = append(lines, "Fleet analytics insights", strings.Repeat("─", 40))
	lines = append(lines, fmt.Sprintf("Range: %s → %s", s.StartDate, s.EndDate))
	lines = append(lines, fmt.Sprintf("Generated: %s", s.GeneratedAt), "")
	if len(s.Insights) == 0 {
		lines = append(lines, "(no insights)")
		return lines, nil
	}
	for _, in := range s.Insights {
		metric := in.Metric
		if metric != "" {
			metric = " [" + metric + "]"
		}
		lines = append(lines, fmt.Sprintf("• [%s/%s] %s%s — %s", in.Severity, in.Type, in.AppName, metric, in.Message))
	}
	return lines, nil
}

// FormatAnalyticsAppBytes renders a single-app analytics snapshot JSON.
func FormatAnalyticsAppBytes(raw []byte) ([]string, error) {
	var snap analyticsAppSnap
	if err := json.Unmarshal(raw, &snap); err != nil {
		return nil, err
	}
	u, pv := gaUsersPV(snap.Ga.Metrics)
	clk, imp := gscClicksImp(snap.Gsc.Metrics)
	phe := posthogEventTotal(snap.Posthog.Metrics)

	var lines []string
	lines = append(lines, "App analytics snapshot", strings.Repeat("─", 48))
	lines = append(lines, fmt.Sprintf("App: %s  %s", snap.App.Name, snap.App.URL))
	lines = append(lines, fmt.Sprintf("Range: %s → %s", snap.Range.StartDate, snap.Range.EndDate))
	lines = append(lines, fmt.Sprintf("Generated: %s", snap.GeneratedAt))
	lines = append(lines, fmt.Sprintf("Reachability: %s", snap.Health.Status), "")

	var buf strings.Builder
	tw := tabwriter.NewWriter(&buf, 0, 0, 2, ' ', 0)
	_, _ = fmt.Fprintln(tw, "PROVIDER\tSTATUS\tNOTE")
	_, _ = fmt.Fprintf(tw, "GA4\t%s\tusers=%s pageviews=%s %s\n", snap.Ga.Status, u, pv, strMsg(snap.Ga.Message))
	_, _ = fmt.Fprintf(tw, "GSC\t%s\tclicks=%s impr=%s %s\n", snap.Gsc.Status, clk, imp, strMsg(snap.Gsc.Message))
	_, _ = fmt.Fprintf(tw, "PostHog\t%s\tevents(sum)=%s %s\n", snap.Posthog.Status, phe, strMsg(snap.Posthog.Message))
	_, _ = fmt.Fprintf(tw, "IndexNow\t%s\t%s\n", snap.Indexnow.Status, strMsg(snap.Indexnow.Message))
	_ = tw.Flush()
	for _, row := range strings.Split(strings.TrimRight(buf.String(), "\n"), "\n") {
		if row != "" {
			lines = append(lines, row)
		}
	}
	return lines, nil
}
