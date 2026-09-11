/* ============================================================
   Intro to Sociology — Study Guide  ·  interactions
   Vanilla JS, no dependencies. Progressive enhancement:
   the page is fully readable with JS disabled.
   ============================================================ */
(function () {
  "use strict";
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };

  /* ---------- Theme ---------- */
  const root = document.documentElement;
  const savedTheme = store.get("soc-theme", null);
  if (savedTheme) root.setAttribute("data-theme", savedTheme);
  else if (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches)
    root.setAttribute("data-theme", "dark");

  $("#theme-toggle")?.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    store.set("soc-theme", next);
  });

  /* ---------- Build TOC from sections ---------- */
  const sections = $$(".section");
  const toc = $("#toc");
  sections.forEach((sec, i) => {
    const title = sec.dataset.title || sec.querySelector("h2")?.textContent || sec.id;
    const num = sec.dataset.num || "";
    const li = document.createElement("li");
    li.innerHTML =
      `<a href="#${sec.id}" data-target="${sec.id}">` +
      `<span class="num">${num}</span><span class="lbl">${title}</span>` +
      `<span class="dot" title="Revised"></span></a>`;
    toc.appendChild(li);
  });
  const tocLinks = $$("#toc a");

  /* ---------- Revise progress (checkboxes + ring + toc dots) ---------- */
  const revised = new Set(store.get("soc-revised", []));
  const ring = $("#ring"), ringPct = $("#ring-pct");

  function refreshProgress() {
    const total = sections.length || 1;
    const done = sections.filter(s => revised.has(s.id)).length;
    const pct = Math.round((done / total) * 100);
    if (ring) ring.style.setProperty("--p", pct);
    if (ringPct) ringPct.textContent = pct + "%";
    const lbl = $("#ring-label");
    if (lbl) lbl.innerHTML = `<b>${done} / ${total} revised</b>keep going — you've got this`;
    tocLinks.forEach(a => a.classList.toggle("done", revised.has(a.dataset.target)));
  }

  sections.forEach(sec => {
    const cb = sec.querySelector('input[type="checkbox"].revise');
    if (!cb) return;
    cb.checked = revised.has(sec.id);
    sec.classList.toggle("done", cb.checked);
    cb.addEventListener("change", () => {
      if (cb.checked) revised.add(sec.id); else revised.delete(sec.id);
      sec.classList.toggle("done", cb.checked);
      store.set("soc-revised", Array.from(revised));
      refreshProgress();
    });
  });
  refreshProgress();

  $("#reset-progress")?.addEventListener("click", () => {
    revised.clear(); store.set("soc-revised", []);
    sections.forEach(s => { s.classList.remove("done");
      const cb = s.querySelector("input.revise"); if (cb) cb.checked = false; });
    refreshProgress();
  });

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
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    const pct = max > 0 ? (h.scrollTop / max) * 100 : 0;
    if (bar) bar.style.width = pct + "%";
    $("#totop")?.classList.toggle("show", h.scrollTop > 600);
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
