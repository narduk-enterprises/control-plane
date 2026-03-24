package cli

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/narduk-enterprises/control-plane/cpctl/internal/api"
)

func TestFormatAuditLines_tableShape(t *testing.T) {
	r1, _ := json.Marshal(map[string]any{
		"app": "alpha",
		"url": "https://alpha.example",
		"checks": []map[string]any{
			{"name": "GA", "status": "pass", "message": "ok", "expected": nil, "actual": "G-1"},
		},
	})
	r2, _ := json.Marshal(map[string]any{
		"app":         "beta",
		"url":         "https://beta.example",
		"fetchError":  "timeout",
		"checks":      []map[string]any{},
	})
	rec, _ := json.Marshal(map[string]any{
		"mode":         "dry-run",
		"updatedCount": 0,
		"candidates": []map[string]any{
			{"app": "alpha", "previousMeasurementId": nil, "liveMeasurementId": "G-NEW"},
		},
	})

	out := api.AuditResponse{
		Results:   []json.RawMessage{r1, r2},
		Reconcile: rec,
	}
	lines, err := FormatAuditLines(out)
	if err != nil {
		t.Fatal(err)
	}
	joined := strings.Join(lines, "\n")
	for _, want := range []string{
		"Fleet audit",
		"alpha",
		"https://alpha.example",
		"GA",
		"PASS",
		"beta",
		"timeout",
		"Reconcile",
		"dry-run",
		"alpha",
		"G-NEW",
	} {
		if !strings.Contains(joined, want) {
			t.Errorf("output missing %q\n%s", want, joined)
		}
	}
}
