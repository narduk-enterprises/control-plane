package cli

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"text/tabwriter"
	"unicode/utf8"

	"github.com/narduk-enterprises/control-plane/cpctl/internal/api"
)

type auditCheckRow struct {
	Name     string  `json:"name"`
	Status   string  `json:"status"`
	Expected *string `json:"expected"`
	Actual   *string `json:"actual"`
	Message  string  `json:"message"`
}

type auditResultRow struct {
	App        string          `json:"app"`
	URL        string          `json:"url"`
	Checks     []auditCheckRow `json:"checks"`
	FetchError string          `json:"fetchError"`
}

type auditCandidateRow struct {
	App                   string  `json:"app"`
	PreviousMeasurementID *string `json:"previousMeasurementId"`
	LiveMeasurementID     string  `json:"liveMeasurementId"`
}

type auditReconcileRow struct {
	Mode         string              `json:"mode"`
	UpdatedCount int                 `json:"updatedCount"`
	Candidates   []auditCandidateRow `json:"candidates"`
}

func statusLabel(s string) string {
	switch s {
	case "pass":
		return "PASS"
	case "fail":
		return "FAIL"
	case "warning":
		return "WARN"
	case "skipped":
		return "SKIP"
	default:
		return strings.ToUpper(s)
	}
}

func strPtr(s *string) string {
	if s == nil {
		return "—"
	}
	t := strings.TrimSpace(*s)
	if t == "" {
		return "—"
	}
	return t
}

func truncateAudit(s string, maxRunes int) string {
	s = strings.ReplaceAll(s, "\n", " ")
	s = strings.TrimSpace(s)
	if maxRunes <= 0 || utf8.RuneCountInString(s) <= maxRunes {
		return s
	}
	runes := []rune(s)
	if maxRunes <= 1 {
		return string(runes[:1]) + "…"
	}
	return string(runes[:maxRunes-1]) + "…"
}

func checkDetail(c auditCheckRow) string {
	if m := strings.TrimSpace(c.Message); m != "" {
		return m
	}
	if a := strPtr(c.Actual); a != "—" {
		return a
	}
	if e := strPtr(c.Expected); e != "—" {
		return "expected " + e
	}
	return "—"
}

// FormatAuditLines renders fleet audit API output as fixed-width table rows (one string per line).
func FormatAuditLines(out api.AuditResponse) ([]string, error) {
	var results []auditResultRow
	for _, raw := range out.Results {
		var r auditResultRow
		if err := json.Unmarshal(raw, &r); err != nil {
			return nil, fmt.Errorf("parse audit result: %w", err)
		}
		results = append(results, r)
	}

	var rec auditReconcileRow
	if len(out.Reconcile) > 0 {
		_ = json.Unmarshal(out.Reconcile, &rec)
	}

	var lines []string
	lines = append(lines, "Fleet audit", strings.Repeat("─", 72), "")

	for _, r := range results {
		lines = append(lines, fmt.Sprintf("%s  %s", r.App, r.URL))
		if r.FetchError != "" {
			lines = append(lines, fmt.Sprintf("  fetch: %s", r.FetchError))
		}

		var buf strings.Builder
		tw := tabwriter.NewWriter(&buf, 0, 0, 2, ' ', 0)
		_, _ = fmt.Fprintln(tw, "CHECK\tSTATUS\tDETAIL")
		for _, c := range r.Checks {
			_, _ = fmt.Fprintf(tw, "%s\t%s\t%s\n",
				c.Name,
				statusLabel(c.Status),
				truncateAudit(checkDetail(c), 64),
			)
		}
		_ = tw.Flush()
		for _, row := range strings.Split(strings.TrimRight(buf.String(), "\n"), "\n") {
			if row != "" {
				lines = append(lines, "  "+row)
			}
		}
		lines = append(lines, "")
	}

	lines = append(lines, "Reconcile", strings.Repeat("─", 40))
	lines = append(lines, fmt.Sprintf("  mode: %s   updated: %d", rec.Mode, rec.UpdatedCount))
	if len(rec.Candidates) > 0 {
		var buf strings.Builder
		tw := tabwriter.NewWriter(&buf, 0, 0, 2, ' ', 0)
		_, _ = fmt.Fprintln(tw, "APP\tPREVIOUS GA\tLIVE GA")
		for _, c := range rec.Candidates {
			prev := strPtr(c.PreviousMeasurementID)
			_, _ = fmt.Fprintf(tw, "%s\t%s\t%s\n", c.App, prev, c.LiveMeasurementID)
		}
		_ = tw.Flush()
		for _, row := range strings.Split(strings.TrimRight(buf.String(), "\n"), "\n") {
			if row != "" {
				lines = append(lines, "  "+row)
			}
		}
	} else {
		lines = append(lines, "  (no reconcile candidates)")
	}

	return lines, nil
}

// PrintAuditTable writes human-readable audit output to w.
func PrintAuditTable(w io.Writer, out api.AuditResponse) error {
	lines, err := FormatAuditLines(out)
	if err != nil {
		return err
	}
	for _, ln := range lines {
		_, _ = fmt.Fprintln(w, ln)
	}
	return nil
}
