package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func doJSON(t *testing.T, h http.Handler, method, target, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, target, strings.NewReader(body))
	req.Host = testHost
	req.Header.Set("Authorization", "Bearer "+testToken)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestResearch_RequiresProjectThenIndex(t *testing.T) {
	h := New(testToken, testPort)
	rec := doJSON(t, h, http.MethodGet, "/v1/research/symbols", "")
	if rec.Code != http.StatusConflict || !strings.Contains(rec.Body.String(), "no_project") {
		t.Fatalf("expected 409 no_project, got %d %s", rec.Code, rec.Body.String())
	}
}

func TestResearch_EndToEnd(t *testing.T) {
	dir := t.TempDir()
	src := `pragma solidity ^0.8.0;
contract A { function f() external { g(); } function g() internal {} }
contract B is A {}`
	if err := os.WriteFile(filepath.Join(dir, "foundry.toml"), nil, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "T.sol"), []byte(src), 0o644); err != nil {
		t.Fatal(err)
	}
	h := New(testToken, testPort)

	body, _ := json.Marshal(map[string]string{"root": dir})
	rec := doJSON(t, h, http.MethodPost, "/v1/project/open", string(body))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "foundry") {
		t.Fatalf("open: %d %s", rec.Code, rec.Body.String())
	}
	if rec := doJSON(t, h, http.MethodGet, "/v1/research/symbols", ""); rec.Code != http.StatusConflict {
		t.Fatalf("expected 409 before indexing, got %d", rec.Code)
	}
	rec = doJSON(t, h, http.MethodPost, "/v1/index/start", "")
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"state":"ready"`) {
		t.Fatalf("index: %d %s", rec.Code, rec.Body.String())
	}

	rec = doJSON(t, h, http.MethodGet, "/v1/research/symbols?q=A", "")
	var syms struct {
		Symbols []struct {
			ID string `json:"id"`
		} `json:"symbols"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &syms); err != nil || len(syms.Symbols) == 0 {
		t.Fatalf("symbols: %v %s", err, rec.Body.String())
	}

	rec = doJSON(t, h, http.MethodGet, "/v1/research/trace?root=T.sol::A&depth=1", "")
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"inflows"`) {
		t.Fatalf("trace: %d %s", rec.Code, rec.Body.String())
	}
	if rec := doJSON(t, h, http.MethodGet, "/v1/research/trace?root=missing", ""); rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestProjectOpen_RejectsBadRoot(t *testing.T) {
	h := New(testToken, testPort)
	rec := doJSON(t, h, http.MethodPost, "/v1/project/open", `{"root":"relative"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d %s", rec.Code, rec.Body.String())
	}
}

func TestResearchRoutes_AreBehindAuth(t *testing.T) {
	h := New(testToken, testPort)
	req := newTestRequest(http.MethodGet, "/v1/research/findings")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without token, got %d", rec.Code)
	}
}
