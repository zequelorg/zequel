package index

import (
	"fmt"
	"strconv"
	"strings"
)

// Solidity is the Solidity language adapter. See doc.go for what it is (a
// tolerant token-level parser) and what it is not (a compiler front end).
type Solidity struct{}

func (Solidity) Language() string     { return "solidity" }
func (Solidity) Extensions() []string { return []string{".sol"} }

// Parse never panics: on an unexpected internal failure it returns whatever
// had been extracted so far, because an editor routinely holds half-typed code.
func (Solidity) Parse(path string, src []byte) (res FileResult) {
	p := &solParser{toks: solTokenize(string(src)), path: path, ids: map[string]bool{}}
	p.res.Path = path
	defer func() {
		if recover() != nil {
			res = p.res
		}
	}()
	p.parseFile()
	return p.res
}

// ─── Tokenizer ───────────────────────────────────────────────────────────────

type tokKind int

const (
	tkIdent tokKind = iota + 1
	tkNumber
	tkString
	tkPunct
)

type token struct {
	kind tokKind
	text string
	line int
}

var noTok = token{}

func tokAt(toks []token, i int) token {
	if i < 0 || i >= len(toks) {
		return noTok
	}
	return toks[i]
}

func isPunct(t token, s string) bool { return t.kind == tkPunct && t.text == s }

var solTwoCharOps = map[string]bool{
	"==": true, "!=": true, "<=": true, ">=": true, "+=": true, "-=": true,
	"*=": true, "/=": true, "%=": true, "&=": true, "|=": true, "^=": true,
	"++": true, "--": true, "&&": true, "||": true, "=>": true, "->": true,
	"<<": true, ">>": true, "**": true,
}

func isIdentStart(c byte) bool {
	return c == '_' || c == '$' || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
}
func isDigit(c byte) bool { return c >= '0' && c <= '9' }

// solTokenize drops comments and whitespace, keeps string literals (import
// paths need them) and tracks 1-based line numbers.
func solTokenize(src string) []token {
	var toks []token
	line := 1
	n := len(src)
	i := 0
	for i < n {
		c := src[i]
		switch {
		case c == '\n':
			line++
			i++
		case c == ' ' || c == '\t' || c == '\r':
			i++
		case c == '/' && i+1 < n && src[i+1] == '/':
			for i < n && src[i] != '\n' {
				i++
			}
		case c == '/' && i+1 < n && src[i+1] == '*':
			i += 2
			for i < n && !(src[i] == '*' && i+1 < n && src[i+1] == '/') {
				if src[i] == '\n' {
					line++
				}
				i++
			}
			i = min(i+2, n)
		case c == '"' || c == '\'':
			quote := c
			i++
			start := i
			for i < n && src[i] != quote && src[i] != '\n' {
				if src[i] == '\\' && i+1 < n {
					i++
				}
				i++
			}
			end := min(i, n)
			toks = append(toks, token{tkString, src[start:end], line})
			if i < n && src[i] == quote {
				i++
			}
		case isIdentStart(c):
			start := i
			for i < n && (isIdentStart(src[i]) || isDigit(src[i])) {
				i++
			}
			toks = append(toks, token{tkIdent, src[start:i], line})
		case isDigit(c):
			start := i
			for i < n && (isIdentStart(src[i]) || isDigit(src[i]) || src[i] == '.') {
				i++
			}
			toks = append(toks, token{tkNumber, src[start:i], line})
		default:
			if i+1 < n && solTwoCharOps[src[i:i+2]] {
				toks = append(toks, token{tkPunct, src[i : i+2], line})
				i += 2
			} else {
				toks = append(toks, token{tkPunct, src[i : i+1], line})
				i++
			}
		}
	}
	return toks
}

// matchGroup returns the index of the bracket closing the one at toks[open],
// or len(toks) if it is never closed (half-typed code).
func matchGroup(toks []token, open int) int {
	depth := 0
	for i := open; i < len(toks); i++ {
		if toks[i].kind != tkPunct {
			continue
		}
		switch toks[i].text {
		case "(", "{", "[":
			depth++
		case ")", "}", "]":
			depth--
			if depth == 0 {
				return i
			}
		}
	}
	return len(toks)
}

