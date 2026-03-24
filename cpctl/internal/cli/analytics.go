package cli

import (
	"encoding/json"
	"os"

	"github.com/narduk-enterprises/control-plane/cpctl/internal/api"
	"github.com/spf13/cobra"
)

var (
	analyticsStart string
	analyticsEnd   string
	analyticsForce bool
	analyticsJSON  bool
)

var cmdAnalytics = &cobra.Command{
	Use:   "analytics",
	Short: "Fleet GA / GSC / PostHog analytics (admin); table unless --json",
}

var cmdAnalyticsSummary = &cobra.Command{
	Use:   "summary",
	Short: "Fleet-wide analytics summary for the date range",
	RunE: func(cmd *cobra.Command, args []string) error {
		c := api.NewAdmin(mergedConfig())
		raw, err := c.FleetAnalyticsSummary(analyticsStart, analyticsEnd, analyticsForce)
		if err != nil {
			return err
		}
		if analyticsJSON {
			return printRawJSON(raw)
		}
		lines, err := FormatAnalyticsSummaryBytes(raw)
		if err != nil {
			return err
		}
		for _, ln := range lines {
			_, _ = os.Stdout.WriteString(ln + "\n")
		}
		return nil
	},
}

var cmdAnalyticsInsights = &cobra.Command{
	Use:   "insights",
	Short: "Insight cards only (spikes, drops, milestones)",
	RunE: func(cmd *cobra.Command, args []string) error {
		c := api.NewAdmin(mergedConfig())
		raw, err := c.FleetAnalyticsInsights(analyticsStart, analyticsEnd, analyticsForce)
		if err != nil {
			return err
		}
		if analyticsJSON {
			return printRawJSON(raw)
		}
		lines, err := FormatAnalyticsInsightsBytes(raw)
		if err != nil {
			return err
		}
		for _, ln := range lines {
			_, _ = os.Stdout.WriteString(ln + "\n")
		}
		return nil
	},
}

var cmdAnalyticsApp = &cobra.Command{
	Use:   "app [slug]",
	Short: "Single-app analytics snapshot",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c := api.NewAdmin(mergedConfig())
		raw, err := c.FleetAnalyticsApp(args[0], analyticsStart, analyticsEnd, analyticsForce)
		if err != nil {
			return err
		}
		if analyticsJSON {
			return printRawJSON(raw)
		}
		lines, err := FormatAnalyticsAppBytes(raw)
		if err != nil {
			return err
		}
		for _, ln := range lines {
			_, _ = os.Stdout.WriteString(ln + "\n")
		}
		return nil
	},
}

func printRawJSON(raw []byte) error {
	var v any
	if err := json.Unmarshal(raw, &v); err != nil {
		return err
	}
	return printJSON(v)
}

func init() {
	cmdAnalytics.PersistentFlags().StringVar(&analyticsStart, "start", "", "start date YYYY-MM-DD (default: server window)")
	cmdAnalytics.PersistentFlags().StringVar(&analyticsEnd, "end", "", "end date YYYY-MM-DD (default: today UTC)")
	cmdAnalytics.PersistentFlags().BoolVar(&analyticsForce, "force", false, "bypass cache / refresh providers")
	cmdAnalytics.PersistentFlags().BoolVar(&analyticsJSON, "json", false, "print JSON instead of table")
	cmdAnalytics.AddCommand(cmdAnalyticsSummary, cmdAnalyticsInsights, cmdAnalyticsApp)
}
