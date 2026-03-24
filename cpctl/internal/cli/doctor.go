package cli

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/narduk-enterprises/control-plane/cpctl/internal/api"
	"github.com/narduk-enterprises/control-plane/cpctl/internal/config"
	"github.com/spf13/cobra"
)

var cmdDoctor = &cobra.Command{
	Use:   "doctor",
	Short: "Check control plane reachability and optional admin auth",
	RunE:  runDoctor,
}

func runDoctor(cmd *cobra.Command, args []string) error {
	cfg := mergedConfig()
	lines, err := DoctorReportLines(cfg)
	if err != nil {
		return err
	}
	for _, ln := range lines {
		fmt.Println(ln)
	}
	return nil
}

// DoctorReportLines returns human-readable lines (for cpctl doctor and the TUI).
func DoctorReportLines(cfg config.Config) ([]string, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	healthURL := cfg.BaseURL + "/api/health"
	resp, err := client.Get(healthURL)
	if err != nil {
		return nil, fmt.Errorf("GET %s: %w", healthURL, err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var lines []string
	lines = append(lines, fmt.Sprintf("GET %s → %d", healthURL, resp.StatusCode))
	if len(body) > 0 {
		var m map[string]any
		if json.Unmarshal(body, &m) == nil {
			b, _ := json.MarshalIndent(m, "", "  ")
			lines = append(lines, string(b))
		} else {
			lines = append(lines, string(body))
		}
	}
	if cfg.HasAdmin() {
		ac := api.NewAdmin(cfg)
		apps, err := ac.ListApps(false, false)
		if err != nil {
			lines = append(lines, fmt.Sprintf("admin fleet apps: %v", err))
		} else {
			lines = append(lines, fmt.Sprintf("admin: OK (%d active apps in registry)", len(apps)))
		}
	} else {
		lines = append(lines, "admin: skip (set CONTROL_PLANE_API_KEY to verify fleet API)")
	}
	if cfg.HasProvision() {
		lines = append(lines, "provision key: set")
	} else {
		lines = append(lines, "provision key: not set (PROVISION_API_KEY)")
	}
	return lines, nil
}
