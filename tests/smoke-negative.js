/*
 * tests/smoke-negative.js
 *
 * Proves startupSelfCheck() actually blocks the app rather than always
 * passing: takes a copy of app.js, deletes the resetGame() function
 * declaration, and asserts the app shows "Startup Check Failed" instead
 * of a broken game.
 *
 * Run with:  npm install && npm run test:smoke-negative
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let appJs = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

const before = appJs.length;
appJs = appJs.replace(
  /\/\*CANONICAL: the only reset path in the served app\*\/function resetGame\(\)\{[^}]*\}/,
  ''
);
if (appJs.length === before) {
  console.log('FAIL - sabotage step did not actually remove resetGame() from app.js — this test is not valid, check the regex against the current file');
  process.exit(1);
}

const htmlWithInlinedScript = html.replace(
  /<script src="app\.js\?v=16"><\/script>/,
  `<script>${appJs}</script>`
);

const errors = [];
const dom = new JSDOM(htmlWithInlinedScript, {
  url: 'https://example.com/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
});
const w = dom.window;
w.onerror = (msg) => errors.push(String(msg));

function assert(cond, label) {
  console.log((cond ? 'PASS - ' : 'FAIL - ') + label);
  if (!cond) errors.push(label);
}

assert(typeof w.resetGame === 'undefined', 'sabotage confirmed: resetGame() is genuinely undefined in this copy');
assert(
  w.document.getElementById('app').innerHTML.includes('Startup Check Failed'),
  'self-check blocks startup and shows an error screen instead of a broken game'
);
assert(
  w.document.getElementById('app').innerHTML.includes('resetGame'),
  'error screen names the specific missing function (resetGame)'
);
assert(
  !w.document.getElementById('app').innerHTML.includes('Setup 1/8'),
  'the broken Setup screen is NOT shown when a required function is missing'
);

console.log('\n=== SUMMARY ===');
console.log(errors.length === 0 ? 'SELF-CHECK CORRECTLY CAUGHT THE MISSING FUNCTION' : `${errors.length} FAILURE(S)`);
process.exit(errors.length === 0 ? 0 : 1);
