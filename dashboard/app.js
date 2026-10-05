// KCC ground-station dashboard: UI from github.com/mahamatkher/6U_Dashboard,
// fed live from the same public MQTT broker and topics as telemetry.html.
//
//   1U · KCC-NODE-01  kcc-cu/node01-29e8ea47/{telemetry,status}   DHT11, LDR, MPU6050 (via the ESP32); no camera
//   6U · KCC-NODE-06  kcc-cu/cam01-040d37e7/{frame,stats,status}  OV7670 camera (via the same ESP32)
//   6U · KCC-NODE-06  kcc-cu/node06-48de3288/telemetry            DHT11, light, MPU-9250, BMP280 (via the ESP32)
//                     kcc-cu/node06-48de3288/cmd                  signed motor commands (6U motor node not built yet)
//                     kcc-cu/node06-48de3288/motors               motor readback, when the 6U node exists
//   Neither craft carries GPS, so there is no tracking card. The 6U solar reading is
//   simulated (16–19 V) by request, because no panel is fitted; it is captioned as such.
//                     6U sensors/power are planned and show as "awaiting" until they exist.
//
// Only real data is shown: sensors a craft doesn't carry say "not fitted" rather than
// showing invented numbers. Anyone can publish to a public broker, so every field is
// range-checked and text is only ever written with textContent.
// Add ?demo to the URL for clearly-labelled simulated data (UI preview only).

// ==========================================
// CONFIG
// ==========================================
const BROKER_URL        = 'wss://broker.hivemq.com:8884/mqtt';
const TOPIC_1U          = 'kcc-cu/node01-29e8ea47';   // must match the ESP32 ground station
const TOPIC_CAM         = 'kcc-cu/cam01-040d37e7';    // must match the ESP32 ground station
const TOPIC_6U          = 'kcc-cu/node06-48de3288';   // must match the 6U firmware / ESP32 uplink (planned)
const STALE_AFTER_MS    = 5000;    // no data for this long -> "Link lost"
const STABLE_RATE_DEG_S = 5;       // angular rate (deg/s) below which attitude is "STABLE"
const SPARK_POINTS      = 30;
const FRAME_W = 160, FRAME_H = 120, FRAME_BYTES = FRAME_W * FRAME_H / 2;
const DEMO = /[?&]demo\b/.test(location.search);

// ==========================================
// UTILITIES
// ==========================================
const $ = (id) => document.getElementById(id);
const random = (min, max) => Math.random() * (max - min) + min;
const normAngle = (a) => ((a + 180) % 360 + 360) % 360 - 180;
const setText = (id, text) => { const el = $(id); if (el) el.textContent = text; };
const num = (v, lo, hi) => { if (v === null || v === undefined || v === '') return null; v = Number(v); return Number.isFinite(v) && v >= lo && v <= hi ? v : null; };   // Number(null) is 0
const fmt = (v, d) => (v === null || v === undefined ? '--' : v.toFixed(d));
const deg = (r) => r * 180 / Math.PI;

function updateClock() {
    setText('utc-time', new Date().toISOString().substring(11, 19));
}
setInterval(updateClock, 1000);
updateClock();

// ==========================================
// FULLSCREEN (native API with CSS fallback for browsers without it, e.g. iPhone Safari)
// ==========================================
const fsCards = Array.from(document.querySelectorAll('[data-fs-card]'));

function nativeFsElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function syncFullscreenState() {
    const active = nativeFsElement();
    fsCards.forEach((card) => {
        const on = card === active || card.classList.contains('fs-fallback');
        card.classList.toggle('is-fs', on);
        const btn = card.querySelector('[data-fs-btn]');
        if (btn) {
            const name = btn.dataset.label;
            btn.setAttribute('aria-label', on ? `Exit fullscreen: ${name}` : `View ${name} fullscreen`);
            btn.title = on ? 'Back to dashboard (Esc)' : `View ${name} fullscreen`;
        }
    });
    document.body.style.overflow = fsCards.some((c) => c.classList.contains('fs-fallback')) ? 'hidden' : '';
}

function enterFullscreen(card) {
    const request = card.requestFullscreen || card.webkitRequestFullscreen;
    const fallback = () => { card.classList.add('fs-fallback'); syncFullscreenState(); };
    if (!request) return fallback();
    try {
        const result = request.call(card);
        if (result && result.catch) result.catch(fallback);
    } catch (e) { fallback(); }
}

