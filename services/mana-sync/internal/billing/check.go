// Package billing provides sync billing status checks against mana-credits.
package billing

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"
)

// SyncStatus represents the billing status for a user's sync subscription.
type SyncStatus struct {
	Active    bool    `json:"active"`
	Interval  string  `json:"interval"`
	PausedAt  *string `json:"pausedAt"`
}

type cachedStatus struct {
	status    SyncStatus
	fetchedAt time.Time
}

// Checker verifies sync billing status via the mana-credits service.
// Results are cached per user for cacheTTL to avoid hitting mana-credits on every request.
//
// `exemptApps` is a set of appIDs that bypass the billing check entirely
// — used for products that promise free Sync (e.g. Cards). The check is
// done by URL path so it sits naturally above the per-user cache: an
// exempt request short-circuits before any user lookup.
type Checker struct {
	creditsURL string
	serviceKey string
	cacheTTL   time.Duration
	client     *http.Client
	exemptApps map[string]struct{}

	mu    sync.RWMutex
	cache map[string]cachedStatus
}

// NewChecker creates a billing checker.
func NewChecker(creditsURL, serviceKey string, exemptApps []string) *Checker {
	exempt := make(map[string]struct{}, len(exemptApps))
	for _, app := range exemptApps {
		if app != "" {
			exempt[app] = struct{}{}
		}
	}
	return &Checker{
		creditsURL: creditsURL,
		serviceKey: serviceKey,
		cacheTTL:   5 * time.Minute,
		client:     &http.Client{Timeout: 5 * time.Second},
		exemptApps: exempt,
		cache:      make(map[string]cachedStatus),
	}
}

// IsAppExempt returns true if the given appID is configured to bypass
// the billing check.
func (c *Checker) IsAppExempt(appID string) bool {
	if appID == "" {
		return false
	}
	_, ok := c.exemptApps[appID]
	return ok
}

// IsActive checks whether a user has an active sync subscription.
// Returns true if the billing check fails (fail-open to not block sync on service outage).
func (c *Checker) IsActive(userID string) bool {
	// Check cache first
	c.mu.RLock()
	entry, ok := c.cache[userID]
	c.mu.RUnlock()

	if ok && time.Since(entry.fetchedAt) < c.cacheTTL {
		return entry.status.Active
	}

	// Fetch from mana-credits
	status, err := c.fetchStatus(userID)
	if err != nil {
		slog.Warn("billing check failed, allowing sync (fail-open)", "userID", userID, "error", err)
		return true // Fail-open: don't block sync if billing service is down
	}

	// Update cache
	c.mu.Lock()
	c.cache[userID] = cachedStatus{status: status, fetchedAt: time.Now()}
	c.mu.Unlock()

	return status.Active
}

func (c *Checker) fetchStatus(userID string) (SyncStatus, error) {
	url := fmt.Sprintf("%s/api/v1/internal/sync/status/%s", c.creditsURL, userID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return SyncStatus{}, err
	}
	req.Header.Set("X-Service-Key", c.serviceKey)

	resp, err := c.client.Do(req)
	if err != nil {
		return SyncStatus{}, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return SyncStatus{}, fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	var status SyncStatus
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return SyncStatus{}, fmt.Errorf("decode failed: %w", err)
	}

	return status, nil
}

// Middleware returns an HTTP middleware that checks sync billing status.
// Returns 402 Payment Required if the user's sync subscription is not active.
//
// The middleware respects the `exemptApps` set: routes whose `{appId}`
// path-value is exempt skip both the user lookup and the credit check.
// Routes without an `{appId}` placeholder are treated as non-exempt
// (the original behaviour).
func (c *Checker) Middleware(validator interface{ UserIDFromRequest(*http.Request) (string, error) }) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if c.IsAppExempt(r.PathValue("appId")) {
				next.ServeHTTP(w, r)
				return
			}

			userID, err := validator.UserIDFromRequest(r)
			if err != nil {
				// Let the downstream handler deal with auth errors
				next.ServeHTTP(w, r)
				return
			}

			if !c.IsActive(userID) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusPaymentRequired)
				json.NewEncoder(w).Encode(map[string]string{
					"error":   "sync_inactive",
					"message": "Cloud Sync ist nicht aktiv. Aktiviere Sync in den Einstellungen.",
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
