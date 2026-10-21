/* MiniMedica · drobné ovládání (menu na mobilu, dropdown, FAQ akordeon, mapa)
   Webflow: navbar lze nahradit nativním Navbar prvkem; FAQ jako Embed skript na stránkách s FAQ. */
(function () {
  "use strict";
  var nav = document.querySelector(".navbar_component");
  /* stín pod navigací po odscrollování (IntersectionObserver, žádný scroll listener) */
  var sentinel = document.querySelector(".navbar_sentinel");
  if (nav && sentinel && "IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { nav.classList.toggle("is-scrolled", !es[0].isIntersecting); }).observe(sentinel);
  }
  var btn = nav && nav.querySelector(".navbar_menu-button");
  function zavritMenu() { nav.classList.remove("is-menu-open"); btn.setAttribute("aria-expanded", "false"); }
  if (btn) {
    btn.addEventListener("click", function () {
      var open = nav.classList.toggle("is-menu-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && nav.classList.contains("is-menu-open")) { zavritMenu(); btn.focus(); } });
    /* kotva nebo položka rozbalovacího menu menu zavře; přepínač dropdownu (aria-haspopup) ne, i když vede na kotvu (Webflow: /#ordinace) */
    nav.querySelectorAll('.navbar_menu a[href^="/#"]:not([aria-haspopup]), .navbar_dropdown-link').forEach(function (a) { a.addEventListener("click", zavritMenu); });
  }

  /* Dropdowny a megamenu. Otevření: panel sjede o pár px shora a rozsvítí se, položky postupně (stagger 50 ms).
     Zavření je rychlejší než otevření, nový klik animaci přeruší. Bez GSAP nebo s omezeným pohybem: jen přepnutí / prolnutí. */
  var gs = window.gsap, klid = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll(".navbar_dropdown").forEach(function (dd) {
    var toggle = dd.querySelector(".navbar_link"), list = dd.querySelector(".navbar_dropdown-list");
    var polozky = list.querySelectorAll(".navbar_mega-card, .navbar_mega-link, .navbar_dropdown-list > .navbar_dropdown-link");
    var otevreno = false;
    function set(open) {
      if (open === otevreno) return;
      otevreno = open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (!gs) { list.classList.toggle("hide", !open); return; }
      gs.killTweensOf([list, polozky]);
      if (open) {
        list.classList.remove("hide");
        /* jen průhlednost, ne autoAlpha: odkazy jdou zaměřit klávesnicí hned od začátku animace */
        if (klid) { gs.fromTo(list, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "power1.out" }); return; }
        gs.fromTo(list, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.28, ease: "power3.out", clearProps: "transform" });
        gs.fromTo(polozky, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.32, ease: "power3.out", stagger: 0.05, delay: 0.04, clearProps: "transform,opacity" });
      } else {
        gs.to(list, { autoAlpha: 0, y: klid ? 0 : -6, duration: 0.16, ease: "power2.out", onComplete: function () { list.classList.add("hide"); gs.set(list, { clearProps: "all" }); } });
      }
    }
    toggle.addEventListener("click", function (e) { e.preventDefault(); set(!otevreno); });
    /* Na počítači s myší se otevírá najetím: krátká prodleva proti náhodnému přejetí, při odjezdu chvíle na přesun do panelu. */
    var mys = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine) and (min-width: 992px)"), casovac;
    dd.addEventListener("mouseenter", function () { if (!mys || !mys.matches) return; clearTimeout(casovac); casovac = setTimeout(function () { set(true); }, 80); });
    dd.addEventListener("mouseleave", function () { if (!mys || !mys.matches) return; clearTimeout(casovac); casovac = setTimeout(function () { set(false); }, 200); });
    dd.addEventListener("keydown", function (e) { if (e.key === "Escape") { set(false); toggle.focus(); } });
    document.addEventListener("click", function (e) { if (!dd.contains(e.target)) set(false); });
  });

  /* FAQ akordeon. Webflow neumí id z CMS: odpověď bez id dostane faq-1, faq-2 … podle pořadí na stránce
     a otázka odpovídající aria-controls. */
  var faqCislo = 0;
  document.querySelectorAll(".faq_item").forEach(function (item) {
    var q = item.querySelector(".faq_question"), a = item.querySelector(".faq_answer");
    if (!q) return;
    faqCislo++;
    if (a && !a.id) {
      while (document.getElementById("faq-" + faqCislo)) faqCislo++;
      a.id = "faq-" + faqCislo;
    }
    if (a && !q.getAttribute("aria-controls")) q.setAttribute("aria-controls", a.id);
    if (!q.hasAttribute("aria-expanded")) q.setAttribute("aria-expanded", item.classList.contains("is-open") ? "true" : "false");
    q.addEventListener("click", function (e) {
      if (q.tagName !== "BUTTON") e.preventDefault(); /* odkaz nebo div místo tlačítka: neskákat na „#“ */
      var open = item.classList.toggle("is-open");
      q.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });

  /* Formuláře: ve Webflow nativní Form Block (stavy w-form-done / w-form-fail). Tady jen ukázka chování.
     Formulář uvnitř .w-form (Webflow) se nezachytává: validuje prohlížeč (required, type=email) a odesílá Webflow sám. */
  document.querySelectorAll("form[data-mm-form]").forEach(function (form) {
    if (form.closest(".w-form")) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true;
      form.querySelectorAll("[required]").forEach(function (f) {
        var bad = f.type === "checkbox" ? !f.checked : !f.value.trim();
        f.classList.toggle("is-error", bad); f.setAttribute("aria-invalid", bad ? "true" : "false");
        if (bad) ok = false;
      });
      var wrap = form.closest(".form_component");
      var err = wrap.querySelector(".form_message-error"), done = wrap.querySelector(".form_message-success");
      if (!ok) { err.classList.remove("hide"); var first = form.querySelector(".is-error"); if (first) first.focus(); return; }
      err.classList.add("hide"); form.classList.add("hide"); done.classList.remove("hide");
    });
  });

  /* Filtr seznamu (Webflow: Finsweet Attributes List Filter) */
  document.querySelectorAll("[data-mm-filter]").forEach(function (bar) {
    var list = document.querySelector(bar.dataset.mmFilter);
    /* Webflow neumí vypsat Multi-reference do atributu: položka s data-filter-item="ze-stitku" si hodnotu složí
       ze štítků [data-filter-slug] uvnitř (vnořený list Ordinace). Bez štítků (celá síť) patří ke všem hodnotám filtru. */
    var vsechny = Array.prototype.map.call(bar.querySelectorAll("[data-filter-value]"), function (b) { return b.dataset.filterValue; })
      .filter(function (v) { return v && v !== "vse"; });
    if (list) list.querySelectorAll('[data-filter-item="ze-stitku"]').forEach(function (it) {
      var slugy = Array.prototype.map.call(it.querySelectorAll("[data-filter-slug]"), function (s) { return s.dataset.filterSlug.trim(); }).filter(Boolean);
      it.dataset.filterItem = (slugy.length ? slugy : vsechny).join(" ");
    });
    bar.querySelectorAll("[data-filter-value]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var v = btn.dataset.filterValue;
        bar.querySelectorAll("[data-filter-value]").forEach(function (b) { b.classList.toggle("is-active", b === btn); b.setAttribute("aria-pressed", b === btn ? "true" : "false"); });
        list.querySelectorAll("[data-filter-item]").forEach(function (it) {
          /* prošlé položky (engine: data-mm-proslo) zůstávají skryté v každém filtru */
          it.classList.toggle("hide", it.hasAttribute("data-mm-proslo") || (v !== "vse" && (" " + it.dataset.filterItem + " ").indexOf(" " + v + " ") < 0));
        });
      });
    });
  });

  /* Mobilní lišta ordinace: ukáže se, až úvodní tlačítka zmizí z obrazovky */
  var lista = document.querySelector("[data-mm-lista]"), heroAkce = document.querySelector(".ordinace-hero_actions");
  if (lista && heroAkce && "IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { lista.classList.toggle("is-visible", !es[0].isIntersecting && es[0].boundingClientRect.top < 0); }).observe(heroAkce);
  }

  /* Mapa a Navigovat z data-adresa, data-lat a data-lng na kořeni mapy (Webflow neumí složit URL z polí).
     Google mapa se ukáže hned (21. 10. 2026, dřív OpenStreetMap až po klepnutí), iframe se načte líně až u sekce.
     Hledá se podle adresy: podle názvu Google všechny ordinace posadí na jediný záznam MiniMedica s.r.o. (Kubišova).
     Navigovat ve stejné sekci vede také k adrese, ať mapa a trasa mají jeden zdroj (ukázkové souřadnice v CMS mířily jinam);
     souřadnice jen jako záloha bez adresy. Bez obojího zůstane #kontakt a mapa se skryje. */
  function souradnice(v) { var n = parseFloat(String(v == null ? "" : v).replace(",", ".")); return isFinite(n) ? n : NaN; }
  document.querySelectorAll("[data-mm-mapa]").forEach(function (m) {
    var lat = souradnice(m.dataset.lat), lng = souradnice(m.dataset.lng), adresa = String(m.dataset.adresa || "").trim();
    var bod = !(isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (!lat && !lng));
    if (!bod && !adresa) { m.classList.add("hide"); return; }
    (m.closest("section") || document).querySelectorAll('[data-mm="navigovat"]').forEach(function (a) {
      a.href = "https://www.google.com/maps/dir/?api=1&destination=" + (adresa ? encodeURIComponent(adresa) : lat + "," + lng);
      a.target = "_blank"; a.rel = "noopener";
    });
    var f = m.querySelector("iframe.kontakt_map-frame");
    if (!f) {
      f = document.createElement("iframe");
      f.className = "kontakt_map-frame";
      f.title = adresa ? "Mapa: " + adresa : "Mapa";
      f.setAttribute("loading", "lazy");
      f.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
      m.appendChild(f);
    }
    if (!f.getAttribute("src")) f.src = "https://maps.google.com/maps?q=" + encodeURIComponent(adresa || lat + "," + lng) + "&z=16&hl=cs&output=embed";
    m.classList.add("is-active");
  });

  /* Prázdný stav filtru */
  function obnovPrazdne() {
    document.querySelectorAll("[data-filter-empty]").forEach(function (e) {
      var list = document.querySelector(e.dataset.filterEmpty);
      e.classList.toggle("hide", !!list.querySelector("[data-filter-item]:not(.hide)"));
    });
  }
  document.querySelectorAll("[data-mm-filter] [data-filter-value]").forEach(function (b) { b.addEventListener("click", function () { setTimeout(obnovPrazdne, 0); }); });

  /* Odkaz v roli tlačítka (Webflow nevzal <button>, např. „Uložit kontakt“): mezerník ho stiskne, místo aby posunul stránku */
  document.addEventListener("keydown", function (e) {
    var a = e.target.closest && e.target.closest('a[role="button"]');
    if (a && (e.key === " " || e.key === "Spacebar")) { e.preventDefault(); a.click(); }
  });

  /* Předvyplnění formuláře: „Mám zájem“ u pozice, „To jsem já“ u úrovně L1–L3 */
  document.querySelectorAll("[data-mm-predvyplnit]").forEach(function (a) {
    a.addEventListener("click", function () {
      var form = document.querySelector(a.getAttribute("href") + " form");
      if (!form) return;
      var faze = a.dataset.faze, pozice = a.dataset.pozice;
      if (faze && form.elements.faze) form.elements.faze.value = faze;
      /* lékařská pozice fázi nenese: nenechat ve výběru sestru z předchozího kliku */
      else if (pozice && form.elements.faze && /sestra/i.test(form.elements.faze.value)) form.elements.faze.selectedIndex = 0;
      if (form.elements.pozice) form.elements.pozice.value = pozice || "";
      var k = form.querySelector("[data-mm-kontext]");
      if (k) { k.textContent = pozice ? "Máte zájem o pozici: " + pozice : (faze ? "Vaše fáze: " + faze : ""); k.classList.toggle("hide", !(pozice || faze)); }
      setTimeout(function () { var f = form.querySelector("input:not([type=hidden])"); if (f) f.focus({ preventScroll: true }); }, 500);
    });
  });

  /* Balíček fotek (HP, Z našich ordinací; vzor 21st.dev „Stacked Card Carousel“). Bez JS vodorovný řádek fotek.
     ui.js přidá is-stack a skládá karty přes --i (0 = nahoře, hlouběji než HLOUBKA neviditelné). Horní karta odletí
     tažením (do strany tahu), šipkou nebo klávesou a zařadí se dospod. Popisek = alt horní fotky (ve Webflow alt z Galerie).
     Čtečka vidí jen horní fotku (jako snímek karuselu), změnu ohlásí popisek (aria-live). */
  document.querySelectorAll("[data-mm-stack]").forEach(function (st) {
    var karty = Array.prototype.slice.call(st.querySelectorAll(".photo-stack_item")), n = karty.length;
    if (n < 2) return;
    var seznam = st.querySelector(".photo-stack_list"), popis = st.querySelector("[data-mm-stack-popis]"), pocet = st.querySelector("[data-mm-stack-pocet]");
    var HLOUBKA = 3, akt = 0, jede = false, tah = null;
    function poloha(k) { return (karty.indexOf(k) - akt + n) % n; }
    function usad(k) {
      var i = poloha(k);
      k.style.setProperty("--i", Math.min(i, HLOUBKA));
      k.classList.toggle("is-nahore", i === 0);
      k.classList.toggle("is-skryta", i > HLOUBKA);
      if (i === 0) k.removeAttribute("aria-hidden"); else k.setAttribute("aria-hidden", "true");
    }
    function popisek() {
      var img = karty[akt].querySelector("img");
      if (popis) popis.textContent = img ? img.alt : "";
      if (pocet) pocet.textContent = (akt + 1) + " / " + n;
    }
    function rozloz() { karty.forEach(usad); popisek(); }
    function dalsi(smer) {
      if (jede) return;
      var k = karty[akt];
      akt = (akt + 1) % n;
      if (klid) { rozloz(); return; }
      jede = true;
      k.style.setProperty("--odlet", smer > 0 ? "115%" : "-115%");
      k.style.setProperty("--odlet-uhel", smer > 0 ? "9deg" : "-9deg");
      k.classList.remove("is-tazena");
      k.style.transform = "";
      k.classList.add("is-pryc");
      k.setAttribute("aria-hidden", "true");
      karty.forEach(function (x) { if (x !== k) usad(x); });
      popisek();
      setTimeout(function () {
        /* dospod bez přechodu a neviditelně, pak se (je-li v hloubce) jen rozsvítí */
        k.classList.add("bez-prechodu", "is-skryta");
        k.classList.remove("is-pryc", "is-nahore");
        k.style.setProperty("--i", Math.min(poloha(k), HLOUBKA));
        void k.offsetWidth;
        k.classList.remove("bez-prechodu");
        usad(k);
        jede = false;
      }, 430);
    }
    function predchozi() {
      if (jede) return;
      var k = karty[(akt - 1 + n) % n];
      akt = (akt - 1 + n) % n;
      if (klid) { rozloz(); return; }
      jede = true;
      /* přiletí zleva na vrch, ostatní se posunou o patro níž */
      k.style.setProperty("--odlet", "-115%");
      k.style.setProperty("--odlet-uhel", "-9deg");
      k.classList.add("bez-prechodu", "is-pryc");
      k.classList.remove("is-skryta");
      void k.offsetWidth;
      k.classList.remove("bez-prechodu");
      requestAnimationFrame(function () { k.classList.remove("is-pryc"); rozloz(); });
      setTimeout(function () { jede = false; }, 450);
    }
    st.classList.add("is-stack");
    rozloz();
    var zpet = st.querySelector("[data-mm-stack-zpet]"), dal = st.querySelector("[data-mm-stack-dal]");
    if (zpet) zpet.addEventListener("click", predchozi);
    if (dal) dal.addEventListener("click", function () { dalsi(-1); });
    st.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); dalsi(-1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); predchozi(); }
    });
    /* tažení horní karty: svisle se stránka dál posouvá (touch-action: pan-y), vodorovně karta jede za prstem */
    seznam.addEventListener("pointerdown", function (e) {
      var k = karty[akt];
      if (jede || !k.contains(e.target) || (e.pointerType === "mouse" && e.button !== 0)) return;
      tah = { x: e.clientX, dx: 0, k: k };
      k.classList.add("is-tazena");
      if (k.setPointerCapture) k.setPointerCapture(e.pointerId);
    });
    seznam.addEventListener("pointermove", function (e) {
      if (!tah) return;
      tah.dx = e.clientX - tah.x;
      tah.k.style.transform = "translate3d(" + tah.dx + "px," + Math.abs(tah.dx) * 0.04 + "px,0) rotate(" + tah.dx / 18 + "deg)";
    });
    function pustit() {
      if (!tah) return;
      var t = tah; tah = null;
      if (Math.abs(t.dx) > 70) { dalsi(t.dx > 0 ? 1 : -1); return; }
      t.k.classList.remove("is-tazena");
      t.k.style.transform = "";
    }
    seznam.addEventListener("pointerup", pustit);
    seznam.addEventListener("pointercancel", pustit);
  });
})();