function exitFullscreen() {
    fsCards.forEach((c) => c.classList.remove('fs-fallback'));
    if (nativeFsElement()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    syncFullscreenState();
}

fsCards.forEach((card) => {
    const btn = card.querySelector('[data-fs-btn]');
    btn.addEventListener('click', () => {
        const isFs = card.classList.contains('is-fs');
        isFs ? exitFullscreen() : enterFullscreen(card);
    });
});
document.addEventListener('fullscreenchange', syncFullscreenState);
document.addEventListener('webkitfullscreenchange', syncFullscreenState);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && fsCards.some((c) => c.classList.contains('fs-fallback'))) exitFullscreen();
});
syncFullscreenState();

// ==========================================
// CRAFT STATE
// ==========================================
// Everything shown on screen is rendered from these, so switching craft is instant.
function emptyHistory() { return Array(SPARK_POINTS).fill(null); }
const crafts = {
    '1u': {
        label: '1U · KCC-NODE-01',
        hasCamera: false,
        cards: { power: false, motors: false },
        pressureTile: false,
        fitted: { tempInt: true, tempExt: false, pressure: false, humidity: true, light: true, attitude: true, power: false, solar: false },
        lastDataAt: null,       // local ms of the newest live message
        lastSeenTs: 0,          // epoch ms of the newest message, live or retained
        values: {},
        hist: { pres: emptyHistory(), hum: emptyHistory(), light: emptyHistory() },
        prevAttitude: null,
        badge: 'Awaiting data'
    },
    '6u': {
        label: '6U · KCC-NODE-06',
        hasCamera: true,
        cards: { power: true, motors: true },
        pressureTile: true,
        simulatedSolar: true,     // no panel fitted: 16–19 V, captioned "simulated"
        // DHT11 (temp/humidity), light module, BMP280 (pressure), MPU-9250 (attitude).
        fitted: { tempInt: true, tempExt: false, pressure: true, humidity: true, light: true, attitude: true, power: false, solar: false },
        pending: true,            // until the first 6U sensor packet arrives
        notResponding: { pressure: 'BMP280 not responding', attitude: 'MPU-9250 not responding' },
        lastDataAt: null,
        lastSeenTs: 0,
        values: {},
        hist: { pres: emptyHistory(), hum: emptyHistory(), light: emptyHistory() },
        prevAttitude: null,
        badge: 'Awaiting data',
        cam: { frame: null, lastFrameAt: 0, status: null, stats: null }
    }
};

let current = '6u';
try {
    const q = new URLSearchParams(location.search).get('craft');
    const saved = localStorage.getItem('kcc-dash-craft');
    if (crafts[q]) current = q; else if (crafts[saved]) current = saved;
} catch (e) { /* storage blocked: default craft */ }

let relay = DEMO ? 'demo' : 'connecting';   // connecting | connected | error | demo

// ==========================================
// SPARKLINES
// ==========================================
Chart.defaults.color = '#475569';
Chart.defaults.font.family = "'JetBrains Mono', monospace";

function createSparkline(canvasId, unit, decimals) {
    return new Chart($(canvasId).getContext('2d'), {
        type: 'line',
        data: {
            labels: Array.from({ length: SPARK_POINTS }, (_, i) => i),
            // Start empty: no fabricated history. The line fills in from the right as real data arrives.
            datasets: [{
                data: emptyHistory(),
                borderColor: '#0ea5e9',
                borderWidth: 2,
                cubicInterpolationMode: 'monotone',
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHoverBackgroundColor: '#0369a1',
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            layout: { padding: { top: 6, bottom: 6 } },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    displayColors: false,
                    callbacks: {
                        title: () => '',
                        label: (c) => (c.parsed.y == null ? '' : `${c.parsed.y.toFixed(decimals)} ${c.dataset.unit || unit}`)
                    }
                }
            },
            scales: { x: { display: false }, y: { display: false, grace: '15%' } }
        }
    });
}

const charts = {
    pres:  createSparkline('chart-pres',  'kPa', 2),
    hum:   createSparkline('chart-hum',   '%',   1),
    light: createSparkline('chart-light', 'ADC', 0)
};

