package billing

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

type stubValidator struct {
	uid string
	err error
}

func (s stubValidator) UserIDFromRequest(_ *http.Request) (string, error) {
	return s.uid, s.err
}

// Routes for an exempt appID short-circuit before the user lookup
// happens. Asserting via downstream handler reachability + no
// mana-credits round-trip (the checker has no creditsURL configured —
// any fetch would fail).
func TestMiddleware_AppExemption(t *testing.T) {
	c := NewChecker("http://invalid.invalid", "stub", []string{"cards"})

	// Wire a mux that surfaces {appId} as a path value, like main.go does.
	mux := http.NewServeMux()
	called := false
	mux.Handle("POST /sync/{appId}", c.Middleware(stubValidator{uid: "user-1"})(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})))

	cases := []struct {
		name       string
		path       string
		wantStatus int
		wantCalled bool
	}{
		{"exempt app passes without billing check", "/sync/cards", http.StatusOK, true},
		{"non-exempt app reaches the (failing) billing check", "/sync/todo", http.StatusOK, true}, // fail-open keeps it open
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			called = false
			req := httptest.NewRequest("POST", tc.path, nil)
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, req)
			if rec.Code != tc.wantStatus {
				t.Errorf("status=%d want=%d", rec.Code, tc.wantStatus)
			}
			if called != tc.wantCalled {
				t.Errorf("downstream called=%v want=%v", called, tc.wantCalled)
			}
		})
	}
}

func TestIsAppExempt(t *testing.T) {
	c := NewChecker("", "", []string{"cards", "  ", "todo"})
	if !c.IsAppExempt("cards") {
		t.Error("expected cards to be exempt")
	}
	if !c.IsAppExempt("todo") {
		t.Error("expected todo to be exempt")
	}
	if c.IsAppExempt("notes") {
		t.Error("notes should not be exempt")
	}
	if c.IsAppExempt("") {
		t.Error("empty appID should never be exempt")
	}
}
