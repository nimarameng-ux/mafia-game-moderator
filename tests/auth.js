const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const authSource = fs.readFileSync(path.join(root, "auth.js"), "utf8");
const handler = require(path.join(root, "api", "access.js"));

function invoke(method, { body, cookie, ip = "203.0.113.10" } = {}) {
  return new Promise((resolve) => {
    const headers = {};
    const req = {
      method,
      body,
      headers: {
        cookie: cookie || "",
        "x-forwarded-for": ip,
      },
      socket: { remoteAddress: ip },
    };
    const res = {
      statusCode: 200,
      setHeader(name, value) {
        headers[name.toLowerCase()] = value;
      },
      status(code) {
        res.statusCode = code;
        return res;
      },
      json(payload) {
        resolve({ status: res.statusCode, headers, body: payload });
      },
    };
    handler(req, res);
  });
}

function response(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return data;
    },
  };
}

function page(fetchImpl) {
  const document = html
    .replace('<script src="auth.js?v=1"></script>', `<script>${authSource}</script>`)
    .replace('<script src="app.js?v=17"></script>', "");
  return new JSDOM(document, {
    runScripts: "dangerously",
    url: "https://example.test/",
    beforeParse(window) {
      window.fetch = fetchImpl;
    },
  });
}

async function settle(dom) {
  await new Promise((resolve) => dom.window.setTimeout(resolve, 30));
}

(async () => {
  const oldCode = process.env.MAFIA_WEEKLY_ACCESS_CODE;
  const oldSecret = process.env.MAFIA_ACCESS_COOKIE_SECRET;

  delete process.env.MAFIA_WEEKLY_ACCESS_CODE;
  delete process.env.MAFIA_ACCESS_COOKIE_SECRET;
  const missing = await invoke("GET");
  assert.equal(missing.status, 503);

  process.env.MAFIA_WEEKLY_ACCESS_CODE = "Raven-8472-Gold";
  process.env.MAFIA_ACCESS_COOKIE_SECRET = "test-cookie-secret-with-more-than-32-characters";

  const wrong = await invoke("POST", {
    body: { accessCode: "incorrect-code" },
    ip: "203.0.113.11",
  });
  assert.equal(wrong.status, 401);

  const accepted = await invoke("POST", {
    body: { accessCode: "Raven-8472-Gold" },
    ip: "203.0.113.12",
  });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.authorized, true);
  assert.match(accepted.headers["set-cookie"], /HttpOnly/);
  assert.match(accepted.headers["set-cookie"], /Secure/);
  assert.match(accepted.headers["set-cookie"], /SameSite=Lax/);

  const cookie = accepted.headers["set-cookie"].split(";", 1)[0];
  const status = await invoke("GET", { cookie });
  assert.equal(status.status, 200);
  assert.equal(status.body.authorized, true);

  process.env.MAFIA_WEEKLY_ACCESS_CODE = "Falcon-2916-Wine";
  const afterRotation = await invoke("GET", { cookie });
  assert.equal(afterRotation.status, 401, "changing the weekly code invalidates the old cookie");

  const signedOut = await invoke("DELETE", { cookie });
  assert.equal(signedOut.status, 200);
  assert.match(signedOut.headers["set-cookie"], /Max-Age=0/);

  {
    const dom = page(async () => response(401, { authorized: false }));
    await settle(dom);
    assert.ok(dom.window.document.getElementById("auth-access-form"));
    assert.equal(dom.window.document.body.classList.contains("auth-locked"), true);
    dom.window.close();
  }

  {
    const dom = page(async (_url, options = {}) => {
      if (options.method === "POST") {
        return response(200, {
          authorized: true,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        });
      }
      return response(401, { authorized: false });
    });
    await settle(dom);
    const form = dom.window.document.getElementById("auth-access-form");
    dom.window.document.getElementById("auth-access-code").value = "Raven-8472-Gold";
    form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    await settle(dom);
    assert.equal(dom.window.document.body.classList.contains("auth-locked"), false);
    assert.equal(dom.window.document.getElementById("auth-gate").hidden, true);
    assert.equal(dom.window.document.getElementById("auth-account-button").hidden, false);
    dom.window.MafiaAuth.openAccount();
    assert.match(dom.window.document.getElementById("auth-card").textContent, /Access active/);
    dom.window.close();
  }

  {
    const dom = page(async () => response(503, { message: "Not configured" }));
    await settle(dom);
    assert.match(dom.window.document.getElementById("auth-card").textContent, /Access setup required/);
    assert.equal(dom.window.document.body.classList.contains("auth-locked"), true);
    dom.window.close();
  }

  if (oldCode === undefined) delete process.env.MAFIA_WEEKLY_ACCESS_CODE;
  else process.env.MAFIA_WEEKLY_ACCESS_CODE = oldCode;
  if (oldSecret === undefined) delete process.env.MAFIA_ACCESS_COOKIE_SECRET;
  else process.env.MAFIA_ACCESS_COOKIE_SECRET = oldSecret;

  console.log("Weekly access gate: all tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
