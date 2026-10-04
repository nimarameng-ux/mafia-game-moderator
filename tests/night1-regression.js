const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const source = html.replace(/<script src="app\.js\?v=17"><\/script>/, `<script>${app}</script>`);
const runtimeErrors = [];
const dom = new JSDOM(source, {
  url: 'https://example.com/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.alert = () => {};
    window.confirm = () => true;
  },
});
const w = dom.window;
w.addEventListener('error', (event) => runtimeErrors.push(String(event.error || event.message)));

function click(text) {
  const button = [...w.document.querySelectorAll('#app button:not(:disabled)')].find((item) => item.textContent.includes(text));
  if (!button) throw new Error(`Button not found: ${text}\n${w.document.getElementById('app').textContent}`);
  button.click();
}

function setValue(value) {
  w.document.getElementById('v').value = value;
}

setValue('19:30'); click('Confirm & Next');
setValue('8'); click('Confirm & Next');
setValue('2'); click('Confirm & Next');
setValue('2'); click('Confirm & Next');
setValue('1'); click('Confirm & Next');
setValue('1'); click('Confirm & Next');
click('YES');
setValue('Alex\nBailey\nCasey\nDrew\nEmerson\nFrankie\nGray\nHarper'); click('Confirm Names');
click('Confirm Allocation, Shuffle & Reveal');

for (let i = 0; i < 8; i += 1) {
  click('Pass Phone');
  w.document.querySelector('#passView button').click();
  w.document.querySelector('#roleView button').click();
}

click('Begin Day 1 Conversation');

while ([...w.document.querySelectorAll('#app button:not(:disabled)')].some((button) => button.textContent.includes('Mark Spoke'))) {
  click('Mark Spoke');
}
click('Move to Night 1');
click('Announced & Confirmed');

const screen = w.document.getElementById('app').textContent;
if (!screen.includes('Mafia Wakes')) {
  console.error('FAIL - Night 1 skipped the Mafia wake/identification state and transitioned directly to the stale selection flow.');
  console.error(screen.replace(/\s+/g, ' ').trim());
  process.exit(1);
}
if (runtimeErrors.length) {
  console.error('FAIL - runtime errors:', runtimeErrors);
  process.exit(1);
}
console.log('PASS - Night 1 enters the canonical Mafia wake/identification state after everyone sleeps.');
