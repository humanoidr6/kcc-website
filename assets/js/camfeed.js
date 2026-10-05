/* KCC CAM-01 imaging panel.
 *
 * Live 160x120 grayscale video from an OV7670 on a Teensy 4.1, sent over an
 * SX1278 FSK link to a second Teensy at the ground station, then relayed by
 * web_bridge.py (teensy-lora-video repo) through the same public MQTT broker
 * the telemetry console uses. Separate topic and client, so the telemetry
 * console above is untouched.
 *
 * Anyone can publish to a public broker: frames must be exactly the expected
 * size with the right header, stats are range-checked, and text is only ever
 * written with textContent.
 *
 * Add ?demo to the URL to run on synthetic frames without the hardware.
 */
(function () {
  'use strict';

  var BROKER_URL = 'wss://broker.hivemq.com:8884/mqtt';
  // Must match TOPIC_BASE in web_bridge.py
  var TOPIC_BASE = 'kcc-cu/cam01-040d37e7';
  var W = 160, H = 120, FRAME_BYTES = W * H / 2;
  var MAGIC = [0x4B, 0x43, 0x56, 0x31];   // "KCV1"
  var LIVE_MS = 5000;

  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('cam-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var img = ctx.createImageData(W, H);
  var lastFrameAt = 0;       // local ms of the newest live frame
  var lastStatsTs = 0;       // epoch ms from the bridge
  var bridge = null;         // 'online' | 'offline' | null
  var relay = 'connecting';  // connecting | connected | error | demo

  function num(v, lo, hi) {
    v = Number(v);
    return (Number.isFinite(v) && v >= lo && v <= hi) ? v : null;
  }

  // Grayscale rendered as green phosphor to match the console's CRTs.
  function draw(bytes, offset) {
    var d = img.data;
    for (var i = 0; i < FRAME_BYTES; i++) {
      var b = bytes[offset + i];
      var p = i * 8;
      var v1 = (b >> 4) * 17, v2 = (b & 15) * 17;
      d[p] = v1 * 0.35; d[p + 1] = v1; d[p + 2] = v1 * 0.35; d[p + 3] = 255;
      d[p + 4] = v2 * 0.35; d[p + 5] = v2; d[p + 6] = v2 * 0.35; d[p + 7] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  function onFrame(payload, retained) {
    if (!payload || payload.length !== MAGIC.length + FRAME_BYTES) return;
    for (var i = 0; i < MAGIC.length; i++) if (payload[i] !== MAGIC[i]) return;
    draw(payload, MAGIC.length);
    if (!retained) lastFrameAt = Date.now();
    refresh();
  }

  function onStats(text) {
    var s;
    try { s = JSON.parse(text); } catch (e) { return; }
    if (!s || typeof s !== 'object') return;
    var fps = num(s.fps, 0, 100), pps = num(s.pps, 0, 10000), kbps = num(s.kbps, 0, 10000);
    var loss = num(s.loss, 0, 100), rssi = num(s.rssi, -160, 20), ts = num(s.ts, 0, 1e14);
    $('cam-fps').textContent = fps === null ? '--' : fps.toFixed(1);
    $('cam-pps').textContent = pps === null ? '--' : String(pps);
    $('cam-kbps').textContent = kbps === null ? '--' : kbps.toFixed(1);
    $('cam-loss').textContent = loss === null ? '--' : loss.toFixed(1) + ' %';
    $('cam-rssi').textContent = rssi === null ? '--' : rssi + ' dBm';
    if (ts) lastStatsTs = ts;
    refresh();
  }

  function refresh() {
    var live = Date.now() - lastFrameAt < LIVE_MS;
    $('cam-nosig').hidden = live;
    if (!live && lastStatsTs) {
      $('cam-nosig').textContent = 'NO SIGNAL — LAST ' + new Date(lastStatsTs).toLocaleTimeString();
    }
    $('lamp-cam-carrier').className = 'lamp' + (live ? ' green-on' : '');
    $('lamp-cam-bridge').className = 'lamp' + (bridge === 'online' ? ' green-on' : bridge === 'offline' ? ' red-on' : '');
    var link = relay === 'demo' ? 'DEMO MODE'
      : relay === 'connecting' ? 'CONNECTING'
      : relay === 'error' ? 'RELAY ERROR'
      : live ? 'LIVE'
      : bridge === 'offline' ? 'GROUND STN OFFLINE' : 'AWAITING VIDEO';
    $('cam-link').textContent = link;
  }

  function startDemo() {
    relay = 'demo';
    bridge = 'online';
    var t = 0, buf = new Uint8Array(MAGIC.length + FRAME_BYTES);
    buf.set(MAGIC);
    setInterval(function () {
      t += 0.15;
      for (var y = 0; y < H; y++) {
        for (var x = 0; x < W; x += 2) {
          var v = function (xx) {
            var r = Math.hypot(xx - 80 - 40 * Math.cos(t), y - 60 - 25 * Math.sin(t));
            return Math.max(0, Math.min(15, Math.round(8 + 7 * Math.cos(r / 6 - t * 2))));
          };
          buf[MAGIC.length + (y * W + x) / 2] = (v(x) << 4) | v(x + 1);
        }
      }
      onFrame(buf, false);
      onStats(JSON.stringify({ fps: 4, pps: 380, kbps: 185, loss: 0.4, rssi: -64, ts: Date.now() }));
    }, 250);
  }

  if (/[?&]demo\b/.test(location.search)) {
    startDemo();
  } else if (typeof mqtt === 'undefined') {
    relay = 'error';
  } else {
    var client = mqtt.connect(BROKER_URL, {
      clientId: 'kcc-cam-web-' + Math.random().toString(16).slice(2, 10),
      reconnectPeriod: 5000,
      connectTimeout: 10000
    });
    client.on('connect', function () {
      relay = 'connected';
      client.subscribe(TOPIC_BASE + '/#', { qos: 0 });
      refresh();
    });
    client.on('error', function () { relay = 'error'; refresh(); });
    client.on('offline', function () { relay = 'connecting'; refresh(); });
    client.on('message', function (topic, payload, packet) {
      if (topic === TOPIC_BASE + '/frame') {
        onFrame(payload, packet && packet.retain);
      } else if (topic === TOPIC_BASE + '/stats') {
        onStats(payload.toString());
      } else if (topic === TOPIC_BASE + '/status') {
        var s = payload.toString();
        bridge = s === 'online' ? 'online' : s === 'offline' ? 'offline' : bridge;
        refresh();
      }
    });
  }
  setInterval(refresh, 1000);
  refresh();
})();
