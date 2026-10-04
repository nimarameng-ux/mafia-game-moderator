# Weekly access-code setup

The app now uses one shared weekly access code. It does not send SMS, WhatsApp,
or email, so there is no messaging charge.

The game engine and saved games are unchanged. Existing progress continues to
use the same local storage format on each device.

## First-time Vercel setup

1. Open the Mafia Game Moderator project in Vercel.
2. Open **Settings → Environment Variables**.
3. Create an environment variable named `MAFIA_WEEKLY_ACCESS_CODE`.
4. Give it a random code containing at least 10 characters, for example
   `Raven-8472-Gold`. Do not use that example as the real code.
5. Create a second environment variable named `MAFIA_ACCESS_COOKIE_SECRET`.
6. Give the cookie secret at least 32 random characters. This is a permanent
   private technical secret; do not share it with players and do not change it
   during normal weekly rotations.
7. Apply both variables to **Production** and **Preview**.
8. Redeploy the latest build.

Never put either value in GitHub, `auth.js`, `index.html`, screenshots, or chat.
The values belong only in Vercel's Environment Variables screen.

## Every Sunday after the reminder

1. Create a new random weekly code. A readable three-part code such as
   `Velvet-5931-Falcon` is easier to share while remaining difficult to guess.
2. In Vercel, open **Settings → Environment Variables**.
3. Edit only `MAFIA_WEEKLY_ACCESS_CODE`.
4. Save the new value.
5. Redeploy Production so the new code becomes active.
6. Send the new code privately to the people allowed to use the app.

The previous code and its server-issued access cookies stop validating after
the deployment. A game already open in a browser is not interrupted, but the
new code is required on its next reload or visit.

## What players see

1. The player opens the app.
2. The player enters the weekly access code.
3. The server verifies it without exposing the real code to the browser files.
4. The device receives a secure, HTTP-only access cookie for up to seven days.
5. The player can manually lock that device from the **Account** button.

Five incorrect attempts from the same connection trigger a fifteen-minute
cooldown. Use a unique code of at least 14 characters for the strongest
practical protection.

## Important limitations

- This is shared access, not individual user approval.
- Anyone can pass the weekly code to another person.
- One individual cannot be suspended without changing the code for everyone.
- The app is static, so its JavaScript files remain publicly downloadable even
  though the live interface and access cookie are gated.
- Opening or reloading the protected app requires an internet connection so the
  server can validate access.

These limitations are acceptable for a small private early release. Individual
accounts can be added later without changing the game engine.
