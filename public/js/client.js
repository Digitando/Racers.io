(() => {
  const $ = (sel) => document.querySelector(sel);
  const roomsEl = $('#roomsList');
  const globalLbEl = document.getElementById('globalLb');
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
  let finishAutoTimer = null;
  const chatEl = document.getElementById('chat');
  const chatLogEl = document.getElementById('chatLog');
  const chatInputEl = document.getElementById('chatInput');

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const mini = document.getElementById('minimap');
  const mctx = mini.getContext('2d');
  const touchEl = document.getElementById('touchControls');
  const btnLeft = document.getElementById('btnLeft');
  const btnRight = document.getElementById('btnRight');
  const btnGas = document.getElementById('btnGas');
  const btnBrake = document.getElementById('btnBrake');

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
  let noiseCanvas = null;
  // Skid marks (your car)
  const skidMarks = [];
  const SKID_MAX = 700;
  const CAR_L = 44, CAR_W = 22;

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
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

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
    const n = localStorage.getItem('profileName') || '';
    const c = localStorage.getItem('profileColor') || '#2196F3';
    const a = localStorage.getItem('profileAccent') || '#ffffff';
    const s = localStorage.getItem('profileShape') || 'capsule';
    if (nameInput) nameInput.value = n;
    if (colorInput) colorInput.value = c;
    if (accentInput) accentInput.value = a;
    if (shapeSelect) shapeSelect.value = s;
    return { n, c, a, s };
  }
  function getEffectiveProfile() {
    let { n, c, a, s } = loadProfile();
    const inputName = ((nameInput && nameInput.value) || '').trim();
    const inputColor = (colorInput && colorInput.value) || '';
    const inputAccent = (accentInput && accentInput.value) || '';
    const inputShape = (shapeSelect && shapeSelect.value) || '';
    if (!n && inputName) { n = inputName; localStorage.setItem('profileName', n); }
    if (!c && inputColor) { c = inputColor; localStorage.setItem('profileColor', c); }
    if (!a && inputAccent) { a = inputAccent; localStorage.setItem('profileAccent', a); }
    if (!s && inputShape) { s = inputShape; localStorage.setItem('profileShape', s); }
    return { n, c, a, s };
  }
  function saveProfile() {
    const n = (nameInput.value || '').trim();
    const c = colorInput.value || '#2196F3';
    const a = (accentInput && accentInput.value) || '#ffffff';
    const s = (shapeSelect && shapeSelect.value) || 'capsule';
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

  function renderGlobalLb(rows) {
    if (!globalLbEl) return;
    globalLbEl.innerHTML = '';
    if (!rows || rows.length === 0) {
      const el = document.createElement('div');
      el.className = 'muted';
      el.textContent = 'No stats yet';
      globalLbEl.appendChild(el);
      return;
    }
    const header = document.createElement('div');
    header.className = 'room';
    header.innerHTML = `<div><strong>Player</strong></div><div class="muted">Wins</div><div class="muted">Laps</div><div class="muted">Races</div>`;
    globalLbEl.appendChild(header);
    for (const r of rows.slice(0, 12)) {
      const el = document.createElement('div');
      el.className = 'room';
      el.innerHTML = `
        <div><strong>${escapeHtml(r.name)}</strong></div>
        <div>${r.wins|0}</div>
        <div>${r.laps|0}</div>
        <div>${r.races|0}</div>
      `;
      globalLbEl.appendChild(el);
    }
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
    let profName = (profile.n || '').trim();
    let profColor = profile.c || '#2196F3';
    let profAccent = profile.a || '#ffffff';
    let profShape = profile.s || 'capsule';
    if (!profName) {
      const entered = (prompt('Enter your name to play:') || '').trim();
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
      isSpectator = !!ack.spectator;
      browserPanel.classList.add('hidden');
      hudEl.classList.remove('hidden');
      speedDialEl.classList.remove('hidden');
      mini.classList.remove('hidden');
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
    function bindHold(btn, down, up) {
      const start = (e) => { e.preventDefault(); down(); };
      const end = (e) => { e.preventDefault(); up(); if (btn) btn.classList.remove('active'); };
      btn.addEventListener('touchstart', start, { passive: false });
      btn.addEventListener('touchend', end, { passive: false });
      btn.addEventListener('touchcancel', end, { passive: false });
      btn.addEventListener('mousedown', start);
      btn.addEventListener('mouseup', end);
      btn.addEventListener('mouseleave', end);
      btn.addEventListener('mousedown', ()=>btn.classList.add('active'));
      btn.addEventListener('touchstart', ()=>btn.classList.add('active'));
    }
    bindHold(btnLeft, () => { keys.add('a'); keysDown.add('a'); }, () => { keys.delete('a'); keysDown.delete('a'); });
    bindHold(btnRight, () => { keys.add('d'); keysDown.add('d'); }, () => { keys.delete('d'); keysDown.delete('d'); });
    bindHold(btnGas, () => { keys.add('w'); keysDown.add('w'); }, () => { keys.delete('w'); keysDown.delete('w'); });
    bindHold(btnBrake, () => { keys.add('s'); keysDown.add('s'); }, () => { keys.delete('s'); keysDown.delete('s'); });

    setInterval(() => {
      if (isSpectator) return;
      input.throttle = (keys.has('w') || keys.has('arrowup')) ? 1 : 0;
      input.brake = (keys.has('s') || keys.has('arrowdown')) ? 1 : 0;
      const left = (keys.has('a') || keys.has('arrowleft')) ? 1 : 0;
      const right = (keys.has('d') || keys.has('arrowright')) ? 1 : 0;
      input.steer = clamp(right - left, -1, 1);
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
      if (world.state === 'running' && you && p.id === you.id && meLocal && meServer) {
        // Blend local prediction with server authority for smoothness without input lag
        const alpha = 0.08; // softer corrections
        const dx = meServer.x - meLocal.x;
        const dy = meServer.y - meLocal.y;
        meLocal.x += dx * alpha; meLocal.y += dy * alpha;
        meLocal.angle = angleLerp(meLocal.angle, meServer.angle, alpha);
        drawCar(ctx, meLocal.x, meLocal.y, meLocal.angle, e.color || '#000', { throttle: e.throttle, brake: e.brake, accent: e.accent || '#fff', shape: e.shape || 'capsule' });
        // Drop skid marks when slipping
        if (meLocal.slip && meLocal.slip > 0.7) {
          skidMarks.push({ x: meLocal.x, y: meLocal.y, angle: meLocal.angle, life: 160 });
          if (skidMarks.length > SKID_MAX) skidMarks.splice(0, skidMarks.length - SKID_MAX);
        }
      } else {
        drawCar(ctx, e.x, e.y, e.angle, e.color || '#000', { throttle: e.throttle, brake: e.brake, accent: e.accent || '#fff', shape: e.shape || 'capsule' });
      }
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
    // Leaderboard with rank + laps
    const top = world.players.slice(0, 8);
    leaderboardEl.innerHTML = top.map((p, i) => {
      const col = p.color || '#000';
      const name = escapeHtml(p.name);
      const laps = p.laps != null ? p.laps : (entities.get(p.id)?.laps || 0);
      const best = (p.bestLapMs != null) ? (' ' + msShort(p.bestLapMs)) : '';
      return `<div class="lb-row"><div class="lb-rank">${i+1}</div><div class="lb-name" style="color:${col}">${name}</div><div class="lb-lap">L${laps}${best}</div></div>`;
    }).join('');

    // Lap counter for you
    if (you && entities.has(you.id)) {
      const me = entities.get(you.id);
      lapCounterEl.textContent = `Lap ${me.laps || 0}`;
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
    hideFinish();
    browserPanel.classList.remove('hidden');
    fetchRooms();
  }
  if (finishBackBtn) finishBackBtn.addEventListener('click', returnToBrowser);

  // Drawing helpers
  function drawTrack(ctx, t) {
    const n = 256;
    const w2 = t.width / 2;
    // Prepare asphalt pattern
    if (!asphaltPattern) {
      noiseCanvas = document.createElement('canvas');
      noiseCanvas.width = noiseCanvas.height = 128;
      const nctx = noiseCanvas.getContext('2d');
      const img = nctx.createImageData(128,128);
      for (let i=0;i<img.data.length;i+=4){
        const v = 230 + Math.floor(Math.random()*10); // light noise
        img.data[i]=img.data[i+1]=img.data[i+2]=v; img.data[i+3]=18; // low alpha
      }
      nctx.putImageData(img,0,0);
      asphaltPattern = ctx.createPattern(noiseCanvas, 'repeat');
    }
    // Grass background large disc
    ctx.save();
    ctx.fillStyle = '#cde7b0';
    const fieldR = t.baseRadius + t.width + 800;
    ctx.beginPath(); ctx.arc(0,0, fieldR, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    // Track fill (asphalt)
    ctx.fillStyle = '#ededed';
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const theta = (i / n) * Math.PI * 2;
      const r = rAt(theta, t) + w2;
      const x = Math.cos(theta) * r;
      const y = Math.sin(theta) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    for (let i = n; i >= 0; i--) {
      const theta = (i / n) * Math.PI * 2;
      const r = rAt(theta, t) - w2;
      const x = Math.cos(theta) * r;
      const y = Math.sin(theta) * r;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    if (asphaltPattern) {
      ctx.save();
      ctx.clip();
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = asphaltPattern;
      ctx.fillRect(-fieldR, -fieldR, fieldR*2, fieldR*2);
      ctx.restore();
    }

    // Edge outlines for clarity
    ctx.strokeStyle = '#cfcfcf';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const theta = (i / n) * Math.PI * 2;
      const r = rAt(theta, t) + w2;
      const x = Math.cos(theta) * r;
      const y = Math.sin(theta) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = '#e0e0e0';
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const theta = (i / n) * Math.PI * 2;
      const r = rAt(theta, t) - w2;
      const x = Math.cos(theta) * r;
      const y = Math.sin(theta) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Centerline with direction chevrons
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 4;
    ctx.setLineDash([18, 16]);
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const theta = (i / n) * Math.PI * 2;
      const r = rAt(theta, t);
      const x = Math.cos(theta) * r;
      const y = Math.sin(theta) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Curbs (red/white) along inner/outer edges at intervals
    const CURB_STEP = 28;
    for (let i = 0; i < n; i++) {
      const theta = (i / n) * Math.PI * 2;
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
    const n = 220;
    const w2 = track.width / 2;
    mctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const theta = (i / n) * Math.PI * 2;
      const r = rAt(theta, track) + w2;
      const x = Math.cos(theta) * r;
      const y = Math.sin(theta) * r;
      if (i === 0) mctx.moveTo(x, y); else mctx.lineTo(x, y);
    }
    for (let i = n; i >= 0; i--) {
      const theta = (i / n) * Math.PI * 2;
      const r = rAt(theta, track) - w2;
      const x = Math.cos(theta) * r;
      const y = Math.sin(theta) * r;
      mctx.lineTo(x, y);
    }
    mctx.closePath();
    mctx.fillStyle = '#e8edf7';
    mctx.fill();
    // Bold edges
    mctx.strokeStyle = '#7a8aa6';
    mctx.lineWidth = 3;
    mctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const theta = (i / n) * Math.PI * 2;
      const r = rAt(theta, track) + w2;
      const x = Math.cos(theta) * r;
      const y = Math.sin(theta) * r;
      if (i === 0) mctx.moveTo(x, y); else mctx.lineTo(x, y);
    }
    mctx.stroke();
    mctx.strokeStyle = '#a8b4c9';
    mctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const theta = (i / n) * Math.PI * 2;
      const r = rAt(theta, track) - w2;
      const x = Math.cos(theta) * r;
      const y = Math.sin(theta) * r;
      if (i === 0) mctx.moveTo(x, y); else mctx.lineTo(x, y);
    }
    mctx.stroke();

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

  function drawCar(ctx, x, y, angle, color, flags = {}) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const shape = (flags.shape || 'capsule');
    // Draw car oriented along +X (front is +X)
    const L = CAR_L; // length
    const W = CAR_W; // width
    const r = W / 2; // capsule radius
    const hx = L / 2 - r; // front arc center x
    const tx = -L / 2 + r; // rear arc center x

    // Body capsule (horizontal)
    // Shadow
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(-4, 4, L*0.55, W*0.7, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    if (shape === 'wedge') {
      ctx.moveTo(L/2, 0);
      ctx.lineTo(0, -W/2);
      ctx.lineTo(-L/2, -W/3);
      ctx.lineTo(-L/2, W/3);
      ctx.lineTo(0, W/2);
      ctx.closePath();
    } else {
      ctx.moveTo(tx, -r);
      ctx.lineTo(hx, -r);
      ctx.arc(hx, 0, r, -Math.PI / 2, Math.PI / 2, false); // front semicircle
      ctx.lineTo(tx, r);
      ctx.arc(tx, 0, r, Math.PI / 2, -Math.PI / 2, false); // rear semicircle
      ctx.closePath();
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1.2; ctx.stroke();

    // Nose highlight / accent stripe
    ctx.globalAlpha = 1;
    const accent = flags.accent || '#ffffff';
    ctx.fillStyle = accent;
    ctx.beginPath();
    if (shape === 'wedge') {
      ctx.moveTo(L/2, 0);
      ctx.lineTo(L/2 - 10, -W*0.28);
      ctx.lineTo(L/2 - 10, W*0.28);
      ctx.closePath();
    } else {
      ctx.moveTo(L / 2, 0);
      ctx.lineTo(hx, -r * 0.9);
      ctx.lineTo(hx, r * 0.9);
      ctx.closePath();
    }
    ctx.fill();

    // Windows
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-L*0.05, -W*0.38, L*0.35, W*0.32);
    ctx.fillRect(-L*0.05,  W*0.06,  L*0.35, W*0.32);

    // Tail lights (rear)
    const bright = flags.brake ? 1 : 0.35;
    ctx.fillStyle = `rgba(255, 64, 64, ${bright})`;
    const ly = r - 5;
    const tw = 6, th = 4;
    ctx.fillRect(-L / 2 + 2, -th - 1, tw, th);
    ctx.fillRect(-L / 2 + 2, 1, tw, th);

    // Center stripe to emphasize orientation
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-L / 2 + 2, 0);
    ctx.lineTo(L / 2 - 2, 0);
    ctx.stroke();

    // Wheels (simple dark ovals)
    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath(); ctx.ellipse(-L*0.2, -W*0.55, 4.5, 2.2, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(L*0.15, -W*0.55, 4.5, 2.2, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-L*0.2,  W*0.55, 4.5, 2.2, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(L*0.15,  W*0.55, 4.5, 2.2, 0, 0, Math.PI*2); ctx.fill();

    // Exhaust flame when full throttle and not braking
    if (flags.throttle && !flags.brake) {
      ctx.fillStyle = 'rgba(255,140,0,0.9)';
      ctx.beginPath();
      ctx.moveTo(-L/2 - 2, -3);
      ctx.lineTo(-L/2 - 10 - Math.random()*6, 0);
      ctx.lineTo(-L/2 - 2, 3);
      ctx.closePath(); ctx.fill();
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
    const throttling = (keysDown.has('w') || keysDown.has('arrowup'));
    const braking = (keysDown.has('s') || keysDown.has('arrowdown'));
    const left = (keysDown.has('a') || keysDown.has('arrowleft')) ? 1 : 0;
    const right = (keysDown.has('d') || keysDown.has('arrowright')) ? 1 : 0;
    const steerInput = clamp(right - left, -1, 1);

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
    meLocal.throttle = meLocal.throttle == null ? (throttling?1:0) : meLocal.throttle + (((throttling?1:0) - meLocal.throttle) * Math.min(1, 6*dt));
    if (meLocal.throttle) { ax += fx * PHY.ACCEL * meLocal.throttle; ay += fy * PHY.ACCEL * meLocal.throttle; }
    if (braking) {
      const vdotf = meLocal.vx * fx + meLocal.vy * fy;
      if (vdotf > 40) { ax += -fx * PHY.BRAKE; ay += -fy * PHY.BRAKE; }
      else { ax += -fx * PHY.REV_ACCEL; ay += -fy * PHY.REV_ACCEL; }
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
