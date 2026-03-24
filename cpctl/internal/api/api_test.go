package api

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/narduk-enterprises/control-plane/cpctl/internal/config"
)

func TestReadJSON_errorStatus(t *testing.T) {
	resp := &http.Response{
		StatusCode: http.StatusUnauthorized,
		Body:       io.NopCloser(strings.NewReader(`{"message":"nope"}`)),
	}
	_, err := ReadJSON[map[string]any](resp)
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "401") {
		t.Fatalf("error: %v", err)
	}
}

func TestReadJSONArray_emptyBody(t *testing.T) {
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader("   ")),
	}
	out, err := ReadJSONArray[FleetApp](resp)
	if err != nil {
		t.Fatal(err)
	}
	if out != nil && len(out) != 0 {
		t.Fatalf("got %#v", out)
	}
}

func TestListApps_happyPath(t *testing.T) {
	payload := []FleetApp{
		{Name: "demo", URL: "https://demo.example", DopplerProject: "demo", IsActive: true},
	}
	raw, _ := json.Marshal(payload)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/fleet/apps" {
			t.Errorf("path %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer nk_test" {
			t.Errorf("Authorization %q", r.Header.Get("Authorization"))
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(raw)
	}))
	defer srv.Close()

	cfg := config.Config{BaseURL: srv.URL, AdminAPIKey: "nk_test"}
	c := NewAdmin(cfg)
	c.SetHTTPClient(srv.Client())

	apps, err := c.ListApps(false, false)
	if err != nil {
		t.Fatal(err)
	}
	if len(apps) != 1 || apps[0].Name != "demo" {
		t.Fatalf("got %#v", apps)
	}
}

func TestListApps_queryFlags(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if q.Get("includeInactive") != "true" || q.Get("force") != "true" {
			t.Errorf("query = %v", q)
		}
		_, _ = w.Write([]byte(`[]`))
	}))
	defer srv.Close()

	cfg := config.Config{BaseURL: srv.URL, AdminAPIKey: "nk_x"}
	c := NewAdmin(cfg)
	c.SetHTTPClient(srv.Client())

	_, err := c.ListApps(true, true)
	if err != nil {
		t.Fatal(err)
	}
}

func TestAdminPOST_csrfWhenNotNkPrefix(t *testing.T) {
	var xrw string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		xrw = r.Header.Get("X-Requested-With")
		_, _ = w.Write([]byte(`{"ok":true,"checked":0,"statuses":[]}`))
	}))
	defer srv.Close()

	cfg := config.Config{BaseURL: srv.URL, AdminAPIKey: "plain-secret"}
	c := NewAdmin(cfg)
	c.SetHTTPClient(srv.Client())

	_, err := c.RefreshFleetStatus()
	if err != nil {
		t.Fatal(err)
	}
	if xrw != "XMLHttpRequest" {
		t.Fatalf("X-Requested-With = %q", xrw)
	}
}

func TestAdminPOST_noCsrfForNkPrefix(t *testing.T) {
	var xrw string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		xrw = r.Header.Get("X-Requested-With")
		_, _ = w.Write([]byte(`{"ok":true,"checked":0,"statuses":[]}`))
	}))
	defer srv.Close()

	cfg := config.Config{BaseURL: srv.URL, AdminAPIKey: "nk_test"}
	c := NewAdmin(cfg)
	c.SetHTTPClient(srv.Client())

	_, err := c.RefreshFleetStatus()
	if err != nil {
		t.Fatal(err)
	}
	if xrw != "" {
		t.Fatalf("expected no X-Requested-With, got %q", xrw)
	}
}

func TestAuthHeader_errors(t *testing.T) {
	_, err := NewAdmin(config.Config{BaseURL: "http://x"}).authHeader()
	if err == nil {
		t.Fatal("expected error for missing admin key")
	}
	_, err = NewProvision(config.Config{BaseURL: "http://x"}).authHeader()
	if err == nil {
		t.Fatal("expected error for missing provision key")
	}
}

func TestFleetStatus_array(t *testing.T) {
	body := `[{"app":"a","url":"https://a","status":"up","statusCode":200,"checkedAt":"t"}]`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/fleet/status" {
			t.Errorf("path %s", r.URL.Path)
		}
		_, _ = w.Write([]byte(body))
	}))
	defer srv.Close()

	cfg := config.Config{BaseURL: srv.URL, AdminAPIKey: "nk_x"}
	c := NewAdmin(cfg)
	c.SetHTTPClient(srv.Client())

	rows, err := c.FleetStatus(false)
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 1 || rows[0].App != "a" {
		t.Fatalf("got %#v", rows)
	}
}

func TestGetProvision_flatJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/fleet/provision/job-1" {
			t.Errorf("path %s", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"id":"job-1","appName":"x","displayName":"X","appUrl":"https://x","githubRepo":"o/x","status":"pending","createdAt":"t1","updatedAt":"t2"}`))
	}))
	defer srv.Close()

	cfg := config.Config{BaseURL: srv.URL, ProvisionAPIKey: "prov"}
	c := NewProvision(cfg)
	c.SetHTTPClient(srv.Client())

	p, err := c.GetProvision("job-1")
	if err != nil {
		t.Fatal(err)
	}
	if p.ID != "job-1" || p.Status != "pending" {
		t.Fatalf("got %#v", p)
	}
}

func TestJobsResponse(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"jobs":[{"id":"j1","appName":"a","displayName":"A","appUrl":"https://a","githubRepo":"o/a","status":"complete","createdAt":"t","updatedAt":"t","logs":[]}]}`))
	}))
	defer srv.Close()

	cfg := config.Config{BaseURL: srv.URL, AdminAPIKey: "nk_x"}
	c := NewAdmin(cfg)
	c.SetHTTPClient(srv.Client())

	jobs, err := c.ListProvisionJobs()
	if err != nil {
		t.Fatal(err)
	}
	if len(jobs) != 1 || jobs[0].ID != "j1" {
		t.Fatalf("got %#v", jobs)
	}
}
