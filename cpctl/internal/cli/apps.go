package cli

import (
	"github.com/narduk-enterprises/control-plane/cpctl/internal/api"
	"github.com/spf13/cobra"
)

var (
	appsAll       bool
	appsForce     bool
	createDoppler string
	createPort    int
)

var cmdApps = &cobra.Command{
	Use:   "apps",
	Short: "Fleet app registry (admin API key)",
}

var cmdAppsList = &cobra.Command{
	Use:   "list",
	Short: "List fleet apps",
	RunE: func(cmd *cobra.Command, args []string) error {
		c := api.NewAdmin(mergedConfig())
		apps, err := c.ListApps(appsAll, appsForce)
		if err != nil {
			return err
		}
		return printJSON(apps)
	},
}

var cmdAppsCreate = &cobra.Command{
	Use:   "create NAME URL",
	Short: "Register a fleet app",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		body := api.CreateAppBody{Name: args[0], URL: args[1]}
		if createDoppler != "" {
			body.DopplerProject = createDoppler
		}
		if createPort != 0 {
			p := createPort
			body.NuxtPort = &p
		}
		c := api.NewAdmin(mergedConfig())
		out, err := c.CreateApp(body)
		if err != nil {
			return err
		}
		return printJSON(out)
	},
}

var cmdAppsUpdate = &cobra.Command{
	Use:   "update NAME",
	Short: "Patch fields on a fleet app (use flags)",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		flags := cmd.Flags()
		body := api.UpdateAppBody{}
		if flags.Changed("url") {
			s, _ := flags.GetString("url")
			body.URL = &s
		}
		if flags.Changed("doppler-project") {
			s, _ := flags.GetString("doppler-project")
			body.DopplerProject = &s
		}
		if flags.Changed("nuxt-port") {
			n, _ := flags.GetInt("nuxt-port")
			body.NuxtPort = &n
		}
		if flags.Changed("github-repo") {
			s, _ := flags.GetString("github-repo")
			body.GithubRepo = &s
		}
		if flags.Changed("inactive") {
			b := false
			body.IsActive = &b
		}
		if flags.Changed("active") {
			b := true
			body.IsActive = &b
		}
		c := api.NewAdmin(mergedConfig())
		out, err := c.UpdateApp(args[0], body)
		if err != nil {
			return err
		}
		return printJSON(out)
	},
}

var cmdAppsDelete = &cobra.Command{
	Use:   "delete NAME",
	Short: "Soft-delete a fleet app (use --hard to remove row)",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		hard, _ := cmd.Flags().GetBool("hard")
		c := api.NewAdmin(mergedConfig())
		out, err := c.DeleteApp(args[0], hard)
		if err != nil {
			return err
		}
		return printJSON(out)
	},
}

func init() {
	cmdAppsList.Flags().BoolVar(&appsAll, "all", false, "include inactive apps")
	cmdAppsList.Flags().BoolVar(&appsForce, "force", false, "bypass D1 cache for list")
	cmdAppsCreate.Flags().StringVar(&createDoppler, "doppler-project", "", "defaults to app name")
	cmdAppsCreate.Flags().IntVar(&createPort, "nuxt-port", 0, "optional explicit port")

	cmdAppsUpdate.Flags().String("url", "", "")
	cmdAppsUpdate.Flags().String("doppler-project", "", "")
	cmdAppsUpdate.Flags().Int("nuxt-port", 0, "")
	cmdAppsUpdate.Flags().String("github-repo", "", "")
	cmdAppsUpdate.Flags().Bool("inactive", false, "set isActive=false")
	cmdAppsUpdate.Flags().Bool("active", false, "set isActive=true")

	cmdAppsDelete.Flags().Bool("hard", false, "permanent delete")

	cmdApps.AddCommand(cmdAppsList, cmdAppsCreate, cmdAppsUpdate, cmdAppsDelete)
}
