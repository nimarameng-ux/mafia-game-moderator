const fs = require('fs');
const path = require('path');
const { createApp, players, state, choose, click, savedState } = require('./helpers');

const failures = [];
let passed = 0;
function test(id, name, fn) {
  try { fn(); passed += 1; console.log(`PASS ${id} - ${name}`); }
  catch (error) { failures.push(`${id} ${name}: ${error.stack || error}`); console.error(`FAIL ${id} - ${name}: ${error.message}`); }
}
function assert(value, message) { if (!value) throw new Error(message); }
function text(w) { return w.document.getElementById('app').textContent.replace(/\s+/g, ' '); }
function optionValues(w, id = 'pick') { return [...w.document.querySelectorAll(`#${id} option`)].map((option) => option.value); }
function night(overrides = {}) {
  return state(Object.assign({ currentState: 'NIGHT.RESOLVE', phase: 'night', step: 'night', night: 1, day: 1, nightData: Object.assign(state().nightData, { mafiaTarget: 'c1' }) }, overrides));
}
function resolveScenario(nightData = {}, overrides = {}) {
  const app = createApp(night(Object.assign({ nightData: Object.assign(state().nightData, { mafiaTarget: 'c1' }, nightData) }, overrides)));
  click(app.w, 'Calculate Night Result');
  return { ...app, saved: savedState(app.w) };
}
function advancePrompt(w) { click(w, 'Announced & Confirmed'); }
function castSingleVotes(w, yesIds = []) {
  const yes = new Set(yesIds);
  for (const ballot of w.document.querySelectorAll('[id^="singleVote_"]')) {
    const voterId = ballot.id.replace('singleVote_', '');
    ballot.value = yes.has(voterId) ? 'yes' : 'none';
  }
}
function castConvictionVotes(w, yesIds = []) {
  const yes = new Set(yesIds);
  for (const ballot of w.document.querySelectorAll('[id^="convictionVote_"]')) {
    const voterId = ballot.id.replace('convictionVote_', '');
    ballot.value = yes.has(voterId) ? 'yes' : 'no';
  }
}

test('T01', 'Fresh setup', () => {
  const { w } = createApp();
  assert(text(w).includes('Setup 1/9'), 'fresh app did not start at named Setup state');
  assert(savedState(w).currentState === 'SETUP.START_TIME', 'currentState was not persisted');
});

test('T02', 'Duplicate-name rejection is case-normalised', () => {
  const s = state({ currentState: 'SETUP.PLAYER_NAMES', phase: 'setup', setupStep: 7, settings: Object.assign(state().settings, {count:5,mafia:2}), names: [], players: [] });
  const { w } = createApp(s);
  choose(w, 'v', 'Alex\nalex\nCasey\nDrew\nEmerson'); click(w, 'Confirm Names');
  assert(text(w).includes('Duplicate names'), 'case-insensitive duplicate was accepted');
});

test('T03', 'Invalid Mafia ratio', () => {
  const s = state({ currentState: 'SETUP.MAFIA_COUNT', phase:'setup', setupStep:2, settings:Object.assign(state().settings,{count:6}), players:[] });
  const { w, alerts } = createApp(s);
  choose(w, 'v', '3'); click(w, 'Confirm & Next');
  assert(alerts.some((message) => message.includes('Maximum Mafia')), 'equal Mafia/Citizen ratio was accepted');
});

test('T04', 'Role count and Setup allocation validation', () => {
  const { w } = createApp(state({currentState:'SETUP.ROLE_PREVIEW',phase:'setup',setupStep:8,settings:Object.assign(state().settings,{count:8,mafia:2}),names:players().map(p=>p.name),players:[]}));
  assert(w.roleAllocationIssues().length === 0, 'supported allocation was rejected');
  assert(w.rolePool().length === 8, 'role pool count did not equal player count');
});

test('T05', 'Full role reveal', () => {
  const roster = players();
  const { w } = createApp(state({currentState:'REVEAL.PLAYER',phase:'reveal',revealIndex:0,seen:[],players:roster}));
  for (let index=0; index<roster.length; index+=1) { click(w,'Pass Phone'); w.document.querySelector('#passView button').click(); w.document.querySelector('#roleView button').click(); }
  assert(savedState(w).currentState === 'DAY.INTRO', 'final reveal did not start Day 1 introduction');
});