function pushHistory(craft, key, value) {
    const h = craft.hist[key];
    h.shift();
    h.push(value);
}

function showHistory(craft) {
    for (const key of Object.keys(charts)) {
        charts[key].data.datasets[0].data = craft.hist[key].slice();
        charts[key].update('none');
    }
}

// ==========================================
// SOLAR BARS (no array is fitted on either craft yet)
// ==========================================
const solarContainer = $('solar-bars');
for (let i = 0; i < 12; i++) {
    const bar = document.createElement('div');
    bar.className = 'solar-bar';
    bar.title = `Panel ${i + 1}: no data`;
    solarContainer.appendChild(bar);
}

const cube = $('satellite-cube');

// ==========================================
// CAMERA (6U optical feed)
// ==========================================
const camCanvas = $('cam-canvas');
const camCtx = camCanvas.getContext('2d');
const camImg = camCtx.createImageData(FRAME_W, FRAME_H);

function drawFrame(bytes, offset) {
    const d = camImg.data;
    for (let i = 0; i < FRAME_BYTES; i++) {
        const b = bytes[offset + i];
        const p = i * 8;
        const v1 = (b >> 4) * 17, v2 = (b & 15) * 17;
        d[p] = d[p + 1] = d[p + 2] = v1; d[p + 3] = 255;
        d[p + 4] = d[p + 5] = d[p + 6] = v2; d[p + 7] = 255;
    }
    camCtx.putImageData(camImg, 0, 0);
}

// ==========================================
// RENDERING
// ==========================================
function linkStateOf(craft) {
    if (craft.lastDataAt === null) return 'waiting';
    return Date.now() - craft.lastDataAt > STALE_AFTER_MS ? 'lost' : 'active';
}

function renderValues() {
    const c = crafts[current];
    const v = c.values;
    const f = c.fitted;
    const missing = c.pending ? 'Awaiting 6U sensor node' : 'Not fitted';

    setText('val-temp-int', f.tempInt ? fmt(v.tempInt, 1) : '--');
    setText('val-temp-ext', f.tempExt ? fmt(v.tempExt, 1) : '--');
    const presOk = f.pressure && v.pressure !== undefined && v.pressure !== null;
    setText('val-pres', presOk ? fmt(v.pressure, 1) : '--');
    setText('cap-pres', presOk ? '\u00a0' : c.pending ? missing : f.pressure ? ((c.notResponding || {}).pressure || 'Awaiting data') : 'Not fitted');
    setText('val-hum', f.humidity ? fmt(v.humidity, 1) : '--');
    setText('val-light', f.light && v.light !== undefined && v.light !== null ? String(Math.round(v.light)) : '--');
    setText('unit-light', 'ADC');   // the LDR reports a raw 0–4095 reading, not lux

    const sb = $('sensor-badge');
    if (c.pending) {
        sb.textContent = missing;
    } else if (!Object.keys(v).length) {
        sb.textContent = 'Awaiting data';
    } else {
        const names = [];
        if (v.tempInt !== undefined || v.humidity !== undefined) names.push('DHT11');
        if (v.light !== undefined && v.light !== null) names.push('LDR');
        if (presOk) names.push('BMP280');
        sb.textContent = names.join(' · ') || 'Awaiting data';
    }
    sb.classList.toggle('is-warn', c.pending || !Object.keys(v).length);

    // Power (6U only): the Solar Array tile; there is no battery indicator.
    renderSolar();

    // Attitude: pitch/roll from the accelerometer; yaw needs a gyro/magnetometer
    if (f.attitude && v.pitch !== undefined && v.pitch !== null) {
        cube.style.transform = `translateZ(-70px) rotateX(${v.pitch}deg) rotateZ(${v.roll}deg)`;
        setText('val-pitch', normAngle(v.pitch).toFixed(2) + '°');
        setText('val-roll', normAngle(v.roll).toFixed(2) + '°');
    } else {
        cube.style.transform = 'translateZ(-70px)';
        setText('val-pitch', '--');
        setText('val-roll', '--');
    }
    setText('val-yaw', '--');
    const ob = $('orient-badge');
    const attOk = f.attitude && v.pitch !== undefined && v.pitch !== null;
    ob.textContent = c.pending ? missing
                   : attOk ? c.badge
                   : f.attitude && Object.keys(v).length ? ((c.notResponding || {}).attitude || 'Awaiting data')
                   : f.attitude ? 'Awaiting data' : 'Not fitted';
    ob.classList.toggle('is-warn', !attOk || c.badge !== 'Stable');
}

