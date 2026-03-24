package cli

import (
	"strings"
	"testing"
)

func TestFormatAnalyticsSummaryBytes_minimal(t *testing.T) {
	raw := []byte(`{"startDate":"2026-01-01","endDate":"2026-01-08","generatedAt":"2026-01-08T12:00:00Z","totals":{"gaUsers":10,"gaPageviews":100,"gscClicks":5,"gscImpressions":200,"posthogEvents":50,"posthogUsers":8,"healthyProviders":{"ga":2,"gsc":2,"posthog":2,"indexnow":1}},"insights":[],"apps":{"demo":{"app":{"name":"demo","url":"https://demo.example"},"range":{"startDate":"2026-01-01","endDate":"2026-01-08"},"generatedAt":"x","health":{"status":"up"},"ga":{"status":"healthy","metrics":{"summary":{"activeUsers":3,"screenPageViews":30}}},"gsc":{"status":"healthy","metrics":{"totals":{"clicks":2,"impressions":40}}},"posthog":{"status":"healthy","metrics":{"summary":{"$pageview":9}}},"indexnow":{"status":"no_data","metrics":null}}}}`)
	lines, err := FormatAnalyticsSummaryBytes(raw)
	if err != nil {
		t.Fatal(err)
	}
	out := strings.Join(lines, "\n")
	for _, w := range []string{"Fleet analytics summary", "demo", "2026-01-01", "GA users: 10", "demo", "up", "healthy"} {
		if !strings.Contains(out, w) {
			t.Errorf("missing %q in:\n%s", w, out)
		}
	}
}

func TestFormatAnalyticsInsightsBytes_empty(t *testing.T) {
	raw := []byte(`{"startDate":"a","endDate":"b","generatedAt":"c","insights":[]}`)
	lines, err := FormatAnalyticsInsightsBytes(raw)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(strings.Join(lines, "\n"), "no insights") {
		t.Fatalf("expected no insights: %v", lines)
	}
}
