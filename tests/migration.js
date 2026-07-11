/*
 * tests/migration.js
 *
 * Proves that a save written by the app BEFORE this PR (no appVersion
 * field, otherwise identical shape) still loads correctly after this
 * PR's changes, with no data loss, and gets non-destructively stamped
 * with appVersion:16 going forward.
 *
 * Run with:  npm install && npm run test:migration
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

const preExistingSave = {
  phase: 'day',
  setupStep: 8,
  day: 2,
  night: 1,
  step: 'talk',
  settings: { start: '18:00', count: 6, mafia: 2, actions: 1, selfSaves: 1, gfImmune: true },
  names: ['Alex', 'Bailey', 'Casey', 'Drew', 'Emerson', 'Frankie'],
  players: [
    { id: 'p1', name: 'Alex', role: 'Godfather', alive: true },
    { id: 'p2', name: 'Bailey', role: 'Mafia', alive: true },
    { id: 'p3', name: 'Casey', role: 'Detective', alive: true },
    { id: 'p4', name: 'Drew', role: 'Doctor', alive: true },
    { id: 'p5', name: 'Emerson', role: 'Vigilante', alive: false },
    { id: 'p6', name: 'Frankie', role: 'Citizen', alive: true },
  ],
  seen: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'],
  revealIndex: 6,
  talked: ['p1', 'p2'],
  nightData: { stage: 0 },
  counters: { self: 0, actions: 0 },
  lastPublic: 'Emerson left the game overnight.',
  logs: [{ t: '18:05', tag: 'Night Result', text: 'Emerson left the game overnight.' }],
  finished: false,
  winner: '',
  reason: '',
  lastSaved: '2026-07-01T08:00:00.000Z',
};

const htmlWithInlinedScript = html.replace(
  /<script src="app\.js\?v=16"><\/script>/,
  `<script>${appJs}</script>`
);

const errors = [];
function assert(cond, label) {
  console.log((cond ? 'PASS - ' : 'FAIL - ') + label);
  if (!cond) errors.push(label);
}

const { JSDOM: JSDOM2 } = require('jsdom');
const dom = new JSDOM2(htmlWithInlinedScript, {
  url: 'https://example.com/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.localStorage.setItem('nima_mafia_rev14', JSON.stringify(preExistingSave));
  },
});
const w = dom.window;
w.onerror = (msg) => errors.push(String(msg));

assert(
  w.document.getElementById('app').innerHTML.includes('Day 2'),
  'pre-existing mid-game save resumes directly on Day 2 (not reset to Setup)'
);
assert(
  !w.document.getElementById('app').innerHTML.includes('Setup 1/8'),
  'pre-existing save is NOT silently wiped back to a fresh Setup screen'
);

const rawAfter = w.localStorage.getItem('nima_mafia_rev14');
const parsedAfter = JSON.parse(rawAfter);
assert(parsedAfter.appVersion === 16, 'save is non-destructively stamped with appVersion:16 on next write');
assert(parsedAfter.day === 2, 'day counter preserved through migration');
assert(parsedAfter.players.length === 6, 'all 6 players preserved through migration');
assert(parsedAfter.players.find((p) => p.id === 'p5').alive === false, "Emerson's death is preserved through migration");
assert(parsedAfter.logs.length === 1, 'existing game log entries preserved through migration');

console.log('\n=== SUMMARY ===');
console.log(errors.length === 0 ? 'PRE-EXISTING SAVE MIGRATED SAFELY, NO DATA LOSS' : `${errors.length} FAILURE(S)`);
process.exit(errors.length === 0 ? 0 : 1);
