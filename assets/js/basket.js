/* KCC RESPOND Basket — work-package cards -> project list -> problem-statement modal.
   Data comes from window.BASKET_DATA (assets/js/basket-data.js), extracted from the
   original basket document. Vanilla JS, no build step. */
(function(){
  "use strict";
  var data = window.BASKET_DATA;
  if (!data) return;

  var cardsEl = document.getElementById("wp-cards"),
      panelEl = document.getElementById("wp-panel"),
      panelTitleEl = document.getElementById("wp-panel-title"),
      panelCountEl = document.getElementById("wp-panel-count"),
      listEl = document.getElementById("wp-project-list"),
      backBtn = document.getElementById("wp-back"),
      modalEl = document.getElementById("project-modal"),
      modalBodyEl = document.getElementById("modal-body"),
      modalCloseBtn = document.getElementById("modal-close");
  if (!cardsEl) return;

  var byPrefix = {}, byCode = {};
  data.projects.forEach(function(p){
    (byPrefix[p.prefix] = byPrefix[p.prefix] || []).push(p);
    byCode[p.code] = p;
  });

  function el(tag, cls, text){
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function renderCards(){
    cardsEl.textContent = "";
    data.groups.forEach(function(g, i){
      var count = (byPrefix[g.code] || []).length;
      var card = el("button", "wp-card");
      card.style.setProperty("--d", (i * 0.035) + "s");
      card.type = "button";
      card.setAttribute("data-prefix", g.code);
      var code = el("span", "wp-card-code", g.code);
      var n = el("span", "wp-card-count", count + (count === 1 ? " project" : " projects"));
      var h = el("h3", null, g.name);
      var p = el("p", null, g.blurb);
      card.appendChild(code);
      card.appendChild(n);
      card.appendChild(h);
      card.appendChild(p);
      card.addEventListener("click", function(){ openGroup(g.code); });
      cardsEl.appendChild(card);
    });
  }

  function difficultyParts(d){
    // "Advanced  |  3 students" -> ["Advanced", "3 students"]
    var parts = (d || "").split("|").map(function(s){ return s.trim(); });
    return {level: parts[0] || "", team: parts[1] || ""};
  }

  function renderList(prefix){
    var group = data.groups.filter(function(g){ return g.code === prefix; })[0];
    var items = byPrefix[prefix] || [];
    panelTitleEl.textContent = group ? group.name : prefix;
    panelCountEl.textContent = items.length + (items.length === 1 ? " project" : " projects");
    listEl.textContent = "";
    items.forEach(function(p, i){
      var diff = difficultyParts(p.difficulty);
      var card = el("button", "wp-project-card");
      card.type = "button";
      card.style.setProperty("--d", (i * 0.045) + "s");
      card.appendChild(el("span", "pc-code", p.code));
      card.appendChild(el("h4", "pc-title", p.title));
      card.appendChild(el("p", "pc-skills", p.skills));
      var foot = el("div", "pc-foot");
      foot.appendChild(el("span", "wp-project-level lvl-" + diff.level.toLowerCase(), diff.level));
      foot.appendChild(el("span", "pc-team", diff.team));
      card.appendChild(foot);
      card.addEventListener("click", function(){ openProject(p.code); });
      listEl.appendChild(card);
    });
  }

  function openGroup(prefix){
    if (panelTimer) hideGroup();   // close still in flight — land it, then reopen clean
    renderList(prefix);
    panelEl.classList.remove("is-closing");
    panelEl.hidden = false;
    cardsEl.hidden = true;
    panelEl.scrollIntoView({block: "start", behavior: prefersReduce() ? "auto" : "smooth"});
  }

  /* Exit animations need the element to stay in the DOM until they finish, so
     hiding is deferred. The pending timer doubles as the "is closing" flag: a
     repeat call (double-click, held Escape) is ignored, and a re-open snaps the
     close to its end first rather than animating out of a half-faded state. */
  var EXIT_MS = 200, panelTimer = 0, modalTimer = 0;

  function closeGroup(){
    if (panelEl.hidden || panelTimer) return;
    if (prefersReduce()){ hideGroup(); return; }
    panelEl.classList.add("is-closing");
    panelTimer = setTimeout(hideGroup, EXIT_MS);
  }
  function hideGroup(){
    clearTimeout(panelTimer); panelTimer = 0;
    panelEl.classList.remove("is-closing");
    panelEl.hidden = true;
    cardsEl.hidden = false;
  }
  function prefersReduce(){
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function linkageEl(raw){
    // raw may be "BSAT-STR-2026-003, BSAT-MSN-2026-004" or plain text like "All teams"
    var wrap = el("span", "wp-linkage");
    var codes = raw.match(/BSAT-[A-Z]+-2026-\d+/g);
    if (!codes){
      wrap.textContent = raw;
      return wrap;
    }
    var rest = raw, first = true;
    codes.forEach(function(code){
      var idx = rest.indexOf(code);
      var lead = rest.slice(0, idx).replace(/^,\s*/, first ? "" : ", ");
      if (lead) wrap.appendChild(document.createTextNode(lead));
      var a = el("a", "wp-linkage-code", code);
      a.href = "#";
      if (byCode[code]){
        a.addEventListener("click", function(ev){ ev.preventDefault(); openProject(code); });
      } else {
        a.classList.add("disabled");
      }
      wrap.appendChild(a);
      rest = rest.slice(idx + code.length);
      first = false;
    });
    if (rest) wrap.appendChild(document.createTextNode(rest));
    return wrap;
  }

  function openProject(code){
    var p = byCode[code];
    if (!p) return;
    if (modalTimer) hideModal();   // close still in flight — land it, then reopen clean
    // already open means this is a linkage cross-link: the overlay won't replay
    // its entrance animation, so fade the swapped content in by hand
    var wasOpen = !modalEl.hidden;
    var diff = difficultyParts(p.difficulty);
    modalBodyEl.textContent = "";

    var eyebrow = el("p", "modal-eyebrow", p.subsystem);
    var h2 = el("h2", "modal-title", p.title);
    var codeLine = el("p", "modal-code", p.code);
    var meta = el("div", "modal-meta");
    var skillsBlk = el("div", "modal-field");
    skillsBlk.appendChild(el("h4", null, "Key skills & tools"));
    skillsBlk.appendChild(el("p", null, p.skills));
    var diffBlk = el("div", "modal-field");
    diffBlk.appendChild(el("h4", null, "Difficulty"));
    var diffP = el("p", null, "");
    var badge = el("span", "wp-project-level lvl-" + diff.level.toLowerCase(), diff.level);
    diffP.appendChild(badge);
    diffP.appendChild(document.createTextNode("  " + diff.team));
    diffBlk.appendChild(diffP);
    meta.appendChild(skillsBlk);
    meta.appendChild(diffBlk);

    var summary = el("div", "modal-field");
    summary.appendChild(el("h4", null, "Problem statement"));
    summary.appendChild(el("p", null, p.summary));

    var scope = el("div", "modal-field");
    scope.appendChild(el("h4", null, "Scope of work"));
    scope.appendChild(el("p", null, p.scope));

    var deliv = el("div", "modal-field");
    deliv.appendChild(el("h4", null, "Expected deliverables"));
    var ul = el("ul", "modal-list");
    p.deliverables.forEach(function(d){ ul.appendChild(el("li", null, d)); });
    deliv.appendChild(ul);

    modalBodyEl.appendChild(eyebrow);
    modalBodyEl.appendChild(h2);
    modalBodyEl.appendChild(codeLine);
    modalBodyEl.appendChild(meta);
    modalBodyEl.appendChild(summary);
    modalBodyEl.appendChild(scope);
    modalBodyEl.appendChild(deliv);

    if (p.linkages && p.linkages.length){
      var link = el("div", "modal-field");
      link.appendChild(el("h4", null, "Linked projects"));
      var linkP = el("p", "modal-linkages");
      p.linkages.forEach(function(raw, i){
        if (i > 0) linkP.appendChild(document.createTextNode("; "));
        linkP.appendChild(linkageEl(raw));
      });
      link.appendChild(linkP);
      modalBodyEl.appendChild(link);
    }

    if (wasOpen){
      modalEl.scrollTop = 0;
      modalBodyEl.classList.remove("swap-in");
      void modalBodyEl.offsetWidth;   // reflow, so the animation restarts
      modalBodyEl.classList.add("swap-in");
    } else {
      modalBodyEl.classList.remove("swap-in");
      modalEl.classList.remove("is-closing");
      modalEl.hidden = false;
      document.body.classList.add("modal-open");
    }
    modalCloseBtn.focus();
  }
  function closeModal(){
    if (modalEl.hidden || modalTimer) return;
    if (prefersReduce()){ hideModal(); return; }
    modalEl.classList.add("is-closing");
    modalTimer = setTimeout(hideModal, EXIT_MS);
  }
  function hideModal(){
    clearTimeout(modalTimer); modalTimer = 0;
    modalEl.classList.remove("is-closing");
    modalEl.hidden = true;
    document.body.classList.remove("modal-open");
  }

  backBtn.addEventListener("click", closeGroup);
  modalCloseBtn.addEventListener("click", closeModal);
  modalEl.addEventListener("click", function(e){ if (e.target === modalEl) closeModal(); });
  document.addEventListener("keydown", function(e){
    if (e.key === "Escape" && !modalEl.hidden) closeModal();
  });

  renderCards();
})();
