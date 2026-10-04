/* Mafia Game Moderator — Rev 17 canonical game engine. */
const SAVE = 'nima_mafia_rev14';
const OLD = 'nima_mafia_rev13';
const BUILD_ID = 'Rev17.0 · Full Game Engine';
const ROLES = {
  Godfather: { name: 'Godfather', team: 'Mafia', description: 'You lead the Mafia team. Each night, work with the other Mafia members to select one Citizen-side player. If the Detective investigates you, you appear innocent. Depending on the setup agreement, you may also be protected from Vigilante / Sniper shots. Goal: eliminate Citizens until living Mafia equal or outnumber living Citizens.' },
  Lecter: { name: 'Dr. Lecter', team: 'Mafia', description: 'You are the Mafia’s protector. Each night, shield one living Mafia-side player from the Vigilante / Sniper. You may shield yourself only as many times as agreed during setup. Goal: help the Mafia survive and reach equal numbers with the Citizens.' },
  Mafia: { name: 'Mafia', team: 'Mafia', description: 'You know the other Mafia members. Each night, work together to select one living Citizen-side player for elimination. During the day, hide your identity, participate in discussion and influence the vote. Goal: eliminate Citizens until living Mafia equal or outnumber living Citizens.' },
  Detective: { name: 'Detective', team: 'Citizen', description: 'Each night, investigate one living player. You privately receive YES — appears Mafia or NO — does not appear Mafia. The Godfather appears innocent, so investigating the Godfather returns NO. Goal: identify Mafia members and help the Citizens remove them without revealing yourself too early.' },
  Doctor: { name: 'Citizen Doctor', team: 'Citizen', description: 'Each night, protect one living player from the Mafia’s attack. You must choose someone every night while alive. You may protect yourself only as many times as agreed during setup. Your protection stops the Mafia attack, but not a Vigilante / Sniper consequence. Goal: keep Citizen-side players alive and help eliminate every Mafia member.' },
  Vigilante: { name: 'Vigilante / Sniper', team: 'Citizen', description: 'At night, you may shoot one other living player or choose Pass. Your total number of shots is limited by the setup agreement. If you shoot an unprotected Mafia member, that player is eliminated. If you shoot a Citizen-side player, they survive and you are eliminated instead. Dr. Lecter’s shield—and optionally the Godfather’s shield—can block your shot. Goal: carefully eliminate Mafia members without harming the Citizen team.' },
  Citizen: { name: 'Citizen', team: 'Citizen', description: 'You have no private night action. During the day, listen carefully, discuss suspicions, nominate players and vote. Your information, reasoning and vote are your main abilities. Goal: work with the Citizen team to identify and eliminate every Mafia member.' },
};
const SETUP_STATES = ['SETUP.START_TIME', 'SETUP.PLAYER_COUNT', 'SETUP.MAFIA_COUNT', 'SETUP.VIGILANTE_LIMIT', 'SETUP.DOCTOR_SELF_SAVE', 'SETUP.LECTER_SELF_SHIELD', 'SETUP.GODFATHER_SHIELD', 'SETUP.PLAYER_NAMES', 'SETUP.ROLE_PREVIEW'];
const NIGHT_STEPS = [
  'NIGHT.EVERYONE_SLEEP', 'NIGHT.MAFIA_WAKE', 'NIGHT.MAFIA_IDENTIFY', 'NIGHT.MAFIA_SELECT',
  'NIGHT.LECTER', 'NIGHT.MAFIA_SLEEP',
  'NIGHT.DETECTIVE_PROMPT', 'NIGHT.DETECTIVE_SELECT', 'NIGHT.DETECTIVE_SLEEP',
  'NIGHT.DOCTOR_PROMPT', 'NIGHT.DOCTOR_SELECT', 'NIGHT.DOCTOR_SLEEP',
  'NIGHT.VIGILANTE_PROMPT', 'NIGHT.VIGILANTE_SELECT', 'NIGHT.VIGILANTE_SLEEP',
  'NIGHT.RESOLVE', 'NIGHT.PRIVATE_SUMMARY',
];
const $ = (id) => document.getElementById(id);

function nightDefaults() {
  return { stage: 0, mafiaTarget: '', lecterShield: '', detectiveCheck: '', detectiveResult: '', doctorSave: '', vigilanteTarget: '', fakeRoles: [], privateSummary: '', publicAnnouncement: '', pendingRemoved: [], resolved: false };
}

function nominationDefaults() {
  return { results: [], defence: [], speechDone: [], current: '', finalVotes: null, resultText: '', removedId: '' };
}

function fresh() {
  return {
    appVersion: 17,
    nightPrivacyVersion: 2,
    currentState: 'SETUP.START_TIME',
    phase: 'setup',
    setupStep: 0,
    day: 1,
    night: 1,
    step: 'setup',
    settings: { start: '', count: 8, mafia: 2, actions: 1, selfSaves: 1, lecterSelfShields: 1, gfImmune: true },
    names: [],
    players: [],
    seen: [],
    revealIndex: 0,
    talked: [],
    nomination: nominationDefaults(),
    nightData: nightDefaults(),
    counters: { self: 0, lecterSelf: 0, actions: 0 },
    history: [],
    lastPublic: 'Game has not started yet.',
    logs: [],
    finished: false,
    winner: '',
    reason: '',
    lastSaved: '',
    saveStatus: 'Saved',
    unsafeState: null,
    announcementConfirmed: false,
  };
}

let S = fresh();
let activeReveal = '';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalize(raw) {
  const defaults = fresh();
  const state = Object.assign({}, defaults, raw || {});
  const oldNightPrivacy = raw && Number(raw.nightPrivacyVersion || 0) < 2;
  state.appVersion = 17;
  state.settings = Object.assign({}, defaults.settings, raw && raw.settings || {});
  state.counters = Object.assign({}, defaults.counters, raw && raw.counters || {});
  state.nomination = Object.assign({}, nominationDefaults(), raw && raw.nomination || {});
  state.nightData = Object.assign({}, nightDefaults(), raw && raw.nightData || {});
  state.names = Array.isArray(state.names) ? state.names : [];
  state.players = Array.isArray(state.players) ? state.players : [];
  state.seen = Array.isArray(state.seen) ? state.seen : [];
  state.talked = Array.isArray(state.talked) ? state.talked : [];
  state.logs = Array.isArray(state.logs) ? state.logs : [];
  state.history = Array.isArray(state.history) ? state.history : [];
  if (!raw || !raw.currentState) state.currentState = migrateLegacyState(state);
  else if (oldNightPrivacy) state.currentState = migratePrivateNightState(raw.currentState);
  state.nightPrivacyVersion = 2;
  syncLegacyFields(state);
  return state;
}

function migratePrivateNightState(currentState) {
  if (['NIGHT.VIGILANTE_PROMPT', 'NIGHT.DETECTIVE_PROMPT', 'NIGHT.DOCTOR_PROMPT', 'NIGHT.DETECTIVE_SELECT'].includes(currentState)) return 'NIGHT.DETECTIVE_PROMPT';
  if (currentState === 'NIGHT.DOCTOR_SELECT') return 'NIGHT.DETECTIVE_SLEEP';
  if (currentState === 'NIGHT.VIGILANTE_SELECT') return 'NIGHT.DOCTOR_SLEEP';
  return currentState;
}

function migrateLegacyState(state) {
  if (state.finished) return 'GAME.COMPLETE';
  if (state.phase === 'setup') return SETUP_STATES[Math.min(state.setupStep || 0, SETUP_STATES.length - 1)];
  if (state.phase === 'reveal') return 'REVEAL.PLAYER';
  if (state.phase === 'night') return NIGHT_STEPS[Math.min(state.nightData && state.nightData.stage || 0, NIGHT_STEPS.length - 1)];
  const dayMap = { talk: 'DAY.CONVERSATION', 'nominate-select': 'DAY.NOMINATION', 'nominate-vote': 'DAY.CONVICTION_VOTE', 'defence-speech': 'DAY.DEFENCE_SPEECH', 'final-vote': 'DAY.FINAL_VOTE_SINGLE' };
  return dayMap[state.step] || (state.day === 1 ? 'DAY.INTRO' : 'DAY.CONVERSATION');
}

