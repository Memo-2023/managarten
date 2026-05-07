package config

import (
	"os"
	"strconv"
	"strings"
)

// Config holds all configuration for the sync server.
type Config struct {
	Port              int
	DatabaseURL       string
	JWKSUrl           string // mana-auth JWKS endpoint for JWT validation
	ManaAuthURL       string // mana-auth base URL for internal APIs (Space memberships)
	CORSOrigins       string
	ManaCreditsURL    string // mana-credits service URL for billing checks
	ServiceKey        string // Service-to-service auth key
	BillingExemptApps []string // appIDs that bypass the sync-subscription billing gate
}

// Load reads configuration from environment variables with sensible defaults.
func Load() *Config {
	port, _ := strconv.Atoi(getEnv("PORT", "3050"))

	return &Config{
		Port:              port,
		DatabaseURL:       getEnv("DATABASE_URL", "postgresql://mana:devpassword@localhost:5432/mana_sync"),
		JWKSUrl:           getEnv("JWKS_URL", "http://localhost:3001/api/auth/jwks"),
		ManaAuthURL:       getEnv("MANA_AUTH_URL", "http://localhost:3001"),
		CORSOrigins:       getEnv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5188"),
		ManaCreditsURL:    getEnv("MANA_CREDITS_URL", "http://localhost:3061"),
		ServiceKey:        getEnv("MANA_SERVICE_KEY", "dev-service-key"),
		BillingExemptApps: splitCSV(getEnv("BILLING_EXEMPT_APPS", "")),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// splitCSV splits a comma-separated string into a trimmed, non-empty slice.
func splitCSV(raw string) []string {
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		t := strings.TrimSpace(p)
		if t != "" {
			out = append(out, t)
		}
	}
	return out
}
