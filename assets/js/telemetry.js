/* Live telemetry page.
 *
 * The ESP32 ground station publishes each LoRa frame it decodes as JSON to a
 * public MQTT broker; this page subscribes over a secure WebSocket (GitHub
 * Pages is HTTPS, so it can't poll the ESP32's own http://192.168.4.1).
 * Anyone can publish to a public broker, so every field is range-checked and
 * only ever written with textContent.
 *
 * Add ?demo to the URL to run on synthetic frames without the hardware.
 */
(function () {
  'use strict';

  var BROKER_URL = 'wss://broker.hivemq.com:8884/mqtt';
  // Must match TOPIC_BASE in ESP32_LoRa_Receiver.ino
  var TOPIC_BASE = 'kcc-cu/node01-29e8ea47';
  var WINDOW_MS = 120000;   // charts show the last two minutes
  var LIVE_MS = 5000;       // a frame newer than this counts as "live"
  var GAP_MS = 3000;        // break the line when frames are further apart
  var MAX_FRAMES = 1200;

  var frames = [];          // live frames, oldest first
  var latest = null;        // newest frame, live or retained
  var lastSeenAt = 0;       // epoch ms of `latest` (0 = unknown)
  var relay = 'connecting'; // connecting | connected | error | demo
  var station = null;       // 'online' | 'offline' | null (never heard)
  var session = { count: 0, firstSeq: null, lastSeq: null, received: 0 };

  var $ = function (id) { return document.getElementById(id); };

  function num(v, lo, hi) {
    v = Number(v);
    return (Number.isFinite(v) && v >= lo && v <= hi) ? v : null;
  }

  function parseFrame(text) {
    var d;
    try { d = JSON.parse(text); } catch (e) { return null; }
    if (!d || typeof d !== 'object') return null;
    var f = {
      seq: num(d.seq, 0, 4294967295),
      temp: num(d.temp, -40, 85),
      hum: num(d.hum, 0, 100),
      ldr: num(d.ldr, 0, 4095),
      ax: num(d.accelx, -16, 16),
      ay: num(d.accely, -16, 16),
      az: num(d.accelz, -16, 16),
      rssi: num(d.rssi, -160, 20),
      snr: num(d.snr, -40, 40),
      ts: num(d.ts, 0, 1e14) || 0,
      raw: typeof d.raw === 'string' ? d.raw.slice(0, 160) : ''
    };
    // The ESP32 reports 0/0 until the DHT11 has produced a reading.
    if (f.temp === 0 && f.hum === 0) f.temp = f.hum = null;
    return f;
  }

  /* ---------- incoming data ---------- */

  function onTelemetry(f, retained) {
    latest = f;
    if (retained) {
      // Replayed by the broker on subscribe: may be hours old, so it fills
      // the tiles but stays off the charts.
      lastSeenAt = f.ts;
    } else {
      f.t = Date.now();
      lastSeenAt = f.t;
      frames.push(f);
      if (frames.length > MAX_FRAMES) frames.splice(0, frames.length - MAX_FRAMES);
      countSeq(f);
      renderTable();
    }
    renderTiles(retained);
    $('tm-raw').textContent = f.raw || '—';
    scheduleCharts();
    renderStatus();
  }

  function countSeq(f) {
    session.count++;
    if (f.seq === null) return;
    // A lower sequence number means the node rebooted: start counting afresh.
    if (session.lastSeq === null || f.seq <= session.lastSeq) {
      session.firstSeq = f.seq;
      session.received = 0;
    }
    session.lastSeq = f.seq;
    session.received++;
  }

  /* ---------- status line ---------- */

  function ago(ms) {
    if (ms < 0) ms = 0;
    var s = ms / 1000;
    if (s < 10) return s.toFixed(1) + ' s ago';
    if (s < 90) return Math.round(s) + ' s ago';
    if (s < 5400) return Math.round(s / 60) + ' min ago';
    if (s < 172800) return Math.round(s / 3600) + ' h ago';
    return Math.round(s / 86400) + ' days ago';
  }

  function setPill(state, text, detail) {
    var pill = $('tm-pill');
    if (pill.getAttribute('data-state') !== state) pill.setAttribute('data-state', state);
    if ($('tm-pill-text').textContent !== text) $('tm-pill-text').textContent = text;
    $('tm-status-detail').textContent = detail;
  }

  function renderStatus() {
    var now = Date.now();
    var fresh = frames.length && now - frames[frames.length - 1].t < LIVE_MS;
    var seen = lastSeenAt ? 'Last frame ' + ago(now - lastSeenAt) : 'No frames received yet';
    if (latest) {
      document.querySelectorAll('.tm-tile:not([data-k="pkts"])').forEach(function (t) {
        t.classList.toggle('is-stale', !fresh);
      });
    }

    if (relay === 'demo') {
      setPill('waiting', 'Demo data', 'Synthetic frames generated in your browser — remove ?demo for the live feed');
    } else if (relay === 'error') {
      setPill('error', 'Relay unreachable', 'Can’t reach the MQTT relay; retrying. ' + seen + '.');
    } else if (relay === 'connecting') {
      setPill('connecting', 'Connecting', 'Connecting to the relay…');
    } else if (fresh) {
      var n = 0;
      for (var i = frames.length - 1; i >= 0 && now - frames[i].t < 5000; i--) n++;
      setPill('live', 'Live', seen + ' · ' + (n / 5).toFixed(1) + ' frames/s');
    } else if (station === 'offline') {
      setPill('offline', 'Station offline', 'The ground station is not connected. ' + seen + '.');
    } else if (lastSeenAt || station === 'online') {
      setPill('stale', 'No signal', 'Ground station ' + (station === 'online' ? 'online' : 'last heard') +
        ', but the node is silent. ' + seen + '.');
    } else {
      setPill('waiting', 'Waiting', 'Connected to the relay; the ground station hasn’t reported yet.');
    }
  }

  /* ---------- tiles ---------- */

  function fmt(v, dp) { return v === null ? null : v.toFixed(dp).replace('-', '−'); }

  function setTile(key, value, unit, sub, stale) {
    var tile = document.querySelector('.tm-tile[data-k="' + key + '"]');
    var val = tile.querySelector('.val');
    val.textContent = value === null ? '—' : value;
    if (value !== null && unit) {
      var small = document.createElement('small');
      small.textContent = unit;
      val.appendChild(small);
    }
    if (sub !== undefined) tile.querySelector('.sub').textContent = sub;
    tile.classList.toggle('is-stale', !!stale);
  }

  function renderTiles(stale) {
    var f = latest;
    if (!f) return;
    setTile('temp', fmt(f.temp, 1), '°C', f.temp === null ? 'No reading from DHT11' : 'DHT11', stale);
    setTile('hum', fmt(f.hum, 0), '%', f.hum === null ? 'No reading from DHT11' : 'DHT11', stale);
    setTile('ldr', f.ldr === null ? null : String(f.ldr), '',
      f.ldr === null ? 'LDR, 12-bit ADC' : Math.round(f.ldr / 40.95) + '% of full scale', stale);
    setTile('acc', fmt(f.az, 2), 'g',
      f.ax === null ? 'MPU6050 not reporting' : 'X ' + fmt(f.ax, 2) + ' · Y ' + fmt(f.ay, 2), stale);
    setTile('rssi', f.rssi === null ? null : fmt(f.rssi, 0), 'dBm',
      f.snr === null ? 'LoRa 440 MHz, SF7' : 'SNR ' + fmt(f.snr, 1) + ' dB', stale);

    var sub;
    if (session.firstSeq === null) sub = session.count ? 'Sequence numbers unavailable' : ' ';
    else {
      var expected = session.lastSeq - session.firstSeq + 1;
      var lost = expected - session.received;
      sub = lost + ' lost (' + (100 * lost / expected).toFixed(1) + '%)';
    }
    setTile('pkts', session.count.toLocaleString('en-IN'), '', sub, false);
  }

  /* ---------- table ---------- */

  function renderTable() {
    var tb = $('tm-rows');
    var rows = frames.slice(-12).reverse();
    var frag = document.createDocumentFragment();
    rows.forEach(function (f) {
      var tr = document.createElement('tr');
      [f.seq === null ? '—' : String(f.seq),
       new Date(f.t).toLocaleTimeString('en-GB'),
       fmt(f.temp, 1), fmt(f.hum, 0), f.ldr === null ? null : String(f.ldr),
       fmt(f.ax, 2), fmt(f.ay, 2), fmt(f.az, 2),
       f.rssi === null ? null : fmt(f.rssi, 0) + ' dBm',
       f.snr === null ? null : fmt(f.snr, 1) + ' dB'
      ].forEach(function (c) {
        var td = document.createElement('td');
        td.textContent = c === null ? '—' : c;
        tr.appendChild(td);
      });
      frag.appendChild(tr);
    });
    tb.textContent = '';
    tb.appendChild(frag);
  }

  /* ---------- charts ---------- */

  var SVGNS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, parent) {
    var n = document.createElementNS(SVGNS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function niceStep(span, count) {
    var raw = span / count, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var r = raw / mag;
    return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * mag;
  }

  function Chart(id, series, opts) {
    this.box = $(id);
    this.series = series;
    this.opts = opts;
    this.hoverX = null;
    this.focusIdx = null;
    this.box.tabIndex = 0;
    this.box.setAttribute('role', 'img');
    this.box.setAttribute('aria-label', opts.name + ' over the last two minutes. Use left and right arrow keys to read values.');
    this.tip = document.createElement('div');
    this.tip.className = 'tm-tip';
    this.tip.hidden = true;
    this.empty = document.createElement('div');
    this.empty.className = 'tm-empty';
    this.empty.textContent = 'Waiting for live frames';
    this.box.appendChild(this.empty);
    this.box.appendChild(this.tip);

    var self = this;
    this.box.addEventListener('pointermove', function (e) {
      self.hoverX = e.clientX - self.box.getBoundingClientRect().left;
      self.focusIdx = null;
      self.render();
    });
    this.box.addEventListener('pointerleave', function () { self.hoverX = null; self.render(); });
    this.box.addEventListener('blur', function () { self.focusIdx = null; self.render(); });
    this.box.addEventListener('keydown', function (e) {
      var n = self.pts ? self.pts.length : 0;
      if (!n || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      e.preventDefault();
      if (self.focusIdx === null) self.focusIdx = n - 1;
      else self.focusIdx = Math.max(0, Math.min(n - 1, self.focusIdx + (e.key === 'ArrowLeft' ? -1 : 1)));
      self.hoverX = null;
      self.render();
    });
  }

  Chart.prototype.render = function () {
    var box = this.box, o = this.opts, series = this.series;
    var W = box.clientWidth, H = box.clientHeight;
    if (!W || !H) return;
    var now = Date.now(), t0 = now - WINDOW_MS;
    var m = { l: 46, r: 10, t: 8, b: 22 };
    var pw = W - m.l - m.r, ph = H - m.t - m.b;

    var pts = frames.filter(function (f) {
      if (f.t < t0) return false;
      for (var i = 0; i < series.length; i++) if (f[series[i].key] !== null) return true;
      return false;
    });
    this.pts = pts;

    var lo = Infinity, hi = -Infinity;
    pts.forEach(function (f) {
      series.forEach(function (s) {
        var v = f[s.key];
        if (v !== null) { if (v < lo) lo = v; if (v > hi) hi = v; }
      });
    });
    if (!pts.length) { lo = o.empty[0]; hi = o.empty[1]; }
    if (hi - lo < o.minSpan) { var mid = (hi + lo) / 2; lo = mid - o.minSpan / 2; hi = mid + o.minSpan / 2; }
    var step = niceStep(hi - lo, 4);
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil(hi / step) * step;
    if (o.clamp) { lo = Math.max(lo, o.clamp[0]); hi = Math.min(hi, o.clamp[1]); }

    var x = function (t) { return m.l + (t - t0) / WINDOW_MS * pw; };
    var y = function (v) { return m.t + (1 - (v - lo) / (hi - lo)) * ph; };

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true' });
    var grid = el('g', { 'class': 'grid' }, svg), axis = el('g', { 'class': 'axis' }, svg);
    var dp = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    for (var v = lo; v <= hi + step / 2; v += step) {
      el('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }, grid);
      var tx = el('text', { x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, axis);
      tx.textContent = v.toFixed(dp).replace('-', '−');
    }
    [[-120, '−2 min'], [-90, '−90 s'], [-60, '−60 s'], [-30, '−30 s'], [0, 'now']].forEach(function (p, i, a) {
      var t = el('text', { x: x(now + p[0] * 1000), y: H - 4,
        'text-anchor': i === 0 ? 'start' : i === a.length - 1 ? 'end' : 'middle' }, axis);
      t.textContent = p[1];
    });

    series.forEach(function (s) {
      var d = '', prev = null;
      pts.forEach(function (f) {
        var v = f[s.key];
        if (v === null) { prev = null; return; }
        d += (prev && f.t - prev.t <= GAP_MS ? 'L' : 'M') + x(f.t).toFixed(1) + ' ' + y(v).toFixed(1);
        prev = f;
      });
      if (d) el('path', { d: d, 'class': 'ln', stroke: s.color }, svg);
    });

    // End dots on the newest frame
    var last = pts[pts.length - 1];
    if (last && now - last.t < LIVE_MS) {
      series.forEach(function (s) {
        if (last[s.key] !== null) el('circle', { cx: x(last.t), cy: y(last[s.key]), r: 4, fill: s.color, 'class': 'dot' }, svg);
      });
    }

    // Crosshair + tooltip
    var sel = null;
    if (this.focusIdx !== null && pts.length) sel = pts[Math.min(this.focusIdx, pts.length - 1)];
    else if (this.hoverX !== null && pts.length) {
      var th = t0 + (this.hoverX - m.l) / pw * WINDOW_MS, best = Infinity;
      pts.forEach(function (f) { var dd = Math.abs(f.t - th); if (dd < best) { best = dd; sel = f; } });
    }
    if (sel) {
      var sx = x(sel.t);
      el('line', { x1: sx, x2: sx, y1: m.t, y2: m.t + ph, 'class': 'xh' }, svg);
      var topY = Infinity;
      series.forEach(function (s) {
        if (sel[s.key] === null) return;
        var cy = y(sel[s.key]);
        topY = Math.min(topY, cy);
        el('circle', { cx: sx, cy: cy, r: 4, fill: s.color, 'class': 'dot' }, svg);
      });
      this.fillTip(sel);
      this.tip.hidden = false;
      var tw = this.tip.offsetWidth;
      this.tip.style.left = Math.max(tw / 2, Math.min(W - tw / 2, sx)) + 'px';
      this.tip.style.top = Math.max(this.tip.offsetHeight, (topY === Infinity ? m.t : topY) - 10) + 'px';
    } else {
      this.tip.hidden = true;
    }

    if (this.svg) box.replaceChild(svg, this.svg); else box.insertBefore(svg, this.empty);
    this.svg = svg;
    this.empty.hidden = pts.length > 0;
  };

  Chart.prototype.fillTip = function (f) {
    var tip = this.tip, o = this.opts;
    tip.textContent = '';
    this.series.forEach(function (s) {
      if (f[s.key] === null) return;
      var row = document.createElement('div');
      if (this.series.length > 1) {
        var k = document.createElement('span');
        k.className = 'k';
        k.style.background = s.color;
        row.appendChild(k);
      }
      var b = document.createElement('b');
      b.textContent = fmt(f[s.key], o.dp) + (o.unit ? ' ' + o.unit : '');
      row.appendChild(b);
      if (this.series.length > 1) row.appendChild(document.createTextNode(' ' + s.label));
      tip.appendChild(row);
    }, this);
    var t = document.createElement('div');
    t.className = 't';
    t.textContent = new Date(f.t).toLocaleTimeString('en-GB') + (f.seq !== null ? ' · #' + f.seq : '');
    tip.appendChild(t);
  };

  var css = getComputedStyle(document.querySelector('.tm-root'));
  var c1 = css.getPropertyValue('--series-1').trim(),
      c2 = css.getPropertyValue('--series-2').trim(),
      c3 = css.getPropertyValue('--series-3').trim();

  var charts = [
    new Chart('ch-acc', [{ key: 'ax', color: c1, label: 'X' }, { key: 'ay', color: c2, label: 'Y' }, { key: 'az', color: c3, label: 'Z' }],
      { name: 'Acceleration in g', unit: 'g', dp: 2, minSpan: 0.5, empty: [-1, 1] }),
    new Chart('ch-ldr', [{ key: 'ldr', color: c1, label: 'Light' }],
      { name: 'Light level in ADC counts', unit: '', dp: 0, minSpan: 100, empty: [0, 4095], clamp: [0, 4095] }),
    new Chart('ch-rssi', [{ key: 'rssi', color: c1, label: 'RSSI' }],
      { name: 'Signal strength in dBm', unit: 'dBm', dp: 0, minSpan: 10, empty: [-120, -40] }),
    new Chart('ch-temp', [{ key: 'temp', color: c1, label: 'Temperature' }],
      { name: 'Temperature in degrees Celsius', unit: '°C', dp: 1, minSpan: 2, empty: [20, 30] }),
    new Chart('ch-hum', [{ key: 'hum', color: c1, label: 'Humidity' }],
      { name: 'Relative humidity in percent', unit: '%', dp: 0, minSpan: 5, empty: [30, 70], clamp: [0, 100] })
  ];

  var pending = false;
  function scheduleCharts() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      charts.forEach(function (c) { c.render(); });
    });
  }

  // Keep the time axis sliding and the "x s ago" text honest between frames.
  setInterval(function () { renderStatus(); scheduleCharts(); }, 1000);
  window.addEventListener('resize', scheduleCharts);
  scheduleCharts();

  /* ---------- sources ---------- */

  function startDemo() {
    relay = 'demo';
    var seq = 0, temp = 27.4, hum = 58;
    setInterval(function () {
      var s = Date.now() / 1000;
      if (seq % 8 === 0) { temp += (Math.random() - 0.5) * 0.2; hum += (Math.random() - 0.5) * 0.6; }
      if (Math.random() < 0.03) seq++; // the odd lost packet
      var ax = 0.05 * Math.sin(s / 3), ay = 0.04 * Math.cos(s / 4), az = 0.98 + 0.03 * Math.sin(s * 1.7);
      var ldr = Math.round(2100 + 900 * Math.sin(s / 20) + (Math.random() - 0.5) * 60);
      var d = {
        seq: seq++, temp: +temp.toFixed(2), hum: +hum.toFixed(2), ldr: ldr,
        accelx: +ax.toFixed(2), accely: +ay.toFixed(2), accelz: +az.toFixed(2),
        rssi: Math.round(-58 + (Math.random() - 0.5) * 6), snr: +(9 + Math.random()).toFixed(1), ts: Date.now()
      };
      d.raw = 'Temp:' + d.temp + ' Hum:' + d.hum + ' LDR:' + d.ldr + ' AccelX:' + d.accelx +
        ' AccelY:' + d.accely + ' AccelZ:' + d.accelz + ' Seq:' + d.seq;
      onTelemetry(parseFrame(JSON.stringify(d)), false);
    }, 250);
    renderStatus();
  }

  function startLive() {
    if (!window.mqtt) {
      relay = 'error';
      renderStatus();
      $('tm-status-detail').textContent = 'The MQTT client library failed to load, so the live feed can’t start.';
      return;
    }
    var client = window.mqtt.connect(BROKER_URL, {
      clientId: 'kcc-web-' + Math.random().toString(16).slice(2, 10),
      clean: true, keepalive: 30, reconnectPeriod: 5000, connectTimeout: 10000
    });
    client.on('connect', function () {
      relay = 'connected';
      client.subscribe(TOPIC_BASE + '/#', { qos: 0 });
      renderStatus();
    });
    client.on('reconnect', function () { if (relay !== 'error') relay = 'connecting'; renderStatus(); });
    client.on('offline', function () { relay = 'error'; renderStatus(); });
    client.on('error', function () { relay = 'error'; renderStatus(); });
    client.on('message', function (topic, payload, packet) {
      var text = payload.toString();
      if (topic === TOPIC_BASE + '/status') {
        station = text === 'online' ? 'online' : text === 'offline' ? 'offline' : null;
        renderStatus();
      } else if (topic === TOPIC_BASE + '/telemetry') {
        var f = parseFrame(text);
        if (f) onTelemetry(f, !!packet.retain);
      }
    });
  }

  if (new URLSearchParams(location.search).has('demo')) startDemo(); else startLive();
})();