function syncLegacyFields(state = S) {
  const key = state.currentState || 'SETUP.START_TIME';
  if (key.startsWith('SETUP.')) { state.phase = 'setup'; state.setupStep = Math.max(0, SETUP_STATES.indexOf(key)); state.step = 'setup'; }
  else if (key.startsWith('REVEAL.')) { state.phase = 'reveal'; state.step = 'Private role reveal'; }
  else if (key.startsWith('DAY.')) { state.phase = 'day'; state.step = ({'DAY.INTRO':'intro','DAY.MORNING_ANNOUNCEMENT':'morning-announcement','DAY.CONVERSATION':'talk','DAY.NOMINATION':'nominate-select','DAY.CONVICTION_VOTE':'nominate-vote','DAY.DEFENCE_SPEECH':'defence-speech','DAY.FINAL_VOTE_SINGLE':'final-vote','DAY.FINAL_VOTE_MULTI':'final-vote','DAY.RESULT':'day-result'}[key] || 'talk'); }
  else if (key.startsWith('NIGHT.')) { state.phase = 'night'; state.step = 'night'; state.nightData.stage = Math.max(0, NIGHT_STEPS.indexOf(key)); }
  else if (key === 'GAME.COMPLETE') { state.phase = 'finished'; state.finished = true; state.step = 'complete'; }
}

function transition(next) {
  S.currentState = next;
  syncLegacyFields();
}

/* The only save system. */
function save() {
  syncLegacyFields();
  S.lastSaved = new Date().toISOString();
  S.saveStatus = 'Saved';
  localStorage.setItem(SAVE, JSON.stringify(S));
}

function load() {
  let previous = null;
  try {
    const current = localStorage.getItem(SAVE);
    previous = current || localStorage.getItem(OLD);
    if (previous) {
      S = normalize(JSON.parse(previous));
      if (!current) {
        S.revealIndex = Math.max(0, S.players.findIndex((player) => !S.seen.includes(player.id)));
        if (S.revealIndex < 0) S.revealIndex = S.players.length;
      }
      const issues = validateState(S);
      if (issues.length) {
        S.unsafeState = { message: issues.join(' '), raw: previous };
        return;
      }
      save();
      return;
    }
  } catch (error) {
    console.error('Saved game could not be read safely.', error);
    S = fresh();
    S.unsafeState = { message: `Saved data could not be parsed: ${error.message}`, raw: previous };
    return;
  }
  S = fresh();
  save();
}

function checkpoint(label) {
  const state = clone(S);
  state.history = [];
  S.history.push({ label, time: new Date().toISOString(), state });
  if (S.history.length > 40) S.history.shift();
}

