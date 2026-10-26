package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

const testToken = "test-token-123"
const testPort = 9999
const testHost = "127.0.0.1:9999"

// newTestRequest builds a request with the Host header set to match what
// New(testToken, testPort) expects. httptest.NewRequest defaults Host to
// "example.com" for a path-only target, which would now be rejected by
// requireHost — every test below has to set this explicitly, which is itself
// effectively a second test that requireHost is wired in at all (the original
// four tests, written before requireHost existed, would fail-closed with 403
// instead of their expected status if this were forgotten).
func newTestRequest(method, target string) *http.Request {
	req := httptest.NewRequest(method, target, nil)
	req.Host = testHost
	return req
}

func TestHealth_WithValidToken_ReturnsOK(t *testing.T) {
	handler := New(testToken, testPort)

	req := newTestRequest(http.MethodGet, "/v1/health")
	req.Header.Set("Authorization", "Bearer "+testToken)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d (body: %s)", rec.Code, rec.Body.String())
	}

	var body healthResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	if body.Status != "ok" {
		t.Errorf("expected status %q, got %q", "ok", body.Status)
	}
	if body.Version != Version {
		t.Errorf("expected version %q, got %q", Version, body.Version)
	}
}

func TestHealth_WithMissingToken_ReturnsUnauthorized(t *testing.T) {
	handler := New(testToken, testPort)

	req := newTestRequest(http.MethodGet, "/v1/health")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", rec.Code)
	}
}

func TestHealth_WithWrongToken_ReturnsUnauthorized(t *testing.T) {
	handler := New(testToken, testPort)

	req := newTestRequest(http.MethodGet, "/v1/health")
	req.Header.Set("Authorization", "Bearer wrong-token")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", rec.Code)
	}
}

func TestHealth_WrongMethod_ReturnsMethodNotAllowed(t *testing.T) {
	handler := New(testToken, testPort)

	req := newTestRequest(http.MethodPost, "/v1/health")
	req.Header.Set("Authorization", "Bearer "+testToken)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected status 405, got %d", rec.Code)
	}
}

// --- New in this pass: Host-header validation (requireHost) ---

func TestRequest_WithWrongHost_ReturnsForbidden(t *testing.T) {
	handler := New(testToken, testPort)

	// Valid token, but a Host header that doesn't match this server's bound
	// address — simulates a DNS-rebinding attempt (see auth.go). Checked
	// first, before auth, matching the actual middleware order in New().
	req := newTestRequest(http.MethodGet, "/v1/health")
	req.Host = "evil.example:9999"
	req.Header.Set("Authorization", "Bearer "+testToken)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected status 403, got %d", rec.Code)
	}
}

// --- New in this pass: whole-mux auth wrapping (New's refactor) ---
//
// These two tests exist specifically to lock in the New() refactor: auth is
// applied once to the entire mux rather than per-route, so it should cover
// paths that aren't registered at all, not just known ones.

func TestUnknownPath_WithoutToken_ReturnsUnauthorized(t *testing.T) {
	handler := New(testToken, testPort)

	// No route is registered for this path. If auth were still applied
	// per-route (the pre-refactor pattern), an unregistered path would hit
	// the mux's own 404 handler directly, bypassing auth entirely — this
	// test fails loudly if that regresses.
	req := newTestRequest(http.MethodGet, "/v1/does-not-exist")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401 (auth must run before routing), got %d", rec.Code)
	}
}

func TestUnknownPath_WithValidToken_ReturnsNotFound(t *testing.T) {
	handler := New(testToken, testPort)

	req := newTestRequest(http.MethodGet, "/v1/does-not-exist")
	req.Header.Set("Authorization", "Bearer "+testToken)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", rec.Code)
	}
}
