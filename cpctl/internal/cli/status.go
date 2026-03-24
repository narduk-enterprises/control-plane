package cli

import (
	"github.com/narduk-enterprises/control-plane/cpctl/internal/api"
	"github.com/spf13/cobra"
)

var statusForce bool

var cmdStatus = &cobra.Command{
	Use:   "status",
	Short: "Fleet reachability status",
}

var cmdStatusList = &cobra.Command{
	Use:   "list",
	Short: "List cached status rows (or refresh all if cache empty unless --no-auto-refresh)",
	RunE: func(cmd *cobra.Command, args []string) error {
		c := api.NewAdmin(mergedConfig())
		rows, err := c.FleetStatus(statusForce)
		if err != nil {
			return err
		}
		return printJSON(rows)
	},
}

var cmdStatusRefresh = &cobra.Command{
	Use:   "refresh",
	Short: "Re-check all fleet URLs and upsert app_status",
	RunE: func(cmd *cobra.Command, args []string) error {
		c := api.NewAdmin(mergedConfig())
		if name, _ := cmd.Flags().GetString("app"); name != "" {
			out, err := c.RefreshAppStatus(name)
			if err != nil {
				return err
			}
			return printJSON(out)
		}
		out, err := c.RefreshFleetStatus()
		if err != nil {
			return err
		}
		return printJSON(out)
	},
}

func init() {
	cmdStatusList.Flags().BoolVar(&statusForce, "force", false, "force live checks even when cache exists")
	cmdStatusRefresh.Flags().String("app", "", "refresh a single app only")
	cmdStatus.AddCommand(cmdStatusList, cmdStatusRefresh)
}
