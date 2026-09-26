/* KCC telemetry console, website edition.
 *
 * Same console as the ESP32's local page (http://192.168.4.1), but fed from
 * the public MQTT broker the ESP32 publishes to, since an HTTPS site can't
 * poll the ESP32 directly. Anyone can publish to a public broker, so every
 * field is range-checked and only ever written with textContent.
 *
 * Add ?demo to the URL to run on synthetic frames without the hardware.
 */
(function () {
  'use strict';

  var BROKER_URL = 'wss://broker.hivemq.com:8884/mqtt';
  // Must match TOPIC_BASE in ESP32_LoRa_Receiver.ino
  var TOPIC_BASE = 'kcc-cu/node01-29e8ea47';
  var LIVE_MS = 5000;

  var $ = function (id) { return document.getElementById(id); };
  var terminal = $('terminal');
  var rxTimer = null;
  var relay = 'connecting';   // connecting | connected | error | demo
  var station = null;         // 'online' | 'offline' | null
  var lastLiveAt = 0;         // local ms of the newest live frame
  var lastSeenAt = 0;         // epoch ms of the newest frame, live or retained
  var liveTimes = [];

  function num(v, lo, hi) {
    v = Number(v);
    return (Number.isFinite(v) && v >= lo && v <= hi) ? v : null;
  }

  function parseFrame(text) {
    var d;
    try { d = JSON.parse(text); } catch (e) { return null; }
    if (!d || typeof d !== 'object') return null;
    return {
      pkts: num(d.pkts, 0, 1e12),
      temp: num(d.temp, -40, 85),
      hum: num(d.hum, 0, 100),
      ldr: num(d.ldr, 0, 4095),
      ax: num(d.accelx, -16, 16),
      ay: num(d.accely, -16, 16),
      az: num(d.accelz, -16, 16),
      rssi: num(d.rssi, -160, 20),
      ts: num(d.ts, 0, 1e14) || 0,
      raw: typeof d.raw === 'string' ? d.raw.slice(0, 160) : ''
    };
  }

  function updateNeedle(id, val, maxVal) {
    var norm = (val === null ? 0 : val) / maxVal;
    if (norm > 1) norm = 1;
    if (norm < -1) norm = -1;
    $('ndl-' + id).style.left = ((norm + 1) * 50) + '%';
  }

  function sensorValue(id, v) {
    var el = $(id);
    // The ESP32 reports 0.00 until the DHT11 has produced a reading.
    var bad = v === null || v.toFixed(2) === '0.00';
    el.textContent = bad ? 'SENSOR ERR' : v.toFixed(2).padStart(5, '0');
    el.className = bad ? 'alert-red' : '';
  }

  var chart = null;
  try {
    chart = new Chart($('miniChart').getContext('2d'), {
      type: 'line',
      data: { labels: [], datasets: [{ label: 'LDR', borderColor: '#33ff33', data: [], pointRadius: 0, borderWidth: 2 }] },
      options: { animation: false, scales: { x: { display: false }, y: { display: false } }, plugins: { legend: { display: false } } }
    });
  } catch (e) {
    console.log('Chart.js failed to load');
  }

  function logLine(text) {
    var standby = terminal.querySelector('.standby');
    if (standby) standby.remove();
    var entry = document.createElement('div');
    entry.className = 'hex-line';
    entry.textContent = text;
    terminal.appendChild(entry);
    while (terminal.children.length > 20) terminal.removeChild(terminal.firstChild);
    terminal.scrollTop = terminal.scrollHeight;
  }

  function onFrame(f, retained) {
    if (f.pkts !== null) $('val-pkt').textContent = String(f.pkts).padStart(5, '0');
    sensorValue('val-temp', f.temp);
    sensorValue('val-hum', f.hum);
    $('val-ldr').textContent = f.ldr === null ? 'AWAITING' : String(f.ldr);
    $('val-rssi').textContent = (f.rssi === null ? 0 : f.rssi) + ' dBm';
    updateNeedle('ax', f.ax, 2.0);
    updateNeedle('ay', f.ay, 2.0);
    updateNeedle('az', f.az, 2.0);

    if (retained) {
      // Replayed by the broker on subscribe; may be hours old.
      lastSeenAt = f.ts;
      logLine('[LAST] ' + f.raw);
    } else {
      lastLiveAt = lastSeenAt = Date.now();
      liveTimes.push(lastLiveAt);
      $('lamp-lock').className = 'lamp green-on';
      clearTimeout(rxTimer);
      rxTimer = setTimeout(function () { $('lamp-lock').className = 'lamp'; }, 80);

      if (chart && f.ldr !== null) {
        if (chart.data.labels.length > 50) {
          chart.data.labels.shift();
          chart.data.datasets[0].data.shift();
        }
        chart.data.labels.push('');
        chart.data.datasets[0].data.push(f.ldr);
        chart.update();
      }
      logLine('[RX] ' + f.raw);
    }
    renderLink();
  }

  function ago(ms) {
    var s = Math.max(0, ms) / 1000;
    if (s < 90) return Math.round(s) + 'S AGO';
    if (s < 5400) return Math.round(s / 60) + 'MIN AGO';
    if (s < 172800) return Math.round(s / 3600) + 'H AGO';
    return Math.round(s / 86400) + 'D AGO';
  }

  function setLink(text, cls, carrierOk) {
    var el = $('val-link');
    if (el.textContent !== text) el.textContent = text;
    el.className = cls;
    $('lamp-rx').className = carrierOk ? 'lamp green-on' : 'lamp red-on';
  }

  function renderLink() {
    var now = Date.now();
    while (liveTimes.length && now - liveTimes[0] > 5000) liveTimes.shift();
    var fresh = lastLiveAt && now - lastLiveAt < LIVE_MS;
    var last = lastSeenAt ? ' / LAST ' + ago(now - lastSeenAt) : '';

    if (relay === 'demo') setLink('DEMO DATA', 'data-label', true);
    else if (relay === 'error') setLink('RELAY DOWN - RETRYING' + last, 'alert-red', false);
    else if (relay === 'connecting') setLink('CONNECTING', 'data-label', false);
    else if (fresh) setLink('LIVE ' + (liveTimes.length / 5).toFixed(1) + ' FPS', '', true);
    else if (station === 'offline') setLink('STATION OFFLINE' + last, 'alert-red', false);
    else if (lastSeenAt || station === 'online') setLink('NO SIGNAL FROM NODE' + last, 'alert-red', false);
    else setLink('AWAITING STATION', 'data-label', false);
  }

  setInterval(renderLink, 1000);

  function startDemo() {
    relay = 'demo';
    var pkts = 0, temp = 24.8, hum = 51.0;
    setInterval(function () {
      var s = Date.now() / 1000;
      if (pkts % 8 === 0) { temp += (Math.random() - 0.5) * 0.2; hum += (Math.random() - 0.5) * 0.6; }
      var d = {
        pkts: ++pkts, temp: +temp.toFixed(2), hum: +hum.toFixed(2),
        ldr: Math.round(1150 + 400 * Math.sin(s / 10) + (Math.random() - 0.5) * 60),
        accelx: +(0.3 * Math.sin(s / 3)).toFixed(2), accely: +(-0.9 + 0.05 * Math.cos(s / 4)).toFixed(2),
        accelz: +(0.45 + 0.05 * Math.sin(s * 1.7)).toFixed(2), rssi: Math.round(-68 + (Math.random() - 0.5) * 6)
      };
      d.raw = 'Temp:' + d.temp.toFixed(2) + ' Hum:' + d.hum.toFixed(2) + ' LDR:' + d.ldr + ' AccelX:' + d.accelx.toFixed(2) +
        ' AccelY:' + d.accely.toFixed(2) + ' AccelZ:' + d.accelz.toFixed(2) + ' Seq:' + pkts;
      onFrame(parseFrame(JSON.stringify(d)), false);
    }, 250);
  }

  function startLive() {
    if (!window.mqtt) {
      relay = 'error';
      renderLink();
      return;
    }
    var client = window.mqtt.connect(BROKER_URL, {
      clientId: 'kcc-web-' + Math.random().toString(16).slice(2, 10),
      clean: true, keepalive: 30, reconnectPeriod: 5000, connectTimeout: 10000
    });
    client.on('connect', function () {
      relay = 'connected';
      client.subscribe(TOPIC_BASE + '/#', { qos: 0 });
      renderLink();
    });
    client.on('reconnect', function () { if (relay !== 'error') relay = 'connecting'; renderLink(); });
    client.on('offline', function () { relay = 'error'; renderLink(); });
    client.on('error', function () { relay = 'error'; renderLink(); });
    client.on('message', function (topic, payload, packet) {
      var text = payload.toString();
      if (topic === TOPIC_BASE + '/status') {
        station = text === 'online' ? 'online' : text === 'offline' ? 'offline' : null;
        renderLink();
      } else if (topic === TOPIC_BASE + '/telemetry') {
        var f = parseFrame(text);
        if (f) onFrame(f, !!packet.retain);
      }
    });
  }

  renderLink();
  if (new URLSearchParams(location.search).has('demo')) startDemo(); else startLive();
})();
