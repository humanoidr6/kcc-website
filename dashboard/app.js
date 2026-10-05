// KCC ground-station dashboard: UI from github.com/mahamatkher/6U_Dashboard,
// fed live from the same public MQTT broker and topics as telemetry.html.
//
//   1U · KCC-NODE-01  kcc-cu/node01-29e8ea47/{telemetry,status}   DHT11, LDR, MPU6050 (via the ESP32)
//   6U · KCC-NODE-06  kcc-cu/cam01-040d37e7/{frame,stats,status}  OV7670 camera (via the same ESP32)
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
const STALE_AFTER_MS    = 5000;    // no data for this long -> "Link lost"
const STABLE_RATE_DEG_S = 5;       // angular rate (deg/s) below which attitude is "STABLE"
const SPARK_POINTS      = 30;
const GROUND_STATION    = { lat: 30.7688, lon: 76.5754 };   // KCC, Chandigarh University (approx.)
const FRAME_W = 160, FRAME_H = 120, FRAME_BYTES = FRAME_W * FRAME_H / 2;
const DEMO = /[?&]demo\b/.test(location.search);

// ==========================================
// UTILITIES
// ==========================================
const $ = (id) => document.getElementById(id);
const random = (min, max) => Math.random() * (max - min) + min;
const normAngle = (a) => ((a + 180) % 360 + 360) % 360 - 180;
const setText = (id, text) => { const el = $(id); if (el) el.textContent = text; };
const num = (v, lo, hi) => { v = Number(v); return Number.isFinite(v) && v >= lo && v <= hi ? v : null; };
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
        // The 6U sensor/power node is planned (see teensy-lora-video docs/HANDOVER.md, section 2).
        fitted: { tempInt: false, tempExt: false, pressure: false, humidity: false, light: false, attitude: false, power: false, solar: false },
        pending: true,
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
// MAP (Leaflet): neither craft has GPS, so it marks the ground station that hears them
// ==========================================
const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([GROUND_STATION.lat, GROUND_STATION.lon], 15);
L.control.zoom({ position: 'bottomright' }).addTo(map);
// OpenStreetMap's tile policy requires visible attribution
L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    className: 'map-tiles',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
}).addTo(map);

const craftIcon = L.divIcon({
    className: '',
    html: '<div class="craft-icon"><div class="craft-ping"></div><div class="craft-dot"></div></div>',
    iconSize: [48, 48],
    iconAnchor: [24, 24]
});
L.marker([GROUND_STATION.lat, GROUND_STATION.lon], { icon: craftIcon, keyboard: false, title: 'KCC ground station' })
    .addTo(map)
    .bindTooltip('KCC ground station · both crafts are received here');

const recenterBtn = $('recenter-btn');
map.on('dragstart', () => { recenterBtn.hidden = false; });
recenterBtn.addEventListener('click', () => {
    map.setView([GROUND_STATION.lat, GROUND_STATION.lon], 15);
    recenterBtn.hidden = true;
});
recenterBtn.lastChild.textContent = 'Ground station';
new ResizeObserver(() => map.invalidateSize()).observe($('map'));

(function showGroundStationChips() {
    const box = $('coord-display');
    box.textContent = '';
    const chip = (t) => { const s = document.createElement('span'); s.className = 'coord-chip'; s.textContent = t; box.appendChild(s); };
    chip(`GS ${GROUND_STATION.lat.toFixed(4)}°N ${GROUND_STATION.lon.toFixed(4)}°E`);
    chip('No GPS on board');
})();

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
function setBattery(pct) {
    const p = Math.max(0, Math.min(100, pct));
    $('val-batt').textContent = `${Math.round(p)}%`;
    const bar = $('batt-bar');
    bar.style.width = `${p}%`;
    bar.classList.toggle('is-warn', p < 40 && p >= 20);
    bar.classList.toggle('is-bad', p < 20);
    $('batt-track').setAttribute('aria-valuenow', Math.round(p));
    // text cue so state is not conveyed by colour alone
    setText('batt-state', p < 20 ? 'Critical' : p < 40 ? 'Low' : 'Nominal');
}

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
    setText('val-pres', f.pressure ? fmt(v.pressure, 1) : '--');
    setText('cap-pres', f.pressure ? ' ' : missing);
    setText('val-hum', f.humidity ? fmt(v.humidity, 1) : '--');
    setText('val-light', f.light && v.light !== undefined && v.light !== null ? String(Math.round(v.light)) : '--');
    setText('unit-light', 'ADC');   // the LDR reports a raw 0–4095 reading, not lux

    const anyFitted = f.tempInt || f.humidity || f.light;
    const sb = $('sensor-badge');
    sb.textContent = anyFitted ? (Object.keys(v).length ? 'DHT11 · LDR' : 'Awaiting data') : missing;
    sb.classList.toggle('is-warn', !anyFitted);

    // Power: nothing fitted yet on either craft
    setText('val-batt-v', f.power ? `${fmt(v.batteryVoltage, 1)} V` : '-- V');
    if (f.power && v.batteryPercent !== undefined) {
        setBattery(v.batteryPercent);
    } else {
        $('val-batt').textContent = '--';
        $('batt-bar').style.width = '0';
        $('batt-track').setAttribute('aria-valuenow', 0);
        setText('batt-state', c.pending ? 'Awaiting 6U power data' : 'Not fitted');
    }
    setText('val-solar-kw', '-- kW');
    setText('cap-solar', 'Not fitted');

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
    ob.textContent = f.attitude ? c.badge : missing;
    ob.classList.toggle('is-warn', !f.attitude || c.badge !== 'Stable');
}

const feedBg = document.querySelector('.feed-bg');

function renderCamera() {
    const c = crafts[current];
    const badge = $('rec-badge');
    // The template's stock Earth photo would pass for a real picture, so it never shows;
    // the feed is black unless a real frame is on screen.
    feedBg.hidden = true;
    if (!c.hasCamera) {
        camCanvas.hidden = true;
        badge.classList.add('is-offline');
        setText('cam-label', 'NO CAMERA ON 1U');
        return;
    }
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
    c.cam.stats = { fps: num(s.fps, 0, 100), rssi: num(s.rssi, -160, 20) };
    const ts = num(s.ts, 0, 1e14);
    if (ts && ts > c.lastSeenTs) c.lastSeenTs = ts;
}

// ==========================================
// MQTT
// ==========================================
function connectRelay() {
    if (typeof mqtt === 'undefined') { relay = 'error'; renderLink(); return; }
    const client = mqtt.connect(BROKER_URL, {
        clientId: 'kcc-dash-' + Math.random().toString(16).slice(2, 10),
        reconnectPeriod: 5000,
        connectTimeout: 10000
    });
    client.on('connect', () => {
        relay = 'connected';
        client.subscribe([TOPIC_1U + '/#', TOPIC_CAM + '/#'], { qos: 0 });
        renderLink();
    });
    client.on('error', () => { relay = 'error'; renderLink(); });
    client.on('offline', () => { relay = 'connecting'; renderLink(); });
    client.on('message', (topic, payload, packet) => {
        const retained = !!(packet && packet.retain);
        if (topic === TOPIC_1U + '/telemetry') on1U(payload.toString(), retained);
        else if (topic === TOPIC_CAM + '/frame') onCamFrame(payload, retained);
        else if (topic === TOPIC_CAM + '/stats') onCamStats(payload.toString());
        else if (topic === TOPIC_CAM + '/status') {
            const s = payload.toString();
            if (s === 'online' || s === 'offline') { crafts['6u'].cam.status = s; renderLink(); }
        }
    });
}

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
