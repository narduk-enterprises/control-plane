package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/narduk-enterprises/control-plane/cpctl/internal/config"
)

type Client struct {
	http    *http.Client
	cfg     config.Config
	admin   bool
}

func NewAdmin(cfg config.Config) *Client {
	return &Client{
		http:  &http.Client{Timeout: 120 * time.Second},
		cfg:   cfg,
		admin: true,
	}
}

func NewProvision(cfg config.Config) *Client {
	return &Client{
		http:  &http.Client{Timeout: 120 * time.Second},
		cfg:   cfg,
		admin: false,
	}
}

// SetHTTPClient replaces the underlying client (e.g. httptest.Server.Client() in tests).
func (c *Client) SetHTTPClient(hc *http.Client) {
	if hc != nil {
		c.http = hc
	}
}

func (c *Client) authHeader() (string, error) {
	if c.admin {
		if c.cfg.AdminAPIKey == "" {
			return "", fmt.Errorf("set CONTROL_PLANE_API_KEY (admin nk_… key)")
		}
		return "Bearer " + c.cfg.AdminAPIKey, nil
	}
	if c.cfg.ProvisionAPIKey == "" {
		return "", fmt.Errorf("set PROVISION_API_KEY")
	}
	return "Bearer " + c.cfg.ProvisionAPIKey, nil
}

func (c *Client) skipCSRF() bool {
	return c.admin && strings.HasPrefix(c.cfg.AdminAPIKey, "nk_")
}

func (c *Client) do(method, path string, body any) (*http.Response, error) {
	auth, err := c.authHeader()
	if err != nil {
		return nil, err
	}
	full, err := c.cfg.ResolveAPIPath(path)
	if err != nil {
		return nil, err
	}
	var rdr io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		rdr = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, full, rdr)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("Authorization", auth)
	if !c.skipCSRF() && method != http.MethodGet && method != http.MethodHead {
		req.Header.Set("X-Requested-With", "XMLHttpRequest")
	}
	return c.http.Do(req)
}

func ReadJSON[T any](resp *http.Response) (T, error) {
	var out T
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return out, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return out, fmt.Errorf("HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}
	if len(bytes.TrimSpace(b)) == 0 {
		return out, nil
	}
	if err := json.Unmarshal(b, &out); err != nil {
		return out, fmt.Errorf("decode json: %w (body: %s)", err, truncate(b, 500))
	}
	return out, nil
}

func ReadJSONArray[T any](resp *http.Response) ([]T, error) {
	var out []T
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}
	if len(bytes.TrimSpace(b)) == 0 {
		return out, nil
	}
	if err := json.Unmarshal(b, &out); err != nil {
		return nil, fmt.Errorf("decode json array: %w (body: %s)", err, truncate(b, 500))
	}
	return out, nil
}

func truncate(b []byte, n int) string {
	s := string(b)
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
