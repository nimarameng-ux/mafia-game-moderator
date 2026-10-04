# Rev 17 phone smoke-test checklist

Run on the Vercel preview using a real phone before marking the draft PR ready.

- [ ] Open the preview and confirm `Rev17.0 · Full Game Engine` with no console errors.
- [ ] Confirm Setup requires Vigilante shots, Citizen Doctor self-saves, Dr. Lecter self-shields (minimum/default 1), and Godfather shield Yes/No.
- [ ] Complete Setup and confirm case-insensitive duplicate names are rejected.
- [ ] Reveal every role privately; confirm each role is hidden before the next player is shown.
- [ ] Complete Day 1 and confirm nomination/voting is unavailable.
- [ ] Complete every named Night 1 step: Mafia sleeps, then Detective, Citizen Doctor, and Vigilante each wake, act, and return fully to sleep before the next role wakes.
- [ ] Confirm only the Vigilante may Pass; Detective inquiry and Citizen Doctor save reject a blank action.
- [ ] Confirm Detective shows **YES — appears Mafia** or **NO — does not appear Mafia**, with Godfather returning NO.
- [ ] Confirm the private summary shows targets, protections, Detective result, reasoning, and final removals.
- [ ] Confirm the public announcement contains names only and requires confirmation.
- [ ] Complete Day 2 conversation and nomination; confirm every living non-nominee receives one Send-to-defence/Do-not-send ballot and the nominee receives none.
- [ ] Complete defence and final voting; confirm the single-defendant open vote gives every living player (including the defendant) one Convict/None ballot, while the multiple-defendant blind vote gives every eligible non-defendant one nominee/None ballot.
- [ ] Close and reopen mid-Night; confirm the exact state and recorded selections resume.
- [ ] Close and reopen mid-nomination and mid-final-vote; confirm exact recovery.
- [ ] Eliminate a secret role and confirm its normal-timing fake prompt appears without a selection.
- [ ] Make Vigilante target a Citizen; confirm the Citizen survives that action and Vigilante is removed.
- [ ] Exhaust Doctor and Lecter self-save/self-shield limits; confirm self-selection disappears.
- [ ] Exhaust Vigilante shots; confirm only Pass remains.
- [ ] Use standard Undo before an announcement, then test the double-confirmed controlled correction after an announcement.
- [ ] Continue until Citizens win, then repeat a simulation until Mafia win.
- [ ] Review the full private log and run Health Check; confirm every invariant passes.
- [ ] Confirm reset asks both required questions and Cancel preserves the game.
- [ ] Confirm the sticky dashboard remains readable, does not cover controls, and Setup/Day/Night/Complete backgrounds remain behind the dark overlay.

## Rollback

1. Export the diagnostic JSON and preserve the `nima_mafia_rev14` value.
2. Redeploy `claude/rev16-architecture-cleanup` or revert the Rev 17 commit.
3. Do not clear site data automatically.
4. If the save is currently in a Rev 17-only named state, retain the JSON snapshot and start a controlled new game on Rev 16; Rev 16 cannot safely resume every Rev 17 voting/night state.
