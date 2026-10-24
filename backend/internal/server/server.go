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
	"net/http"
)

const Version = "0.1.0"

// New builds the server's handler. token is the per-launch bearer token every
// request must present (see auth.go).
func New(token string) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/v1/health", requireToken(token, handleHealth))

	return mux
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
