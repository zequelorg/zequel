package server

import (
	"crypto/subtle"
	"net/http"
	"strings"
)

// requireToken wraps a handler so it only runs if the request carries the
// exact bearer token this process was started with. The token is generated
// fresh by Electron on every launch and passed to this process via the
// ZEQUEL_BACKEND_TOKEN environment variable — nothing else on the machine
// knows it, so this is what stops another local process from talking to this
// server even though it's reachable on loopback.
//
// Comparison is constant-time (crypto/subtle) so response timing can't be
// used to guess the token one byte at a time.
func requireToken(token string, next http.HandlerFunc) http.HandlerFunc {
	expected := []byte(token)
	return func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		const prefix = "Bearer "
		if !strings.HasPrefix(auth, prefix) {
			http.Error(w, "missing bearer token", http.StatusUnauthorized)
			return
		}
		got := []byte(strings.TrimPrefix(auth, prefix))
		if len(got) != len(expected) || subtle.ConstantTimeCompare(got, expected) != 1 {
			http.Error(w, "invalid bearer token", http.StatusUnauthorized)
			return
		}
		next(w, r)
	}
}
