/*
 * tests/smoke.js
 *
 * Automated smoke test for app.js. Loads the real index.html + app.js
 * through jsdom (with runScripts: 'dangerously' so inline onclick="..."
 * handlers behave exactly as they do in a real browser), drives the
 * actual UI the way a person would (typing into inputs, clicking real
 * buttons), and asserts on the resulting DOM + localStorage — not on
 * internals.
 *
 * Run with:  npm install && npm run test:smoke
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

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

assert(typeof w.render === 'function', 'render() defined');
assert(typeof w.day === 'function', 'day() defined');
assert(typeof w.night === 'function', 'night() defined');
assert(typeof w.menu === 'function', 'menu() defined');
assert(typeof w.health === 'function', 'health() defined');
assert(typeof w.resetGame === 'function', 'resetGame() defined');
assert(typeof w.setup === 'function', 'setup() defined');
assert(typeof w.boot === 'function', 'boot() defined');

assert(w.document.getElementById('app').innerHTML.length > 0, '#app was rendered by boot() on load');
assert(w.document.getElementById('app').innerHTML.includes('Setup 1/8'), 'fresh load shows Setup 1/8');

const creditText = w.document.querySelector('.credit').textContent;
assert(creditText.includes('Rev16'), 'credit line shows a Rev16 build identifier: "' + creditText + '"');

w.menu();
assert(w.document.getElementById('app').innerHTML.includes('Menu'), 'menu() renders a Menu screen');

w.health();
assert(w.document.getElementById('app').innerHTML.includes('Health Check'), 'health() renders a Health Check screen');

w.menu();
const menuHealthBtn = Array.from(w.document.querySelectorAll('#app button')).find((b) => b.textContent.includes('Health Check'));
assert(!!menuHealthBtn, 'Menu screen includes a Health Check shortcut button');
menuHealthBtn.click();
assert(w.document.getElementById('app').innerHTML.includes('Health Check'), 'clicking the Menu shortcut reaches the Health Check screen');

w.render();
assert(w.document.getElementById('app').innerHTML.includes('Setup 1/8'), 'render() returns to Setup after menu/health detour');

const timeInput = w.document.getElementById('v');
assert(!!timeInput, 'Setup 1/8 renders a time input with id="v"');
timeInput.value = '19:30';
const confirmBtn = w.document.querySelector('#app .actions button');
assert(!!confirmBtn, 'Setup 1/8 renders a Confirm & Next button');
confirmBtn.click();
assert(w.document.getElementById('app').innerHTML.includes('Setup 2/8'), 'clicking Confirm & Next advances to Setup 2/8');

const raw = w.localStorage.getItem('nima_mafia_rev14');
assert(!!raw, 'save() wrote to the SAME localStorage key used before this PR (nima_mafia_rev14)');
const parsed = JSON.parse(raw);
assert(parsed.settings && parsed.settings.start === '19:30', 'the confirmed start time round-trips correctly through localStorage');
assert(parsed.setupStep === 1, 'setupStep advanced and persisted correctly');
assert(parsed.appVersion === 16, 'saved state is stamped with appVersion 16');

console.log('\n--- window.onerror captured messages ---');
console.log(errors.length ? errors : '(none)');
console.log('\n=== SUMMARY ===');
console.log(errors.length === 0 ? 'ALL CHECKS PASSED, NO ERRORS' : `${errors.length} FAILURE(S)/ERROR(S)`);
process.exit(errors.length === 0 ? 0 : 1);