test('T06', 'Resume mid-reveal', () => {
  const roster = players();
  const first = createApp(state({currentState:'REVEAL.PLAYER',phase:'reveal',revealIndex:3,seen:roster.slice(0,3).map(p=>p.id),players:roster}));
  const resumed = createApp(savedState(first.w));
  assert(text(resumed.w).includes('4 of 8') && text(resumed.w).includes(roster[3].name), 'reveal did not resume at exact player');
});

test('T07', 'Day 1 conversation locks until all living players speak', () => {
  const { w } = createApp(state({currentState:'DAY.CONVERSATION',day:1,talked:[]}));
  const next = w.document.querySelector('button[onclick="startNight()"]');
  assert(next && next.disabled, 'Night unlocked before all players spoke');
});

test('T08', 'Day 1 cannot nominate or vote', () => {
  const { w } = createApp(state({currentState:'DAY.CONVERSATION',day:1,talked:[]}));
  assert(!text(w).includes('Nomination') && !text(w).includes('Final Vote'), 'Day 1 exposed voting');
});

test('T09', 'Full Night 1 sequence', () => {
  const roster = players();
  const { w, errors } = createApp(state({currentState:'DAY.CONVERSATION',day:1,talked:roster.map(p=>p.id),players:roster}));
  click(w,'Move to Night 1'); advancePrompt(w); advancePrompt(w); advancePrompt(w);
  choose(w,'pick','c1'); click(w,'Confirm Mafia Target'); choose(w,'pick','gf'); click(w,'Confirm Shield');
  advancePrompt(w);
  click(w,'Wake Confirmed'); choose(w,'pick','gf'); click(w,'Show Private Result'); click(w,'Asleep — Continue');
  click(w,'Wake Confirmed'); choose(w,'pick','c1'); click(w,'Confirm Save'); click(w,'Asleep — Continue');
  click(w,'Wake Confirmed'); choose(w,'pick',''); click(w,'Confirm Action / Pass'); click(w,'Asleep — Continue');
  click(w,'Calculate Night Result'); assert(text(w).includes('Private Result Summary'),'private summary missing');
  click(w,'Confirm Private Result'); assert(text(w).includes('Morning Announcement'),'morning announcement missing');
  click(w,'Confirm Morning Announcement');
  assert(savedState(w).currentState === 'DAY.CONVERSATION' && savedState(w).day === 2, 'Night 1 did not reach Day 2 conversation');
  assert(errors.length === 0, `runtime errors: ${errors.join('; ')}`);
});

test('T10', 'Mafia target required', () => {
  const { w, alerts } = createApp(state({currentState:'NIGHT.MAFIA_SELECT',phase:'night'}));
  click(w,'Confirm Mafia Target'); assert(alerts.some(m=>m.includes('Select a player')), 'blank Mafia target accepted');
});

test('T11', 'Mafia cannot target Mafia', () => {
  const { w } = createApp(state({currentState:'NIGHT.MAFIA_SELECT',phase:'night'}));
  assert(!optionValues(w).includes('gf') && !optionValues(w).includes('lec'), 'Mafia-side target appeared in Mafia selection');
});

test('T12', 'Lecter target and self-shield validation', () => {
  const { w } = createApp(state({currentState:'NIGHT.LECTER',phase:'night',counters:{self:0,lecterSelf:1,actions:0}}));
  assert(!optionValues(w).includes('lec'), 'Lecter remained self-selectable after self-shield limit');
  assert(!optionValues(w).includes('c1'), 'Citizen appeared in Lecter shield targets');
});

test('T13', 'Detective result for Mafia', () => {
  const { w, alerts } = createApp(state({currentState:'NIGHT.DETECTIVE_SELECT',phase:'night'}));
  choose(w,'pick','lec'); click(w,'Show Private Result'); assert(alerts.at(-1).includes('Lee: YES — appears Mafia'),'Lecter did not return YES');
});

test('T14', 'Detective result for Godfather', () => {
  const { w, alerts } = createApp(state({currentState:'NIGHT.DETECTIVE_SELECT',phase:'night'}));
  choose(w,'pick','gf'); click(w,'Show Private Result'); assert(alerts.at(-1).includes('Gina: NO — does not appear Mafia'),'Godfather did not return NO');
});

test('T15', 'Doctor save cancels Mafia removal only', () => {
  const { saved } = resolveScenario({mafiaTarget:'c1',doctorSave:'c1'});
  assert(saved.players.find(p=>p.id==='c1').alive, 'Doctor did not save Mafia target');
});

