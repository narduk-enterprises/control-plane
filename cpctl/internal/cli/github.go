package cli

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/spf13/cobra"
)

var cmdGitHub = &cobra.Command{
	Use:   "github",
	Short: "Query GitHub Actions for a repo (GITHUB_TOKEN or GH_TOKEN)",
}

var cmdGitHubRuns = &cobra.Command{
	Use:   "runs OWNER/REPO",
	Short: "List recent workflow runs",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg := mergedConfig()
		if cfg.GitHubToken == "" {
			return fmt.Errorf("set GITHUB_TOKEN or GH_TOKEN")
		}
		parts := strings.SplitN(args[0], "/", 2)
		if len(parts) != 2 {
			return fmt.Errorf("use OWNER/REPO")
		}
		perPage, _ := cmd.Flags().GetInt("per-page")
		u := fmt.Sprintf(
			"https://api.github.com/repos/%s/%s/actions/runs?per_page=%d",
			parts[0], parts[1], perPage,
		)
		req, err := http.NewRequest(http.MethodGet, u, nil)
		if err != nil {
			return err
		}
		req.Header.Set("Authorization", "Bearer "+cfg.GitHubToken)
		req.Header.Set("Accept", "application/vnd.github+json")
		req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
		req.Header.Set("User-Agent", "narduk-cpctl")

		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return err
		}
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return fmt.Errorf("GitHub HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
		}
		var decoded any
		if err := json.Unmarshal(body, &decoded); err != nil {
			return err
		}
		return printJSON(decoded)
	},
}

func init() {
	cmdGitHubRuns.Flags().Int("per-page", 10, "")
	cmdGitHub.AddCommand(cmdGitHubRuns)
}
