/* MiniMedica · stavový a zástupový engine
   Webflow: Site settings > Custom code > Footer (nebo hostovaný soubor). Bez závislostí.
   Čte data z markupu, který vyrenderoval Webflow (Collection Listy s Custom attributes),
   a jen ho dekoruje: přepne třídy, doplní stavový text, odkryje skryté prvky, přehodí pořadí tlačítek.
   Nic nekreslí. Bez JS zůstane na stránce adresa, telefon, hodiny i zástupy v plném znění.

   Webflow nechává v DOM i skryté varianty (podmínky přes CSS, skrytý Empty State s w-dyn-hide):
   texty a odkazy se nastavují všem prvkům, pořadí tlačítek se řídí jen tím viditelným.

   Testování: ?ted=2026-12-24T10:00 přepne „teď“ (pražský čas).
   Kontrakt atributů: web/README.md, sekce Engine. */
(function () {
  "use strict";

  /* ---------- Čas v Praze, ne v prohlížeči ---------- */
  function pad(n) { return String(n).padStart(2, "0"); }
  function toMin(s) { return (+s.slice(0, 2)) * 60 + (+s.slice(3, 5)); }
  function plusDny(iso, n) { var d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function isoDow(iso) { var d = new Date(iso + "T12:00:00Z").getUTCDay(); return d === 0 ? 7 : d; }

  var test = new URLSearchParams(location.search).get("ted");
  var ted = (test && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(test))
    ? test.replace("T", " ")
    : new Date().toLocaleString("sv-SE", { timeZone: "Europe/Prague" }).slice(0, 16);
  var DNES = ted.slice(0, 10), MIN = toMin(ted.slice(11, 16)), DOW = isoDow(DNES);

  /* Webflow vypisuje datum podle zvoleného formátu. Bereme ISO, „15. 10. 2026“, „15.10.2026“,
     český „15. října 2026“ (i 1. pád „15. říjen 2026“, i bez tečky) a výchozí anglický „October 15, 2026“. Nečitelné vrátí "". */
  var MES_CISLO = { ledna: 1, leden: 1, unora: 2, unor: 2, brezna: 3, brezen: 3, dubna: 4, duben: 4, kvetna: 5, kveten: 5,
    cervna: 6, cerven: 6, cervence: 7, cervenec: 7, srpna: 8, srpen: 8, zari: 9, rijna: 10, rijen: 10, listopadu: 11, listopad: 11, prosince: 12, prosinec: 12 };
  function datum(s) {
    s = String(s || "").trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    var m = s.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
    if (m) return m[3] + "-" + pad(m[2]) + "-" + pad(m[1]);
    var c = s.match(/^(\d{1,2})\.?\s+([^\s\d.,]+)\s+(\d{4})$/);
    var mes = c && MES_CISLO[c[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")];
    if (mes) return c[3] + "-" + pad(mes) + "-" + pad(c[1]);
    /* new Date jen s rokem a anglickým měsícem nebo lomítkem: samotné „5“ by přečetl jako 1. 5. 2001 */
    if (!/\d{4}/.test(s) || !/[a-z\/]/i.test(s)) return "";
    var d = new Date(s);
    return isNaN(d) ? "" : d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  /* Čas: snese i „7:00“ nebo „7.00“, kdyby se v CMS objevil. */
  function cas(s) { var m = String(s || "").match(/(\d{1,2})[:.](\d{2})/); return m ? pad(m[1]) + ":" + m[2] : ""; }
  function bezNuly(c) { return c.replace(/^0/, ""); }

  /* ---------- Státní svátky + Velikonoce ---------- */
  var PEVNE = ["01-01", "05-01", "05-08", "07-05", "07-06", "09-28", "10-28", "11-17", "12-24", "12-25", "12-26"];
  function velikonocniNedele(y) { /* anonymní gregoriánský algoritmus */
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4,
      f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
      i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    return y + "-" + pad(Math.floor((h + l - 7 * m + 114) / 31)) + "-" + pad(((h + l - 7 * m + 114) % 31) + 1);
  }
  function jeSvatek(iso) {
    if (PEVNE.indexOf(iso.slice(5)) > -1) return true;
    var ne = velikonocniNedele(+iso.slice(0, 4));
    return iso === plusDny(ne, -2) || iso === plusDny(ne, 1); /* Velký pátek, Velikonoční pondělí */
  }

  /* ---------- Čeština ---------- */
  var DNY_V = ["v neděli", "v pondělí", "v úterý", "ve středu", "ve čtvrtek", "v pátek", "v sobotu"];
  var DNY = ["neděle", "pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota"];
  var MES = ["ledna", "února", "března", "dubna", "května", "června", "července", "srpna", "září", "října", "listopadu", "prosince"];
  function vCas(c) { var h = +c.slice(0, 2); return ([2, 3, 4, 12, 13, 14, 20, 22, 23].indexOf(h) > -1 ? "ve " : "v ") + bezNuly(c); }
  function kratce(iso) { return (+iso.slice(8, 10)) + ". " + (+iso.slice(5, 7)) + "."; }
  function dlouze(iso) { return (+iso.slice(8, 10)) + ". " + MES[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4); }
  function kdy(iso) {
    var i = Math.round((new Date(iso + "T12:00:00Z") - new Date(DNES + "T12:00:00Z")) / 864e5);
    if (i === 0) return "dnes";
    if (i === 1) return "zítra";
    var d = new Date(iso + "T12:00:00Z").getUTCDay();
    return i < 7 ? DNY_V[d] : DNY_V[d] + " " + kratce(iso);
  }

  /* ---------- Telefon ----------
     Pole typu Phone vypisují číslo tak, jak je v CMS („568 842 358“, „+420 568 842 358“), Link › Phone stejně do href.
     Odkaz je vždy „tel:+420“ + číslice, předvolba se nepřidá dvakrát. */
  function cisloTel(s) { return String(s || "").trim().replace(/^tel:/i, "").replace(/[\s().\/-]/g, "").replace(/^(\+|00)420/, ""); }
  function telOdkaz(s) {
    var c = cisloTel(s);
    if (!/\d/.test(c)) return "";
    return c.charAt(0) === "+" ? "tel:" + c : c.slice(0, 2) === "00" ? "tel:+" + c.slice(2) : "tel:+420" + c;
  }
  /* text čísla: devět číslic po trojicích („568 842 358“), cokoli jiného tak, jak je */
  function telText(s) { var c = cisloTel(s); return /^\d{9}$/.test(c) ? c.replace(/(\d{3})(?=\d)/g, "$1 ") : String(s || "").trim(); }

  /* ---------- Data z markupu ---------- */
  function vse(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  /* Značky podmínek čte jen CSS (:has). Prvek, který nějakou obsahuje, engine nepřepisuje. */
  var ZNACKY = "[data-mm-pole], [data-mm-podminky], [data-mm-kdyz-plne], [data-mm-kdyz-prazdne]";
  function maZnacky(el) { return !!el.querySelector(ZNACKY); }
  function napis(el, t) { if (!maZnacky(el)) el.textContent = t; }
  var TYP = { "zástup": "zastup", "zastup": "zastup", "zavřeno bez zástupu": "zavreno", "zavreno": "zavreno", "omezený provoz": "omezeny", "omezeny": "omezeny" };

  var PASMA = vse("[data-mm-pasmo]").map(function (el) {
    return { ord: el.dataset.ordinace, den: +el.dataset.den, od: cas(el.dataset.od), "do": cas(el.dataset["do"]),
      platiOd: datum(el.dataset.platiOd), platiDo: datum(el.dataset.platiDo) };
  }).filter(function (p) { return p.ord && p.den && p.od && p["do"]; });

  /* Adresa a telefon zástupu: přednost má Zastupující ordinace (data-zo-*), jinak vlastní pole zástupu (data-adresa, data-tel).
     Ve Webflow tak stačí navázat obě sady atributů a nepotřebuje se podmíněná viditelnost. */
  var ZASTUPY = vse("[data-mm-zastup]").map(function (el) {
    var d = el.dataset;
    return { el: el, ord: d.ordinace, typ: TYP[String(d.typ || "").toLowerCase()] || "zastup",
      od: datum(d.od), "do": datum(d["do"]), kdo: d.kdo || "",
      adresa: d.zoAdresa ? [d.zoNazev, d.zoAdresa].filter(Boolean).join(", ") : (d.adresa || ""),
      tel: d.zoTel || d.tel || "", hodiny: d.hodiny || "", vzkaz: d.vzkaz || "" };
  }).filter(function (z) { return z.ord && z.od && z["do"]; });

  /* ---------- Výpočet ---------- */
  function pasmaDne(ord, iso) {
    if (jeSvatek(iso)) return [];
    var dow = isoDow(iso);
    return PASMA.filter(function (p) {
      return p.ord === ord && p.den === dow && (!p.platiOd || p.platiOd <= iso) && (!p.platiDo || iso <= p.platiDo);
    }).sort(function (a, b) { return toMin(a.od) - toMin(b.od); });
  }
  function zastupNaDen(ord, iso) {
    return ZASTUPY.filter(function (z) { return z.ord === ord && z.od <= iso && iso <= z["do"]; })[0];
  }
  /* Omezený provoz s hodinami („09:00–12:00“) nahradí běžná pásma a přebije i svátek (sváteční provoz).
     Bez hodin platí běžná pásma, ve svátek tedy zavřeno. */
  function hodinyZastupu(z) {
    var m = z && String(z.hodiny || "").match(/(\d{1,2}[:.]\d{2})\s*[–-]\s*(\d{1,2}[:.]\d{2})/);
    return m && cas(m[1]) < cas(m[2]) ? [{ od: cas(m[1]), "do": cas(m[2]) }] : null;
  }
  function blokyDne(ord, iso) {
    var z = zastupNaDen(ord, iso);
    return (z && z.typ === "omezeny" && hodinyZastupu(z)) || pasmaDne(ord, iso);
  }
  function dalsiOtevreni(ord) {
    for (var i = 0; i <= 31; i++) {
      var iso = plusDny(DNES, i), z = zastupNaDen(ord, iso);
      if (z && z.typ !== "omezeny") continue;
      var bl = blokyDne(ord, iso);
      if (i === 0) bl = bl.filter(function (b) { return toMin(b.od) > MIN; });
      if (bl.length) return { iso: iso, od: bl[0].od };
    }
    return null;
  }
  /* Obálka (první Od → poslední Do) řídí štítek, bloky řídí zobrazení. Oboje ze stejných dat. */
  function stav(ord) {
    var z = zastupNaDen(ord, DNES), bl = blokyDne(ord, DNES), r = { z: z, bloky: bl, dalsi: null };
    var uvnitr = bl.length && MIN >= toMin(bl[0].od) && MIN < toMin(bl[bl.length - 1]["do"]);
    r.dnes = bl.length ? bl[0].od + "–" + bl[bl.length - 1]["do"] : (jeSvatek(DNES) ? "Svátek, zavřeno" : "Zavřeno");
    if (z && z.typ === "zastup") {
      r.st = "zastup"; r.text = "Zástup do " + kratce(z["do"]);
      if (z.hodiny) r.dnes = z.hodiny; /* že jde o zástup, říká jantarový štítek a box, neopakujeme */
      return r;
    }
    if (z && z.typ === "zavreno") {
      r.st = "closed"; r.dalsi = dalsiOtevreni(ord);
      r.text = z["do"] === DNES ? "Dnes zavřeno" : "Zavřeno do " + kratce(z["do"]);
      r.dnes = "Zavřeno";
      return r;
    }
    if (uvnitr) {
      r.st = z ? "zastup" : "open";
      r.text = (z ? (jeSvatek(DNES) ? "Sváteční provoz do " : "Omezený provoz, do ") : "Otevřeno do ") + bezNuly(bl[bl.length - 1]["do"]);
      return r;
    }
    r.st = "closed"; r.dalsi = dalsiOtevreni(ord);
    var pred = jeSvatek(DNES) ? "Svátek" : "Zavřeno";
    r.text = r.dalsi ? pred + ", otevíráme " + kdy(r.dalsi.iso) + " " + vCas(r.dalsi.od) : pred;
    if (r.dalsi && r.dalsi.iso === DNES) r.text = "Otevíráme " + vCas(r.dalsi.od);
    /* krátká verze pro úzká místa (megamenu): „Zavřeno, zítra 7:00“ */
    r.kratce = r.dalsi ? (r.dalsi.iso === DNES ? "Otevíráme " + vCas(r.dalsi.od) : pred + ", " + kdy(r.dalsi.iso) + " " + bezNuly(r.dalsi.od)) : pred;
    return r;
  }

  /* ---------- Datum v textu (před ostatní dekorací) ----------
     Span s vazbou na Date pole nese data-mm-datum="kratce" („20. 10.“) nebo "dlouze" („20. října 2026“).
     Webflow ho vypíše ve svém formátu (výchozí „October 20, 2026“), engine ho přepíše česky.
     Prázdné pole (w-dyn-bind-empty) a nečitelný text zůstanou, jak jsou. */
  function isoZTextu(el) { return el.classList.contains("w-dyn-bind-empty") ? "" : datum(el.textContent); }
  var DATA_V_TEXTU = vse("[data-mm-datum]").map(function (el) { return { el: el, iso: isoZTextu(el) }; });
  /* Rozsah Od–Do: jednodenní uzavření bez „5. 11.–5. 11.“ (pomlčka a Do nesou data-mm-rozsah-do) */
  vse("[data-mm-rozsah]").forEach(function (r) {
    var d = vse("[data-mm-datum]", r).slice(0, 2).map(isoZTextu);
    if (d.length === 2 && d[0] && d[0] === d[1]) vse("[data-mm-rozsah-do]", r).forEach(function (el) { el.classList.add("hide"); });
  });
  DATA_V_TEXTU.forEach(function (x) {
    if (x.iso) napis(x.el, x.el.dataset.mmDatum === "kratce" ? kratce(x.iso) : dlouze(x.iso));
  });

  /* ---------- Dekorace ---------- */
  var STAVY = ["is-open", "is-zastup", "is-closed"];
  function nastavStav(el, st) { STAVY.forEach(function (c) { el.classList.remove(c); }); el.classList.add("is-" + st); }
  function text(root, kde, t) { vse('[data-mm="' + kde + '"]', root).forEach(function (el) { napis(el, t); }); }
  function ukaz(el, ano) { if (el) el.classList.toggle("hide", !ano); }
  /* Viditelný v kořeni: ani prvek, ani žádný předek až po kořen (ten se nepočítá, lišta je na počítači skrytá celá) nemá display: none.
     Podmínky jsou ve Webflow CSS, skrytý Empty State má w-dyn-hide. */
  function viditelny(el, root) {
    for (var p = el; p && p !== root; p = p.parentElement) {
      if (p.classList.contains("hide") || p.classList.contains("w-dyn-hide") || p.classList.contains("w-condition-invisible")) return false;
      if (getComputedStyle(p).display === "none") return false;
    }
    return true;
  }
  function prvniViditelny(sel, root) { return vse(sel, root).filter(function (el) { return viditelny(el, root); })[0] || null; }

  /* Ordinace bez jakýchkoli dat (žádné pásmo ani zástup, např. stránka 404 bez cms-data): kořen zůstane bez dekorace,
     platí neutrální text z markupu („Hodiny v detailu“). Jinak by engine tvrdil „Zavřeno“. */
  function maData(ord) {
    return PASMA.some(function (p) { return p.ord === ord; }) || ZASTUPY.some(function (z) { return z.ord === ord; });
  }

  var cache = {};
  vse("[data-mm-ordinace]").forEach(function (root) {
    if (!maData(root.dataset.mmOrdinace)) return;
    var ord = root.dataset.mmOrdinace, r = cache[ord] || (cache[ord] = stav(ord)), z = r.z;

    /* štítek: prvek s data-mm="badge" uvnitř, nebo kořen sám (čip na fotce) */
    var badges = vse('[data-mm="badge"]', root);
    if (root.dataset.mm === "badge") badges.push(root);
    badges.forEach(function (b) { nastavStav(b, r.st); });
    vse('[data-mm="badge-text"]', root).forEach(function (el) { napis(el, el.dataset.format === "kratce" && r.kratce ? r.kratce : r.text); });
    text(root, "dnes", r.dnes);

    /* upozornění na kartě */
    vse('[data-mm="alert"]', root).forEach(function (alert) {
      ukaz(alert, !!z);
      if (!z) return;
      text(alert, "alert-title", z.typ === "zastup" ? "Zastupuje " + z.kdo : (z.typ === "zavreno" ? "Zavřeno do " + kratce(z["do"]) : (jeSvatek(DNES) && hodinyZastupu(z) ? "Sváteční provoz" : "Omezený provoz")));
      var prvniVeta = z.vzkaz ? z.vzkaz.split(/(?<=\.)\s/)[0] : "";
      text(alert, "alert-text", [z.typ === "zastup" ? z.adresa.replace(/,\s*\d{3}\s?\d{2}\s+[^,]+$/, "") : "", prvniVeta].filter(Boolean).join(". ").replace(/\.\./g, "."));
    });

    /* telefon: během zástupu číslo zastupující ordinace, nikdy mrtvé číslo.
       Odkaz, text a aria-label dostanou VŠECHNA tlačítka v kořeni, i skryté varianty a Empty State. */
    var zTel = z && z.typ === "zastup" && telOdkaz(z.tel) ? z.tel : "";
    vse('[data-mm="call"]', root).forEach(function (call) {
      var f = call.dataset.format, vl = call.dataset.telVlastni, cislo;
      if (zTel) {
        cislo = telText(zTel);
        call.setAttribute("href", telOdkaz(zTel));
        text(call, "call-text", f === "cislo" ? cislo : f === "kratce" ? "Zavolat zástup" : "Zavolat zástup " + cislo);
        call.setAttribute("aria-label", "Zavolat zastupující ordinaci, " + cislo);
      } else if (vl && telOdkaz(vl)) {
        /* markup vyrenderovaný během zástupu, který mezitím skončil (nebo ?ted mimo zástup): zpět na vlastní číslo */
        cislo = telText(vl);
        call.setAttribute("href", telOdkaz(vl));
        text(call, "call-text", f === "cislo" ? cislo : f === "kratce" ? "Zavolat" : "Zavolat " + cislo);
        call.removeAttribute("aria-label");
      } else return;
      text(call, "call-cislo", cislo);
    });
    /* poznámka pod tlačítkem: všechny v kořeni (položka listu i Empty State). Poznámku se značkami podmínek
       (varianta s číslem zástupu) engine nepřepisuje, jen ji ukáže během zástupu. */
    vse('[data-mm="call-note"]', root).forEach(function (note) {
      var n = "";
      if (z && z.typ === "zastup") n = "Během zástupu volejte zastupující ordinaci.";
      else if (r.st === "closed" && r.dalsi) n = "Zavolat můžete " + kdy(r.dalsi.iso) + " od " + bezNuly(r.dalsi.od) + ".";
      if (maZnacky(note)) { ukaz(note, !!(z && z.typ === "zastup")); return; }
      note.textContent = n; ukaz(note, !!n);
    });
    /* pořadí: otevřeno = telefon první, zavřeno = online objednání první (funguje i v noci).
       Jen první viditelné tlačítko a objednání; bez viditelného objednání (Jen telefonicky) se nic nepřehazuje. */
    var call = prvniViditelny('[data-mm="call"]', root), order = prvniViditelny('[data-mm="order"]', root);
    if (call && order && call.parentNode === order.parentNode && order.dataset.online === "true") {
      var prvni = (r.st === "closed") ? order : call, druhy = prvni === order ? call : order;
      if (prvni.nextElementSibling !== druhy && prvni !== druhy) call.parentNode.insertBefore(prvni, druhy);
      prvni.classList.remove("is-line"); druhy.classList.add("is-line");
    }
  });

  /* ---------- Zástupy jako obsah: běžící / plánované / prošlé ----------
     Běží až po kořenech ordinací: poznámku pod telefonem mimo běh zástupu zase skryje. */
  vse("[data-mm-zobrazit]").forEach(function (el) {
    var z = ZASTUPY.filter(function (x) { return x.el === el; })[0] || { od: datum(el.dataset.od), "do": datum(el.dataset["do"]) };
    var dni = +(el.dataset.mmDni || 60), rezim = el.dataset.mmZobrazit, bezi = z.od <= DNES && DNES <= z["do"],
      planovany = DNES < z.od && z.od <= plusDny(DNES, dni);
    ukaz(el, rezim === "bezi" ? bezi : rezim === "planovany" ? planovany : (bezi || planovany));
  });
  /* prázdné stavy seznamů zástupů */
  vse("[data-mm-prazdne-pro]").forEach(function (empty) {
    var list = document.querySelector(empty.dataset.mmPrazdnePro);
    ukaz(empty, !list || !vse("[data-mm-zobrazit]:not(.hide)", list).length);
  });

  /* ---------- „Platí do“ (aktuality, pozice, oznámení) ---------- */
  vse("[data-mm-plati-do]").forEach(function (el) {
    var d = datum(el.dataset.mmPlatiDo);
    if (d && d < DNES) {
      if (el.dataset.mmPoExpiraci === "banner") ukaz(document.querySelector('[data-mm="expirovano"]'), true);
      else { el.setAttribute("data-mm-proslo", ""); ukaz(el, false); } /* značka pro filtr seznamu, ať prošlou položku neodkryje */
    }
  });

  /* ---------- Hodiny: zvýraznit dnešek ---------- */
  vse('[data-mm="hodiny"] [data-mm-den]').forEach(function (row) { row.classList.toggle("is-today", +row.dataset.mmDen === DOW); });
  /* Platnost pásem v tabulce (stejná podmínka jako pasmaDne, ať se stav a zobrazení nerozejdou).
     Položka mimo platnost se skryje celá (Collection Item); den bez platného pásma dostane is-zavreno („Zavřeno“ vypíše CSS).
     Svátky a zástupy tabulku nemění, to je záměr. */
  vse('[data-mm="hodiny"] [data-mm-den]').forEach(function (row) {
    var polozky = vse(".hodiny_item", row);
    polozky.forEach(function (it) {
      var od = datum(it.dataset.platiOd), dO = datum(it.dataset.platiDo), item = it.closest(".w-dyn-item");
      if (!item || !row.contains(item)) item = it;
      if ((od && od > DNES) || (dO && dO < DNES)) item.classList.add("hide");
    });
    if (polozky.length) row.classList.toggle("is-zavreno", !polozky.some(function (it) { return viditelny(it, row); }));
  });

  /* ---------- Co s sebou: Rich text nedovolí role na ul a list-style: none v Safari bere seznamu sémantiku ---------- */
  vse(".info-box_richtext ul").forEach(function (ul) { ul.setAttribute("role", "list"); });

  /* ---------- Ulice: prvek s celým polem Adresa („Kubišova 1291/7, 674 01 Třebíč“) zkrátí na text před první čárkou.
     Bez JS zůstane celá adresa. Prázdné pole (w-dyn-bind-empty) a adresu bez čárky nechá být. ---------- */
  vse("[data-mm-ulice]").forEach(function (el) {
    var t = el.textContent.trim(), i = t.indexOf(",");
    if (i > 0 && !el.classList.contains("w-dyn-bind-empty")) napis(el, t.slice(0, i).trim());
  });

  /* ---------- Dnešní datum ---------- */
  vse('[data-mm="dnes-datum"]').forEach(function (el) {
    var d = new Date(DNES + "T12:00:00Z");
    var t = el.dataset.format === "kratce" ? kratce(DNES)
      : el.dataset.format === "cislem" ? DNY[d.getUTCDay()] + " " + d.getUTCDate() + ". " + (d.getUTCMonth() + 1) + ". " + d.getUTCFullYear()
      : DNY[d.getUTCDay()] + " " + d.getUTCDate() + ". " + MES[d.getUTCMonth()];
    el.textContent = el.dataset.velke === "true" ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  });

  /* ---------- Vaše ordinace (jen v prohlížeči rodiče, žádná data u nás) ----------
     Slug stránky ordinace nese kořen hero (Webflow neumí atribut na body), záložně body. */
  try {
    var strankaEl = document.querySelector("[data-mm-stranka-ordinace]");
    var tato = strankaEl ? strankaEl.dataset.mmStrankaOrdinace : document.body.dataset.mmStrankaOrdinace;
    if (tato) localStorage.setItem("mm-ordinace", tato);
    var moje = localStorage.getItem("mm-ordinace");
    vse("[data-mm-razeni]").forEach(function (list) {
      var karta = moje && list.querySelector('[data-mm-ordinace="' + moje + '"]');
      if (!karta) return;
      var polozka = karta.closest("[data-mm-polozka]") || karta;
      if (polozka.parentNode === list || polozka.parentNode) polozka.parentNode.insertBefore(polozka, polozka.parentNode.firstElementChild);
      karta.classList.add("is-yours");
    });
  } catch (e) { /* localStorage zakázané: výchozí pořadí */ }

  /* ---------- Uložit kontakt (vCard) ----------
     data-nazev nese jen Název ordinace (atribut ve Webflow neumí text + pole), „MiniMedica“ doplní engine. */
  vse('[data-mm="vcard"]').forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      var d = btn.dataset, nazev = String(d.nazev || "").trim(), tel = telOdkaz(d.tel).slice(4);
      var fn = /^MiniMedica\b/i.test(nazev) ? nazev : ("MiniMedica " + nazev).trim();
      var v = ["BEGIN:VCARD", "VERSION:3.0", "FN:" + fn, "ORG:MiniMedica", tel ? "TEL;TYPE=WORK,VOICE:" + tel : "",
        d.email ? "EMAIL;TYPE=WORK:" + d.email : "", "ADR;TYPE=WORK:;;" + (d.adresa || "").replace(/,/g, "\\,") + ";;;;", "URL:" + location.href.split("?")[0], "END:VCARD"]
        .filter(Boolean).join("\r\n");
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([v], { type: "text/vcard;charset=utf-8" }));
      a.download = fn.replace(/[^\wÀ-ž-]+/g, "-") + ".vcf";
      document.body.appendChild(a); a.click(); a.remove();
    });
  });

  /* ---------- Odkazy tel: na celé stránce ----------
     Link › Phone zapíše do href číslo tak, jak je v CMS (s mezerami, případně s +420). Sjednotit na „tel:+420“ + číslice.
     Týká se i odkazů, které engine nepřepíná (pobočka, pruh a panel zástupu). Odkaz bez číslic zůstane. */
  vse('a[href^="tel:"]').forEach(function (a) {
    var h = telOdkaz(a.getAttribute("href"));
    if (h && h !== a.getAttribute("href")) a.setAttribute("href", h);
  });

  /* k ladění v konzoli (a pro testy) */
  window.MM = { ted: DNES + " " + ted.slice(11), stav: stav, jeSvatek: jeSvatek, velikonocniNedele: velikonocniNedele, datum: datum, telOdkaz: telOdkaz };
})();