// countItems counts top-level comma-separated items between toks[open] and
// toks[closeIdx]: "()" is 0, "(a)" is 1, "(a, b)" is 2.
func countItems(toks []token, open, closeIdx int) int {
	closeIdx = min(closeIdx, len(toks))
	if open+1 >= closeIdx {
		return 0
	}
	depth, n := 0, 1
	for i := open + 1; i < closeIdx; i++ {
		if toks[i].kind != tkPunct {
			continue
		}
		switch toks[i].text {
		case "(", "{", "[":
			depth++
		case ")", "}", "]":
			depth--
		case ",":
			if depth == 0 {
				n++
			}
		}
	}
	return n
}

// ─── Parser ──────────────────────────────────────────────────────────────────

type modRef struct {
	name string
	line int
}

type pendingBody struct {
	sym   Symbol
	scope string
	body  []token
	mods  []modRef
}

type solParser struct {
	toks    []token
	pos     int
	path    string
	res     FileResult
	pending []pendingBody
	ids     map[string]bool
}

func (p *solParser) uniqueID(id string, line int) string {
	if p.ids[id] {
		id = id + "@" + strconv.Itoa(line)
	}
	p.ids[id] = true
	return id
}

func (p *solParser) addSymbol(s Symbol) {
	s.Language = "solidity"
	p.res.Symbols = append(p.res.Symbols, s)
}

func (p *solParser) addRef(r RawRef) {
	r.Path = p.path
	p.res.Refs = append(p.res.Refs, r)
}

func (p *solParser) addFinding(symID string, line int, sev Severity, rule, msg string) {
	p.res.Findings = append(p.res.Findings, Finding{
		SymbolID: symID, Path: p.path, Line: line, Severity: sev, Rule: rule, Message: msg,
	})
}

// skipStatement advances past the next ';' at bracket depth zero.
func (p *solParser) skipStatement() {
	depth := 0
	for p.pos < len(p.toks) {
		t := p.toks[p.pos]
		p.pos++
		if t.kind != tkPunct {
			continue
		}
		switch t.text {
		case "(", "{", "[":
			depth++
		case ")", "}", "]":
			depth--
		case ";":
			if depth <= 0 {
				return
			}
		}
	}
}

// skipBlockDecl skips "struct Name { ... }" / "enum Name { ... }".
func (p *solParser) skipBlockDecl() {
	p.pos++ // keyword
	for p.pos < len(p.toks) && !isPunct(p.toks[p.pos], "{") {
		p.pos++
	}
	if p.pos < len(p.toks) {
		p.pos = matchGroup(p.toks, p.pos) + 1
	}
}

func (p *solParser) parseFile() {
	for p.pos < len(p.toks) {
		t := p.toks[p.pos]
		if t.kind != tkIdent {
			p.pos++
			continue
		}
		switch t.text {
		case "import":
			p.parseImport()
		case "pragma", "using", "error", "type", "event":
			p.skipStatement()
		case "struct", "enum":
			p.skipBlockDecl()
		case "contract", "interface", "library":
			p.parseContract()
		case "function":
			p.parseFunction("", "")
		default:
			p.pos++
		}
	}
	p.flushPending("")
}

func (p *solParser) parseImport() {
	p.pos++ // "import"
	for p.pos < len(p.toks) {
		t := p.toks[p.pos]
		p.pos++
		if t.kind == tkString {
			p.res.Imports = append(p.res.Imports, t.text)
		}
		if isPunct(t, ";") {
			return
		}
	}
}

func (p *solParser) parseContract() {
	kw := p.toks[p.pos]
	p.pos++
	nameTok := tokAt(p.toks, p.pos)
	if nameTok.kind != tkIdent {
		return
	}
	p.pos++
	kind := KindContract
	switch kw.text {
	case "interface":
		kind = KindInterface
	case "library":
		kind = KindLibrary
	}
	id := p.uniqueID(p.path+"::"+nameTok.text, nameTok.line)
	p.addSymbol(Symbol{ID: id, Name: nameTok.text, Kind: kind, Path: p.path, Line: nameTok.line, Arity: -1})

	if t := tokAt(p.toks, p.pos); t.kind == tkIdent && t.text == "is" {
		p.pos++
		p.parseBases(id)
	}
	for p.pos < len(p.toks) && !isPunct(p.toks[p.pos], "{") {
		p.pos++
	}
	if p.pos >= len(p.toks) {
		return
	}
	end := matchGroup(p.toks, p.pos)
	p.pos++
	p.parseContractBody(id, end)
	p.pos = end + 1
	p.flushPending(id)
}

