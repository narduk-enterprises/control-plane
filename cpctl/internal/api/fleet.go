package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
)

type FleetApp struct {
	Name            string `json:"name"`
	URL             string `json:"url"`
	DopplerProject  string `json:"dopplerProject"`
	NuxtPort        *int   `json:"nuxtPort,omitempty"`
	GaPropertyID    string `json:"gaPropertyId,omitempty"`
	GaMeasurementID string `json:"gaMeasurementId,omitempty"`
	PosthogAppName  string `json:"posthogAppName,omitempty"`
	GithubRepo      string `json:"githubRepo,omitempty"`
	AppDescription  string `json:"appDescription,omitempty"`
	IsActive        bool   `json:"isActive"`
	CreatedAt       string `json:"createdAt"`
	UpdatedAt       string `json:"updatedAt"`
}

func (c *Client) ListApps(includeInactive, force bool) ([]FleetApp, error) {
	path := "/api/fleet/apps"
	q := url.Values{}
	if includeInactive {
		q.Set("includeInactive", "true")
	}
	if force {
		q.Set("force", "true")
	}
	if enc := q.Encode(); enc != "" {
		path += "?" + enc
	}
	resp, err := c.do(http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	return ReadJSONArray[FleetApp](resp)
}

type CreateAppBody struct {
	Name            string `json:"name"`
	URL             string `json:"url"`
	DopplerProject  string `json:"dopplerProject,omitempty"`
	NuxtPort        *int   `json:"nuxtPort,omitempty"`
	GaPropertyID    string `json:"gaPropertyId,omitempty"`
	GaMeasurementID string `json:"gaMeasurementId,omitempty"`
	PosthogAppName  string `json:"posthogAppName,omitempty"`
	GithubRepo      string `json:"githubRepo,omitempty"`
}

type CreateAppResponse struct {
	OK       bool `json:"ok"`
	App      string `json:"app"`
	NuxtPort int  `json:"nuxtPort"`
}

func (c *Client) CreateApp(body CreateAppBody) (CreateAppResponse, error) {
	resp, err := c.do(http.MethodPost, "/api/fleet/apps", body)
	if err != nil {
		return CreateAppResponse{}, err
	}
	return ReadJSON[CreateAppResponse](resp)
}

type UpdateAppBody struct {
	URL             *string `json:"url,omitempty"`
	DopplerProject  *string `json:"dopplerProject,omitempty"`
	NuxtPort        *int    `json:"nuxtPort,omitempty"`
	GaPropertyID    *string `json:"gaPropertyId,omitempty"`
	GaMeasurementID *string `json:"gaMeasurementId,omitempty"`
	PosthogAppName  *string `json:"posthogAppName,omitempty"`
	GithubRepo      *string `json:"githubRepo,omitempty"`
	IsActive        *bool   `json:"isActive,omitempty"`
}

type MutationOK struct {
	OK     bool   `json:"ok"`
	App    string `json:"app"`
	Action string `json:"action,omitempty"`
}

func (c *Client) UpdateApp(name string, body UpdateAppBody) (MutationOK, error) {
	path := "/api/fleet/apps/" + url.PathEscape(name)
	resp, err := c.do(http.MethodPut, path, body)
	if err != nil {
		return MutationOK{}, err
	}
	return ReadJSON[MutationOK](resp)
}

func (c *Client) DeleteApp(name string, hard bool) (MutationOK, error) {
	path := "/api/fleet/apps/" + url.PathEscape(name)
	if hard {
		path += "?hard=true"
	}
	resp, err := c.do(http.MethodDelete, path, nil)
	if err != nil {
		return MutationOK{}, err
	}
	return ReadJSON[MutationOK](resp)
}

// StatusRow matches GET /api/fleet/status (array of app_status rows).
type StatusRow struct {
	App       string `json:"app"`
	URL       string `json:"url"`
	Status    string `json:"status"`
	StatusCode int   `json:"statusCode"`
	CheckedAt string `json:"checkedAt"`
}

func (c *Client) FleetStatus(force bool) ([]StatusRow, error) {
	path := "/api/fleet/status"
	if force {
		path += "?force=true"
	}
	resp, err := c.do(http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	return ReadJSONArray[StatusRow](resp)
}

type RefreshFleetResponse struct {
	OK       bool        `json:"ok"`
	Checked  int         `json:"checked"`
	Statuses []StatusRow `json:"statuses"`
}

func (c *Client) RefreshFleetStatus() (RefreshFleetResponse, error) {
	resp, err := c.do(http.MethodPost, "/api/fleet/status/refresh", map[string]any{})
	if err != nil {
		return RefreshFleetResponse{}, err
	}
	return ReadJSON[RefreshFleetResponse](resp)
}

type RefreshAppResponse struct {
	OK     bool      `json:"ok"`
	Status StatusRow `json:"status"`
}

func (c *Client) RefreshAppStatus(app string) (RefreshAppResponse, error) {
	path := "/api/fleet/status/" + url.PathEscape(app) + "/refresh"
	resp, err := c.do(http.MethodPost, path, map[string]any{})
	if err != nil {
		return RefreshAppResponse{}, err
	}
	return ReadJSON[RefreshAppResponse](resp)
}

type AuditResponse struct {
	Results []json.RawMessage `json:"results"`
	Reconcile json.RawMessage `json:"reconcile"`
}

func (c *Client) Audit(persist bool) (AuditResponse, error) {
	resp, err := c.do(http.MethodPost, "/api/fleet/audit", map[string]any{"persist": persist})
	if err != nil {
		return AuditResponse{}, err
	}
	return ReadJSON[AuditResponse](resp)
}

type RetryProvisionResponse struct {
	Success bool `json:"success"`
}

func (c *Client) RetryProvision(id string) (RetryProvisionResponse, error) {
	path := fmt.Sprintf("/api/fleet/provision/%s/retry", url.PathEscape(id))
	resp, err := c.do(http.MethodPost, path, map[string]any{})
	if err != nil {
		return RetryProvisionResponse{}, err
	}
	return ReadJSON[RetryProvisionResponse](resp)
}
