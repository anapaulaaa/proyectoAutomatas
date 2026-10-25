// Parser de expresiones regulares para construir un AST.
// Soporta: union (|), concatenacion implicita, cerradura de Kleene (*), y parentesis.

export function tokenize(regex) {
  const tokens = [];
  for (let i = 0; i < regex.length; i += 1) {
    const ch = regex[i];
    if (ch === ' ' || ch === '\n' || ch === '\t') {
      continue;
    }
    if (ch === '(' || ch === ')' || ch === '|' || ch === '*' || ch === '+') {
      tokens.push({ type: ch, value: ch });
    } else {
      tokens.push({ type: 'SYMBOL', value: ch });
    }
  }
  return insertConcatenation(tokens);
}

function insertConcatenation(tokens) {
  const result = [];

  function isLeft(t) {
    return t.type === 'SYMBOL' || t.type === ')' || t.type === '*' || t.type === '+';
  }

  function isRight(t) {
    return t.type === 'SYMBOL' || t.type === '(';
  }

  for (let i = 0; i < tokens.length; i += 1) {
    const cur = tokens[i];
    result.push(cur);

    if (i < tokens.length - 1) {
      const next = tokens[i + 1];
      if (isLeft(cur) && isRight(next)) {
        result.push({ type: '.', value: '.' });
      }
    }
  }
  return result;
}

export function toPostfix(tokens) {
  const output = [];
  const stack = [];
  const prec = {
    '|': 1,
    '.': 2,
    '*': 3,
    '+': 3,
  };

  for (const token of tokens) {
    if (token.type === 'SYMBOL') {
      output.push(token);
      continue;
    }

    if (token.type === '(') {
      stack.push(token);
      continue;
    }

    if (token.type === ')') {
      while (stack.length && stack[stack.length - 1].type !== '(') {
        output.push(stack.pop());
      }
      if (!stack.length) {
        throw new Error('Parentesis desbalanceados: falta (');
      }
      stack.pop();
      continue;
    }

    if (token.type === '*' || token.type === '+') {
      while (stack.length && prec[stack[stack.length - 1].type] > prec[token.type]) {
        output.push(stack.pop());
      }
      stack.push(token);
      continue;
    }

    if (token.type === '|' || token.type === '.') {
      while (
        stack.length &&
        stack[stack.length - 1].type !== '(' &&
        prec[stack[stack.length - 1].type] >= prec[token.type]
      ) {
        output.push(stack.pop());
      }
      stack.push(token);
      continue;
    }

    throw new Error(`Token no soportado: ${token.type}`);
  }

  while (stack.length) {
    const top = stack.pop();
    if (top.type === '(' || top.type === ')') {
      throw new Error('Parentesis desbalanceados: falta )');
    }
    output.push(top);
  }

  return output;
}

export function postfixToAst(postfix) {
  const stack = [];

  for (const token of postfix) {
    if (token.type === 'SYMBOL') {
      stack.push({ type: 'symbol', value: token.value });
      continue;
    }

    if (token.type === '*' || token.type === '+') {
      if (!stack.length) {
        throw new Error(`Error en ${token.type}: operando faltante`);
      }
      const expr = stack.pop();
      stack.push({ type: token.type === '*' ? 'star' : 'plus', expr });
      continue;
    }

    if (token.type === '.' || token.type === '|') {
      if (stack.length < 2) {
        throw new Error(`Error en ${token.type}: operandos faltantes`);
      }
      const right = stack.pop();
      const left = stack.pop();
      stack.push({
        type: token.type === '.' ? 'concat' : 'union',
        left,
        right,
      });
      continue;
    }

    throw new Error(`Operador no soportado en AST: ${token.type}`);
  }

  if (stack.length !== 1) {
    throw new Error('Expresion invalida: AST incompleto');
  }

  return stack[0];
}

export function parseRegex(regex) {
  const tokens = tokenize(regex);
  const postfix = toPostfix(tokens);
  return postfixToAst(postfix);
}