// parseBases reads "A, B(args), pkg.C" up to (not including) the opening
// brace, emitting one extends reference per base. For a dotted name the last
// segment wins.
func (p *solParser) parseBases(contractID string) {
	cur, curLine := "", 0
	flush := func() {
		if cur != "" {
			p.addRef(RawRef{From: contractID, Name: cur, Arity: -1, Kind: EdgeExtends, Line: curLine})
			cur = ""
		}
	}
	for p.pos < len(p.toks) && !isPunct(p.toks[p.pos], "{") {
		t := p.toks[p.pos]
		switch {
		case t.kind == tkIdent:
			cur, curLine = t.text, t.line
			p.pos++
		case isPunct(t, "("):
			p.pos = matchGroup(p.toks, p.pos) + 1
		case isPunct(t, ","):
			flush()
			p.pos++
		default:
			p.pos++
		}
	}
	flush()
}

func (p *solParser) parseContractBody(contractID string, end int) {
	scopeName := contractID[strings.LastIndex(contractID, "::")+2:]
	for p.pos < end && p.pos < len(p.toks) {
		t := p.toks[p.pos]
		if t.kind != tkIdent {
			p.pos++
			continue
		}
		switch t.text {
		case "function", "constructor", "receive", "fallback", "modifier":
			p.parseFunction(contractID, scopeName)
		case "event":
			p.parseEvent(contractID)
		case "error", "using":
			p.skipStatement()
		case "struct", "enum":
			p.skipBlockDecl()
		default:
			p.parseStateVar(contractID, end)
		}
	}
}

func (p *solParser) parseEvent(contractID string) {
	p.pos++ // "event"
	if nt := tokAt(p.toks, p.pos); nt.kind == tkIdent {
		id := p.uniqueID(contractID+"."+nt.text+"#event", nt.line)
		p.addSymbol(Symbol{ID: id, Name: nt.text, Kind: KindEvent, Parent: contractID, Path: p.path, Line: nt.line, Arity: -1})
	}
	p.skipStatement()
}

func (p *solParser) parseStateVar(contractID string, end int) {
	start := p.pos
	depth, semi := 0, -1
	for i := start; i < end && i < len(p.toks); i++ {
		t := p.toks[i]
		if t.kind != tkPunct {
			continue
		}
		switch t.text {
		case "(", "{", "[":
			depth++
		case ")", "}", "]":
			depth--
		case ";":
			if depth <= 0 {
				semi = i
			}
		}
		if semi >= 0 {
			break
		}
	}
	if semi < 0 {
		p.pos = max(end, start+1)
		return
	}

	name, typeName, vis := "", "", ""
	depth = 0
scan:
	for i := start; i < semi; i++ {
		t := p.toks[i]
		if t.kind == tkPunct {
			switch t.text {
			case "(", "{", "[":
				depth++
			case ")", "}", "]":
				depth--
			case "=":
				if depth == 0 {
					break scan // initializer begins; name is already known
				}
			}
			continue
		}
		if depth != 0 || t.kind != tkIdent {
			continue
		}
		if i == start {
			typeName = t.text
		}
		switch t.text {
		case "public", "private", "internal":
			vis = t.text
		case "constant", "immutable", "override", "transient":
		default:
			name = t.text
		}
	}
	line := p.toks[start].line
	p.pos = semi + 1
	if name == "" || (name == typeName && semi-start <= 1) {
		return
	}
	if solIsElementary(typeName) {
		typeName = ""
	}
	id := p.uniqueID(contractID+"."+name, line)
	p.addSymbol(Symbol{ID: id, Name: name, Kind: KindVariable, Parent: contractID, Path: p.path,
		Line: line, Arity: -1, Visibility: vis, VarType: typeName})
}

