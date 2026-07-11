# Manual Smoke Test Checklist — Rev 16 Architecture Cleanup

Run this on an actual phone in a real browser before approving the PR.
Automated coverage for the same behaviour lives in `tests/` (`npm test`).

## Before you start
- Use a private/incognito window, or clear site data for this origin first,
  so you're testing a genuinely fresh load — not a cached previous session.

## Checklist

- [ ] **Page loads with no console errors.** Open dev tools / remote debug
      console before loading the page. Load the app. Confirm the console
      shows only the one expected line — `Startup self-check passed —
      Rev16.0 · Architecture Cleanup` — and no red errors.
- [ ] **No old-screen flash on startup.** Watch the very first paint
      closely (or screen-record it). You should see Setup 1/8 appear once,
      cleanly — not a flash of one screen replaced by another.
- [ ] **Only one render path executes.** Confirm the credit line at the
      bottom reads "by Nima · Rev16.0 · Architecture Cleanup" immediately
      on load (proves app.js's single startup path ran, not a leftover
      Rev 14/Rev 15 path).
- [ ] **Menu works.** Tap the header "Menu" button. Confirm you see
      "Continue Game", "Health Check", and "Full Reset" — all three
      present and tappable.
- [ ] **Health Check works.** From the header, tap "Health Check" directly.
      Confirm it shows setup validity status. Then go back (Menu →
      Continue Game or the header again), open Menu, and tap the
      "Health Check" shortcut inside Menu — confirm it reaches the same
      screen.
- [ ] **Reset requires confirmation.** From Menu, tap "Full Reset". Confirm
      TWO separate confirmation prompts appear before anything is erased.
      Cancel on the first prompt — confirm nothing is deleted and you're
      back on the previous screen.
- [ ] **Service worker only handles caching, not application logic.** In
      dev tools → Application → Service Workers, confirm the cache name is
      `mafia-rev16-app-shell`. Open dev tools → Network, hard-reload, and
      confirm `app.js` is requested and served as a plain script — the
      response body should be exactly `app.js`'s contents, with no extra
      `<script>` tags appended to the HTML.
- [ ] **Current visual styling remains unchanged.** Compare the Setup,
      Reveal, Day, and Night screens against a version of the app from
      before this PR (or against the CSS in `index.html`, which was not
      touched). Red/black/gold theme, layout, and fonts should be
      pixel-identical.
- [ ] **App state is not silently deleted.** Play through Setup with a
      real set of names, reach the private Reveal step for at least one
      player, then close the browser tab entirely and reopen the app.
      Confirm you resume exactly where you left off, with the same names
      and progress — nothing reset.
- [ ] **Existing in-progress games survive the upgrade.** If you have a
      save from before this PR sitting in a test device's browser, open
      the app and confirm it resumes normally rather than resetting to
      Setup. (Automated equivalent: `npm run test:migration`.)
- [ ] **Full round trip.** Complete Setup end-to-end, go through private
      Reveal for every player, play Day 1's conversation round, move to
      Night 1, and complete a full night. Confirm no console errors occur
      at any point in this full sequence.

## Known limitation to expect during this checklist

Day 2 onward still behaves exactly like Day 1 (conversation only, straight
to Night — no nomination/voting yet). That is intentional for this PR; see
"Known Remaining Issues" in the PR description. Do not treat the absence
of a nomination/voting screen as a smoke-test failure.