// Solar: no panel is fitted on the 6U; by request it shows a simulated 16–19 V output.
const solar = { volts: null, bars: Array(12).fill(0) };
function tickSolar() {
    solar.volts = random(16, 19);
    solar.bars = solar.bars.map(() => random(55, 100));
    if (crafts[current].simulatedSolar) renderSolar();
}
function renderSolar() {
    const c = crafts[current];
    const bars = Array.from(solarContainer.children);
    if (c.simulatedSolar && solar.volts !== null) {
        setText('val-solar-kw', `${solar.volts.toFixed(2)} V`);
        bars.forEach((bar, i) => {
            bar.style.height = `${solar.bars[i]}%`;
            bar.style.backgroundColor = '#0ea5e9';
            bar.title = `Panel ${i + 1}: simulated`;
        });
        setText('cap-solar', 'Simulated · no panel fitted');
    } else {
        setText('val-solar-kw', '-- V');
        bars.forEach((bar) => { bar.style.height = '4%'; bar.style.backgroundColor = ''; });
        setText('cap-solar', 'Not fitted');
    }
}
setInterval(tickSolar, 1000);
tickSolar();

// Cards and tiles each craft actually has
function renderLayout() {
    const c = crafts[current];
    const show = { '.c-power': c.cards.power, '.c-motors': c.cards.motors };
    for (const [sel, on] of Object.entries(show)) {
        const card = document.querySelector(sel);
        if (!on && card.classList.contains('is-fs')) exitFullscreen();
        card.hidden = !on;
    }
    $('tile-pres').hidden = !c.pressureTile;
    document.body.classList.toggle('craft-1u', current === '1u');
    document.body.classList.toggle('craft-6u', current === '6u');
}

const feedBg = document.querySelector('.feed-bg');
const opticalCard = document.querySelector('.c-optical');

function renderCamera() {
    const c = crafts[current];
    const badge = $('rec-badge');
    // The template's stock Earth photo would pass for a real picture, so it never shows;
    // the feed is black unless a real frame is on screen.
    feedBg.hidden = true;
    // Crafts without a camera (the 1U) don't get an Optical Feed card at all.
    if (opticalCard.hidden === c.hasCamera) {
        if (!c.hasCamera && opticalCard.classList.contains('is-fs')) exitFullscreen();
        opticalCard.hidden = !c.hasCamera;
        document.body.classList.toggle('no-camera', !c.hasCamera);
    }
    if (!c.hasCamera) return;
    const cam = c.cam;
    const live = Date.now() - cam.lastFrameAt < STALE_AFTER_MS;
    camCanvas.hidden = !cam.frame;
    badge.classList.toggle('is-offline', !live);
    let label;
    if (live) {
        const s = cam.stats || {};
        label = 'CAM_1 | LIVE' + (s.fps !== null && s.fps !== undefined ? ` · ${s.fps.toFixed(1)} FPS` : '') +
                (s.rssi !== null && s.rssi !== undefined ? ` · ${s.rssi} dBm` : '');
    } else if (cam.frame) {
        label = 'CAM_1 | NO SIGNAL · LAST FRAME' + (c.lastSeenTs ? ' ' + new Date(c.lastSeenTs).toLocaleTimeString() : '');
    } else {
        label = cam.status === 'offline' ? 'CAM_1 | GROUND STN OFFLINE' : 'CAM_1 | NO SIGNAL';
    }
    setText('cam-label', label);
}

