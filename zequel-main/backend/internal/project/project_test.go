package project

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDetect_Foundry(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "foundry.toml"), []byte("[profile.default]\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	info, err := Detect(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(info.Frameworks) != 1 || info.Frameworks[0] != "foundry" {
		t.Fatalf("expected [foundry], got %v", info.Frameworks)
	}
}

func TestDetect_RejectsRelativeAndMissing(t *testing.T) {
	if _, err := Detect("relative/path"); err == nil {
		t.Error("expected error for relative path")
	}
	if _, err := Detect(filepath.Join(t.TempDir(), "does-not-exist")); err == nil {
		t.Error("expected error for missing directory")
	}
}

func TestDetect_HardhatVariantsDeduplicated(t *testing.T) {
	dir := t.TempDir()
	for _, f := range []string{"hardhat.config.ts", "hardhat.config.js"} {
		if err := os.WriteFile(filepath.Join(dir, f), nil, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	info, err := Detect(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(info.Frameworks) != 1 || info.Frameworks[0] != "hardhat" {
		t.Fatalf("expected [hardhat], got %v", info.Frameworks)
	}
}
