import { parseRegex } from './parser.js';
import { astToNfa } from './thompson.js';
import { nfaToDfa, runDfa } from './dfa.js';

export const EMAIL_REGEX_SYMBOLIC = '(L|D|U|G)((L|D|U|G)|P(L|D|U|G))*A((L|D)(G*(L|D))*P)+LLL*';
const PASSWORD_FACTOR_REGEX = {
  long: 'X'.repeat(12) + 'X*',
  may: 'X*MX*',
  min: 'X*mX*',
  dig: 'X*DX*',
  sim: 'X*SX*',
};

const EMAIL_ALLOWED_CHARS = new Set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-@'.split(''));
const PASSWORD_ALLOWED_CHARS = new Set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&*+=?'.split(''));
const SYMBOLS = new Set('!#$%&*+=?'.split(''));
const FORBIDDEN_PASSWORDS = [
  '123456',
  'qwerty',
  'password',
  'abc123',
  'admin',
  'letmein',
  '111111',
  'contrasena',
];

function isUpper(ch) {
  return ch >= 'A' && ch <= 'Z';
}

function isLower(ch) {
  return ch >= 'a' && ch <= 'z';
}

function isDigit(ch) {
  return ch >= '0' && ch <= '9';
}

function isAlpha(ch) {
  return isUpper(ch) || isLower(ch);
}

function expandPasswordRegexWithAlphabet(regexWithX) {
  return regexWithX.split('X').join('(M|m|D|S)');
}

function classifyEmailChar(ch) {
  if (isAlpha(ch)) return 'L';
  if (isDigit(ch)) return 'D';
  if (ch === '_') return 'U';
  if (ch === '-') return 'G';
  if (ch === '.') return 'P';
  if (ch === '@') return 'A';
  return null;
}

function classifyPasswordChar(ch) {
  if (isUpper(ch)) return 'M';
  if (isLower(ch)) return 'm';
  if (isDigit(ch)) return 'D';
  if (SYMBOLS.has(ch)) return 'S';
  return null;
}

function buildAutomata(regex) {
  const ast = parseRegex(regex);
  const nfa = astToNfa(ast);
  const dfa = nfaToDfa(nfa);
  return { ast, nfa, dfa };
}

function runDfaDetailed(dfa, symbols) {
  let current = dfa.startState;

  for (let i = 0; i < symbols.length; i += 1) {
    const symbol = symbols[i];
    const out = dfa.transitions.get(current);
    if (!out || !out.has(symbol)) {
      return {
        accepted: false,
        endState: current,
        failedAtIndex: i,
        failedSymbol: symbol,
      };
    }
    current = out.get(symbol);
  }

  return {
    accepted: dfa.acceptStates.has(current),
    endState: current,
    failedAtIndex: null,
    failedSymbol: null,
  };
}

function crossProductDfa(dfas) {
  const alphabet = [...dfas[0].alphabet];

  function vecKey(v) {
    return v.join(',');
  }

  const startVec = dfas.map((d) => d.startState);
  const queue = [startVec];
  const map = new Map([[vecKey(startVec), 0]]);
  const vecs = [startVec];
  const transitions = new Map();
  const acceptStates = new Set();

  let i = 0;
  while (i < queue.length) {
    const vec = queue[i];
    const id = map.get(vecKey(vec));

    if (!transitions.has(id)) transitions.set(id, new Map());

    const isAccept = vec.every((state, idxDfa) => dfas[idxDfa].acceptStates.has(state));
    if (isAccept) acceptStates.add(id);

    for (const sym of alphabet) {
      const nextVec = [];
      let blocked = false;

      for (let d = 0; d < dfas.length; d += 1) {
        const out = dfas[d].transitions.get(vec[d]);
        if (!out || !out.has(sym)) {
          blocked = true;
          break;
        }
        nextVec.push(out.get(sym));
      }

      if (blocked) continue;

      const key = vecKey(nextVec);
      if (!map.has(key)) {
        map.set(key, vecs.length);
        vecs.push(nextVec);
        queue.push(nextVec);
      }

      transitions.get(id).set(sym, map.get(key));
    }

    i += 1;
  }

  return {
    startState: 0,
    acceptStates,
    transitions,
    alphabet,
    stateCount: vecs.length,
    stateSets: vecs,
  };
}

