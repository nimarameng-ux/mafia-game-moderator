(function () {
  "use strict";

  const gate = document.getElementById("auth-gate");
  const card = document.getElementById("auth-card");
  const accountButton = document.getElementById("auth-account-button");
  let expiresAt = null;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function emblem() {
    return '<div class="auth-emblem" aria-hidden="true"><img src="mafia-emblem.png" alt=""></div>';
  }

  function setCard(html) {
    if (card) card.innerHTML = html;
  }

  function lock() {
    document.body.classList.add("auth-locked");
    if (gate) gate.hidden = false;
    if (accountButton) accountButton.hidden = true;
  }

  function unlock() {
    document.body.classList.remove("auth-locked");
    if (gate) gate.hidden = true;
    if (accountButton) accountButton.hidden = false;
  }

  async function request(method, body) {
    const response = await fetch("/api/access", {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try {
      data = await response.json();
    } catch (_error) {}
    return { response, data };
  }

  function renderSetupRequired() {
    lock();
    setCard(
      emblem() +
        '<p class="auth-eyebrow">PRIVATE MODERATOR ACCESS</p>' +
        '<h1>Access setup required</h1>' +
        '<p class="auth-message">The weekly access code has not been configured on this deployment yet.</p>',
    );
  }

  function renderAccessForm(message, isError) {
    lock();
    setCard(
      emblem() +
        '<p class="auth-eyebrow">PRIVATE MODERATOR ACCESS</p>' +
        '<h1>Enter weekly code</h1>' +
        '<p class="auth-message">Ask the game administrator for this week\'s private access code.</p>' +
        '<form id="auth-access-form">' +
        '<label for="auth-access-code">Weekly access code</label>' +
        '<input id="auth-access-code" name="accessCode" type="password" autocomplete="current-password" required minlength="10" placeholder="Enter access code">' +
        '<button type="submit">Open the game</button>' +
        "</form>" +
        (message
          ? '<p class="auth-message' +
            (isError ? " error" : "") +
            '">' +
            escapeHtml(message) +
            "</p>"
          : ""),
    );
    document
      .getElementById("auth-access-form")
      ?.addEventListener("submit", submitAccessCode);
  }

  function renderConnectionError() {
    lock();
    setCard(
      emblem() +
        '<p class="auth-eyebrow">PRIVATE MODERATOR ACCESS</p>' +
        '<h1>Unable to check access</h1>' +
        '<p class="auth-message error">Connect to the internet and try again.</p>' +
        '<div class="actions"><button id="auth-retry">Try again</button></div>',
    );
    document.getElementById("auth-retry")?.addEventListener("click", init);
  }

  async function submitAccessCode(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const code = String(new FormData(form).get("accessCode") || "").trim();
    const button = form.querySelector("button");
    button.disabled = true;
    button.textContent = "Checking…";
    try {
      const result = await request("POST", { accessCode: code });
      if (result.response.ok && result.data.authorized) {
        expiresAt = result.data.expiresAt || null;
        unlock();
        return;
      }
      if (result.response.status === 503) {
        renderSetupRequired();
        return;
      }
      const fallback =
        result.response.status === 429
          ? "Too many attempts. Wait fifteen minutes and try again."
          : "That access code is not correct.";
      renderAccessForm(result.data.message || fallback, true);
    } catch (_error) {
      renderConnectionError();
    }
  }

  function closeAccount() {
    unlock();
  }

  function openAccount() {
    lock();
    const expiry = expiresAt
      ? new Date(expiresAt).toLocaleString([], {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "within seven days";
    setCard(
      emblem() +
        '<p class="auth-eyebrow">WEEKLY ACCESS</p>' +
        '<h1>Access active</h1>' +
        '<span class="auth-status">Unlocked</span>' +
        '<p class="auth-message">This device remains authorised until ' +
        escapeHtml(expiry) +
        ", unless the administrator changes the weekly code sooner.</p>" +
        '<div class="actions"><button id="auth-return">Return to game</button><button class="danger" id="auth-lock-device">Lock this device</button></div>',
    );
    document.getElementById("auth-return")?.addEventListener("click", closeAccount);
    document
      .getElementById("auth-lock-device")
      ?.addEventListener("click", signOut);
  }

  async function signOut() {
    try {
      await request("DELETE");
    } catch (_error) {}
    expiresAt = null;
    renderAccessForm("This device has been locked.");
  }

  async function init() {
    lock();
    setCard(
      emblem() +
        '<p class="auth-eyebrow">PRIVATE MODERATOR ACCESS</p>' +
        '<h1>Checking access…</h1>' +
        '<p class="auth-message">Please wait.</p>',
    );
    try {
      const result = await request("GET");
      if (result.response.ok && result.data.authorized) {
        expiresAt = result.data.expiresAt || null;
        unlock();
      } else if (result.response.status === 503) {
        renderSetupRequired();
      } else {
        renderAccessForm();
      }
    } catch (_error) {
      renderConnectionError();
    }
  }

  window.MafiaAuth = Object.freeze({ openAccount, closeAccount, signOut, refresh: init });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
