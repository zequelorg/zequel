package index

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

const ivaultSol = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
interface IVault { function deposit() external payable; }
`

const vaultSol = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "./IVault.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

library MathLib {
    function add(uint a, uint b) internal pure returns (uint) { return a + b; }
}

contract Base {
    uint public total;
    address owner;
    event Deposited(address who, uint amt);
    modifier onlyOwner() { require(msg.sender == owner, "no"); _; }
    function _bump(uint x) internal { total = MathLib.add(total, x); }
}

contract Vault is Base, Ownable {
    mapping(address => uint) public balances;
    IVault public peer;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
        _bump(msg.value);
        emit Deposited(msg.sender, msg.value);
    }
    function withdraw(uint amt) external {
        require(balances[msg.sender] >= amt, "bal");
        (bool ok, ) = msg.sender.call{value: amt}("");
        require(ok);
        balances[msg.sender] -= amt;
    }
    function forward() external onlyOwner { peer.deposit(); }
    function kill() external { selfdestruct(payable(msg.sender)); }
    function auth() external view returns (bool) { return tx.origin == owner; }
    // tx.origin in a comment must not be flagged
    function quiet() external pure returns (string memory) { return "selfdestruct(x) tx.origin"; }
}
`

func writeProject(t *testing.T, files map[string]string) string {
	t.Helper()
	dir := t.TempDir()
	for name, content := range files {
		p := filepath.Join(dir, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return dir
}

func buildSample(t *testing.T) *Index {
	t.Helper()
	dir := writeProject(t, map[string]string{
		"src/IVault.sol":                 ivaultSol,
		"src/Vault.sol":                  vaultSol,
		"lib/forge-std/src/Ignored.sol":  "contract Ignored {}",
		"node_modules/x/Ignored2.sol":    "contract Ignored2 {}",
	})
	ix, err := Build(context.Background(), dir, DefaultRegistry())
	if err != nil {
		t.Fatal(err)
	}
	return ix
}

func hasEdge(ix *Index, from, to string, kind EdgeKind) bool {
	for _, e := range ix.Edges {
		if e.From == from && e.To == to && e.Kind == kind {
			return true
		}
	}
	return false
}

func TestBuild_SymbolsAndSkippedDirs(t *testing.T) {
	ix := buildSample(t)
	for _, id := range []string{
		"src/Vault.sol::Vault", "src/Vault.sol::Base", "src/Vault.sol::MathLib",
		"src/IVault.sol::IVault", "src/Vault.sol::Vault.withdraw/1", "src/Vault.sol::Base.onlyOwner/0",
	} {
		if _, ok := ix.Symbols[id]; !ok {
			t.Errorf("missing symbol %q", id)
		}
	}
	if _, ok := ix.byName["Ignored"]; ok {
		t.Error("lib/ must not be indexed")
	}
	if _, ok := ix.byName["Ignored2"]; ok {
		t.Error("node_modules/ must not be indexed")
	}
	if got := ix.Stats().Files; got != 2 {
		t.Errorf("expected 2 indexed files, got %d", got)
	}
}

func TestBuild_ResolvesEdges(t *testing.T) {
	ix := buildSample(t)
	const v = "src/Vault.sol::"
	cases := []struct {
		from, to string
		kind     EdgeKind
	}{
		{v + "Vault", v + "Base", EdgeExtends},
		{v + "Vault", "ext::Ownable", EdgeExtends}, // dependency placeholder
		{v + "Vault.deposit/0", v + "Base._bump/1", EdgeCalls},
		{v + "Base._bump/1", v + "MathLib.add/2", EdgeCalls},
		{v + "Vault.forward/0", v + "Base.onlyOwner/0", EdgeCalls}, // modifier via inherited base
		{v + "Vault.forward/0", "src/IVault.sol::IVault.deposit/0", EdgeCalls}, // via typed state var, cross-file
		{v + "Vault.deposit/0", v + "Base.Deposited#event", EdgeReferences},
		{v + "Vault", "src/IVault.sol::IVault", EdgeReferences}, // state var type
	}
	for _, c := range cases {
		if !hasEdge(ix, c.from, c.to, c.kind) {
			t.Errorf("missing %s edge %s -> %s", c.kind, c.from, c.to)
		}
	}
}

func findingRules(ix *Index, symID string) map[string]bool {
	rules := map[string]bool{}
	for _, f := range ix.Findings {
		if f.SymbolID == symID {
			rules[f.Rule] = true
		}
	}
	return rules
}

func TestBuild_Findings(t *testing.T) {
	ix := buildSample(t)
	const v = "src/Vault.sol::Vault."
	if r := findingRules(ix, v+"withdraw/1"); !r["reentrancy-heuristic"] || !r["low-level-call"] {
		t.Errorf("withdraw: expected reentrancy-heuristic and low-level-call, got %v", r)
	}
	if r := findingRules(ix, v+"deposit/0"); len(r) != 0 {
		t.Errorf("deposit: expected no findings (write happens before any interaction), got %v", r)
	}
	if r := findingRules(ix, v+"kill/0"); !r["selfdestruct"] {
		t.Errorf("kill: expected selfdestruct finding, got %v", r)
	}
	if r := findingRules(ix, v+"auth/0"); !r["tx-origin"] {
		t.Errorf("auth: expected tx-origin finding, got %v", r)
	}
	if r := findingRules(ix, v+"quiet/0"); len(r) != 0 {
		t.Errorf("quiet: comments/strings must not produce findings, got %v", r)
	}
}

func TestTrace_ContractLevel(t *testing.T) {
	ix := buildSample(t)
	g, err := ix.Trace("src/Vault.sol::Vault", 1)
	if err != nil {
		t.Fatal(err)
	}
	if g.Root.Label != "Vault" {
		t.Errorf("root label = %q", g.Root.Label)
	}
	labels := map[string]TraceNode{}
	for _, n := range g.Nodes {
		labels[n.Label] = n
	}
	for _, want := range []string{"Base", "Ownable", "IVault"} {
		n, ok := labels[want]
		if !ok {
			t.Errorf("expected %q among traced nodes, got %v", want, g.Nodes)
			continue
		}
		if n.Direction != "outflows" {
			t.Errorf("%s direction = %q", want, n.Direction)
		}
	}
	// Inbound view: who depends on Base? Vault does.
	gb, err := ix.Trace("src/Vault.sol::Base", 1)
	if err != nil {
		t.Fatal(err)
	}
	foundVault := false
	for _, n := range gb.Nodes {
		if n.Label == "Vault" && n.Direction == "inflows" {
			foundVault = true
		}
	}
	if !foundVault {
		t.Errorf("expected Vault as an inflow of Base, got %v", gb.Nodes)
	}
	// Vault carries warnings from its members.
	if labels["Base"].Severity != "none" {
		t.Errorf("Base severity should be none, got %q", labels["Base"].Severity)
	}
}

func TestTrace_FunctionLevelAndErrors(t *testing.T) {
	ix := buildSample(t)
	g, err := ix.Trace("src/Vault.sol::Vault.deposit/0", 1)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, n := range g.Nodes {
		if n.Label == "Base._bump" && n.Direction == "outflows" && n.Kind == "calls" {
			found = true
		}
	}
	if !found {
		t.Errorf("expected Base._bump as an outflow call, got %v", g.Nodes)
	}
	if _, err := ix.Trace("nope", 1); err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestBuild_ToleratesBrokenSource(t *testing.T) {
	dir := writeProject(t, map[string]string{
		"A.sol": "contract A { function f( { uint x = ; ",
		"B.sol": "contract B { function ok() external {} }",
	})
	ix, err := Build(context.Background(), dir, DefaultRegistry())
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := ix.Symbols["B.sol::B.ok/0"]; !ok {
		t.Error("a broken file must not prevent other files from being indexed")
	}
}

func TestBuild_Cancelled(t *testing.T) {
	dir := writeProject(t, map[string]string{"A.sol": "contract A {}"})
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := Build(ctx, dir, DefaultRegistry()); err == nil {
		t.Error("expected an error from a cancelled context")
	}
}
