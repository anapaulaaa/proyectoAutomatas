import {
  buildAllAutomata,
  validateEmail,
  validatePassword,
} from '../src/validator.js';
import {
  generateValidEmail,
  generateValidPassword,
  generateValidPair,
} from '../src/generator.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const automata = buildAllAutomata();

function makeAcceptAllDfa(alphabet) {
  const transitions = new Map();
  const out = new Map();
  for (const sym of alphabet) {
    out.set(sym, 0);
  }
  transitions.set(0, out);
  return {
    startState: 0,
    acceptStates: new Set([0]),
    transitions,
    alphabet: [...alphabet],
    stateCount: 1,
  };
}

function fixedCases() {
  const emailValid = validateEmail('ana.perez@umg.edu.gt', automata.email);
  assert(emailValid.valid, 'ana.perez@umg.edu.gt debe ser valido');

  const emailInv1 = validateEmail('.ana@umg.edu', automata.email);
  assert(!emailInv1.valid, '.ana@umg.edu debe ser invalido');

  const emailInv2 = validateEmail('ana@@umg.edu', automata.email);
  assert(!emailInv2.valid, 'ana@@umg.edu debe ser invalido');

  const emailInv3 = validateEmail('ana@umg..edu', automata.email);
  assert(!emailInv3.valid, 'ana@umg..edu debe ser invalido');

  const emailInv4 = validateEmail('ana@umg.e', automata.email);
  assert(!emailInv4.valid, 'ana@umg.e debe ser invalido');

  for (const email of ['-ana@umg.edu', 'ana-@umg.edu', 'aaaa@umg.edu', 'ana@bbbb.edu', 'aAaA@umg.edu']) {
    assert(!validateEmail(email, automata.email).valid, `${email} debe ser invalido`);
  }
  assert(validateEmail('aaa@umg.edu', automata.email).valid, '3 letras iguales deben permitirse');

  const passValid = validatePassword('Guate2026$Segura', automata.password);
  assert(passValid.valid, 'Guate2026$Segura debe ser valida');

  const passInv1 = validatePassword('Corto1$a', automata.password);
  assert(!passInv1.valid, 'Corto1$a debe ser invalida');

  const passInv2 = validatePassword('12345678', automata.password);
  assert(!passInv2.valid, '12345678 debe ser invalida');

  const passInv3 = validatePassword('Guate 2026$Seg', automata.password);
  assert(!passInv3.valid, 'Guate 2026$Seg debe ser invalida');
}

function emailBoundaryLengthCases() {
  const local64 = 'abc'.repeat(21) + 'a';
  const local65 = 'abc'.repeat(21) + 'ab';

  const domain255 = [
    'abc'.repeat(21),
    'bcd'.repeat(21),
    'cde'.repeat(21),
    'def'.repeat(21),
  ].join('.');

  const domain256 = [
    'abc'.repeat(21),
    'bcd'.repeat(21),
    'cde'.repeat(21),
    'def'.repeat(21) + 'd',
  ].join('.');

  const email320 = `${local64}@${domain255}`;
  const email321 = `${local64}@${domain256}`;
  const emailLocal65 = `${local65}@umg.edu.gt`;

  assert(email320.length === 320, `El correo de 320 no tiene 320 caracteres: ${email320.length}`);
  assert(email321.length >= 321, `El correo largo no alcanza 321 caracteres: ${email321.length}`);

  const v320 = validateEmail(email320, automata.email);
  assert(v320.valid, 'Un correo sintacticamente correcto de exactamente 320 debe ser valido');

  const v321 = validateEmail(email321, automata.email);
  assert(!v321.valid, 'Un correo sintacticamente correcto de 321 o mas debe ser invalido');
  assert(v321.errors.some((e) => e.startsWith('E6:')), 'El correo de 321 o mas debe reportar E6');

  const vLocal65 = validateEmail(emailLocal65, automata.email);
  assert(!vLocal65.valid, 'Un correo con parte local de 65 debe ser invalido');
  assert(vLocal65.errors.some((e) => e.includes('64 caracteres')), 'Debe reportar error por parte local mayor a 64');
}

function randomGenerationCases() {
  for (let i = 0; i < 1000; i += 1) {
    const email = generateValidEmail(automata);
    const password = generateValidPassword(automata);
    const pair = generateValidPair(automata);

    const ev1 = validateEmail(email, automata.email);
    const pv1 = validatePassword(password, automata.password);
    const ev2 = validateEmail(pair.email, automata.email);
    const pv2 = validatePassword(pair.password, automata.password);

    assert(ev1.valid, `Email generado invalido en iteracion ${i + 1}: ${email}`);
    assert(pv1.valid, `Password generada invalida en iteracion ${i + 1}: ${password}`);
    assert(ev2.valid, `Email del par invalido en iteracion ${i + 1}: ${pair.email}`);
    assert(pv2.valid, `Password del par invalida en iteracion ${i + 1}: ${pair.password}`);
  }
}

function emailWeightingCases() {
  let localLetters = 0;
  let localDigits = 0;
  let localSpecial = 0;

  for (let i = 0; i < 300; i += 1) {
    const email = generateValidEmail(automata);
    const parts = email.split('@');
    const local = parts[0] || '';

    for (const ch of local) {
      if (ch >= 'a' && ch <= 'z') {
        localLetters += 1;
      } else if (ch >= '0' && ch <= '9') {
        localDigits += 1;
      } else {
        localSpecial += 1;
      }
    }
  }

  const total = localLetters + localDigits + localSpecial;
  const ratioLetters = total > 0 ? localLetters / total : 0;

  // Con ponderacion L=0.75 y resto menor, la proporcion de letras debe dominar.
  assert(ratioLetters > 0.58, `La proporcion de letras en local no refleja ponderacion esperada: ${ratioLetters}`);
}

function afdDecidesCases() {
  const sample = 'SoloLetrasABC';

  const normal = validatePassword(sample, automata.password);
  assert(!normal.valid, 'Con AFD real, SoloLetrasABC debe ser invalida');

  const all = makeAcceptAllDfa(['M', 'm', 'D', 'S']);
  const modifiedAutomata = {
    ...automata.password,
    dfa: all,
    factors: {
      long: { ...automata.password.factors.long, dfa: all },
      may: { ...automata.password.factors.may, dfa: all },
      min: { ...automata.password.factors.min, dfa: all },
      dig: { ...automata.password.factors.dig, dfa: all },
      sim: { ...automata.password.factors.sim, dfa: all },
    },
  };

  const modified = validatePassword(sample, modifiedAutomata);
  assert(modified.valid, 'Con AFD acepta-todo, el veredicto debe cambiar a valido');
}

function run() {
  console.log('Iniciando pruebas...');
  fixedCases();
  console.log('Casos fijos: OK');
  emailBoundaryLengthCases();
  console.log('Limites de correo: OK');
  afdDecidesCases();
  console.log('Caso AFD decide: OK');
  emailWeightingCases();
  console.log('Ponderacion de correo: OK');
  randomGenerationCases();
  console.log('1000 generaciones: OK');
  console.log('Todas las pruebas pasaron.');
}

run();