function renderLink() {
    const c = crafts[current];
    const state = linkStateOf(c);
    let text;
    if (relay === 'demo') text = 'DEMO · simulated data, not live';
    else if (relay === 'connecting') text = 'Connecting to the ground station relay…';
    else if (relay === 'error') text = 'Relay unreachable · retrying';
    else if (state === 'active') text = `${c.label} · telemetry link active`;
    else if (state === 'lost') text = `${c.label} · link lost · last data ${Math.round((Date.now() - c.lastDataAt) / 1000)}s ago`;
    else if (c.lastSeenTs) text = `${c.label} · no live data · last seen ${new Date(c.lastSeenTs).toLocaleString()}`;
    else text = `${c.label} · waiting for telemetry…`;
    setText('link-text', text);

    const status = $('link-status');
    status.classList.toggle('is-active', state === 'active');
    status.classList.toggle('is-lost', state === 'lost' || relay === 'error');
    document.body.classList.toggle('link-lost', state === 'lost');

    document.querySelectorAll('.craft-btn').forEach((btn) => {
        const s = linkStateOf(crafts[btn.dataset.craft]);
        btn.classList.toggle('is-live', s === 'active');
        btn.classList.toggle('is-lost', s === 'lost');
        btn.title = `${crafts[btn.dataset.craft].label}: ${s === 'active' ? 'live' : s === 'lost' ? 'link lost' : 'no live data'}`;
    });
    renderCamera();
}

function renderAll() {
    renderLayout();
    renderValues();
    showHistory(crafts[current]);
    if (crafts[current].hasCamera && crafts[current].cam.frame) drawFrame(crafts[current].cam.frame, 4);
    renderLink();
}

function selectCraft(id) {
    if (!crafts[id]) return;
    current = id;
    try { localStorage.setItem('kcc-dash-craft', id); } catch (e) { /* ignore */ }
    document.querySelectorAll('.craft-btn').forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.craft === id)));
    renderAll();
}
document.querySelectorAll('.craft-btn').forEach((btn) => btn.addEventListener('click', () => selectCraft(btn.dataset.craft)));
setInterval(renderLink, 1000);

// ==========================================
// DATA INJECTION
// ==========================================
// data uses the template's keys: tempInt, humidity, light, pitch, roll, ...
function updateDashboardData(craftId, data, live = true, ts = 0) {
    const c = crafts[craftId];
    if (!c || !data) return;
    if (live) c.lastDataAt = Date.now();
    c.lastSeenTs = ts || (live ? Date.now() : c.lastSeenTs);
    Object.assign(c.values, data);

    if (live) {
        if (data.pressure !== undefined) pushHistory(c, 'pres', data.pressure);
        if (data.humidity !== undefined) pushHistory(c, 'hum', data.humidity);
        if (data.light !== undefined) pushHistory(c, 'light', data.light);
        if (data.pitch !== undefined && data.pitch !== null) {
            // Rate over >= 1 s: accelerometer noise at 4 updates/s would otherwise flicker the badge.
            const now = Date.now();
            if (!c.prevAttitude) {
                c.prevAttitude = { p: data.pitch, r: data.roll, t: now };
            } else if (now - c.prevAttitude.t >= 1000) {
                const dt = (now - c.prevAttitude.t) / 1000;
                const d = (a, b) => Math.abs(normAngle(a - b));
                const rate = Math.max(d(data.pitch, c.prevAttitude.p), d(data.roll, c.prevAttitude.r)) / dt;
                c.badge = rate < STABLE_RATE_DEG_S ? 'Stable' : 'Rotating';
                c.prevAttitude = { p: data.pitch, r: data.roll, t: now };
            }
        }
    }
    if (craftId === current) {
        renderValues();
        showHistory(c);
        renderLink();
    }
}

// 1U JSON from the ESP32 (same shape telemetry.js reads)
function on1U(text, retained) {
    let d;
    try { d = JSON.parse(text); } catch (e) { return; }
    if (!d || typeof d !== 'object') return;
    const temp = num(d.temp, -40, 85), hum = num(d.hum, 0, 100), ldr = num(d.ldr, 0, 4095);
    const ax = num(d.accelx, -16, 16), ay = num(d.accely, -16, 16), az = num(d.accelz, -16, 16);
    const out = {};
    // The ESP32 reports 0.00 until the DHT11 has produced a reading.
    if (temp !== null && temp.toFixed(2) !== '0.00') out.tempInt = temp;
    if (hum !== null && hum.toFixed(2) !== '0.00') out.humidity = hum;
    if (ldr !== null) out.light = ldr;
    if (ax !== null && ay !== null && az !== null && (ax || ay || az)) {
        out.pitch = deg(Math.atan2(-ax, Math.sqrt(ay * ay + az * az)));
        out.roll = deg(Math.atan2(ay, az));
    }
    updateDashboardData('1u', out, !retained, num(d.ts, 0, 1e14) || 0);
}