func (p *solParser) parseFunction(scopeID, scopeName string) {
	kw := p.toks[p.pos]
	p.pos++
	name := kw.text
	kind := KindFunction
	if kw.text == "modifier" {
		kind = KindModifier
	}
	if kw.text == "function" || kw.text == "modifier" {
		if nt := tokAt(p.toks, p.pos); nt.kind == tkIdent {
			name = nt.text
			p.pos++
		} else {
			name = "fallback"
		}
	}
	arity := 0
	if isPunct(tokAt(p.toks, p.pos), "(") {
		closeIdx := matchGroup(p.toks, p.pos)
		arity = countItems(p.toks, p.pos, closeIdx)
		p.pos = closeIdx + 1
	}

	var vis, mut string
	var mods []modRef
	for p.pos < len(p.toks) {
		t := p.toks[p.pos]
		if t.kind == tkPunct && (t.text == "{" || t.text == ";") {
			break
		}
		p.pos++
		if t.kind != tkIdent {
			continue
		}
		switch t.text {
		case "public", "external", "internal", "private":
			vis = t.text
		case "view", "pure", "payable":
			mut = t.text
		case "virtual":
		case "override", "returns":
			if isPunct(tokAt(p.toks, p.pos), "(") {
				p.pos = matchGroup(p.toks, p.pos) + 1
			}
		default:
			// Anything else in the attribute list is a modifier invocation
			// (or a base-constructor call on a constructor).
			mods = append(mods, modRef{t.text, t.line})
			if isPunct(tokAt(p.toks, p.pos), "(") {
				p.pos = matchGroup(p.toks, p.pos) + 1
			}
		}
	}

	var id string
	if scopeID == "" {
		id = p.path + "::" + name + "/" + strconv.Itoa(arity)
	} else {
		id = scopeID + "." + name + "/" + strconv.Itoa(arity)
	}
	id = p.uniqueID(id, kw.line)
	sym := Symbol{ID: id, Name: name, Kind: kind, Parent: scopeID, Path: p.path, Line: kw.line,
		Arity: arity, Visibility: vis, Mutability: mut}
	p.addSymbol(sym)

	switch {
	case isPunct(tokAt(p.toks, p.pos), "{"):
		closeIdx := matchGroup(p.toks, p.pos)
		body := p.toks[p.pos+1 : min(closeIdx, len(p.toks))]
		p.pending = append(p.pending, pendingBody{sym: sym, scope: scopeID, body: body, mods: mods})
		p.pos = closeIdx + 1
	case isPunct(tokAt(p.toks, p.pos), ";"):
		p.pos++
	}
}

// flushPending analyzes function bodies belonging to scope. It runs after the
// whole contract is parsed because state variables may be declared after the
// functions that use them.
func (p *solParser) flushPending(scope string) {
	stateVars := map[string]string{}
	if scope != "" {
		for _, s := range p.res.Symbols {
			if s.Parent == scope && s.Kind == KindVariable {
				stateVars[s.Name] = s.VarType
			}
		}
	}
	kept := p.pending[:0]
	for _, pb := range p.pending {
		if pb.scope == scope {
			p.analyze(pb, stateVars)
		} else {
			kept = append(kept, pb)
		}
	}
	p.pending = kept
}

// ─── Body analysis ───────────────────────────────────────────────────────────

var solNotACall = map[string]bool{
	"if": true, "for": true, "while": true, "do": true, "return": true, "returns": true,
	"require": true, "assert": true, "revert": true, "emit": true, "new": true,
	"delete": true, "function": true, "try": true, "catch": true, "else": true,
	"mapping": true, "abi": true, "type": true, "keccak256": true, "sha256": true,
	"sha3": true, "ripemd160": true, "ecrecover": true, "addmod": true, "mulmod": true,
	"selfdestruct": true, "suicide": true, "blockhash": true, "gasleft": true,
	"payable": true, "address": true, "string": true, "bytes": true, "bool": true,
	"super": true, "this": true, "assembly": true, "unchecked": true,
}

func solIsElementary(s string) bool {
	switch s {
	case "address", "bool", "string", "bytes", "byte", "payable", "mapping":
		return true
	}
	for _, prefix := range []string{"uint", "int", "bytes"} {
		if strings.HasPrefix(s, prefix) {
			rest := s[len(prefix):]
			if rest == "" {
				return true
			}
			if _, err := strconv.Atoi(rest); err == nil {
				return true
			}
		}
	}
	return false
}

func solIsAssignOp(t token) bool {
	if t.kind != tkPunct {
		return false
	}
	switch t.text {
	case "=", "+=", "-=", "*=", "/=", "%=", "|=", "&=", "^=", "++", "--":
		return true
	}
	return false
}

// solIsWrite reports whether the identifier at b[i] is being assigned to:
// `x = ..`, `x += ..`, `x[k] = ..`, `x.field = ..`, `x++`, `++x`, `delete x`,
// `x.push(..)`, `x.pop()`.
func solIsWrite(b []token, i int) bool {
	if prev := tokAt(b, i-1); prev.text == "++" || prev.text == "--" || (prev.kind == tkIdent && prev.text == "delete") {
		return true
	}
	j := i + 1
	for isPunct(tokAt(b, j), "[") {
		j = matchGroup(b, j) + 1
	}
	if solIsAssignOp(tokAt(b, j)) {
		return true
	}
	if isPunct(tokAt(b, j), ".") {
		m := tokAt(b, j+1)
		if m.kind == tkIdent && (m.text == "push" || m.text == "pop") {
			return true
		}
		if m.kind == tkIdent && solIsAssignOp(tokAt(b, j+2)) {
			return true
		}
	}
	return false
}