test('T16', 'Citizen Doctor self-save limit', () => {
  const { w } = createApp(state({currentState:'NIGHT.DOCTOR_SELECT',phase:'night',counters:{self:1,lecterSelf:0,actions:0}}));
  assert(!optionValues(w).includes('doc'), 'Doctor could self-save after limit');
});

test('T17', 'Vigilante shot limit', () => {
  const { w } = createApp(state({currentState:'NIGHT.VIGILANTE_SELECT',phase:'night',counters:{self:0,lecterSelf:0,actions:2}}));
  assert(optionValues(w).length === 1 && optionValues(w)[0] === '', 'non-Skip target available after shot limit');
});

test('T18', 'Lecter blocks Vigilante', () => {
  const { saved } = resolveScenario({mafiaTarget:'c1',doctorSave:'c1',vigilanteTarget:'lec',lecterShield:'lec'});
  assert(saved.players.find(p=>p.id==='lec').alive, 'Lecter shield did not block Vigilante');
});

test('T19', 'Godfather shield ON', () => {
  const { saved } = resolveScenario({mafiaTarget:'c1',doctorSave:'c1',vigilanteTarget:'gf'}, {settings:Object.assign(state().settings,{gfImmune:true})});
  assert(saved.players.find(p=>p.id==='gf').alive, 'shielded Godfather was removed');
});

test('T20', 'Godfather shield OFF', () => {
  const { saved } = resolveScenario({mafiaTarget:'c1',doctorSave:'c1',vigilanteTarget:'gf'}, {settings:Object.assign(state().settings,{gfImmune:false})});
  assert(!saved.players.find(p=>p.id==='gf').alive, 'unshielded Godfather survived');
});

test('T21', 'Vigilante selects Citizen and is removed', () => {
  const { saved } = resolveScenario({mafiaTarget:'c1',doctorSave:'c1',vigilanteTarget:'c2'});
  assert(saved.players.find(p=>p.id==='c2').alive && !saved.players.find(p=>p.id==='vig').alive, 'Citizen/Vigilante consequence was wrong');
});

test('T22', 'Vigilante selects protected Mafia', () => {
  const { saved } = resolveScenario({mafiaTarget:'c1',doctorSave:'c1',vigilanteTarget:'lec',lecterShield:'lec'});
  assert(saved.players.find(p=>p.id==='lec').alive, 'protected Mafia was removed');
});

test('T23', 'Vigilante selects unprotected Mafia', () => {
  const { saved } = resolveScenario({mafiaTarget:'c1',doctorSave:'c1',vigilanteTarget:'lec',lecterShield:'gf'});
  assert(!saved.players.find(p=>p.id==='lec').alive, 'unprotected Mafia survived');
});

test('T24', 'Vigilante and Mafia select same Citizen', () => {
  const { saved } = resolveScenario({mafiaTarget:'c1',doctorSave:'c2',vigilanteTarget:'c1'});
  assert(!saved.players.find(p=>p.id==='c1').alive && !saved.players.find(p=>p.id==='vig').alive, 'separate Mafia and Vigilante consequences were not applied');
  assert(saved.nightData.pendingRemoved.length === 2, 'removals were not deduplicated');
});

test('T25', 'Vigilante skips without counter increase', () => {
  const { w } = createApp(state({currentState:'NIGHT.VIGILANTE_SELECT',phase:'night'}));
  choose(w,'pick',''); click(w,'Confirm Action / Pass'); const saved=savedState(w);
  assert(saved.counters.actions===0 && !saved.nightData.vigilanteTarget, 'Pass consumed a shot or created a target');
});

function fakePromptTest(id, stateName, roleId, label) {
  test(id, `Fake ${label} prompt`, () => {
    const roster=players().map(p=>Object.assign({},p,p.id===roleId?{alive:false}:{}));
    const {w}=createApp(state({currentState:stateName,phase:'night',players:roster}));
    assert(text(w).includes('FAKE STEP'), `${label} fake note missing`); click(w,stateName==='NIGHT.LECTER'?'Fake Step Completed':'Wake Confirmed');
    const saved=savedState(w); assert(saved.nightData.fakeRoles.length===1, 'fake role was not logged in state');
  });
}
fakePromptTest('T26','NIGHT.VIGILANTE_PROMPT','vig','Vigilante');
fakePromptTest('T27','NIGHT.LECTER','lec','Lecter');
fakePromptTest('T28','NIGHT.DETECTIVE_PROMPT','det','Detective');
fakePromptTest('T29','NIGHT.DOCTOR_PROMPT','doc','Doctor');

