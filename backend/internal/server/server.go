// Package server implements the local HTTP API that the Electron main
// process talks to. See /backend/api/API.md for the full contract, versioning
// convention, and the streaming pattern planned for AI endpoints.
//
// This process is never reachable by the Electron renderer directly — only
// Electron's main process calls it, and only main.ts holds the bearer token
// (see docs/SECURITY.md in the repo root for why that boundary matters).
package server

import (
	"encoding/json"
	"fmt"
	"net/http"

	"zequel.dev/backend/internal/index"
)

const Version = "0.2.0"

// New builds the server's handler.
//   - token is the per-launch bearer token every request must present (see
//     requireToken in auth.go).
//   - port is the port this server is bound to on 127.0.0.1 (the caller gets
//     this from the listener it already created — see cmd/zequeld/main.go).
//     It's used only to build the exact Host header value requests must match
//     (see requireHost in auth.go); it does not change what this server binds
//     to.
//
// Routes are registered on a plain mux with NO per-route auth — auth and the
// host check are applied exactly once, here, wrapping the entire mux. This is
// deliberate: per-route wrapping (the original version of this function)
// means every future route addition has to remember to wrap itself, and
// forgetting is a silent, serious bug (an unauthenticated route on a server
// that's supposed to require a token on everything). Wrapping the whole mux
// once makes that class of bug structurally impossible — a new route added to
// routes() is protected automatically, with no action required.
func New(token string, port int) http.Handler {
	mux := http.NewServeMux()
	routes(mux, newResearchState(index.DefaultRegistry()))
	expectedHost := fmt.Sprintf("127.0.0.1:%d", port)
	return requireHost(expectedHost, requireToken(token, mux.ServeHTTP))
}

// routes registers every endpoint. Add new routes here, unauthenticated —
// New() applies auth once, above, to everything this function registers.
func routes(mux *http.ServeMux, rs *researchState) {
	mux.HandleFunc("/v1/health", handleHealth)
	rs.register(mux)
}

type healthResponse struct {
	Status  string `json:"status"`
	Version string `json:"version"`
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(healthResponse{Status: "ok", Version: Version})
}
