import { dfaToTransitionRows } from './dfa.js';
import { nfaToTransitionRows } from './thompson.js';
import {
  buildAllAutomata,
  validateEmail,
  validatePassword,
} from './validator.js';
import {
  generateValidEmail,
  generateValidPassword,
  generateValidPair,
} from './generator.js';
import { passwordStrength } from './strength.js';

const automata = buildAllAutomata();

function setupTabs() {
  const buttons = [...document.querySelectorAll('.tab-button')];
  const panels = [...document.querySelectorAll('.tab-panel')];

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      panels.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const panel = document.getElementById(`tab-${btn.dataset.tab}`);
      if (panel) panel.classList.add('active');
    });
  });
}

function renderTable(containerId, rows, columns) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = '<p>Sin transiciones.</p>';
    return;
  }

  let html = '<table><thead><tr>';
  for (const col of columns) {
    html += `<th>${col}</th>`;
  }
  html += '</tr></thead><tbody>';

  for (const row of rows) {
    html += '<tr>';
    for (const col of columns) {
      html += `<td>${row[col]}</td>`;
    }
    html += '</tr>';
  }

  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderDfaSvg(containerId, dfa) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const nodeRadius = 18;
  const gapX = 110;
  const baseY = 80;
  const width = Math.max(620, dfa.stateCount * gapX + 80);
  const height = 220;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  svg += '<defs><marker id="arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 z" fill="#333"/></marker></defs>';

  const positions = [];
  for (let i = 0; i < dfa.stateCount; i += 1) {
    const x = 50 + i * gapX;
    positions.push({ x, y: baseY });
  }

  for (let from = 0; from < dfa.stateCount; from += 1) {
    const out = dfa.transitions.get(from) || new Map();
    for (const [sym, to] of out.entries()) {
      const a = positions[from];
      const b = positions[to];

      if (from === to) {
        const loopX = a.x;
        const loopY = a.y - 32;
        svg += `<path d="M ${loopX - 10} ${loopY} C ${loopX - 28} ${loopY - 30}, ${loopX + 28} ${loopY - 30}, ${loopX + 10} ${loopY}" fill="none" stroke="#444" stroke-width="1.4" marker-end="url(#arrow)"/>`;
        svg += `<text x="${loopX}" y="${loopY - 34}" font-size="11" text-anchor="middle" fill="#333">${sym}</text>`;
      } else {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const x1 = a.x + ux * nodeRadius;
        const y1 = a.y + uy * nodeRadius;
        const x2 = b.x - ux * nodeRadius;
        const y2 = b.y - uy * nodeRadius;

        svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#444" stroke-width="1.4" marker-end="url(#arrow)"/>`;
        const labelX = (x1 + x2) / 2;
        const labelY = (y1 + y2) / 2 - 6;
        svg += `<text x="${labelX}" y="${labelY}" font-size="11" text-anchor="middle" fill="#333">${sym}</text>`;
      }
    }
  }

  for (let i = 0; i < dfa.stateCount; i += 1) {
    const { x, y } = positions[i];
    const isAccept = dfa.acceptStates.has(i);

    svg += `<circle cx="${x}" cy="${y}" r="${nodeRadius}" fill="#fff" stroke="#1f5f4a" stroke-width="2"/>`;
    if (isAccept) {
      svg += `<circle cx="${x}" cy="${y}" r="${nodeRadius - 4}" fill="none" stroke="#1f5f4a" stroke-width="1.4"/>`;
    }
    svg += `<text x="${x}" y="${y + 4}" font-size="12" text-anchor="middle" fill="#222">q${i}</text>`;

    if (i === dfa.startState) {
      svg += `<line x1="${x - 44}" y1="${y}" x2="${x - nodeRadius}" y2="${y}" stroke="#9f2d23" stroke-width="1.6" marker-end="url(#arrow)"/>`;
    }
  }

  svg += '</svg>';
  container.innerHTML = svg;
}

function setupValidation() {
  const btn = document.getElementById('validate-btn');
  const output = document.getElementById('validation-result');
  const emailInput = document.getElementById('email-input');
  const passInput = document.getElementById('password-input');

  btn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passInput.value;

    const emailResult = validateEmail(email, automata.email);
    const passResult = validatePassword(password, automata.password);
    const level = passwordStrength(password, passResult);

    const lines = [];
    lines.push(`Correo: ${emailResult.valid ? 'VÁLIDO' : 'INVÁLIDO'}`);
    if (!emailResult.valid) {
      for (const e of emailResult.errors) lines.push(`  - ${e}`);
    }

    lines.push(`Contraseña: ${passResult.valid ? 'VÁLIDA' : 'INVÁLIDA'}`);
    if (!passResult.valid) {
      for (const e of passResult.errors) lines.push(`  - ${e}`);
    }

    lines.push(`Nivel de seguridad: ${level.toUpperCase()}`);
    output.textContent = lines.join('\n');
  });
}

