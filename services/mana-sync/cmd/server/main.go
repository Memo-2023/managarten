package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/mana/mana-sync/internal/auth"
	"github.com/mana/mana-sync/internal/billing"
	"github.com/mana/mana-sync/internal/config"
	"github.com/mana/mana-sync/internal/memberships"
	"github.com/mana/mana-sync/internal/store"
	syncHandler "github.com/mana/mana-sync/internal/sync"
	"github.com/mana/mana-sync/internal/ws"
	"github.com/rs/cors"
)

func main() {
	// Structured logging
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})))

	cfg := config.Load()
	ctx := context.Background()

	// Connect to PostgreSQL
	db, err := store.New(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	// Run migrations
	if err := db.Migrate(ctx); err != nil {
		slog.Error("failed to run migrations", "error", err)
		os.Exit(1)
	}

	// Initialize JWT validator
	validator := auth.NewValidator(cfg.JWKSUrl)

	// Initialize WebSocket hub (with JWT validator for auth)
	hub := ws.NewHub(validator)

	// Initialize billing checker (verifies sync subscription via mana-credits)
	// Exempt apps bypass the gate entirely — used for products that promise
	// free Sync (e.g. Cards).
	billingChecker := billing.NewChecker(cfg.ManaCreditsURL, cfg.ServiceKey, cfg.BillingExemptApps)
	billingMiddleware := billingChecker.Middleware(validator)

	// Initialize Space-membership lookup against mana-auth. The handler
	// passes the caller's membership list into every sync query so the
	// multi-member RLS policy lets co-members of a shared Space see each
	// other's records.
	membershipLookup := memberships.New(cfg.ManaAuthURL, cfg.ServiceKey)

	// Initialize sync handler
	handler := syncHandler.NewHandler(db, validator, hub, membershipLookup)

	// Set up routes
	mux := http.NewServeMux()

	// Sync endpoints (Go 1.22+ routing patterns) — gated by billing check
	mux.Handle("POST /sync/{appId}", billingMiddleware(http.HandlerFunc(handler.HandleSync)))
	mux.Handle("GET /sync/{appId}/pull", billingMiddleware(http.HandlerFunc(handler.HandlePull)))
	mux.Handle("GET /sync/{appId}/stream", billingMiddleware(http.HandlerFunc(handler.HandleStream)))

	// Backup/export — removed 2026-04-22 (data-export-v2 rollout).
	// Data export is now fully client-driven (apps/mana/apps/web/src/lib/
	// data/backup/v2/): client reads local Dexie, decrypts per-field,
	// optionally passphrase-seals, downloads. Server would need the user's
	// vault key to produce plaintext exports — which is a key it
	// deliberately never sees.

	// WebSocket endpoints
	// Unified: one connection per user, receives all app notifications with appId in payload
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		hub.HandleWebSocket(w, r, "") // empty appID = unified mode
	})
	// Legacy: one connection per app (backward-compatible)
	mux.HandleFunc("/ws/{appId}", func(w http.ResponseWriter, r *http.Request) {
		appID := r.PathValue("appId")
		hub.HandleWebSocket(w, r, appID)
	})

	// Health check
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"status":      "ok",
			"service":     "mana-sync",
			"timestamp":   time.Now().UTC().Format(time.RFC3339),
			"connections": hub.TotalConnections(),
			"users":       hub.ConnectedUsers(),
		})
	})

	// Metrics (Prometheus-compatible)
	mux.HandleFunc("GET /metrics", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		fmt.Fprintf(w, "# HELP mana_sync_connections_total Total WebSocket connections\n")
		fmt.Fprintf(w, "# TYPE mana_sync_connections_total gauge\n")
		fmt.Fprintf(w, "mana_sync_connections_total %d\n", hub.TotalConnections())
		fmt.Fprintf(w, "# HELP mana_sync_users_connected Connected unique users\n")
		fmt.Fprintf(w, "# TYPE mana_sync_users_connected gauge\n")
		fmt.Fprintf(w, "mana_sync_users_connected %d\n", hub.ConnectedUsers())
	})

	// CORS
	origins := strings.Split(cfg.CORSOrigins, ",")
	c := cors.New(cors.Options{
		AllowedOrigins:   origins,
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type", "X-Client-Id"},
		AllowCredentials: true,
	})

	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      c.Handler(mux),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 0, // Disabled for SSE streaming (long-lived connections)
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh

		slog.Info("shutting down...")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		server.Shutdown(ctx)
	}()

	slog.Info("mana-sync starting", "port", cfg.Port, "jwks", cfg.JWKSUrl)
	if err := server.ListenAndServe(); err != http.ErrServerClosed {
		slog.Error("server error", "error", err)
		os.Exit(1)
	}
}
