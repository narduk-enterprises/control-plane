package cli

import "testing"

func TestTruncateRunes(t *testing.T) {
	if got := truncateRunes("ab", 10); got != "ab" {
		t.Fatalf("short string: %q", got)
	}
	if got := truncateRunes("αβγδε", 3); got != "αβ…" {
		t.Fatalf("runes: %q", got)
	}
}
