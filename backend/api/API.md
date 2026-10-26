# Zequel Backend API Contract

Local HTTP only. The server binds `127.0.0.1` on an OS-assigned ephemeral
port — never a fixed port, never `0.0.0.0`. Only Electron's main process ever
calls this API; the renderer never sees the port or the token (see
`/docs/SECURITY.md`).

## Discovery

The backend process prints exactly one line to stdout on startup:

```
ZEQUEL_BACKEND_PORT=54321
```

Electron's `backend.ts` parses this to learn where to send requests. There is
no other discovery mechanism (no fixed port, no config file, no registry).

## Authentication

Every request must carry:

```
Authorization: Bearer <token>
```

The token is generated fresh by Electron on every app launch
(`crypto.randomBytes(32).toString('hex')`) and written to the backend
process's **stdin** at spawn time (one line, newline-terminated) — not an
environment variable. Env vars of a running process are readable by other
processes owned by the same user (e.g. `/proc/<pid>/environ` on Linux), which
would partially defeat the point of requiring a token; stdin, once read,
leaves no such standing exposure. The backend refuses to start if no token is
read — there is no "no-auth" mode, including for local development (see
`backend/README.md` for how to run it standalone with a token you choose
yourself).

A request with a missing or incorrect token gets `401 Unauthorized`.

## Host header validation

Every request's `Host` header must exactly match `127.0.0.1:<port>` — the
loopback address and port this server is actually bound to. This is checked
*before* the token, and a mismatch gets `403 Forbidden`. This is defense in
depth against DNS rebinding (a malicious webpage's domain resolving to
127.0.0.1 after load, so its JS can reach this server — the Host header still
shows the original domain, which this check catches). The bearer token above
already fully defeats this attack on its own, since a rebound page's JS still
has no way to know the token; this is a cheap second layer, not the primary
defense.

## Versioning

All routes are prefixed `/v1/...`. A breaking change to an existing route's
request/response shape gets a new `/v2/...` route instead of changing `/v1`
in place, so Electron and the backend can be updated independently without a
silent mismatch.

## Routes (current)

### `GET /v1/health`

Returns `200 OK` with:

```json
{ "status": "ok", "version": "0.2.0" }
```

Any other HTTP method on this path returns `405 Method Not Allowed`.

### Project and index

All JSON. Errors use `{ "error": { "code": "...", "message": "..." } }`
(health and the auth/host middleware still return plain text).

- `POST /v1/project/open` — body `{ "root": "/abs/path" }`. Called only by
  Electron's main process with a path from the native folder dialog. Returns
  the status object below. `400 bad_project_root` for a relative/missing path.
- `POST /v1/index/start` — (re)index the open project synchronously and
  return status. `409 no_project` if none open.
- `GET /v1/index/status` — `{ state: "no_project"|"not_indexed"|"ready",
  root, frameworks: [...], stats: { files, symbols, edges, findings,
  languages, truncated } }`.

### Research (require an indexed project, else `409 no_project|not_indexed`)

- `GET /v1/research/symbols?q=&kinds=contract,function&limit=500` →
  `{ symbols: [{ id, name, kind, parent?, path, line, arity, visibility?,
  mutability?, language }] }`. Symbol IDs look like
  `src/Vault.sol::Vault` and `src/Vault.sol::Vault.withdraw/1`; URL-encode them.
- `GET /v1/research/trace?root=<symbolId>&depth=1..4` → the `TraceGraph`
  shape in `apps/desktop/src/lib/research/graph-types.ts` (`root`, `nodes`
  with `direction: inflows|outflows`, `edges`). Contract roots trace at
  contract granularity (member calls rolled up); function roots at function
  granularity. `404 not_found` for an unknown symbol.
- `GET /v1/research/findings` → `{ findings: [{ symbolId, path, line,
  severity: info|warning|critical, rule, message }] }`. Heuristic leads only.

## Routes (planned, not implemented)

- Search, git, and terminal routes, and AI-agent/streaming routes (below).

### Streaming (proposed design, not implemented)

Both Coding and Research will need to stream: AI tokens as they're generated,
agent progress ("reading file X", "running tests"), and eventual
cancellation. One consistent mechanism for all of it, not a different pattern
per feature:

**Transport:** `Content-Type: text/event-stream` (SSE) over the same
authenticated HTTP connection — no separate WebSocket upgrade, no second auth
handshake. Go's `net/http` supports this natively via `http.Flusher`.

**Envelope:** every event is one JSON object per `data:` line, always with a
`type` field, so the renderer can switch on it without guessing:

```
data: {"type":"token","text":"Hel"}
data: {"type":"token","text":"lo"}
data: {"type":"progress","message":"Reading main.go"}
data: {"type":"error","code":"provider_timeout","message":"..."}
data: {"type":"done"}
```

- `token` — one chunk of AI output text.
- `progress` — a human-readable status update for agent work (file reads,
  tool calls, test runs) — not token text, so the renderer can render it
  differently (e.g. a dimmed status line vs. the actual response).
- `error` — a terminal error for this stream; always the last event if
  present, no further events follow it.
- `done` — successful terminal event; always the last event if the stream
  completed normally.

Every streaming route is versioned the same as any other (`/v1/...`), and a
shape change is a new version, same rule as above — the envelope itself
having a `type` field means most additions (a new `type` value) don't need a
version bump; a change to an *existing* type's fields does.

**Cancellation:** the client (Electron's main process) just closes the HTTP
connection (abort the `fetch`). Go's `http.Request.Context()` is cancelled
when the underlying connection closes, so a streaming handler that checks
`r.Context().Err()` between units of work (each token, each agent step) stops
promptly without needing a separate cancel endpoint or request ID scheme.
Simpler than a `DELETE /v1/.../:requestId` companion route, and correct by
construction rather than by remembering to call it.

**Disconnection the other way (backend dies mid-stream):** the renderer's
`fetch` to the stream will error/close, which the UI should treat the same as
an explicit `error` event — i.e. the error-handling path should not assume an
`error` event always arrives cleanly; a dropped connection is itself a signal.

**Not decided yet:** exact route names and request payload shapes for the
Coding and Research streaming endpoints specifically — that's tied to the
AI-agent and indexing design, which hasn't started (see `docs/STATUS.md`).
This section is the transport/envelope/cancellation contract those routes
will use once they exist, decided now so they don't each invent their own.
