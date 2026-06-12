---
name: Replit Proxy API Routing
description: How the Replit pike proxy routes /api/* requests in artifact-based monorepos
---

## Rule
In a Replit artifact-based monorepo, the pike proxy routes `/api/*` requests to the **API artifact's port** (default: 8080), NOT to the frontend dev server's port (e.g. 5000). Static/frontend routes (`/`) go to the webview port (5000).

**Why:** Replit's artifact system reads the `kind: api` artifact config and adds routing rules so `/api/*` goes directly to the API server artifact — bypassing the frontend's Vite proxy entirely. If the API server is not running on port 8080, all `/api/*` requests return 502.

**How to apply:**
- Run the API server on port **8080** (what the Replit proxy expects for the API artifact).
- In `vite.config.ts`, set the proxy target to `http://localhost:8080` (not 3001 or any other port).
- Do NOT rely on Vite's proxy being hit for browser `/api/*` requests — the Replit proxy intercepts them first.
- The custom `API Server` workflow must use `PORT=8080`.
- Sessions stay consistent because both Vite's dev proxy and the Replit proxy hit the same Express process on port 8080.

## Port map (this project)
| What | Port | Notes |
|------|------|-------|
| Express API server | 8080 | `API Server` workflow, `PORT=8080` |
| Vite frontend (dev) | 5000 | `KRA KPI App` workflow, `PORT=5000 BASE_PATH=/` |
| `artifacts/api-server: API Server` | 8080 | Artifact-managed; conflicts → leave it failed, our workflow owns port 8080 |
