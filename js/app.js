/* ============================================================
   Intro to Sociology — Study Guide  ·  interactions
   Vanilla JS, no dependencies. Progressive enhancement:
   the page is fully readable with JS disabled.
   ============================================================ */
(function () {
  "use strict";
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- Theme ----------
     The page opens in the system theme (already applied by the inline script
     in the head). The toggle overrides it until the page is reloaded. */
  const root = document.documentElement;
  const systemDark = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
  let themeOverride = null;

  function applyTheme() {
    const dark = themeOverride === null ? !!(systemDark && systemDark.matches) : themeOverride;
    root.setAttribute("data-theme", dark ? "dark" : "light");
  }
  applyTheme();
  systemDark?.addEventListener?.("change", () => { if (themeOverride === null) applyTheme(); });

  $("#theme-toggle")?.addEventListener("click", () => {
    themeOverride = root.getAttribute("data-theme") !== "dark";
    applyTheme();
  });

  // A theme saved by an older version of this page would otherwise sit unused.
  try { localStorage.removeItem("soc-theme"); localStorage.removeItem("soc-revised"); } catch {}

  /* ---------- Build TOC from sections ---------- */
  const sections = $$(".section");
  const toc = $("#toc");
  sections.forEach((sec, i) => {
    const title = sec.dataset.title || sec.querySelector("h2")?.textContent || sec.id;
    const num = sec.dataset.num || "";
    const li = document.createElement("li");
    li.innerHTML =
      `<a href="#${sec.id}" data-target="${sec.id}">` +
      `<span class="num">${num}</span><span class="lbl">${title}</span></a>`;
    toc.appendChild(li);
  });
  const tocLinks = $$("#toc a");

  /* ---------- Reading rail (dots for each section + how far is left) ---------- */
  const rail = $("#rail"), railFill = $("#rail-fill"), railPct = $("#rail-pct"),
        railNow = $("#rail-now"), railLeft = $("#rail-left");
  const HEAD_OFFSET = 74;              // sticky top bar, matches the CSS
  // The scrolling box is <html> normally and <body> in quirks mode.
  const scroller = () => document.scrollingElement || document.documentElement;
  const scrollMax = () => { const e = scroller(); return e.scrollHeight - e.clientHeight; };
  let marks = [];

  function buildMarks() {
    if (!rail) return;
    marks = sections.map(sec => {
      const title = sec.dataset.title || sec.id;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rail-mark";
      b.title = (sec.dataset.num ? sec.dataset.num + " · " : "") + title;
      b.setAttribute("aria-label", "Jump to " + title);
      b.addEventListener("click", () => {
        const top = sec.getBoundingClientRect().top + window.scrollY - HEAD_OFFSET;
        window.scrollTo({ top, behavior: "smooth" });
        if (innerWidth <= 920) closeNav();
      });
      rail.appendChild(b);
      return { el: b, sec, pos: 0, top: 0 };
    });
    placeMarks();
  }

  function placeMarks() {
    const max = scrollMax();
    marks.forEach(m => {
      const hidden = m.sec.classList.contains("search-hide");
      m.el.hidden = hidden;
      if (hidden) return;
      m.top = m.sec.getBoundingClientRect().top + window.scrollY;
      const start = m.top - HEAD_OFFSET;
      m.pos = max > 0 ? Math.min(1, Math.max(0, start / max)) : 0;
      m.el.style.left = (m.pos * 100) + "%";
    });
  }

  function updateRail(pct) {
    if (!railFill) return;
    railFill.style.width = pct + "%";
    if (railPct) railPct.textContent = Math.round(pct) + "%";
    if (railLeft) railLeft.textContent = Math.max(0, 100 - Math.round(pct)) + "% left";
    const line = window.scrollY + innerHeight * 0.45;   // same reference as the scroll spy
    let cur = -1;
    marks.forEach((m, i) => { if (!m.el.hidden && m.top <= line) cur = i; });
    marks.forEach((m, i) => {
      m.el.classList.toggle("passed", i <= cur);
      m.el.classList.toggle("current", i === cur);
    });
    if (railNow) railNow.textContent = cur >= 0
      ? (marks[cur].sec.dataset.title || marks[cur].sec.id)
      : "Start";
  }

  let reflowTimer;
  function reflowRail() {
    clearTimeout(reflowTimer);
    reflowTimer = setTimeout(() => { placeMarks(); onScroll(); }, 90);
  }
  buildMarks();
  addEventListener("resize", reflowRail);
  addEventListener("load", reflowRail);
  if (window.ResizeObserver) new ResizeObserver(reflowRail).observe(document.body);

  /* ---------- Scroll spy + reading progress bar ---------- */
  const bar = $("#progress-bar");
  const spy = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        tocLinks.forEach(a => a.classList.toggle("active", a.dataset.target === e.target.id));
      }
    });
  }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
  sections.forEach(s => spy.observe(s));

  function onScroll() {
    const max = scrollMax();
    const y = window.scrollY;
    const pct = max > 0 ? Math.min(100, (y / max) * 100) : 0;
    if (bar) bar.style.width = pct + "%";
    updateRail(pct);
    $("#totop")?.classList.toggle("show", y > 600);
  }
  document.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  $("#totop")?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  /* ---------- Mobile sidebar ---------- */
  const sidebar = $("#sidebar"), scrim = $("#scrim");
  const openNav  = () => { sidebar?.classList.add("open"); scrim?.classList.add("show"); };
  const closeNav = () => { sidebar?.classList.remove("open"); scrim?.classList.remove("show"); };
  $("#menu-btn")?.addEventListener("click", openNav);
  scrim?.addEventListener("click", closeNav);
  tocLinks.forEach(a => a.addEventListener("click", () => { if (innerWidth <= 920) closeNav(); }));

  /* ---------- Search / filter ---------- */
  const search = $("#search");
  const noResults = $("#no-results");
  let searchTimer;

  function clearMarks() {
    $$("mark.hit").forEach(m => { const t = document.createTextNode(m.textContent); m.replaceWith(t); });
    document.querySelectorAll(".prose, .exam, .defs").forEach(n => n.normalize());
  }
  function highlight(node, re) {
    $$("p, li, dd, dt, h3, h4, .callout", node).forEach(el => {
      el.childNodes.forEach(cn => {
        if (cn.nodeType !== 3) return;
        const txt = cn.nodeValue;
        if (!re.test(txt)) return;
        const span = document.createElement("span");
        span.innerHTML = txt.replace(re, m => `<mark class="hit">${m}</mark>`);
        cn.replaceWith(...span.childNodes);
      });
    });
  }
  function runSearch(q) {
    clearMarks();
    q = q.trim();
    let visible = 0;
    if (!q) {
      sections.forEach(s => s.classList.remove("search-hide"));
      noResults?.classList.remove("show");
      reflowRail();
      return;
    }
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp("(" + safe + ")", "gi");
    sections.forEach(s => {
      const hit = re.test(s.textContent);
      re.lastIndex = 0;
      s.classList.toggle("search-hide", !hit);
      if (hit) { visible++; highlight(s, re); }
    });
    noResults?.classList.toggle("show", visible === 0);
    reflowRail();
  }
  search?.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch(search.value), 130);
  });
  search?.addEventListener("keydown", e => { if (e.key === "Escape") { search.value = ""; runSearch(""); search.blur(); } });
  document.addEventListener("keydown", e => {
    if ((e.key === "/" || (e.key === "k" && (e.metaKey || e.ctrlKey))) &&
        document.activeElement !== search) {
      e.preventDefault(); search?.focus();
    }
  });

  /* ---------- Flashcards (harvested from .defs glossaries) ---------- */
  const deck = [];
  $$(".defs > div").forEach(row => {
    const term = row.querySelector("dt")?.textContent.trim();
    const def = row.querySelector("dd")?.textContent.trim();
    const topic = row.closest(".section")?.dataset.title || "";
    if (term && def) deck.push({ term, def, topic });
  });

  const modal = $("#fc-modal");
  let order = [], idx = 0, flipped = false;

  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function renderCard() {
    if (!deck.length) return;
    const card = deck[order[idx]];
    flipped = false;
    $("#fc").classList.remove("flipped");
    $("#fc-term").textContent = card.term;
    $("#fc-def").textContent = card.def;
    $("#fc-topic").textContent = card.topic;
    $("#fc-topic-back").textContent = card.topic;
    $("#fc-count").textContent = `${idx + 1} / ${order.length}`;
    $("#fc-fill").style.width = ((idx + 1) / order.length * 100) + "%";
  }
  function openDeck() {
    if (!deck.length) return;
    order = shuffle(deck.map((_, i) => i)); idx = 0;
    renderCard();
    modal.classList.add("open");
  }
  function closeDeck() { modal.classList.remove("open"); }
  function next() { if (idx < order.length - 1) { idx++; renderCard(); } }
  function prev() { if (idx > 0) { idx--; renderCard(); } }
  function flip() { flipped = !flipped; $("#fc").classList.toggle("flipped", flipped); }

  const fcCount = $("#fab-count");
  if (fcCount) fcCount.textContent = deck.length;
  $("#fab")?.addEventListener("click", openDeck);
  $("#fc-close")?.addEventListener("click", closeDeck);
  $("#fc")?.addEventListener("click", flip);
  $("#fc-next")?.addEventListener("click", e => { e.stopPropagation(); next(); });
  $("#fc-prev")?.addEventListener("click", e => { e.stopPropagation(); prev(); });
  modal?.addEventListener("click", e => { if (e.target === modal) closeDeck(); });
  document.addEventListener("keydown", e => {
    if (!modal?.classList.contains("open")) return;
    if (e.key === "Escape") closeDeck();
    else if (e.key === "ArrowRight") next();
    else if (e.key === "ArrowLeft") prev();
    else if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); }
  });

  /* ---------- Year in footer ---------- */
  const y = $("#year"); if (y) y.textContent = new Date().getFullYear();
})();
