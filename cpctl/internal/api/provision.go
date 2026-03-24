package api

import (
	"fmt"
	"net/http"
	"net/url"
)

type ProvisionStartBody struct {
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
	URL         string `json:"url"`
	Description string `json:"description,omitempty"`
	GithubOrg   string `json:"githubOrg,omitempty"`
}

type ProvisionStartResponse struct {
	OK             bool   `json:"ok"`
	ProvisionID    string `json:"provisionId"`
	App            string `json:"app"`
	GithubRepo     string `json:"githubRepo"`
	Status         string `json:"status"`
	Message        string `json:"message"`
	Infrastructure *struct {
		NuxtPort int `json:"nuxtPort"`
	} `json:"infrastructure,omitempty"`
}

func (c *Client) StartProvision(body ProvisionStartBody) (ProvisionStartResponse, error) {
	resp, err := c.do(http.MethodPost, "/api/fleet/provision", body)
	if err != nil {
		return ProvisionStartResponse{}, err
	}
	return ReadJSON[ProvisionStartResponse](resp)
}

// ProvisionPoll is GET /api/fleet/provision/:id (provision API key only).
type ProvisionPoll struct {
	ID           string `json:"id"`
	AppName      string `json:"appName"`
	DisplayName  string `json:"displayName"`
	AppURL       string `json:"appUrl"`
	GithubRepo   string `json:"githubRepo"`
	NuxtPort     *int   `json:"nuxtPort,omitempty"`
	Status       string `json:"status"`
	DeployedURL  string `json:"deployedUrl,omitempty"`
	GaPropertyID string `json:"gaPropertyId,omitempty"`
	ErrorMessage string `json:"errorMessage,omitempty"`
	CreatedAt    string `json:"createdAt"`
	UpdatedAt    string `json:"updatedAt"`
}

func (c *Client) GetProvision(id string) (ProvisionPoll, error) {
	path := fmt.Sprintf("/api/fleet/provision/%s", url.PathEscape(id))
	resp, err := c.do(http.MethodGet, path, nil)
	if err != nil {
		return ProvisionPoll{}, err
	}
	return ReadJSON[ProvisionPoll](resp)
}

type ProvisionJob struct {
	ID                 string         `json:"id"`
	AppName            string         `json:"appName"`
	DisplayName        string         `json:"displayName"`
	AppURL             string         `json:"appUrl"`
	GithubRepo         string         `json:"githubRepo"`
	NuxtPort           *int           `json:"nuxtPort,omitempty"`
	Status             string         `json:"status"`
	DeployedURL        string         `json:"deployedUrl,omitempty"`
	GaPropertyID       string         `json:"gaPropertyId,omitempty"`
	DispatchInputsJSON string         `json:"dispatchInputsJson,omitempty"`
	ErrorMessage       string         `json:"errorMessage,omitempty"`
	CreatedAt          string         `json:"createdAt"`
	UpdatedAt          string         `json:"updatedAt"`
	Logs               []ProvisionLog `json:"logs"`
}

type ProvisionLog struct {
	ID          string `json:"id"`
	ProvisionID string `json:"provisionId"`
	Level       string `json:"level"`
	Message     string `json:"message"`
	Step        string `json:"step,omitempty"`
	CreatedAt   string `json:"createdAt"`
}

type JobsResponse struct {
	Jobs []ProvisionJob `json:"jobs"`
}

func (c *Client) ListProvisionJobs() ([]ProvisionJob, error) {
	resp, err := c.do(http.MethodGet, "/api/fleet/provision-ui/jobs", nil)
	if err != nil {
		return nil, err
	}
	out, err := ReadJSON[JobsResponse](resp)
	if err != nil {
		return nil, err
	}
	return out.Jobs, nil
}
