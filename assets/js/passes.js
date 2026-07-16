/* KCC — "Upcoming passes" console.
   SGP4 port of Vallado's sgp4unit, near-Earth branch only (WGS-72): valid for
   orbital periods < 225 min, so every satellite added to SATS must be LEO.
   Elements: CelesTrak GP API → localStorage (12 h) → bundled fallback set. */
(function(){
  "use strict";
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- configuration ---- */
  var STN = {lat: 30.77, lon: 76.57, alt: 0.31};   // Gharuan campus, km
  var SATS = [
    {cat: 25544, name: "ISS (ZARYA)",  role: "CREWED STATION"},
    {cat: 33591, name: "NOAA 19",      role: "WEATHER · APT"},
    {cat: 59051, name: "METEOR-M2 4",  role: "WEATHER · LRPT"},
    {cat: 27607, name: "SO-50",        role: "AMATEUR FM"}
  ];
  var HOURS = 48, MIN_EL = 10, MAX_ROWS = 7;
  var TLE_URL = "https://celestrak.org/NORAD/elements/gp.php?FORMAT=tle&CATNR=";
  var CACHE_KEY = "kcc.tle.v1", CACHE_MS = 12 * 3600000;
  // Last-resort elements so the panel degrades to "approximate" instead of dead
  // (offline, file://, or a blocked feed). Refresh occasionally when editing.
  var BAKED = {
    25544: ["1 25544U 98067A   26197.21800738  .00003540  00000+0  72346-4 0  9991",
            "2 25544  51.6313 156.4232 0006748 301.4056  58.6272 15.49021242576253"],
    33591: ["1 33591U 09005A   26197.28509586  .00000016  00000+0  32370-4 0  9998",
            "2 33591  98.9510 268.1792 0012877 310.9145  49.0911 14.13478435898591"],
    59051: ["1 59051U 24039A   26197.30499969 -.00000026  00000+0  81541-5 0  9994",
            "2 59051  98.7026 156.2396 0008259  86.0312 274.1810 14.22432184123404"],
    27607: ["1 27607U 02058C   26197.28549759  .00000351  00000+0  59480-4 0  9999",
            "2 27607  64.5519  38.9516 0074489 257.0714 102.2066 14.83099465268770"]
  };

  /* ---- SGP4 (WGS-72) ---- */
  var TWOPI = Math.PI * 2, DEG = Math.PI / 180;
  var XKE = 0.07436691613317342, RE = 6378.135,
      J2 = 0.001082616, J3 = -0.00000253881, J4 = -0.00000165597, J3OJ2 = J3 / J2;

  function parseTLE(l1, l2){
    var yy = +l1.substring(18, 20), doy = +l1.substring(20, 32);
    var year = yy < 57 ? 2000 + yy : 1900 + yy;
    var bexp = +(l1.substring(59, 61)), bman = +(l1.substring(53, 54) + "." + l1.substring(54, 59));
    return {
      epochMs: Date.UTC(year, 0, 1) + (doy - 1) * 86400000,
      bstar: bman * Math.pow(10, bexp),
      inclo: +l2.substring(8, 16) * DEG,
      nodeo: +l2.substring(17, 25) * DEG,
      ecco: +("." + l2.substring(26, 33).trim()),
      argpo: +l2.substring(34, 42) * DEG,
      mo: +l2.substring(43, 51) * DEG,
      no: +l2.substring(52, 63) * TWOPI / 1440
    };
  }

  function sgp4init(el){
    var s = {epochMs: el.epochMs, bstar: el.bstar, ecco: el.ecco, inclo: el.inclo,
             nodeo: el.nodeo, argpo: el.argpo, mo: el.mo, err: 0};
    var eccsq = el.ecco * el.ecco, omeosq = 1 - eccsq, rteosq = Math.sqrt(omeosq);
    var cosio = Math.cos(el.inclo), cosio2 = cosio * cosio, sinio = Math.sin(el.inclo);
    var ak = Math.pow(XKE / el.no, 2 / 3);
    var d1 = 0.75 * J2 * (3 * cosio2 - 1) / (rteosq * omeosq);
    var del_ = d1 / (ak * ak);
    var adel = ak * (1 - del_ * del_ - del_ * (1 / 3 + 134 * del_ * del_ / 81));
    del_ = d1 / (adel * adel);
    s.no = el.no / (1 + del_);
    var ao = Math.pow(XKE / s.no, 2 / 3);
    var po = ao * omeosq, con42 = 1 - 5 * cosio2, con41 = -con42 - 2 * cosio2;
    var posq = po * po, rp = ao * (1 - el.ecco);

    s.isimp = rp < 220 / RE + 1 ? 1 : 0;
    var sfour = 78 / RE + 1, qzms24 = Math.pow(42 / RE, 4);
    var perige = (rp - 1) * RE;
    if (perige < 156){
      sfour = perige < 98 ? 20 : perige - 78;
      qzms24 = Math.pow((120 - sfour) / RE, 4);
      sfour = sfour / RE + 1;
    }
    var pinvsq = 1 / posq, tsi = 1 / (ao - sfour);
    s.eta = ao * el.ecco * tsi;
    var etasq = s.eta * s.eta, eeta = el.ecco * s.eta, psisq = Math.abs(1 - etasq);
    var coef = qzms24 * Math.pow(tsi, 4), coef1 = coef / Math.pow(psisq, 3.5);
    var cc2 = coef1 * s.no * (ao * (1 + 1.5 * etasq + eeta * (4 + etasq)) +
              0.375 * J2 * tsi / psisq * con41 * (8 + 3 * etasq * (8 + etasq)));
    s.cc1 = el.bstar * cc2;
    var cc3 = el.ecco > 1e-4 ? -2 * coef * tsi * J3OJ2 * s.no * sinio / el.ecco : 0;
    s.x1mth2 = 1 - cosio2;
    s.cc4 = 2 * s.no * coef1 * ao * omeosq * (s.eta * (2 + 0.5 * etasq) +
            el.ecco * (0.5 + 2 * etasq) - J2 * tsi / (ao * psisq) *
            (-3 * con41 * (1 - 2 * eeta + etasq * (1.5 - 0.5 * eeta)) +
             0.75 * s.x1mth2 * (2 * etasq - eeta * (1 + etasq)) * Math.cos(2 * el.argpo)));
    s.cc5 = 2 * coef1 * ao * omeosq * (1 + 2.75 * (etasq + eeta) + eeta * etasq);
    var cosio4 = cosio2 * cosio2;
    var temp1 = 1.5 * J2 * pinvsq * s.no, temp2 = 0.5 * temp1 * J2 * pinvsq,
        temp3 = -0.46875 * J4 * pinvsq * pinvsq * s.no;
    s.mdot = s.no + 0.5 * temp1 * rteosq * con41 +
             0.0625 * temp2 * rteosq * (13 - 78 * cosio2 + 137 * cosio4);
    s.argpdot = -0.5 * temp1 * con42 + 0.0625 * temp2 * (7 - 114 * cosio2 + 395 * cosio4) +
                temp3 * (3 - 36 * cosio2 + 49 * cosio4);
    var xhdot1 = -temp1 * cosio;
    s.nodedot = xhdot1 + (0.5 * temp2 * (4 - 19 * cosio2) + 2 * temp3 * (3 - 7 * cosio2)) * cosio;
    s.omgcof = el.bstar * cc3 * Math.cos(el.argpo);
    s.xmcof = el.ecco > 1e-4 ? -2 / 3 * coef * el.bstar / eeta : 0;
    s.nodecf = 3.5 * omeosq * xhdot1 * s.cc1;
    s.t2cof = 1.5 * s.cc1;
    s.xlcof = Math.abs(cosio + 1) > 1.5e-12
      ? -0.25 * J3OJ2 * sinio * (3 + 5 * cosio) / (1 + cosio)
      : -0.25 * J3OJ2 * sinio * (3 + 5 * cosio) / 1.5e-12;
    s.aycof = -0.5 * J3OJ2 * sinio;
    s.delmo = Math.pow(1 + s.eta * Math.cos(el.mo), 3);
    s.sinmao = Math.sin(el.mo);
    s.x7thm1 = 7 * cosio2 - 1;
    if (!s.isimp){
      var cc1sq = s.cc1 * s.cc1;
      s.d2 = 4 * ao * tsi * cc1sq;
      var temp = s.d2 * tsi * s.cc1 / 3;
      s.d3 = (17 * ao + sfour) * temp;
      s.d4 = 0.5 * temp * ao * tsi * (221 * ao + 31 * sfour) * s.cc1;
      s.t3cof = s.d2 + 2 * cc1sq;
      s.t4cof = 0.25 * (3 * s.d3 + s.cc1 * (12 * s.d2 + 10 * cc1sq));
      s.t5cof = 0.2 * (3 * s.d4 + 12 * s.cc1 * s.d3 + 6 * s.d2 * s.d2 +
                15 * cc1sq * (2 * s.d2 + cc1sq));
    }
    return s;
  }

  /* minutes since epoch → TEME position [km] (null on decay/error) */
  function sgp4(s, t){
    var mdf = s.mo + s.mdot * t,
        argpdf = s.argpo + s.argpdot * t,
        nodedf = s.nodeo + s.nodedot * t;
    var argpm = argpdf, mm = mdf, t2 = t * t;
    var nodem = nodedf + s.nodecf * t2;
    var tempa = 1 - s.cc1 * t, tempe = s.bstar * s.cc4 * t, templ = s.t2cof * t2;
    if (!s.isimp){
      var delomg = s.omgcof * t, dmt = 1 + s.eta * Math.cos(mdf);
      var delm = s.xmcof * (dmt * dmt * dmt - s.delmo);
      var tf = delomg + delm;
      mm = mdf + tf; argpm = argpdf - tf;
      var t3 = t2 * t, t4 = t3 * t;
      tempa -= s.d2 * t2 + s.d3 * t3 + s.d4 * t4;
      tempe += s.bstar * s.cc5 * (Math.sin(mm) - s.sinmao);
      templ += s.t3cof * t3 + t4 * (s.t4cof + t * s.t5cof);
    }
    var am = Math.pow(XKE / s.no, 2 / 3) * tempa * tempa;
    var nm = XKE / Math.pow(am, 1.5);
    var em = s.ecco - tempe;
    if (em >= 1 || em < -0.001 || am < 0.95 || nm <= 0){ s.err = 1; return null; }
    if (em < 1e-6) em = 1e-6;
    mm += s.no * templ;
    var xlm = mm + argpm + nodem;
    nodem = (nodem % TWOPI + TWOPI) % TWOPI;
    argpm = (argpm % TWOPI + TWOPI) % TWOPI;
    xlm = (xlm % TWOPI + TWOPI) % TWOPI;
    mm = ((xlm - argpm - nodem) % TWOPI + TWOPI) % TWOPI;

    var sinip = Math.sin(s.inclo), cosip = Math.cos(s.inclo);
    var axnl = em * Math.cos(argpm);
    var tp = 1 / (am * (1 - em * em));
    var aynl = em * Math.sin(argpm) + tp * s.aycof;
    var xl = mm + argpm + nodem + tp * s.xlcof * axnl;

    var u = ((xl - nodem) % TWOPI + TWOPI) % TWOPI;
    var eo1 = u, tem5 = 9999.9, ktr = 1, sineo1 = 0, coseo1 = 1;
    while (Math.abs(tem5) >= 1e-12 && ktr <= 10){
      sineo1 = Math.sin(eo1); coseo1 = Math.cos(eo1);
      tem5 = 1 - coseo1 * axnl - sineo1 * aynl;
      tem5 = (u - aynl * coseo1 + axnl * sineo1 - eo1) / tem5;
      if (Math.abs(tem5) >= 0.95) tem5 = tem5 > 0 ? 0.95 : -0.95;
      eo1 += tem5; ktr++;
    }
    var ecose = axnl * coseo1 + aynl * sineo1,
        esine = axnl * sineo1 - aynl * coseo1,
        el2 = axnl * axnl + aynl * aynl;
    var pl = am * (1 - el2);
    if (pl < 0){ s.err = 4; return null; }
    var rl = am * (1 - ecose);
    var betal = Math.sqrt(1 - el2);
    var tq = esine / (1 + betal);
    var sinu = am / rl * (sineo1 - aynl - axnl * tq);
    var cosu = am / rl * (coseo1 - axnl + aynl * tq);
    var su = Math.atan2(sinu, cosu);
    var sin2u = 2 * cosu * sinu, cos2u = 1 - 2 * sinu * sinu;
    var tp1 = 1 / pl, tj1 = 0.5 * J2 * tp1, tj2 = tj1 * tp1;
    var mrt = rl * (1 - 1.5 * tj2 * betal * (3 * cosip * cosip - 1)) +
              0.5 * tj1 * s.x1mth2 * cos2u;
    if (mrt < 1){ s.err = 6; return null; }
    su -= 0.25 * tj2 * s.x7thm1 * sin2u;
    var xnode = nodem + 1.5 * tj2 * cosip * sin2u;
    var xinc = s.inclo + 1.5 * tj2 * cosip * sinip * cos2u;
    var sinsu = Math.sin(su), cossu = Math.cos(su),
        snod = Math.sin(xnode), cnod = Math.cos(xnode),
        sini = Math.sin(xinc), cosi = Math.cos(xinc);
    var ux = -snod * cosi * sinsu + cnod * cossu,
        uy = cnod * cosi * sinsu + snod * cossu,
        uz = sini * sinsu;
    return [mrt * ux * RE, mrt * uy * RE, mrt * uz * RE];
  }

  /* ---- observer geometry ---- */
  function gstime(jd){
    var tut1 = (jd - 2451545) / 36525;
    var g = -6.2e-6 * tut1 * tut1 * tut1 + 0.093104 * tut1 * tut1 +
            (876600 * 3600 + 8640184.812866) * tut1 + 67310.54841;
    g = g * DEG / 240 % TWOPI;
    return g < 0 ? g + TWOPI : g;
  }
  function siteECEF(latDeg, lonDeg, altKm){
    var lat = latDeg * DEG, lon = lonDeg * DEG;
    var a = 6378.137, e2 = 0.00669437999014;   // WGS-84
    var sl = Math.sin(lat), cl = Math.cos(lat);
    var N = a / Math.sqrt(1 - e2 * sl * sl);
    return {x: (N + altKm) * cl * Math.cos(lon),
            y: (N + altKm) * cl * Math.sin(lon),
            z: (N * (1 - e2) + altKm) * sl,
            sl: sl, cl: cl, slon: Math.sin(lon), clon: Math.cos(lon)};
  }
  function lookAngles(site, rTeme, ms){
    var g = gstime(ms / 86400000 + 2440587.5);
    var cg = Math.cos(g), sg = Math.sin(g);
    var x = cg * rTeme[0] + sg * rTeme[1],
        y = -sg * rTeme[0] + cg * rTeme[1],
        z = rTeme[2];
    var dx = x - site.x, dy = y - site.y, dz = z - site.z;
    var rS = site.sl * site.clon * dx + site.sl * site.slon * dy - site.cl * dz,
        rE = -site.slon * dx + site.clon * dy,
        rZ = site.cl * site.clon * dx + site.cl * site.slon * dy + site.sl * dz;
    var rng = Math.sqrt(dx * dx + dy * dy + dz * dz);
    var az = Math.atan2(rE, -rS) / DEG;
    if (az < 0) az += 360;
    return {az: az, el: Math.asin(rZ / rng) / DEG};
  }
  function elAt(s, site, ms){
    var r = sgp4(s, (ms - s.epochMs) / 60000);
    return r ? lookAngles(site, r, ms) : null;
  }

  /* ---- pass search: coarse 30 s scan + bisection on the horizon crossings ---- */
  function findPasses(s, site, t0, hours){
    var passes = [], step = 30000, end = t0 + hours * 3600000;
    var first = elAt(s, site, t0);
    if (!first) return passes;
    var up = first.el > 0, aos = up ? t0 : 0;
    for (var t = t0 + step; t <= end + step; t += step){
      var cur = elAt(s, site, t);
      if (!cur) break;
      if (!up && cur.el > 0){
        aos = refine(s, site, t - step, t, true); up = true;
      } else if (up && cur.el <= 0){
        passes.push(mkPass(s, site, aos, refine(s, site, t - step, t, false)));
        up = false;
      }
    }
    return passes;
  }
  function refine(s, site, lo, hi, rising){
    for (var i = 0; i < 18; i++){
      var mid = (lo + hi) / 2, e = elAt(s, site, mid);
      if (!e) return mid;
      if ((e.el > 0) === rising) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
  }
  function mkPass(s, site, aos, los){
    var maxEl = -90, maxT = aos, n = 60;
    for (var i = 0; i <= n; i++){
      var t = aos + (los - aos) * i / n, e = elAt(s, site, t);
      if (e && e.el > maxEl){ maxEl = e.el; maxT = t; }
    }
    var w = (los - aos) / n;
    for (var lo = maxT - w, hi = maxT + w, k = 0; k < 24; k++){
      var m1 = lo + (hi - lo) * 0.382, m2 = lo + (hi - lo) * 0.618;
      var e1 = elAt(s, site, m1), e2 = elAt(s, site, m2);
      if (!e1 || !e2) break;
      if (e1.el > e2.el){ hi = m2; if (e1.el > maxEl){ maxEl = e1.el; maxT = m1; } }
      else { lo = m1; if (e2.el > maxEl){ maxEl = e2.el; maxT = m2; } }
    }
    return {aos: aos, los: los, maxEl: maxEl,
            azA: elAt(s, site, aos).az, azL: elAt(s, site, los).az};
  }

  /* ---- elements: fresh cache → network → stale cache → bundled ---- */
  function loadCache(){
    try{
      var c = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (c && c.t && c.d) return c;
    }catch(e){}
    return null;
  }
  function fetchTLEs(){
    var abort = "AbortController" in window ? new AbortController() : null;
    if (abort) setTimeout(function(){ abort.abort(); }, 10000);
    return Promise.all(SATS.map(function(meta){
      return fetch(TLE_URL + meta.cat, abort ? {signal: abort.signal} : {}).then(function(r){
        if (!r.ok) throw 0;
        return r.text();
      }).then(function(txt){
        var L = txt.trim().split(/\r?\n/), l1, l2;
        for (var i = 0; i < L.length; i++){
          if (L[i].lastIndexOf("1 ", 0) === 0) l1 = L[i];
          else if (L[i].lastIndexOf("2 ", 0) === 0) l2 = L[i];
        }
        return l1 && l2 ? [meta.cat, [l1, l2]] : null;
      }).catch(function(){ return null; });
    })).then(function(pairs){
      var d = {}, n = 0;
      pairs.forEach(function(p){ if (p){ d[p[0]] = p[1]; n++; } });
      if (!n) throw 0;
      return d;
    });
  }
  function getElements(){
    var c = loadCache();
    if (c && Date.now() - c.t < CACHE_MS) return Promise.resolve(c);
    return fetchTLEs().then(function(d){
      var fresh = {t: Date.now(), d: d, src: "live"};
      try{ localStorage.setItem(CACHE_KEY, JSON.stringify(fresh)); }catch(e){}
      return fresh;
    }).catch(function(){
      if (c){ c.src = "cache"; return c; }
      // element age ≈ newest TLE epoch in the bundled set
      var newest = 0;
      for (var k in BAKED) newest = Math.max(newest, parseTLE(BAKED[k][0], BAKED[k][1]).epochMs);
      return {t: newest, d: BAKED, src: "baked"};
    });
  }

  /* ---- panel ---- */
  var elStatus = document.getElementById("passes-status"),
      elNext = document.getElementById("passes-next"),
      elNextSat = document.getElementById("pn-sat"),
      elNextT = document.getElementById("pn-t"),
      elWrap = document.getElementById("passes-tblwrap"),
      elRows = document.getElementById("passes-rows"),
      elFoot = document.getElementById("passes-foot");
  if (!elStatus) return;

  var site = siteECEF(STN.lat, STN.lon, STN.alt);
  var dayFmt = new Intl.DateTimeFormat("en-GB", {timeZone: "Asia/Kolkata", weekday: "short"});
  var hmsFmt = new Intl.DateTimeFormat("en-GB", {timeZone: "Asia/Kolkata",
                 hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false});
  function fmtIST(ms){ return (dayFmt.format(ms) + " " + hmsFmt.format(ms)).toUpperCase(); }
  function compass(az){ return ["N","NE","E","SE","S","SW","W","NW"][Math.round(az / 45) % 8]; }
  function two(n){ return n < 10 ? "0" + n : "" + n; }
  function mmss(ms){ var s = Math.round(ms / 1000); return two(Math.floor(s / 60)) + ":" + two(s % 60); }
  function hhmmss(ms){
    var s = Math.max(0, Math.round(ms / 1000));
    return two(Math.floor(s / 3600)) + ":" + two(Math.floor(s / 60) % 60) + ":" + two(s % 60);
  }

  function computeRows(cache){
    var now = Date.now(), rows = [];
    SATS.forEach(function(meta){
      var tle = cache.d[meta.cat];
      if (!tle) return;
      var s = sgp4init(parseTLE(tle[0], tle[1]));
      // start 25 min back so a pass already in progress keeps its true AOS
      findPasses(s, site, now - 25 * 60000, HOURS).forEach(function(p){
        if (p.los > now && p.maxEl >= MIN_EL) rows.push({m: meta, p: p});
      });
    });
    rows.sort(function(a, b){ return a.p.aos - b.p.aos; });
    return rows.slice(0, MAX_ROWS);
  }

  function renderRows(rows){
    elRows.textContent = "";
    rows.forEach(function(r){
      var tr = document.createElement("tr");
      function td(cls, text){
        var c = document.createElement("td");
        if (cls) c.className = cls;
        c.textContent = text;
        tr.appendChild(c);
        return c;
      }
      var sat = td("sat", r.m.name);
      var role = document.createElement("span");
      role.className = "role";
      role.textContent = r.m.role;
      sat.appendChild(role);
      td("num", fmtIST(r.p.aos));
      td("el num", Math.round(r.p.maxEl) + "°");
      td("", compass(r.p.azA) + " → " + compass(r.p.azL));
      td("num", mmss(r.p.los - r.p.aos));
      elRows.appendChild(tr);
    });
  }

  function showError(){
    elStatus.className = "passes-status err";
    elStatus.textContent = "TLE feed unavailable — live pass predictions need a network " +
      "connection. Meanwhile, watch the sky through the open ";
    var a = document.createElement("a");
    a.href = "https://network.satnogs.org/";
    a.target = "_blank"; a.rel = "noopener";
    a.textContent = "SatNOGS network →";
    elStatus.appendChild(a);
  }

  function srcNote(cache){
    var days = Math.floor((Date.now() - cache.t) / 86400000);
    var age = days >= 2 ? " · elements " + days + " days old — times approximate" : "";
    if (cache.src === "baked")
      return "Offline — using the bundled element set" + age + ".";
    return "Orbital elements: CelesTrak GP" + (cache.src === "cache" ? " (cached)" : "") + age + ".";
  }

  function start(cache){
    var rows = computeRows(cache);
    if (!rows.length){ showError(); return; }
    elStatus.hidden = true;
    elWrap.hidden = false;
    elNext.hidden = false;
    elFoot.hidden = false;
    elFoot.textContent = "Computed in your browser — SGP4 propagation over station " +
      "30.77°N 76.57°E · passes reaching ≥" + MIN_EL + "° above the horizon · " +
      "AOS/LOS = acquisition/loss of signal · times IST (UTC+5:30). " + srcNote(cache);
    renderRows(rows);

    var iv;
    function tick(){
      if (document.hidden) return;
      var now = Date.now(), shifted = false;
      while (rows.length && rows[0].p.los <= now){ rows.shift(); shifted = true; }
      if (rows.length < 3){ rows = computeRows(cache); shifted = true; }
      if (shifted){
        renderRows(rows);
        if (!rows.length){ elNext.hidden = true; clearInterval(iv); return; }
      }
      var nx = rows[0];
      elNextSat.textContent = nx.m.name;
      if (nx.p.aos <= now){
        elNextT.textContent = reduce ? "IN PROGRESS · LOS " + fmtIST(nx.p.los) + " IST"
                                     : "IN PROGRESS · LOS T–" + mmss(nx.p.los - now);
        elNext.classList.add("live");
      } else {
        elNextT.textContent = reduce ? "AOS " + fmtIST(nx.p.aos) + " IST"
                                     : "T–" + hhmmss(nx.p.aos - now);
        elNext.classList.remove("live");
      }
    }
    tick();
    iv = setInterval(tick, reduce ? 60000 : 1000);
    document.addEventListener("visibilitychange", function(){ if (!document.hidden) tick(); });
    addEventListener("pagehide", function(){ clearInterval(iv); });
  }

  getElements().then(function(cache){
    // timeout is load-bearing: the starfield's rAF loop can keep the main
    // thread busy enough that an idle callback without one never runs
    if ("requestIdleCallback" in window) requestIdleCallback(function(){ start(cache); }, {timeout: 2000});
    else setTimeout(function(){ start(cache); }, 1);
  });
})();
