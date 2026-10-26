// Package project holds shared project-root state and ecosystem detection.
// Both internal/coding and internal/research depend on this package; it
// depends on neither (see internal/coding/doc.go for the boundary rule).
package project

import (
	"fmt"
	"os"
	"path/filepath"
)

// Info describes an opened project root.
type Info struct {
	Root       string   `json:"root"`
	Frameworks []string `json:"frameworks"`
}

// frameworkMarkers maps a marker file (relative to the root) to the framework
// it indicates. Detection is deliberately just "does this file exist" — the
// point is to tell the UI and, later, the tooling layer which ecosystem
// integrations are relevant, not to fully understand a project's config.
// Adding an ecosystem means adding a row here plus an adapter/tool module; no
// existing code changes.
var frameworkMarkers = []struct {
	file      string
	framework string
}{
	{"foundry.toml", "foundry"},
	{"hardhat.config.js", "hardhat"},
	{"hardhat.config.ts", "hardhat"},
	{"hardhat.config.cjs", "hardhat"},
	{"hardhat.config.mjs", "hardhat"},
	{"Anchor.toml", "anchor"},
	{"Cargo.toml", "cargo"},
	{"go.mod", "gomod"},
}

// Detect validates root (must be an absolute path to an existing directory)
// and reports which known ecosystem markers are present.
func Detect(root string) (Info, error) {
	if !filepath.IsAbs(root) {
		return Info{}, fmt.Errorf("project root must be an absolute path")
	}
	clean := filepath.Clean(root)
	st, err := os.Stat(clean)
	if err != nil {
		return Info{}, fmt.Errorf("project root: %w", err)
	}
	if !st.IsDir() {
		return Info{}, fmt.Errorf("project root is not a directory")
	}
	info := Info{Root: clean, Frameworks: []string{}}
	seen := map[string]bool{}
	for _, m := range frameworkMarkers {
		if seen[m.framework] {
			continue
		}
		if _, err := os.Stat(filepath.Join(clean, m.file)); err == nil {
			seen[m.framework] = true
			info.Frameworks = append(info.Frameworks, m.framework)
		}
	}
	return info, nil
}