// 6U JSON from the ESP32: {"temp","hum","ldr","ax","ay","az","pres"(hPa),"rssi","pkts","via","ts"};
// null = that sensor isn't responding.
function on6U(text, retained) {
    let d;
    try { d = JSON.parse(text); } catch (e) { return; }
    if (!d || typeof d !== 'object') return;
    const temp = num(d.temp, -40, 85), hum = num(d.hum, 0, 100), ldr = num(d.ldr, 0, 4095);
    const ax = num(d.ax, -16, 16), ay = num(d.ay, -16, 16), az = num(d.az, -16, 16), hpa = num(d.pres, 300, 1100);
    const out = { light: ldr, pressure: hpa === null ? null : hpa / 10 };   // the tile shows kPa
    if (temp !== null) out.tempInt = temp;
    if (hum !== null) out.humidity = hum;
    if (ax !== null && ay !== null && az !== null) {
        out.pitch = deg(Math.atan2(-ax, Math.sqrt(ay * ay + az * az)));
        out.roll = deg(Math.atan2(ay, az));
    } else {
        out.pitch = null;
        out.roll = null;
    }
    crafts['6u'].pending = false;
    updateDashboardData('6u', out, !retained, num(d.ts, 0, 1e14) || 0);
}

function onCamFrame(payload, retained) {
    if (!payload || payload.length !== 4 + FRAME_BYTES) return;
    if (payload[0] !== 0x4B || payload[1] !== 0x43 || payload[2] !== 0x56 || payload[3] !== 0x31) return;   // "KCV1"
    const c = crafts['6u'];
    c.cam.frame = new Uint8Array(payload);   // copy: the client may reuse its buffer
    if (!retained) {
        c.cam.lastFrameAt = Date.now();
        c.lastDataAt = Date.now();
        c.lastSeenTs = Date.now();
    }
    if (current === '6u') { drawFrame(c.cam.frame, 4); renderLink(); }
}

function onCamStats(text) {
    let s;
    try { s = JSON.parse(text); } catch (e) { return; }
    if (!s || typeof s !== 'object') return;
    const c = crafts['6u'];
    // The ESP32 counts frames per 1 s window; at <1 fps most windows read 0, so average the last 10.
    const fps = num(s.fps, 0, 100);
    if (fps !== null) { c.cam.fpsWin = (c.cam.fpsWin || []).concat(fps).slice(-10); }
    const win = c.cam.fpsWin || [];
    c.cam.stats = { fps: win.length ? win.reduce((a, b) => a + b, 0) / win.length : null, rssi: num(s.rssi, -160, 20) };
    const ts = num(s.ts, 0, 1e14);
    if (ts && ts > c.lastSeenTs) c.lastSeenTs = ts;
}

// ==========================================
// MQTT
// ==========================================
let relayClient = null;

function connectRelay() {
    if (typeof mqtt === 'undefined') { relay = 'error'; renderLink(); return; }
    const client = relayClient = mqtt.connect(BROKER_URL, {
        clientId: 'kcc-dash-' + Math.random().toString(16).slice(2, 10),
        reconnectPeriod: 5000,
        connectTimeout: 10000
    });
    client.on('connect', () => {
        relay = 'connected';
        client.subscribe([TOPIC_1U + '/#', TOPIC_CAM + '/#', TOPIC_6U + '/motors', TOPIC_6U + '/telemetry'], { qos: 0 });
        renderLink();
    });
    client.on('error', () => { relay = 'error'; renderLink(); });
    client.on('offline', () => { relay = 'connecting'; renderLink(); });
    client.on('message', (topic, payload, packet) => {
        const retained = !!(packet && packet.retain);
        if (topic === TOPIC_1U + '/telemetry') on1U(payload.toString(), retained);
        else if (topic === TOPIC_CAM + '/frame') onCamFrame(payload, retained);
        else if (topic === TOPIC_CAM + '/stats') onCamStats(payload.toString());
        else if (topic === TOPIC_6U + '/motors') onMotorReadback(payload.toString(), retained);
        else if (topic === TOPIC_6U + '/telemetry') on6U(payload.toString(), retained);
        else if (topic === TOPIC_CAM + '/status') {
            const s = payload.toString();
            if (s === 'online' || s === 'offline') { crafts['6u'].cam.status = s; renderLink(); }
        }
    });
}

