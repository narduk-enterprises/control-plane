package cli

import (
	"encoding/json"

	"github.com/narduk-enterprises/control-plane/cpctl/internal/api"
	"github.com/spf13/cobra"
)

var auditPersist bool

var cmdAudit = &cobra.Command{
	Use:   "audit",
	Short: "Run fleet HTML / analytics audit (admin)",
	RunE: func(cmd *cobra.Command, args []string) error {
		c := api.NewAdmin(mergedConfig())
		out, err := c.Audit(auditPersist)
		if err != nil {
			return err
		}
		var results []any
		for _, raw := range out.Results {
			var v any
			_ = json.Unmarshal(raw, &v)
			results = append(results, v)
		}
		var reconcile any
		_ = json.Unmarshal(out.Reconcile, &reconcile)
		return printJSON(map[string]any{"results": results, "reconcile": reconcile})
	},
}

func init() {
	cmdAudit.Flags().BoolVar(&auditPersist, "persist", false, "write reconciled GA measurement IDs when Doppler agrees")
}
