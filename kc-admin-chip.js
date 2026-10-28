/* Adds the couple's "Admin" entry to the footer, gated behind a password that
   is checked by the backend, never by this page. Deliberately out of the menu:
   guests should not see it while navigating. */
(function () {
  var ENDPOINT = "https://mellow-marten-19.convex.site/admin";
  var TARGET = "admin.html";
  var STORED = "kcAdminKey";
  var STYLE_ID = "kc-admin-chip-css";
  var DIALOG_ID = "kc-admin-gate";

  var CSS = [
    "#kc-admin-gate{box-sizing:border-box;position:fixed;top:0;right:0;bottom:0;left:0;z-index:100050;display:flex;align-items:center;justify-content:center;padding:20px;font-family:'playfair-display-v2','playfair display',Georgia,serif;}",
    "#kc-admin-gate[hidden]{display:none;}",
    "#kc-admin-gate .kc-g-backdrop{position:absolute;top:0;right:0;bottom:0;left:0;background:rgba(58,20,16,.62);}",
    "#kc-admin-gate .kc-g-box{box-sizing:border-box;position:relative;width:min(380px,100%);max-height:min(90vh,640px);overflow:auto;padding:28px 26px 24px;border-radius:18px;background:#fff8f0;box-shadow:0 24px 60px rgba(30,10,6,.35);}",
    "#kc-admin-gate .kc-g-mark{display:flex;align-items:center;justify-content:center;width:44px;height:44px;margin:0 0 14px;border-radius:50%;background:rgba(204,34,0,.1);color:#B91C0C;}",
    "#kc-admin-gate .kc-g-kicker{margin:0 0 4px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#B91C0C;opacity:.7;}",
    "#kc-admin-gate .kc-g-title{margin:0 0 8px;font-family:'holy-river',cursive;font-weight:400;font-size:36px;line-height:1.15;color:#B91C0C;}",
    "#kc-admin-gate .kc-g-hint{margin:0 0 22px;font-size:14px;line-height:1.6;color:#B91C0C;opacity:.85;}",
    "#kc-admin-gate .kc-g-lb{display:block;margin:0 0 2px;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#B91C0C;}",
    "#kc-admin-gate .kc-g-in{box-sizing:border-box;width:100%;padding:6px 2px 7px;border:0;border-bottom:1.5px solid rgba(204,34,0,.7);border-radius:0;background:none;color:#B91C0C;font:inherit;font-size:16px;}",
    "#kc-admin-gate .kc-g-in:focus{outline:none;border-bottom-color:#CC2200;box-shadow:0 1px 0 0 #CC2200;}",
    "#kc-admin-gate .kc-g-pw{position:relative;}",
    "#kc-admin-gate .kc-g-pw .kc-g-in{padding-right:34px;}",
    "#kc-admin-gate .kc-g-eye{position:absolute;right:0;bottom:3px;width:30px;height:26px;padding:0;border:0;background:none;color:#B91C0C;opacity:.6;cursor:pointer;display:flex;align-items:center;justify-content:center;}",
    "#kc-admin-gate .kc-g-eye:hover{opacity:1;}",
    "#kc-admin-gate .kc-g-eye .kc-eye-shut{display:none;}",
    "#kc-admin-gate .kc-g-eye.is-on .kc-eye-open{display:none;}",
    "#kc-admin-gate .kc-g-eye.is-on .kc-eye-shut{display:block;}",
    "#kc-admin-gate .kc-go{width:100%;margin-top:18px;padding:14px 18px;border:0;border-radius:999px;background-color:#cc2200;color:#fff8f0;font:inherit;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;}",
    "#kc-admin-gate .kc-go:hover:not([disabled]){background-color:#B91C0C;}",
    "#kc-admin-gate .kc-go[disabled]{opacity:.6;cursor:default;}",
    "#kc-admin-gate .kc-g-err{min-height:20px;margin:12px 0 0;font-size:14px;line-height:1.5;color:#B91C0C;text-align:center;}",
    "#kc-admin-gate .kc-g-alt{margin:16px 0 0;text-align:center;font-size:13px;}",
    "#kc-admin-gate .kc-g-alt a{color:#B91C0C;text-decoration:underline;}",
    "#kc-admin-gate .kc-g-x{position:absolute;top:10px;right:12px;width:32px;height:32px;padding:0;border:0;border-radius:50%;background:none;color:#B91C0C;font-size:22px;line-height:1;cursor:pointer;}",
  ].join("");

  var SVG = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10.5" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>';

  var EYE_ATTRS = 'width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  var EYE = '<svg class="kc-eye-open" ' + EYE_ATTRS + '><path d="M2.3 12S6 5.6 12 5.6 21.7 12 21.7 12 18 18.4 12 18.4 2.3 12 2.3 12Z"/><circle cx="12" cy="12" r="3.1"/></svg>' +
    '<svg class="kc-eye-shut" ' + EYE_ATTRS + '><path d="M2.3 12S6 5.6 12 5.6 21.7 12 21.7 12 18 18.4 12 18.4 2.3 12 2.3 12Z"/><circle cx="12" cy="12" r="3.1"/><path d="M4.6 19.4 19.4 4.6"/></svg>';

  function check(key) {
    return fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "x-kc-key": key },
      body: JSON.stringify({ action: "list" }),
    }).then(function (res) {
      return res.status === 401 ? "wrong" : res.ok ? "ok" : "offline";
    }, function () { return "offline"; });
  }

  /** The password is good for one trip to the panel: admin.html deletes it as soon
   *  as it reads it, so coming back from the panel always asks again. */
  function handOver(key) {
    try { sessionStorage.setItem(STORED, key); } catch (e) {}
    location.href = TARGET;
  }

  function build() {
    var gate = document.createElement("div");
    gate.id = DIALOG_ID;
    gate.setAttribute("role", "dialog");
    gate.setAttribute("aria-modal", "true");
    gate.setAttribute("aria-labelledby", "kc-g-title");
    gate.hidden = true;
    gate.innerHTML =
      '<div class="kc-g-backdrop" data-g-close></div>' +
      '<div class="kc-g-box">' +
      '<button type="button" class="kc-g-x" data-g-close aria-label="Close">&#215;</button>' +
      '<div class="kc-g-mark">' + SVG + "</div>" +
      '<p class="kc-g-kicker">Kenneth &amp; Catherine</p>' +
      '<h2 class="kc-g-title" id="kc-g-title">For the couple only</h2>' +
      '<p class="kc-g-hint">Enter the password to open the guest list and seat replies.</p>' +
      '<label class="kc-g-lb" for="kc-g-pass">Password</label>' +
      '<div class="kc-g-pw">' +
      '<input class="kc-g-in" type="password" id="kc-g-pass" autocomplete="new-password" autocapitalize="off" spellcheck="false" placeholder="Admin password">' +
      '<button type="button" class="kc-g-eye" id="kc-g-eye" aria-label="Show the password" aria-pressed="false">' + EYE + '</button>' +
      '</div>' +
      '<button type="button" class="kc-go" id="kc-g-go">Open admin panel</button>' +
      '<p class="kc-g-err" id="kc-g-err" role="status" aria-live="polite"></p>' +
      '<p class="kc-g-alt"><a href="wedding.html">Not the couple? Back to the site</a></p>' +
      "</div>";
    document.body.appendChild(gate);
    return gate;
  }

  var gate, input, button, error, eye;

  function say(message) { error.textContent = message || ""; }

  function setPeek(on) {
    input.type = on ? "text" : "password";
    eye.classList.toggle("is-on", on);
    eye.setAttribute("aria-pressed", on ? "true" : "false");
    eye.setAttribute("aria-label", on ? "Hide the password" : "Show the password");
  }

  function open() {
    if (!gate) gate = build();
    setPeek(false);
    try { sessionStorage.removeItem(STORED); } catch (e) {}
    input.value = "";
    say("");
    gate.hidden = false;
    document.documentElement.style.overflow = "hidden";
    if (window.kcLenis) window.kcLenis.stop();
    input.focus();
  }

  function close() {
    if (!gate || gate.hidden) return;
    gate.hidden = true;
    document.documentElement.style.overflow = "";
    if (window.kcLenis) window.kcLenis.start();
  }

  function go() {
    var key = input.value.trim();
    if (!key) { say("Please enter the password."); input.focus(); return; }
    button.disabled = true;
    say("Checking…");
    check(key).then(function (result) {
      button.disabled = false;
      if (result === "ok") { handOver(key); return; }
      try { sessionStorage.removeItem(STORED); } catch (e) {}
      say(result === "wrong"
        ? "That password did not work. Please try again."
        : "We could not reach the server. Please try again.");
      input.select();
      input.focus();
    });
  }

  function wire(g) {
    input = g.querySelector("#kc-g-pass");
    button = g.querySelector("#kc-g-go");
    error = g.querySelector("#kc-g-err");
    eye = g.querySelector("#kc-g-eye");
    eye.addEventListener("click", function () { setPeek(input.type === "password"); input.focus(); });
    button.addEventListener("click", go);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
    g.addEventListener("click", function (e) {
      if (e.target && e.target.closest && e.target.closest("[data-g-close]")) close();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  }

  /** Clone the footer's last legal line so the entry inherits its exact styling
   *  and sits under Privacy Policy and Accessibility Statement. */
  function addToFooter(foot) {
    var lines = foot.querySelectorAll('a[href^="#kc-"]');
    var last = lines.length ? lines[lines.length - 1] : null;
    if (!last) return false;
    var line = last.closest("p") || last.parentNode;
    var holder = line.parentNode;
    if (!holder) return false;
    var clone = line.cloneNode(true);
    var chip = clone.querySelector("a") || clone;
    chip.href = TARGET;
    chip.target = "_self";
    chip.removeAttribute("data-kc-doc");
    chip.removeAttribute("aria-haspopup");
    chip.setAttribute("data-kc-admin", "");
    chip.textContent = "Admin";
    holder.insertBefore(clone, line.nextSibling);
    chip.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      open();
    });
    return true;
  }

  if (!document.getElementById(STYLE_ID)) {
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  gate = build();
  wire(gate);

  var tries = 0;
  function place() {
    if (document.querySelector("[data-kc-admin]")) return;
    var foot = document.querySelector("footer");
    if (foot && addToFooter(foot)) return;
    if (++tries < 12) setTimeout(place, 250);
  }
  place();
})();
