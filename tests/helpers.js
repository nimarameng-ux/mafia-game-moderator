const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const source = html.replace(/<script src="app\.js\?v=17"><\/script>/, `<script>${app}</script>`);

function createApp(saved, options = {}) {
  const alerts = [];
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(String(error)));
  virtualConsole.on('error', (error) => errors.push(String(error)));
  const dom = new JSDOM(source, {
    url: 'https://example.com/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.alert = (message) => alerts.push(String(message));
      const confirmations = [...(options.confirmations || [])];
      window.confirm = () => confirmations.length ? confirmations.shift() : true;
      if (saved) window.localStorage.setItem('nima_mafia_rev14', JSON.stringify(saved));
    },
  });
  dom.window.addEventListener('error', (event) => errors.push(String(event.error || event.message)));
  return { dom, w: dom.window, alerts, errors };
}

function players() {
  return [
    { id: 'gf', name: 'Gina', role: 'Godfather', alive: true },
    { id: 'lec', name: 'Lee', role: 'Lecter', alive: true },
    { id: 'det', name: 'Dee', role: 'Detective', alive: true },
    { id: 'doc', name: 'Doc', role: 'Doctor', alive: true },
    { id: 'vig', name: 'Vee', role: 'Vigilante', alive: true },
    { id: 'c1', name: 'Cam', role: 'Citizen', alive: true },
    { id: 'c2', name: 'Cory', role: 'Citizen', alive: true },
    { id: 'c3', name: 'Chris', role: 'Citizen', alive: true },
  ];
}

function state(overrides = {}) {
  const roster = overrides.players || players();
  return Object.assign({
    appVersion: 17,
    nightPrivacyVersion: 2,
    currentState: 'DAY.CONVERSATION',
    phase: 'day',
    setupStep: 8,
    day: 1,
    night: 1,
    step: 'talk',
    settings: { start: '19:30', count: roster.length, mafia: 2, actions: 2, selfSaves: 1, lecterSelfShields: 1, gfImmune: true },
    names: roster.map((player) => player.name),
    players: roster,
    seen: roster.map((player) => player.id),
    revealIndex: roster.length,
    talked: [],
    nomination: { results: [], defence: [], speechDone: [], current: '' },
    nightData: { stage: 0, mafiaTarget: '', lecterShield: '', detectiveCheck: '', detectiveResult: '', doctorSave: '', vigilanteTarget: '', fakeRoles: [], privateSummary: '', publicAnnouncement: '', pendingRemoved: [], resolved: false },
    counters: { self: 0, lecterSelf: 0, actions: 0 },
    history: [],
    lastPublic: 'Game has started.',
    logs: [],
    finished: false,
    winner: '',
    reason: '',
    lastSaved: '',
    saveStatus: 'Saved',
    unsafeState: null,
    announcementConfirmed: false,
  }, overrides, { players: roster });
}

function choose(w, id, value) {
  w.document.getElementById(id).value = value;
}

function click(w, text, selector = '#app button:not(:disabled)') {
  const button = [...w.document.querySelectorAll(selector)].find((item) => item.textContent.includes(text));
  if (!button) throw new Error(`Button not found: ${text}\n${w.document.getElementById('app').textContent}`);
  button.click();
}

function savedState(w) {
  return JSON.parse(w.localStorage.getItem('nima_mafia_rev14'));
}

module.exports = { createApp, players, state, choose, click, savedState };
