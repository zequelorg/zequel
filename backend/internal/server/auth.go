package server

import (
	"crypto/subtle"
	"net/http"
	"strings"
)

// requireHost wraps a handler so it only runs if the request's Host header is
// exactly the loopback address this server is bound to. This is defense in
// depth against DNS rebinding: a malicious webpage's domain can be made to
// resolve to 127.0.0.1 after the page loads, and a browser fetch to that
// domain still terminates on this server, but the Host header in that
// request reflects the URL the page used (e.g. "evil.example:51234"), not
// 127.0.0.1 — so rejecting anything but the exact expected Host catches it.
//
// In practice the bearer token already fully defeats this attack too (the
// rebound page's JS still doesn't know the token), so this is belt-and-
// suspenders, not the primary defense — but it's cheap and worth having.
func requireHost(expectedHost string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Host != expectedHost {
			http.Error(w, "unexpected host", http.StatusForbidden)
			return
		}
		next(w, r)
	}
}

// requireToken wraps a handler so it only runs if the request carries the
// exact bearer token this process was started with. The token is generated
// fresh by Electron on every launch and passed to this process on stdin (see
// cmd/zequeld/main.go's readToken, and the comment at the top of that file
// for why stdin rather than an environment variable) — nothing else on the
// machine knows it, so this is what stops another local process from
// talking to this server even though it's reachable on loopback.
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