export function buildEmailAutomata() {
  return buildAutomata(EMAIL_REGEX_SYMBOLIC);
}

export function buildPasswordAutomata() {
  const factorLong = buildAutomata(expandPasswordRegexWithAlphabet(PASSWORD_FACTOR_REGEX.long));
  const factorMay = buildAutomata(expandPasswordRegexWithAlphabet(PASSWORD_FACTOR_REGEX.may));
  const factorMin = buildAutomata(expandPasswordRegexWithAlphabet(PASSWORD_FACTOR_REGEX.min));
  const factorDig = buildAutomata(expandPasswordRegexWithAlphabet(PASSWORD_FACTOR_REGEX.dig));
  const factorSim = buildAutomata(expandPasswordRegexWithAlphabet(PASSWORD_FACTOR_REGEX.sim));

  const dfa = crossProductDfa([factorLong.dfa, factorMay.dfa, factorMin.dfa, factorDig.dfa, factorSim.dfa]);

  return {
    nfa: factorLong.nfa,
    dfa,
    factors: {
      long: factorLong,
      may: factorMay,
      min: factorMin,
      dig: factorDig,
      sim: factorSim,
    },
  };
}

export function toEmailSymbols(email) {
  const symbols = [];
  for (const ch of email) {
    const cls = classifyEmailChar(ch);
    if (!cls) return null;
    symbols.push(cls);
  }
  return symbols;
}

export function toPasswordSymbols(password) {
  const symbols = [];
  for (const ch of password) {
    const cls = classifyPasswordChar(ch);
    if (!cls) return null;
    symbols.push(cls);
  }
  return symbols;
}

export function validateEmail(email, automata) {
  const errors = [];

  if (email.length > 320) {
    errors.push('E6: Longitud total mayor a 320 caracteres');
  }

  for (const ch of email) {
    if (!EMAIL_ALLOWED_CHARS.has(ch)) {
      errors.push('E1: La parte local o dominio contiene caracteres fuera del alfabeto permitido');
      break;
    }
  }

  const atCount = [...email].filter((c) => c === '@').length;
  if (atCount !== 1) {
    errors.push('E2: Debe existir exactamente una arroba (@)');
  }

  const parts = email.split('@');
  const local = parts[0] || '';
  const domain = parts[1] || '';

  if (local.length > 64) {
    errors.push('E1: La parte local no puede exceder 64 caracteres');
  }

  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
    errors.push('E1: La parte local no permite punto al inicio, al final ni consecutivo');
  }

  if (domain.length > 0) {
    const labels = domain.split('.');

    if (labels.some((label) => label.length === 0)) {
      errors.push('E4: El dominio no permite etiquetas vacías');
    }

    if (labels.length < 2) {
      errors.push('E4: El dominio debe tener al menos una etiqueta antes del TLD');
    }

    const tld = labels[labels.length - 1] || '';
    let tldAllLetters = true;
    for (const c of tld) {
      if (!isAlpha(c)) {
        tldAllLetters = false;
        break;
      }
    }
    if (tld.length < 2 || !tldAllLetters) {
      errors.push('E5: El TLD debe tener solo letras y longitud mínima 2');
    }

    for (const label of labels.slice(0, -1)) {
      let validChars = true;
      for (const c of label) {
        if (!(isAlpha(c) || isDigit(c) || c === '-')) {
          validChars = false;
          break;
        }
      }
      if (label.startsWith('-') || label.endsWith('-') || !validChars) {
        errors.push('E3: Las etiquetas del dominio no pueden iniciar/finalizar con guion y deben ser alfanuméricas con guion');
        break;
      }
    }
  }

  let dfaAccepted = false;
  let dfaTrace = null;
  const symbols = toEmailSymbols(email);
  if (symbols) {
    dfaTrace = runDfaDetailed(automata.dfa, symbols);
    dfaAccepted = dfaTrace.accepted;
  }

  if (!dfaAccepted) {
    const explainedByRules = errors.length > 0;
    if (!explainedByRules) {
      if (!symbols) {
        errors.push('AFD: Rechazo léxico sin transición en posición 1 con símbolo no mapeable');
      } else if (dfaTrace && dfaTrace.failedAtIndex !== null) {
        errors.push(`AFD: Rechazo sin transición en posición ${dfaTrace.failedAtIndex + 1} con símbolo ${dfaTrace.failedSymbol}`);
      } else {
        errors.push('AFD: Rechazo por estado no final al consumir toda la cadena');
      }
    }
  }

  return {
    valid: dfaAccepted && email.length <= 320 && local.length <= 64,
    errors,
  };
}

