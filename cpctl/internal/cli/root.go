package cli

import (
	"fmt"
	"os"
	"strings"

	"github.com/narduk-enterprises/control-plane/cpctl/internal/config"
	"github.com/spf13/cobra"
)

var baseURLOverride string

func mergedConfig() config.Config {
	c := config.Load()
	if baseURLOverride != "" {
		c.BaseURL = strings.TrimRight(strings.TrimSpace(baseURLOverride), "/")
	}
	return c
}

var rootCmd = &cobra.Command{
	Use:   "cpctl",
	Short: "Control plane CLI — fleet apps, provisioning, status, audit",
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().StringVar(&baseURLOverride, "base-url", "", "override CONTROL_PLANE_URL")
	rootCmd.AddCommand(cmdDoctor)
	rootCmd.AddCommand(cmdApps)
	rootCmd.AddCommand(cmdStatus)
	rootCmd.AddCommand(cmdProvision)
	rootCmd.AddCommand(cmdJobs)
	rootCmd.AddCommand(cmdAudit)
	rootCmd.AddCommand(cmdGitHub)
}
