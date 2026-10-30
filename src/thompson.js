//construye afnd
// Conversion de AST de ER a AFND-epsilon mediante Thompson.
// Cada fragmento tiene: estado inicial y final. Las transiciones epsilon
// permiten conectar subexpresiones sin consumir simbolos.

export function astToNfa(ast) {
  const ctx = {
    nextState: 0,
    transitions: new Map(),
    alphabet: new Set(),
  };

  function newState() {
    const id = ctx.nextState;
    ctx.nextState += 1;
    if (!ctx.transitions.has(id)) {
      ctx.transitions.set(id, []);
    }
    return id;
  }

  function addTransition(from, symbol, to) {
    if (!ctx.transitions.has(from)) {
      ctx.transitions.set(from, []);
    }
    ctx.transitions.get(from).push({ symbol, to });
    if (symbol !== 'ε') {
      ctx.alphabet.add(symbol);
    }
  }

  function build(node) {
    if (node.type === 'symbol') {
      const start = newState();
      const end = newState();
      addTransition(start, node.value, end);
      return { start, end };
    }

    if (node.type === 'concat') {
      // Concat: final de izquierda conecta por epsilon al inicio de derecha.
      const left = build(node.left);
      const right = build(node.right);
      addTransition(left.end, 'ε', right.start);
      return { start: left.start, end: right.end };
    }

    if (node.type === 'union') {
      // Union: nuevo inicio y final, bifurcacion epsilon hacia ambos lados.
      const start = newState();
      const end = newState();
      const left = build(node.left);
      const right = build(node.right);

      addTransition(start, 'ε', left.start);
      addTransition(start, 'ε', right.start);
      addTransition(left.end, 'ε', end);
      addTransition(right.end, 'ε', end);

      return { start, end };
    }

    if (node.type === 'star') {
      // Kleene: permite cero repeticiones (inicio->fin) o ciclo sobre subexpresion.
      const start = newState();
      const end = newState();
      const inner = build(node.expr);

      addTransition(start, 'ε', inner.start);
      addTransition(start, 'ε', end);
      addTransition(inner.end, 'ε', inner.start);
      addTransition(inner.end, 'ε', end);

      return { start, end };
    }

    if (node.type === 'plus') {
      // Plus: al menos una repeticion. Similar a Kleene, pero sin epsilon inicio->fin.
      const start = newState();
      const end = newState();
      const inner = build(node.expr);

      addTransition(start, 'ε', inner.start);
      addTransition(inner.end, 'ε', inner.start);
      addTransition(inner.end, 'ε', end);

      return { start, end };
    }

    throw new Error(`Nodo AST no soportado en Thompson: ${node.type}`);
  }

  const fragment = build(ast);

  return {
    startState: fragment.start,
    acceptStates: new Set([fragment.end]),
    transitions: ctx.transitions,
    alphabet: ctx.alphabet,
    stateCount: ctx.nextState,
  };
}

export function nfaToTransitionRows(nfa) {
  const rows = [];
  for (let s = 0; s < nfa.stateCount; s += 1) {
    const list = nfa.transitions.get(s) || [];
    for (const t of list) {
      rows.push({ from: s, symbol: t.symbol, to: t.to });
    }
  }
  return rows;
}