function hasThreeConsecutiveEqual(password) {
  let count = 1;
  for (let i = 1; i < password.length; i += 1) {
    if (password[i] === password[i - 1]) {
      count += 1;
      if (count >= 3) return true;
    } else {
      count = 1;
    }
  }
  return false;
}

function hasForbiddenSubstring(password) {
  const lower = password.toLowerCase();
  return FORBIDDEN_PASSWORDS.find((bad) => lower.includes(bad)) || null;
}

export function validatePassword(password, automata) {
  const errors = [];

  if (password.length > 64) {
    errors.push('R2: Longitud máxima de 64 excedida');
  }

  for (const ch of password) {
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      errors.push('R8: No se permiten espacios en blanco');
      break;
    }
  }

  for (const ch of password) {
    if (!PASSWORD_ALLOWED_CHARS.has(ch)) {
      errors.push('R3: Hay caracteres fuera del alfabeto permitido');
      break;
    }
  }

  const hasOnlyDigits = password.length > 0 && [...password].every((c) => isDigit(c));
  const hasOnlyLetters = password.length > 0 && [...password].every((c) => isAlpha(c));
  if (hasOnlyDigits || hasOnlyLetters) {
    errors.push('R9: No debe ser puramente numérica ni puramente alfabética');
  }

  if (hasThreeConsecutiveEqual(password)) {
    errors.push('R10: No se permiten 3 caracteres iguales consecutivos');
  }

  const forbidden = hasForbiddenSubstring(password);
  if (forbidden) {
    errors.push(`R11: Contiene cadena prohibida (${forbidden})`);
  }

  let dfaAccepted = false;
  let dfaTrace = null;
  const symbols = toPasswordSymbols(password);

  if (symbols) {
    dfaTrace = runDfaDetailed(automata.dfa, symbols);
    dfaAccepted = dfaTrace.accepted;

    if (automata.factors) {
      const longRun = runDfa(automata.factors.long.dfa, symbols);
      if (!longRun.accepted) {
        errors.push('R1: Longitud mínima de 12 no cumplida');
      }

      const mayRun = runDfa(automata.factors.may.dfa, symbols);
      if (!mayRun.accepted) {
        errors.push('R4: Debe contener al menos una mayúscula');
      }

      const minRun = runDfa(automata.factors.min.dfa, symbols);
      if (!minRun.accepted) {
        errors.push('R5: Debe contener al menos una minúscula');
      }

      const digRun = runDfa(automata.factors.dig.dfa, symbols);
      if (!digRun.accepted) {
        errors.push('R6: Debe contener al menos un dígito');
      }

      const simRun = runDfa(automata.factors.sim.dfa, symbols);
      if (!simRun.accepted) {
        errors.push('R7: Debe contener al menos un símbolo permitido');
      }
    }
  }

  if (!dfaAccepted) {
    const explainedByRules = errors.length > 0;
    if (!explainedByRules) {
      if (!symbols) {
        errors.push('AFD: Rechazo léxico sin transición en posición 1 con símbolo no mapeable');
      } else if (dfaTrace && dfaTrace.failedAtIndex !== null) {
        errors.push(`AFD: Rechazo sin transición en posición ${dfaTrace.failedAtIndex + 1} con símbolo ${dfaTrace.failedSymbol}`);
      } else {
        errors.push('AFD: Rechazo por estado no final al consumir toda la cadena');
      }
    }
  }

  return {
    valid: dfaAccepted && password.length <= 64 && !hasThreeConsecutiveEqual(password) && !hasForbiddenSubstring(password),
    errors,
  };
}

export function buildAllAutomata() {
  const email = buildEmailAutomata();
  const password = buildPasswordAutomata();
  return { email, password };
}
