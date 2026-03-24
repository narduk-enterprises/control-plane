package cli

import (
	"github.com/narduk-enterprises/control-plane/cpctl/internal/api"
	"github.com/spf13/cobra"
)

var cmdJobs = &cobra.Command{
	Use:   "jobs",
	Short: "Provision jobs + logs (admin API key)",
}

var cmdJobsList = &cobra.Command{
	Use:   "list",
	Short: "Recent provision jobs with embedded logs",
	RunE: func(cmd *cobra.Command, args []string) error {
		c := api.NewAdmin(mergedConfig())
		jobs, err := c.ListProvisionJobs()
		if err != nil {
			return err
		}
		return printJSON(jobs)
	},
}

func init() {
	cmdJobs.AddCommand(cmdJobsList)
}
