package config

import (
	"testing"
)

func TestLoad_defaultsAndTrim(t *testing.T) {
	t.Setenv("CONTROL_PLANE_URL", "")
	t.Setenv("CONTROL_PLANE_API_KEY", "")
	t.Setenv("FLEET_API_KEY", "")
	t.Setenv("PROVISION_API_KEY", "")
	t.Setenv("GITHUB_TOKEN", "")
	t.Setenv("GH_TOKEN", "")

	c := Load()
	if c.BaseURL != defaultBaseURL {
		t.Fatalf("BaseURL = %q, want %q", c.BaseURL, defaultBaseURL)
	}
}

func TestLoad_customBaseURLTrimsSlash(t *testing.T) {
	t.Setenv("CONTROL_PLANE_URL", "https://example.com/")
	t.Setenv("CONTROL_PLANE_API_KEY", "nk_abc")

	c := Load()
	if c.BaseURL != "https://example.com" {
		t.Fatalf("BaseURL = %q", c.BaseURL)
	}
}

func TestLoad_fleetAPIKeyFallback(t *testing.T) {
	t.Setenv("CONTROL_PLANE_API_KEY", "")
	t.Setenv("FLEET_API_KEY", "nk_from_fleet")

	c := Load()
	if c.AdminAPIKey != "nk_from_fleet" {
		t.Fatalf("AdminAPIKey = %q", c.AdminAPIKey)
	}
}

func TestLoad_controlPlaneKeyWinsOverFleet(t *testing.T) {
	t.Setenv("CONTROL_PLANE_API_KEY", "nk_primary")
	t.Setenv("FLEET_API_KEY", "nk_other")

	c := Load()
	if c.AdminAPIKey != "nk_primary" {
		t.Fatalf("AdminAPIKey = %q", c.AdminAPIKey)
	}
}

func TestLoad_githubTokenFallback(t *testing.T) {
	t.Setenv("GITHUB_TOKEN", "")
	t.Setenv("GH_TOKEN", "gh_pat_x")

	c := Load()
	if c.GitHubToken != "gh_pat_x" {
		t.Fatalf("GitHubToken = %q", c.GitHubToken)
	}
}

func TestResolveAPIPath(t *testing.T) {
	c := Config{BaseURL: "https://cp.example"}
	u, err := c.ResolveAPIPath("/api/fleet/apps")
	if err != nil {
		t.Fatal(err)
	}
	if u != "https://cp.example/api/fleet/apps" {
		t.Fatalf("got %q", u)
	}

	u2, err := c.ResolveAPIPath("api/health")
	if err != nil {
		t.Fatal(err)
	}
	if u2 != "https://cp.example/api/health" {
		t.Fatalf("got %q", u2)
	}
}

func TestResolveAPIPath_preservesBasePath(t *testing.T) {
	c := Config{BaseURL: "https://cp.example/prefix"}
	u, err := c.ResolveAPIPath("/api/health")
	if err != nil {
		t.Fatal(err)
	}
	if u != "https://cp.example/prefix/api/health" {
		t.Fatalf("got %q", u)
	}
}

func TestResolveAPIPath_withQueryString(t *testing.T) {
	c := Config{BaseURL: "https://cp.example"}
	u, err := c.ResolveAPIPath("/api/fleet/apps?force=true&includeInactive=true")
	if err != nil {
		t.Fatal(err)
	}
	// Order of query params is preserved from input.
	if u != "https://cp.example/api/fleet/apps?force=true&includeInactive=true" {
		t.Fatalf("got %q", u)
	}
}
