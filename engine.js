/* MiniMedica · stavový a zástupový engine
   Webflow: Site settings > Custom code > Footer (nebo hostovaný soubor). Bez závislostí.
   Čte data z markupu, který vyrenderoval Webflow (Collection Listy s Custom attributes),
   a jen ho dekoruje: přepne třídy, doplní stavový text, odkryje skryté prvky, přehodí pořadí tlačítek.
   Nic nekreslí. Bez JS zůstane na stránce adresa, telefon, hodiny i zástupy v plném znění.

   Webflow nechává v DOM i skryté varianty (podmínky přes CSS, skrytý Empty State s w-dyn-hide):
   texty a odkazy se nastavují všem prvkům, pořadí tlačítek se řídí jen tím viditelným.

   Testování: ?ted=2026-12-24T10:00 přepne „teď“ (pražský čas).
   Kontrakt atributů: web/README.md, sekce Engine.

   Jako modul (panel /sprava, testy v Node): soubor jde načíst i bez DOM (import "./engine.js").
   Bez `document` (nebo s globalThis.MMEngineBezDekorace) nic nedekoruje, jen vystaví jádro na globalThis.MMEngine: vytvor({ pasma, zastupy, ted })
   počítá stav ze záznamů ve tvaru data atributů skrytých listů a vrací i texty, které z něj ukáže karta.
   Web běží nad stejným jádrem s daty z DOM, takže panel a web se nerozejdou (sprava-panel.md, princip 3). */