test('T30', 'Public announcement contains no role information', () => {
  const { saved } = resolveScenario({mafiaTarget:'c1',vigilanteTarget:'lec',lecterShield:'gf'});
  assert(!/Mafia|Citizen|Vigilante|Lecter|Doctor|Detective|shield|save/i.test(saved.nightData.publicAnnouncement), 'public announcement leaked role/reason');
});

test('T31', 'Inquiry outputs side counts only', () => {
  const roster=players().map(p=>Object.assign({},p,['lec','c3'].includes(p.id)?{alive:false}:{})); const {w,alerts}=createApp(state({players:roster}));
  click(w,'Announce Eliminated Side Counts'); const message=alerts.at(-1);
  assert(message.includes('Mafia-side out: 1')&&message.includes('Citizen-side out: 1')&&!message.includes('Lee')&&!message.includes('Chris'),'inquiry leaked identity or wrong counts');
});

test('T32', 'Day 2 morning announcement is a locked state', () => {
  const {w}=createApp(state({currentState:'DAY.MORNING_ANNOUNCEMENT',phase:'day',day:1,night:1,nightData:Object.assign(state().nightData,{publicAnnouncement:'No one left the game overnight.',resolved:true})}));
  assert(text(w).includes('Day 2 — Morning Announcement')&&text(w).includes('Confirm Morning Announcement'),'Day 2 announcement state missing');
});

test('T33', 'Day 2 conversation follows announcement', () => {
  const {w}=createApp(state({currentState:'DAY.MORNING_ANNOUNCEMENT',phase:'day',day:1,night:1,nightData:Object.assign(state().nightData,{publicAnnouncement:'No one left the game overnight.',resolved:true})}));
  click(w,'Confirm Morning Announcement'); assert(savedState(w).day===2&&savedState(w).currentState==='DAY.CONVERSATION','announcement did not transition to Day 2 conversation');
});

test('T34', 'Conviction majority passes', () => {
  const {w}=createApp(state({currentState:'DAY.CONVICTION_VOTE',day:2,nomination:Object.assign(state().nomination,{current:'c1'})}));
  castConvictionVotes(w,['gf','lec','det','doc']); click(w,'Calculate & Continue'); assert(savedState(w).nomination.defence.includes('c1'),'majority did not enter defence');
});

test('T35', 'Exactly half conviction fails', () => {
  const roster=players().map(player=>Object.assign({},player,player.id==='c3'?{alive:false}:{}));
  const {w}=createApp(state({currentState:'DAY.CONVICTION_VOTE',day:2,players:roster,nomination:Object.assign(state().nomination,{current:'c1'})}));
  castConvictionVotes(w,['gf','lec','det']); click(w,'Calculate & Continue'); assert(!savedState(w).nomination.defence.includes('c1'),'exactly half incorrectly passed');
});

test('T36', 'Single-defendant final vote', () => {
  const nom=Object.assign(state().nomination,{defence:['c1'],speechDone:['c1']}); const {w}=createApp(state({currentState:'DAY.FINAL_VOTE_SINGLE',day:2,nomination:nom}));
  castSingleVotes(w,['gf','lec','det','doc','vig']); click(w,'Calculate Result'); assert(!savedState(w).players.find(p=>p.id==='c1').alive,'single final majority did not remove');
});

function multiVoteApp() {
  const nom=Object.assign(state().nomination,{defence:['c1','c2'],speechDone:['c1','c2']}); return createApp(state({currentState:'DAY.FINAL_VOTE_MULTI',day:2,nomination:nom}));
}
test('T37', 'Multiple-defendant blind vote', () => { const {w}=multiVoteApp(); for(const id of ['gf','lec','det','doc','vig','c3']) choose(w,`vote_${id}`,'c1'); click(w,'Calculate Result'); assert(!savedState(w).players.find(p=>p.id==='c1').alive,'blind majority did not remove'); });
test('T38', 'Defence players excluded from blind vote', () => { const {w}=multiVoteApp(); assert(!w.document.getElementById('vote_c1')&&!w.document.getElementById('vote_c2'),'defence player received a ballot'); });
test('T39', 'No blank ballots in blind vote', () => { const {w,alerts}=multiVoteApp(); click(w,'Calculate Result'); assert(alerts.some(m=>m.includes('Every eligible voter')),'blank blind ballot accepted'); });
test('T40', 'No majority means no removal', () => { const {w}=multiVoteApp(); const votes={gf:'c1',lec:'c1',det:'c1',doc:'c2',vig:'c2',c3:'c2'}; Object.entries(votes).forEach(([v,c])=>choose(w,`vote_${v}`,c)); click(w,'Calculate Result'); assert(savedState(w).players.every(p=>p.alive),'no-majority vote removed a player'); });
test('T41', 'Tie without majority means no removal', () => { const {w}=multiVoteApp(); const ids=['gf','lec','det','doc','vig','c3']; ids.forEach((v,i)=>choose(w,`vote_${v}`,i<3?'c1':'c2')); click(w,'Calculate Result'); assert(savedState(w).nomination.removedId==='','tie created a removal'); });