function setupGeneration() {
  const out = document.getElementById('generation-result');

  document.getElementById('generate-email-btn').addEventListener('click', () => {
    try {
      out.textContent = `Correo generado:\n${generateValidEmail(automata)}`;
    } catch (err) {
      out.textContent = `Error al generar correo: ${err.message}`;
    }
  });

  document.getElementById('generate-password-btn').addEventListener('click', () => {
    try {
      const p = generateValidPassword(automata);
      const val = validatePassword(p, automata.password);
      out.textContent = `Contraseña generada:\n${p}\nNivel: ${passwordStrength(p, val).toUpperCase()}`;
    } catch (err) {
      out.textContent = `Error al generar contraseña: ${err.message}`;
    }
  });

  document.getElementById('generate-pair-btn').addEventListener('click', () => {
    try {
      const pair = generateValidPair(automata);
      out.textContent = `Par generado:\nCorreo: ${pair.email}\nContraseña: ${pair.password}`;
    } catch (err) {
      out.textContent = `Error al generar par: ${err.message}`;
    }
  });
}

function setupAutomataViews() {
  renderTable('nfa-email-table', nfaToTransitionRows(automata.email.nfa), ['from', 'symbol', 'to']);
  renderTable('dfa-email-table', dfaToTransitionRows(automata.email.dfa), ['from', 'symbol', 'to']);
  renderDfaSvg('dfa-email-svg', automata.email.dfa);

  renderTable('nfa-password-table', nfaToTransitionRows(automata.password.nfa), ['from', 'symbol', 'to']);
  renderTable('dfa-password-table', dfaToTransitionRows(automata.password.dfa), ['from', 'symbol', 'to']);
  renderDfaSvg('dfa-password-svg', automata.password.dfa);

  renderTable('nfa-password-long-table', nfaToTransitionRows(automata.password.factors.long.nfa), ['from', 'symbol', 'to']);
  renderTable('dfa-password-long-table', dfaToTransitionRows(automata.password.factors.long.dfa), ['from', 'symbol', 'to']);

  renderTable('nfa-password-may-table', nfaToTransitionRows(automata.password.factors.may.nfa), ['from', 'symbol', 'to']);
  renderTable('dfa-password-may-table', dfaToTransitionRows(automata.password.factors.may.dfa), ['from', 'symbol', 'to']);

  renderTable('nfa-password-min-table', nfaToTransitionRows(automata.password.factors.min.nfa), ['from', 'symbol', 'to']);
  renderTable('dfa-password-min-table', dfaToTransitionRows(automata.password.factors.min.dfa), ['from', 'symbol', 'to']);

  renderTable('nfa-password-dig-table', nfaToTransitionRows(automata.password.factors.dig.nfa), ['from', 'symbol', 'to']);
  renderTable('dfa-password-dig-table', dfaToTransitionRows(automata.password.factors.dig.dfa), ['from', 'symbol', 'to']);

  renderTable('nfa-password-sim-table', nfaToTransitionRows(automata.password.factors.sim.nfa), ['from', 'symbol', 'to']);
  renderTable('dfa-password-sim-table', dfaToTransitionRows(automata.password.factors.sim.dfa), ['from', 'symbol', 'to']);
}

function setupCases() {
  const btn = document.getElementById('run-cases-btn');
  const output = document.getElementById('cases-result');

  btn.addEventListener('click', () => {
    const lines = [];
    lines.push('10 pares válidos generados:');
    for (let i = 0; i < 10; i += 1) {
      const pair = generateValidPair(automata);
      lines.push(`${i + 1}. ${pair.email} | ${pair.password}`);
    }

    const invalids = [
      { email: 'ana.perez@umg.edu.gt', pass: 'Corto1$a', why: 'longitud' },
      { email: 'ana.perez@umg.edu.gt', pass: 'Guate2026Segura', why: 'falta símbolo' },
      { email: 'ana.perez@umg.edu.gt', pass: 'guate2026$segura', why: 'falta mayúscula' },
      { email: 'ana.perez@umg.edu.gt', pass: 'GUATE2026$SEGURA', why: 'falta minúscula' },
      { email: 'ana.perez@umg.edu.gt', pass: 'Aaaabbbccc1$', why: 'repetición consecutiva' },
      { email: 'ana.perez@umg.edu.gt', pass: 'Guate123456$Aa', why: 'cadena prohibida' },
      { email: '.ana@umg.edu', pass: 'Guate2026$Segura', why: 'correo inválido local' },
      { email: 'ana@@umg.edu', pass: 'Guate2026$Segura', why: 'doble arroba' },
      { email: 'ana@umg..edu', pass: 'Guate2026$Segura', why: 'dominio con etiqueta vacía' },
      { email: 'ana@umg.e', pass: 'Guate2026$Segura', why: 'TLD corto' },
    ];

    lines.push('\n10 pares inválidos esperados:');
    invalids.forEach((c, idx) => {
      const ev = validateEmail(c.email, automata.email);
      const pv = validatePassword(c.pass, automata.password);
      const ok = !ev.valid || !pv.valid;
      lines.push(`${idx + 1}. ${c.why}: ${ok ? 'RECHAZADO' : 'NO RECHAZADO'}`);
    });

    output.textContent = lines.join('\n');
  });
}

function init() {
  setupTabs();
  setupValidation();
  setupGeneration();
  setupAutomataViews();
  setupCases();
}

init();