(function (koren) {
  "use strict";

  /* ---------- Čas v Praze, ne v prohlížeči ---------- */
  function pad(n) { return String(n).padStart(2, "0"); }
  function toMin(s) { return (+s.slice(0, 2)) * 60 + (+s.slice(3, 5)); }
  function plusDny(iso, n) { var d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function isoDow(iso) { var d = new Date(iso + "T12:00:00Z").getUTCDay(); return d === 0 ? 7 : d; }
  /* „teď“ jako „YYYY-MM-DD HH:MM“: z přepínače ve tvaru 2026-12-24T10:00, jinak pražský čas */
  function tedZ(test) {
    return (test && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(test))
      ? test.replace("T", " ")
      : new Date().toLocaleString("sv-SE", { timeZone: "Europe/Prague" }).slice(0, 16);
  }

  /* Webflow vypisuje datum podle zvoleného formátu. Bereme ISO, „15. 10. 2026“, „15.10.2026“,
     český „15. října 2026“ (i 1. pád „15. říjen 2026“, i bez tečky) a výchozí anglický „October 15, 2026“. Nečitelné vrátí "". */
  var MES_CISLO = { ledna: 1, leden: 1, unora: 2, unor: 2, brezna: 3, brezen: 3, dubna: 4, duben: 4, kvetna: 5, kveten: 5,
    cervna: 6, cerven: 6, cervence: 7, cervenec: 7, srpna: 8, srpen: 8, zari: 9, rijna: 10, rijen: 10, listopadu: 11, listopad: 11, prosince: 12, prosinec: 12 };
  function datum(s) {
    s = String(s || "").trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    var m = s.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
    if (m) return m[3] + "-" + pad(m[2]) + "-" + pad(m[1]);
    /* Lomítka (vazba ve Webflow omylem D/M/YYYY): web je český, tedy den/měsíc, nikdy přes new Date (ten čte M/D) */
    var l = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (l) return l[3] + "-" + pad(l[2]) + "-" + pad(l[1]);
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
  /* adresa bez PSČ a města: „Kubišova 1291/7, 674 01 Třebíč“ → „Kubišova 1291/7“ */
  /* bez PSČ, s městem: „Kubišova 1291/7, 674 01 Třebíč“ → „Kubišova 1291/7, Třebíč“ (klientka 17. 11. 2026: jen ulice nestačí) */
  function ulice(a) { return String(a || "").replace(/,\s*\d{3}\s?\d{2}\s+([^,]+)$/, ", $1"); }

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

  /* ---------- Data ve tvaru data atributů skrytých listů (komponenta cms-data) ----------
     Pásmo: ordinace (slug), den, od, do, platiOd, platiDo.
     Zástup: ordinace, typ, od, do, kdo, hodiny, vzkaz, zoNazev, zoAdresa, zoTel (Název, Adresa a Telefon z reference
     Zastupující ordinace) a adresa, tel (vlastní pole zástupu). Navíc nazev (Ordinace › Název) a zoSlug (Zastupující ordinace › Slug):
     z nich se pozná, koho zastupující ordinace ten den zastupuje (16. 11. 2026). Přednost má Zastupující ordinace, jinak vlastní pole.
     Ve Webflow tak stačí navázat obě sady atributů a nepotřebuje se podmíněná viditelnost. */
  var TYP = { "zástup": "zastup", "zastup": "zastup", "zavřeno bez zástupu": "zavreno", "zavreno": "zavreno", "omezený provoz": "omezeny", "omezeny": "omezeny" };
  function pasmoZDat(d) {
    return { ord: d.ordinace, den: +d.den, od: cas(d.od), "do": cas(d["do"]), platiOd: datum(d.platiOd), platiDo: datum(d.platiDo) };
  }
  function zastupZDat(d) {
    return { el: d.el, ord: d.ordinace, typ: TYP[String(d.typ || "").toLowerCase()] || "zastup",
      od: datum(d.od), "do": datum(d["do"]), kdo: d.kdo || "", nazev: d.nazev || "", zoSlug: d.zoSlug || "", zoAdresa: d.zoAdresa || "",
      adresa: d.zoAdresa ? [d.zoNazev, d.zoAdresa].filter(Boolean).join(", ") : (d.adresa || ""),
      tel: d.zoTel || d.tel || "", hodiny: d.hodiny || "", vzkaz: d.vzkaz || "", zoNazev: d.zoNazev || "" };
  }

  /* Omezený provoz s hodinami („09:00–12:00“) nahradí běžná pásma a přebije i svátek (sváteční provoz).
     Bez hodin platí běžná pásma, ve svátek tedy zavřeno. */
  function hodinyZastupu(z) {
    var m = z && String(z.hodiny || "").match(/(\d{1,2}[:.]\d{2})\s*[–-]\s*(\d{1,2}[:.]\d{2})/);
    return m && cas(m[1]) < cas(m[2]) ? [{ od: cas(m[1]), "do": cas(m[2]) }] : null;
  }

  /* Kdo zastupuje (titulek boxu na kartě): jméno lékařky, bez něj zastupující ordinace ze sítě („MiniMedica Borovina“). */
  function kdoZastupuje(z) {
    if (z && z.kdo) return z.kdo;
    var n = z && z.zoNazev ? String(z.zoNazev) : "";
    return n ? (/^MiniMedica\b/i.test(n) ? n : "MiniMedica " + n) : "";
  }

  /* ---------- Názvy svátků (15. 11. 2026, zátěžový test Vánoce) ---------- */
  var NAZVY_SVATKU = { "01-01": "Nový rok", "05-01": "Svátek práce", "05-08": "Den vítězství", "07-05": "Den Cyrila a Metoděje",
    "07-06": "Den upálení mistra Jana Husa", "09-28": "Den české státnosti", "10-28": "Den vzniku Československa",
    "11-17": "Den boje za svobodu a demokracii", "12-24": "Štědrý den", "12-25": "1. svátek vánoční", "12-26": "2. svátek vánoční" };
  function nazevSvatku(iso) { return NAZVY_SVATKU[iso.slice(5)] || (iso === plusDny(velikonocniNedele(+iso.slice(0, 4)), -2) ? "Velký pátek" : "Velikonoční pondělí"); }
  function nazevBloku(b) {
    if (b.od === b["do"]) return nazevSvatku(b.od);
    if (b.od.slice(5) === "12-24" && b["do"].slice(5) === "12-26") return "Vánoční svátky";
    var n = []; for (var d = b.od; d <= b["do"]; d = plusDny(d, 1)) n.push(nazevSvatku(d));
    return n.join(", ");
  }
  function rozsahKratce(od, dO) { return kratce(od) + (dO !== od ? "–" + kratce(dO) : ""); }
  /* „ordinaci Hájek“, „ordinace Borovina a Horka-Domky“ */
  function vycet(n) { return (n.length > 1 ? "ordinace " + n.slice(0, -1).join(", ") + " a " + n[n.length - 1] : "ordinaci " + n[0]); }

  /* ---------- Výpočet ----------
     vytvor({ pasma, zastupy, ted }): pásma a zástupy jako záznamy data atributů (viz výše), ted ve tvaru přepínače
     („2026-12-24T10:00“, jinak pražský čas). Vrací stav ordinací k tomu okamžiku a texty, které z něj ukáže karta. */
  function vytvor(moznosti) {
    moznosti = moznosti || {};
    var ted = tedZ(moznosti.ted);
    var DNES = ted.slice(0, 10), MIN = toMin(ted.slice(11, 16)), DOW = isoDow(DNES);
    var PASMA = (moznosti.pasma || []).map(pasmoZDat).filter(function (p) { return p.ord && p.den && p.od && p["do"]; });
    var ZASTUPY = (moznosti.zastupy || []).map(zastupZDat).filter(function (z) { return z.ord && z.od && z["do"]; });

    function kdy(iso) {
      var i = Math.round((new Date(iso + "T12:00:00Z") - new Date(DNES + "T12:00:00Z")) / 864e5);
      if (i === 0) return "dnes";
      if (i === 1) return "zítra";
      var d = new Date(iso + "T12:00:00Z").getUTCDay();
      return i < 7 ? DNY_V[d] : DNY_V[d] + " " + kratce(iso);
    }
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
    /* Ordinace bez jakýchkoli dat (žádné pásmo ani zástup, např. stránka 404 bez cms-data): kořen na webu zůstane
       bez dekorace, platí neutrální text z markupu („Hodiny v detailu“). Jinak by engine tvrdil „Zavřeno“. */
    function maData(ord) {
      return PASMA.some(function (p) { return p.ord === ord; }) || ZASTUPY.some(function (z) { return z.ord === ord; });
    }
    /* ordinuje se ten den podle běžných pásem (jedna ordinace, nebo kterákoli, když ord chybí) */
    function ordinujeSe(iso, ord) {
      var dow = isoDow(iso);
      return PASMA.some(function (p) { return (!ord || p.ord === ord) && p.den === dow && (!p.platiOd || p.platiOd <= iso) && (!p.platiDo || iso <= p.platiDo); });
    }
    /* souvislé svátky v okně [od, do]; blok jen když by se v některý jeho den jinak ordinovalo */
    function svatkyVOkne(od, dO) {
      var bloky = [], b = null;
      for (var d = od; d <= dO; d = plusDny(d, 1)) {
        if (!jeSvatek(d)) { b = null; continue; }
        if (b) b["do"] = d; else { b = { od: d, "do": d }; bloky.push(b); }
      }
      return bloky.filter(function (x) {
        for (var d = x.od; d <= x["do"]; d = plusDny(d, 1)) if (ordinujeSe(d)) return true;
        return false;
      });
    }
    /* koho ordinace v období zastupuje (názvy zastoupených ordinací; zastupující má ten den vlastní omezený provoz) */
    function zastupuje(ord, od, dO) {
      var n = [];
      ZASTUPY.forEach(function (z) {
        if (z.typ === "zastup" && z.zoSlug === ord && z.nazev && z.od <= dO && od <= z["do"] && n.indexOf(z.nazev) < 0) n.push(z.nazev);
      });
      return n;
    }
    /* Změna proti běžným hodinám v den iso (tabulka hodin na detailu, kalendář v panelu). Bez změny null.
       typ: zastup · zavreno · omezeny · svatecni · svatek; text bez data („Štědrý den, zavřeno“, „omezený provoz 8:00–11:00, zastupuje i ordinaci Hájek“). */
    function zmenaDne(ord, iso) {
      var z = zastupNaDen(ord, iso), sv = jeSvatek(iso), h = hodinyZastupu(z);
      var rozsah = h ? bezNuly(h[0].od) + "–" + bezNuly(h[0]["do"]) : "";
      if (z && z.typ === "zastup") return { typ: "zastup", text: "zastupuje " + (z.kdo || (z.zoNazev ? "ordinace " + z.zoNazev : "jiná ordinace")) + (rozsah ? ", " + rozsah : ""), z: z };
      if (z && z.typ === "zavreno") return { typ: "zavreno", text: sv ? nazevSvatku(iso) + ", zavřeno" : "zavřeno", z: z };
      if (z && h) {
        var n = zastupuje(ord, iso, iso);
        return { typ: sv ? "svatecni" : "omezeny", text: (sv ? "sváteční provoz " : "omezený provoz ") + rozsah + (n.length ? ", zastupuje i " + vycet(n) : ""), z: z };
      }
      if (sv && ordinujeSe(iso, ord)) return { typ: "svatek", text: nazevSvatku(iso) + ", zavřeno", z: null };
      return null;
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
        /* zastupovaná ordinace je zavřená: nikdy hodiny (ani zastupující ordinace, rodič by jel do zavřené ordinace).
           Hodiny zástupu ukáže box a panel Kam jít (klientka 16. 11. 2026). */
        r.dnes = "Dovolená, zavřeno";
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

    /* ---------- Texty karty ze stavu: dekorace webu i karta v panelu ---------- */
    /* box upozornění: jen když platí zástup (zástup, zavřeno, omezený provoz) */
    function upozorneni(r) {
      var z = r.z;
      if (!z) return null;
      /* bez jména lékařky nese titulek název zastupující ordinace a text už jen adresu (údaj se neopakuje, rozhodnutí 20) */
      var prvniVeta = z.vzkaz ? z.vzkaz.split(/(?<=\.)\s/)[0] : "", kdo = z.kdo || z.zoNazev, kde = z.kdo ? z.adresa : (z.zoAdresa || z.adresa);
      var n = z.typ === "omezeny" ? zastupuje(z.ord, DNES, DNES) : [];
      return {
        titulek: z.typ === "zastup" ? (kdo ? "Zastupuje " + kdo : "Zástup do " + kratce(z["do"]))
          : z.typ === "zavreno" ? "Zavřeno do " + kratce(z["do"])
          : (jeSvatek(DNES) && hodinyZastupu(z) ? "Sváteční provoz" : "Omezený provoz") + (n.length ? ", zastupuje i " + n.join(" a ") : ""),
        text: [z.typ === "zastup" ? ulice(kde) : "", prvniVeta].filter(Boolean).join(". ").replace(/\.\./g, ".")
      };
    }
    /* Tlačítko Zavolat: během zástupu číslo zastupující ordinace, nikdy mrtvé číslo. format „cislo“ = jen číslo,
       „kratce“ = bez čísla, jinak „Zavolat 568 842 358“. telVlastni = vlastní číslo ordinace (data-tel-vlastni).
       Bez zástupu a bez vlastního čísla null: tlačítko zůstane, jak ho vyrenderoval server. */
    function tlacitkoVolat(r, format, telVlastni) {
      var z = r.z, zTel = z && z.typ === "zastup" && telOdkaz(z.tel) ? z.tel : "", cislo;
      if (zTel) {
        cislo = telText(zTel);
        return { href: telOdkaz(zTel), text: format === "cislo" ? cislo : format === "kratce" ? "Zavolat zástup" : "Zavolat zástup " + cislo,
          cislo: cislo, ariaLabel: "Zavolat zastupující ordinaci, " + cislo, zastup: true };
      }
      if (telVlastni && telOdkaz(telVlastni)) {
        cislo = telText(telVlastni);
        return { href: telOdkaz(telVlastni), text: format === "cislo" ? cislo : format === "kratce" ? "Zavolat" : "Zavolat " + cislo,
          cislo: cislo, ariaLabel: null, zastup: false };
      }
      return null;
    }
    /* poznámka pod tlačítkem Zavolat (prázdná = skrýt) */
    function poznamkaVolat(r) {
      if (r.z && r.z.typ === "zastup") return "Během zástupu volejte zastupující ordinaci.";
      if (r.st === "closed" && r.dalsi) return "Zavolat můžete " + kdy(r.dalsi.iso) + " od " + bezNuly(r.dalsi.od) + ".";
      return "";
    }
    /* pořadí tlačítek (21. 10. 2026): online objednání je vždy hlavní a první, Zavolat druhé; engine pořadí nemění */
    function objednaniPrvni() { return true; }

    return {
      ted: ted, dnes: DNES, min: MIN, dow: DOW, pasma: PASMA, zastupy: ZASTUPY,
      kdy: kdy, pasmaDne: pasmaDne, zastupNaDen: zastupNaDen, maData: maData, blokyDne: blokyDne, dalsiOtevreni: dalsiOtevreni, stav: stav,
      upozorneni: upozorneni, tlacitkoVolat: tlacitkoVolat, poznamkaVolat: poznamkaVolat, objednaniPrvni: objednaniPrvni,
      ordinujeSe: ordinujeSe, svatkyVOkne: svatkyVOkne, zastupuje: zastupuje, zmenaDne: zmenaDne
    };
  }

  koren.MMEngine = {
    vytvor: vytvor, jeSvatek: jeSvatek, velikonocniNedele: velikonocniNedele, datum: datum, cas: cas,
    telOdkaz: telOdkaz, telText: telText, cisloTel: cisloTel, kratce: kratce, dlouze: dlouze, ulice: ulice,
    plusDny: plusDny, isoDow: isoDow, hodinyZastupu: hodinyZastupu, kdoZastupuje: kdoZastupuje,
    nazevSvatku: nazevSvatku, nazevBloku: nazevBloku, rozsahKratce: rozsahKratce, vycet: vycet
  };

  /* Bez DOM (panel na serveru, testy v Node) jen jádro, žádná dekorace. V prohlížeči ji vypne
     globalThis.MMEngineBezDekorace = true nastavené před načtením (náhled zástupu v panelu: karta tam není z webu). */
  if (typeof document === "undefined" || typeof location === "undefined" || koren.MMEngineBezDekorace) return;

  /* ---------- Data z markupu ---------- */
  function vse(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  /* Značky podmínek čte jen CSS (:has). Prvek, který nějakou obsahuje, engine nepřepisuje. */
  var ZNACKY = "[data-mm-pole], [data-mm-podminky], [data-mm-kdyz-plne], [data-mm-kdyz-prazdne]";
  function maZnacky(el) { return !!el.querySelector(ZNACKY); }
  function napis(el, t) { if (!maZnacky(el)) el.textContent = t; }

  var test = new URLSearchParams(location.search).get("ted");
  var E = vytvor({
    ted: test,
    pasma: vse("[data-mm-pasmo]").map(function (el) { return el.dataset; }),
    /* el: položka listu zástupů, podle ní data-mm-zobrazit níže pozná svůj zástup */
    zastupy: vse("[data-mm-zastup]").map(function (el) { var d = Object.assign({}, el.dataset); d.el = el; return d; })
  });
  var DNES = E.dnes, DOW = E.dow, ZASTUPY = E.zastupy, ted = E.ted;

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

  var cache = {};
  vse("[data-mm-ordinace]").forEach(function (root) {
    if (!E.maData(root.dataset.mmOrdinace)) return;
    var ord = root.dataset.mmOrdinace, r = cache[ord] || (cache[ord] = E.stav(ord)), z = r.z;

    /* štítek: prvek s data-mm="badge" uvnitř, nebo kořen sám (čip na fotce) */
    var badges = vse('[data-mm="badge"]', root);
    if (root.dataset.mm === "badge") badges.push(root);
    badges.forEach(function (b) { nastavStav(b, r.st); });
    vse('[data-mm="badge-text"]', root).forEach(function (el) { napis(el, el.dataset.format === "kratce" && r.kratce ? r.kratce : r.text); });
    text(root, "dnes", r.dnes);

    /* upozornění na kartě */
    var u = E.upozorneni(r);
    vse('[data-mm="alert"]', root).forEach(function (alert) {
      ukaz(alert, !!u);
      if (!u) return;
      text(alert, "alert-title", u.titulek);
      text(alert, "alert-text", u.text);
    });

    /* telefon: odkaz, text a aria-label dostanou VŠECHNA tlačítka v kořeni, i skryté varianty a Empty State.
       Markup vyrenderovaný během zástupu, který mezitím skončil (nebo ?ted mimo zástup), vrátí na vlastní číslo. */
    vse('[data-mm="call"]', root).forEach(function (call) {
      var t = E.tlacitkoVolat(r, call.dataset.format, call.dataset.telVlastni);
      if (!t) return;
      call.setAttribute("href", t.href);
      text(call, "call-text", t.text);
      if (t.ariaLabel) call.setAttribute("aria-label", t.ariaLabel); else call.removeAttribute("aria-label");
      text(call, "call-cislo", t.cislo);
    });
    /* poznámka pod tlačítkem: všechny v kořeni (položka listu i Empty State). Poznámku se značkami podmínek
       (varianta s číslem zástupu) engine nepřepisuje, jen ji ukáže během zástupu. */
    vse('[data-mm="call-note"]', root).forEach(function (note) {
      var n = E.poznamkaVolat(r);
      if (maZnacky(note)) { ukaz(note, !!(z && z.typ === "zastup")); return; }
      note.textContent = n; ukaz(note, !!n);
    });
    /* pořadí tlačítek engine nemění (21. 10. 2026): online objednání je vždy hlavní, Zavolat vedle něj druhé
       (obrys z markupu, ve Webflow embed D1e). Bez online objednání je Zavolat hlavní a druhé e-mail. */
  });

  /* ---------- Zástupy jako obsah: běžící / plánované / prošlé ----------
     Běží až po kořenech ordinací: poznámku pod telefonem mimo běh zástupu zase skryje. */
  vse("[data-mm-zobrazit]").forEach(function (el) {
    var z = ZASTUPY.filter(function (x) { return x.el === el; })[0] || { od: datum(el.dataset.od), "do": datum(el.dataset["do"]) };
    var dni = +(el.dataset.mmDni || 60), rezim = el.dataset.mmZobrazit, bezi = z.od <= DNES && DNES <= z["do"],
      planovany = DNES < z.od && z.od <= plusDny(DNES, dni);
    ukaz(el, rezim === "bezi" ? bezi : rezim === "planovany" ? planovany : (bezi || planovany));
  });
  /* ---------- Zástupy po dnech + svátky (15. 11. 2026, zátěžový test Vánoce) ----------
     Seznam s data-mm-po-dnech seskupí po dnech: v rámci dne omezený provoz (kdo zastupuje) před zástupy a zavřením,
     opakované datum skryje třídou is-navazuje, předchozímu řádku dá is-pokracuje (styl dělí jen dny).
     Státní svátky v okně seznamu doplní jako řádek „Všechny ordinace“ podle vzoru v markupu (data-mm-svatek-vzor="#id seznamu"),
     jen když by se aspoň v jeden ze dnů jinak ordinovalo. Texty jsou ve vzoru, engine doplní datum a název svátku.
     Režim „planovane“ (/provoz): okno od zítřka. Režim „nejblizsi“ (pruh na HP): okno od dneška, nechá jen nejbližší den se změnou,
     ostatní skryje a odkryje odkaz data-mm-dalsi-pro="#id". */
  var PORADI_TYPU = { svatek: 0, omezeny: 1, zastup: 2, zavreno: 3 };
  vse("[data-mm-po-dnech]").forEach(function (seznam) {
    var rezim = seznam.dataset.mmPoDnech, id = "#" + seznam.id;
    var radky = vse("[data-mm-zobrazit]", seznam).map(function (el) {
      var od = datum(el.dataset.od), dO = datum(el.dataset["do"]);
      return { el: el, obal: el.closest(".w-dyn-item") || el, od: od, "do": dO,
        typ: TYP[String(el.dataset.typ || "").toLowerCase()] || "zastup", vidim: !el.classList.contains("hide") };
    }).filter(function (r) { return r.od && r["do"]; });
    /* okno seznamu: „planovany“ od zítřka, jinak od dneška; délka z prvního řádku nebo seznamu (data-mm-dni) */
    var dni = +(seznam.dataset.mmDni || (radky[0] && radky[0].el.dataset.mmDni) || 60);
    var zacatek = rezim === "planovane" ? plusDny(DNES, 1) : DNES, konec = plusDny(DNES, dni);
    var vzor = document.querySelector('[data-mm-svatek-vzor="' + id + '"]');
    var rodic = radky.length ? radky[0].obal.parentNode : seznam;
    var svatky = vzor ? E.svatkyVOkne(zacatek, konec) : [];
    svatky.forEach(function (b) {
      var k = vzor.cloneNode(true);
      k.removeAttribute("data-mm-svatek-vzor"); k.removeAttribute("id");
      k.setAttribute("data-mm-svatek-den", b.od); k.setAttribute("data-od", b.od); k.setAttribute("data-do", b["do"]);
      vse("[data-mm-svatek-datum]", k).forEach(function (x) { x.textContent = rozsahKratce(b.od, b["do"]); });
      vse("[data-mm-svatek-nazev]", k).forEach(function (x) { x.textContent = nazevBloku(b); });
      ukaz(k, true);
      rodic.appendChild(k);
      radky.push({ el: k, obal: k, od: b.od, "do": b["do"], typ: "svatek", vidim: true });
    });
    var viditelne = radky.filter(function (r) { return r.vidim; });
    /* den, od kterého řádek platí (běžící zástup = dnes) */
    viditelne.forEach(function (r) { r.den = r.od < DNES ? DNES : r.od; });
    viditelne.sort(function (a, b) { return a.den < b.den ? -1 : a.den > b.den ? 1 : PORADI_TYPU[a.typ] - PORADI_TYPU[b.typ]; });
    /* data-mm-jeden (detail ordinace, 16. 11. 2026): jen jeden pruh. Běží-li dnes zástup (viditelný [data-mm-zobrazit="bezi"] vedle seznamu),
       plánované se neukážou vůbec; jinak nejbližší den včetně dnešního svátku. */
    if (seznam.hasAttribute("data-mm-jeden") && vse('[data-mm-zobrazit="bezi"]', seznam.parentNode).some(function (el) {
      return !seznam.contains(el) && !el.classList.contains("hide");
    })) { viditelne.forEach(function (r) { ukaz(r.el, false); }); viditelne = []; }
    if (rezim === "nejblizsi" && viditelne.length) {
      var den = viditelne[0].den, skryte = 0;
      viditelne = viditelne.filter(function (r) {
        var dnes = r.od <= den && den <= r["do"];
        if (!dnes) { ukaz(r.el, false); skryte++; }
        return dnes;
      });
      vse('[data-mm-dalsi-pro="' + id + '"]').forEach(function (d) { ukaz(d, skryte > 0); });
    }
    /* pořadí v DOM podle dne a typu, opakované datum navazuje na předchozí řádek */
    viditelne.forEach(function (r, i) {
      rodic.appendChild(r.obal);
      var stejny = i > 0 && viditelne[i - 1].od === r.od && viditelne[i - 1]["do"] === r["do"];
      r.el.classList.toggle("is-navazuje", stejny);
      if (stejny) viditelne[i - 1].el.classList.add("is-pokracuje");
    });
  });

  /* prázdné stavy seznamů zástupů (svátek doplněný enginem se počítá) */
  vse("[data-mm-prazdne-pro]").forEach(function (empty) {
    var list = document.querySelector(empty.dataset.mmPrazdnePro);
    ukaz(empty, !list || !vse("[data-mm-zobrazit]:not(.hide), [data-mm-svatek-den]:not(.hide)", list).length);
  });

  /* ---------- „Platí do“ (aktuality, pozice, oznámení) ---------- */
  vse("[data-mm-plati-do]").forEach(function (el) {
    var d = datum(el.dataset.mmPlatiDo);
    if (d && d < DNES) {
      if (el.dataset.mmPoExpiraci === "banner") ukaz(document.querySelector('[data-mm="expirovano"]'), true);
      else { el.setAttribute("data-mm-proslo", ""); ukaz(el, false); } /* značka pro filtr seznamu, ať prošlou položku neodkryje */
    }
  });

  /* ---------- Kdo koho zastupuje (16. 11. 2026) ----------
     Zastupující ordinace má ten den vlastní omezený provoz. Bez věty „Zastupujeme i ordinaci Hájek.“ to na jejím detailu vypadalo
     jen jako zkrácené hodiny bez důvodu. Zástupy nesou data-nazev (Ordinace › Název) a data-zo-slug (Zastupující ordinace › Slug).
     Ordinace stránky (STRANKA) = jediný slug mezi kořeny v main (detail); na HP a /ordinace jich je víc, tam se věta nepřidává. */
  var STRANKA = (function () {
    var s = vse("main [data-mm-ordinace]").map(function (el) { return el.dataset.mmOrdinace; }).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    return s.length === 1 ? s[0] : "";
  })();
  if (STRANKA) vse('[data-mm-varianta="Omezený provoz"]').forEach(function (blok) {
    var nos = blok.closest("[data-od]"); if (!nos) return;
    var n = E.zastupuje(STRANKA, datum(nos.dataset.od), datum(nos.dataset["do"]));
    vse(".mm-zastupuje-i", blok).forEach(function (x) { x.remove(); });
    if (!n.length) return;
    var v = document.createElement("span");
    v.className = "mm-zastupuje-i";
    v.textContent = " Zastupujeme i " + vycet(n) + ". ";
    /* za hodiny (a za tečku, když je ve Webflow samostatný span), jinak na konec věty */
    var za = vse(":scope > [data-mm-prazdne]", blok)[0];
    if (za && za.nextElementSibling && za.nextElementSibling.textContent.trim() === ".") za = za.nextElementSibling;
    if (za) za.parentNode.insertBefore(v, za.nextSibling); else blok.appendChild(v);
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
  /* Změny v aktuálním týdnu (po–ne, v1.0.12; v1.0.11 bralo dnes + 6 dní a v den Vánoc ukazovalo pondělí 28. 12.) přímo v tabulce: tabulka ukazuje běžné hodiny, ale den, kdy platí něco jiného
     (svátek, zástup, zavřeno, omezený provoz), dostane is-zmena a poznámku s datem („24. 12.: Štědrý den, zavřeno“), běžná pásma ztlumí CSS.
     Jinak by 24. 12. stálo u „Dnes“ čtvrtek s běžnými hodinami a karta nahoře by tvrdila zavřeno. Ordinaci bere z data-mm-ordinace
     tabulky, jinak z první ordinace na stránce (šablona). Bez JS zůstane věta „Ve státní svátky je zavřeno.“ */
  vse('[data-mm="hodiny"]').forEach(function (tab) {
    var koren = tab.closest("[data-mm-ordinace]");
    var ord = tab.dataset.mmOrdinace || (koren && koren.dataset.mmOrdinace) || STRANKA;
    if (!ord) return;
    vse("[data-mm-den]", tab).forEach(function (row) {
      var iso = plusDny(DNES, +row.dataset.mmDen - DOW), zm = E.zmenaDne(ord, iso), t = zm ? zm.text : "";
      vse(".hodiny_zmena", row).forEach(function (el) { el.remove(); });
      row.classList.toggle("is-zmena", !!t);
      if (!t) return;
      var p = document.createElement("p");
      p.className = "hodiny_zmena";
      p.innerHTML = "<strong></strong> ";
      p.firstChild.textContent = kratce(iso) + ":";
      p.appendChild(document.createTextNode(t));
      var cil = row.children[1] || row;
      cil.insertBefore(p, cil.firstChild);
    });
  });

  /* ---------- Co s sebou: Rich text nedovolí role na ul a list-style: none v Safari bere seznamu sémantiku ---------- */
  vse(".info-box_richtext ul").forEach(function (ul) { ul.setAttribute("role", "list"); });

  /* ---------- Ulice: prvek s celým polem Adresa („Kubišova 1291/7, 674 01 Třebíč“) zkrátí na ulici a město bez PSČ
     („Kubišova 1291/7, Třebíč“). Bez JS zůstane celá adresa. Prázdné pole (w-dyn-bind-empty) a adresu bez PSČ nechá být. ---------- */
  vse("[data-mm-ulice]").forEach(function (el) {
    var t = el.textContent.trim(), u = ulice(t);
    if (u !== t && !el.classList.contains("w-dyn-bind-empty")) napis(el, u);
  });

  /* ---------- Dnešní datum ---------- */
  vse('[data-mm="dnes-datum"]').forEach(function (el) {
    var d = new Date(DNES + "T12:00:00Z");
    var t = el.dataset.format === "kratce" ? kratce(DNES)
      : el.dataset.format === "cislem" ? DNY[d.getUTCDay()] + " " + d.getUTCDate() + ". " + (d.getUTCMonth() + 1) + ". " + d.getUTCFullYear()
      : DNY[d.getUTCDay()] + " " + d.getUTCDate() + ". " + MES[d.getUTCMonth()];
    el.textContent = el.dataset.velke === "true" ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  });

  /* Pořadí karet ordinací je pevné (pole Pořadí v CMS). „Naposledy otevřená“ s přeřazením je od 21. 10. 2026 zrušená. */

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

  /* ---------- Náhled webu k datu (?ted=…) pro správce (v1.0.9, 15. 11. 2026) ----------
     Jen s parametrem v adrese: lišta nahoře říká, ke kterému dni a času web ukazuje, dá se v ní změnit datum
     a vrátit se na dnešek. Odkazy v rámci webu si parametr podrží, takže jde proklikat celý web v daný den.
     Výjimka z pravidla „engine nekreslí“: návštěvník bez parametru lištu nikdy neuvidí, nejde o obsah stránky. */
  if (test && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(test)) {
    vse("a[href]").forEach(function (a) {
      var h = a.getAttribute("href");
      if (!h || h.charAt(0) === "#" || /^(tel|mailto|javascript):/i.test(h)) return;
      var u; try { u = new URL(h, location.href); } catch (e) { return; }
      if (u.origin !== location.origin || u.searchParams.has("ted")) return;
      u.searchParams.set("ted", test);
      a.setAttribute("href", u.pathname + u.search + u.hash);
    });
    var styl = document.createElement("style");
    styl.textContent = ".mm-nahled{position:relative;z-index:1000;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:.5rem 1rem;padding:.625rem 1rem;background:var(--color--vinova,#643244);color:var(--color--bila,#fff);font:inherit;font-size:.9375rem;line-height:1.4}"
      + ".mm-nahled strong{font-weight:600}.mm-nahled form{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem}"
      + ".mm-nahled input{font:inherit;font-size:.875rem;padding:.25rem .5rem;border:0;border-radius:.375rem;color:#2A1E24;background:#fff}"
      + ".mm-nahled button,.mm-nahled a{font:inherit;font-size:.875rem;font-weight:500;color:inherit;background:transparent;border:1px solid rgba(255,255,255,.6);border-radius:999px;padding:.25rem .75rem;cursor:pointer;text-decoration:none}"
      + ".mm-nahled button:hover,.mm-nahled a:hover{background:rgba(255,255,255,.15)}.mm-nahled :focus-visible{outline:2px solid #fff;outline-offset:2px}";
    document.head.appendChild(styl);
    var lista = document.createElement("div");
    lista.className = "mm-nahled"; lista.setAttribute("role", "status");
    var popis = document.createElement("span");
    var den = DNY[new Date(DNES + "T12:00:00Z").getUTCDay()];
    popis.innerHTML = "Náhled webu: <strong></strong>";
    popis.querySelector("strong").textContent = den + " " + dlouze(DNES) + ", " + bezNuly(ted.slice(11, 16));
    var formular = document.createElement("form");
    formular.innerHTML = '<label class="sr-only" for="mm-nahled-cas">Jiné datum a čas</label><input id="mm-nahled-cas" type="datetime-local" required><button type="submit">Zobrazit</button>';
    formular.querySelector("input").value = test;
    formular.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = formular.querySelector("input").value;
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return;
      var u = new URL(location.href); u.searchParams.set("ted", v); location.href = u.pathname + u.search + u.hash;
    });
    var zpet = document.createElement("a");
    var bez = new URL(location.href); bez.searchParams.delete("ted");
    zpet.href = bez.pathname + bez.search + bez.hash; zpet.textContent = "Zpět na dnešek";
    lista.appendChild(popis); lista.appendChild(formular); lista.appendChild(zpet);
    document.body.insertBefore(lista, document.body.firstChild);
  }

  /* k ladění v konzoli (a pro testy) */
  window.MM = { ted: E.ted, stav: E.stav, jeSvatek: jeSvatek, velikonocniNedele: velikonocniNedele, datum: datum, telOdkaz: telOdkaz };
})(typeof globalThis !== "undefined" ? globalThis : window);