test('T42', 'Resume mid-night', () => { const first=createApp(state({currentState:'NIGHT.MAFIA_SELECT',phase:'night'})); const second=createApp(savedState(first.w)); assert(second.w.document.querySelector('#pick')&&savedState(second.w).currentState==='NIGHT.MAFIA_SELECT','mid-night resume failed'); });
test('T43', 'Resume mid-nomination', () => { const first=createApp(state({currentState:'DAY.CONVICTION_VOTE',day:2,nomination:Object.assign(state().nomination,{current:'c1'})})); const second=createApp(savedState(first.w)); assert(text(second.w).includes('Conviction Vote')&&text(second.w).includes('Cam'),'mid-nomination resume failed'); });
test('T44', 'Resume mid-final-vote', () => { const first=multiVoteApp(); const second=createApp(savedState(first.w)); assert(text(second.w).includes('Blind Final Vote'),'mid-final-vote resume failed'); });
test('T45', 'Undo Night selection', () => { const {w}=createApp(state({currentState:'NIGHT.MAFIA_SELECT',phase:'night'})); choose(w,'pick','c1'); click(w,'Confirm Mafia Target'); w.undoLast(); const saved=savedState(w); assert(saved.currentState==='NIGHT.MAFIA_SELECT'&&!saved.nightData.mafiaTarget,'Night undo failed'); });
test('T46', 'Undo Day vote', () => { const nom=Object.assign(state().nomination,{defence:['c1'],speechDone:['c1']}); const {w}=createApp(state({currentState:'DAY.FINAL_VOTE_SINGLE',day:2,nomination:nom})); castSingleVotes(w,['gf','lec','det','doc','vig']); click(w,'Calculate Result'); w.undoLast(); assert(savedState(w).players.find(p=>p.id==='c1').alive&&savedState(w).currentState==='DAY.FINAL_VOTE_SINGLE','Day vote undo failed'); });
test('T47', 'Citizens win', () => { const roster=players().map(p=>Object.assign({},p,['gf','lec'].includes(p.id)?{alive:false}:{})); const {w}=createApp(state({players:roster})); w.checkWin(); assert(savedState(w).winner==='Citizens'&&savedState(w).currentState==='GAME.COMPLETE','Citizens win missing'); });
test('T48', 'Mafia win', () => { const roster=players().map(p=>Object.assign({},p,['det','doc','vig','c2','c3'].includes(p.id)?{alive:false}:{})); const {w}=createApp(state({players:roster})); w.checkWin(); assert(savedState(w).winner==='Mafia','Mafia win missing'); });
test('T49', 'Unlimited Day/Night progression', () => { const {w}=createApp(state({currentState:'DAY.RESULT',day:12,night:11,nomination:Object.assign(state().nomination,{resultText:'No removal.'})})); click(w,'Confirm Result & Continue'); assert(savedState(w).currentState==='NIGHT.EVERYONE_SLEEP'&&savedState(w).night===12,'cycle was capped'); });
test('T50', 'Reset requires two confirmations', () => { const {w}=createApp(state(),{confirmations:[true,false]}); w.resetGame(); assert(savedState(w).players.length===8,'cancelled second reset erased game'); });

