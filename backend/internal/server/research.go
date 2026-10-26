package server

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"sync"

	"zequel.dev/backend/internal/index"
	"zequel.dev/backend/internal/project"
)

// researchState is the server's view of the one open project and its latest
// index snapshot. The project root only ever arrives from Electron's main
// process (which got it from a native folder dialog); the renderer never
// supplies it. Index snapshots are immutable, so readers hold only a pointer.
type researchState struct {
	reg *index.Registry

	mu   sync.RWMutex
	info *project.Info
	idx  *index.Index
}

func newResearchState(reg *index.Registry) *researchState { return &researchState{reg: reg} }

func (rs *researchState) register(mux *http.ServeMux) {
	mux.HandleFunc("/v1/project/open", rs.handleProjectOpen)
	mux.HandleFunc("/v1/index/start", rs.handleIndexStart)
	mux.HandleFunc("/v1/index/status", rs.handleIndexStatus)
	mux.HandleFunc("/v1/research/symbols", rs.handleSymbols)
	mux.HandleFunc("/v1/research/trace", rs.handleTrace)
	mux.HandleFunc("/v1/research/findings", rs.handleFindings)
}

// ─── JSON helpers (the consistent error shape API.md called for) ─────────────

type errorBody struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code, msg string) {
	var b errorBody
	b.Error.Code, b.Error.Message = code, msg
	writeJSON(w, status, b)
}

func requireMethod(w http.ResponseWriter, r *http.Request, method string) bool {
	if r.Method != method {
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "use "+method)
		return false
	}
	return true
}

func (rs *researchState) snapshot() (*project.Info, *index.Index) {
	rs.mu.RLock()
	defer rs.mu.RUnlock()
	return rs.info, rs.idx
}

// requireIndex writes the appropriate 409 and returns nil when there is
// nothing to query yet.
func (rs *researchState) requireIndex(w http.ResponseWriter) *index.Index {
	info, idx := rs.snapshot()
	if info == nil {
		writeError(w, http.StatusConflict, "no_project", "no project is open")
		return nil
	}
	if idx == nil {
		writeError(w, http.StatusConflict, "not_indexed", "project has not been indexed yet")
		return nil
	}
	return idx
}

// ─── Handlers ────────────────────────────────────────────────────────────────

type statusResponse struct {
	State      string       `json:"state"` // no_project | not_indexed | ready
	Root       string       `json:"root,omitempty"`
	Frameworks []string     `json:"frameworks"`
	Stats      *index.Stats `json:"stats,omitempty"`
}

func (rs *researchState) status() statusResponse {
	info, idx := rs.snapshot()
	switch {
	case info == nil:
		return statusResponse{State: "no_project", Frameworks: []string{}}
	case idx == nil:
		return statusResponse{State: "not_indexed", Root: info.Root, Frameworks: info.Frameworks}
	}
	st := idx.Stats()
	return statusResponse{State: "ready", Root: info.Root, Frameworks: info.Frameworks, Stats: &st}
}

func (rs *researchState) handleProjectOpen(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, http.MethodPost) {
		return
	}
	var body struct {
		Root string `json:"root"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<16)).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid JSON body")
		return
	}
	info, err := project.Detect(body.Root)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_project_root", err.Error())
		return
	}
	rs.mu.Lock()
	rs.info, rs.idx = &info, nil // a new project invalidates the old index
	rs.mu.Unlock()
	writeJSON(w, http.StatusOK, rs.status())
}

// handleIndexStart indexes synchronously. That is fine for typical Solidity
// projects (milliseconds to a couple of seconds); when indexing must stream
// progress or run for long, this becomes an async job reported over the SSE
// envelope described in API.md. The request context cancels the walk if the
// client goes away.
func (rs *researchState) handleIndexStart(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, http.MethodPost) {
		return
	}
	info, _ := rs.snapshot()
	if info == nil {
		writeError(w, http.StatusConflict, "no_project", "no project is open")
		return
	}
	idx, err := index.Build(r.Context(), info.Root, rs.reg)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "index_failed", err.Error())
		return
	}
	rs.mu.Lock()
	// Only publish if the same project is still open.
	if rs.info != nil && rs.info.Root == info.Root {
		rs.idx = idx
	}
	rs.mu.Unlock()
	writeJSON(w, http.StatusOK, rs.status())
}

func (rs *researchState) handleIndexStatus(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, http.MethodGet) {
		return
	}
	writeJSON(w, http.StatusOK, rs.status())
}

func (rs *researchState) handleSymbols(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, http.MethodGet) {
		return
	}
	idx := rs.requireIndex(w)
	if idx == nil {
		return
	}
	q := r.URL.Query()
	kinds := map[index.SymbolKind]bool{}
	for _, k := range strings.Split(q.Get("kinds"), ",") {
		if k = strings.TrimSpace(k); k != "" {
			kinds[index.SymbolKind(k)] = true
		}
	}
	limit := 500
	if v, err := strconv.Atoi(q.Get("limit")); err == nil && v > 0 {
		limit = min(v, 2000)
	}
	writeJSON(w, http.StatusOK, map[string]any{"symbols": idx.ListSymbols(q.Get("q"), kinds, limit)})
}

func (rs *researchState) handleTrace(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, http.MethodGet) {
		return
	}
	idx := rs.requireIndex(w)
	if idx == nil {
		return
	}
	q := r.URL.Query()
	root := q.Get("root")
	if root == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "root is required")
		return
	}
	depth := 1
	if v, err := strconv.Atoi(q.Get("depth")); err == nil {
		depth = v
	}
	g, err := idx.Trace(root, depth)
	if errors.Is(err, index.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "no such symbol")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "trace_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, g)
}

func (rs *researchState) handleFindings(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, http.MethodGet) {
		return
	}
	idx := rs.requireIndex(w)
	if idx == nil {
		return
	}
	findings := idx.Findings
	if findings == nil {
		findings = []index.Finding{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"findings": findings})
}
