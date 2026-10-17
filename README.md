# MiniMedica · skripty webu

Veřejné skripty webu [minimedica.cz](https://minimedica.cz) (Webflow). Zdroj pravdy je soukromý repozitář projektu (`web/src/js`); sem se kopírují při vydání verze.

| Soubor | Co dělá |
|---|---|
| `engine.js` | stav ordinací (otevřeno, zavřeno, zástup), přepnutí telefonu během zástupu, české datum, svátky |
| `ui.js` | navigace, megamenu, mobilní menu, filtry, akordeon, mapa |
| `bg.js` | vzor křivek v pozadí |
| `motion.js` | pohyb při scrollu (GSAP, ScrollTrigger, SplitText, Lenis) |

Načítání přes jsDelivr s pevnou verzí (tag), např. `https://cdn.jsdelivr.net/gh/Carsingers/minimedica-skripty@v1.0.0/engine.js`, ve Webflow jako registrované skripty s SRI otiskem. Nová verze = nový tag; starý tag se nemění.
