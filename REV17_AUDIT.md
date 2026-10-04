# Rev 17 audit and implementation record

Authoritative source: `Mafia_Game_Moderator_Rev17_Master_Functional_Specification_v1.0.md`, plus the owner's clarification that Vigilante shots, Citizen Doctor self-saves, and Dr. Lecter self-shields are Setup agreements (minimum/default 1), and Godfather shield is a required Yes/No agreement.

## Rev 16 Night 1 root cause

Rev 16 loaded only `app.js`. After `NIGHT.EVERYONE_SLEEP`, its stale numeric stage engine advanced directly to Mafia selection. The intended Mafia wake/identify and full role sequence existed only in unreferenced `rev15-*.js` files. There was no thrown exception: the defect was an incorrect live state transition caused by the incomplete active engine and unreachable alternate engine.

The regression test in `tests/night1-regression.js` was added before the fix. Against `claude/rev16-architecture-cleanup` it fails because “Mafia Wakes” is skipped; against Rev 17 it must pass.

## Rev 16 audit summary

- Day 1 conversation existed, but Day 2 nomination, conviction, defence, final voting, and result states were not live.
- Night used four numeric stages and omitted Mafia identify, Lecter, Detective, fake prompts, private/public separation, and approved Vigilante consequences.
- Rev 15 files contained overlapping logic but were not loaded, violating reachability and one-engine requirements.
- Health Check displayed generic assurances rather than validating schema and game invariants.
- Save migration was additive only at the top level and did not provide safe recovery for corrupt data.
- The dashboard omitted the exact state, Godfather agreement, announcements, and save status.
- Automated coverage stopped before a complete Night and did not exercise either full win outcome.

## Clarifications and explicit interpretations

- Dr. Lecter allocation retains Rev 16 compatibility: include Lecter when Mafia count is at least 2 and total players are at least 7.
- Inquiry is available during Day conversation and has no configurable limit because the master Setup list defines no inquiry allowance.
- The morning announcement is modeled as `DAY.MORNING_ANNOUNCEMENT`, reached after `NIGHT.PRIVATE_SUMMARY` and confirmed before Day conversation.
- A post-announcement correction requires two explicit confirmations, restores the pre-announcement checkpoint, and is permanently logged as a controlled correction.
- Dr. Lecter self-shields are counted only when Lecter shields themselves; shielding another living Mafia-side player does not consume the allowance.
- Final voting includes an explicit None ballot. For one defendant, every living player—including the defendant—receives an individual open Convict/None ballot. For multiple defendants, every eligible non-defendant receives an individual blind nominee/None ballot. None is a completed vote but contributes to no defendant; blank ballots remain invalid.
- The nomination conviction gate also uses individual ballots: every living player except the nominee receives one Send-to-defence/Do-not-send ballot. The nominee cannot vote, and the majority is calculated from the remaining eligible voters.
- The owner's privacy clarification supersedes the original grouped Night prompts: after Mafia sleeps, Detective, Citizen Doctor, and Vigilante each wake, act, and explicitly return to sleep before the next role wakes. Only Vigilante may Pass. Older Rev 17 saves are moved back to the nearest safe sleep boundary during migration.
- Detective output is expressed as **YES — appears Mafia** or **NO — does not appear Mafia**. Citizen-side roles and Godfather return NO; regular Mafia and Dr. Lecter return YES.

## Staged implementation plan

1. Preserve the failing Night 1 regression and migrate the engine to explicit named states.
2. Complete Setup, reveal, Day 1, Day 2+ voting, Night ordering, and resolution rules.
3. Correct Vigilante, Doctor, Lecter, Godfather, fake-prompt, and public/private behavior.
4. Add exact persistence, migration, recovery export, controlled undo/correction, and real health validation.
5. Implement and pass the 60-case acceptance suite and both complete-game simulations.
6. Only after logic is green, update the dashboard and original repository-hosted visual modes.
7. Run mobile browser checks, create screenshots/ZIP/patch, publish a draft PR, and obtain a Vercel preview. Never merge.

## Canonical state flow

`SETUP.* → REVEAL.PLAYER → DAY.INTRO → DAY.CONVERSATION → NIGHT.* → DAY.MORNING_ANNOUNCEMENT → DAY.CONVERSATION → DAY.NOMINATION → DAY.CONVICTION_VOTE → DAY.DEFENCE_SPEECH → DAY.FINAL_VOTE_* → DAY.RESULT → NIGHT.* → GAME.COMPLETE`