// ==========================================
// MOTOR CONTROL (6U, 4 BLDC motors via ESCs)
// ==========================================
// The site and broker are public, so commands are signed: key = SHA-256(password),
// message = {"c": <command JSON string>, "s": <hex HMAC-SHA256(key, c)>}, where c is
// {"seq":n,"ts":ms,"arm":bool,"stop":bool,"t":[m1,m2,m3,m4]} with throttles 0–100 %.
// seq strictly increases. While armed the page repeats the command every 500 ms; the 6U
// must stop all motors if it hears nothing valid for 1.5 s (closed tab, lost link).
// The password is never stored or sent. The page only keeps a salted PBKDF2 hash to say
// "wrong password" early; the 6U checks the HMAC itself. See teensy-lora-video docs/HANDOVER.md 2.3.
const PASS_CHECK = {
    salt: 'c6653ae14806f75e9e18b45f7b7d6ce3',
    iterations: 210000,
    hash: 'd8f4708368f761288de9bd7823580ec714fa8aa5ec88de8c5903ef6401a563b0'
};
const MOTOR_KEEPALIVE_MS = 500;
const motor = { key: null, armed: false, t: [0, 0, 0, 0], seq: 0, lastSendAt: 0, sending: false, nodeAt: 0, node: null };
const sliders = [1, 2, 3, 4].map((i) => $(`m${i}`));
const allSlider = $('m-all');
const enc = new TextEncoder();

function hex(buf) { return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join(''); }

async function sendMotorCommand(stop = false) {
    if (!motor.key || !relayClient || !relayClient.connected) return false;
    const ts = Date.now();
    motor.seq = Math.max(motor.seq + 1, ts);
    const c = JSON.stringify({ seq: motor.seq, ts, arm: motor.armed, stop, t: motor.t.slice() });
    const sig = await crypto.subtle.sign('HMAC', motor.key, enc.encode(c));
    relayClient.publish(TOPIC_6U + '/cmd', JSON.stringify({ c, s: hex(sig) }), { qos: 0, retain: false });
    motor.lastSendAt = Date.now();
    return true;
}

async function passwordMatches(pass) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
    const salt = Uint8Array.from(PASS_CHECK.salt.match(/../g), (h) => parseInt(h, 16));
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PASS_CHECK.iterations }, base, 256);
    return hex(bits) === PASS_CHECK.hash;
}

let pendingSend = null;
function queueSend() {           // at most ~10 commands/s while a slider is dragged
    if (pendingSend) return;
    pendingSend = setTimeout(() => { pendingSend = null; sendMotorCommand(); }, 100);
}

function renderMotors() {
    const unlocked = !!motor.key;
    $('motor-unlock').textContent = unlocked ? 'Lock' : 'Unlock';
    $('motor-pass').disabled = unlocked;
    const arm = $('motor-arm');
    arm.disabled = !unlocked;
    arm.setAttribute('aria-pressed', String(motor.armed));
    arm.textContent = motor.armed ? 'Armed · Disarm' : 'Arm';
    sliders.forEach((sl, i) => {
        sl.disabled = !motor.armed;
        sl.value = motor.t[i];
        setText(`m${i + 1}-val`, String(motor.t[i]));
    });
    allSlider.disabled = !motor.armed;
    const nodeLive = Date.now() - motor.nodeAt < 3000;
    sliders.forEach((_, i) => setText(`m${i + 1}-rb`, nodeLive && motor.node && motor.node.t[i] !== null ? `6U reports ${motor.node.t[i]}%` : '6U reports --'));
    const badge = $('motor-badge');
    badge.textContent = nodeLive ? (motor.node.failsafe ? '6U failsafe: motors stopped' : motor.node.armed ? '6U motors armed' : '6U motor node connected')
                                 : '6U motor node not connected';
    badge.classList.toggle('is-warn', !nodeLive || motor.node.failsafe || motor.node.armed);
}

