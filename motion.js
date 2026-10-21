/* MiniMedica · pohyb (GSAP 3.13 + ScrollTrigger + Lenis 1.2). Ve Webflow: GSAP nativně, Lenis a tento kód jako Custom code.
   Zásady (taste: MOTION 3–4, Emil Kowalski): žádný kolotoč, ale ani statika.
   - Lenis: plynulý scroll, napojený na GSAP ticker, kotvy s odsazením pod navigaci.
   - Jeden systém odhalování pro celý web, jednou a jen při prvním příchodu:
     hlavičky sekcí přijedou odspodu, skupiny (dlaždice, karty, seznamy) nastoupí postupně a ikony v nich se jemně usadí,
     panely přijedou celé, čísla se dopočítají, velké fotky se otevřou jako okno.
   - Karta ordinace přijede celá i se stavem a vnitřek se rozvine v jednom pohybu (žádné dodatečné „vyrolování“ štítku).
   - Momenty stránek zůstávají: osa příběhu (O nás), kroky (Předání), rozhovor (Pro lékaře).
   - Zástup a pohotovost se nehýbou nikdy. Obsah je vidět bez JS (animuje se jen „from“).
   prefers-reduced-motion: bez Lenisu a bez posunů, jen krátké prolnutí karet. */
(function () {
  "use strict";
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  function ukazUvod() { document.documentElement.classList.remove("mm-intro"); }
  var EASE = "power3.out", START = "top 88%";
  function vse(s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); }
  var hotovo = new WeakSet();
  /* bez boxu (prázdná skupina Rádce s display: none) ne: ScrollTrigger s once by se hned smazal a refresh na něm spadl */
  function volne(els) { return els.filter(function (el) { return el && !hotovo.has(el) && el.getClientRects().length > 0 && !el.closest(".hide, .navbar_component, .action-bar_component"); }); }
  function oznac(els) { els.forEach(function (el) { hotovo.add(el); }); }
  /* blok, uvnitř kterého už něco animujeme, se znovu neanimuje (jinak by se dvě „from“ animace přetahovaly) */
  function maOznacene(el) { var d = el.getElementsByTagName("*"); for (var i = 0; i < d.length; i++) if (hotovo.has(d[i])) return true; return false; }
  /* Řádky nadpisu přesně podle hotového zalomení. SplitText 3.13 bere nezlomitelnou mezeru jako obyčejnou a mezi slovy
     ze dvou sousedních prvků (konec „a&nbsp;“ a span zvýraznění, tečka za spanem) nechá zlom, který hotový text nemá:
     během animace se láme jinak a po vrácení slovo poskočí. Proto se zlomy změří na hotovém textu (Range po znacích)
     a řádky se vyříznou i s vnořenými spany (extractContents). Vrací řádky a funkci, která vrátí původní HTML. */
  function radkyNadpisu(el) {
    var html = el.innerHTML, zlomy = [], horni = null, uzel, i, rc;
    var r = document.createRange(), tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while ((uzel = tw.nextNode())) {
      for (i = 0; i < uzel.data.length; i++) {
        if (/\s/.test(uzel.data.charAt(i))) continue;
        r.setStart(uzel, i); r.setEnd(uzel, i + 1);
        rc = r.getClientRects()[0];
        if (!rc) continue;
        if (horni !== null && rc.top > horni + rc.height / 2) zlomy.push([uzel, i]);
        horni = rc.top;
      }
    }
    var casti = [];
    for (i = zlomy.length - 1; i >= 0; i--) {
      r.setStart(zlomy[i][0], zlomy[i][1]); r.setEnd(el, el.childNodes.length);
      casti.unshift(r.extractContents());
    }
    r.setStart(el, 0); r.setEnd(el, el.childNodes.length);
    casti.unshift(r.extractContents());
    var radky = casti.map(function (cast) {
      var maska = document.createElement("div"), radek = document.createElement("div");
      maska.className = "mm-line-mask"; maska.style.cssText = "display:block;overflow:clip";
      radek.className = "mm-line"; radek.style.display = "block";
      radek.appendChild(cast); maska.appendChild(radek); el.appendChild(maska);
      return radek;
    });
    return { lines: radky, revert: function () { el.innerHTML = html; } };
  }
  /* Nadpis: řádky vyjedou zpoza masky, pudrové zvýraznění se „dotáhne“ zleva. Po dojetí se vrátí původní HTML. */
  function revealNadpisu(el, vars) {
    vars = vars || {};
    var sp = radkyNadpisu(el);
    var t = gsap.timeline(Object.assign({ onComplete: function () { sp.revert(); } }, vars));
    t.from(sp.lines, { yPercent: 115, duration: 1, ease: "expo.out", stagger: 0.09 });
    var hl = el.querySelectorAll(".text-style-highlight");
    if (hl.length) t.fromTo(hl, { "--hl": "0%" }, { "--hl": "100%", duration: 0.8, ease: "power3.inOut", stagger: 0.1 }, 0.45);
    return t;
  }
  /* Tlačítko a čip mají CSS přechod na transform: „from“ by si jako cíl uložil mezihodnotu přechodu a prvek by zůstal
     posunutý. Během nástupu přechod vypnout, po dojetí transform i přechod uklidit (hover pak funguje dál). */
  function bezPrechodu(els, vars) {
    var p = [].concat(els).filter(function (el) {
      var cs = el && getComputedStyle(el);
      return cs && /transform|all/.test(cs.transitionProperty) && parseFloat(cs.transitionDuration) > 0;
    });
    if (!p.length) return vars;
    p.forEach(function (el) { el.style.transition = "none"; });
    var hotovo = vars.onComplete;
    vars.onComplete = function () { gsap.set(p, { clearProps: "transform,transition" }); if (hotovo) hotovo.apply(this, arguments); };
    return vars;
  }
  function klidnyRezim() { return window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches; }

  /* ---------- Lenis: plynulý scroll ---------- */
  var lenis = null;
  if (window.Lenis && !klidnyRezim()) {
    lenis = new Lenis({ lerp: 0.11, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    window.mmLenis = lenis;
  }
  /* Kotvy na stejné stránce: plynule (Lenis) nebo hned (omezený pohyb, scroll-margin-top 6rem), vždy pod sticky navigaci.
     webflow.js má vlastní posun (click.wf-scroll), který sticky navigaci nezná a s Lenisem se pere: vypnout.
     Fokus pak dostane cíl (skip link, čtečky), dřív to dělal webflow.js. */
  function bezWebflowPosunu() { if (window.jQuery) window.jQuery(document).off("click.wf-scroll"); }
  if (window.Webflow && window.Webflow.push) window.Webflow.push(bezWebflowPosunu); else bezWebflowPosunu();
  function fokusNa(cil) {
    /* předvyplnění formuláře už dalo fokus prvnímu poli uvnitř cíle: nebrat mu ho */
    if (cil.contains(document.activeElement) && document.activeElement !== document.body) return;
    if (!cil.matches("a[href], button, input, select, textarea, [tabindex]")) cil.setAttribute("tabindex", "-1");
    cil.focus({ preventScroll: true });
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href*="#"]');
    /* klik už obsloužil někdo jiný (přepínač dropdownu s href /#ordinace, FAQ): nescrollovat */
    if (!a || a.target === "_blank" || e.defaultPrevented) return;
    var url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || !url.hash || url.hash === "#") return;
    var cil = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!cil) return;
    e.preventDefault();
    history.pushState(null, "", url.hash);
    if (!lenis) { cil.scrollIntoView({ block: "start" }); fokusNa(cil); return; }
    /* během jízdy se obsah nad cílem může posunout (odhalování nadpisů), po dojetí cíl dorovnáme */
    lenis.scrollTo(cil, { offset: -96, duration: 1.1, onComplete: function () {
      if (Math.abs(cil.getBoundingClientRect().top - 96) > 2) lenis.scrollTo(cil, { offset: -96, duration: 0.35, onComplete: function () { fokusNa(cil); } });
      else fokusNa(cil);
    } });
  });

  function init() {
    var mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", function () {

      /* Úvod stránky: nadpis po řádcích, pak perex, tlačítka a stav; fotka se otevře, čipy se usadí, při scrollu fotka zůstává pozadu */
      var tl = gsap.timeline({ defaults: { ease: EASE } });
      var h1 = document.querySelector("main h1");
      if (h1) {
        var box = h1.closest(".hero-split_component > div, .home-hero_content") || h1.parentElement;
        var okolo = volne(vse(":scope > *", box)).filter(function (el) { return el !== h1 && !el.contains(h1) && el.getBoundingClientRect().top < innerHeight && !el.matches("img, figure, .cms-richtext, .stats_component"); });
        tl.add(revealNadpisu(h1), 0.05);
        if (okolo.length) tl.from(okolo, bezPrechodu(okolo, { y: 16, autoAlpha: 0, duration: 0.8, stagger: 0.07 }), 0.35);
        oznac([h1]); oznac(okolo);
        oznac(vse(".hero-split_component > div:first-child *, .home-hero_content *"));
      }
      var img = document.querySelector(".home-hero_image, .hero-split_image");
      if (img) {
        tl.from(img, { clipPath: "inset(18% 0% 0% 0% round 20px)", scale: 1.05, duration: 1.3, ease: "expo.out" }, 0);
        var fig = img.closest("figure");
        if (fig) gsap.to(fig, { y: 48, ease: "none", scrollTrigger: { trigger: fig, start: "top top+=80", end: "bottom top", scrub: true } });
        oznac([img]);
      }
      var chips = vse(".home-hero_figure .hero-chip_component, .hero-split_figure .hero-chip_component");
      if (chips.length) { tl.from(chips, bezPrechodu(chips, { y: 14, scale: 0.96, autoAlpha: 0, duration: 0.6, stagger: 0.14 }), 0.7); oznac(chips); }
      ukazUvod();

      /* Nadpisy sekcí: řádky vyjedou zpoza masky, jakmile k nim čtenář dojede */
      volne(vse("main h2")).forEach(function (h) {
        revealNadpisu(h, { scrollTrigger: { trigger: h, start: "top 88%", once: true } });
        oznac([h]);
      });

      /* HP a přehled: karta ordinace přijede celá i se stavem, vnitřek se rozvine spolu s ní */
      vse(".ordinace-card_list").forEach(function (list) {
        var cards = vse(".ordinace-card_component", list);
        if (!cards.length) return;
        var ct = gsap.timeline({ scrollTrigger: { trigger: list, start: "top 85%", once: true }, defaults: { ease: EASE } });
        cards.forEach(function (c, i) {
          ct.from(c, { y: 36, autoAlpha: 0, duration: 0.8 }, i * 0.1);
          ct.from(vse(":scope > *", c), { y: 10, autoAlpha: 0, duration: 0.55, stagger: 0.045 }, i * 0.1 + 0.12);
        });
        oznac(cards);
      });

      /* O nás: osa příběhu se vyplňuje podle čtení */
      vse("[data-mm-rail]").forEach(function (rail) {
        var fill = rail.querySelector(".story-rail_fill");
        if (fill) gsap.fromTo(fill, { scaleY: 0 }, { scaleY: 1, ease: "none", scrollTrigger: { trigger: rail, start: "top 65%", end: "bottom 65%", scrub: 0.6 } });
        vse(".story-rail_item", rail).forEach(function (it) {
          var t = volne(vse(".story-rail_text, .story-rail_media", it));
          gsap.from(t, { y: 22, autoAlpha: 0, duration: 0.8, ease: EASE, stagger: 0.1, scrollTrigger: { trigger: it, start: "top 85%", once: true } });
          oznac(t);
        });
      });

      /* Předání: kroky se rozsvítí, jak k nim čtenář dojde */
      vse("[data-mm-steps] .timeline_marker").forEach(function (m) {
        gsap.fromTo(m, { backgroundColor: "#ffffff", color: "#643244" }, { backgroundColor: "#643244", color: "#ffffff", duration: 0.4, ease: "power2.out", scrollTrigger: { trigger: m, start: "top 65%", toggleActions: "play none none reverse" } });
      });

      /* Pro lékaře: obava zazní, odpověď MiniMediky přijde chvilku po ní */
      vse(".voice_item").forEach(function (it) {
        var t = gsap.timeline({ scrollTrigger: { trigger: it, start: START, once: true }, defaults: { ease: EASE } });
        t.from(it, { y: 28, autoAlpha: 0, duration: 0.7 })
         .from(it.querySelector(".voice_mark"), { y: 10, autoAlpha: 0, duration: 0.5 }, 0.15)
         .from(it.querySelector(".voice_quote"), { y: 14, autoAlpha: 0, duration: 0.6 }, 0.2)
         .from(it.querySelector(".voice_reply"), { y: 10, autoAlpha: 0, duration: 0.5 }, 0.45);
        oznac([it]);
      });

      /* Velké fotky se otevřou jako okno */
      volne(vse(".home-pece_image, .home-novinky_lead-image, .care-panel_image, .duo-tile_image, .nurse-split_image, .origin_image, .statement_image, .page-hero_image, .galerie_image, .article_image")).forEach(function (el) {
        gsap.from(el, { clipPath: "inset(100% 0% 0% 0% round 20px)", duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: el, start: START, once: true } });
        /* jemný parallax: fotka se při scrollu posune o pár px proti textu vedle */
        if (el.matches(".nurse-split_image, .origin_image, .care-panel_image, .home-pece_image, .duo-tile_image")) gsap.fromTo(el, { y: 24 }, { y: -24, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
        oznac([el]);
      });

      /* Panely (zaoblené tónované plochy a pásy): přijedou celé */
      volne(vse(".care-panel_component, .duty_component, .origin_component, .ceiling-panel_component, .close-panel_component, .link-band_component, .provoz-panel_component, .price_component, .company-card_component, .stats_component.is-panel, .duo-tile_text, .prispevky_component, .partner_form, .band_component, .cta-lekari_component, .team_note, .info-box_component, .pohotovost_component, .zastup-planned_component")).forEach(function (el) {
        /* zástup a pohotovost se nehýbou nikdy */
        if (el.matches(".pohotovost_component, .zastup-planned_component")) { oznac([el]); return; }
        var t = gsap.timeline({ scrollTrigger: { trigger: el, start: START, once: true }, defaults: { ease: EASE } });
        t.from(el, { y: 32, autoAlpha: 0, duration: 0.9 });
        var vnitrek = volne(vse(":scope > *:not(.bg-layer)", el));
        if (vnitrek.length > 1) t.from(vnitrek, bezPrechodu(vnitrek, { y: 16, autoAlpha: 0, duration: 0.7, stagger: 0.08 }), 0.18);
        oznac([el]); oznac(vnitrek);
      });

      /* Hlavičky sekcí: nadpis, podnadpis a tlačítko přijedou postupně, jako jedna skupina */
      vse(".section-head_component, .band-split_head, .tile-grid_head, .provoz-head_component, .news-head_component, .duty_lead, .price-split_aside, .radce-split_aside, .ceiling-panel_top, .statement-number_component, .kontakt_content").forEach(function (h) {
        var deti = volne(vse(":scope > *", h));
        if (!deti.length) return;
        gsap.from(deti, bezPrechodu(deti, { y: 20, autoAlpha: 0, duration: 0.75, ease: EASE, stagger: 0.08, scrollTrigger: { trigger: h, start: START, once: true } }));
        oznac(deti);
      });

      /* Skupiny: položky nastoupí postupně, ikony se v nich jemně usadí.
         Collection List vnořený o úroveň níž (Webflow: Vybavení v .tile-grid_component, obal má display: contents)
         se nebere jako celek, ale po položkách; jinak by dlaždice naskočily naráz.
         Collection Item s display: contents (třída cms-contents) nemá vlastní box, posun ani průhlednost na něm nejsou vidět:
         animuje se jeho první dítě (dlaždice). */
      function sBoxem(el) {
        while (el && el.firstElementChild && (el.classList.contains("cms-contents") || (el.classList.contains("w-dyn-item") && getComputedStyle(el).display === "contents"))) el = el.firstElementChild;
        return el;
      }
      var SKUPINY =".tiles_component, .tile-grid_component, .level-card_list, .news-card_list, .equip_list, .founder-card_list, .team_list, .contact-card_list, .expand-gallery_component, .home-galerie_component, .pillars_component, .story-list_component, .story-list_side, .faq_list, .position_list, .partner_columns, .ceiling-panel_facts, .duty_list, .icon-list_component, .home-pece_list, .nurse-split_list, .qa-split_list, .provoz-planned_list, .provoz-row_list, .kontakt_list, .hodiny_component, .info-box_list, .info-box_richtext ul, .partner_list, .facts_component, .stats_component, .pojistovny_list, .price-split_component > .price_component, .timeline_component, .home-novinky_component";
      vse(SKUPINY).forEach(function (g) {
        var deti = volne(vse(":scope > :not(.w-dyn-list), :scope > .w-dyn-list > .w-dyn-items > *", g).map(sBoxem)).filter(function (el) { return !el.classList.contains("tile-grid_head") && !el.classList.contains("bg-layer"); }); /* aura (bg-layer) stojí, hýbe se jen obsah */
        if (!deti.length) return;
        var t = gsap.timeline({ scrollTrigger: { trigger: g, start: START, once: true }, defaults: { ease: EASE } });
        t.from(deti, bezPrechodu(deti, { y: 24, autoAlpha: 0, duration: 0.7, stagger: Math.min(0.08, 0.5 / deti.length) }));
        /* jen vykreslené ikony (u karty s fotkou je ikona skrytá přes display: none) */
        var ikony = volne(vse(".tiles_icon, .equip_icon, .duty_icon, .pillars_icon, .icon-list_icon, .nurse-split_icon, .partner_check, .team_note-icon", g)).filter(function (el) { return el.getClientRects().length > 0; });
        oznac(ikony);
        if (ikony.length) t.from(ikony, { scale: 0.7, autoAlpha: 0, duration: 0.5, ease: "back.out(1.6)", stagger: Math.min(0.06, 0.4 / ikony.length) }, 0.18);
        oznac(deti);
      });

      /* Pojistka: každý zbylý nadpis sekce a každý blok sekce, který zatím nic neanimuje, přijede odspodu */
      volne(vse("main h3")).filter(function (h) { return h.closest("[class*='section-head'], .band-split_head"); }).forEach(function (h) {
        revealNadpisu(h, { scrollTrigger: { trigger: h, start: START, once: true } });
        oznac([h]);
      });
      volne(vse("main .padding-section-small > *, main .padding-section-medium > *, main .padding-section-large > *, main .padding-section-small > * > *, main .padding-section-medium > * > *")).forEach(function (b) {
        if (maOznacene(b) || hotovo.has(b.parentElement) || b.matches(".bg-layer, .zastup-bar_component, .zastup-panel_component, .pohotovost_component, .action-bar_component, [data-mm-zobrazit]")) return;
        gsap.from(b, bezPrechodu(b, { y: 24, autoAlpha: 0, duration: 0.8, ease: EASE, scrollTrigger: { trigger: b, start: START, once: true } }));
        oznac([b]);
      });

      /* Čísla se dopočítají (jen celá čísla, „1 200“ i „30“; „3 ze 3“ a „0–19“ zůstanou) */
      vse(".facts_number, .ceiling-panel_number, .ceiling-panel_value, .stats_number, .statement-number_value").forEach(function (el) {
        var puvodni = el.textContent.trim(), cislo = puvodni.replace(/[\s ]/g, "");
        if (!/^\d+$/.test(cislo) || +cislo < 5) return;
        var o = { v: 0 }, cil = +cislo;
        gsap.to(o, { v: cil, duration: 1.4, ease: "power2.out", scrollTrigger: { trigger: el, start: START, once: true },
          onUpdate: function () { el.textContent = Math.round(o.v).toLocaleString("cs-CZ"); },
          onComplete: function () { el.textContent = puvodni; } });
      });
    });

    /* Pojistka u patičky: dokončit, co se nestihlo */
    ScrollTrigger.create({ trigger: document.documentElement, start: "bottom bottom+=4", onEnter: function () {
      ScrollTrigger.getAll().forEach(function (st) { if (st.animation && st.vars && !st.vars.scrub && st.animation.progress() < 1) st.animation.progress(1); });
    } });

    mm.add("(prefers-reduced-motion: reduce)", function () {
      ukazUvod();
      var cards = vse(".ordinace-card_list .ordinace-card_component");
      /* fromTo s pevným cílem: „from“ si tu jako cíl zapamatoval už skrytý stav a karty zůstaly neviditelné */
      if (cards.length) gsap.fromTo(cards, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, stagger: 0.05, scrollTrigger: { trigger: cards[0].parentNode, start: "top 90%", once: true } });
    });
  }
  /* Příchod s kotvou z jiné stránky (/#ordinace): ScrollTrigger.refresh přeruší nativní posun prohlížeče, takže na cíl dojedeme sami */
  function kotvaZAdresy() {
    if (!location.hash || location.hash === "#") return;
    var cil = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (!cil) return;
    function skoc() { if (lenis) lenis.scrollTo(cil, { offset: -96, immediate: true, force: true }); else cil.scrollIntoView(); }
    skoc();
    /* pojistka: když se rozložení nad cílem ještě usazovalo, po načtení jednou dorovnat (jen pokud čtenář mezitím nescrolloval jinam) */
    function dorovnej() { var d = Math.abs(cil.getBoundingClientRect().top - 96); if (d > 2 && d < 400) skoc(); }
    if (document.readyState === "complete") setTimeout(dorovnej, 350);
    else window.addEventListener("load", function () { setTimeout(dorovnej, 350); }, { once: true });
  }
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () {
    /* chyba v jedné animaci nesmí zastavit zbytek (refresh, příchod s kotvou) */
    try { init(); } catch (e) { if (window.console) console.error(e); }
    try { ScrollTrigger.refresh(); } catch (e) { if (window.console) console.error(e); }
    kotvaZAdresy();
  });
})();
