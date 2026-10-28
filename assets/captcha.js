// The verification component: one checkbox, one challenge panel, one very serious tone.
// CX.mount(root, { mode: "endless" | "single" | "three", source, persist })
(function () {
  const BRAND = "CAPTCHaos";
  const { CHALLENGES, OPENERS, WIDGET_PACK } = window.CX_CONTENT;
  const BY_ID = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));
  const HISTORY_WINDOW = 12;
  const T_OPEN = 700, T_VERIFY = [450, 850], T_FEEDBACK = 1200;

  // ---------- analytics (anonymous, never blocks play) ----------
  function track(name, props) {
    try {
      const evt = Object.assign({ name, t: Date.now() }, props || {});
      (window.cxEvents = window.cxEvents || []).push(evt);
      if (typeof window.va === "function") window.va("event", { name, data: props || {} });
      window.dispatchEvent(new CustomEvent("cx:event", { detail: evt }));
    } catch (_) { /* analytics failure must not interrupt play */ }
  }

  // ---------- storage (sessionStorage, tolerant of being blocked) ----------
  function makeStore(key) {
    return {
      load() { try { return JSON.parse(sessionStorage.getItem(key) || "null"); } catch (_) { return null; } },
      save(v) { try { sessionStorage.setItem(key, JSON.stringify(v)); } catch (_) { /* fine */ } },
    };
  }

  const ICON = {
    refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>',
    text: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v2H4zm0 4h10v2H4zm0 4h16v2H4zm0 4h10v2H4z"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"/></svg>',
    // Original mark: a checkbox whose check never finishes.
    mark: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="3" width="26" height="26" rx="5" fill="none" stroke="#5b8fd9" stroke-width="2.5"/><path d="M9 16.5l4.5 4.5L23 11.5" fill="none" stroke="#9aa3ad" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 3.2"/><circle cx="23" cy="11.5" r="2.2" fill="#5b8fd9"/></svg>',
    tick: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.2l-3.5-3.5L4 14.2l5 5 11-11-1.5-1.5z"/></svg>',
  };

  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const between = ([a, b]) => a + Math.random() * (b - a);
  let uid = 0;

  function mount(root, opts) {
    opts = Object.assign({ mode: "endless", source: "standalone", persist: true }, opts || {});
    const bounded = opts.mode !== "endless";
    const goal = opts.mode === "three" ? 3 : 1;
    const store = makeStore(opts.persist ? "cx:v1:" + opts.mode : "");
    const id = "cx" + ++uid;

    const fresh = () => ({ history: [], count: 0, currentId: null, memory: {}, textMode: false, open: false, shareUsed: null, queue: [] });
    let S = (opts.persist && store.load()) || fresh();
    S.queue = S.queue || [];
    let current = null;        // challenge object on screen
    let selected = new Set();
    let retries = 0;
    let busy = false;
    let shownAt = 0;
    let complete = false;
    let bootStart = Date.now();

    const save = () => { if (opts.persist) store.save(S); };

    // Shared link: ?c=<id> starts with that challenge, then continues the sequence.
    if (!bounded) {
      const shared = new URLSearchParams(location.search).get("c");
      const ok = shared && BY_ID[shared] && BY_ID[shared].enabled && !BY_ID[shared].callbackFrom;
      if (ok && shared !== S.shareUsed) {
        S.queue = [shared];
        S.shareUsed = shared;
        S.currentId = null;
      }
    }

    // ---------- DOM ----------
    root.classList.add("cx");
    root.innerHTML = `
      <div class="cx-anchor">
        <button type="button" class="cx-box" role="checkbox" aria-checked="false" aria-labelledby="${id}-label">
          <span class="cx-spinner" aria-hidden="true"></span>
          <span class="cx-tick" aria-hidden="true">${ICON.tick}</span>
        </button>
        <div class="cx-label-wrap">
          <span class="cx-label" id="${id}-label">I’m not a robot</span>
          <button type="button" class="cx-again" hidden>Try again</button>
        </div>
        <div class="cx-brand">${ICON.mark}<span>${BRAND}</span></div>
      </div>
      <div class="cx-panel" role="dialog" aria-labelledby="${id}-target" hidden>
        <div class="cx-head">
          <div class="cx-lead"></div>
          <div class="cx-target" id="${id}-target" tabindex="-1"></div>
          <div class="cx-instr"></div>
        </div>
        <div class="cx-body"></div>
        <div class="cx-msg" aria-hidden="true"></div>
        <div class="cx-foot">
          <button type="button" class="cx-icon cx-refresh" aria-label="Get a new challenge" title="Get a new challenge">${ICON.refresh}</button>
          <button type="button" class="cx-icon cx-alt" aria-pressed="false" aria-label="Switch to a text challenge" title="Switch to a text challenge">${ICON.text}</button>
          <button type="button" class="cx-icon cx-info-btn" aria-expanded="false" aria-controls="${id}-info" aria-label="About this verification" title="About this verification">${ICON.info}</button>
          <span class="cx-spacer"></span>
          <button type="button" class="cx-verify">Verify</button>
        </div>
        <div class="cx-info" id="${id}-info" role="region" aria-label="About this verification" hidden></div>
      </div>
      <div class="cx-sr" aria-live="polite" role="status"></div>`;

    const $ = (sel) => root.querySelector(sel);
    const el = {
      anchor: $(".cx-anchor"), box: $(".cx-box"), label: $(".cx-label"), again: $(".cx-again"),
      panel: $(".cx-panel"), lead: $(".cx-lead"), target: $(".cx-target"), instr: $(".cx-instr"),
      body: $(".cx-body"), msg: $(".cx-msg"), verify: $(".cx-verify"), refresh: $(".cx-refresh"),
      alt: $(".cx-alt"), infoBtn: $(".cx-info-btn"), info: $(".cx-info"), sr: $(".cx-sr"),
    };

    function announce(text) {
      el.sr.textContent = "";
      setTimeout(() => { el.sr.textContent = text; }, 30);
    }

    // ---------- selection ----------
    function eligible(c, recent, lastWasInter, count) {
      if (!c.enabled) return false;
      if (recent.includes(c.id)) return false;
      if (c.callbackFrom && !(S.memory && c.answerPolicy.memory in S.memory)) return false;
      if (c.type === "interstitial" && (lastWasInter || count < 3)) return false;
      return true;
    }

    function choose(excludeId) {
      if (bounded) {
        if (opts.mode === "three" && S.count === 0 && excludeId !== WIDGET_PACK.threeOpener && !S.history.length) return WIDGET_PACK.threeOpener;
        const pack = opts.mode === "three" ? WIDGET_PACK.three : WIDGET_PACK.single;
        const pool = pack.filter((x) => x !== excludeId && !S.history.includes(x));
        const list = pool.length ? pool : pack.filter((x) => x !== excludeId);
        return list[Math.floor(Math.random() * list.length)];
      }
      if (S.queue.length) return S.queue.shift();
      const recent = S.history.slice(-HISTORY_WINDOW).concat(excludeId ? [excludeId] : []);
      // Openers run first, in order. A shared challenge may come before them.
      const op = OPENERS.find((o) => !S.history.includes(o) && o !== excludeId);
      if (op && S.count <= OPENERS.length) return op;
      const maxTier = Math.min(5, 2 + Math.floor((S.count - 2) / 2));
      const last = BY_ID[S.history[S.history.length - 1]];
      const lastWasInter = last && last.type === "interstitial";
      let pool = CHALLENGES.filter((c) => c.tier <= maxTier && eligible(c, recent, lastWasInter, S.count));
      if (!pool.length) pool = CHALLENGES.filter((c) => eligible(c, S.history.slice(-4).concat(excludeId || []), lastWasInter, S.count));
      if (!pool.length) pool = CHALLENGES.filter((c) => c.enabled && c.id !== excludeId && !c.callbackFrom);
      // Favor the current escalation tier, keep a little of the lower tiers as lulls.
      const weighted = pool.flatMap((c) => Array(c.tier >= maxTier - 1 ? 3 : 1).fill(c.id));
      return weighted[Math.floor(Math.random() * weighted.length)];
    }

    // Load photos for the challenges that could come next, so the swap is instant.
    function preloadAhead() {
      try {
        const ids = bounded ? (opts.mode === "three" ? WIDGET_PACK.three : WIDGET_PACK.single)
          : S.queue.length ? S.queue
          : CHALLENGES.filter((x) => x.enabled && x.tiles && x.tier <= Math.min(5, 3 + Math.floor(S.count / 2))).map((x) => x.id);
        ids.forEach((cid) => { const ch = BY_ID[cid]; if (ch && ch.tiles) window.CX_TILES.preload(ch.tiles, cid); });
      } catch (_) { /* preloading is best effort */ }
    }

    function tilesFor(c) {
      if (c.callbackFrom) return { tiles: BY_ID[c.callbackFrom].tiles, seedBase: c.callbackFrom };
      return { tiles: c.tiles, seedBase: c.id };
    }

    // ---------- rendering ----------
    function renderChallenge(c, { focus } = {}) {
      current = c;
      selected = new Set();
      retries = 0;
      shownAt = Date.now();
      S.currentId = c.id;
      save();

      el.panel.classList.toggle("is-inter", c.type === "interstitial");
      el.lead.textContent = c.leadIn || "";
      el.target.textContent = c.target;
      el.instr.textContent = c.instruction || "";
      el.instr.hidden = !c.instruction;
      el.msg.textContent = "";
      el.msg.className = "cx-msg";
      el.alt.hidden = c.type === "interstitial";
      renderBody();
      updateVerify();
      closeInfo(false);
      announce(`${c.leadIn ? c.leadIn + " " : ""}${c.target} ${c.instruction || ""}`.trim());
      track("challenge_shown", { id: c.id, version: c.version, tier: c.tier, position: S.count + 1, source: opts.source });
      preloadAhead();
      if (focus) el.target.focus({ preventScroll: true });
    }

    function renderBody() {
      const c = current;
      el.body.className = "cx-body";
      if (c.type === "interstitial") {
        el.body.innerHTML = `
          <div class="cx-inter">
            <button type="button" class="cx-box cx-box-sm" role="checkbox" aria-checked="false" aria-labelledby="${id}-il">
              <span class="cx-spinner" aria-hidden="true"></span><span class="cx-tick" aria-hidden="true">${ICON.tick}</span>
            </button>
            <span id="${id}-il">${esc(c.checkboxLabel)}</span>
          </div>`;
        el.body.querySelector(".cx-box").addEventListener("click", onInterstitial);
        return;
      }
      const { tiles, seedBase } = tilesFor(c);
      if (S.textMode) {
        el.body.classList.add("is-text");
        el.body.innerHTML = `<fieldset class="cx-textlist"><legend class="cx-vh">${esc((c.leadIn ? c.leadIn + " " : "") + c.target)}</legend>${
          tiles.map((t, i) => `<label class="cx-textopt"><input type="checkbox" data-i="${i}" ${selected.has(i) ? "checked" : ""}> <span>${esc(cap(t[2]))}</span></label>`).join("")
        }</fieldset>`;
        el.body.querySelectorAll("input").forEach((inp) => inp.addEventListener("change", () => {
          toggle(+inp.dataset.i, inp.checked);
        }));
        return;
      }
      try {
        el.body.innerHTML = `<div class="cx-grid" role="group" aria-label="Image tiles">${
          tiles.map((t, i) => `<button type="button" class="cx-tile" data-i="${i}" aria-pressed="${selected.has(i)}" aria-label="Image ${i + 1}: ${esc(t[2])}">
            <img alt="" draggable="false"><span class="cx-sel">${ICON.tick}</span></button>`).join("")
        }</div>`;
        el.body.querySelectorAll(".cx-tile img").forEach((im, i) => window.CX_TILES.fill(im, tiles[i], seedBase + ":" + i));
        el.body.querySelectorAll(".cx-tile").forEach((b) => b.addEventListener("click", () => {
          if (busy) return;
          toggle(+b.dataset.i, !selected.has(+b.dataset.i));
        }));
      } catch (err) {
        renderAssetError();
      }
    }

    function renderAssetError() {
      current = Object.assign({}, current, { allowSkip: true, _assetError: true });
      el.body.innerHTML = `<div class="cx-error"><p>The images for this challenge didn’t load.</p><button type="button" class="cx-link-btn">Try again</button></div>`;
      el.body.querySelector("button").addEventListener("click", () => renderChallenge(BY_ID[current.id], { focus: true }));
      updateVerify();
    }

    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

    function toggle(i, on) {
      if (on) selected.add(i); else selected.delete(i);
      const tile = el.body.querySelector(`.cx-tile[data-i="${i}"]`);
      if (tile) tile.setAttribute("aria-pressed", String(on));
      el.msg.textContent = "";
      el.msg.className = "cx-msg";
      updateVerify();
    }

    function canSkip(c) { return c.allowSkip || c.answerPolicy.kind === "impossible"; }

    function updateVerify() {
      const c = current;
      if (!c || c.type === "interstitial") { el.verify.hidden = true; return; }
      el.verify.hidden = false;
      el.verify.textContent = selected.size === 0 && canSkip(c) ? "Skip" : "Verify";
    }

    // ---------- feedback / flow ----------
    function showMsg(text, kind) {
      el.msg.textContent = text;
      el.msg.className = "cx-msg is-" + kind;
      announce(text);
    }

    function setBusy(on) {
      busy = on;
      el.panel.classList.toggle("is-busy", on);
      [el.verify, el.refresh, el.alt].forEach((b) => { b.disabled = on; });
    }

    async function advance(text, how) {
      track(how === "skip" ? "challenge_skipped" : "challenge_advanced", { id: current.id, tier: current.tier, position: S.count + 1, elapsed: Date.now() - shownAt, source: opts.source });
      showMsg(text, "ok");
      S.history.push(current.id);
      if (S.history.length > 40) S.history = S.history.slice(-40);
      S.count += 1;
      save();
      await sleep(T_FEEDBACK);
      if (bounded && S.count >= goal) { finish(); return; }
      const next = BY_ID[choose()];
      el.panel.classList.add("is-swapping");
      await sleep(160);
      renderChallenge(next, { focus: root.contains(document.activeElement) });
      el.panel.classList.remove("is-swapping");
      setBusy(false);
    }

    function reject(text) {
      selected.clear();
      el.body.querySelectorAll('[aria-pressed="true"]').forEach((t) => t.setAttribute("aria-pressed", "false"));
      el.body.querySelectorAll("input:checked").forEach((x) => { x.checked = false; });
      showMsg(text, "err");
      updateVerify();
      setBusy(false);
    }

    async function onVerify() {
      if (busy || !current) return;
      const c = current;
      const sel = [...selected].sort((a, b) => a - b);
      const p = c.answerPolicy;
      const r = c.responses || {};

      if (!sel.length && !canSkip(c)) {
        showMsg("Please select all matching images.", "err");
        return;
      }
      setBusy(true);
      track("challenge_submitted", { id: c.id, tier: c.tier, position: S.count + 1, source: opts.source });
      await sleep(between(T_VERIFY));

      if (c._assetError) return advance("Skipped. Humanity assumed.", "skip");
      if (!sel.length) {
        if (c.remember) S.memory[c.remember] = [];
        return advance(r.skip || "Thank you.", "skip");
      }
      if (c.remember) S.memory[c.remember] = sel;

      switch (p.kind) {
        case "exact": {
          const ok = sel.length === p.correct.length && sel.every((v, i) => v === p.correct[i]);
          if (ok) return advance(r.success || "Thank you.");
          return scriptedRetry(c, r);
        }
        case "impossible":
          return scriptedRetry(c, r);
        case "choice": {
          if (p.tagged) {
            const hit = Object.keys(p.tagged).find((tag) => sel.some((i) => p.tagged[tag].includes(i)));
            return advance(hit ? r[hit] : r.default);
          }
          return advance(sel.length > 1 ? r.multi : r.byTile[sel[0]]);
        }
        case "callback": {
          const mem = (S.memory && S.memory[p.memory]) || [];
          return advance(sel.some((i) => mem.includes(i)) ? r.success : r.mismatch);
        }
        default:
          return advance(r.success || "Thank you.");
      }
    }

    function scriptedRetry(c, r) {
      retries += 1;
      if (retries > (c.maxScriptedRetries || 0)) return advance(r.giveUp || "Close enough.");
      reject(r.retry || "Please try again.");
    }

    async function onInterstitial(e) {
      if (busy) return;
      const b = e.currentTarget;
      setBusy(true);
      b.classList.add("is-loading");
      track("challenge_submitted", { id: current.id, tier: current.tier, position: S.count + 1, source: opts.source });
      await sleep(between(T_VERIFY));
      b.classList.remove("is-loading");
      b.classList.add("is-checked");
      b.setAttribute("aria-checked", "true");
      advance((current.responses && current.responses.success) || "Thank you.");
    }

    function onRefresh() {
      if (busy || !current) return;
      const prev = current.id;
      S.history.push(prev);
      renderChallenge(BY_ID[choose(prev)], { focus: true });
    }

    function onAlt() {
      if (busy || !current) return;
      S.textMode = !S.textMode;
      el.alt.setAttribute("aria-pressed", String(S.textMode));
      el.alt.setAttribute("aria-label", S.textMode ? "Switch to an image challenge" : "Switch to a text challenge");
      el.alt.title = el.alt.getAttribute("aria-label");
      save();
      if (S.textMode) track("accessible_mode_selected", { id: current.id, source: opts.source });
      renderBody();
      const first = el.body.querySelector("input, .cx-tile, .cx-box");
      if (first) first.focus();
    }

    // ---------- info panel ----------
    function infoHTML() {
      const home = opts.homeHref || "./";
      const embed = opts.embedHref || "embed";
      const share = bounded
        ? `<a class="cx-link-btn" href="${esc(home)}" target="_blank" rel="noopener">Try the full verification</a>`
        : `<button type="button" class="cx-link-btn cx-copy">Copy this challenge link</button>`;
      return `<p><strong>${BRAND}</strong> is a parody verification box. It checks nothing, stores no answers, and protects nothing. Entertainment only.</p>
        <div class="cx-info-actions">${share}<a class="cx-link-btn" href="${esc(embed)}"${bounded ? ' target="_blank" rel="noopener"' : ""}>Add verification to your website</a><a class="cx-link-btn" href="${esc(opts.creditsHref || "/credits")}"${bounded ? ' target="_blank" rel="noopener"' : ""}>Photo credits</a></div>
        <p class="cx-copied" aria-live="polite"></p>
        <button type="button" class="cx-link-btn cx-info-close">Close</button>`;
    }

    function openInfo() {
      el.info.innerHTML = infoHTML();
      el.info.hidden = false;
      el.infoBtn.setAttribute("aria-expanded", "true");
      const copy = el.info.querySelector(".cx-copy");
      if (copy) copy.addEventListener("click", copyLink);
      el.info.querySelector(".cx-info-close").addEventListener("click", () => closeInfo(true));
      (el.info.querySelector(".cx-copy, a") || el.info).focus();
    }

    function closeInfo(restore) {
      if (el.info.hidden) return;
      el.info.hidden = true;
      el.infoBtn.setAttribute("aria-expanded", "false");
      if (restore) el.infoBtn.focus();
    }

    function copyLink() {
      const url = location.origin + location.pathname + "?c=" + encodeURIComponent(current.id);
      const note = el.info.querySelector(".cx-copied");
      const done = () => { note.textContent = "Link copied."; track("share_copied", { id: current.id }); };
      const fallback = () => {
        note.innerHTML = `<label>Copy this link: <input class="cx-url" readonly value="${esc(url)}"></label>`;
        const inp = note.querySelector("input");
        inp.focus();
        inp.select();
        track("share_copied", { id: current.id, fallback: true });
      };
      try {
        navigator.clipboard.writeText(url).then(done, fallback);
      } catch (_) { fallback(); }
    }

    // ---------- open / close ----------
    async function open() {
      if (busy || complete) return;
      if (!S.count && !S.history.length) track("checkbox_started", { source: opts.source });
      busy = true;
      el.box.classList.add("is-loading");
      await sleep(T_OPEN);
      el.box.classList.remove("is-loading");
      busy = false;
      showPanel(true);
    }

    function showPanel(focus) {
      const c = (S.currentId && BY_ID[S.currentId]) || BY_ID[choose()];
      el.anchor.hidden = true;
      el.panel.hidden = false;
      S.open = true;
      renderChallenge(c, { focus });
    }

    function close() {
      if (el.panel.hidden || busy) return;
      closeInfo(false);
      el.panel.hidden = true;
      el.anchor.hidden = false;
      S.open = false;
      save();
      el.box.focus();
    }

    function finish() {
      complete = true;
      setBusy(false);
      el.panel.hidden = true;
      el.anchor.hidden = false;
      el.anchor.classList.add("is-done");
      el.box.classList.add("is-checked");
      el.box.setAttribute("aria-checked", "true");
      el.box.disabled = true;
      el.label.textContent = "Verification complete. Probably.";
      el.again.hidden = false;
      el.again.focus();
      announce("Verification complete. Probably.");
      track("widget_completed", { mode: opts.mode, source: opts.source });
    }

    function restart() {
      S = fresh();
      complete = false;
      el.anchor.classList.remove("is-done");
      el.box.classList.remove("is-checked");
      el.box.setAttribute("aria-checked", "false");
      el.box.disabled = false;
      el.label.textContent = "I’m not a robot";
      el.again.hidden = true;
      el.box.focus();
    }

    // ---------- wiring ----------
    el.box.addEventListener("click", open);
    el.verify.addEventListener("click", onVerify);
    el.refresh.addEventListener("click", onRefresh);
    el.alt.addEventListener("click", onAlt);
    el.infoBtn.addEventListener("click", () => (el.info.hidden ? openInfo() : closeInfo(true)));
    el.again.addEventListener("click", restart);
    el.alt.setAttribute("aria-pressed", String(!!S.textMode));
    if (S.textMode) el.alt.setAttribute("aria-label", "Switch to an image challenge");

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!el.info.hidden) { closeInfo(true); e.stopPropagation(); return; }
      if (!el.panel.hidden) { close(); e.stopPropagation(); }
    });
    document.addEventListener("pointerdown", (e) => {
      // Following a link (the corner link) leaves the panel open so Back resumes it.
      if (!el.panel.hidden && !el.panel.contains(e.target) && !e.target.closest("a")) close();
    });

    // Back from the offer page (or a refresh) resumes where the visitor left off.
    if (!bounded && S.open && (S.currentId || S.queue.length)) showPanel(false);

    track(opts.source === "standalone" ? "experience_loaded" : "widget_loaded", { source: opts.source, mode: opts.mode, ms: Date.now() - bootStart });

    return { open, close, restart };
  }

  window.CX = { mount, track, BRAND };
})();
