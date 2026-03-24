package config

import (
	"net/url"
	"os"
	"strings"
)

const defaultBaseURL = "https://control-plane.nard.uk"

// Load reads CONTROL_PLANE_URL, PROVISION_API_KEY, and admin key from
// CONTROL_PLANE_API_KEY or FLEET_API_KEY (same as tools/set-fleet-doppler-urls.ts).
func Load() Config {
	base := strings.TrimSpace(os.Getenv("CONTROL_PLANE_URL"))
	if base == "" {
		base = defaultBaseURL
	}
	base = strings.TrimRight(base, "/")
	admin := strings.TrimSpace(os.Getenv("CONTROL_PLANE_API_KEY"))
	if admin == "" {
		admin = strings.TrimSpace(os.Getenv("FLEET_API_KEY"))
	}
	return Config{
		BaseURL:         base,
		ProvisionAPIKey: strings.TrimSpace(os.Getenv("PROVISION_API_KEY")),
		AdminAPIKey:     admin,
		GitHubToken:     strings.TrimSpace(firstNonEmpty(os.Getenv("GITHUB_TOKEN"), os.Getenv("GH_TOKEN"))),
	}
}

func firstNonEmpty(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

type Config struct {
	BaseURL           string
	ProvisionAPIKey   string
	AdminAPIKey       string
	GitHubToken       string
}

func (c Config) AdminBearer() string { return c.AdminAPIKey }

func (c Config) HasAdmin() bool { return c.AdminAPIKey != "" }

func (c Config) HasProvision() bool { return c.ProvisionAPIKey != "" }

func (c Config) ResolveAPIPath(path string) (string, error) {
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	pathOnly := path
	query := ""
	if i := strings.Index(path, "?"); i >= 0 {
		pathOnly = path[:i]
		query = path[i+1:]
	}
	u, err := url.Parse(c.BaseURL)
	if err != nil {
		return "", err
	}
	u.Path = strings.TrimSuffix(u.Path, "/") + pathOnly
	u.RawQuery = query
	return u.String(), nil
}
