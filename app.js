(() => {
  "use strict";

  const CFG = window.KDO_PLATIL_CONFIG || {};
  const REMOTE = !!(CFG.supabaseUrl && CFG.supabaseKey);
  const DEFAULT_PEOPLE = { a: { name: "Wendy", g: "f" }, b: { name: "Kamarád", g: "m" } };
  const POLL_MS = 15000;

  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  const state = {
    mode: REMOTE ? "remote" : "local",
    code: null,
    people: structuredClone(DEFAULT_PEOPLE),
    log: [],
    loaded: false,
    offline: false,
    busy: false,
    kind: LS.get("kp-kind", "cake"),
    me: LS.get("kp-me", null),
    changingMe: false,
    armedUndo: false,
    armedLeave: false
  };

  const $ = id => document.getElementById(id);
  const other = w => (w === "a" ? "b" : "a");
  const P = w => state.people[w];
  const g = (p, m, f) => (p.g === "f" ? f : m);

  /* ================= backend (Supabase RPC over plain fetch) ================= */
  async function rpc(fn, args) {
    const headers = { "Content-Type": "application/json", apikey: CFG.supabaseKey };
    // Legacy anon keys are JWTs and also go in Authorization; new sb_publishable_ keys must not.
    if (CFG.supabaseKey.startsWith("eyJ")) headers.Authorization = "Bearer " + CFG.supabaseKey;
    const res = await fetch(CFG.supabaseUrl.replace(/\/+$/, "") + "/rest/v1/rpc/" + fn, {
      method: "POST", headers, body: JSON.stringify(args), cache: "no-store"
    });
    const text = await res.text();
    if (!res.ok) { const e = new Error(text || res.statusText); e.status = res.status; throw e; }
    return text ? JSON.parse(text) : null;
  }

  /* ================= case codes ================= */
  const ALPHA = "abcdefghjkmnpqrstuvwxyz23456789";
  function genCode() {
    const b = new Uint8Array(20); crypto.getRandomValues(b);
    let s = ""; for (let i = 0; i < 20; i++) { s += ALPHA[b[i] % ALPHA.length]; if (i % 5 === 4 && i < 19) s += "-"; }
    return s;
  }
  function normCode(raw) {
    let s = String(raw || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (s.length !== 20) return null;
    return s.match(/.{5}/g).join("-");
  }
  function codeFromUrl() {
    try { return normCode(new URLSearchParams(location.search).get("spis")); } catch (e) { return null; }
  }
  function putCodeInUrl(code) {
    // The code stays in the address bar so "Add to Home Screen" on iPhone keeps it.
    try { history.replaceState(null, "", location.pathname + (code ? "?spis=" + code : "")); } catch (e) {}
  }

  /* ================= scene ================= */
  const NS = "http://www.w3.org/2000/svg";
  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function buildScene() {
    const s = $("scene");
    el("circle", { cx: 316, cy: 34, r: 16, fill: "#f3e6c8", opacity: ".85" }, s);
    el("circle", { cx: 308, cy: 29, r: 15, fill: "#1b2843" }, s);
    el("line", { x1: 180, y1: 6, x2: 180, y2: 40, stroke: "#b8644a", "stroke-width": 2 }, s);
    el("circle", { cx: 180, cy: 6, r: 3, fill: "#ff4fa3" }, s);
    el("rect", { x: 122, y: 38, width: 116, height: 20, fill: "#5f2619" }, s);
    el("rect", { x: 76, y: 56, width: 208, height: 26, fill: "#8f3d2b" }, s);
    for (let x = 86; x < 280; x += 18) el("rect", { x, y: 62, width: 8, height: 14, fill: "#5f2619" }, s);
    el("rect", { x: 30, y: 80, width: 300, height: 250, fill: "#8f3d2b" }, s);
    el("rect", { x: 30, y: 80, width: 300, height: 6, fill: "#b8644a" }, s);
    el("rect", { x: 30, y: 160, width: 300, height: 4, fill: "#5f2619" }, s);
    el("rect", { x: 30, y: 256, width: 300, height: 4, fill: "#5f2619" }, s);
    const rows = [96, 128, 268], cols = [46, 92, 138, 198, 244, 290];
    let i = 0;
    for (const y of rows) for (const x of cols) {
      if (y === 268 && (x === 138 || x === 198)) continue;
      const r = el("rect", { x, y, width: 24, height: 24, class: "sw" }, s);
      if ((i * 7 + 3) % 5 < 2) { r.classList.add("on"); r.style.animationDelay = (0.15 + ((i * 37) % 17) / 10) + "s"; }
      i++;
    }
    el("rect", { x: 160, y: 282, width: 40, height: 48, fill: "#3a1810" }, s);
    el("path", { d: "M160 282 a20 20 0 0 1 40 0", fill: "#f2b33d", opacity: ".5" }, s);
    [["a", 52], ["b", 216]].forEach(([w, x]) => {
      const grp = el("g", { class: "fw", id: "win-" + w }, s);
      el("rect", { x: x - 4, y: 170, width: 100, height: 78, fill: "#5f2619" }, grp);
      el("rect", { x, y: 174, width: 92, height: 62, class: "glass" }, grp);
      for (let yy = 182; yy < 206; yy += 6) el("line", { x1: x, y1: yy, x2: x + 92, y2: yy, class: "blind" }, grp);
      el("circle", { cx: x + 46, cy: 208, r: 10, class: "who" }, grp);
      el("path", { d: `M${x + 24} 236 q0 -18 22 -18 q22 0 22 18 z`, class: "who" }, grp);
      el("line", { x1: x + 46, y1: 174, x2: x + 46, y2: 236, stroke: "#5f2619", "stroke-width": 3 }, grp);
      el("rect", { x: x + 6, y: 240, width: 80, height: 14, rx: 2, class: "plate" }, grp);
      el("text", { x: x + 46, y: 251, "text-anchor": "middle", class: "plate-t", id: "plate-" + w }, grp);
    });
    const st = el("g", { id: "stamp", opacity: "0" }, s);
    el("rect", { x: -50, y: -11, width: 100, height: 22, rx: 2, class: "stamp-box" }, st);
    el("text", { x: 0, y: 5, "text-anchor": "middle", class: "stamp", id: "stamp-t" }, st);
  }
  const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

  /* ================= derived ================= */
  function streak() {
    if (!state.log.length) return 0;
    const w = state.log[0].who; let n = 0;
    for (const e of state.log) { if (e.who === w) n++; else break; }
    return n;
  }
  function dayDiff(ts) {
    const a = new Date(ts); a.setHours(0, 0, 0, 0);
    const b = new Date(); b.setHours(0, 0, 0, 0);
    return Math.round((b - a) / 86400000);
  }
  const relDay = ts => { const d = dayDiff(ts); return d <= 0 ? "dnes" : d === 1 ? "včera" : `před ${d} dny`; };
  const fmt = new Intl.DateTimeFormat("cs-CZ", { weekday: "short", day: "numeric", month: "numeric" });
  const kindName = k => (k === "brunch" ? "brunch" : "kafe a dort");

  function taglines(N, L) {
    return [
      `${N.name}, peněženka se už nervózně ošívá. Nedělej, že nevíš.`,
      `Podle spisu jsi na řadě ty, ${N.name}. Spis nelže. Na rozdíl od tebe.`,
      `Minule ${g(L, "platil", "platila")} ${L.name}. ${N.name} si toho určitě ${g(N, "všiml", "všimla")}. Určitě.`,
      `Nejlepší čas zaplatit byl minule. Druhý nejlepší je dnes, ${N.name}.`,
      `${N.name}, tohle není obvinění. Tohle je účtenka.`,
      `Pachatelem příští platby je ${N.name}. Případ uzavřen, než vůbec začal.`
    ];
  }

  /* ================= render ================= */
  function render() {
    const setup = state.mode === "setup";
    $("setup").hidden = !setup;
    $("main").hidden = setup;
    $("share-box").hidden = state.mode !== "remote";
    if (state.code) $("code-view").textContent = state.code;

    $("plate-a").textContent = trunc(P("a").name.toUpperCase(), 11);
    $("plate-b").textContent = trunc(P("b").name.toUpperCase(), 11);
    renderVerdict();
    if (!setup) {
      $("kind-brunch").checked = state.kind === "brunch";
      $("kind-cake").checked = state.kind === "cake";
      renderAction(); renderLog(); renderStats();
      if (!$("settings").open) {
        $("name-a").value = P("a").name; $("g-a").value = P("a").g;
        $("name-b").value = P("b").name; $("g-b").value = P("b").g;
      }
      const lv = $("leave");
      lv.classList.toggle("armed", state.armedLeave);
      lv.textContent = state.armedLeave ? "Opravdu odpojit? Klepni znovu." : "Odpojit tento telefon od spisu";
    }
    renderFoot();
  }

  function renderVerdict() {
    const last = state.log[0], stamp = $("stamp");
    if (state.mode === "setup") {
      $("eyebrow").textContent = "Na řadě je";
      $("next").textContent = "Nikdo. Zatím.";
      $("tag").textContent = "Nejdřív založ spis, nebo se připoj ke spisu kamaráda.";
      $("last").textContent = "";
    } else if (!state.loaded) {
      $("next").textContent = "…"; $("tag").textContent = "Otevírám spis."; $("last").textContent = "";
    } else if (!last) {
      $("next").textContent = "Nikdo. Zatím.";
      $("tag").textContent = "Spis je prázdný. Kdo zaplatí první, stává se hlavním podezřelým.";
      $("last").textContent = "";
    } else {
      const nw = other(last.who), N = P(nw), L = P(last.who), t = taglines(N, L);
      $("eyebrow").textContent = "Na řadě je";
      $("next").textContent = N.name;
      $("tag").textContent = t[state.log.length % t.length];
      let lt = `Naposledy: ${L.name} · ${kindName(last.kind)} · ${relDay(last.at)}`;
      if (dayDiff(last.at) >= 14) lt += ". Dva týdny bez kafe? Jste v pořádku?";
      $("last").textContent = lt;
    }
    const nextW = last && state.mode !== "setup" ? other(last.who) : null;
    ["a", "b"].forEach(w => $("win-" + w).classList.toggle("lit", nextW === w));
    if (nextW) {
      stamp.setAttribute("transform", `translate(${nextW === "a" ? 98 : 262} 150) rotate(-8)`);
      stamp.setAttribute("opacity", "1");
      $("stamp-t").textContent = g(P(nextW), "PODEZŘELÝ", "PODEZŘELÁ");
    } else stamp.setAttribute("opacity", "0");
  }

  function renderAction() {
    const box = $("action"); box.replaceChildren();
    if (!state.me || state.changingMe) {
      const lab = document.createElement("div"); lab.className = "label"; lab.textContent = "Kdo drží tenhle telefon?";
      const pick = document.createElement("div"); pick.className = "pick";
      ["a", "b"].forEach(w => {
        const b = document.createElement("button"); b.type = "button"; b.className = "ghost";
        b.textContent = `Jsem ${P(w).name}`;
        b.addEventListener("click", () => { state.me = w; state.changingMe = false; LS.set("kp-me", w); render(); });
        pick.appendChild(b);
      });
      const n = document.createElement("p"); n.className = "note"; n.style.marginTop = "10px";
      n.textContent = "Ptám se jen jednou. Telefon si to pamatuje, svědomí bohužel ne.";
      box.append(lab, pick, n);
      return;
    }
    const me = P(state.me), ot = P(other(state.me));
    const wrap = document.createElement("div"); wrap.className = "stack";
    const row = document.createElement("div"); row.className = "who-row";
    const s = document.createElement("span"); s.textContent = `Tento telefon: ${me.name}`;
    const ch = document.createElement("button"); ch.type = "button"; ch.className = "chip"; ch.textContent = "Nejsem to já";
    ch.addEventListener("click", () => { state.changingMe = true; render(); });
    row.append(s, ch);
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "btn"; btn.id = "pay-me";
    btn.textContent = `Dneska jsem ${g(me, "platil", "platila")} já`;
    btn.disabled = !state.loaded || state.busy;
    btn.addEventListener("click", () => addEntry(state.me));
    const alt = document.createElement("button"); alt.type = "button"; alt.className = "link"; alt.id = "pay-other";
    alt.textContent = `Ne, ${g(ot, "platil", "platila")} ${ot.name}`;
    alt.disabled = !state.loaded || state.busy;
    alt.addEventListener("click", () => addEntry(other(state.me)));
    wrap.append(row, btn, alt);
    box.appendChild(wrap);
  }

  function renderLog() {
    const ul = $("log"); ul.replaceChildren();
    const log = state.log, total = log.length;
    const solo = text => { const li = document.createElement("li"); li.className = "solo"; const p = document.createElement("p"); p.className = "empty"; p.textContent = text; li.appendChild(p); ul.appendChild(li); };
    if (!state.loaded) solo("Listuji šuplíky…");
    else if (!total) solo("Zatím žádný záznam. První platba otevře případ.");
    log.slice(0, 12).forEach((e, i) => {
      const li = document.createElement("li");
      const no = document.createElement("span"); no.className = "no"; no.textContent = "č. " + String(total - i).padStart(3, "0");
      const nm = document.createElement("span"); nm.className = "nm"; nm.textContent = P(e.who).name;
      const dt = document.createElement("span"); dt.className = "dt"; dt.textContent = fmt.format(new Date(e.at));
      const k = document.createElement("span"); k.className = "kind " + (e.kind === "brunch" ? "brunch" : "cake"); k.textContent = kindName(e.kind);
      li.append(no, nm, dt, k);
      if (i === 0 && !String(e.id).startsWith("tmp")) {
        const u = document.createElement("button"); u.type = "button"; u.className = "undo" + (state.armedUndo ? " armed" : "");
        u.textContent = state.armedUndo ? "Opravdu smazat? Klepni znovu." : "Smazat tenhle záznam";
        u.addEventListener("click", () => {
          if (!state.armedUndo) {
            state.armedUndo = true; render();
            setTimeout(() => { if (state.armedUndo) { state.armedUndo = false; render(); } }, 4000);
          } else { state.armedUndo = false; removeEntry(e.id); }
        });
        li.appendChild(u);
      }
      ul.appendChild(li);
    });
    const more = $("more");
    more.hidden = total <= 12;
    if (total > 12) more.textContent = `Ve spisu je dalších ${total - 12} starších záznamů. Archiv nezapomíná.`;
    const n = streak(), rm = $("remark");
    rm.hidden = n < 2;
    if (n >= 2) {
      const p = P(log[0].who);
      rm.textContent = `${p.name} ${g(p, "platil", "platila")} ${n}× po sobě. Buď je to velkorysost, nebo někdo hraje mrtvého brouka.`;
    }
  }

  function renderStats() {
    const tb = $("stats"); tb.replaceChildren();
    const c = { a: { brunch: 0, cake: 0 }, b: { brunch: 0, cake: 0 } };
    state.log.forEach(e => { c[e.who][e.kind === "brunch" ? "brunch" : "cake"]++; });
    ["a", "b"].forEach(w => {
      const tr = document.createElement("tr");
      [P(w).name, c[w].brunch, c[w].cake, c[w].brunch + c[w].cake].forEach(v => { const td = document.createElement("td"); td.textContent = v; tr.appendChild(td); });
      tb.appendChild(tr);
    });
    const d = $("dodge"), diff = c.a.brunch - c.b.brunch;
    d.hidden = Math.abs(diff) < 2;
    if (Math.abs(diff) >= 2) {
      const low = P(diff > 0 ? "b" : "a");
      d.textContent = `${low.name} platí podezřele často jen kafe a dort. Náhoda? Detektivové na náhody nevěří.`;
    }
  }

  function isStandalone() {
    try { return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; } catch (e) { return false; }
  }
  function renderFoot() {
    const f = $("foot"); f.replaceChildren();
    const line = t => { const d = document.createElement("div"); d.textContent = t; f.appendChild(d); };
    if (state.mode === "local") line("Sdílený backend není nastavený. Spis se ukládá jen v tomto zařízení.");
    else if (state.mode === "remote") line(state.offline ? "Jsi offline. Ukazuju poslední známý stav spisu." : "Spis je sdílený. Co zapíše jeden, uvidí i druhý.");
    if (!isStandalone() && state.mode !== "setup") {
      const d = document.createElement("div");
      d.append("Na iPhonu: ");
      const b = document.createElement("b"); b.textContent = "Sdílet → Přidat na plochu"; d.appendChild(b);
      d.append(". Pak je to appka.");
      f.appendChild(d);
    }
  }

  /* ================= toast ================= */
  let toastTimer = null, toastUndo = null;
  function toast(text, undoFn) {
    $("toast-t").textContent = text;
    toastUndo = undoFn || null;
    $("toast-b").hidden = !undoFn;
    $("toast").classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $("toast").classList.remove("show"); toastUndo = null; }, undoFn ? 8000 : 4500);
  }
  $("toast-b").addEventListener("click", () => { const f = toastUndo; toastUndo = null; $("toast").classList.remove("show"); if (f) f(); });

  /* ================= data ================= */
  function normPeople(p) {
    const out = structuredClone(DEFAULT_PEOPLE);
    if (p && typeof p === "object") ["a", "b"].forEach(w => {
      if (p[w] && typeof p[w].name === "string" && p[w].name.trim()) out[w].name = p[w].name.trim().slice(0, 20);
      if (p[w] && (p[w].g === "f" || p[w].g === "m")) out[w].g = p[w].g;
    });
    return out;
  }
  const clean = e => e && (e.who === "a" || e.who === "b") && typeof e.at === "number";
  const cacheKey = () => "kp-cache-" + state.code;

  function applyRemote(d) {
    state.people = normPeople(d.people);
    state.log = (Array.isArray(d.log) ? d.log : []).filter(clean).map(e => ({ id: e.id, who: e.who, kind: e.kind === "brunch" ? "brunch" : "cake", at: e.at }));
    state.loaded = true;
    LS.set(cacheKey(), { people: state.people, log: state.log });
  }

  let pulling = false;
  async function pull() {
    if (state.mode !== "remote" || pulling) return;
    pulling = true;
    try {
      const d = await rpc("spis_nacist", { p_code: state.code });
      if (d === null) { leave("Spis s tímhle kódem už neexistuje. Založ nový, nebo zadej jiný kód."); return; }
      state.offline = false;
      applyRemote(d);
    } catch (e) {
      state.offline = true;
    } finally {
      pulling = false;
      if (state.mode === "remote") render();
    }
  }

  async function addEntry(who) {
    if (!state.loaded || state.busy) return;
    const p = P(who), kind = state.kind;
    const msg = kind === "brunch"
      ? `Zapsáno: ${p.name} ${g(p, "zaplatil", "zaplatila")} brunch. Avokádo putuje do spisu.`
      : `Zapsáno: ${p.name} ${g(p, "zaplatil", "zaplatila")} kafe a dort. Dort byl jediný svědek.`;
    if (state.mode === "remote") {
      const tmp = { id: "tmp" + Date.now(), who, kind, at: Date.now() };
      state.busy = true; state.log.unshift(tmp); render();
      try {
        const id = await rpc("spis_zapsat", { p_code: state.code, p_who: who, p_kind: kind });
        state.busy = false;
        toast(msg, () => removeEntry(id));
        await pull();
      } catch (e) {
        state.busy = false;
        state.log = state.log.filter(x => x !== tmp); render();
        toast("Zápis se nepovedl. Zkontroluj připojení a zkus to znovu.");
      }
    } else {
      const entry = { id: "l" + Date.now(), who, kind, at: Date.now() };
      state.log.unshift(entry); LS.set("kp-log", state.log.slice(0, 500)); render();
      toast(msg, () => removeEntry(entry.id));
    }
  }

  async function removeEntry(id) {
    if (state.mode === "remote") {
      try { await rpc("spis_smazat", { p_code: state.code, p_id: id }); toast("Záznam smazán. Jako by se nikdy nestal."); await pull(); }
      catch (e) { toast("Smazání se nepovedlo. Zkontroluj připojení a zkus to znovu."); }
    } else {
      state.log = state.log.filter(e => e.id !== id); LS.set("kp-log", state.log); render();
      toast("Záznam smazán. Jako by se nikdy nestal.");
    }
  }

  /* ================= setup: create / join / leave ================= */
  function useCode(code) {
    state.code = code; state.mode = "remote";
    LS.set("kp-code", code); putCodeInUrl(code);
    const cached = LS.get(cacheKey(), null);
    if (cached) { state.people = normPeople(cached.people); state.log = (cached.log || []).filter(clean); state.loaded = true; }
    else { state.people = structuredClone(DEFAULT_PEOPLE); state.log = []; state.loaded = false; }
    render();
  }
  function setupMsg(t) { const m = $("setup-msg"); m.hidden = !t; m.textContent = t || ""; }
  function setupBusy(b) { $("create").disabled = b; $("join").disabled = b; }

  $("create").addEventListener("click", async () => {
    setupBusy(true); setupMsg("Zakládám spis…");
    const code = genCode();
    try {
      await rpc("spis_zalozit", { p_code: code, p_people: DEFAULT_PEOPLE });
      setupMsg(""); useCode(code); await pull();
      $("share").open = true;
      $("share-box").scrollIntoView({ behavior: "smooth", block: "center" });
      toast("Spis založen. Teď pošli pozvánku kamarádovi.");
    } catch (e) {
      setupMsg("Spis se nepodařilo založit. Zkontroluj připojení a zkus to znovu.");
    } finally { setupBusy(false); }
  });

  $("join-form").addEventListener("submit", async ev => {
    ev.preventDefault();
    const code = normCode($("join-code").value);
    if (!code) { setupMsg("Kód má 20 znaků, třeba k7m2p-qx9ad-r4hwe-3nvzb. Zkontroluj ho."); return; }
    setupBusy(true); setupMsg("Hledám spis…");
    try {
      const d = await rpc("spis_nacist", { p_code: code });
      if (d === null) { setupMsg("Takový spis neexistuje. Zkontroluj kód."); return; }
      setupMsg(""); useCode(code); applyRemote(d); render();
      toast("Připojeno. Vítej ve spisu.");
    } catch (e) {
      setupMsg("Spis se nepodařilo načíst. Zkontroluj připojení a zkus to znovu.");
    } finally { setupBusy(false); }
  });

  function leave(message) {
    LS.del("kp-code");
    state.code = null; state.mode = "setup"; state.loaded = false; state.log = []; state.armedLeave = false;
    state.people = structuredClone(DEFAULT_PEOPLE);
    putCodeInUrl(null);
    render(); setupMsg(message || "");
  }
  $("leave").addEventListener("click", () => {
    if (!state.armedLeave) {
      state.armedLeave = true; render();
      setTimeout(() => { if (state.armedLeave) { state.armedLeave = false; render(); } }, 4000);
    } else leave("Telefon je odpojený. Spis zůstává uložený, stačí zadat kód znovu.");
  });

  $("invite").addEventListener("click", async () => {
    const url = location.origin + location.pathname + "?spis=" + state.code;
    const text = "Pojď do spisu Kdo platil. Ať víme, kdo je na řadě.";
    if (navigator.share) {
      try { await navigator.share({ title: "Kdo platil?", text, url }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(text + " " + url); toast("Pozvánka je ve schránce. Vlož ji do zprávy."); }
    catch (e) {
      const r = document.createRange(); r.selectNodeContents($("code-view"));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      toast("Kód je označený. Zkopíruj ho a pošli.");
    }
  });

  /* ================= names & kind ================= */
  document.querySelectorAll('input[name="kind"]').forEach(r => r.addEventListener("change", () => { state.kind = r.value; LS.set("kp-kind", r.value); }));

  $("names-form").addEventListener("submit", async ev => {
    ev.preventDefault();
    const people = normPeople({
      a: { name: $("name-a").value, g: $("g-a").value },
      b: { name: $("name-b").value, g: $("g-b").value }
    });
    if (state.mode === "remote") {
      try { await rpc("spis_jmena", { p_code: state.code, p_people: people }); }
      catch (e) { toast("Jména se nepodařilo uložit. Zkontroluj připojení a zkus to znovu."); return; }
    } else LS.set("kp-people", people);
    state.people = people;
    $("settings").open = false;
    render();
    toast("Jména uložena. Identita podezřelých potvrzena.");
    if (state.mode === "remote") pull();
  });

  /* ================= boot ================= */
  function boot() {
    buildScene();
    if (!REMOTE) {
      state.people = normPeople(LS.get("kp-people", null));
      state.log = (LS.get("kp-log", []) || []).filter(clean).sort((x, y) => y.at - x.at);
      state.loaded = true;
      render();
    } else {
      const code = codeFromUrl() || normCode(LS.get("kp-code", null));
      if (code) { useCode(code); pull(); }
      else { state.mode = "setup"; render(); }
      setInterval(() => { if (document.visibilityState === "visible") pull(); }, POLL_MS);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") pull(); });
      window.addEventListener("online", pull);
    }
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  boot();
})();
