package web

import "embed"

// FS holds the built frontend assets. Populated by `cd frontend && npm run build`.
//
//go:embed dist
var FS embed.FS
