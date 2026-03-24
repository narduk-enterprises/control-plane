package cli

import (
	"fmt"
	"time"

	"github.com/narduk-enterprises/control-plane/cpctl/internal/api"
	"github.com/spf13/cobra"
)

var (
	provDisplayName string
	provURL         string
	provDescription string
	provGithubOrg   string
	provWatch       bool
	provInterval    time.Duration
	provTimeout     time.Duration
)

var cmdProvision = &cobra.Command{
	Use:   "provision",
	Short: "Start and poll provisioning (PROVISION_API_KEY)",
}

var cmdProvisionStart = &cobra.Command{
	Use:   "start NAME",
	Short: "Register app, create repo, dispatch provision-app workflow",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if provDisplayName == "" {
			return fmt.Errorf("--display-name is required")
		}
		if provURL == "" {
			return fmt.Errorf("--url is required")
		}
		body := api.ProvisionStartBody{
			Name:        args[0],
			DisplayName: provDisplayName,
			URL:         provURL,
			Description: provDescription,
			GithubOrg:   provGithubOrg,
		}
		pc := api.NewProvision(mergedConfig())
		out, err := pc.StartProvision(body)
		if err != nil {
			return err
		}
		if err := printJSON(out); err != nil {
			return err
		}
		if provWatch && out.ProvisionID != "" {
			return pollProvision(out.ProvisionID, pc)
		}
		return nil
	},
}

var cmdProvisionGet = &cobra.Command{
	Use:   "get ID",
	Short: "Poll provision job status",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		pc := api.NewProvision(mergedConfig())
		out, err := pc.GetProvision(args[0])
		if err != nil {
			return err
		}
		return printJSON(out)
	},
}

var cmdProvisionWatch = &cobra.Command{
	Use:   "watch ID",
	Short: "Poll until complete, failed, or timeout",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		pc := api.NewProvision(mergedConfig())
		return pollProvision(args[0], pc)
	},
}

var cmdProvisionRetry = &cobra.Command{
	Use:   "retry ID",
	Short: "Re-dispatch workflow for a failed job (admin API key)",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		ac := api.NewAdmin(mergedConfig())
		out, err := ac.RetryProvision(args[0])
		if err != nil {
			return err
		}
		return printJSON(out)
	},
}

func pollProvision(id string, pc *api.Client) error {
	deadline := time.Now().Add(provTimeout)
	term := map[string]bool{"complete": true, "failed": true}
	for time.Now().Before(deadline) {
		row, err := pc.GetProvision(id)
		if err != nil {
			return err
		}
		fmt.Printf("\rstatus=%s   ", row.Status)
		if term[row.Status] {
			fmt.Println()
			return printJSON(row)
		}
		time.Sleep(provInterval)
	}
	return fmt.Errorf("timeout after %s", provTimeout)
}

func init() {
	cmdProvisionStart.Flags().StringVar(&provDisplayName, "display-name", "", "human-readable name")
	cmdProvisionStart.Flags().StringVar(&provURL, "url", "", "production URL")
	cmdProvisionStart.Flags().StringVar(&provDescription, "description", "", "optional description")
	cmdProvisionStart.Flags().StringVar(&provGithubOrg, "github-org", "", "default from server")
	cmdProvisionStart.Flags().BoolVar(&provWatch, "watch", false, "poll until terminal status")
	cmdProvisionStart.Flags().DurationVar(&provInterval, "interval", 5*time.Second, "poll interval with --watch")
	cmdProvisionStart.Flags().DurationVar(&provTimeout, "timeout", 45*time.Minute, "max wait with --watch")

	cmdProvisionWatch.Flags().DurationVar(&provInterval, "interval", 5*time.Second, "poll interval")
	cmdProvisionWatch.Flags().DurationVar(&provTimeout, "timeout", 45*time.Minute, "max wait")

	cmdProvision.AddCommand(cmdProvisionStart, cmdProvisionGet, cmdProvisionWatch, cmdProvisionRetry)
}