func (p *solParser) analyze(pb pendingBody, stateVars map[string]string) {
	b, fn := pb.body, pb.sym

	guarded := false
	for _, m := range pb.mods {
		p.addRef(RawRef{From: fn.ID, Scope: pb.scope, Name: m.name, Arity: -1, Kind: EdgeCalls, Line: m.line})
		if strings.Contains(strings.ToLower(m.name), "reentran") {
			guarded = true
		}
	}

	interactionAt, interactionLine := -1, 0
	markInteraction := func(i, line int) {
		if interactionAt < 0 {
			interactionAt, interactionLine = i, line
		}
	}
	writeName, writeLine := "", 0

	for i := 0; i < len(b); i++ {
		t := b[i]
		if t.kind != tkIdent {
			continue
		}
		prev, next := tokAt(b, i-1), tokAt(b, i+1)
		prevDot := isPunct(prev, ".")

		// Findings and interaction points.
		switch {
		case t.text == "assembly":
			p.addFinding(fn.ID, t.line, SevInfo, "inline-assembly",
				"Inline assembly bypasses Solidity's safety checks; review it manually.")
		case t.text == "selfdestruct" && isPunct(next, "("):
			p.addFinding(fn.ID, t.line, SevWarning, "selfdestruct",
				"selfdestruct can destroy the contract; verify access control and that it is intended.")
		case t.text == "origin" && prevDot && tokAt(b, i-2).text == "tx":
			p.addFinding(fn.ID, t.line, SevWarning, "tx-origin",
				"tx.origin is phishable when used for authorization; prefer msg.sender.")
		case t.text == "delegatecall" && prevDot:
			p.addFinding(fn.ID, t.line, SevWarning, "delegatecall",
				"delegatecall runs foreign code in this contract's storage context; verify the target is trusted and fixed.")
			markInteraction(i, t.line)
		case t.text == "call" && prevDot && (isPunct(next, "(") || isPunct(next, "{")):
			p.addFinding(fn.ID, t.line, SevInfo, "low-level-call",
				"Low-level call: check the returned success flag and consider reentrancy.")
			markInteraction(i, t.line)
		}

		// State writes after an external interaction (reentrancy heuristic).
		if _, isState := stateVars[t.text]; isState && !prevDot && interactionAt >= 0 && writeName == "" && solIsWrite(b, i) {
			writeName, writeLine = t.text, t.line
		}

		// References.
		switch {
		case t.text == "emit" && tokAt(b, i+1).kind == tkIdent:
			p.addRef(RawRef{From: fn.ID, Scope: pb.scope, Name: next.text, Arity: -1, Kind: EdgeReferences, Line: t.line})
		case t.text == "new" && tokAt(b, i+1).kind == tkIdent:
			p.addRef(RawRef{From: fn.ID, Scope: pb.scope, Name: next.text, Arity: -1, Kind: EdgeReferences, Line: t.line})
		case isPunct(next, "(") && !prevDot && !solNotACall[t.text] && !solIsElementary(t.text):
			closeIdx := matchGroup(b, i+1)
			p.addRef(RawRef{From: fn.ID, Scope: pb.scope, Name: t.text,
				Arity: countItems(b, i+1, closeIdx), Kind: EdgeCalls, Line: t.line})
		case isPunct(next, ".") && !prevDot && tokAt(b, i+2).kind == tkIdent:
			member := tokAt(b, i+2)
			j := i + 3
			if isPunct(tokAt(b, j), "{") { // call options: x.f{value: v}(..)
				j = matchGroup(b, j) + 1
			}
			if isPunct(tokAt(b, j), "(") {
				closeIdx := matchGroup(b, j)
				p.addRef(RawRef{From: fn.ID, Scope: pb.scope, Qualifier: t.text, Name: member.text,
					Arity: countItems(b, j, closeIdx), Kind: EdgeCalls, Line: t.line})
				if ty, ok := stateVars[t.text]; ok && ty != "" {
					markInteraction(i, t.line) // call on a contract-typed state variable
				}
			}
		}
	}

	if fn.Kind == KindFunction && writeName != "" && !guarded {
		p.addFinding(fn.ID, writeLine, SevWarning, "reentrancy-heuristic", fmt.Sprintf(
			"State variable %q is written after an external interaction (line %d) in %s. "+
				"Verify checks-effects-interactions or add a reentrancy guard. Heuristic, not a verdict.",
			writeName, interactionLine, fn.Name))
	}
}