function stopAll() {
    motor.armed = false;
    motor.t = [0, 0, 0, 0];
    allSlider.value = 0;
    setText('m-all-val', '0%');
    renderMotors();
    // Send a few times: a single lost packet must not leave motors running.
    for (let i = 0; i < 3; i++) setTimeout(() => sendMotorCommand(true), i * 150);
}

$('motor-key-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (motor.key) { stopAll(); motor.key = null; renderMotors(); return; }   // Lock
    const pass = $('motor-pass').value;
    if (!(await passwordMatches(pass))) {
        $('motor-pass').value = '';
        setText('motor-note', 'Wrong password. The controls stay locked.');
        return;
    }
    setText('motor-note', 'Unlocked. Commands are signed with the operator password and sent to the 6U uplink.' +
        (Date.now() - motor.nodeAt < 3000 ? '' : ' The 6U motor node isn\'t connected yet, so no motor receives them.'));
    const raw = await crypto.subtle.digest('SHA-256', enc.encode(pass));
    motor.key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    $('motor-pass').value = '';
    renderMotors();
});

$('motor-arm').addEventListener('click', () => {
    if (motor.armed) { stopAll(); return; }
    if (!window.confirm('Arm all 4 motors? Make sure propellers and hands are clear.')) return;
    motor.armed = true;
    renderMotors();
    sendMotorCommand();
});
$('motor-stop').addEventListener('click', stopAll);

sliders.forEach((sl, i) => sl.addEventListener('input', () => {
    motor.t[i] = Number(sl.value);
    setText(`m${i + 1}-val`, sl.value);
    queueSend();
}));
allSlider.addEventListener('input', () => {
    const v = Number(allSlider.value);
    motor.t = [v, v, v, v];
    setText('m-all-val', `${v}%`);
    renderMotors();
    queueSend();
});

// Keep-alive while armed; the 6U's 1.5 s failsafe stops the motors if these stop.
setInterval(() => {
    if (motor.armed && Date.now() - motor.lastSendAt >= MOTOR_KEEPALIVE_MS) sendMotorCommand();
    renderMotors();
}, MOTOR_KEEPALIVE_MS);
// Leaving the page or hiding the tab disarms.
document.addEventListener('visibilitychange', () => { if (document.hidden && motor.armed) stopAll(); });
window.addEventListener('pagehide', () => { if (motor.armed) stopAll(); });

// Readback from the 6U: {"armed":bool,"failsafe":bool,"t":[m1..m4]} (planned firmware)
function onMotorReadback(text, retained) {
    if (retained) return;
    let d;
    try { d = JSON.parse(text); } catch (e) { return; }
    if (!d || typeof d !== 'object' || !Array.isArray(d.t)) return;
    motor.node = { armed: d.armed === true, failsafe: d.failsafe === true, t: [0, 1, 2, 3].map((i) => num(d.t[i], 0, 100)) };
    motor.nodeAt = Date.now();
    renderMotors();
}
renderMotors();

// ==========================================
// DEMO (?demo): clearly labelled simulated data for previewing the UI
// ==========================================
function startDemo() {
    let t = 0;
    const frame = new Uint8Array(4 + FRAME_BYTES);
    frame.set([0x4B, 0x43, 0x56, 0x31]);
    setInterval(() => {
        t += 0.25;
        on1U(JSON.stringify({
            temp: 24 + Math.sin(t / 8), hum: 48 + 2 * Math.sin(t / 5), ldr: 1200 + 300 * Math.sin(t / 3),
            accelx: 0.2 * Math.sin(t / 2), accely: 0.2 * Math.cos(t / 3), accelz: 0.97, ts: Date.now()
        }), false);
        for (let y = 0; y < FRAME_H; y++) {
            for (let x = 0; x < FRAME_W; x += 2) {
                const v = (xx) => {
                    const r = Math.hypot(xx - 80 - 40 * Math.cos(t), y - 60 - 25 * Math.sin(t));
                    return Math.max(0, Math.min(15, Math.round(8 + 7 * Math.cos(r / 6 - t * 2))));
                };
                frame[4 + (y * FRAME_W + x) / 2] = (v(x) << 4) | v(x + 1);
            }
        }
        onCamFrame(frame, false);
        onCamStats(JSON.stringify({ fps: 0.8, rssi: -63, ts: Date.now() }));
    }, 250);
}

selectCraft(current);
if (DEMO) startDemo(); else connectRelay();
