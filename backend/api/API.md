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
(`crypto.randomBytes(32).toString('hex')`) and passed to the backend process
via the `ZEQUEL_BACKEND_TOKEN` environment variable at spawn time. The
backend refuses to start if this variable is empty or unset — there is no
"no-auth" mode, including for local development (see `backend/README.md` for
how to run it standalone with a token you choose yourself).

A request with a missing or incorrect token gets `401 Unauthorized`.

## Versioning

All routes are prefixed `/v1/...`. A breaking change to an existing route's
request/response shape gets a new `/v2/...` route instead of changing `/v1`
in place, so Electron and the backend can be updated independently without a
silent mismatch.

## Routes (current)

### `GET /v1/health`

Returns `200 OK` with:

```json
{ "status": "ok", "version": "0.1.0" }
```

Any other HTTP method on this path returns `405 Method Not Allowed`.

This is the only route that exists right now. Everything below is the
*planned* shape for upcoming routes — documented ahead of implementation so
the contract is designed deliberately, not reverse-engineered from whatever
got built first. None of it exists yet; do not build against it as if it
does.

## Routes (planned, not implemented)

- `POST /v1/project/open` — register a project root with the backend (the
  Electron-side root-containment check in `main.ts` stays regardless; this is
  about the backend knowing what to index, not a second copy of that
  security boundary).
- `GET /v1/index/status`, `POST /v1/index/start` — code-indexing coordination
  for Research Mode.
- Streaming AI endpoints (both Coding and Research) will use
  `Content-Type: text/event-stream` with one JSON object per `data:` line,
  terminated by a final `data: [DONE]` line — the same convention most AI
  provider SDKs already use, so the framing is familiar rather than bespoke.
  Exact route names and payload shapes aren't decided yet.

## Error shape (planned, not yet consistently implemented)

`/v1/health`'s error responses today are plain text (`http.Error`), not JSON.
Once more routes exist, errors should return a consistent JSON shape, e.g.:

```json
{ "error": { "code": "not_found", "message": "..." } }
```

This isn't implemented yet because there's only one route so far and
retrofitting one endpoint's error format isn't worth doing in isolation — it
should be decided once there's a second route to be consistent with.
