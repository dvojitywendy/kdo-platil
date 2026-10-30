(() => {
  "use strict";

  const CFG = window.KDO_PLATIL_CONFIG || {};
  const REPO = String(CFG.dataRepo || "").trim();
  const FILE = String(CFG.dataPath || "spis.json").trim();
  const REMOTE = /^[\w.-]+\/[\w.-]+$/.test(REPO);
  const API = "https://api.github.com";
  const DEFAULT_PEOPLE = { a: { name: "Wendy", g: "f" }, b: { name: "Kamarád", g: "m" } };
  const POLL_MS = 20000;

  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  const state = {
    mode: REMOTE ? "remote" : "local",
    token: null,
    rev: 0,              // revision of the spis we show; stale reads (lower rev) are ignored
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
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ================= backend: one JSON file in a private GitHub repo ================= */
  const b64enc = s => { const b = new TextEncoder().encode(s); let bin = ""; for (const x of b) bin += String.fromCharCode(x); return btoa(bin); };
  const b64dec = s => new TextDecoder().decode(Uint8Array.from(atob(String(s).replace(/\s/g, "")), c => c.charCodeAt(0)));
  const contentsUrl = () => `${API}/repos/${REPO}/contents/${FILE.split("/").map(encodeURIComponent).join("/")}`;

  async function gh(url, opts = {}, token = state.token) {
    const headers = Object.assign({
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: "Bearer " + token
    }, opts.body ? { "Content-Type": "application/json" } : {}, opts.headers || {});
    const res = await fetch(url, { method: opts.method || "GET", headers, body: opts.body, cache: "no-store" });
    if (res.status === 304) return { status: 304 };
    const text = await res.text();
    let body = null; try { body = text ? JSON.parse(text) : null; } catch (e) {}
    if (!res.ok) { const e = new Error((body && body.message) || res.statusText); e.status = res.status; e.body = body; throw e; }
    return { status: res.status, body, etag: res.headers.get("ETag") };
  }

  function emptyDoc() { return { app: "kdo-platil", rev: 0, people: structuredClone(DEFAULT_PEOPLE), log: [] }; }
  function normDoc(d) {
    const out = emptyDoc();
    if (d && typeof d === "object") {
      out.rev = Number.isFinite(d.rev) ? d.rev : 0;
      out.people = normPeople(d.people);
      out.log = (Array.isArray(d.log) ? d.log : []).filter(clean)
        .map(e => ({ id: String(e.id), who: e.who, kind: e.kind === "brunch" ? "brunch" : "cake", at: e.at }))
        .sort((x, y) => y.at - x.at);
    }
    return out;
  }

  // Read the spis. Returns {doc, sha} or {doc:null, sha:null} if the file doesn't exist yet.
  let etag = null;
  async function readDoc(useEtag) {
    try {
      const r = await gh(contentsUrl(), useEtag && etag ? { headers: { "If-None-Match": etag } } : {});
      if (r.status === 304) return { unchanged: true };
      etag = r.etag;
      return { doc: normDoc(JSON.parse(b64dec(r.body.content))), sha: r.body.sha };
    } catch (e) {
      if (e.status === 404) return { doc: null, sha: null };
      throw e;
    }
  }

  // Read → change → write with the file's sha. GitHub rejects the write if someone else
  // committed in between (409/422); then we read again and retry. Reads can briefly lag
  // behind a fresh commit, so a read older than what we already show is retried too.
  async function mutate(change, message) {
    let lastErr = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      if (attempt) await sleep(400 * attempt + Math.random() * 300);
      try {
        const { doc, sha } = await readDoc(false);
        if (doc && doc.rev < state.rev) { lastErr = new Error("stale read"); continue; }
        const base = doc || emptyDoc();
        const next = change(structuredClone(base));
        next.rev = Math.max(base.rev, state.rev) + 1;
        next.updatedAt = new Date().toISOString();
        const body = { message, content: b64enc(JSON.stringify(next, null, 2) + "\n") };
        if (sha) body.sha = sha;
        const r = await gh(contentsUrl(), { method: "PUT", body: JSON.stringify(body) });
        etag = null;
        applyDoc(normDoc(next), true);
        return r;
      } catch (e) {
        lastErr = e;
        if (e.status === 409 || e.status === 422) continue;
        throw e;
      }
    }
    throw lastErr;
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

  // Points: brunch is twice the price of coffee and cake.
  const PTS = { brunch: 2, cake: 1 };
  const pts = e => PTS[e.kind] || 1;
  const bodu = n => (n === 1 ? "bod" : n >= 2 && n <= 4 ? "body" : "bodů");
  function scores() {
    const s = { a: 0, b: 0 };
    state.log.forEach(e => { s[e.who] += pts(e); });
    return s;
  }
  // Whoever is behind on points pays next; on a tie, whoever didn't pay last.
  function nextPayer() {
    if (!state.log.length) return null;
    const s = scores();
    if (s.a !== s.b) return s.a < s.b ? "a" : "b";
    return other(state.log[0].who);
  }
  function debtLine(N, d) {
    if (d === 1) return `${N.name} je pozadu o 1 bod. Jeden dort a svědomí je zase čisté.`;
    if (d === 2) return `${N.name} dluží 2 body. To je jeden brunch, nebo dva dorty. Vyber si svou pokutu.`;
    return `${N.name} dluží ${d} ${bodu(d)}. Tohle už není zapomnětlivost, tohle je strategie.`;
  }

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
    $("repo-name").textContent = REPO;
    $("code-view").textContent = `${REPO} · ${FILE}`;
    $("history-link").href = `https://github.com/${REPO}/commits`;

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
      $("next").textContent = "Nikdo. Zatím.";
      $("tag").textContent = "Spis je zamčený. Vlož přístupový klíč a pustíme se do vyšetřování.";
      $("last").textContent = "";
    } else if (!state.loaded) {
      $("next").textContent = "…"; $("tag").textContent = "Otevírám spis."; $("last").textContent = "";
    } else if (!last) {
      $("next").textContent = "Nikdo. Zatím.";
      $("tag").textContent = "Spis je prázdný. Kdo zaplatí první, stává se hlavním podezřelým.";
      $("last").textContent = "";
    } else {
      const nw = nextPayer(), N = P(nw), L = P(last.who), s = scores();
      const debt = s[other(nw)] - s[nw];
      const t = taglines(N, L);
      $("next").textContent = N.name;
      $("tag").textContent = debt > 0 ? debtLine(N, debt) : t[state.log.length % t.length];
      let lt = `Naposledy: ${L.name} · ${kindName(last.kind)} · ${relDay(last.at)}`;
      if (dayDiff(last.at) >= 14) lt += ". Dva týdny bez kafe? Jste v pořádku?";
      $("last").textContent = lt;
      $("score").textContent = `${P("a").name} ${s.a} : ${s.b} ${P("b").name}`;
    }
    if (!last || state.mode === "setup" || !state.loaded) $("score").textContent = "";
    const nextW = last && state.mode !== "setup" ? nextPayer() : null;
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
    btn.textContent = state.busy ? "Zapisuju do spisu…" : `Dneska jsem ${g(me, "platil", "platila")} já`;
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
      const k = document.createElement("span"); k.className = "kind " + (e.kind === "brunch" ? "brunch" : "cake"); k.textContent = `${kindName(e.kind)} · ${pts(e)} ${bodu(pts(e))}`;
      li.append(no, nm, dt, k);
      if (i === 0 && !state.busy) {
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
      const w = log[0].who, p = P(w), s = scores();
      rm.textContent = s[w] > s[other(w)]
        ? `${p.name} ${g(p, "platil", "platila")} ${n}× po sobě a je v plusu. Buď je to velkorysost, nebo příprava na velkou prosbu.`
        : `${p.name} ${g(p, "platil", "platila")} ${n}× po sobě, ale jen ${g(p, "splácel", "splácela")} dluh. Žádná velkorysost, čistá matematika.`;
    }
  }

  function renderStats() {
    const tb = $("stats"); tb.replaceChildren();
    const c = { a: { brunch: 0, cake: 0 }, b: { brunch: 0, cake: 0 } };
    state.log.forEach(e => { c[e.who][e.kind === "brunch" ? "brunch" : "cake"]++; });
    ["a", "b"].forEach(w => {
      const tr = document.createElement("tr");
      [P(w).name, c[w].brunch, c[w].cake, c[w].brunch * PTS.brunch + c[w].cake * PTS.cake].forEach(v => { const td = document.createElement("td"); td.textContent = v; tr.appendChild(td); });
      tb.appendChild(tr);
    });
    const d = $("dodge"), diff = c.a.brunch - c.b.brunch;
    d.hidden = Math.abs(diff) < 2;
    if (Math.abs(diff) >= 2) {
      const low = P(diff > 0 ? "b" : "a");
      d.textContent = `${low.name} platí podezřele často jen kafe a dort. Body sedí, ale detektivové na náhody nevěří.`;
    }
  }

  function isStandalone() {
    try { return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; } catch (e) { return false; }
  }
  function renderFoot() {
    const f = $("foot"); f.replaceChildren();
    const line = t => { const d = document.createElement("div"); d.textContent = t; f.appendChild(d); };
    if (state.mode === "local") line("Sdílený spis není nastavený. Ukládá se jen v tomto zařízení.");
    else if (state.mode === "remote") line(state.offline ? "Jsi offline. Ukazuju poslední známý stav spisu." : "Spis je sdílený. Co zapíše jeden, uvidí i druhý.");
    if (!isStandalone()) {
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

  function applyDoc(doc, force) {
    if (!force && doc.rev < state.rev) return; // a lagging read; keep what we have
    state.rev = doc.rev;
    state.people = doc.people;
    state.log = doc.log;
    state.loaded = true;
    LS.set("kp-cache", { rev: doc.rev, people: doc.people, log: doc.log });
  }

  function handleError(e, what) {
    if (e && e.status === 401) { leave("Klíč nefunguje nebo vypršel. Vlož nový."); return; }
    if (e && (e.status === 403 || e.status === 404)) { toast(`${what} se nepovedlo: klíč nemá právo zapisovat do ${REPO}.`); return; }
    if (e && e.status === 429) { toast("GitHub nás chvíli brzdí. Zkus to za minutu."); return; }
    toast(`${what} se nepovedlo. Zkontroluj připojení a zkus to znovu.`);
  }

  let pulling = false;
  async function pull() {
    if (state.mode !== "remote" || pulling || state.busy) return;
    pulling = true;
    try {
      const r = await readDoc(true);
      state.offline = false;
      if (!r.unchanged) applyDoc(r.doc || emptyDoc(), false);
      state.loaded = true;
    } catch (e) {
      if (e.status === 401) { pulling = false; leave("Klíč nefunguje nebo vypršel. Vlož nový."); return; }
      state.offline = true;
    } finally {
      pulling = false;
      if (state.mode === "remote") render();
    }
  }

  async function addEntry(who) {
    if (!state.loaded || state.busy) return;
    const p = P(who), kind = state.kind;
    const verb = g(p, "zaplatil", "zaplatila");
    const msg = kind === "brunch"
      ? `Zapsáno: ${p.name} ${verb} brunch. Avokádo putuje do spisu.`
      : `Zapsáno: ${p.name} ${verb} kafe a dort. Dort byl jediný svědek.`;
    const entry = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), who, kind, at: Date.now() };
    if (state.mode === "remote") {
      state.busy = true; render();
      try {
        await mutate(doc => { doc.log.unshift(entry); return doc; }, `${p.name} ${verb} ${kindName(kind)}`);
        state.busy = false; render();
        toast(msg, () => removeEntry(entry.id));
      } catch (e) {
        state.busy = false; render();
        handleError(e, "Zápis");
      }
    } else {
      state.log.unshift(entry); LS.set("kp-log", state.log.slice(0, 500)); render();
      toast(msg, () => removeEntry(entry.id));
    }
  }

  async function removeEntry(id) {
    if (state.mode === "remote") {
      const victim = state.log.find(e => e.id === id);
      state.busy = true; render();
      try {
        await mutate(doc => { doc.log = doc.log.filter(e => e.id !== id); return doc; },
          victim ? `Škrtnuto: ${P(victim.who).name}, ${kindName(victim.kind)}` : "Škrtnutý záznam");
        state.busy = false; render();
        toast("Záznam smazán. Jako by se nikdy nestal.");
      } catch (e) { state.busy = false; render(); handleError(e, "Smazání"); }
    } else {
      state.log = state.log.filter(e => e.id !== id); LS.set("kp-log", state.log); render();
      toast("Záznam smazán. Jako by se nikdy nestal.");
    }
  }

  /* ================= setup: access key ================= */
  function setupMsg(t) { const m = $("setup-msg"); m.hidden = !t; m.textContent = t || ""; }

  $("key-form").addEventListener("submit", async ev => {
    ev.preventDefault();
    // Accept the bare key or the whole pasted invite message: pick the key out of it.
    const found = $("key-input").value.match(/(?:github_pat_|ghp_)[A-Za-z0-9_]{20,}/);
    const token = found ? found[0] : "";
    if (!token) {
      setupMsg("Tohle nevypadá jako klíč z GitHubu. Začíná github_pat_ a je hodně dlouhý. Klidně vlož celou pozvánku.");
      return;
    }
    $("key-submit").disabled = true; setupMsg("Ověřuju klíč…");
    try {
      await gh(`${API}/repos/${REPO}`, {}, token);
    } catch (e) {
      $("key-submit").disabled = false;
      if (e.status === 401) setupMsg("GitHub klíč odmítl. Je celý a ještě platí?");
      else if (e.status === 403 || e.status === 404) setupMsg(`Klíč funguje, ale nemá přístup k ${REPO}. Při vytváření klíče vyber právě tohle repo.`);
      else setupMsg("GitHub teď neodpovídá. Zkontroluj připojení a zkus to znovu.");
      return;
    }
    state.token = token; LS.set("kp-token", token);
    state.mode = "remote"; state.loaded = false;
    $("key-input").value = "";
    setupMsg(""); render();
    try {
      const { doc } = await readDoc(false);
      if (doc) applyDoc(doc, true);
      else await mutate(d => d, "Založení spisu");
      render();
      toast(doc ? "Spis otevřen. Vítej ve vyšetřování." : "Spis založen. Teď pošli pozvánku.");
    } catch (e) {
      $("key-submit").disabled = false;
      if (e.status === 403 || e.status === 404) leave(`Klíč smí číst, ale ne zapisovat. Při vytváření klíče nastav Contents na Read and write.`);
      else { state.offline = true; render(); }
    }
    $("key-submit").disabled = false;
  });

  function leave(message) {
    LS.del("kp-token");
    state.token = null; state.mode = "setup"; state.armedLeave = false; state.busy = false;
    render(); setupMsg(message || "");
  }
  $("leave").addEventListener("click", () => {
    if (!state.armedLeave) {
      state.armedLeave = true; render();
      setTimeout(() => { if (state.armedLeave) { state.armedLeave = false; render(); } }, 4000);
    } else leave("Telefon je odpojený. Spis zůstává na GitHubu, stačí znovu vložit klíč.");
  });

  $("invite").addEventListener("click", async () => {
    const url = location.origin + location.pathname;
    const text = `Pojď do spisu Kdo platil.\n1) Otevři ${url} v Safari a dej Sdílet → Přidat na plochu.\n2) Spusť appku z plochy a vlož tenhle klíč:\n${state.token}`;
    if (navigator.share) {
      try { await navigator.share({ title: "Kdo platil?", text }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(text); toast("Pozvánka je ve schránce. Vlož ji do zprávy."); }
    catch (e) { toast("Pozvánku se nepodařilo zkopírovat. Pošli odkaz a klíč ručně."); }
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
      if (state.busy) return;
      state.busy = true;
      try { await mutate(doc => { doc.people = people; return doc; }, `Podezřelí: ${people.a.name} a ${people.b.name}`); }
      catch (e) { state.busy = false; render(); handleError(e, "Uložení jmen"); return; }
      state.busy = false;
    } else { LS.set("kp-people", people); state.people = people; }
    $("settings").open = false;
    render();
    toast("Jména uložena. Identita podezřelých potvrzena.");
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
      state.token = LS.get("kp-token", null);
      if (!state.token) { state.mode = "setup"; render(); }
      else {
        const cached = LS.get("kp-cache", null);
        if (cached) applyDoc(normDoc(cached), true);
        render(); pull();
      }
      setInterval(() => { if (document.visibilityState === "visible") pull(); }, POLL_MS);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") pull(); });
      window.addEventListener("online", pull);
    }
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  boot();
})();