test('T51', 'Health Check catches corruption', () => { const corrupt=state({players:players().map((p,i)=>Object.assign({},p,{id:i<2?'duplicate':p.id}))}); const {w}=createApp(corrupt); assert(text(w).includes('Saved Game Needs Recovery')&&text(w).includes('Player IDs are not unique'),'corruption was not blocked'); });
test('T52', 'No duplicate render path', () => { const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8'); assert((source.match(/function render\s*\(/g)||[]).length===1,'more than one render function exists'); assert(!/rev15-(day|night|core|boot)/.test(fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8')),'legacy engine loaded'); });
test('T53', 'No console errors', () => { const {errors}=createApp(); assert(errors.length===0,`console errors: ${errors.join('; ')}`); });
test('T54', 'Full simulated game reaches Citizens win', () => { const roster=players().map(p=>Object.assign({},p,p.id==='lec'?{alive:false}:{})); const nom=Object.assign(state().nomination,{defence:['gf'],speechDone:['gf']}); const {w}=createApp(state({currentState:'DAY.FINAL_VOTE_SINGLE',day:3,players:roster,nomination:nom})); castSingleVotes(w,['gf','det','doc','vig','c1']); click(w,'Calculate Result'); click(w,'Confirm Result & Continue'); assert(savedState(w).winner==='Citizens','simulated game did not reach Citizens win'); });
test('T55', 'Full simulated game reaches Mafia win', () => { const roster=players().map(p=>Object.assign({},p,['det','doc','c2','c3'].includes(p.id)?{alive:false}:{})); const {w}=createApp(night({players:roster,nightData:Object.assign(state().nightData,{mafiaTarget:'c1',vigilanteTarget:''})})); click(w,'Calculate Night Result'); click(w,'Confirm Private Result'); click(w,'Confirm Morning Announcement'); assert(savedState(w).winner==='Mafia','simulated game did not reach Mafia win'); });
test('T56', 'Dashboard visible during Day', () => { const {w}=createApp(state({currentState:'DAY.CONVERSATION'})); assert(w.document.getElementById('dash').textContent.includes('DAY.CONVERSATION'),'Day dashboard missing exact state'); });
test('T57', 'Dashboard visible during Night', () => { const {w}=createApp(state({currentState:'NIGHT.MAFIA_SELECT',phase:'night'})); assert(w.document.getElementById('dash').textContent.includes('NIGHT.MAFIA_SELECT'),'Night dashboard missing exact state'); });
test('T58', 'Dashboard does not contain interactive controls', () => { const {w}=createApp(); assert(w.document.querySelectorAll('#dash button,#dash input,#dash select').length===0,'dashboard contains or blocks controls'); assert(w.document.querySelector('#app button'),'handler control missing below dashboard'); });
test('T59', 'All visual modes are assigned', () => { for(const currentState of ['SETUP.START_TIME','REVEAL.PLAYER','DAY.CONVERSATION','NIGHT.EVERYONE_SLEEP','GAME.COMPLETE']) { const s=state({currentState,finished:currentState==='GAME.COMPLETE',winner:'Citizens',reason:'test'}); if(currentState.startsWith('SETUP.')){s.players=[];s.names=[];} const {w}=createApp(s); const mode=w.document.body.dataset.mode; assert(mode&&w.document.body.style.backgroundImage.includes(`background-${mode}.svg`),`visual mode missing for ${currentState}`); assert(fs.existsSync(path.join(__dirname,'..',`background-${mode}.svg`)),`visual asset missing for ${mode}`); } });
test('T60', 'Rev 16 save migration', () => { const legacy=state(); delete legacy.currentState; delete legacy.settings.lecterSelfShields; delete legacy.counters.lecterSelf; legacy.appVersion=16; legacy.phase='day'; legacy.day=2; legacy.step='talk'; const {w}=createApp(legacy); const saved=savedState(w); assert(saved.appVersion===17&&saved.currentState==='DAY.CONVERSATION'&&saved.settings.lecterSelfShields===1,'Rev 16 migration failed'); });

test('T61', 'Dr. Lecter self-shield limit is separately enforced', () => { const {w}=createApp(state({currentState:'NIGHT.LECTER',phase:'night',counters:{self:0,lecterSelf:0,actions:0}})); choose(w,'pick','lec'); click(w,'Confirm Shield'); assert(savedState(w).counters.lecterSelf===1,'Lecter self-shield counter did not increment'); });
test('T62', 'Godfather shield is a required Setup Yes/No state', () => { const {w}=createApp(state({currentState:'SETUP.GODFATHER_SHIELD',phase:'setup',setupStep:6,players:[]})); assert(text(w).includes('YES')&&text(w).includes('NO'),'Godfather agreement missing'); });