function record(type, text) {
  S.logs.unshift({ phase: phaseLabel(), type, text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
}

function confirmStep(label, mutate, type, text) {
  checkpoint(label);
  mutate();
  if (type && text) record(type, typeof text === 'function' ? text() : text);
  save();
  render();
}

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function byId(id) {
  return S.players.find((player) => player.id === id);
}

function roleTeam(player) {
  return ROLES[player.role].team;
}

function living() {
  return S.players.filter((player) => player.alive);
}

function livingMafia() {
  return living().filter((player) => roleTeam(player) === 'Mafia');
}

function livingCitizens() {
  return living().filter((player) => roleTeam(player) === 'Citizen');
}

function eliminatedMafia() {
  return S.players.filter((player) => !player.alive && roleTeam(player) === 'Mafia');
}

function eliminatedCitizens() {
  return S.players.filter((player) => !player.alive && roleTeam(player) === 'Citizen');
}

function majority(count) {
  return Math.floor(count / 2) + 1;
}

function phaseLabel() {
  if (S.finished) return 'Completed';
  if (S.phase === 'setup') return 'Setup';
  if (S.phase === 'reveal') return 'Role Reveal';
  if (S.phase === 'day') return `Day ${S.day}`;
  return `Night ${S.night}`;
}

function selectOptions(players, allowSkip) {
  const first = allowSkip ? '<option value="">Skip / None</option>' : '<option value="">Select a player</option>';
  return first + players.map((player) => `<option value="${player.id}">${esc(player.name)}</option>`).join('');
}

function dashboard() {
  const stage = S.phase === 'reveal' ? `Player ${Math.min(S.revealIndex + 1, S.players.length)}/${S.players.length}` : S.currentState;
  $('dash').innerHTML = `<div><span>Phase</span><b>${esc(phaseLabel())}</b><span>${esc(stage)}</span></div><div><span>Mafia</span><b>${livingMafia().length}/${eliminatedMafia().length}</b><span>living/out</span></div><div><span>Citizens</span><b>${livingCitizens().length}/${eliminatedCitizens().length}</b><span>living/out</span></div><div><span>Limits</span><b>${S.counters.actions}/${S.settings.actions}</b><span>Vigilante / Sniper · Doctor self ${S.counters.self}/${S.settings.selfSaves} · Lecter self ${S.counters.lecterSelf}/${S.settings.lecterSelfShields}</span></div><div><span>Godfather shield</span><b>${S.settings.gfImmune ? 'ON' : 'OFF'}</b><span>${esc(S.saveStatus)}</span></div><div><span>Last public</span><b class="dash-note">${esc(S.lastPublic)}</b><span>${esc(S.lastSaved ? new Date(S.lastSaved).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : 'not saved')}</span></div>`;
}

function logCard() {
  const rows = S.logs.length ? S.logs.map((item) => `<div><b>${esc(item.phase || '')} · ${esc(item.type || item.tag || '')}</b><br>${esc(item.text)}<div class="small">${esc(item.time || item.t || '')}</div></div>`).join('') : '<div>No log yet.</div>';
  return `<section class="card"><h2>Game Log</h2><div class="log">${rows}</div></section>`;
}

/* The only DOM render path. */
function screen(title, hint, body) {
  document.body.dataset.mode = S.currentState === 'GAME.COMPLETE' ? 'complete' : S.currentState.startsWith('NIGHT.') ? 'night' : S.currentState.startsWith('DAY.') ? 'day' : 'setup';
  document.body.style.backgroundImage = `linear-gradient(rgba(5,2,4,.64),rgba(5,2,4,.88)),url('background-${document.body.dataset.mode}.svg')`;
  $('app').innerHTML = `<section class="card"><h2>${title}</h2><p class="hint">${hint}</p>${body}</section>${logCard()}`;
  dashboard();
}

function render() {
  if (S.unsafeState) return renderUnsafeState();
  if (S.currentState === 'GAME.COMPLETE') return renderFinished();
  if (S.currentState.startsWith('SETUP.')) return renderSetup();
  if (S.currentState.startsWith('REVEAL.')) return renderReveal();
  if (S.currentState.startsWith('DAY.')) return renderDay();
  if (S.currentState.startsWith('NIGHT.')) return renderNight();
  throw new Error(`Unknown game state: ${S.currentState}`);
}

function renderSetup() {
  const i = S.setupStep;
  const total = 9;
  if (i === 0) return screen(`Setup 1/${total} — Start Time`, 'Confirm the game start time.', `<input id="v" type="time" value="${esc(S.settings.start)}"><div class="actions"><button class="good" onclick="confirmSetupTime()">Confirm & Next</button></div>`);
  if (i === 1) return screen(`Setup 2/${total} — Player Count`, 'Enter total players.', `<input id="v" type="number" min="5" max="40" value="${S.settings.count}"><div class="actions"><button class="good" onclick="confirmSetupCount()">Confirm & Next</button></div>`);
  if (i === 2) return screen(`Setup 3/${total} — Mafia Count`, 'Mafia must start lower than Citizens.', `<input id="v" type="number" min="1" value="${S.settings.mafia}"><div class="actions"><button class="good" onclick="confirmSetupMafia()">Confirm & Next</button></div>`);
  if (i === 3) return screen(`Setup 4/${total} — Vigilante / Sniper Shot Limit`, 'Set the total number of shots. Start from 1.', `<input id="v" type="number" min="1" value="${S.settings.actions}"><div class="actions"><button class="good" onclick="confirmSetupMinimumOne('actions')">Confirm & Next</button></div>`);
  if (i === 4) return screen(`Setup 5/${total} — Citizen Doctor Self-Saves`, 'Set how many Nights the Citizen Doctor may save themselves. Start from 1.', `<input id="v" type="number" min="1" value="${S.settings.selfSaves}"><div class="actions"><button class="good" onclick="confirmSetupMinimumOne('selfSaves')">Confirm & Next</button></div>`);
  if (i === 5) return screen(`Setup 6/${total} — Dr. Lecter Self-Shields`, 'Set how many Nights Dr. Lecter may shield themselves. Start from 1.', `<input id="v" type="number" min="1" value="${S.settings.lecterSelfShields}"><div class="actions"><button class="good" onclick="confirmSetupMinimumOne('lecterSelfShields')">Confirm & Next</button></div>`);
  if (i === 6) return screen(`Setup 7/${total} — Godfather Shield`, 'Choose Yes or No: should the Godfather be protected from Vigilante / Sniper shots?', `<div class="actions"><button class="good" onclick="confirmGodfatherRule(true)">YES</button><button class="secondary" onclick="confirmGodfatherRule(false)">NO</button></div>`);
  if (i === 7) return screen(`Setup 8/${total} — Player Names`, 'Enter exactly one unique name per player. Names are compared without case.', `<textarea id="v">${esc(S.names.join('\n'))}</textarea><div id="err" class="err" style="display:none"></div><div class="actions"><button class="good" onclick="confirmNames()">Confirm Names</button></div>`);
  return screen(`Setup 9/${total} — Role Preview & Shuffle`, 'Confirm the exact role allocation, then shuffle and begin private reveal.', `<div class="ok">✓ Setup values are valid and unique.</div><div class="warn">${esc(rolePreview())}</div><div class="actions"><button class="good" onclick="shuffleRoles()">Confirm Allocation, Shuffle & Reveal</button></div>`);
}

function advanceSetup(mutator, label) {
  confirmStep(`Before ${label}`, () => { mutator(); transition(SETUP_STATES[Math.min(SETUP_STATES.length - 1, S.setupStep + 1)]); }, 'Setup', () => `Step ${S.setupStep} confirmed`);
}

function confirmSetupTime() {
  advanceSetup(() => { S.settings.start = $('v').value || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }, 'start time');
}

function confirmSetupCount() {
  advanceSetup(() => { S.settings.count = Math.max(5, Math.min(40, Number($('v').value) || 8)); }, 'player count');
}

function confirmSetupMafia() {
  const value = Math.max(1, Number($('v').value) || 1);
  const max = Math.floor((S.settings.count - 1) / 2);
  if (value > max) return alert(`Maximum Mafia count is ${max} for ${S.settings.count} players.`);
  advanceSetup(() => { S.settings.mafia = value; }, 'Mafia count');
}

function confirmSetupNumber(key) {
  const value = Math.max(0, Number($('v').value) || 0);
  advanceSetup(() => { S.settings[key] = value; }, key);
}

function confirmSetupMinimumOne(key) {
  const value = Math.max(1, Number($('v').value) || 1);
  advanceSetup(() => { S.settings[key] = value; }, key);
}

function confirmGodfatherRule(enabled) {
  advanceSetup(() => { S.settings.gfImmune = enabled; }, 'Godfather rule');
}

function confirmNames() {
  const names = $('v').value.split(/\n/).map((name) => name.trim()).filter(Boolean);
  const normalised = names.map((name) => name.toLocaleLowerCase());
  const duplicates = [...new Set(names.filter((name, index) => normalised.indexOf(normalised[index]) !== index))];
  if (names.length !== S.settings.count) return showSetupError(`You entered ${names.length} names. Required: ${S.settings.count}`);
  if (duplicates.length) return showSetupError(`Duplicate names: ${duplicates.join(', ')}`);
  confirmStep('Before player names', () => { S.names = names; transition('SETUP.ROLE_PREVIEW'); }, 'Setup', 'Player names confirmed');
}

function showSetupError(message) {
  $('err').style.display = 'block';
  $('err').textContent = message;
}

function rolePool() {
  const roles = ['Godfather'];
  if (S.settings.mafia > 1 && S.settings.count >= 7) roles.push('Lecter');
  while (roles.filter((role) => ROLES[role].team === 'Mafia').length < S.settings.mafia) roles.push('Mafia');
  if (roles.length < S.settings.count) roles.push('Detective');
  if (roles.length < S.settings.count) roles.push('Doctor');
  if (roles.length < S.settings.count) roles.push('Vigilante');
  while (roles.length < S.settings.count) roles.push('Citizen');
  return roles.slice(0, S.settings.count);
}

function roleAllocationIssues() {
  const pool = rolePool();
  const issues = [];
  if (pool.length !== S.settings.count) issues.push('Role count does not match player count.');
  if (pool.filter((role) => ROLES[role].team === 'Mafia').length !== S.settings.mafia) issues.push('Mafia-side role count does not match the Setup agreement.');
  if (!pool.includes('Godfather')) issues.push('Godfather is missing.');
  if (S.settings.mafia >= S.settings.count - S.settings.mafia) issues.push('Mafia already meet the win condition.');
  return issues;
}

function rolePreview() {
  const counts = {};
  rolePool().forEach((role) => { counts[ROLES[role].name] = (counts[ROLES[role].name] || 0) + 1; });
  return Object.entries(counts).map(([name, count]) => `${count} ${name}`).join(' · ');
}

function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function shuffleRoles() {
  const allocationIssues = roleAllocationIssues();
  if (allocationIssues.length) return alert(allocationIssues.join(' '));
  confirmStep('Before role assignment', () => {
    const names = shuffled(S.names);
    const roles = shuffled(rolePool());
    const used = new Set();
    S.players = names.map((name, index) => { let id = uid(); while (used.has(id)) id = uid(); used.add(id); return { id, name, role: roles[index], alive: true }; });
    S.seen = [];
    S.revealIndex = 0;
    transition('REVEAL.PLAYER');
  }, 'Shuffle', 'Roles assigned');
}

function renderReveal() {
  if (S.revealIndex >= S.players.length) {
    S.day = 1;
    S.talked = [];
    transition('DAY.INTRO');
    record('Transition', 'All roles seen. Day 1 started.');
    save();
    return render();
  }
  const player = S.players[S.revealIndex];
  screen('Private Role Reveal', 'Pass the phone to the named player. The app advances only after the role is hidden.', `<div class="ok"><b>${S.revealIndex + 1} of ${S.players.length}</b><br>Next player: ${esc(player.name)}</div><div class="actions"><button class="good" onclick="openReveal('${player.id}')">Pass Phone to ${esc(player.name)}</button></div>`);
}

function openReveal(id) {
  activeReveal = id;
  $('passName').textContent = byId(id).name;
  $('passView').style.display = 'block';
  $('roleView').style.display = 'none';
  $('modal').classList.add('on');
}

function showRole() {
  const player = byId(activeReveal);
  $('mName').textContent = player.name;
  $('mRole').textContent = ROLES[player.role].name;
  $('mTeam').textContent = `${ROLES[player.role].team} Team`;
  $('mDesc').textContent = ROLES[player.role].description;
  $('passView').style.display = 'none';
  $('roleView').style.display = 'block';
}

function hideRoleAndAdvance() {
  const player = byId(activeReveal);
  if (!player) return;
  $('modal').classList.remove('on');
  confirmStep('Before role reveal confirmation', () => {
    if (!S.seen.includes(player.id)) S.seen.push(player.id);
    S.revealIndex += 1;
    activeReveal = '';
  }, 'Role Seen', `${player.name} confirmed role`);
}

function inquiryControls() {
  return '<div class="actions"><button class="secondary" onclick="useInquiry()">Announce Eliminated Side Counts</button></div>';
}

function useInquiry() {
  checkpoint('Before inquiry');
  alert(`ANNOUNCE ONLY\n\nMafia-side out: ${eliminatedMafia().length}\nCitizen-side out: ${eliminatedCitizens().length}\n\nDo not reveal names or roles.`);
  record('Inquiry', `Side counts announced: Mafia ${eliminatedMafia().length}, Citizens ${eliminatedCitizens().length}.`);
  save();
  render();
}

function renderDay() {
  if (S.currentState === 'DAY.INTRO') return screen('Day 1 — Introduction', 'Explain that Day 1 is conversation only. There are no nominations or votes today.', '<div class="actions"><button class="good" onclick="confirmDayIntroduction()">Begin Day 1 Conversation</button></div>');
  if (S.currentState === 'DAY.MORNING_ANNOUNCEMENT') return renderPublicConfirmation();
  if (S.currentState === 'DAY.CONVERSATION') return renderConversation();
  if (S.currentState === 'DAY.NOMINATION') return renderNominationSelect();
  if (S.currentState === 'DAY.CONVICTION_VOTE') return renderConvictionVote();
  if (S.currentState === 'DAY.DEFENCE_SPEECH') return renderDefence();
  if (S.currentState === 'DAY.FINAL_VOTE_SINGLE' || S.currentState === 'DAY.FINAL_VOTE_MULTI') return renderFinalVote();
  if (S.currentState === 'DAY.RESULT') return renderDayResult();
  throw new Error(`Unknown day state: ${S.currentState}`);
}

function confirmDayIntroduction() {
  confirmStep('Before Day 1 conversation', () => transition('DAY.CONVERSATION'), 'Day Start', 'Day 1 conversation started.');
}

function renderConversation() {
  const remaining = living().filter((player) => !S.talked.includes(player.id));
  const next = S.day === 1 ? 'startNight()' : 'startNominations()';
  const nextText = S.day === 1 ? 'Move to Night 1' : 'Continue to Nominations';
  screen(`Day ${S.day} — Conversation`, `Public announcement: ${esc(S.lastPublic)}. Tick each active player after a fair opportunity to speak.`, `${inquiryControls()}<div class="players">${living().map((player) => `<div class="row ${S.talked.includes(player.id) ? 'done' : ''}"><div><div class="name">${esc(player.name)}</div><div class="small">${S.talked.includes(player.id) ? 'Completed' : 'Waiting to speak'}</div></div><button ${S.talked.includes(player.id) ? 'disabled' : ''} onclick="markTalked('${player.id}')">✓ Mark Spoke</button></div>`).join('')}</div><div class="actions"><button class="good" ${remaining.length ? 'disabled' : ''} onclick="${next}">${nextText}</button></div>`);
}

function markTalked(id) {
  const player = byId(id);
  if (!player || !player.alive || S.talked.includes(id)) return;
  confirmStep('Before conversation confirmation', () => { S.talked.push(id); }, 'Conversation', `${player.name} had an opportunity to speak.`);
}

function startNominations() {
  confirmStep('Before nominations', () => { transition('DAY.NOMINATION'); S.nomination = nominationDefaults(); }, 'Transition', 'Nomination stage opened.');
}

function renderNominationSelect() {
  const processed = S.nomination.results.length ? `<div class="ok">Processed: ${S.nomination.results.map((result) => `${esc(byId(result.id) && byId(result.id).name || 'Unknown')} (${result.passed ? 'Defence' : 'Failed'})`).join(', ')}</div>` : '';
  screen(`Day ${S.day} — Nomination`, 'Select one active player to nominate, or finish nominations. A conviction majority moves a nominee into defence.', `${processed}<label>Nominee</label><select id="nominee">${selectOptions(living(), false)}</select><div class="actions"><button class="good" onclick="openConvictionVote()">Record Conviction Vote</button><button class="secondary" onclick="finishNominations()">Finish Nominations</button></div>`);
}

function openConvictionVote() {
  const id = $('nominee').value;
  if (!id) return alert('Select a nominee.');
  if (S.nomination.results.some((result) => result.id === id)) return alert('This player has already been processed.');
  confirmStep('Before conviction vote', () => { S.nomination.current = id; transition('DAY.CONVICTION_VOTE'); });
}

function renderConvictionVote() {
  const player = byId(S.nomination.current);
  const voters = living().filter((voter) => voter.id !== player.id);
  const needed = majority(voters.length);
  const ballots = voters.map((voter) => `<div class="row"><div><div class="name">${esc(voter.name)}</div><div class="small">Eligible voter</div></div><select id="convictionVote_${voter.id}"><option value="">Select a vote</option><option value="yes">Send ${esc(player.name)} to defence</option><option value="no">Do not send ${esc(player.name)} to defence</option></select></div>`).join('');
  screen(`Day ${S.day} — Conviction Vote`, `Every living player except ${esc(player.name)} votes once on whether ${esc(player.name)} enters defence.`, `<div class="players">${ballots}</div><div class="warn">Eligible voters: ${voters.length}. Required for defence: ${needed}. The nominee cannot vote. Blank ballots are not accepted.</div><div class="actions"><button class="good" onclick="confirmConviction(${needed})">Calculate & Continue</button></div>`);
}

function confirmConviction(needed) {
  const id = S.nomination.current;
  const voters = living().filter((voter) => voter.id !== id);
  const ballots = {};
  for (const voter of voters) {
    const choice = $(`convictionVote_${voter.id}`).value;
    if (!choice) return alert('Every eligible voter must choose Send to defence or Do not send.');
    ballots[voter.id] = choice;
  }
  const yes = Object.values(ballots).filter((choice) => choice === 'yes').length;
  const no = voters.length - yes;
  const passed = yes >= needed;
  confirmStep('Before conviction result', () => {
    S.nomination.results.push({ id, ballots, yes, no, eligible: voters.length, needed, passed });
    if (passed && !S.nomination.defence.includes(id)) S.nomination.defence.push(id);
    S.nomination.current = '';
    transition('DAY.NOMINATION');
  }, 'Conviction', `${byId(id).name}: ${yes} for, ${no} against — ${passed ? 'entered defence' : 'did not enter defence'}.`);
}

function finishNominations() {
  if (!S.nomination.defence.length) {
    checkpoint('Before closing nominations');
    S.nomination.resultText = 'No player entered defence. No one was removed.';
    record('Day Result', S.nomination.resultText);
    transition('DAY.RESULT');
    save();
    return render();
  }
  confirmStep('Before defence stage', () => transition('DAY.DEFENCE_SPEECH'));
}

function renderDefence() {
  const defenders = S.nomination.defence.map(byId).filter((player) => player && player.alive);
  const remaining = defenders.filter((player) => !S.nomination.speechDone.includes(player.id));
  if (remaining.length) {
    const player = remaining[0];
    return screen(`Day ${S.day} — Defence Speech ${S.nomination.speechDone.length + 1}/${defenders.length}`, `Give only ${esc(player.name)} the floor for their defence.`, `<div class="ok"><div class="name">${esc(player.name)}</div></div><div class="actions"><button class="good" onclick="markDefence('${player.id}')">✓ Defence Complete</button></div>`);
  }
  screen(`Day ${S.day} — Defence Complete`, 'Every defendant has completed their defence.', '<div class="actions"><button class="good" onclick="beginFinalVote()">Start Final Vote</button></div>');
}

function markDefence(id) {
  if (S.nomination.speechDone.includes(id)) return;
  confirmStep('Before defence confirmation', () => { S.nomination.speechDone.push(id); }, 'Defence', `${byId(id).name} completed defence.`);
}

function beginFinalVote() {
  const defenders = S.nomination.defence.map(byId).filter((player) => player && player.alive);
  confirmStep('Before final vote', () => transition(defenders.length === 1 ? 'DAY.FINAL_VOTE_SINGLE' : 'DAY.FINAL_VOTE_MULTI'));
}

function renderFinalVote() {
  const defenders = S.nomination.defence.map(byId).filter((player) => player && player.alive);
  if (defenders.length === 1) {
    const voters = living();
    const eligible = voters.length;
    const needed = majority(eligible);
    const ballots = voters.map((voter) => `<div class="row"><div><div class="name">${esc(voter.name)}</div><div class="small">${voter.id === defenders[0].id ? 'Defendant — eligible to vote' : 'Eligible voter'}</div></div><select id="singleVote_${voter.id}"><option value="">Select a vote</option><option value="yes">Convict ${esc(defenders[0].name)}</option><option value="none">None — keep ${esc(defenders[0].name)}</option></select></div>`).join('');
    return screen(`Day ${S.day} — Open Final Vote`, `Record one visible vote for every living player. Each voter, including ${esc(defenders[0].name)}, must explicitly choose Convict or None.`, `<div class="players">${ballots}</div><div class="warn">Eligible voters: ${eligible}. Required to convict: ${needed}. Blank ballots are not accepted.</div><div class="actions"><button class="good" onclick="processSingleFinal('${defenders[0].id}',${needed})">Calculate Result</button></div>`);
  }
  const voters = living().filter((player) => !defenders.some((defender) => defender.id === player.id));
  const needed = majority(voters.length);
  screen(`Day ${S.day} — Blind Final Vote`, 'Defence players cannot vote. Every eligible voter must choose one defence player or explicitly choose None.', `<div class="players">${voters.map((voter) => `<div class="row"><div class="name">${esc(voter.name)}</div><select id="vote_${voter.id}">${selectOptions(defenders, false)}<option value="none">None — convict nobody</option></select></div>`).join('')}</div><div class="warn">Eligible voters: ${voters.length}. Required: ${needed}. A None vote is valid but does not count toward any defendant.</div><div class="actions"><button class="good" onclick="processBlindFinal(${needed})">Calculate Result</button></div>`);
}

function eliminate(id, reason) {
  const player = byId(id);
  if (player && player.alive) {
    player.alive = false;
    record('Elimination', `${player.name} left the game by ${reason}.`);
  }
}

function processSingleFinal(id, needed) {
  const voters = living();
  const ballots = {};
  for (const voter of voters) {
    const choice = $(`singleVote_${voter.id}`).value;
    if (!choice) return alert('Every eligible voter must choose Convict or None.');
    ballots[voter.id] = choice;
  }
  const yes = Object.values(ballots).filter((choice) => choice === 'yes').length;
  const no = voters.length - yes;
  checkpoint('Before day result');
  S.nomination.finalVotes = { ballots, yes, no, eligible: voters.length, needed };
  if (yes >= needed) { eliminate(id, 'day vote'); S.nomination.removedId = id; S.nomination.resultText = `${byId(id).name} was removed by the final vote.`; }
  else { S.nomination.resultText = `${byId(id).name} remained in the game.`; record('Day Result', S.nomination.resultText); }
  transition('DAY.RESULT');
  save();
  render();
}

function processBlindFinal(needed) {
  const defenders = S.nomination.defence.map(byId).filter(Boolean);
  const voters = living().filter((player) => !defenders.some((defender) => defender.id === player.id));
  const totals = Object.fromEntries(defenders.map((defender) => [defender.id, 0]));
  let none = 0;
  for (const voter of voters) {
    const choice = $(`vote_${voter.id}`).value;
    if (!choice) return alert('Every eligible voter must choose one defence player or None.');
    if (choice === 'none') none += 1;
    else totals[choice] += 1;
  }
  checkpoint('Before blind vote result');
  const winners = Object.entries(totals).filter(([, count]) => count >= needed).sort((a, b) => b[1] - a[1]);
  S.nomination.finalVotes = { totals, none, eligible: voters.length, needed };
  if (winners.length === 1) { eliminate(winners[0][0], 'blind day vote'); S.nomination.removedId = winners[0][0]; S.nomination.resultText = `${byId(winners[0][0]).name} was removed by the blind final vote.`; }
  else { S.nomination.resultText = 'No defence player received the required majority. No one was removed.'; record('Day Result', S.nomination.resultText); }
  transition('DAY.RESULT');
  save();
  render();
}

function renderDayResult() {
  screen(`Day ${S.day} — Result`, 'The app has calculated and applied the final vote.', `<div class="ok">${esc(S.nomination.resultText)}</div><div class="actions"><button class="good" onclick="confirmDayResult()">Confirm Result & Continue</button></div>`);
}

function confirmDayResult() {
  checkpoint('Before confirming day result');
  record('Day Result Confirmed', S.nomination.resultText);
  if (!applyWinState()) beginNightState();
  save();
  render();
}

function beginNightState() {
  if (applyWinState()) return;
  S.night = S.day;
  S.nightData = nightDefaults();
  S.announcementConfirmed = false;
  transition('NIGHT.EVERYONE_SLEEP');
  record('Transition', `Night ${S.night} started.`);
}

function startNight() {
  checkpoint('Before night');
  beginNightState();
  save();
  render();
}

function renderNight() {
  const key = S.currentState;
  if (key === 'NIGHT.EVERYONE_SLEEP') return renderPrompt(`Night ${S.night} — Everyone Sleeps`, 'Say: “Everyone, close your eyes.”', 'Everyone is asleep');
  if (key === 'NIGHT.MAFIA_WAKE') return renderPrompt(`Night ${S.night} — Mafia Wakes`, 'Say: “Mafia team, open your eyes.”', 'Mafia wake announced');
  if (key === 'NIGHT.MAFIA_IDENTIFY') return renderPrompt(`Night ${S.night} — Mafia Identifies`, 'Allow the living Mafia team to identify one another silently.', 'Mafia identification confirmed');
  if (key === 'NIGHT.MAFIA_SELECT') return screen(`Night ${S.night} — Mafia Selection`, 'The living Mafia team must choose exactly one living Citizen-side player.', `<label>Mafia target</label><select id="pick">${selectOptions(livingCitizens(), false)}</select><div class="actions"><button class="good" onclick="recordNightSelection('mafiaTarget','Mafia decision recorded','Citizen')">Confirm Mafia Target</button></div>`);
  if (key === 'NIGHT.LECTER') return renderLecter();
  if (key === 'NIGHT.MAFIA_SLEEP') return renderPrompt(`Night ${S.night} — Mafia Sleeps`, 'Say: “Mafia team, close your eyes.”', 'Mafia sleep announced');
  if (key === 'NIGHT.VIGILANTE_PROMPT') return renderIdentityPrompt('Vigilante', 'Vigilante / Sniper', 'Say: “Vigilante / Sniper, open your eyes.”');
  if (key === 'NIGHT.VIGILANTE_SELECT') return renderVigilante();
  if (key === 'NIGHT.VIGILANTE_SLEEP') return renderRoleSleep('Vigilante / Sniper');
  if (key === 'NIGHT.DETECTIVE_PROMPT') return renderIdentityPrompt('Detective', 'Detective', 'Say: “Detective, open your eyes.”');
  if (key === 'NIGHT.DETECTIVE_SELECT') return renderDetective();
  if (key === 'NIGHT.DETECTIVE_SLEEP') return renderRoleSleep('Detective');
  if (key === 'NIGHT.DOCTOR_PROMPT') return renderIdentityPrompt('Doctor', 'Citizen Doctor', 'Say: “Citizen Doctor, open your eyes.”');
  if (key === 'NIGHT.DOCTOR_SELECT') return renderDoctor();
  if (key === 'NIGHT.DOCTOR_SLEEP') return renderRoleSleep('Citizen Doctor');
  if (key === 'NIGHT.RESOLVE') return screen(`Night ${S.night} — Resolve Actions`, 'The app will validate all selections and calculate every interaction.', '<div class="actions"><button class="good" onclick="resolveNight()">Calculate Night Result</button></div>');
  if (key === 'NIGHT.PRIVATE_SUMMARY') return renderPrivateSummary();
  throw new Error(`Unknown night state: ${key}`);
}

function renderPrompt(title, text, logText) {
  screen(title, text, `<div class="actions"><button class="good" onclick="advanceNight('${esc(logText)}')">✓ Announced & Confirmed</button></div>`);
}

function advanceNight(text) {
  confirmStep('Before night step', () => transition(nextNightState()), 'Night Step', text);
}

function roleIsActive(role) {
  const rolePlayer = S.players.find((player) => player.role === role);
  return Boolean(rolePlayer && rolePlayer.alive);
}

function nextNightState() {
  let index = NIGHT_STEPS.indexOf(S.currentState) + 1;
  while (index < NIGHT_STEPS.length) {
    const candidate = NIGHT_STEPS[index];
    if (candidate === 'NIGHT.DETECTIVE_SELECT' && !roleIsActive('Detective')) { index += 1; continue; }
    if (candidate === 'NIGHT.DOCTOR_SELECT' && !roleIsActive('Doctor')) { index += 1; continue; }
    if (candidate === 'NIGHT.VIGILANTE_SELECT' && !roleIsActive('Vigilante')) { index += 1; continue; }
    return candidate;
  }
  return 'NIGHT.RESOLVE';
}

function renderIdentityPrompt(role, label, prompt) {
  const fake = !roleIsActive(role);
  const note = fake ? `<div class="warn"><b>FAKE STEP — ${esc(label)} is no longer active.</b><br>Read the prompt normally. Do not wait for a response or reveal why.</div>` : '<div class="ok">Real prompt. Only this player may open their eyes.</div>';
  screen(`Night ${S.night} — ${esc(label)} Wakes`, prompt, `${note}<div class="actions"><button class="good" onclick="confirmRolePrompt('${role}')">✓ Wake Confirmed</button></div>`);
}

function renderRoleSleep(label) {
  screen(`Night ${S.night} — ${esc(label)} Sleeps`, `Say: “${esc(label)}, close your eyes.” Confirm that they are fully asleep before waking the next role.`, `<div class="warn">Do not continue until ${esc(label)} can no longer see the next role.</div><div class="actions"><button class="good" onclick="advanceNight('${esc(label)} sleep confirmed')">✓ Asleep — Continue</button></div>`);
}

function confirmRolePrompt(role) {
  const fake = !roleIsActive(role);
  const label = role === 'Vigilante' ? 'Vigilante / Sniper' : role;
  confirmStep('Before secret-role prompt', () => {
    if (fake && !S.nightData.fakeRoles.includes(role)) S.nightData.fakeRoles.push(role);
    transition(nextNightState());
  }, fake ? 'Fake Night Step' : 'Night Prompt', fake ? `${label} fake prompt completed; no selection or result created.` : `${label} prompt completed.`);
}

function renderLecter() {
  if (!roleIsActive('Lecter')) return screen(`Night ${S.night} — Dr. Lecter`, 'Say: “Dr. Lecter, open your eyes.”', '<div class="warn"><b>FAKE STEP — Dr. Lecter is no longer active.</b><br>Read the prompt normally. Do not wait for a response.</div><div class="actions"><button class="good" onclick="confirmFakeLecter()">✓ Fake Step Completed</button></div>');
  const lecter = S.players.find((player) => player.role === 'Lecter');
  const allowed = livingMafia().filter((player) => player.id !== lecter.id || S.counters.lecterSelf < S.settings.lecterSelfShields);
  screen(`Night ${S.night} — Dr. Lecter`, 'Say: “Dr. Lecter, open your eyes and shield one living Mafia-side player.”', `<label>Shield target</label><select id="pick">${selectOptions(allowed, false)}</select><div class="warn">Self-shields used: ${S.counters.lecterSelf}/${S.settings.lecterSelfShields}</div><div class="actions"><button class="good" onclick="confirmLecter('${lecter.id}')">Confirm Shield</button></div>`);
}

function confirmLecter(lecterId) {
  const id = $('pick').value;
  if (!id) return alert('Select a player first.');
  const target = byId(id);
  if (!target || !target.alive || roleTeam(target) !== 'Mafia') return alert('Dr. Lecter must shield a living Mafia-side player.');
  if (id === lecterId && S.counters.lecterSelf >= S.settings.lecterSelfShields) return alert('Dr. Lecter self-shield limit reached.');
  confirmStep('Before Lecter shield', () => { if (id === lecterId) S.counters.lecterSelf += 1; S.nightData.lecterShield = id; transition(nextNightState()); }, 'Night Action', 'Dr. Lecter shield recorded.');
}

function confirmFakeLecter() {
  confirmStep('Before fake Lecter prompt', () => { if (!S.nightData.fakeRoles.includes('Lecter')) S.nightData.fakeRoles.push('Lecter'); transition(nextNightState()); }, 'Fake Night Step', 'Lecter fake prompt completed; no shield created.');
}

function recordNightSelection(key, text, requiredTeam) {
  const value = $('pick').value;
  if (!value) return alert('Select a player first.');
  const target = byId(value);
  if (!target || !target.alive || (requiredTeam && roleTeam(target) !== requiredTeam)) return alert('That target is not valid for this action.');
  confirmStep('Before night selection', () => { S.nightData[key] = value; transition(nextNightState()); }, 'Night Action', text);
}

function renderDetective() {
  const targets = living();
  screen(`Night ${S.night} — Detective Inquiry`, 'Only the Detective is awake. They must choose one active player for a private inquiry.', `<select id="pick">${selectOptions(targets, false)}</select><div class="warn">Inquiry is mandatory while the Detective is active. There is no pass option.</div><div class="actions"><button class="good" onclick="confirmDetective()">Show Private Result</button></div>`);
}

function confirmDetective() {
  const player = byId($('pick').value);
  if (!player) return alert('Select a player.');
  checkpoint('Before detective result');
  S.nightData.detectiveCheck = player.id;
  const appearsMafia = player.role !== 'Godfather' && roleTeam(player) === 'Mafia';
  const result = appearsMafia ? 'YES — appears Mafia' : 'NO — does not appear Mafia';
  S.nightData.detectiveResult = `${player.name}: ${result}`;
  alert(`PRIVATE DETECTIVE INQUIRY\n\n${player.name}: ${result}\n\nTell the Detective only YES or NO. The Godfather also returns NO.`);
  transition(nextNightState());
  record('Night Action', 'Detective check completed privately.');
  save();
  render();
}

function renderDoctor() {
  const doctor = S.players.find((player) => player.role === 'Doctor');
  const allowed = living().filter((player) => player.id !== doctor.id || S.counters.self < S.settings.selfSaves);
  screen(`Night ${S.night} — Citizen Doctor Save`, 'Only the Citizen Doctor is awake. They must choose one active player to protect.', `<select id="pick">${selectOptions(allowed, false)}</select><div class="warn">A save is mandatory while the Citizen Doctor is active. There is no pass option.<br>Self-saves used: ${S.counters.self}/${S.settings.selfSaves}</div><div class="actions"><button class="good" onclick="confirmDoctor('${doctor.id}')">Confirm Save</button></div>`);
}

function confirmDoctor(doctorId) {
  const id = $('pick').value;
  if (!id) return alert('Select a player.');
  if (id === doctorId && S.counters.self >= S.settings.selfSaves) return alert('Self-save limit reached.');
  confirmStep('Before doctor save', () => {
    if (id === doctorId) S.counters.self += 1;
    S.nightData.doctorSave = id;
    transition(nextNightState());
  }, 'Night Action', 'Citizen Doctor save recorded.');
}

function renderVigilante() {
  const vigilante = S.players.find((player) => player.role === 'Vigilante');
  if (S.counters.actions >= S.settings.actions) return screen(`Night ${S.night} — Vigilante / Sniper Action`, 'The action limit has been reached. Only Pass is available.', '<select id="pick"><option value="">Pass / No action</option></select><div class="warn">Action limit reached. Passing does not use a shot.</div><div class="actions"><button class="good" onclick="confirmVigilante()">Confirm Pass</button></div>');
  const targets = living().filter((player) => player.id !== vigilante.id);
  screen(`Night ${S.night} — Vigilante / Sniper Action`, 'Only the Vigilante / Sniper is awake. They may choose one other active player or pass.', `<select id="pick">${selectOptions(targets, true)}</select><div class="warn">Pass is valid only for the Vigilante / Sniper and does not use a shot.<br>Actions used: ${S.counters.actions}/${S.settings.actions}</div><div class="actions"><button class="good" onclick="confirmVigilante()">Confirm Action / Pass</button></div>`);
}

function confirmVigilante() {
  const id = $('pick').value;
  confirmStep('Before Vigilante / Sniper action', () => {
    S.nightData.vigilanteTarget = id;
    if (id) S.counters.actions += 1;
    transition(nextNightState());
  }, 'Night Action', id ? 'Vigilante / Sniper action recorded.' : 'Vigilante / Sniper passed.');
}

function calculateNight() {
  const data = S.nightData;
  const removed = [];
  const notes = [];
  if (data.mafiaTarget) {
    if (data.mafiaTarget === data.doctorSave) notes.push('Mafia selection was saved by Citizen Doctor.');
    else removed.push(data.mafiaTarget);
  }
  if (data.vigilanteTarget) {
    const target = byId(data.vigilanteTarget);
    const vigilante = S.players.find((player) => player.role === 'Vigilante');
    if (roleTeam(target) === 'Citizen') {
      if (vigilante && vigilante.alive && !removed.includes(vigilante.id)) removed.push(vigilante.id);
      notes.push(`${target.name} is Citizen-side and survives the Vigilante / Sniper action; ${vigilante ? vigilante.name : 'the Vigilante / Sniper'} is removed instead.`);
    } else {
      const blocked = data.vigilanteTarget === data.lecterShield || (target.role === 'Godfather' && S.settings.gfImmune);
      if (blocked) notes.push(`Vigilante / Sniper action against ${target.name} was blocked.`);
      else if (!removed.includes(data.vigilanteTarget)) removed.push(data.vigilanteTarget);
    }
  }
  return { removed, notes };
}

function resolveNight() {
  if (!S.nightData.mafiaTarget || !byId(S.nightData.mafiaTarget) || roleTeam(byId(S.nightData.mafiaTarget)) !== 'Citizen' || !byId(S.nightData.mafiaTarget).alive) return alert('Mafia target is missing or invalid. Undo and record a living Citizen-side target.');
  checkpoint('Before Night resolution');
  const result = calculateNight();
  S.nightData.pendingRemoved = [...new Set(result.removed)];
  for (const id of S.nightData.pendingRemoved) eliminate(id, 'night result');
  const details = [
    `Mafia target: ${byId(S.nightData.mafiaTarget).name}${S.nightData.mafiaTarget === S.nightData.doctorSave ? ' — saved by Citizen Doctor' : ' — not saved'}.`,
    S.nightData.lecterShield ? `Lecter shield: ${byId(S.nightData.lecterShield).name}.` : 'Lecter shield: fake / none.',
    S.nightData.detectiveResult ? `Detective result: ${S.nightData.detectiveResult}.` : 'Detective result: fake / none.',
    S.nightData.doctorSave ? `Doctor save: ${byId(S.nightData.doctorSave).name}.` : 'Doctor save: fake / none.',
    S.nightData.vigilanteTarget ? `Vigilante / Sniper target: ${byId(S.nightData.vigilanteTarget).name}.` : 'Vigilante / Sniper skipped / fake.',
    ...result.notes,
    S.nightData.pendingRemoved.length ? `Final removals: ${S.nightData.pendingRemoved.map((id) => byId(id).name).join(', ')}.` : 'Final removals: none.',
  ];
  S.nightData.privateSummary = details.join('\n');
  S.nightData.publicAnnouncement = S.nightData.pendingRemoved.length ? `${S.nightData.pendingRemoved.map((id) => byId(id).name).join(' and ')} left the game overnight.` : 'No one left the game overnight.';
  S.nightData.resolved = true;
  transition('NIGHT.PRIVATE_SUMMARY');
  record('Night Resolution', S.nightData.privateSummary);
  save();
  render();
}

function renderPrivateSummary() {
  screen(`Night ${S.night} — Private Result Summary`, 'PRIVATE: review the calculated result before announcing anything publicly.', `<div class="warn">${esc(S.nightData.privateSummary).replace(/\n/g, '<br>')}</div><div class="actions"><button class="good" onclick="confirmPrivateSummary()">Confirm Private Result</button><button class="secondary" onclick="undoLast()">Undo Last Step</button></div>`);
}

function confirmPrivateSummary() {
  confirmStep('Before public announcement', () => transition('DAY.MORNING_ANNOUNCEMENT'), 'Night Result', 'Private result reviewed.');
}

function renderPublicConfirmation() {
  screen(`Day ${S.night + 1} — Morning Announcement`, 'Read only this public announcement. Do not reveal roles, saves, shields, Detective results, or reasons.', `<div class="ok"><b>${esc(S.nightData.publicAnnouncement)}</b></div><div class="actions"><button class="good" onclick="confirmMorning()">Confirm Morning Announcement</button><button class="secondary" onclick="undoLast()">Undo Before Announcement</button></div>`);
}

function confirmMorning() {
  checkpoint('Before public announcement confirmation');
  S.lastPublic = S.nightData.publicAnnouncement;
  S.announcementConfirmed = true;
  record('Public Announcement', S.lastPublic);
  if (!applyWinState()) {
    S.day = S.night + 1;
    S.talked = [];
    S.nomination = nominationDefaults();
    transition('DAY.CONVERSATION');
  }
  save();
  render();
}

function applyWinState() {
  if (!S.players.length) return false;
  const mafia = livingMafia().length;
  const citizens = livingCitizens().length;
  if (mafia === 0) {
    S.finished = true;
    S.winner = 'Citizens';
    S.reason = 'All Mafia-side players are out.';
  } else if (mafia >= citizens) {
    S.finished = true;
    S.winner = 'Mafia';
    S.reason = 'Active Mafia count is equal to or greater than active Citizen count.';
  }
  if (S.finished) {
    transition('GAME.COMPLETE');
    if (!S.logs.some((item) => item.type === 'Game Completed')) record('Game Completed', `${S.winner} win`);
  }
  return S.finished;
}

function checkWin() {
  if (!applyWinState()) return false;
  save();
  renderFinished();
  return true;
}

function renderFinished() {
  screen('Game Completed', `${S.winner} win. ${S.reason}`, `<div class="ok">Mafia active: ${livingMafia().length}<br>Citizens active: ${livingCitizens().length}</div><div class="actions"><button class="danger" onclick="resetGame()">Start New Game</button></div>`);
}

function undoLast() {
  if (!S.history.length) return alert('No previous checkpoint is available.');
  if (requiresControlledCorrection()) return controlledCorrection();
  restoreLastCheckpoint('Undo');
}

function requiresControlledCorrection() {
  const latest = S.history[S.history.length - 1];
  return Boolean(latest && latest.label === 'Before public announcement confirmation');
}

function restoreLastCheckpoint(kind) {
  const checkpointEntry = S.history.pop();
  const remaining = S.history;
  S = normalize(checkpointEntry.state);
  S.history = remaining;
  record(kind === 'Controlled correction' ? 'Controlled Correction' : 'Undo', `${kind}: restored previous checkpoint — ${checkpointEntry.label}.`);
  save();
  render();
}

function controlledCorrection() {
  if (!confirm('The public announcement has already been confirmed. Start a controlled correction and record it in the private log?')) return;
  if (!confirm('Final confirmation: restore the pre-announcement state and issue a corrected announcement?')) return;
  restoreLastCheckpoint('Controlled correction');
}

function validateState(state = S) {
  const issues = [];
  const validStates = [...SETUP_STATES, 'REVEAL.PLAYER', 'DAY.INTRO', 'DAY.MORNING_ANNOUNCEMENT', 'DAY.CONVERSATION', 'DAY.NOMINATION', 'DAY.CONVICTION_VOTE', 'DAY.DEFENCE_SPEECH', 'DAY.FINAL_VOTE_SINGLE', 'DAY.FINAL_VOTE_MULTI', 'DAY.RESULT', ...NIGHT_STEPS, 'GAME.COMPLETE'];
  if (state.appVersion !== 17) issues.push(`Schema version is ${state.appVersion}; expected 17.`);
  if (!validStates.includes(state.currentState)) issues.push(`Unknown state-machine step: ${state.currentState}.`);
  const activeGame = !state.currentState.startsWith('SETUP.');
  if (activeGame) {
    if (state.players.length !== state.settings.count) issues.push(`Player count is ${state.players.length}; expected ${state.settings.count}.`);
    if (new Set(state.players.map((player) => player.id)).size !== state.players.length) issues.push('Player IDs are not unique.');
    if (new Set(state.players.map((player) => String(player.name).trim().toLocaleLowerCase())).size !== state.players.length) issues.push('Player names are not unique after case normalisation.');
    if (state.players.some((player) => !ROLES[player.role])) issues.push('One or more players have an unsupported role.');
    if (!state.players.some((player) => player.role === 'Godfather')) issues.push('Godfather role is missing.');
    const mafiaCount = state.players.filter((player) => ROLES[player.role] && ROLES[player.role].team === 'Mafia').length;
    if (mafiaCount !== state.settings.mafia) issues.push(`Mafia-side role count is ${mafiaCount}; expected ${state.settings.mafia}.`);
  }
  if (state.counters.self < 0 || state.counters.self > state.settings.selfSaves) issues.push('Doctor self-save counter is outside its limit.');
  if (state.counters.lecterSelf < 0 || state.counters.lecterSelf > state.settings.lecterSelfShields) issues.push('Lecter self-shield counter is outside its limit.');
  if (state.counters.actions < 0 || state.counters.actions > state.settings.actions) issues.push('Vigilante / Sniper action counter is outside its limit.');
  for (const [key, id] of Object.entries({mafiaTarget:state.nightData.mafiaTarget,lecterShield:state.nightData.lecterShield,detectiveCheck:state.nightData.detectiveCheck,doctorSave:state.nightData.doctorSave,vigilanteTarget:state.nightData.vigilanteTarget})) {
    if (id && !state.players.some((player) => player.id === id)) issues.push(`${key} references a missing player.`);
  }
  if (state.nightData.fakeRoles.includes('Lecter') && state.nightData.lecterShield) issues.push('Fake Lecter step contains a real shield selection.');
  if (state.nightData.fakeRoles.includes('Detective') && state.nightData.detectiveCheck) issues.push('Fake Detective step contains a real selection.');
  if (state.nightData.fakeRoles.includes('Doctor') && state.nightData.doctorSave) issues.push('Fake Doctor step contains a real selection.');
  if (state.nightData.fakeRoles.includes('Vigilante') && state.nightData.vigilanteTarget) issues.push('Fake Vigilante / Sniper step contains a real selection.');
  if (!Array.isArray(state.logs)) issues.push('Game log is unreadable.');
  return issues;
}

function health() {
  const probe = `${SAVE}_health_probe`;
  try { localStorage.setItem(probe, 'ok'); if (localStorage.getItem(probe) !== 'ok') throw new Error('read-back mismatch'); localStorage.removeItem(probe); }
  catch (error) { S.unsafeState = { message: `localStorage write/read failed: ${error.message}` }; }
  const issues = validateState();
  if (S.unsafeState) issues.unshift(S.unsafeState.message);
  const details = issues.length ? issues.map((issue) => `<div class="err">✕ ${esc(issue)}</div>`).join('') : `<div class="ok">✓ localStorage write/read passed</div><div class="ok">✓ Schema 17 and state ${esc(S.currentState)} are valid</div><div class="ok">✓ Player, role, counter, selection, win, log, resume, and engine invariants passed</div>`;
  screen('Game Health Check', issues.length ? 'Unsafe progression is blocked until every issue is resolved.' : 'All required health validations passed.', `${details}<div class="actions"><button class="secondary" onclick="exportDiagnostic()">Export Diagnostic JSON</button><button class="good" onclick="render()">Return</button></div>`);
}

function menu() {
  const undoLabel = requiresControlledCorrection() ? 'Start Controlled Correction' : 'Undo Last Confirmed Step';
  screen('Menu', 'The current game remains saved.', `<input id="importFile" type="file" accept="application/json,.json" hidden onchange="importSavedGame(this)"><div class="actions"><button class="good" onclick="render()">Continue Game</button><button class="secondary" onclick="undoLast()" ${S.history.length ? '' : 'disabled'}>${undoLabel}</button><button class="secondary" onclick="health()">Health Check</button><button class="secondary" onclick="exportDiagnostic()">Export Saved Game</button><button class="secondary" onclick="$('importFile').click()">Import Saved Game</button><button class="danger" onclick="resetGame()">Full Reset</button></div>`);
}

function exportDiagnostic() {
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), issues: validateState(), state: S }, null, 2);
  if (typeof Blob === 'undefined' || !URL || !URL.createObjectURL) return payload;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([payload], {type:'application/json'}));
  link.download = `mafia-rev17-diagnostic-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  return payload;
}

function importSavedGame(input) {
  const file = input && input.files && input.files[0];
  if (!file) return alert('Choose a saved-game JSON file.');
  const reader = new FileReader();
  reader.onload = () => {
    try { restoreImportedState(JSON.parse(String(reader.result || ''))); }
    catch (error) { alert(`Saved game could not be imported: ${error.message}`); }
  };
  reader.onerror = () => alert('Saved game could not be read.');
  reader.readAsText(file);
}

function restoreImportedState(payload) {
  const rawState = payload && payload.state ? payload.state : payload;
  const candidate = normalize(clone(rawState));
  const issues = validateState(candidate);
  if (issues.length) { alert(`Saved game could not be imported: ${issues.join(' ')}`); return false; }
  if (!confirm(`Resume the imported game at ${candidate.currentState}? This replaces the saved game on this preview address.`)) return false;
  S = candidate;
  record('Import', `Saved game imported at ${S.currentState}.`);
  save();
  render();
  return true;
}

function renderUnsafeState() {
  screen('Saved Game Needs Recovery', esc(S.unsafeState.message), '<div class="err">Progression is blocked to protect recoverable data.</div><div class="actions"><button class="secondary" onclick="exportDiagnostic()">Export Diagnostic JSON</button><button class="good" onclick="retryRecovery()">Retry Recovery</button><button class="danger" onclick="resetGame()">Controlled Reset</button></div>');
}

function retryRecovery() {
  S.unsafeState = null;
  const issues = validateState();
  if (issues.length) S.unsafeState = {message: issues.join(' ')};
  render();
}

/*CANONICAL: the only reset path in the served app*/
function resetGame() {
  if (!confirm('Start a new game and permanently remove the current saved game?')) return;
  if (!confirm('Final confirmation: erase this game?')) return;
  localStorage.removeItem(SAVE);
  localStorage.removeItem(OLD);
  S = fresh();
  record('Reset', 'A new game was started after two confirmations.');
  save();
  render();
}

function boot() {
  load();
  document.querySelector('.credit').textContent = `by Nima · ${BUILD_ID}`;
  render();
  registerServiceWorker();
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('Offline cache registration failed.', error));
}

const REQUIRED_FUNCTIONS = ['render', 'screen', 'save', 'load', 'renderSetup', 'renderReveal', 'renderDay', 'renderNight', 'calculateNight', 'validateState', 'menu', 'health', 'resetGame', 'undoLast', 'startNight', 'checkWin'];
function startupSelfCheck() {
  const missing = REQUIRED_FUNCTIONS.filter((name) => typeof window[name] !== 'function');
  if (!missing.length) {
    console.log('Startup self-check passed —', BUILD_ID);
    return true;
  }
  console.error('Startup self-check FAILED. Missing required function(s):', missing.join(', '));
  const app = $('app');
  if (app) app.innerHTML = `<div class="card"><h2>Startup Check Failed</h2><p class="hint">The app could not start safely because required functions are missing: ${missing.join(', ')}.</p></div>`;
  return false;
}

if (startupSelfCheck()) boot();
