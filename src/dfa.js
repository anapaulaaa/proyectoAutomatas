//construye y ejecuta afd
// Construccion de subconjuntos (AFND-epsilon -> AFD)
// y utilidades para ejecutar cadenas sobre AFD.

function setToKey(setObj) {
  return [...setObj].sort((a, b) => a - b).join(',');
}

export function epsilonClosure(nfa, states) {
  const stack = [...states];
  const closure = new Set(states);

  while (stack.length) {
    const current = stack.pop();
    const transitions = nfa.transitions.get(current) || [];
    for (const tr of transitions) {
      if (tr.symbol === 'ε' && !closure.has(tr.to)) {
        closure.add(tr.to);
        stack.push(tr.to);
      }
    }
  }

  return closure;
}

export function move(nfa, states, symbol) {
  const result = new Set();
  for (const s of states) {
    const transitions = nfa.transitions.get(s) || [];
    for (const tr of transitions) {
      if (tr.symbol === symbol) {
        result.add(tr.to);
      }
    }
  }
  return result;
}

export function nfaToDfa(nfa) {
  const alphabet = [...nfa.alphabet].sort();
  const dfaTransitions = new Map();
  const dfaStateMap = new Map();
  const dfaStates = [];

  const startClosure = epsilonClosure(nfa, new Set([nfa.startState]));
  const startKey = setToKey(startClosure);
  dfaStateMap.set(startKey, 0);
  dfaStates.push(startClosure);

  let idx = 0;
  while (idx < dfaStates.length) {
    const currentSet = dfaStates[idx];
    const currentId = idx;

    if (!dfaTransitions.has(currentId)) {
      dfaTransitions.set(currentId, new Map());
    }

    for (const sym of alphabet) {
      const moved = move(nfa, currentSet, sym);
      const closed = epsilonClosure(nfa, moved);
      const key = setToKey(closed);

      if (closed.size === 0) {
        continue;
      }

      if (!dfaStateMap.has(key)) {
        const newId = dfaStates.length;
        dfaStateMap.set(key, newId);
        dfaStates.push(closed);
      }

      const target = dfaStateMap.get(key);
      dfaTransitions.get(currentId).set(sym, target);
    }

    idx += 1;
  }

  const acceptStates = new Set();
  for (let i = 0; i < dfaStates.length; i += 1) {
    for (const nfaAccept of nfa.acceptStates) {
      if (dfaStates[i].has(nfaAccept)) {
        acceptStates.add(i);
        break;
      }
    }
  }

  return {
    startState: 0,
    acceptStates,
    transitions: dfaTransitions,
    alphabet,
    stateSets: dfaStates,
    stateCount: dfaStates.length,
  };
}

export function runDfa(dfa, symbols) {
  let current = dfa.startState;

  for (const symbol of symbols) {
    const outgoing = dfa.transitions.get(current);
    if (!outgoing || !outgoing.has(symbol)) {
      return { accepted: false, endState: null, stoppedAt: symbol };
    }
    current = outgoing.get(symbol);
  }

  return {
    accepted: dfa.acceptStates.has(current),
    endState: current,
    stoppedAt: null,
  };
}

export function dfaToTransitionRows(dfa) {
  const rows = [];
  for (let s = 0; s < dfa.stateCount; s += 1) {
    const outgoing = dfa.transitions.get(s) || new Map();
    for (const sym of dfa.alphabet) {
      if (outgoing.has(sym)) {
        rows.push({ from: s, symbol: sym, to: outgoing.get(sym) });
      }
    }
  }
  return rows;
}