test('T63', 'Blind final vote offers an explicit None choice', () => {
  const {w}=multiVoteApp();
  for(const id of ['gf','lec','det','doc','vig','c3']) {
    const ballot=w.document.getElementById(`vote_${id}`);
    assert(Array.from(ballot.options).some(option=>option.value==='none'),'None choice missing from blind ballot');
    choose(w,`vote_${id}`,'none');
  }
  click(w,'Calculate Result');
  const saved=savedState(w);
  assert(saved.players.every(player=>player.alive),'None ballots removed a player');
  assert(saved.nomination.finalVotes.none===6,'None ballots were not recorded');
});

test('T64', 'Single-defendant final vote records None votes', () => {
  const nom=Object.assign(state().nomination,{defence:['c1'],speechDone:['c1']});
  const {w}=createApp(state({currentState:'DAY.FINAL_VOTE_SINGLE',day:2,nomination:nom}));
  assert(text(w).includes('None — keep Cam'),'single final vote does not explain None');
  castSingleVotes(w,['gf','lec','det']); click(w,'Calculate Result');
  assert(savedState(w).players.find(player=>player.id==='c1').alive,'None majority removed the defendant');
});

test('T65', 'Imported saved game resumes the exact unfinished voting step', () => {
  const {w}=createApp();
  const imported=state({currentState:'DAY.FINAL_VOTE_MULTI',day:2,nomination:Object.assign(state().nomination,{defence:['c1','c2'],speechDone:['c1','c2']})});
  assert(w.restoreImportedState({state:imported})===true,'valid saved game was not imported');
  const saved=savedState(w);
  assert(saved.currentState==='DAY.FINAL_VOTE_MULTI'&&text(w).includes('Blind Final Vote'),'import did not resume the exact voting step');
  assert(text(w).includes('None — convict nobody'),'imported voting screen is missing None');
});

test('T66', 'Citizen-side night roles wake, act, and sleep one at a time', () => {
  const {w}=createApp(state({currentState:'NIGHT.MAFIA_SLEEP',phase:'night'}));
  advancePrompt(w);
  assert(savedState(w).currentState==='NIGHT.DETECTIVE_PROMPT','Detective was not first after Mafia slept');
  click(w,'Wake Confirmed'); choose(w,'pick','c1'); click(w,'Show Private Result');
  assert(savedState(w).currentState==='NIGHT.DETECTIVE_SLEEP'&&text(w).includes('Detective Sleeps'),'Doctor could wake before Detective slept');
  click(w,'Asleep — Continue'); click(w,'Wake Confirmed'); choose(w,'pick','c1'); click(w,'Confirm Save');
  assert(savedState(w).currentState==='NIGHT.DOCTOR_SLEEP'&&text(w).includes('Citizen Doctor Sleeps'),'Vigilante could wake before Citizen Doctor slept');
  click(w,'Asleep — Continue'); click(w,'Wake Confirmed'); choose(w,'pick',''); click(w,'Confirm Action / Pass');
  assert(savedState(w).currentState==='NIGHT.VIGILANTE_SLEEP'&&text(w).includes('Vigilante / Sniper Sleeps'),'Night resolved before Vigilante / Sniper slept');
  click(w,'Asleep — Continue');
  assert(savedState(w).currentState==='NIGHT.RESOLVE','private role sequence did not reach Night resolution');
});

test('T67', 'Detective and Citizen Doctor cannot pass', () => {
  const detective=createApp(state({currentState:'NIGHT.DETECTIVE_SELECT',phase:'night'}));
  click(detective.w,'Show Private Result');
  assert(detective.alerts.some(message=>message.includes('Select a player')),'Detective passed without an inquiry');
  const doctor=createApp(state({currentState:'NIGHT.DOCTOR_SELECT',phase:'night'}));
  click(doctor.w,'Confirm Save');
  assert(doctor.alerts.some(message=>message.includes('Select a player')),'Citizen Doctor passed without a save');
});

test('T68', 'Detective receives a clear NO for Citizen-side players', () => {
  const {w,alerts}=createApp(state({currentState:'NIGHT.DETECTIVE_SELECT',phase:'night'}));
  choose(w,'pick','c1'); click(w,'Show Private Result');
  assert(alerts.at(-1).includes('Cam: NO — does not appear Mafia'),'Citizen-side inquiry did not return a clear NO');
});

test('T69', 'Older Rev 17 Night save migrates to a safe private boundary', () => {
  const old=state({currentState:'NIGHT.DOCTOR_SELECT',phase:'night'});
  delete old.nightPrivacyVersion;
  old.nightData=Object.assign({},old.nightData,{detectiveCheck:'c1',detectiveResult:'Cam: Citizen'});
  const {w}=createApp(old);
  const saved=savedState(w);
  assert(saved.currentState==='NIGHT.DETECTIVE_SLEEP','old Doctor-selection save did not return to Detective sleep confirmation');
  assert(text(w).includes('Detective Sleeps'),'migrated save did not show the privacy boundary');
});

