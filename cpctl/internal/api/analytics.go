package api

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

// GetBytes performs GET path (may include query) and returns the body on 2xx.
func (c *Client) GetBytes(path string) ([]byte, error) {
	resp, err := c.do(http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}
	return b, nil
}

func analyticsQueryValues(startDate, endDate string, force bool) string {
	q := url.Values{}
	if strings.TrimSpace(startDate) != "" {
		q.Set("startDate", strings.TrimSpace(startDate))
	}
	if strings.TrimSpace(endDate) != "" {
		q.Set("endDate", strings.TrimSpace(endDate))
	}
	if force {
		q.Set("force", "true")
	}
	if enc := q.Encode(); enc != "" {
		return "?" + enc
	}
	return ""
}

// FleetAnalyticsSummary fetches GET /api/fleet/analytics/summary
func (c *Client) FleetAnalyticsSummary(startDate, endDate string, force bool) ([]byte, error) {
	path := "/api/fleet/analytics/summary" + analyticsQueryValues(startDate, endDate, force)
	return c.GetBytes(path)
}

// FleetAnalyticsInsights fetches GET /api/fleet/analytics/insights
func (c *Client) FleetAnalyticsInsights(startDate, endDate string, force bool) ([]byte, error) {
	path := "/api/fleet/analytics/insights" + analyticsQueryValues(startDate, endDate, force)
	return c.GetBytes(path)
}

// FleetAnalyticsApp fetches GET /api/fleet/analytics/{app}
func (c *Client) FleetAnalyticsApp(app, startDate, endDate string, force bool) ([]byte, error) {
	path := "/api/fleet/analytics/" + url.PathEscape(app) + analyticsQueryValues(startDate, endDate, force)
	return c.GetBytes(path)
}
