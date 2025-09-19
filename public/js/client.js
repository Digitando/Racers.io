(() => {
  const $ = (sel) => document.querySelector(sel);
  const roomsEl = $('#roomsList');
  const globalLbEl = document.getElementById('globalLb');
  const globalLbSummaryEl = document.getElementById('globalLbSummary');
  const globalLbSearchInput = document.getElementById('globalLbSearch');
  const globalLbControlsEl = document.getElementById('globalLbControls');
  const globalLbSortButtons = globalLbControlsEl ? Array.from(globalLbControlsEl.querySelectorAll('[data-gl-sort]')) : [];
  const globalLbSortState = { key: 'score', dir: 'desc' };
  let globalLbData = [];
  const refreshBtn = $('#refreshBtn');
  const searchRoomsInput = document.getElementById('searchRooms');
  let lastRooms = [];
  const createBtn = $('#createBtn');
  const roomNameInput = $('#roomNameInput');
  const nameInput = $('#nameInput');
  const colorInput = $('#colorInput');
  const browserPanel = $('#browserPanel');
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const tabServers = document.getElementById('tab-servers');
  const tabLeaderboard = document.getElementById('tab-leaderboard');
  const tabCampaign = document.getElementById('tab-campaign');
  const tabHelp = document.getElementById('tab-help');
  const tabCustomize = document.getElementById('tab-customize');
  const saveProfileBtn = document.getElementById('saveProfileBtn');
  const accentInput = document.getElementById('accentInput');
  const shapeSelect = document.getElementById('shapeSelect');
  const tabCustom = document.getElementById('tab-custom');
  // custom form elements
  const cName = document.getElementById('cName');
  const cPassword = document.getElementById('cPassword');
  const cMaxPlayers = document.getElementById('cMaxPlayers');
  const cDuration = document.getElementById('cDuration');
  const cMinPlayers = document.getElementById('cMinPlayers');
  const cAiCount = document.getElementById('cAiCount');
  const cAiLevel = document.getElementById('cAiLevel');
  const cCreateBtn = document.getElementById('cCreateBtn');
  const jRoomId = document.getElementById('jRoomId');
  const jPassword = document.getElementById('jPassword');
  const jJoinBtn = document.getElementById('jJoinBtn');
  const campaignListEl = document.getElementById('campaignList');
  const hudEl = $('#hud');
  const timerEl = $('#timer');
  const leaderboardEl = $('#leaderboard');
  const lapCounterEl = $('#lapCounter');
  const speedDialEl = $('#speedDial');
  const finishOverlay = document.getElementById('finishOverlay');
  const finishResultsEl = document.getElementById('finishResults');
  const finishCountdownEl = document.getElementById('finishCountdown');
  const finishBackBtn = document.getElementById('finishBackBtn');
  const bestLapEl = $('#bestLap');
  if (bestLapEl) bestLapEl.textContent = 'PB —';
  if (bestLapEl) bestLapEl.classList.add('hidden');
  if (lapCounterEl) lapCounterEl.classList.add('hidden');
  if (hudEl) {
    hudEl.style.background = 'linear-gradient(135deg, rgba(18,26,46,0.82), rgba(12,18,32,0.68))';
    hudEl.style.backdropFilter = 'blur(12px)';
    hudEl.style.borderRadius = '18px';
    hudEl.style.boxShadow = '0 22px 48px rgba(2, 6, 14, 0.45)';
  }
  if (speedDialEl) {
    speedDialEl.style.background = 'radial-gradient(circle at 30% 15%, rgba(255,255,255,0.18), rgba(12,18,32,0.92))';
    speedDialEl.style.color = '#f6fbff';
    speedDialEl.style.textShadow = '0 0 12px rgba(0, 200, 255, 0.65)';
    speedDialEl.style.borderRadius = '50%';
    speedDialEl.style.boxShadow = '0 10px 30px rgba(0,0,0,0.35)';
  }
  if (timerEl) {
    timerEl.style.color = '#f6fbff';
    timerEl.style.textShadow = '0 0 6px rgba(0, 160, 255, 0.55)';
  }
  let finishAutoTimer = null;
  const chatEl = document.getElementById('chat');
  const chatLogEl = document.getElementById('chatLog');
  const chatInputEl = document.getElementById('chatInput');

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const mini = document.getElementById('minimap');
  const mctx = mini.getContext('2d');
  const touchEl = document.getElementById('touchControls');
  const touchSteer = document.getElementById('touchSteer');
  const joystickBase = touchSteer ? touchSteer.querySelector('.tc-joystick-base') : null;
  const joystickThumb = touchSteer ? touchSteer.querySelector('.tc-joystick-thumb') : null;
  const pedalAccel = document.getElementById('touchPedalAccel');
  const pedalBrake = document.getElementById('touchPedalBrake');
  const pedalAccelFill = pedalAccel ? pedalAccel.querySelector('.tc-pedal-fill') : null;
  const pedalBrakeFill = pedalBrake ? pedalBrake.querySelector('.tc-pedal-fill') : null;

  const SHAPE_OPTIONS = [
    { value: 'capsule', label: 'Capsule' },
    { value: 'wedge', label: 'Wedge' },
    { value: 'formula', label: 'Formula' },
    { value: 'roadster', label: 'Roadster' },
    { value: 'buggy', label: 'Buggy' },
    { value: 'dragster', label: 'Dragster' },
    { value: 'hover', label: 'Hovercraft' },
  ];
  const DEFAULT_SHAPE = SHAPE_OPTIONS[0].value;
  const SHAPE_VALUE_SET = new Set(SHAPE_OPTIONS.map((o) => o.value));
  const normalizeShape = (val) => {
    const s = String(val || '').toLowerCase();
    return SHAPE_VALUE_SET.has(s) ? s : DEFAULT_SHAPE;
  };
  const NAME_MAX = 10;
  const sanitizeName = (val) => {
    let s = typeof val === 'string' ? val : '';
    s = s.replace(/\s+/g, ' ').trim();
    if (!s) return '';
    if (s.length > NAME_MAX) s = s.slice(0, NAME_MAX);
    return s;
  };
  const SKILL_LABELS = {
    legend: 'LEG',
    pro: 'PRO',
    rookie: 'ROO',
    human: 'HUM',
  };
  const skillLabel = (skill) => SKILL_LABELS[String(skill || '').toLowerCase()] || (skill ? skill.toUpperCase().slice(0, 3) : 'BOT');
  const formatGap = (lapDiff) => {
    if (!Number.isFinite(lapDiff)) return '—';
    if (Math.abs(lapDiff) < 0.02) return 'Leader';
    const sign = lapDiff > 0 ? '+' : '-';
    const abs = Math.abs(lapDiff);
    const digits = abs >= 1 ? 1 : 2;
    return `${sign}${abs.toFixed(digits)}L`;
  };
  const formatWinRate = (rate) => `${Number(rate || 0).toFixed(1)}%`;
  const formatAvgLaps = (avg) => Number(avg || 0).toFixed(2);
  const GLOBAL_SORT_LABELS = {
    score: 'Score',
    wins: 'Wins',
    winRate: 'Win%',
    avgLaps: 'Avg Laps',
    bestLap: 'Best Lap',
    races: 'Races',
    name: 'Name',
  };
  if (shapeSelect) {
    shapeSelect.innerHTML = SHAPE_OPTIONS.map(({ value, label }) => `<option value="${value}">${label}</option>`).join('');
    shapeSelect.value = DEFAULT_SHAPE;
  }

  let socket = null;
  let currentRoom = null;
  let you = null;
  let track = null;
  let world = { players: [], timeRemaining: 0 };
  let entities = new Map(); // id -> {x,y,angle}
  let lastStateAt = 0;
  // Camera
  let camX = 0, camY = 0;
  let cameraZoom = 10; // default zoom factor
  const ZOOM_MIN = 2, ZOOM_MAX = 20;
  const CAM_SMOOTH = 0.22; // faster camera follow (less lag)
  // Local prediction for your car
  const PHY = { ACCEL: 900, BRAKE: 1200, REV_ACCEL: 650, DRAG: 0.995, MAX_TURN_RATE: 5.44, VREF: 450, STEER_RESP: 10, GRIP_LOW: 10, GRIP_HIGH: 3, MAX_SPEED: 200, MAX_REVERSE_SPEED: 20, CAR_RADIUS: 12, WALL_SCRAPE: 25, WALL_IMPACT_SLOW: 0.5, SLIDE_THRESHOLD: 0.7 };
  let meLocal = null; // {x,y,angle,vx,vy,steer}
  let meServer = null; // {x,y,angle}
  let lastFrame = performance.now();
  // Fixed-step local simulation to avoid frame-rate/zoom affecting turn speed
  const SIM_HZ = 120;
  const DT_FIXED = 1 / SIM_HZ;
  let simAcc = 0;
  // Visual caches
  let asphaltPattern = null;
  // Skid marks (your car)
  const skidMarks = [];
  const SKID_MAX = 700;
  const CAR_L = 44, CAR_W = 22;
  const TAU = Math.PI * 2;

  const FEATURE_STYLES = {
    boost: { fill: 'rgba(0, 214, 170, 0.32)', stroke: 'rgba(0, 166, 136, 0.85)' },
    puddle: { fill: 'rgba(64, 131, 255, 0.32)', stroke: 'rgba(22, 92, 214, 0.8)' },
    dirt: { fill: 'rgba(178, 118, 64, 0.38)', stroke: 'rgba(140, 84, 36, 0.85)' },
    ice: { fill: 'rgba(164, 214, 255, 0.32)', stroke: 'rgba(110, 168, 235, 0.75)' },
    tar: { fill: 'rgba(47, 34, 34, 0.45)', stroke: 'rgba(72, 50, 45, 0.9)' },
    wind: { fill: 'rgba(156, 120, 255, 0.28)', stroke: 'rgba(123, 82, 231, 0.85)' },
    default: { fill: 'rgba(255, 255, 255, 0.25)', stroke: 'rgba(200, 200, 200, 0.7)' },
  };
  const FEATURE_TEXTURE_KEYS = {
    boost: 'surface:boost',
    puddle: 'surface:water',
    dirt: 'surface:dirt',
    ice: 'surface:ice',
    tar: 'surface:tar',
    wind: 'surface:wind',
  };
  const BG_COLORS = {
    top: '#0d1424',
    mid: '#182440',
    bottom: '#2c3f6b',
    glow: 'rgba(255, 255, 255, 0.09)'
  };
  let backgroundGradient = null;
  let backgroundSize = { w: 0, h: 0 };

  let touchSteerValue = 0;
  let touchSteerActive = false;
  let touchThrottleValue = 0;
  let touchThrottleActive = false;
  let touchBrakeValue = 0;
  let touchBrakeActive = false;
  let steerTouchId = null;
  let throttleTouchId = null;
  let brakeTouchId = null;
  const TEXTURE_CACHE = new Map();

  function createPattern(size, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    draw(g, size);
    return g.createPattern(canvas, 'repeat');
  }

  function ensureTexture(key, factory) {
    if (TEXTURE_CACHE.has(key)) return TEXTURE_CACHE.get(key);
    const pattern = factory();
    TEXTURE_CACHE.set(key, pattern);
    return pattern;
  }

  function getTexture(key) {
    switch (key) {
      case 'asphalt':
        return ensureTexture('asphalt', () => createPattern(256, (g, s) => {
          g.fillStyle = '#2d3035';
          g.fillRect(0, 0, s, s);
          const grad = g.createLinearGradient(0, 0, s, s);
          grad.addColorStop(0, 'rgba(255,255,255,0.04)');
          grad.addColorStop(1, 'rgba(0,0,0,0.18)');
          g.fillStyle = grad;
          g.fillRect(0, 0, s, s);
          for (let i = 0; i < 1500; i++) {
            const x = Math.random() * s;
            const y = Math.random() * s;
            const alpha = Math.random() * 0.08;
            const tone = 160 + Math.random() * 60;
            g.fillStyle = `rgba(${tone},${tone},${tone},${alpha})`;
            g.fillRect(x, y, 1, 1);
          }
          g.strokeStyle = 'rgba(70,70,78,0.22)';
          g.lineWidth = 2;
          for (let i = 0; i < 10; i++) {
            g.beginPath();
            g.moveTo(Math.random() * s, 0);
            g.lineTo(Math.random() * s, s);
            g.stroke();
          }
        }));
      case 'grass':
        return ensureTexture('grass', () => createPattern(256, (g, s) => {
          const base = g.createLinearGradient(0, 0, 0, s);
          base.addColorStop(0, '#4f7b2a');
          base.addColorStop(1, '#2d5712');
          g.fillStyle = base;
          g.fillRect(0, 0, s, s);
          g.lineWidth = 1;
          for (let i = 0; i < 2200; i++) {
            const x = Math.random() * s;
            const y = Math.random() * s;
            const len = 6 + Math.random() * 10;
            const angle = Math.random() * Math.PI * 2;
            const hue = 90 + Math.random() * 30;
            g.strokeStyle = `hsla(${hue},50%,${40 + Math.random() * 10}%,0.45)`;
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
            g.stroke();
          }
        }));
      case 'surface:dirt':
        return ensureTexture('surface:dirt', () => createPattern(192, (g, s) => {
          g.fillStyle = '#5f4729';
          g.fillRect(0, 0, s, s);
          for (let i = 0; i < 1200; i++) {
            const x = Math.random() * s;
            const y = Math.random() * s;
            const r = Math.random() * 2 + 0.5;
            const alpha = 0.1 + Math.random() * 0.15;
            const hue = 32 + Math.random() * 8;
            g.fillStyle = `hsla(${hue},40%,40%,${alpha})`;
            g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
          }
          g.strokeStyle = 'rgba(0,0,0,0.08)';
          g.lineWidth = 1;
          for (let i = 0; i < 180; i++) {
            g.beginPath();
            g.moveTo(Math.random() * s, Math.random() * s);
            g.lineTo(Math.random() * s, Math.random() * s);
            g.stroke();
          }
        }));
      case 'surface:ice':
        return ensureTexture('surface:ice', () => createPattern(192, (g, s) => {
          const grad = g.createLinearGradient(0, 0, s, s);
          grad.addColorStop(0, '#d8f5ff');
          grad.addColorStop(1, '#8cc2ff');
          g.fillStyle = grad;
          g.fillRect(0, 0, s, s);
          g.strokeStyle = 'rgba(255,255,255,0.25)';
          g.lineWidth = 1.2;
          for (let i = 0; i < 140; i++) {
            g.beginPath();
            g.moveTo(Math.random() * s, Math.random() * s);
            g.lineTo(Math.random() * s, Math.random() * s);
            g.stroke();
          }
          g.globalAlpha = 0.25;
          for (let i = 0; i < 40; i++) {
            const x = Math.random() * s;
            const y = Math.random() * s;
            const r = 6 + Math.random() * 20;
            const grad2 = g.createRadialGradient(x, y, 0, x, y, r);
            grad2.addColorStop(0, 'rgba(255,255,255,0.4)');
            grad2.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = grad2;
            g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
          }
          g.globalAlpha = 1;
        }));
      case 'surface:tar':
        return ensureTexture('surface:tar', () => createPattern(192, (g, s) => {
          g.fillStyle = '#1c1619';
          g.fillRect(0, 0, s, s);
          g.strokeStyle = 'rgba(120,80,60,0.18)';
          g.lineWidth = 3;
          for (let i = 0; i < 40; i++) {
            g.beginPath();
            const x = Math.random() * s;
            const y = Math.random() * s;
            g.bezierCurveTo(x, y, x + 20, y + 8, x + 10, y + 28);
            g.stroke();
          }
        }));
      case 'surface:water':
        return ensureTexture('surface:water', () => createPattern(192, (g, s) => {
          const base = g.createLinearGradient(0, 0, s, s);
          base.addColorStop(0, 'rgba(70,140,255,0.6)');
          base.addColorStop(1, 'rgba(20,60,180,0.6)');
          g.fillStyle = base;
          g.fillRect(0, 0, s, s);
          g.strokeStyle = 'rgba(255,255,255,0.28)';
          g.lineWidth = 1;
          for (let i = 0; i < 60; i++) {
            const cx = Math.random() * s;
            const cy = Math.random() * s;
            const r = 12 + Math.random() * 28;
            g.beginPath();
            g.arc(cx, cy, r, 0, Math.PI * 2);
            g.stroke();
          }
        }));
      case 'surface:boost':
        return ensureTexture('surface:boost', () => createPattern(128, (g, s) => {
          g.fillStyle = 'rgba(0, 80, 60, 0.55)';
          g.fillRect(0, 0, s, s);
          g.strokeStyle = 'rgba(0, 255, 170, 0.65)';
          g.lineWidth = 3;
          for (let i = 0; i < 6; i++) {
            g.beginPath();
            const y = (i / 6) * s;
            g.moveTo(0, y);
            g.lineTo(s, y + 10);
            g.stroke();
          }
        }));
      case 'surface:wind':
        return ensureTexture('surface:wind', () => createPattern(160, (g, s) => {
          g.fillStyle = 'rgba(120, 100, 200, 0.35)';
          g.fillRect(0, 0, s, s);
          g.strokeStyle = 'rgba(220, 200, 255, 0.4)';
          g.lineWidth = 2;
          for (let i = 0; i < 24; i++) {
            g.beginPath();
            const y = Math.random() * s;
            g.moveTo(-20, y);
            g.quadraticCurveTo(s * 0.5, y + 20 * (Math.random() - 0.5), s + 20, y);
            g.stroke();
          }
        }));
      default:
        return null;
    }
  }

  function fitCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // minimap
    const mw = mini.clientWidth || 200;
    const mh = mini.clientHeight || 200;
    mini.width = Math.round(mw * dpr);
    mini.height = Math.round(mh * dpr);
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    backgroundGradient = null;
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  function ensureBackgroundGradient() {
    const w = canvas.width;
    const h = canvas.height;
    if (!backgroundGradient || backgroundSize.w !== w || backgroundSize.h !== h) {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, BG_COLORS.top);
      grad.addColorStop(0.45, BG_COLORS.mid);
      grad.addColorStop(1, BG_COLORS.bottom);
      backgroundGradient = grad;
      backgroundSize = { w, h };
    }
    return backgroundGradient;
  }

  function getStoredProfile() {
    const rawName = localStorage.getItem('profileName') || '';
    const name = sanitizeName(rawName);
    if (rawName && name !== rawName) localStorage.setItem('profileName', name);
    const rawShape = localStorage.getItem('profileShape');
    const shape = normalizeShape(rawShape);
    if (rawShape && shape !== rawShape) localStorage.setItem('profileShape', shape);
    return {
      n: name,
      c: localStorage.getItem('profileColor') || '#2196F3',
      a: localStorage.getItem('profileAccent') || '#ffffff',
      s: shape,
      rawShape,
    };
  }

  // Tabs
  function showTab(name) {
    if (tabServers) tabServers.classList.toggle('hidden', name !== 'servers');
    if (tabLeaderboard) tabLeaderboard.classList.toggle('hidden', name !== 'leaderboard');
    if (tabCampaign) tabCampaign.classList.toggle('hidden', name !== 'campaign');
    if (tabCampaign) tabCampaign.classList.toggle('hidden', name !== 'campaign');
    if (tabHelp) tabHelp.classList.toggle('hidden', name !== 'help');
    if (tabCustomize) tabCustomize.classList.toggle('hidden', name !== 'customize');
    if (tabCustom) tabCustom.classList.toggle('hidden', name !== 'custom');
    tabs.forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  }
  tabs.forEach(b => b && b.addEventListener('click', () => showTab(b.dataset.tab)));
  showTab('servers');

  // Campaign
  async function fetchCampaign() {
    try {
      const res = await fetch('/api/campaign/events');
      const rows = await res.json();
      campaignListEl.innerHTML = '';
      for (const ev of rows) {
        const el = document.createElement('div');
        el.className = 'room';
        el.innerHTML = `
          <div><strong>${escapeHtml(ev.name)}</strong></div>
          <div class="muted">AI: ${ev.bots}</div>
          <div></div>
          <div><button data-id="${ev.id}">Start</button></div>
        `;
        el.querySelector('button').addEventListener('click', () => startCampaign(ev.id));
        campaignListEl.appendChild(el);
      }
    } catch (e) { /* ignore */ }
  }
  async function startCampaign(eventId) {
    const prof = loadProfile();
    const playerName = (prof.n || '').trim();
    if (!playerName) { alert('Set your name in Customizations first.'); showTab('customize'); return; }
    const res = await fetch('/api/campaign/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: eventId, name: playerName }) });
    const data = await res.json();
    if (data && data.id) joinRoom(data.id);
  }
  // Preload campaign list
  if (campaignListEl) fetchCampaign();

  // Profile persistence
  function loadProfile() {
    const stored = getStoredProfile();
    const { n, c, a, s } = stored;
    if (nameInput) nameInput.value = n;
    if (colorInput) colorInput.value = c;
    if (accentInput) accentInput.value = a;
    if (shapeSelect) shapeSelect.value = s;
    return stored;
  }
  function getEffectiveProfile() {
    const stored = getStoredProfile();
    let name = sanitizeName((nameInput && nameInput.value) || '');
    let color = (colorInput && colorInput.value) || '';
    let accent = (accentInput && accentInput.value) || '';
    const shapeSelection = (shapeSelect && shapeSelect.value) || '';

    if (!name) name = stored.n;
    if (!color) color = stored.c;
    if (!accent) accent = stored.a;
    const shape = normalizeShape(shapeSelection || stored.s || DEFAULT_SHAPE);

    if (!stored.n && name) localStorage.setItem('profileName', name);
    if (!stored.c && color) localStorage.setItem('profileColor', color);
    if (!stored.a && accent) localStorage.setItem('profileAccent', accent);
    if (!stored.rawShape && shape) localStorage.setItem('profileShape', shape);

    return { n: name, c: color, a: accent, s: shape };
  }
  function saveProfile() {
    const n = sanitizeName(nameInput.value || '');
    const c = colorInput.value || '#2196F3';
    const a = (accentInput && accentInput.value) || '#ffffff';
    const s = normalizeShape((shapeSelect && shapeSelect.value) || DEFAULT_SHAPE);
    localStorage.setItem('profileName', n);
    localStorage.setItem('profileColor', c);
    localStorage.setItem('profileAccent', a);
    localStorage.setItem('profileShape', s);
    alert('Saved');
  }
  loadProfile();
  if (saveProfileBtn) saveProfileBtn.addEventListener('click', saveProfile);
  // Force first-time users to customize
  (function enforceProfile(){
    const { n } = loadProfile();
    if (!n) showTab('customize');
  })();

  // Custom room handlers
  if (cCreateBtn) {
    cCreateBtn.addEventListener('click', async () => {
      const payload = {
        name: (cName.value || '').trim() || 'Custom',
        password: (cPassword.value || '').trim(),
        maxPlayers: Number(cMaxPlayers.value || 8),
        durationMin: Number(cDuration.value || 5),
        minPlayers: Number(cMinPlayers.value || 2),
        aiCount: Number(cAiCount.value || 0),
        aiLevel: (cAiLevel.value || 'medium')
      };
      const res = await fetch('/api/custom/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data && data.id) joinRoom(data.id, { password: payload.password });
    });
  }
  if (jJoinBtn) {
    jJoinBtn.addEventListener('click', () => {
      const id = (jRoomId.value || '').trim();
      const pw = (jPassword.value || '').trim();
      if (id) joinRoom(id, { password: pw });
    });
  }

  // Camera zoom helpers
  function setZoom(z) {
    cameraZoom = clamp(z, ZOOM_MIN, ZOOM_MAX);
  }
  function zoomByFactor(f) { setZoom(cameraZoom * f); }
  window.setZoom = setZoom;
  window.zoomIn = () => zoomByFactor(1.1);
  window.zoomOut = () => zoomByFactor(1/1.1);

  // Mouse wheel zoom on canvas
  canvas.addEventListener('wheel', (e) => {
    if (!track) return;
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1/1.1 : 1.1;
    zoomByFactor(factor);
  }, { passive: false });

  function msToClock(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, '0');
    return `${m}:${ss}`;
  }
  function msShort(ms) {
    const s = Math.max(0, ms / 1000);
    const minutes = Math.floor(s / 60);
    const sec = (s % 60).toFixed(1);
    return minutes > 0 ? `${minutes}:${String(sec).padStart(4,'0')}` : `${sec}s`;
  }
  function formatLapTime(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return '—';
    return msShort(ms);
  }
  function formatLapDiff(ms) {
    if (!Number.isFinite(ms)) return '';
    if (Math.abs(ms) < 1) return '';
    const sign = ms > 0 ? '+' : '−';
    return `${sign}${msShort(Math.abs(ms))}`;
  }

  function renderRooms(rooms) {
    lastRooms = rooms || [];
    const q = ((searchRoomsInput && searchRoomsInput.value) || '').toLowerCase();
    if (q) rooms = lastRooms.filter(r => (r.name||'').toLowerCase().includes(q) || (r.id||'').toLowerCase().includes(q));
    roomsEl.innerHTML = '';
    if (!rooms || rooms.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'No rooms yet. Create one!';
      roomsEl.appendChild(empty);
      return;
    }
    for (const r of rooms) {
      const locked = r.state === 'running';
      const el = document.createElement('div');
      el.className = 'room';
      el.innerHTML = `
        <div><strong>${r.hasPassword ? '🔒 ' : ''}${escapeHtml(r.name)}</strong><div class="muted">${r.id}</div></div>
        <div class="muted">${r.players}/${r.maxPlayers}</div>
        <div class="muted">${msToClock(r.timeRemaining)}</div>
        <div>
          ${locked ? `<button class="secondary" data-spec="${r.id}">Spectate</button>` : `<button data-id="${r.id}">Join</button>`}
        </div>
      `;
      const btn = el.querySelector('button[data-id]');
      if (btn) btn.addEventListener('click', () => {
        let pw = undefined;
        if (r.hasPassword) {
          pw = prompt('This room is locked. Enter password:') || '';
        }
        joinRoom(r.id, { password: pw });
      });
      const spec = el.querySelector('button[data-spec]');
      if (spec) spec.addEventListener('click', () => joinRoom(r.id, { spectate: true }));
      roomsEl.appendChild(el);
    }
  }

  async function fetchRooms() {
    const res = await fetch('/api/rooms');
    renderRooms(await res.json());
  }
  if (searchRoomsInput) searchRoomsInput.addEventListener('input', () => renderRooms(lastRooms));

  function compareGlobal(a, b, key, dir) {
    const direction = dir === 'asc' ? 1 : -1;
    if (key === 'name') {
      return direction * a.name.localeCompare(b.name);
    }
    const get = (row, prop) => Number(row[prop]) || 0;
    let valA;
    let valB;
    switch (key) {
      case 'wins':
      case 'races':
      case 'winRate':
      case 'avgLaps':
      case 'score':
        valA = get(a, key);
        valB = get(b, key);
        break;
      case 'bestLap':
        valA = a.bestLapMs != null ? a.bestLapMs : Infinity;
        valB = b.bestLapMs != null ? b.bestLapMs : Infinity;
        break;
      default:
        valA = get(a, 'score');
        valB = get(b, 'score');
        break;
    }
    if (valA === valB && key !== 'name') {
      return direction * a.name.localeCompare(b.name);
    }
    return direction * (valA - valB);
  }

  function updateGlobalSortButtons() {
    for (const btn of globalLbSortButtons) {
      const key = btn.dataset.glSort;
      const baseLabel = GLOBAL_SORT_LABELS[key] || btn.dataset.label || key.toUpperCase();
      const active = key === globalLbSortState.key;
      btn.classList.toggle('active', active);
      if (active) {
        btn.dataset.dir = globalLbSortState.dir;
        btn.innerHTML = `${baseLabel} ${globalLbSortState.dir === 'desc' ? '↓' : '↑'}`;
      } else {
        btn.dataset.dir = '';
        btn.innerHTML = baseLabel;
      }
    }
  }

  function renderGlobalLb(rows) {
    if (!globalLbEl) return;
    if (Array.isArray(rows)) {
      globalLbData = rows.slice();
    }
    const total = globalLbData.length;
    const term = (globalLbSearchInput && globalLbSearchInput.value || '').trim().toLowerCase();
    const filtered = term ? globalLbData.filter(r => (r.name || '').toLowerCase().includes(term)) : globalLbData.slice();
    const sorted = filtered.slice().sort((a, b) => compareGlobal(a, b, globalLbSortState.key, globalLbSortState.dir));
    const display = sorted.slice(0, 50);
    const myProfile = getStoredProfile();
    const myName = (myProfile.n || '').toLowerCase();
    const displayedNames = new Set(display.map(r => (r.name || '').toLowerCase()));
    const myRow = myName ? globalLbData.find((r) => (r.name || '').toLowerCase() === myName) : null;

    globalLbEl.innerHTML = '';
    const useScoreRank = globalLbSortState.key === 'score';

    if (display.length === 0) {
      const el = document.createElement('div');
      el.className = 'muted';
      el.textContent = total === 0 ? 'No stats yet' : 'No players match your search';
      globalLbEl.appendChild(el);
    } else {
      const header = document.createElement('div');
      header.className = 'gl-row gl-header';
      header.innerHTML = `
        <div class="gl-rank">#</div>
        <div class="gl-name">Player</div>
        <div class="gl-stat">Wins</div>
        <div class="gl-stat">Win%</div>
        <div class="gl-stat">Avg L</div>
        <div class="gl-stat gl-best">Best</div>
        <div class="gl-stat">Races</div>
        <div class="gl-score">Score</div>
      `;
      globalLbEl.appendChild(header);
      display.forEach((r, idx) => {
        const rankDisplay = useScoreRank ? (r.rank|0) : (idx + 1);
        const highlightTop = useScoreRank && (r.rank|0) <= 3;
        const isYouRow = myName && r.name && r.name.toLowerCase() === myName;
        const best = formatLapTime(r.bestLapMs);
        const row = document.createElement('div');
        row.className = `gl-row${highlightTop ? ' gl-top' : ''}${isYouRow ? ' gl-you' : ''}`;
        row.innerHTML = `
          <div class="gl-rank">${rankDisplay}</div>
          <div class="gl-name">${escapeHtml(r.name)}</div>
          <div class="gl-stat">${r.wins|0}</div>
          <div class="gl-stat">${formatWinRate(r.winRate)}</div>
          <div class="gl-stat">${formatAvgLaps(r.avgLaps)}</div>
          <div class="gl-stat gl-best">${best}</div>
          <div class="gl-stat">${r.races|0}</div>
          <div class="gl-score">${Number(r.score || 0).toFixed(2)}</div>
        `;
        globalLbEl.appendChild(row);
      });
    }

    if (myRow && !displayedNames.has(myName)) {
      const best = formatLapTime(myRow.bestLapMs);
      const youRow = document.createElement('div');
      youRow.className = 'gl-row gl-you';
      youRow.innerHTML = `
        <div class="gl-rank">${myRow.rank|0}</div>
        <div class="gl-name">${escapeHtml(myRow.name)} • you</div>
        <div class="gl-stat">${myRow.wins|0}</div>
        <div class="gl-stat">${formatWinRate(myRow.winRate)}</div>
        <div class="gl-stat">${formatAvgLaps(myRow.avgLaps)}</div>
        <div class="gl-stat gl-best">${best}</div>
        <div class="gl-stat">${myRow.races|0}</div>
        <div class="gl-score">${Number(myRow.score || 0).toFixed(2)}</div>
      `;
      globalLbEl.appendChild(youRow);
    }

    if (globalLbSummaryEl) {
      const showing = display.length;
      const matching = filtered.length;
      const sortLabel = `${GLOBAL_SORT_LABELS[globalLbSortState.key] || globalLbSortState.key.toUpperCase()} ${globalLbSortState.dir === 'desc' ? '↓' : '↑'}`;
      let fastestLap = null;
      for (const row of filtered) {
        if (Number.isFinite(row.bestLapMs) && row.bestLapMs > 0) {
          if (fastestLap == null || row.bestLapMs < fastestLap) fastestLap = row.bestLapMs;
        }
      }
      const fastestText = fastestLap != null ? formatLapTime(fastestLap) : '—';
      globalLbSummaryEl.textContent = `Showing ${showing} of ${matching} players • Total recorded: ${total} • Sort: ${sortLabel} • Fastest lap: ${fastestText}`;
    }

    updateGlobalSortButtons();
  }

  refreshBtn.addEventListener('click', fetchRooms);
  // Live lobby updates via Socket.IO
  try {
    const lobbySocket = io('/lobby', { transports: ['websocket','polling'] });
    lobbySocket.on('rooms', (rooms) => renderRooms(rooms));
    lobbySocket.on('leaderboard', (rows) => renderGlobalLb(rows));
  } catch (e) { /* fallback to manual refresh if socket fails */ }
  createBtn.addEventListener('click', async () => {
    const name = (roomNameInput.value || '').trim() || 'Race';
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (data && data.id) joinRoom(data.id);
  });

  let isSpectator = false;
  function joinRoom(roomId, opts = {}) {
    const profile = getEffectiveProfile();
    let profName = sanitizeName(profile.n || '');
    let profColor = profile.c || '#2196F3';
    let profAccent = profile.a || '#ffffff';
    let profShape = normalizeShape(profile.s);
    if (!profName) {
      const entered = sanitizeName(prompt('Enter your name to play:') || '');
      if (!entered) { showTab('customize'); return; }
      profName = entered; localStorage.setItem('profileName', profName); if (nameInput) nameInput.value = profName;
    }
    if (!profColor) { profColor = '#2196F3'; localStorage.setItem('profileColor', profColor); if (colorInput) colorInput.value = profColor; }
    const playerName = profName; // always use saved profile name
    const color = profColor;     // always use saved profile color
    const isRailway = /railway\.app$/i.test(location.hostname) || location.hostname.includes('railway');
    const transports = isRailway ? ['polling','websocket'] : ['websocket','polling'];
    socket = io({ transports });
    socket.emit('join', { roomId, name: playerName, color, accent: profAccent, shape: profShape, spectate: !!opts.spectate, password: opts.password }, (ack) => {
      if (!ack || !ack.ok) {
        alert('Failed to join: ' + (ack && ack.error));
        return;
      }
      currentRoom = ack.room;
      you = ack.you;
      if (you && you.bestLapMs != null) you.bestLapMs = Number(you.bestLapMs);
      isSpectator = !!ack.spectator;
      browserPanel.classList.add('hidden');
      hudEl.classList.remove('hidden');
      speedDialEl.classList.remove('hidden');
      mini.classList.remove('hidden');
      if (bestLapEl) bestLapEl.classList.remove('hidden');
      if (lapCounterEl) lapCounterEl.classList.remove('hidden');
      if (chatEl && ack.chat) { chatLogEl.innerHTML=''; ack.chat.forEach(appendChat); }
      // Show touch controls on touch devices
      if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        touchEl.classList.remove('hidden');
      }
      // Listeners (attach only after success)
      socket.on('chat', (m) => appendChat(m));
      socket.on('state', (state) => {
        world.timeRemaining = state.timeRemaining;
        world.state = state.state || world.state || 'running';
        track = state.track;
        world.players = state.players;
        lastStateAt = performance.now();
        // Finish overlay (humans only)
        if (world.state === 'finished') {
          if (!isSpectator) showFinish(state); else hideFinish();
        } else {
          hideFinish();
        }
        // Show chat only while waiting; hide and clear at countdown
        if (chatEl) {
          if (world.state === 'waiting') { chatEl.classList.remove('hidden'); }
          else { chatEl.classList.add('hidden'); if (chatLogEl) chatLogEl.innerHTML=''; }
        }
        // update entities map for interpolation
        for (const p of state.players) {
          const prev = entities.get(p.id) || { x: p.x, y: p.y, angle: p.angle };
          const isYou = you && p.id === you.id;
          if (isYou) {
            meServer = { x: p.x, y: p.y, angle: p.angle };
            if (!meLocal) meLocal = { x: p.x, y: p.y, angle: p.angle, vx: 0, vy: 0, steer: 0 };
          }
          entities.set(p.id, {
            x: lerp(prev.x, p.x, 0.6),
            y: lerp(prev.y, p.y, 0.6),
            angle: angleLerp(prev.angle, p.angle, 0.6),
            color: p.color,
            name: p.name,
            accent: p.accent || '#ffffff',
            shape: p.shape || 'capsule',
            laps: p.laps || 0,
            speed: p.speed || 0,
            throttle: !!p.throttle,
            brake: !!p.brake,
          });
        }
        // clean up removed
        const ids = new Set(state.players.map(p => p.id));
        for (const id of Array.from(entities.keys())) {
          if (!ids.has(id)) entities.delete(id);
        }
      });
    });

    // Input handling
    const input = { throttle: 0, brake: 0, steer: 0 };
    const keys = new Set();
    window.addEventListener('keydown', (e) => {
      // If typing in chat, don't capture or block keys
      if (document.activeElement === chatInputEl) return;
      keys.add(e.key.toLowerCase());
      keysDown.add(e.key.toLowerCase());
      if (e.key === ' ') e.preventDefault();
      // Zoom via +/- keys
      if (e.key === '=' || e.key === '+') { zoomByFactor(1.1); e.preventDefault(); }
      if (e.key === '-' || e.key === '_') { zoomByFactor(1/1.1); e.preventDefault(); }
      if (e.key.toLowerCase() === 'r' && socket) { socket.emit('reset'); }
    });
    window.addEventListener('keyup', (e) => {
      if (document.activeElement === chatInputEl) return;
      keys.delete(e.key.toLowerCase());
      keysDown.delete(e.key.toLowerCase());
    });

    // Touch control helpers
    const SUPPORTS_POINTER = typeof window.PointerEvent !== 'undefined';

    function updateJoystickVisual(x, y) {
      if (!joystickThumb) return;
      joystickThumb.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    }

    function resetJoystick() {
      touchSteerValue = 0;
      touchSteerActive = false;
      steerTouchId = null;
      updateJoystickVisual(0, 0);
    }

    function updateSteerFromPoint(clientX, clientY) {
      if (!joystickBase) return;
      const rect = joystickBase.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const maxRadius = rect.width / 2;
      const distance = Math.hypot(dx, dy) || 1;
      const clampRadius = Math.min(distance, maxRadius);
      const normX = clamp(dx / maxRadius, -1, 1);
      touchSteerValue = clamp(normX, -1, 1);
      const displayX = (dx / distance) * clampRadius;
      const displayY = (dy / distance) * clampRadius;
      updateJoystickVisual(displayX, displayY);
    }

    function handleSteerPointerDown(ev) {
      if (!joystickBase) return;
      joystickBase.setPointerCapture(ev.pointerId);
      steerTouchId = ev.pointerId;
      touchSteerActive = true;
      updateSteerFromPoint(ev.clientX, ev.clientY);
      ev.preventDefault();
    }

    function handleSteerPointerMove(ev) {
      if (ev.pointerId !== steerTouchId) return;
      updateSteerFromPoint(ev.clientX, ev.clientY);
      ev.preventDefault();
    }

    function handleSteerPointerEnd(ev) {
      if (ev.pointerId !== steerTouchId) return;
      if (joystickBase) joystickBase.releasePointerCapture(ev.pointerId);
      resetJoystick();
      ev.preventDefault();
    }

    function attachJoystick() {
      if (!joystickBase) return;
      if (SUPPORTS_POINTER) {
        joystickBase.addEventListener('pointerdown', handleSteerPointerDown, { passive: false });
        joystickBase.addEventListener('pointermove', handleSteerPointerMove, { passive: false });
        joystickBase.addEventListener('pointerup', handleSteerPointerEnd, { passive: false });
        joystickBase.addEventListener('pointercancel', handleSteerPointerEnd, { passive: false });
      } else {
        joystickBase.addEventListener('touchstart', (ev) => {
          if (steerTouchId != null) return;
          const t = ev.changedTouches[0];
          steerTouchId = t.identifier;
          touchSteerActive = true;
          updateSteerFromPoint(t.clientX, t.clientY);
          ev.preventDefault();
        }, { passive: false });
        joystickBase.addEventListener('touchmove', (ev) => {
          if (steerTouchId == null) return;
          for (const t of ev.changedTouches) {
            if (t.identifier === steerTouchId) {
              updateSteerFromPoint(t.clientX, t.clientY);
              ev.preventDefault();
              return;
            }
          }
        }, { passive: false });
        const endHandler = (ev) => {
          if (steerTouchId == null) return;
          for (const t of ev.changedTouches) {
            if (t.identifier === steerTouchId) {
              resetJoystick();
              ev.preventDefault();
              return;
            }
          }
        };
        joystickBase.addEventListener('touchend', endHandler, { passive: false });
        joystickBase.addEventListener('touchcancel', endHandler, { passive: false });
      }
      joystickBase.addEventListener('mouseleave', () => { if (!touchSteerActive) resetJoystick(); });
      joystickBase.addEventListener('mouseup', () => { if (!touchSteerActive) resetJoystick(); });
    }

    function updatePedalVisual(pedal, fill, value) {
      if (fill) fill.style.height = `${Math.round(value * 100)}%`;
      if (!pedal) return;
      pedal.style.transform = value > 0.01 ? 'scale(0.98)' : 'scale(1)';
    }

    function updateThrottleFromPoint(clientY) {
      if (!pedalAccel) return;
      const rect = pedalAccel.getBoundingClientRect();
      const ratio = 1 - clamp((clientY - rect.top) / rect.height, 0, 1);
      touchThrottleValue = clamp(ratio, 0, 1);
      touchThrottleActive = touchThrottleValue > 0.02;
      updatePedalVisual(pedalAccel, pedalAccelFill, touchThrottleValue);
    }

    function updateBrakeFromPoint(clientY) {
      if (!pedalBrake) return;
      const rect = pedalBrake.getBoundingClientRect();
      const ratio = clamp((clientY - rect.top) / rect.height, 0, 1);
      touchBrakeValue = clamp(1 - ratio, 0, 1);
      touchBrakeActive = touchBrakeValue > 0.02;
      updatePedalVisual(pedalBrake, pedalBrakeFill, touchBrakeValue);
    }

    function attachPedal(pedal, getId, setId, updateFn, resetFn) {
      if (!pedal) return;
      if (SUPPORTS_POINTER) {
        pedal.addEventListener('pointerdown', (ev) => {
          pedal.setPointerCapture(ev.pointerId);
          setId(ev.pointerId);
          updateFn(ev.clientY);
          ev.preventDefault();
        }, { passive: false });
        pedal.addEventListener('pointermove', (ev) => {
          if (ev.pointerId !== getId()) return;
          updateFn(ev.clientY);
          ev.preventDefault();
        }, { passive: false });
        pedal.addEventListener('pointerup', (ev) => {
          if (ev.pointerId !== getId()) return;
          pedal.releasePointerCapture(ev.pointerId);
          resetFn();
          ev.preventDefault();
        }, { passive: false });
        pedal.addEventListener('pointercancel', (ev) => {
          if (ev.pointerId !== getId()) return;
          pedal.releasePointerCapture(ev.pointerId);
          resetFn();
          ev.preventDefault();
        }, { passive: false });
      } else {
        pedal.addEventListener('touchstart', (ev) => {
          if (getId() != null) return;
          const t = ev.changedTouches[0];
          setId(t.identifier);
          updateFn(t.clientY);
          ev.preventDefault();
        }, { passive: false });
        pedal.addEventListener('touchmove', (ev) => {
          if (getId() == null) return;
          for (const t of ev.changedTouches) {
            if (t.identifier === getId()) {
              updateFn(t.clientY);
              ev.preventDefault();
              return;
            }
          }
        }, { passive: false });
        const endHandler = (ev) => {
          if (getId() == null) return;
          for (const t of ev.changedTouches) {
            if (t.identifier === getId()) {
              resetFn();
              ev.preventDefault();
              return;
            }
          }
        };
        pedal.addEventListener('touchend', endHandler, { passive: false });
        pedal.addEventListener('touchcancel', endHandler, { passive: false });
      }
      pedal.addEventListener('mouseleave', () => resetFn());
      pedal.addEventListener('mouseup', () => resetFn());
    }

    attachJoystick();
    attachPedal(
      pedalAccel,
      () => throttleTouchId,
      (id) => { throttleTouchId = id; },
      updateThrottleFromPoint,
      () => {
        throttleTouchId = null;
        touchThrottleValue = 0;
        touchThrottleActive = false;
        updatePedalVisual(pedalAccel, pedalAccelFill, 0);
      },
    );
    attachPedal(
      pedalBrake,
      () => brakeTouchId,
      (id) => { brakeTouchId = id; },
      updateBrakeFromPoint,
      () => {
        brakeTouchId = null;
        touchBrakeValue = 0;
        touchBrakeActive = false;
        updatePedalVisual(pedalBrake, pedalBrakeFill, 0);
      },
    );

    setInterval(() => {
      if (isSpectator) return;
      const digitalThrottle = (keys.has('w') || keys.has('arrowup')) ? 1 : 0;
      const digitalBrake = (keys.has('s') || keys.has('arrowdown')) ? 1 : 0;
      const digitalLeft = (keys.has('a') || keys.has('arrowleft')) ? 1 : 0;
      const digitalRight = (keys.has('d') || keys.has('arrowright')) ? 1 : 0;

      const steerAnalog = touchSteerActive ? touchSteerValue : 0;
      const throttleAnalog = touchThrottleActive ? touchThrottleValue : 0;
      const brakeAnalog = touchBrakeActive ? touchBrakeValue : 0;

      input.throttle = Math.max(digitalThrottle, throttleAnalog);
      input.brake = Math.max(digitalBrake, brakeAnalog);

      const steerDigital = clamp(digitalRight - digitalLeft, -1, 1);
      const steerCombined = touchSteerActive ? steerAnalog : steerDigital;
      input.steer = clamp(steerCombined, -1, 1);
      socket.emit('input', input);
    }, 1000 / 30);

    requestAnimationFrame(loop);
  }

  function loop() {
    const now = performance.now();
    let frameDt = (now - lastFrame) / 1000;
    if (!Number.isFinite(frameDt) || frameDt < 0) frameDt = 0;
    if (frameDt > 0.25) frameDt = 0.25; // guard after tab restore
    lastFrame = now;
    simAcc += frameDt;
    if (simAcc > 0.3) simAcc = 0.3; // prevent spiral of death

    if (track && you && meLocal && world.state === 'running') {
      let steps = 0;
      while (simAcc >= DT_FIXED && steps < 24) { // cap steps per frame
        simulateLocal(DT_FIXED);
        simAcc -= DT_FIXED;
        steps++;
      }
    }
    if (world.state !== 'running') {
      meLocal = null;
    }
    draw();
    requestAnimationFrame(loop);
  }

  function draw() {
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = ensureBackgroundGradient();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const vignette = ctx.createRadialGradient(canvas.width * 0.5, canvas.height * 0.5, Math.min(canvas.width, canvas.height) * 0.35, canvas.width * 0.5, canvas.height * 0.5, Math.max(canvas.width, canvas.height) * 0.72);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.save();
    ctx.fillStyle = vignette;
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    // Early if no track
    if (!track) return;

    // Compute world bounds and camera scale baseline (fit-to-track)
    const margin = 200;
    const eamp = (track.ellipseE ? Math.abs(track.ellipseE) : 0) * track.baseRadius;
    const tMax = track.baseRadius + eamp + track.width / 2 + sumAmps(track.noises) + margin;
    const worldSize = tMax * 2;
    const baseScale = Math.min(canvas.clientWidth / worldSize, canvas.clientHeight / worldSize);
    const scale = baseScale * cameraZoom;
    const cx = canvas.clientWidth / 2;
    const cy = canvas.clientHeight / 2;

    // Camera target: your car; if spectator, follow the first player
    let target = { x: 0, y: 0 };
    if (you && entities.has(you.id)) {
      const me = entities.get(you.id);
      target = { x: me.x, y: me.y };
    } else if (world.players && world.players.length) {
      const p0 = world.players[0];
      const e0 = entities.get(p0.id) || p0;
      target = { x: e0.x, y: e0.y };
    }
    // Smooth follow
    camX += (target.x - camX) * CAM_SMOOTH;
    camY += (target.y - camY) * CAM_SMOOTH;

    // Draw background
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-camX, -camY);

    // Track and environment
    drawTrack(ctx, track);

    // Skid marks (fade over time)
    for (let i = skidMarks.length - 1; i >= 0; i--) {
      const m = skidMarks[i];
      m.life -= 1;
      if (m.life <= 0) { skidMarks.splice(i, 1); continue; }
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.angle);
      ctx.globalAlpha = Math.max(0, Math.min(0.25, m.life / 120 * 0.25));
      ctx.fillStyle = '#2b2b2b';
      ctx.fillRect(-CAR_L*0.48, -CAR_W*0.46, CAR_L*0.22, 1.8);
      ctx.fillRect(-CAR_L*0.48,  CAR_W*0.46-1.8, CAR_L*0.22, 1.8);
      ctx.restore();
    }

    // Players
    for (const p of world.players) {
      const e = entities.get(p.id) || p;
      const isYou = !!(you && p.id === you.id);
      const labelShape = e.shape || DEFAULT_SHAPE;
      const labelText = sanitizeName(e.name || '') || 'Racer';
      let drawX = e.x;
      let drawY = e.y;

      if (world.state === 'running' && isYou && meLocal && meServer) {
        // Blend local prediction with server authority for smoothness without input lag
        const alpha = 0.08; // softer corrections
        const dx = meServer.x - meLocal.x;
        const dy = meServer.y - meLocal.y;
        meLocal.x += dx * alpha; meLocal.y += dy * alpha;
        meLocal.angle = angleLerp(meLocal.angle, meServer.angle, alpha);
        drawX = meLocal.x;
        drawY = meLocal.y;
        drawCar(ctx, drawX, drawY, meLocal.angle, e.color || '#000', { throttle: e.throttle, brake: e.brake, accent: e.accent || '#fff', shape: labelShape });
        // Drop skid marks when slipping
        if (meLocal.slip && meLocal.slip > 0.7) {
          skidMarks.push({ x: meLocal.x, y: meLocal.y, angle: meLocal.angle, life: 160 });
          if (skidMarks.length > SKID_MAX) skidMarks.splice(0, skidMarks.length - SKID_MAX);
        }
      } else {
        drawCar(ctx, drawX, drawY, e.angle, e.color || '#000', { throttle: e.throttle, brake: e.brake, accent: e.accent || '#fff', shape: labelShape });
      }

      drawNameLabel(ctx, scale, drawX, drawY, labelText, {
        highlight: isYou,
        color: e.color || '#f5f5f5',
        shape: labelShape,
      });
    }

    ctx.restore();

    // HUD
    if (world && world.state === 'countdown') {
      timerEl.textContent = 'Starting in ' + msToClock(world.timeRemaining);
    } else if (world && world.state === 'running') {
      timerEl.textContent = '⏱ ' + msToClock(world.timeRemaining);
    } else {
      timerEl.textContent = 'Waiting for players';
    }
    // Center overlay during countdown
    if (!document.getElementById('centerOverlay')) {
      const co = document.createElement('div');
      co.id = 'centerOverlay';
      co.className = 'overlay';
      document.body.appendChild(co);
    }
    const overlay = document.getElementById('centerOverlay');
    if (world && world.state === 'countdown') {
      overlay.className = 'overlay show';
      const s = Math.ceil(world.timeRemaining / 1000);
      overlay.textContent = s > 0 ? String(s) : 'GO!';
    } else {
      overlay.className = 'overlay';
      overlay.textContent = '';
    }
    // Leaderboard with rank, gap, and best lap
    const top = world.players.slice(0, 8);
    if (top.length === 0) {
      leaderboardEl.innerHTML = '';
    } else {
      const leaderProgress = top[0].progress || 0;
      leaderboardEl.innerHTML = top.map((p, i) => {
        const col = p.color || '#000';
        const name = escapeHtml(p.name || '—');
        const laps = p.laps != null ? p.laps : (entities.get(p.id)?.laps || 0);
        const best = p.bestLapMs ? msShort(p.bestLapMs) : '—';
        const progress = p.progress || 0;
        const lapDiff = (leaderProgress - progress) / (Math.PI * 2);
        const gap = i === 0 ? 'Leader' : formatGap(lapDiff);
        const skill = skillLabel(p.skill || (p.isBot ? 'BOT' : 'HUM'));
        const isYouRow = !!(you && p.id === you.id);
        const rowClass = `lb-row${isYouRow ? ' me' : ''}${p.isBot ? ' bot' : ' human'}`;
        return `
          <div class="${rowClass}">
            <div class="lb-rank">${i + 1}</div>
            <div class="lb-name" style="color:${col}">
              ${name}
              <span class="lb-badge lb-${(p.skill || (p.isBot ? 'bot' : 'human')).toLowerCase()}">${skill}</span>
            </div>
            <div class="lb-gap">${gap}</div>
            <div class="lb-best">${best}</div>
            <div class="lb-lap">L${laps}</div>
          </div>
        `;
      }).join('');
    }

    // Lap counter for you
    if (you && entities.has(you.id)) {
      const me = entities.get(you.id);
      lapCounterEl.textContent = `Lap ${me.laps || 0}`;
    }

    if (bestLapEl) {
      let personalBest = you && Number.isFinite(you.bestLapMs) ? you.bestLapMs : null;
      const prevBest = personalBest;
      let raceBest = null;
      if (you) {
        const meWorld = world.players.find((p) => p.id === you.id);
        if (meWorld && Number.isFinite(meWorld.bestLapMs)) {
          raceBest = meWorld.bestLapMs;
        }
      }
      let improved = false;
      if (raceBest != null) {
        if (personalBest == null || raceBest < personalBest - 1) {
          improved = personalBest != null;
          personalBest = raceBest;
          if (you) you.bestLapMs = raceBest;
        }
      }
      let text = `PB ${formatLapTime(personalBest)}`;
      if (raceBest != null) {
        const diff = improved && prevBest != null ? raceBest - prevBest : (personalBest != null ? raceBest - personalBest : null);
        const diffText = formatLapDiff(diff);
        text += ` • Race ${formatLapTime(raceBest)}`;
        if (diffText) text += ` (${diffText})`;
        if (improved) text += ' • NEW!';
      }
      bestLapEl.textContent = text;
    }

    // Speed dial (use local prediction if available)
    let spd = 0;
    if (meLocal) spd = Math.hypot(meLocal.vx, meLocal.vy);
    else if (you && entities.has(you.id)) spd = entities.get(you.id).speed || 0;
    speedDialEl.textContent = Math.round(spd).toString();

    // Minimap
    drawMinimap();
  }

  function msToSec(ms) { return Math.max(0, Math.ceil(ms/1000)); }
  function showFinish(state) {
    if (!finishOverlay) return;
    finishOverlay.classList.remove('hidden');
    const results = (state && state.results) || [];
    finishResultsEl.innerHTML = results.map((r,i)=>{
      const best = r.bestLapMs ? ` • best ${msShort(r.bestLapMs)}`:'';
      return `<div class="finishRow"><div class="rank">${i+1}</div><div class="name">${escapeHtml(r.name)}</div><div class="time">L${r.laps}${best}</div></div>`;
    }).join('');
    finishCountdownEl.textContent = `Returning in ${msToSec(state.timeRemaining)}s`;
    if (finishAutoTimer) clearTimeout(finishAutoTimer);
    finishAutoTimer = setTimeout(returnToBrowser, Math.max(1000, state.timeRemaining || 10000));
  }
  function hideFinish(){ if (finishOverlay) finishOverlay.classList.add('hidden'); if (finishAutoTimer) { clearTimeout(finishAutoTimer); finishAutoTimer=null; } }
  function returnToBrowser(){
    try { if (socket) socket.disconnect(); } catch(e) {}
    socket = null; you = null; currentRoom = null; meLocal=null; meServer=null;
    hudEl.classList.add('hidden'); speedDialEl.classList.add('hidden'); mini.classList.add('hidden');
    if (bestLapEl) bestLapEl.classList.add('hidden');
    if (lapCounterEl) lapCounterEl.classList.add('hidden');
    if (touchEl) {
      touchEl.classList.add('hidden');
      touchSteerValue = 0; touchSteerActive = false; steerTouchId = null;
      touchThrottleValue = 0; touchThrottleActive = false; throttleTouchId = null;
      touchBrakeValue = 0; touchBrakeActive = false; brakeTouchId = null;
      if (joystickThumb) joystickThumb.style.transform = 'translate(-50%, -50%)';
      if (pedalAccelFill) pedalAccelFill.style.height = '0%';
      if (pedalBrakeFill) pedalBrakeFill.style.height = '0%';
    }
    if (bestLapEl) bestLapEl.textContent = 'PB —';
    hideFinish();
    browserPanel.classList.remove('hidden');
    fetchRooms();
  }
  if (finishBackBtn) finishBackBtn.addEventListener('click', returnToBrowser);

  if (globalLbSearchInput) {
    globalLbSearchInput.addEventListener('input', () => renderGlobalLb());
  }
  if (globalLbSortButtons.length) {
    for (const btn of globalLbSortButtons) {
      const baseKey = btn.dataset.glSort;
      const baseLabel = GLOBAL_SORT_LABELS[baseKey] || baseKey.toUpperCase();
      btn.dataset.label = baseLabel;
      btn.textContent = baseLabel;
      btn.addEventListener('click', () => {
        const key = btn.dataset.glSort;
        if (globalLbSortState.key === key) {
          globalLbSortState.dir = globalLbSortState.dir === 'desc' ? 'asc' : 'desc';
        } else {
          globalLbSortState.key = key;
          globalLbSortState.dir = key === 'name' ? 'asc' : key === 'bestLap' ? 'asc' : 'desc';
        }
        renderGlobalLb();
      });
    }
  }

  renderGlobalLb();

  // Drawing helpers
  function drawSurfaceFeature(ctx, track, entry, opts = {}) {
    if (!entry) return;
    const { type, path, textureKey, centerLane, midTheta, centerX: cx, centerY: cy } = entry;
    const styles = FEATURE_STYLES[type] || FEATURE_STYLES.default;
    const texture = textureKey ? getTexture(textureKey) : null;
    const alpha = opts.alpha != null ? opts.alpha : 1;

    ctx.save();
    ctx.globalAlpha *= alpha;
    if (texture) {
      ctx.save();
      ctx.clip(path);
      ctx.fillStyle = texture;
      const span = track.baseRadius + track.width + 1200;
      ctx.fillRect(-span, -span, span * 2, span * 2);
      ctx.restore();
    } else {
      ctx.fillStyle = styles.fill;
      ctx.fill(path);
    }
    ctx.lineWidth = opts.lineWidth || Math.max(3, track.width * 0.025);
    ctx.strokeStyle = styles.stroke;
    ctx.stroke(path);

    if (type === 'boost') {
      const tx = -Math.sin(midTheta);
      const ty = Math.cos(midTheta);
      const arrowLen = Math.max(track.width * 1.2, 120);
      const head = arrowLen * 0.22;
      ctx.strokeStyle = styles.stroke;
      ctx.lineWidth = Math.max(4, track.width * 0.04);
      ctx.beginPath();
      ctx.moveTo(cx - tx * arrowLen * 0.5, cy - ty * arrowLen * 0.5);
      ctx.lineTo(cx + tx * arrowLen * 0.5, cy + ty * arrowLen * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + tx * arrowLen * 0.5, cy + ty * arrowLen * 0.5);
      ctx.lineTo(cx + tx * arrowLen * 0.5 - tx * head - ty * head * 0.5, cy + ty * arrowLen * 0.5 - ty * head + tx * head * 0.5);
      ctx.lineTo(cx + tx * arrowLen * 0.5 - tx * head + ty * head * 0.5, cy + ty * arrowLen * 0.5 - ty * head - tx * head * 0.5);
      ctx.closePath();
      ctx.fillStyle = styles.stroke;
      ctx.fill();
    } else if (type === 'wind') {
      const normalDir = entry.direction === -1 ? -1 : 1;
      const nx = Math.cos(midTheta) * normalDir;
      const ny = Math.sin(midTheta) * normalDir;
      const arrowLen = Math.max(track.width * 0.9, 90);
      const head = Math.max(track.width * 0.18, 36);
      ctx.strokeStyle = styles.stroke;
      ctx.lineWidth = Math.max(4, track.width * 0.035);
      ctx.beginPath();
      ctx.moveTo(cx - nx * arrowLen * 0.5, cy - ny * arrowLen * 0.5);
      ctx.lineTo(cx + nx * arrowLen * 0.5, cy + ny * arrowLen * 0.5);
      ctx.stroke();
      ctx.beginPath();
      const tx = -ny;
      const ty = nx;
      ctx.moveTo(cx + nx * arrowLen * 0.5, cy + ny * arrowLen * 0.5);
      ctx.lineTo(cx + nx * arrowLen * 0.5 - nx * head + tx * head * 0.4, cy + ny * arrowLen * 0.5 - ny * head + ty * head * 0.4);
      ctx.lineTo(cx + nx * arrowLen * 0.5 - nx * head - tx * head * 0.4, cy + ny * arrowLen * 0.5 - ny * head - ty * head * 0.4);
      ctx.closePath();
      ctx.fillStyle = styles.stroke;
      ctx.fill();
    } else if (texture) {
      const gloss = ctx.createRadialGradient(cx, cy, 0, cx, cy, track.width * 0.35);
      gloss.addColorStop(0, 'rgba(255,255,255,0.1)');
      gloss.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.35 * alpha;
      ctx.fillStyle = gloss;
      ctx.beginPath();
      ctx.arc(cx, cy, track.width * 0.45, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  function drawSurfaceFeatures(ctx, track, opts = {}) {
    const cache = buildTrackCache(track);
    const entries = cache.featureCache;
    if (!entries || entries.length === 0) return;
    for (const entry of entries) {
      drawSurfaceFeature(ctx, track, entry, opts);
    }
  }

  function buildTrackCache(track) {
    const cache = track.__clientCache || {};
    const key = `${track.seed || 'seed'}:${track.width}`;
    if (cache.key === key) return cache;
    const n = 180;
    const w2 = track.width / 2;
    const trackPath = new Path2D();
    const outerPath = new Path2D();
    const innerPath = new Path2D();
    const centerPath = new Path2D();
    for (let i = 0; i <= n; i++) {
      const theta = (i / n) * TAU;
      const r = rAt(theta, track) + w2;
      const x = Math.cos(theta) * r;
      const y = Math.sin(theta) * r;
      if (i === 0) {
        trackPath.moveTo(x, y);
        outerPath.moveTo(x, y);
        centerPath.moveTo(Math.cos(theta) * rAt(theta, track), Math.sin(theta) * rAt(theta, track));
      } else {
        trackPath.lineTo(x, y);
        outerPath.lineTo(x, y);
        centerPath.lineTo(Math.cos(theta) * rAt(theta, track), Math.sin(theta) * rAt(theta, track));
      }
    }
    for (let i = n; i >= 0; i--) {
      const theta = (i / n) * TAU;
      const r = rAt(theta, track) - w2;
      const x = Math.cos(theta) * r;
      const y = Math.sin(theta) * r;
      trackPath.lineTo(x, y);
      if (i === n) innerPath.moveTo(x, y); else innerPath.lineTo(x, y);
    }
    trackPath.closePath();
    innerPath.closePath();
    const fieldRadius = track.baseRadius + track.width + 800;
    const auraRadius = track.baseRadius + track.width;
    centerPath.closePath();
    const features = Array.isArray(track.features) ? track.features : [];
    const featureCache = [];
    for (const feature of features) {
      if (!Number.isFinite(feature.length) || feature.length <= 0) continue;
      const laneMinRaw = typeof feature.laneMin === 'number' ? feature.laneMin : (feature.laneMin ?? -1);
      const laneMaxRaw = typeof feature.laneMax === 'number' ? feature.laneMax : (feature.laneMax ?? 1);
      let laneMin = clamp(Math.min(laneMinRaw, laneMaxRaw), -1, 1);
      let laneMax = clamp(Math.max(laneMinRaw, laneMaxRaw), -1, 1);
      if (laneMax - laneMin < 0.02) {
        const mid = (laneMin + laneMax) / 2;
        laneMin = clamp(mid - 0.01, -1, 1);
        laneMax = clamp(mid + 0.01, -1, 1);
      }
      const path = new Path2D();
      const steps = Math.max(10, Math.round((feature.length / TAU) * 64));
      for (let i = 0; i <= steps; i++) {
        const tStep = i / steps;
        const theta = feature.start + feature.length * tStep;
        const ang = ((theta % TAU) + TAU) % TAU;
        const rc = rAt(ang, track);
        const r = rc + laneMax * w2;
        const x = Math.cos(ang) * r;
        const y = Math.sin(ang) * r;
        if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
      }
      for (let i = steps; i >= 0; i--) {
        const tStep = i / steps;
        const theta = feature.start + feature.length * tStep;
        const ang = ((theta % TAU) + TAU) % TAU;
        const rc = rAt(ang, track);
        const r = rc + laneMin * w2;
        const x = Math.cos(ang) * r;
        const y = Math.sin(ang) * r;
        path.lineTo(x, y);
      }
      path.closePath();

      const centerLane = clamp((laneMin + laneMax) / 2, -1, 1);
      const midTheta = ((feature.start + feature.length / 2) % TAU + TAU) % TAU;
      const rcMid = rAt(midTheta, track);
      const rMid = rcMid + centerLane * w2;
      const centerX = Math.cos(midTheta) * rMid;
      const centerY = Math.sin(midTheta) * rMid;
      featureCache.push({
        type: feature.type,
        path,
        laneMin,
        laneMax,
        centerLane,
        midTheta,
        centerX,
        centerY,
        direction: feature.direction,
        textureKey: FEATURE_TEXTURE_KEYS[feature.type],
      });
    }

    const newCache = { key, trackPath, outerPath, innerPath, centerPath, w2, fieldRadius, auraRadius, featureCache };
    track.__clientCache = newCache;
    return newCache;
  }

  function drawTrack(ctx, t) {
    const cache = buildTrackCache(t);
    const { trackPath, outerPath, innerPath, centerPath, w2, fieldRadius, auraRadius } = cache;
    if (!asphaltPattern) asphaltPattern = getTexture('asphalt');
    const grassPattern = getTexture('grass');

    ctx.save();
    if (grassPattern) {
      ctx.fillStyle = grassPattern;
      ctx.fillRect(-fieldRadius, -fieldRadius, fieldRadius * 2, fieldRadius * 2);
    } else {
      ctx.fillStyle = '#3e6a1c';
      ctx.fillRect(-fieldRadius, -fieldRadius, fieldRadius * 2, fieldRadius * 2);
    }
    ctx.restore();

    ctx.save();
    const aura = ctx.createRadialGradient(0, 0, t.baseRadius * 0.3, 0, 0, auraRadius);
    aura.addColorStop(0, BG_COLORS.glow);
    aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(0, 0, auraRadius, 0, TAU); ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#e5e7ec';
    ctx.fill(trackPath);

    ctx.save();
    ctx.clip(trackPath);
    if (asphaltPattern) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = asphaltPattern;
      ctx.fillRect(-fieldRadius, -fieldRadius, fieldRadius * 2, fieldRadius * 2);
    }
    const sheen = ctx.createRadialGradient(0, 0, t.baseRadius * 0.2, 0, 0, t.baseRadius + t.width);
    sheen.addColorStop(0, 'rgba(255,255,255,0.18)');
    sheen.addColorStop(0.6, 'rgba(255,255,255,0.04)');
    sheen.addColorStop(1, 'rgba(10,15,25,0.28)');
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = sheen;
    ctx.fillRect(-fieldRadius, -fieldRadius, fieldRadius * 2, fieldRadius * 2);
    ctx.restore();

    drawSurfaceFeatures(ctx, t);

    ctx.strokeStyle = '#cfcfcf';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.stroke(outerPath);
    ctx.strokeStyle = '#e0e0e0';
    ctx.stroke(innerPath);

    // Centerline with direction chevrons
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 4;
    ctx.setLineDash([18, 16]);
    ctx.stroke(centerPath);
    ctx.setLineDash([]);

    // Curbs (red/white) along inner/outer edges at intervals
    const CURB_STEP = 28;
    const n = 180;
    for (let i = 0; i < n; i++) {
      const theta = (i / n) * TAU;
      const rIn = rAt(theta, t) - w2;
      const rOut = rAt(theta, t) + w2;
      if (i % 6 === 0) {
        const nx = Math.cos(theta), ny = Math.sin(theta);
        const tx = -Math.sin(theta), ty = Math.cos(theta);
        // inner curb
        ctx.fillStyle = (i % (12) === 0) ? '#d32f2f' : '#fff';
        ctx.beginPath();
        ctx.moveTo(nx*rIn, ny*rIn);
        ctx.lineTo(nx*rIn + tx*CURB_STEP*0.5, ny*rIn + ty*CURB_STEP*0.5);
        ctx.lineTo(nx*(rIn+8) + tx*CURB_STEP*0.5, ny*(rIn+8) + ty*CURB_STEP*0.5);
        ctx.lineTo(nx*(rIn+8), ny*(rIn+8));
        ctx.closePath(); ctx.fill();
        // outer curb
        ctx.fillStyle = (i % (12) === 0) ? '#fff' : '#d32f2f';
        ctx.beginPath();
        ctx.moveTo(nx*rOut, ny*rOut);
        ctx.lineTo(nx*rOut + tx*CURB_STEP*0.5, ny*rOut + ty*CURB_STEP*0.5);
        ctx.lineTo(nx*(rOut-8) + tx*CURB_STEP*0.5, ny*(rOut-8) + ty*CURB_STEP*0.5);
        ctx.lineTo(nx*(rOut-8), ny*(rOut-8));
        ctx.closePath(); ctx.fill();
      }
    }

    // Direction chevrons
    const CHEV = 44;
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    for (let i = 0; i < CHEV; i++) {
      const theta = (i / CHEV) * Math.PI * 2;
      const r = rAt(theta, t);
      const cx = Math.cos(theta) * r;
      const cy = Math.sin(theta) * r;
      const tx = -Math.sin(theta);
      const ty = Math.cos(theta);
      const nx = Math.cos(theta);
      const ny = Math.sin(theta);
      const L = Math.max(10, t.width * 0.18);
      const W = Math.max(6, t.width * 0.12);
      ctx.beginPath();
      ctx.moveTo(cx + tx * (L * 0.7), cy + ty * (L * 0.7));
      ctx.lineTo(cx - tx * (L * 0.6) + nx * (W * 0.5), cy - ty * (L * 0.6) + ny * (W * 0.5));
      ctx.lineTo(cx - tx * (L * 0.6) - nx * (W * 0.5), cy - ty * (L * 0.6) - ny * (W * 0.5));
      ctx.closePath();
      ctx.fill();
    }

    // Start/Finish line at theta=t.startTheta (default 0), horizontal across track
    const st = (t.startTheta != null ? t.startTheta : 0);
    ctx.save();
    ctx.rotate(st);
    const rc = rAt(st, t);
    const squares = 12;
    const w = (w2 * 2) / squares; // segment length along width
    const thickness = Math.max(6, Math.min(12, w2 * 0.18));
    for (let i = 0; i < squares; i++) {
      ctx.fillStyle = (i % 2 === 0) ? '#000' : '#fff';
      // Draw horizontal segments across the width of the track
      const x0 = rc - w2 + i * w;
      ctx.fillRect(x0, -thickness / 2, w, thickness);
    }
    ctx.restore();
  }

  function drawMinimap() {
    const w = mini.clientWidth || 200;
    const h = mini.clientHeight || 200;
    mctx.clearRect(0, 0, w, h);
    if (!track) return;
    const bg = mctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, 'rgba(14, 21, 38, 0.95)');
    bg.addColorStop(1, 'rgba(10, 14, 24, 0.95)');
    mctx.fillStyle = bg;
    mctx.fillRect(0, 0, w, h);

    // world fit
    const margin = 100;
    const tMax = trackMaxRadius(track) + margin;
    const worldSize = tMax * 2;
    const scale = Math.min(w / worldSize, h / worldSize);
    const dpr = window.devicePixelRatio || 1;
    const cx = w / 2;
    const cy = h / 2;
    mctx.save();
    mctx.translate(cx, cy);
    mctx.scale(scale, scale);

    // Track filled ring for high contrast
    const cache = buildTrackCache(track);
    const { trackPath, outerPath, innerPath, w2, fieldRadius } = cache;
    if (!asphaltPattern) asphaltPattern = getTexture('asphalt');
    const grassPattern = getTexture('grass');

    if (grassPattern) {
      mctx.fillStyle = grassPattern;
      mctx.fillRect(-fieldRadius, -fieldRadius, fieldRadius * 2, fieldRadius * 2);
    }
    mctx.fillStyle = '#e3e9f5';
    mctx.fill(trackPath);
    if (asphaltPattern) {
      mctx.save();
      mctx.clip(trackPath);
      mctx.fillStyle = asphaltPattern;
      mctx.fillRect(-fieldRadius, -fieldRadius, fieldRadius * 2, fieldRadius * 2);
      mctx.restore();
    }

    drawSurfaceFeatures(mctx, track, { alpha: 0.6, lineWidth: Math.max(1.6, track.width * 0.02) });

    // Bold edges
    mctx.strokeStyle = '#7a8aa6';
    mctx.lineWidth = 3;
    mctx.stroke(outerPath);
    mctx.strokeStyle = '#a8b4c9';
    mctx.stroke(innerPath);

    // Start/finish marker (horizontal across track, pixel-consistent thickness)
    const st = (track.startTheta != null ? track.startTheta : 0);
    const rc2 = rAt(st, track);
    mctx.save();
    mctx.rotate(st);
    mctx.fillStyle = '#222';
    const markH = 3 / (scale * dpr); // 3px tall regardless of zoom/DPR
    mctx.fillRect(rc2 - w2, -markH / 2, w2 * 2, markH);
    mctx.restore();

    // Players as dots
    for (const p of world.players) {
      const x = p.x, y = p.y;
      const isMe = (you && p.id === you.id);
      mctx.fillStyle = isMe ? '#ff5722' : (p.color || '#111');
      const pxR = isMe ? 6 : 4; // desired pixel radius on minimap
      const pr = pxR / (scale * dpr); // convert to world units under current transform
      mctx.beginPath();
      mctx.arc(x, y, pr, 0, Math.PI * 2);
      mctx.fill();
      if (isMe) {
        mctx.strokeStyle = '#fff';
        mctx.lineWidth = 2 / (scale * dpr); // 2px outline
        mctx.stroke();
      }
    }

    mctx.restore();
  }

  // --- Chat ---
  function appendChat(m) {
    if (!chatLogEl) return;
    const div = document.createElement('div');
    div.className = 'chatMsg';
    if (m.system) {
      div.innerHTML = `<span class="chatSys">${escapeHtml(m.text)}</span>`;
    } else {
      const nameStyle = `style="color:${m.color || '#333'}"`;
      div.innerHTML = `<span class="chatName" ${nameStyle}>${escapeHtml(m.name)}</span>${escapeHtml(m.text)}`;
    }
    chatLogEl.appendChild(div);
    chatLogEl.scrollTop = chatLogEl.scrollHeight;
  }
  if (chatInputEl) {
    chatInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const t = chatInputEl.value.trim();
        if (t && socket) socket.emit('chat', t);
        chatInputEl.value = '';
      }
    });
  }
  // Chat listener is attached per-room after join
  // (Voting removed)

  const NAME_LABEL_FONT = '600 14px "Inter", sans-serif';
  const NAME_LABEL_BG = 'rgba(10,16,28,0.78)';
  const NAME_LABEL_COLOR = '#f1f5ff';
  const NAME_LABEL_HIGHLIGHT = '#ffe27a';

  function nameLabelOffset(shape) {
    switch (normalizeShape(shape)) {
      case 'dragster': return CAR_W * 0.9 + 22;
      case 'hover': return CAR_W * 0.6 + 26;
      case 'buggy': return CAR_W * 1.1 + 20;
      default: return CAR_W + 20;
    }
  }

  function drawNameLabel(ctx, scale, x, y, text, opts = {}) {
    if (!text || !scale || scale <= 0) return;
    const highlight = !!opts.highlight;
    const labelColor = highlight ? NAME_LABEL_HIGHLIGHT : (opts.color || NAME_LABEL_COLOR);
    const offset = nameLabelOffset(opts.shape || DEFAULT_SHAPE);
    const invScale = 1 / scale;

    ctx.save();
    ctx.translate(x, y - offset);
    ctx.scale(invScale, invScale);
    ctx.font = NAME_LABEL_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const padX = 6;
    const padY = 4;
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const rectWidth = textWidth + padX * 2;
    const rectHeight = 18 + padY;

    const grad = ctx.createLinearGradient(0, -rectHeight, 0, 0);
    if (highlight) {
      grad.addColorStop(0, 'rgba(255, 215, 90, 0.85)');
      grad.addColorStop(1, 'rgba(120, 82, 0, 0.85)');
    } else {
      grad.addColorStop(0, 'rgba(21, 30, 48, 0.86)');
      grad.addColorStop(1, 'rgba(9, 13, 22, 0.9)');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(-rectWidth / 2, -rectHeight, rectWidth, rectHeight);
    ctx.strokeStyle = highlight ? 'rgba(255, 230, 140, 0.8)' : 'rgba(160, 181, 222, 0.35)';
    ctx.lineWidth = highlight ? 1.6 : 1.1;
    ctx.strokeRect(-rectWidth / 2, -rectHeight, rectWidth, rectHeight);

    ctx.fillStyle = labelColor;
    ctx.fillText(text, 0, -rectHeight / 2);
    ctx.restore();
  }

  function drawCar(ctx, x, y, angle, color, flags = {}) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const shape = normalizeShape(flags.shape || DEFAULT_SHAPE);
    const accent = flags.accent || '#ffffff';
    const throttle = !!flags.throttle;
    const brake = !!flags.brake;
    const L = CAR_L;
    const W = CAR_W;
    const r = W / 2;
    const hx = L / 2 - r;
    const tx = -L / 2 + r;

    // Shadow
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    if (shape === 'hover') {
      ctx.ellipse(0, 6, L * 0.6, W * 0.9, 0, 0, Math.PI * 2);
    } else if (shape === 'dragster') {
      ctx.ellipse(-6, 5, L * 0.6, W * 0.65, 0, 0, Math.PI * 2);
    } else {
      ctx.ellipse(-4, 4, L * 0.55, W * 0.7, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.globalAlpha = 1;

    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    switch (shape) {
      case 'wedge':
        ctx.moveTo(L / 2, 0);
        ctx.lineTo(0, -W / 2);
        ctx.lineTo(-L / 2, -W / 3);
        ctx.lineTo(-L / 2, W / 3);
        ctx.lineTo(0, W / 2);
        break;
      case 'formula':
        ctx.moveTo(L / 2, 0);
        ctx.lineTo(L / 2 - 14, -W * 0.24);
        ctx.lineTo(L / 2 - 32, -W * 0.36);
        ctx.lineTo(-L / 2 + 16, -W * 0.22);
        ctx.lineTo(-L / 2 - 6, -W * 0.08);
        ctx.lineTo(-L / 2 - 6, W * 0.08);
        ctx.lineTo(-L / 2 + 16, W * 0.22);
        ctx.lineTo(L / 2 - 32, W * 0.36);
        ctx.lineTo(L / 2 - 14, W * 0.24);
        break;
      case 'roadster':
        ctx.moveTo(L / 2 - W * 0.45, -W / 2);
        ctx.quadraticCurveTo(L / 2, -W / 2, L / 2, 0);
        ctx.quadraticCurveTo(L / 2, W / 2, L / 2 - W * 0.45, W / 2);
        ctx.lineTo(-L / 2 + W * 0.4, W / 2);
        ctx.quadraticCurveTo(-L / 2, W / 2, -L / 2, 0);
        ctx.quadraticCurveTo(-L / 2, -W / 2, -L / 2 + W * 0.4, -W / 2);
        break;
      case 'buggy':
        ctx.moveTo(L / 2, -W * 0.28);
        ctx.lineTo(L * 0.22, -W * 0.54);
        ctx.lineTo(-L * 0.18, -W * 0.54);
        ctx.lineTo(-L / 2, -W * 0.3);
        ctx.lineTo(-L / 2, W * 0.3);
        ctx.lineTo(-L * 0.18, W * 0.54);
        ctx.lineTo(L * 0.22, W * 0.54);
        ctx.lineTo(L / 2, W * 0.28);
        break;
      case 'dragster':
        ctx.moveTo(L / 2, 0);
        ctx.lineTo(L / 2 - L * 0.58, -W * 0.2);
        ctx.lineTo(-L / 2 + 12, -W * 0.24);
        ctx.lineTo(-L / 2, -W * 0.42);
        ctx.lineTo(-L / 2 - 8, -W * 0.42);
        ctx.lineTo(-L / 2 - 8, W * 0.42);
        ctx.lineTo(-L / 2, W * 0.42);
        ctx.lineTo(-L / 2 + 12, W * 0.24);
        ctx.lineTo(L / 2 - L * 0.58, W * 0.2);
        break;
      case 'hover':
        ctx.ellipse(0, 0, L * 0.48, W * 0.7, 0, 0, Math.PI * 2);
        break;
      default:
        ctx.moveTo(tx, -r);
        ctx.lineTo(hx, -r);
        ctx.arc(hx, 0, r, -Math.PI / 2, Math.PI / 2, false);
        ctx.lineTo(tx, r);
        ctx.arc(tx, 0, r, Math.PI / 2, -Math.PI / 2, false);
        break;
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.save();
    ctx.globalAlpha = 0.65;
    const paintSheen = ctx.createLinearGradient(-L * 0.35, -W, L * 0.55, W);
    paintSheen.addColorStop(0, 'rgba(255,255,255,0.25)');
    paintSheen.addColorStop(0.35, 'rgba(255,255,255,0.08)');
    paintSheen.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = paintSheen;
    ctx.beginPath();
    ctx.ellipse(0, 0, L * 0.42, W * 0.64, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Accent / nose highlight
    ctx.fillStyle = accent;
    ctx.beginPath();
    switch (shape) {
      case 'wedge':
        ctx.moveTo(L / 2, 0);
        ctx.lineTo(L / 2 - 10, -W * 0.28);
        ctx.lineTo(L / 2 - 10, W * 0.28);
        break;
      case 'formula':
        ctx.ellipse(-L * 0.05, 0, L * 0.17, W * 0.24, 0, 0, Math.PI * 2);
        break;
      case 'roadster':
        ctx.moveTo(L / 2 - 8, -W * 0.22);
        ctx.lineTo(L / 2 - 22, -W * 0.32);
        ctx.lineTo(-L / 3, -W * 0.32);
        ctx.lineTo(-L / 3, W * 0.32);
        ctx.lineTo(L / 2 - 22, W * 0.32);
        ctx.lineTo(L / 2 - 8, W * 0.22);
        break;
      case 'buggy':
        ctx.moveTo(L * 0.28, -W * 0.1);
        ctx.lineTo(-L * 0.2, -W * 0.3);
        ctx.lineTo(-L * 0.2, W * 0.3);
        ctx.lineTo(L * 0.28, W * 0.1);
        break;
      case 'dragster':
        ctx.moveTo(L / 2 - L * 0.2, -W * 0.12);
        ctx.lineTo(-L / 2 + 18, -W * 0.18);
        ctx.lineTo(-L / 2 + 18, W * 0.18);
        ctx.lineTo(L / 2 - L * 0.2, W * 0.12);
        break;
      case 'hover':
        ctx.ellipse(0, 0, L * 0.24, W * 0.34, 0, 0, Math.PI * 2);
        break;
      default:
        ctx.moveTo(L / 2, 0);
        ctx.lineTo(hx, -r * 0.9);
        ctx.lineTo(hx, r * 0.9);
        break;
    }
    ctx.closePath();
    ctx.fill();

    // Canopy / window tint
    ctx.save();
    ctx.globalAlpha = 0.32;
    const canopy = ctx.createLinearGradient(-L * 0.1, -W * 0.5, L * 0.35, W * 0.5);
    canopy.addColorStop(0, 'rgba(80,120,172,0.65)');
    canopy.addColorStop(1, 'rgba(12,22,36,0.85)');
    ctx.fillStyle = canopy;
    ctx.beginPath();
    ctx.ellipse(L * 0.1, 0, L * 0.28, W * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Brake lights / exhaust
    if (brake) {
      ctx.fillStyle = 'rgba(255, 72, 64, 0.88)';
      ctx.fillRect(-L * 0.52, -W * 0.33, L * 0.08, W * 0.18);
      ctx.fillRect(-L * 0.52, W * 0.15, L * 0.08, W * 0.18);
    }
    if (throttle) {
      ctx.save();
      ctx.translate(-L * 0.55, 0);
      const flame = ctx.createLinearGradient(-L * 0.25, 0, L * 0.35, 0);
      flame.addColorStop(0, 'rgba(255, 196, 0, 0)');
      flame.addColorStop(0.3, 'rgba(255, 196, 0, 0.45)');
      flame.addColorStop(0.7, 'rgba(255, 64, 0, 0.55)');
      flame.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = flame;
      ctx.beginPath();
      ctx.ellipse(0, 0, L * 0.6, W * 0.35, 0, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.fill();
      ctx.restore();
    }

    // Windows and details
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    switch (shape) {
      case 'formula':
        ctx.beginPath();
        ctx.ellipse(-L * 0.12, 0, L * 0.13, W * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.6;
        ctx.fillRect(L * 0.2, -W * 0.55, 12, W * 1.1);
        ctx.fillRect(-L * 0.32, -W * 0.6, 10, W * 1.2);
        ctx.globalAlpha = 1;
        break;
      case 'roadster':
        ctx.fillRect(-L * 0.05, -W * 0.36, L * 0.4, W * 0.3);
        ctx.fillRect(-L * 0.05, W * 0.06, L * 0.4, W * 0.3);
        break;
      case 'buggy':
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-L * 0.1, -W * 0.5);
        ctx.lineTo(L * 0.08, -W * 0.18);
        ctx.lineTo(L * 0.08, W * 0.18);
        ctx.lineTo(-L * 0.1, W * 0.5);
        ctx.stroke();
        break;
      case 'dragster':
        ctx.beginPath();
        ctx.ellipse(-L * 0.12, 0, L * 0.14, W * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(L * 0.18, -W * 0.12, L * 0.32, W * 0.24);
        break;
      case 'hover':
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(0, 0, L * 0.32, W * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      default:
        ctx.fillRect(-L * 0.05, -W * 0.38, L * 0.35, W * 0.32);
        ctx.fillRect(-L * 0.05, W * 0.06, L * 0.35, W * 0.32);
        break;
    }

    // Tail lights and center spine
    if (shape !== 'hover') {
      const bright = brake ? 1 : 0.35;
      ctx.fillStyle = `rgba(255, 64, 64, ${bright})`;
      const tw = shape === 'dragster' ? 7 : 6;
      const th = 4;
      ctx.fillRect(-L / 2 + 2, -th - 1, tw, th);
      ctx.fillRect(-L / 2 + 2, 1, tw, th);

      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-L / 2 + 2, 0);
      ctx.lineTo(L / 2 - 2, 0);
      ctx.stroke();
    }

    // Wheels or thrusters
    if (shape === 'hover') {
      const thruster = (px, py, rx, ry) => {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(px, py + 4, rx * 1.3, ry * 1.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(80, 200, 255, 0.55)';
        ctx.beginPath();
        ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      };
      thruster(-L * 0.18, -W * 0.55, 4.5, 2.2);
      thruster(-L * 0.18, W * 0.55, 4.5, 2.2);
      thruster(L * 0.22, 0, 5, 2.6);
    } else {
      ctx.fillStyle = '#1c1c1c';
      const drawWheel = (px, py, rx, ry) => {
        ctx.beginPath();
        ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      };
      if (shape === 'formula') {
        drawWheel(L * 0.24, -W * 0.6, 3.5, 1.9);
        drawWheel(L * 0.24, W * 0.6, 3.5, 1.9);
        drawWheel(-L * 0.2, -W * 0.65, 4.6, 2.2);
        drawWheel(-L * 0.2, W * 0.65, 4.6, 2.2);
      } else if (shape === 'dragster') {
        drawWheel(L * 0.28, -W * 0.4, 3.2, 1.6);
        drawWheel(L * 0.28, W * 0.4, 3.2, 1.6);
        drawWheel(-L * 0.28, -W * 0.7, 6.8, 3.2);
        drawWheel(-L * 0.28, W * 0.7, 6.8, 3.2);
      } else if (shape === 'buggy') {
        drawWheel(L * 0.2, -W * 0.65, 5.2, 2.6);
        drawWheel(L * 0.2, W * 0.65, 5.2, 2.6);
        drawWheel(-L * 0.25, -W * 0.7, 6, 2.8);
        drawWheel(-L * 0.25, W * 0.7, 6, 2.8);
      } else {
        drawWheel(-L * 0.2, -W * 0.55, 4.5, 2.2);
        drawWheel(L * 0.15, -W * 0.55, 4.5, 2.2);
        drawWheel(-L * 0.2, W * 0.55, 4.5, 2.2);
        drawWheel(L * 0.15, W * 0.55, 4.5, 2.2);
      }
    }

    // Exhaust flame for land vehicles
    if (throttle && !brake && shape !== 'hover') {
      ctx.fillStyle = 'rgba(255,140,0,0.9)';
      ctx.beginPath();
      ctx.moveTo(-L / 2 - 2, -3);
      ctx.lineTo(-L / 2 - 10 - Math.random() * 6, 0);
      ctx.lineTo(-L / 2 - 2, 3);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  // Math helpers
  function worldToTrackPolar(x, y) { const r = Math.hypot(x, y); let theta = Math.atan2(y, x); if (theta < 0) theta += Math.PI * 2; return { r, theta }; }
  function angleDiff(a, b) {
    let d = (a - b) % (Math.PI * 2);
    if (d < -Math.PI) d += Math.PI * 2; else if (d > Math.PI) d -= Math.PI * 2;
    return d;
  }
  function segmentWindow(theta, seg) {
    const d = Math.abs(angleDiff(theta, seg.center));
    if (d > seg.halfWidth) return 0;
    const x = d / seg.halfWidth;
    const w = 0.5 * (1 + Math.cos(Math.PI * x));
    const gamma = seg.kind === 'hairpin' ? 2.2 : seg.kind === 'chicane' ? 1.6 : seg.kind === 'kink' ? 1.3 : 1.0;
    return Math.pow(w, gamma);
  }
  function rAt(theta, t) {
    let r = t.baseRadius;
    for (const n of t.noises) r += n.amp * Math.sin(theta * n.freq + n.phase);
    if (t.segments) {
      for (const s of t.segments) {
        const w = segmentWindow(theta, s);
        if (w > 0) {
          const dir = s.dir || 1;
          r += dir * (s.intensity * t.baseRadius) * w;
        }
      }
    }
    if (typeof t.ellipseE === 'number' && typeof t.ellipsePhi === 'number') {
      const f = 1 + t.ellipseE * Math.cos(2 * (theta - t.ellipsePhi));
      r *= f;
    }
    return r;
  }
  // Compute a safe bound radius for minimap fitting
  function trackMaxRadius(t) {
    let maxR = 0;
    const w2 = t.width / 2;
    const samples = 720;
    for (let i = 0; i < samples; i++) {
      const th = (i / samples) * Math.PI * 2;
      const r = rAt(th, t) + w2;
      if (r > maxR) maxR = r;
    }
    return maxR;
  }
  function sumAmps(noises) { return noises.reduce((a, n) => a + Math.abs(n.amp), 0); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function angleLerp(a, b, t) {
    let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    return a + d * t;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[c]);
  }

  // Local prediction physics (approximate server)
  function simulateLocal(dt) {
    // Read live keys for immediate feel
    // We'll reuse the same key state from the interval sender by tracking last values
    const digitalThrottle = (keysDown.has('w') || keysDown.has('arrowup')) ? 1 : 0;
    const digitalBrake = (keysDown.has('s') || keysDown.has('arrowdown')) ? 1 : 0;
    const digitalLeft = (keysDown.has('a') || keysDown.has('arrowleft')) ? 1 : 0;
    const digitalRight = (keysDown.has('d') || keysDown.has('arrowright')) ? 1 : 0;
    const steerInput = touchSteerActive ? touchSteerValue : clamp(digitalRight - digitalLeft, -1, 1);
    const throttleInput = Math.max(digitalThrottle, touchThrottleActive ? touchThrottleValue : 0);
    const brakeInput = Math.max(digitalBrake, touchBrakeActive ? touchBrakeValue : 0);
    const throttling = throttleInput > 0.02;
    const braking = brakeInput > 0.02;

    // Steering smoothing and speed-aware turn rate
    const fx = Math.cos(meLocal.angle), fy = Math.sin(meLocal.angle);
    const sx = -fy, sy = fx;
    const speed = Math.hypot(meLocal.vx, meLocal.vy);
    meLocal.steer = meLocal.steer || 0;
    const lerpAmt = clamp(PHY.STEER_RESP * dt, 0, 1);
    meLocal.steer = meLocal.steer + (steerInput - meLocal.steer) * lerpAmt;
    const damp = 1 / (1 + Math.pow(speed / PHY.VREF, 1.2));
    const turnRate = PHY.MAX_TURN_RATE * damp;
    meLocal.angle += meLocal.steer * turnRate * dt;

    // Accel / brake
    let ax = 0, ay = 0;
    // Throttle smoothing for local feel
    meLocal.throttle = meLocal.throttle == null ? throttleInput : meLocal.throttle + ((throttleInput - meLocal.throttle) * Math.min(1, 6 * dt));
    if (meLocal.throttle) { ax += fx * PHY.ACCEL * meLocal.throttle; ay += fy * PHY.ACCEL * meLocal.throttle; }
    if (braking) {
      const vdotf = meLocal.vx * fx + meLocal.vy * fy;
      const brakeForce = PHY.BRAKE * clamp(brakeInput, 0, 1);
      const revForce = PHY.REV_ACCEL * clamp(brakeInput, 0, 1);
      if (vdotf > 40) { ax += -fx * brakeForce; ay += -fy * brakeForce; }
      else { ax += -fx * revForce; ay += -fy * revForce; }
    }
    meLocal.vx += ax * dt; meLocal.vy += ay * dt;

    // Drag and lateral grip
    const dragPow = Math.pow(PHY.DRAG, dt / (1 / 60));
    meLocal.vx *= dragPow; meLocal.vy *= dragPow;
    const vSide = meLocal.vx * sx + meLocal.vy * sy;
    const vFwd = meLocal.vx * fx + meLocal.vy * fy;
    const grip = PHY.GRIP_LOW + (PHY.GRIP_HIGH - PHY.GRIP_LOW) * clamp(speed / 900, 0, 1);
    const sideAfter = vSide * Math.exp(-Math.max(0, grip) * dt);
    meLocal.vx = fx * vFwd + sx * sideAfter;
    meLocal.vy = fy * vFwd + sy * sideAfter;
    meLocal.slip = Math.abs(vSide) / (Math.abs(vFwd) + 1);

    // Slow when sliding: cap to 50% of max speed if high slip
    {
      const vSide2 = meLocal.vx * sx + meLocal.vy * sy;
      const vFwd2 = meLocal.vx * fx + meLocal.vy * fy;
      const slip = Math.abs(vSide2) / (Math.abs(vFwd2) + 1);
      const cap = PHY.MAX_SPEED * 0.5;
      const spd = Math.hypot(meLocal.vx, meLocal.vy);
      if (slip > PHY.SLIDE_THRESHOLD && spd > cap) {
        const s = cap / (spd || 1);
        meLocal.vx *= s; meLocal.vy *= s;
      }
    }

    // Cap speed
    const newSpeed = Math.hypot(meLocal.vx, meLocal.vy);
    if (newSpeed > PHY.MAX_SPEED) { const s = PHY.MAX_SPEED / newSpeed; meLocal.vx *= s; meLocal.vy *= s; }
    // Reverse cap along forward axis
    {
      const vFwd = meLocal.vx * fx + meLocal.vy * fy;
      if (vFwd < -PHY.MAX_REVERSE_SPEED) {
        const vSide = meLocal.vx * sx + meLocal.vy * sy;
        const clampedF = -PHY.MAX_REVERSE_SPEED;
        meLocal.vx = fx * clampedF + sx * vSide;
        meLocal.vy = fy * clampedF + sy * vSide;
      }
    }

    // Integrate
    meLocal.x += meLocal.vx * dt;
    meLocal.y += meLocal.vy * dt;

    // Simple boundary clamp + wall penalties
    if (track) {
      const pol = worldToTrackPolar(meLocal.x, meLocal.y);
      const rc = rAt(pol.theta, track);
      const w2 = track.width / 2;
      const minR = rc - w2 + PHY.CAR_RADIUS;
      const maxR = rc + w2 - PHY.CAR_RADIUS;
      let r = pol.r;
      if (r < minR || r > maxR) {
        const ux = Math.cos(pol.theta), uy = Math.sin(pol.theta);
        const tx = -Math.sin(pol.theta), ty = Math.cos(pol.theta);
        const hitOuter = r > maxR;
        const hitInner = r < minR;
        r = clamp(r, minR + 1, maxR - 1);
        meLocal.x = ux * r; meLocal.y = uy * r;
        const vrad0 = meLocal.vx * ux + meLocal.vy * uy;
        const vtan0x = meLocal.vx - vrad0 * ux;
        const vtan0y = meLocal.vy - vrad0 * uy;
        let vrad = vrad0;
        const movingIntoOuter = hitOuter && vrad0 > 0;
        const movingIntoInner = hitInner && vrad0 < 0;
        if (movingIntoOuter || movingIntoInner) {
          const bounce = -0.25;
          vrad = vrad0 * bounce;
          const curSpd = Math.hypot(meLocal.vx, meLocal.vy);
          if (curSpd > 1) { meLocal.vx *= PHY.WALL_IMPACT_SLOW; meLocal.vy *= PHY.WALL_IMPACT_SLOW; }
        }
        const scrape = Math.exp(-PHY.WALL_SCRAPE * dt * (throttling ? 1.3 : 1.0));
        let vtanx = vtan0x * scrape;
        let vtany = vtan0y * scrape;
        const capAlongWall = Math.min(Infinity, PHY.MAX_SPEED * 0.5);
        const vtanSpeed = Math.hypot(vtanx, vtany);
        if (vtanSpeed > capAlongWall) {
          const s = capAlongWall / (vtanSpeed || 1);
          vtanx *= s; vtany *= s;
        }
        const speed2 = meLocal.vx * meLocal.vx + meLocal.vy * meLocal.vy;
        if (throttling && speed2 < 25 * 25) {
          const nudge = 180;
          const fDotU = fx * ux + fy * uy;
          const dir = (fDotU >= 0) ? 1 : -1;
          vtanx += tx * nudge * dt * dir;
          vtany += ty * nudge * dt * dir;
        }
        meLocal.vx = vtanx + vrad * ux;
        meLocal.vy = vtany + vrad * uy;
      }
    }
  }

  // Track keys pressed for prediction
  const keysDown = new Set();

  // Initial load
  fetchRooms();
})();