test('T70', 'Open final vote starts with no assumed ballots', () => {
  const nom=Object.assign(state().nomination,{defence:['c1'],speechDone:['c1']});
  const {w,alerts}=createApp(state({currentState:'DAY.FINAL_VOTE_SINGLE',day:4,nomination:nom}));
  assert([...w.document.querySelectorAll('[id^="singleVote_"]')].every(ballot=>ballot.value===''),'open final vote pre-filled an assumed result');
  click(w,'Calculate Result');
  assert(alerts.some(message=>message.includes('Every eligible voter')),'unfinished individual ballots were accepted');
});

test('T71', 'Every living player including the defendant receives one open ballot', () => {
  const nom=Object.assign(state().nomination,{defence:['c1'],speechDone:['c1']});
  const {w}=createApp(state({currentState:'DAY.FINAL_VOTE_SINGLE',day:4,nomination:nom}));
  const ballots=[...w.document.querySelectorAll('[id^="singleVote_"]')];
  assert(ballots.length===players().length,'open vote did not create exactly one ballot per living voter');
  assert(w.document.getElementById('singleVote_c1'),'defendant did not receive a ballot');
  assert(ballots.every(ballot=>[...ballot.options].some(option=>option.value==='yes')&&[...ballot.options].some(option=>option.value==='none')),'Convict/None choices missing');
});

test('T72', 'Conviction vote gives one ballot to every living non-nominee', () => {
  const {w,alerts}=createApp(state({currentState:'DAY.CONVICTION_VOTE',day:4,nomination:Object.assign(state().nomination,{current:'c1'})}));
  const ballots=[...w.document.querySelectorAll('[id^="convictionVote_"]')];
  assert(ballots.length===players().length-1,'conviction vote did not create one ballot per eligible non-nominee');
  assert(!w.document.getElementById('convictionVote_c1'),'nominee received a conviction ballot');
  click(w,'Calculate & Continue');
  assert(alerts.some(message=>message.includes('Every eligible voter')),'blank conviction ballots were accepted');
});

test('T73', 'Role reveal provides concise ability, limitation and goal guidance', () => {
  const roster=players();
  const required={
    Godfather:['Detective','protected','Goal:'],
    Lecter:['shield','yourself','Goal:'],
    Detective:['YES — appears Mafia','Godfather','Goal:'],
    Doctor:['protect','self','Goal:'],
    Vigilante:['Pass','Citizen-side player','Goal:'],
    Citizen:['no private night action','vote','Goal:'],
  };
  for (const [role,phrases] of Object.entries(required)) {
    const player=roster.find(item=>item.role===role);
    const {w}=createApp(state({currentState:'REVEAL.PLAYER',phase:'reveal',revealIndex:roster.indexOf(player),seen:roster.slice(0,roster.indexOf(player)).map(item=>item.id),players:roster}));
    click(w,'Pass Phone');
    w.document.querySelector('#passView button').click();
    const reveal=w.document.getElementById('roleView').textContent;
    for (const phrase of phrases) assert(reveal.includes(phrase),`${role} reveal is missing ${phrase}`);
  }
});

test('T74', 'Vigilante / Sniper is the player-facing name without changing save compatibility', () => {
  const roster=players();
  const vigilante=roster.find(player=>player.role==='Vigilante');
  const reveal=createApp(state({currentState:'REVEAL.PLAYER',phase:'reveal',revealIndex:roster.indexOf(vigilante),seen:[],players:roster}));
  click(reveal.w,'Pass Phone'); reveal.w.document.querySelector('#passView button').click();
  assert(reveal.w.document.getElementById('mRole').textContent==='Vigilante / Sniper','reveal did not show both names');
  assert(savedState(reveal.w).players.find(player=>player.id==='vig').role==='Vigilante','internal saved role key changed');
  const night=createApp(state({currentState:'NIGHT.VIGILANTE_PROMPT',phase:'night'}));
  assert(text(night.w).includes('Vigilante / Sniper Wakes'),'night prompt did not show both names');
});

console.log(`\n${passed} acceptance tests passed.`);
if (failures.length) { console.error('\n=== ACCEPTANCE FAILURES ===\n'+failures.join('\n\n')); process.exit(1); }
