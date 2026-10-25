import { validateEmail, validatePassword } from './validator.js';

const EMAIL_CHARSETS = {
  L: 'abcdefghijklmnopqrstuvwxyz',
  D: '0123456789',
  U: '_',
  G: '-',
  P: '.',
  A: '@',
};

const PASS_CHARSETS = {
  M: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  m: 'abcdefghijklmnopqrstuvwxyz',
  D: '0123456789',
  S: '!#$%&*+=?',
};

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedChoice(items, weightFn) {
  let total = 0;
  const weights = [];

  for (const item of items) {
    const w = Math.max(0, weightFn(item));
    weights.push(w);
    total += w;
  }

  if (total <= 0) {
    return randomChoice(items);
  }

  let r = Math.random() * total;
  for (let i = 0; i < items.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function computeCanReachAccept(dfa) {
  const reverse = new Map();
  for (let s = 0; s < dfa.stateCount; s += 1) {
    reverse.set(s, []);
  }

  for (let s = 0; s < dfa.stateCount; s += 1) {
    const out = dfa.transitions.get(s) || new Map();
    for (const [, to] of out.entries()) {
      reverse.get(to).push(s);
    }
  }

  const canReach = new Set([...dfa.acceptStates]);
  const stack = [...dfa.acceptStates];

  while (stack.length) {
    const current = stack.pop();
    for (const prev of reverse.get(current) || []) {
      if (!canReach.has(prev)) {
        canReach.add(prev);
        stack.push(prev);
      }
    }
  }

  return canReach;
}

function computeDistanceToAccept(dfa) {
  const reverse = new Map();
  for (let s = 0; s < dfa.stateCount; s += 1) {
    reverse.set(s, []);
  }

  for (let s = 0; s < dfa.stateCount; s += 1) {
    const out = dfa.transitions.get(s) || new Map();
    for (const [, to] of out.entries()) {
      reverse.get(to).push(s);
    }
  }

  const dist = new Map();
  const queue = [];

  for (const acc of dfa.acceptStates) {
    dist.set(acc, 0);
    queue.push(acc);
  }

  let head = 0;
  while (head < queue.length) {
    const current = queue[head];
    head += 1;
    const curDist = dist.get(current);

    for (const prev of reverse.get(current) || []) {
      if (!dist.has(prev)) {
        dist.set(prev, curDist + 1);
        queue.push(prev);
      }
    }
  }

  return dist;
}

function pickCharForSymbol(symbol, kind) {
  const source = kind === 'email' ? EMAIL_CHARSETS[symbol] : PASS_CHARSETS[symbol];
  if (!source) return null;
  return source[Math.floor(Math.random() * source.length)];
}

function emailTransitionWeight(symbol, currentOutput) {
  const base = {
    L: 0.75,
    D: 0.12,
    P: 0.04,
    U: 0.03,
    G: 0.03,
    A: 1.0,
  };

  let weight = base[symbol] ?? 1.0;
  const atIdx = currentOutput.indexOf('@');

  // Una vez en dominio, reducimos preferencia por digitos para favorecer etiquetas legibles.
  if (atIdx !== -1) {
    if (symbol === 'D') {
      weight *= 0.4;
    }

    const afterAt = currentOutput.slice(atIdx + 1);
    const lastDot = afterAt.lastIndexOf('.');

    // En el segmento posterior al ultimo punto (zona de TLD), reforzamos letras.
    if (lastDot !== -1) {
      if (symbol === 'L') weight *= 1.6;
      if (symbol === 'D') weight *= 0.3;
    }
  }

  return weight;
}

function guidedGenerateFromDfa(dfa, kind, minLen = 12, maxLen = 24, maxSteps = 200) {
  const canReach = computeCanReachAccept(dfa);
  const distanceToAccept = computeDistanceToAccept(dfa);
  let current = dfa.startState;
  let out = '';
  let steps = 0;

  while (steps < maxSteps) {
    steps += 1;
    const transitions = dfa.transitions.get(current) || new Map();
    const options = [];

    for (const [sym, to] of transitions.entries()) {
      if (canReach.has(to)) {
        options.push({ sym, to });
      }
    }

    const inAccept = dfa.acceptStates.has(current);
    if (inAccept && out.length >= minLen) {
      if (out.length >= maxLen || Math.random() < 0.25) {
        break;
      }
    }

    if (!options.length) break;

    let chosen;
    if (out.length >= maxLen && !inAccept) {
      // Al llegar al máximo sin aceptar, forzamos la mejor transición hacia aceptación.
      let best = null;
      for (const op of options) {
        const d = distanceToAccept.has(op.to) ? distanceToAccept.get(op.to) : Number.POSITIVE_INFINITY;
        if (!best || d < best.d) {
          best = { op, d };
        }
      }
      chosen = best ? best.op : randomChoice(options);
    } else {
      if (kind === 'email') {
        chosen = weightedChoice(options, (op) => emailTransitionWeight(op.sym, out));
      } else {
        chosen = randomChoice(options);
      }
    }

    const ch = pickCharForSymbol(chosen.sym, kind);
    if (!ch) break;

    out += ch;
    current = chosen.to;

    if (out.length >= maxLen && dfa.acceptStates.has(current)) {
      break;
    }
  }

  return out;
}

export function generateValidEmail(automata) {
  // Rango de longitud razonable para correo generado.
  for (let tries = 0; tries < 600; tries += 1) {
    const candidate = guidedGenerateFromDfa(automata.email.dfa, 'email', 8, 28, 260);
    const result = validateEmail(candidate, automata.email);
    if (result.valid) return candidate;
  }
  throw new Error('No se pudo generar un correo válido tras múltiples intentos');
}

export function generateValidPassword(automata) {
  for (let tries = 0; tries < 1200; tries += 1) {
    const candidate = guidedGenerateFromDfa(automata.password.dfa, 'password', 12, 24, 300);

    // El AFD de intersección valida clases M/m/D/S. Aquí solo verificamos reglas concretas adicionales.
    const validation = validatePassword(candidate, automata.password);
    if (validation.valid) return candidate;
  }
  throw new Error('No se pudo generar una contraseña válida tras múltiples intentos');
}

export function generateValidPair(automata) {
  return {
    email: generateValidEmail(automata),
    password: generateValidPassword(automata),
  };
}
