/* MiniMedica · pohyblivá pozadí (viz bg.css). Bez závislostí, pauzuje mimo obrazovku,
   respektuje prefers-reduced-motion. Bez JS zůstane statický gradient, obsah nic neztratí. */
(function(){
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = matchMedia("(pointer: fine)").matches;

  function onVisible(el, cb){
    if(!("IntersectionObserver" in window)){ cb(true); return; }
    new IntersectionObserver(function(es){ es.forEach(function(e){ cb(e.isIntersecting); }); }, {rootMargin:"80px"}).observe(el);
  }

  /* 1 · Aura: bloby se přelévají (bg.css) a měkké světlo sleduje kurzor */
  document.querySelectorAll(".bg-aura").forEach(function(layer){
    var host = layer.closest(".bg-host") || layer.parentElement;
    onVisible(host, function(v){ layer.classList.toggle("bg-paused", !v); });
    if(reduce || !finePointer) return;
    var glow = document.createElement("b"); glow.className = "follow"; layer.appendChild(glow);
    var raf = 0, nx = 0, ny = 0, px = 0, py = 0;
    host.addEventListener("pointermove", function(e){
      var r = layer.getBoundingClientRect();
      px = e.clientX - r.left; py = e.clientY - r.top;
      nx = px / r.width - .5; ny = py / r.height - .5;
      if(!raf) raf = requestAnimationFrame(function(){
        layer.style.setProperty("--mx", nx.toFixed(3)); layer.style.setProperty("--my", ny.toFixed(3));
        layer.style.setProperty("--fx", px.toFixed(0) + "px"); layer.style.setProperty("--fy", py.toFixed(0) + "px");
        layer.classList.add("is-follow"); raf = 0;
      });
    });
    host.addEventListener("pointerleave", function(){
      layer.style.setProperty("--mx", 0); layer.style.setProperty("--my", 0); layer.classList.remove("is-follow");
    });
  });

  /* 2 · Vzor: volné křivky přímo z podkladů současného minimedica.cz (bg-section, bg-babyblue, bg-footer.svg),
     poskládané přes celou výšku stránky. Každá křivka se jemně posouvá a natáčí, tvary zůstávají klientské.
     Fixní plátno kreslí jen výřez v okně (podle posunu stránky), takže i dlouhá stránka je lehká.
     Kolem kurzoru se linky rozsvítí malinovou, najetí na [data-peak] rozsvítí linky u karty. */
  var VZOR = [{"w":676.08,"h":547.642,"d":["M302.101,509.198c54.321,42.139,98.537-39.924,46.582-52.839c-12.327-3.063-24.837,1.618-41.426-7.439 c-1.964-1.07-4.229-1.579-6.608-1.579C282.93,447.341,258.673,475.51,302.101,509.198","M156.989,124.512 c-26.286,76.672,31.001,110.894,86.597,136.556c144.329,66.61,128.785,224.26,226.482,219.822 c97.698-4.445,196.509-159.874,31.087-356.378c-60.822-72.254-121.658-96.626-174.92-96.632 C234.635,27.872,165.413,99.939,156.989,124.512","M217.613,415.223 c99.476,55.744,146.513-64.021,253.324-88.966c106.813-24.942,224.967-67.344,122.882-195.39 C491.733,2.827,262.04,92.624,197.764,171.609C133.487,250.595,100.405,349.539,217.613,415.223","M321.854,212.48 c-25.715,13.376-48.975,26.755-76.679,17.44c-81.55-27.408-234.135-58.258-244.638,135.78 c-7.001,129.38,76.195,163.141,166.421,132.994c40.543-13.545,80.439,4.24,120.392,22.022 c48.948,21.792,97.976,43.584,148.377,7.738c91.53-65.104,157.16-246.597,5.824-322.718c-19.834-9.973-37.264-13.796-52.982-13.796 C362.794,191.94,341.603,202.213,321.854,212.48","M601.552,430.48 c-5.848,30.831-22.17,35.61-11.682,43.059c36.689,26.043,109.49-29.237,78.657-71.765c-9.56-13.184-19.064-18.397-27.808-18.395 C621.265,383.383,605.586,409.212,601.552,430.48","M524.691,8.401 c-41.336,32.402,0.171,61.164,31.197,65.852c31.029,4.685,36.419,20.815,43.464,10.059c20.26-30.938-15.287-84.189-51.547-84.187 C539.948,0.128,532.054,2.63,524.691,8.401","M530.854,501.178c-1.566,12.125,40.932,20.198,41.994-3.191c0.445-9.843-6.547-13.755-14.953-13.755 C546.327,484.231,532.084,491.633,530.854,501.178","M109.915,150.151 c8.688,8.6,40.891-20.273,22.95-35.313c-2.856-2.391-5.68-3.425-8.366-3.425C110.295,111.411,99.983,140.32,109.915,150.151"]},{"w":757.028,"h":589.167,"d":["M320.39,49.839 c-114.566,1.12-232.499,84.236-157.247,236.988c48.322,98.086,148.101,151.717,296.522,38.794 c50.355-38.312,132.532,2.765,186.445-57.887c53.915-60.65,83.456-253.301-102.209-262.822c-1.039-0.052-2.101-0.081-3.166-0.081 C496.967,4.824,432.234,48.739,320.39,49.839","M304.459,214.343 c-31.295,41.765-35.205,167.475,48.242,206.642c83.443,39.169,193.265,316.864,363.757,60.776 c52.151-78.335,35.324-209.561-61.279-237.703c-83.439-24.313-126.464-0.719-189.044-56.094 C403.555,132.592,335.758,172.574,304.459,214.343","M290.484,93.162 C129.133,97.554-18.913,203.022,2.128,303.732c18.753,89.752,147.923,89.752,244.763,109.259 c89.91,18.112,229.421,199.398,354.733-34.981C689.067,214.451,460.028,93.055,298.955,93.045 C296.106,93.045,293.291,93.084,290.484,93.162","M243.205,49.979 c-10.829,32.104,36.766,28.452,79.663,24.472c20.735-1.923,40.373-3.926,51.786-2c35.026,5.907,142.575,74.789,156.959,54.613 C541.956,112.554,412.675,6.731,321.693,0.419C286.146-2.046,256.455,10.682,243.205,49.979","M713.824,188.749 c-20.856,11.535,1.551,74.102,32.868,56.132c28.809-16.529-10.636-57.1-28.696-57.1 C716.42,187.784,715.013,188.088,713.824,188.749","M409.125,402.954 c-13.801,19.433,33.496,66.121,53.941,36.363c15.957-23.239-19.883-40.788-41.047-40.784 C416.074,398.533,411.28,399.918,409.125,402.954","M115.283,37.599 c0,13.671,10.182,24.75,22.744,24.75c12.564,0,22.75-11.079,22.75-24.75c0-13.668-10.186-24.754-22.75-24.754 C125.465,12.845,115.283,23.931,115.283,37.599"]},{"w":829.134,"h":713.254,"d":["M0.522,280.072 c6.457,51.235,38.291,156.244,111.679,117.205c73.385-39.039,73.618-84.935,150.403-66.48 c76.779,18.446,195.805-29.252,154.932-158.086C376.659,43.882,260.753,22.681,201.037,99.57 c-57.31,73.794-90.478,56.007-149.639,82.884C-7.766,209.331,0.522,280.072,0.522,280.072","M513.762,425.053 c-134.17,102.795-263.937,55.411-262.787,172.461c0.931,95.27,226.062,184.755,429.176,17.211 c203.114-167.537,159.523-333.93,95.245-364.915c-28.057-13.522-49.895-19.445-67.8-19.452 C631,230.351,626.303,338.818,513.762,425.053","M460.674,132.823 c-128.191,23.141-95.033,66.457-240.303,87.263c-101.817,14.578-147.324,56.325-155.76,87.436 c-59.838,220.545,96.61,184.91,150.843,291.396c54.237,106.478,359.705,6.622,435.068-182.13 c69.066-172.985-40.258-286.834-157.672-286.841C482.143,129.946,471.381,130.891,460.674,132.823","M713.803,648.126 c-29.996,12.714-35.469,3.256-46.555,15.32c-11.1,12.077-5.219,58.358,48.254,48.25c53.469-10.104,71.32-106.189,49.229-114.108 c-1.74-0.623-3.337-0.914-4.818-0.914C742.629,596.667,741.431,636.41,713.803,648.126","M459.607,7.706 c-29.787,30.48,42.243,87.979,64.471,55.499c8.866-12.958-20.515-63.073-47.794-63.08C470.5,0.125,464.815,2.372,459.607,7.706","M93.193,531.604 c-29.794,30.48,42.24,87.983,64.464,55.503c8.87-12.962-20.511-63.08-47.791-63.087C104.086,524.02,98.401,526.27,93.193,531.604","M318.198,114.701 c19.526,19.536,19.598-14.806,51.212-26.501c33.262-12.305,117.29,10.64,85.666-36.328c-7.628-11.334-19.723-15.93-33.686-15.93 C371.579,35.936,297.961,94.454,318.198,114.701"]}];
  document.querySelectorAll(".bg-vzor").forEach(function(layer){
    var canvas = document.createElement("canvas"), ctx = canvas.getContext("2d"); layer.appendChild(canvas);
    var off = document.createElement("canvas"), octx = off.getContext("2d");
    var base = layer.getAttribute("data-line") || "rgba(155,112,128,.16)"; // kulisa: vidět i bez kurzoru, ale neruší
    var hot = layer.getAttribute("data-hot") || "rgba(176,56,103,.26)";
    var radius = +(layer.getAttribute("data-radius") || 230); // záře kolem kurzoru: znatelná, ale nepřebíjí text
    var seed = 7; function rnd(){ seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    // tvary + jejich středy (getBBox ze skrytého SVG)
    var svgNS = "http://www.w3.org/2000/svg", tmp = document.createElementNS(svgNS, "svg");
    tmp.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden"); document.body.appendChild(tmp);
    var sets = VZOR.map(function(g){
      return {w:g.w, h:g.h, paths:g.d.map(function(d){
        var el = document.createElementNS(svgNS, "path"); el.setAttribute("d", d); tmp.appendChild(el);
        var b = el.getBBox();
        return {p:new Path2D(d), cx:b.x + b.width/2, cy:b.y + b.height/2, y0:b.y, y1:b.y + b.height,
          ax:4 + rnd()*8, ay:4 + rnd()*8, rot:(.6 + rnd()*1.2) * Math.PI/180, per:14 + rnd()*12, ph:rnd()*6.28};
      })};
    });
    tmp.remove();
    var W = 0, H = 0, dpr = 1, docH = 0, inst = [], t = 0, sy = -1, lastDraw = 0, running = false;
    var spot = {x:.5, y:.4, r:0}, target = {x:.5, y:.4, r:0}, lock = false;

    function layout(){
      var r = layer.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height; if(!W || !H) return;
      canvas.width = off.width = Math.round(W * dpr); canvas.height = off.height = Math.round(H * dpr);
      docH = document.documentElement.scrollHeight; inst = [];
      var span = Math.max(W, 900) * 1.3, y = -80, k = 0;
      while(y < docH){
        var g = sets[k % sets.length], s = span / g.w, mir = k % 2 ? -1 : 1;
        inst.push({g:g, s:s, mir:mir, x:mir > 0 ? -span * .12 : W + span * .12, y:y});
        y += g.h * s * .98; k++; // sady se jen lehce překrývají
      }
      draw(true);
    }
    function paint(c, color, lw){
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
      inst.forEach(function(I){
        I.g.paths.forEach(function(P){
          var top = I.y + P.y0 * I.s - sy - 40, bot = I.y + P.y1 * I.s - sy + 40;
          if(bot < 0 || top > H) return; // mimo výřez
          var w = 2 * Math.PI * t / P.per + P.ph;
          c.setTransform(dpr, 0, 0, dpr, 0, 0);
          c.translate(I.x, I.y - sy); c.scale(I.s * I.mir, I.s);
          c.translate(P.cx + Math.sin(w) * P.ax, P.cy + Math.cos(w * .8) * P.ay); c.rotate(Math.sin(w * .6) * P.rot); c.translate(-P.cx, -P.cy);
          c.lineWidth = lw / I.s; c.strokeStyle = color; c.stroke(P.p);
        });
      });
    }
    function draw(){
      sy = window.scrollY;
      paint(ctx, base, .6);
      if(spot.r > 2){ // malinová záře: tahy do pomocného plátna, oříznout kruhem kolem kurzoru
        paint(octx, hot, .8);
        octx.setTransform(1, 0, 0, 1, 0, 0); octx.globalCompositeOperation = "destination-in";
        var g = octx.createRadialGradient(spot.x*W*dpr, spot.y*H*dpr, 0, spot.x*W*dpr, spot.y*H*dpr, spot.r*dpr);
        g.addColorStop(0, "#000"); g.addColorStop(1, "rgba(0,0,0,0)");
        octx.fillStyle = g; octx.fillRect(0, 0, off.width, off.height); octx.globalCompositeOperation = "source-over";
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(off, 0, 0);
      }
    }
    function loop(ts){
      if(document.hidden){ running = false; return; }
      if(!W) layout();
      var moved = window.scrollY !== sy;
      if(moved || ts - lastDraw > 33){ // posun stránky hned, jinak ~30 fps
        if(!moved){ lastDraw = ts; if(!reduce) t += .033; }
        spot.x += (target.x - spot.x) * .12; spot.y += (target.y - spot.y) * .12; spot.r += (target.r - spot.r) * .12;
        draw();
      }
      requestAnimationFrame(loop);
    }
    function start(){ if(!running){ running = true; requestAnimationFrame(loop); } }

    if(finePointer) document.addEventListener("pointermove", function(e){
      if(lock) return; target.x = e.clientX / W; target.y = e.clientY / H; target.r = radius;
    });
    document.documentElement.addEventListener("pointerleave", function(){ if(!lock) target.r = 0; });
    document.querySelectorAll("[data-peak]").forEach(function(el){
      function on(){ var b = el.getBoundingClientRect(); lock = true; target.x = (b.left + b.width/2) / W; target.y = (b.top + 30) / H; target.r = radius * 1.3; }
      function off(){ lock = false; target.r = 0; }
      el.addEventListener("mouseenter", on); el.addEventListener("focusin", on);
      el.addEventListener("mouseleave", off); el.addEventListener("focusout", off);
    });
    new ResizeObserver(layout).observe(document.body); layout();
    document.addEventListener("visibilitychange", function(){ if(!document.hidden) start(); });
    start();
  });

  /* 3 · Linka: tenké linky napříč plochou, plynou čárkováním (CSS) */
  document.querySelectorAll(".bg-linka").forEach(function(layer){
    var n = +(layer.getAttribute("data-lines") || 16), seed = +(layer.getAttribute("data-seed") || 3);
    var svg = '<svg viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">';
    for(var k = 0; k < n; k++){
      var y0 = 40 + k * (520 / n), a = 60 + 40 * Math.sin(k*1.7 + seed), b = 50 + 50 * Math.cos(k*1.1 + seed);
      var d = "M -50 " + (y0 + a).toFixed(1) +
              " C 220 " + (y0 - b).toFixed(1) + ", 380 " + (y0 + a*1.4).toFixed(1) + ", 560 " + (y0 + 10).toFixed(1) +
              " S 860 " + (y0 - a).toFixed(1) + ", 1050 " + (y0 + b*.6).toFixed(1);
      var op = (.05 + .07 * ((k*7 % n) / n)).toFixed(3), w = (.4 + .3 * ((k*5 % n) / n)).toFixed(2), tt = (34 + (k*11 % 30)) + "s";
      svg += '<path pathLength="1" d="' + d + '" style="opacity:' + op + ';stroke-width:' + w + 'px;--t:' + tt + ';animation-delay:-' + (k*3.1).toFixed(1) + 's"/>';
    }
    layer.innerHTML = svg + "</svg>";
    onVisible(layer, function(v){ layer.classList.toggle("bg-paused", !v); });
  });
})();
