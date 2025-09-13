const { customAlphabet } = require('nanoid');
const { createTrack, rAt, worldToTrackPolar, clamp, curvatureAt, segmentAtTheta, angleDiff } = require('./track');
const { makeEvents } = require('./campaign');

const nanoid = customAlphabet('123456789ABCDEFGHJKLMNPQRSTUVWXYZ', 8);

const MAX_PLAYERS_DEFAULT = 30;
const RACE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const COUNTDOWN_MS = 10 * 1000; // 10 seconds
const MIN_PLAYERS_TO_START = 15;
const SNAPSHOT_RATE = 30; // Hz
const AUTO_START_WAIT_MS = 2 * 60 * 1000; // 2 minutes

// Physics constants
const CAR_RADIUS = 12;
const ACCEL = 900; // forward accel units/sec^2
const BRAKE = 1200; // braking decel units/sec^2
const REV_ACCEL = 650; // reverse accel units/sec^2
const DRAG = 0.995; // per 16ms frame multiplier baseline
const MAX_TURN_RATE = 4.5; // rad/sec base at low speed (smoothed)
const VREF = 450; // speed at which steering begins to damp
const MAX_SPEED = 200; // forward cap (magnitude)
const MAX_REVERSE_SPEED = 20; // cap reverse speed along forward axis
const STEER_RESP = 10; // how fast steerState chases input (1/s)
const GRIP_LOW_SPEED = 10; // lateral damping at low speed (1/s)
const GRIP_HIGH_SPEED = 4;  // lateral damping at high speed (1/s)
const THROTTLE_RESP = 6;    // how fast throttle ramps (1/s)
const ALAT_LOW = 260;   // max lateral accel low-speed corner
const ALAT_MED = 380;   // max lateral accel medium corner
const ALAT_HIGH = 520;  // max lateral accel high-speed corner
// Wall/slide penalties
const WALL_SCRAPE = 25;        // tangential friction 1/s while sliding on wall
const WALL_IMPACT_SLOW = 0.5;  // immediate slow factor on impact (>=50%)
const WALL_SLIDE_MAX = 1e9;    // absolute cap; effective cap = min(this, MAX_SPEED*0.5)
const SLIDE_THRESHOLD = 0.7;   // slip ratio to consider drifting
const SLIDE_CAP_FACTOR = 0.5;  // cap overall speed to 50% of max when sliding

class Rooms {
  constructor(stats) {
    this.rooms = new Map();
    this.lastTick = Date.now();
    this.stats = stats;
  }

  list() {
    const now = Date.now();
    return Array.from(this.rooms.values()).filter(r => !r.hidden).map(r => {
      let timeRemaining = 0;
      if (r.state === 'countdown' && r.countdownEndAt) timeRemaining = Math.max(0, r.countdownEndAt - now);
      else if (r.state === 'running' && r.raceEndAt) timeRemaining = Math.max(0, r.raceEndAt - now);
      else if (r.state === 'finished' && r.finishedAt) timeRemaining = Math.max(0, (r.finishedAt + 10000) - now);
      const humans = Array.from(r.players.values()).filter(p => !p.isBot).length;
      return {
        id: r.id,
        name: r.name,
        players: humans,
        maxPlayers: r.maxPlayers,
        timeRemaining,
        state: r.state,
        hasPassword: !!r.password,
      };
    });
  }

  create({ name, maxPlayers } = {}) {
    const id = nanoid();
    const room = new Room({ id, name: name || `Race ${id}`, maxPlayers: Math.min(MAX_PLAYERS_DEFAULT, maxPlayers || MAX_PLAYERS_DEFAULT) }, this.stats);
    this.rooms.set(id, room);
    return room;
  }

  createCampaign({ event, name } = {}) {
    const id = nanoid();
    const room = new Room({ id, name: name || `Campaign ${id}`, maxPlayers: 1 }, this.stats);
    room.isCampaign = true;
    room.hidden = true;
    room.setupCampaign(event);
    this.rooms.set(id, room);
    return room;
  }

  createCustom({ name, maxPlayers, durationMs, password, aiCount, aiLevel, minPlayersToStart } = {}) {
    const id = nanoid();
    const room = new Room({ id, name: name || `Custom ${id}`, maxPlayers: Math.min(MAX_PLAYERS_DEFAULT, maxPlayers || MAX_PLAYERS_DEFAULT) }, this.stats);
    room.isCustom = true;
    room.password = password ? String(password) : null;
    room.raceDurationMs = Math.max(60_000, Number(durationMs) || RACE_DURATION_MS);
    room.minPlayersToStart = Math.max(1, Number(minPlayersToStart) || 2);
    if (aiCount && aiCount > 0) {
      room.addCustomBots(Math.min(20, Math.max(0, aiCount|0)), String(aiLevel || 'medium').toLowerCase());
    }
    this.rooms.set(id, room);
    return room;
  }

  get(id) {
    return this.rooms.get(id);
  }

  tick() {
    const now = Date.now();
    const dt = Math.min(0.05, (now - this.lastTick) / 1000); // clamp dt to 50ms
    this.lastTick = now;
    const updates = [];
    const toDelete = [];
    for (const room of this.rooms.values()) {
      room.tick(dt, now);
      const payload = room.snapshot(now);
      updates.push({ roomId: room.id, state: payload });
      const humans = Array.from(room.players.values()).filter(p => !p.isBot).length;
      if ((room.state === 'waiting' || room.state === 'finished') && humans === 0) {
        // remove empty rooms
        toDelete.push(room.id);
      }
    }
    for (const id of toDelete) this.rooms.delete(id);
    return updates;
  }
}

class Room {
  constructor({ id, name, maxPlayers }, stats) {
    this.id = id;
    this.name = name;
    this.maxPlayers = maxPlayers;
    this.players = new Map(); // socketId -> player
    this.state = 'waiting';
    this.track = createTrack();
    this.countdownEndAt = null;
    this.raceEndAt = 0;
    this.waitingSince = Date.now();
    this.stats = stats; // global stats instance
    this.participants = new Set();
    this.isCampaign = false;
    this.hidden = false;
    this.bots = new Map(); // id -> profile
    this.chat = []; // {name,color,text,ts,system?}
    this.isCustom = false;
    this.password = null;
    this.raceDurationMs = RACE_DURATION_MS;
    this.minPlayersToStart = MIN_PLAYERS_TO_START;
  }

  publicInfo() {
    const now = Date.now();
    return {
      id: this.id,
      name: this.name,
      players: this.players.size,
      maxPlayers: this.maxPlayers,
      timeRemaining: Math.max(0, this.raceEndAt - now),
      state: this.state,
      track: this.track,
    };
  }

  getPlayerPublic(socketId) {
    const p = this.players.get(socketId);
    if (!p) return null;
    return { id: p.id, name: p.name, color: p.color, accent: p.accent, shape: p.shape };
  }

  addPlayer(socket, { name, color, accent, shape, password }) {
    if (this.password && String(password || '') !== String(this.password)) {
      throw new Error('Invalid password');
    }
    if (this.isCampaign) {
      // Single human only in campaign; bots don't count
      const humanCount = Array.from(this.players.values()).filter(p => !p.isBot).length;
      if (humanCount >= 1) throw new Error('Room is full');
    } else {
      if (this.players.size >= this.maxPlayers) {
        throw new Error('Room is full');
      }
    }
    if (this.state === 'running') {
      throw new Error('Race in progress — room is locked');
    }
    const spawn = this.spawnPoint();
    this.players.set(socket.id, {
      id: socket.id,
      name,
      color,
      accent: accent || '#ffffff',
      shape: shape || 'capsule',
      x: spawn.x,
      y: spawn.y,
      angle: spawn.angle,
      vx: 0,
      vy: 0,
      throttle: 0,
      targetThrottle: 0,
      throttleState: 0,
      brake: 0,
      steer: 0,
      steerState: 0,
      lastTheta: spawn.theta,
      laps: 0,
      lapStartAt: Date.now(),
      lapArmed: false,
      lastLapMs: 0,
      bestLapMs: null,
      resets: 0,
      progress: 0,
      connected: true,
    });
    if (this.stats) this.stats.ensure(name);
    // If enough players joined and we're waiting, start countdown
    const humanCount = Array.from(this.players.values()).filter(p => !p.isBot).length;
    if (!this.isCampaign && this.state === 'waiting' && humanCount >= this.minPlayersToStart) {
      this.state = 'countdown';
      this.countdownEndAt = Date.now() + COUNTDOWN_MS;
    }
    if (this.isCampaign && this.state === 'waiting') {
      this.state = 'countdown';
      this.countdownEndAt = Date.now() + 3000;
    }
  }

  removePlayer(socketId) { this.players.delete(socketId); }

  updateInput(socketId, data) {
    const p = this.players.get(socketId);
    if (!p) return;
    p.throttle = data && data.throttle ? 1 : 0;
    p.targetThrottle = p.throttle;
    p.brake = data && data.brake ? 1 : 0;
    let steer = 0;
    if (data && typeof data.steer === 'number') steer = clamp(data.steer, -1, 1);
    p.steer = steer;
  }

  resetPlayer(socketId) {
    const p = this.players.get(socketId);
    if (!p) return;
    const spawn = this.spawnPoint();
    p.x = spawn.x; p.y = spawn.y; p.angle = spawn.angle;
    p.vx = 0; p.vy = 0; p.steerState = 0;
    p.lastTheta = spawn.theta;
    p.resets = (p.resets || 0) + 1;
  }

  addChatMessage({ name, color, text, system }) {
    const ts = Date.now();
    const msg = { name: String(name||'system'), color: String(color||'#666'), text: String(text||''), ts, system: !!system };
    this.chat.push(msg);
    if (this.chat.length > 100) this.chat.shift();
    return msg;
  }

  // voting removed

  spawnPoint() {
    // Place near theta=0 at centerline with slight randomization
    const theta = (this.track && typeof this.track.startTheta === 'number') ? this.track.startTheta : 0;
    const rc = rAt(theta, this.track);
    const r = rc; // centerline spawn
    const x = Math.cos(theta) * r;
    const y = Math.sin(theta) * r;
    const angle = theta + Math.PI / 2; // tangent direction forward
    return { x, y, theta, angle };
  }

  setupCampaign(eventId) {
    this.isCampaign = true;
    this.hidden = true;
    const events = makeEvents();
    const ev = events.find(e => e.id === Number(eventId)) || events[0];
    this.campaign = { id: ev.id, name: ev.name };
    // Place bots along the start line (single row across track width)
    const theta = (this.track && typeof this.track.startTheta === 'number') ? this.track.startTheta : 0;
    const rc = rAt(theta, this.track);
    const w2 = this.track.width / 2;
    const margin = Math.max(CAR_RADIUS + 4, w2 * 0.12);
    const n = ev.bots.length;
    const span = (w2 - margin) - (-w2 + margin);
    const step = n > 1 ? span / (n - 1) : 0;
    let idx = 0;
    for (const prof of ev.bots) {
      const id = `bot-${nanoid()}`;
      const offsetFromCenter = -w2 + margin + step * idx; // radial offset relative to centerline
      const r = rc + offsetFromCenter;
      const x = Math.cos(theta) * r;
      const y = Math.sin(theta) * r;
      const color = `hsl(${(idx * 47) % 360} 75% 50%)`;
      this.players.set(id, {
        id,
        name: `AI ${idx+1}`,
        color,
        x,
        y,
        angle: theta + Math.PI / 2,
        vx: 0,
        vy: 0,
        throttle: 0,
        targetThrottle: 0,
        throttleState: 0,
        brake: 0,
        steer: 0,
        steerState: 0,
        lastTheta: theta,
        laps: 0,
        lapStartAt: 0,
        lastLapMs: 0,
        bestLapMs: null,
        resets: 0,
        progress: 0,
        connected: false,
        isBot: true,
        profile: prof,
      });
      idx++;
    }
    // Allow one human player in addition to bots
    this.maxPlayers = this.players.size + 1;
  }

  addCustomBots(count, level) {
    const theta = (this.track && typeof this.track.startTheta === 'number') ? this.track.startTheta : 0;
    const rc = rAt(theta, this.track);
    const w2 = this.track.width / 2;
    const margin = Math.max(CAR_RADIUS + 4, w2 * 0.12);
    const n = Math.max(0, count|0);
    const span = (w2 - margin) - (-w2 + margin);
    const step = n > 1 ? span / (n - 1) : 0;
    const scaleByLevel = (base) => {
      switch (String(level || 'medium')) {
        case 'easy': return base * 0.8;
        case 'hard': return base * 1.15;
        case 'veryhard': return base * 1.25;
        default: return base;
      }
    };
    for (let i = 0; i < n; i++) {
      const id = `bot-${nanoid()}`;
      const off = -w2 + margin + step * i;
      const r = rc + off;
      const x = Math.cos(theta) * r;
      const y = Math.sin(theta) * r;
      const color = `hsl(${(i * 47) % 360} 75% 50%)`;
      const aLat = scaleByLevel(220) * (0.9 + Math.random()*0.2);
      const maxSpeed = scaleByLevel(Math.min(MAX_SPEED, 150 + Math.random()*30));
      const steerGain = scaleByLevel(1.3 + Math.random()*0.4);
      const look = 0.11 + Math.random()*0.06;
      const brakeAgg = 0.7 + Math.random()*0.2;
      const laneBias = (-0.6 + Math.random()*1.2);
      const apexBias = 0.4 + Math.random()*0.4;
      const jitterAmp = 0.03 + Math.random()*0.07;
      const jitterFreq = 0.4 + Math.random()*0.9;
      const reaction = 0.06 + Math.random()*0.12;
      const bravery = 0.9 + Math.random()*0.3;
      this.players.set(id, {
        id,
        name: `AI ${i+1}`,
        color,
        x, y,
        angle: theta + Math.PI / 2,
        vx: 0, vy: 0,
        throttle: 0, targetThrottle: 0, throttleState: 0, brake: 0, steer: 0, steerState: 0,
        lastTheta: theta,
        laps: 0,
        lapStartAt: 0, lastLapMs: 0, bestLapMs: null,
        resets: 0, progress: 0,
        connected: false,
        isBot: true,
        profile: { aLat, maxSpeed, steerGain, look, brakeAgg, laneBias, apexBias, jitterAmp, jitterFreq, reaction, bravery },
      });
    }
    // raise capacity to include one human
    this.maxPlayers = Math.max(this.maxPlayers, this.players.size + 1);
  }

  updateBot(p, dt) {
    // Parameters
    const prof = p.profile || {};
    p.aiT = (p.aiT || 0) + dt;
    if (!p.aiPhase) p.aiPhase = Math.random() * Math.PI * 2;
    const w2 = this.track.width / 2;

    // Speed-adaptive lookahead
    const speed = Math.hypot(p.vx, p.vy);
    const lookBase = prof.look || 0.12;
    const look = clamp(lookBase + 0.0009 * speed, 0.08, 0.35);

    // Track geometry ahead
    const pol = worldToTrackPolar(p.x, p.y);
    const ahead = pol.theta + look;
    const rCenter = rAt(ahead, this.track);
    const kappa = curvatureAt(ahead, this.track);
    const kappa2 = curvatureAt(ahead + 0.03, this.track);
    const curveF = clamp(kappa * 600, 0, 1);

    // Desired lane offset: lane bias ± apex cut on curves + jitter
    const laneBias = prof.laneBias || 0;   // -1..1 across width
    const apexBias = prof.apexBias || 0.6; // 0..1
    const jitA = prof.jitterAmp || 0.05;
    const jitF = prof.jitterFreq || 0.8;
    const jitter = Math.sin(p.aiT * (2 * Math.PI * jitF) + p.aiPhase) * (jitA * w2);
    let offset = (laneBias * (w2 * 0.7)) - (apexBias * curveF * (w2 * 0.6)) + jitter;

    // Traffic-aware overtake: choose side opposite the nearest car ahead
    let nearestAhead = null;
    let bestDist2 = 1e12;
    const fx = Math.cos(p.angle), fy = Math.sin(p.angle);
    for (const q of this.players.values()) {
      if (q === p) continue;
      const dx = q.x - p.x, dy = q.y - p.y;
      if (dx*fx + dy*fy <= 0) continue; // only consider ahead
      const d2 = dx*dx + dy*dy;
      if (d2 < bestDist2) { bestDist2 = d2; nearestAhead = q; }
    }
    if (nearestAhead && bestDist2 < 220*220) {
      const qPol = worldToTrackPolar(nearestAhead.x, nearestAhead.y);
      // If target car is inside, we bias outside (and vice versa)
      const isInside = qPol.r < rCenter;
      const sideBias = (isInside ? +1 : -1) * (0.4 * w2);
      offset += sideBias;
      // extra brake when very close
      if (bestDist2 < 110*110) { p.brake = 1; p.throttle = 0; }
    }

    // Clamp offset inside track width margins
    const margin = Math.max(CAR_RADIUS + 4, w2 * 0.1);
    offset = clamp(offset, -w2 + margin, +w2 - margin) - 0; // ensure in bounds

    // Target point in world
    const desiredR = rCenter + offset;
    const tx = Math.cos(ahead) * desiredR;
    const ty = Math.sin(ahead) * desiredR;

    // Aim and steering PID-like control
    const desiredAngle = Math.atan2(ty - p.y, tx - p.x);
    const err = angleDiff(desiredAngle, p.angle);
    p.aiErr = p.aiErr == null ? err : p.aiErr + (err - p.aiErr) * clamp(dt / Math.max(0.02, prof.reaction || 0.12), 0, 1);
    p.aiErrI = clamp((p.aiErrI || 0) + err * dt, -0.6, 0.6);
    const derr = (p.aiPrevErr == null ? 0 : (err - p.aiPrevErr) / Math.max(1e-3, dt));
    p.aiPrevErr = err;
    const kp = prof.steerGain || 1.5;
    const kd = prof.kdGain != null ? prof.kdGain : 0.08;
    const ki = 0.2;
    p.steer = clamp(kp * p.aiErr + kd * (-derr) + ki * p.aiErrI, -1, 1);

    // Speed control: anticipate corner tightening using curvature gradient
    const bravery = prof.bravery || 1.0;
    const aLat = Math.max(60, prof.aLat || 200);
    let vCorner = Math.sqrt(aLat / Math.max(kappa, 1e-6)) * bravery;
    const kGrow = kappa2 - kappa; // tightening
    if (kGrow > 0) vCorner *= clamp(1 - kGrow * 120, 0.6, 1); // pre-brake on tightening
    const vMax = Math.min(MAX_SPEED, prof.maxSpeed || 160);
    const target = Math.min(vCorner, vMax);
    const over = speed - target;
    const margin2 = 2 + (prof.brakeAgg || 0.8) * 2.5;
    // Slip-aware throttle
    const sx = -Math.sin(p.angle), sy = Math.cos(p.angle);
    const vSide = p.vx * sx + p.vy * sy;
    const vFwd = p.vx * Math.cos(p.angle) + p.vy * Math.sin(p.angle);
    const slip = Math.abs(vSide) / (Math.abs(vFwd) + 1);
    if (over > margin2) { p.brake = 1; p.throttle = 0; }
    else if (slip > 0.7) { p.brake = 1; p.throttle = 0; }
    else if (speed < target - 4) { p.throttle = 1; p.brake = 0; }
    else { p.throttle = 0; p.brake = 0; }
    // Feed smoothed throttle pipeline
    p.targetThrottle = p.throttle;
  }

  tick(dt, now) {
    // Handle state transitions
    if (this.state === 'countdown' && now >= this.countdownEndAt) {
      // Start the race
      this.state = 'running';
      this.raceEndAt = now + (this.raceDurationMs || RACE_DURATION_MS);
      this.waitingSince = null;
      // Record participants for stats (humans only)
      this.participants = new Set(Array.from(this.players.values()).filter(p => !p.isBot).map(p => p.name));
      // Snap everyone to start line for a fair start
      if (this.isCampaign) {
        // Place all players across width on start line; human in center if present
        const theta = (this.track && typeof this.track.startTheta === 'number') ? this.track.startTheta : 0;
        const rc = rAt(theta, this.track);
        const w2 = this.track.width / 2;
        const margin = Math.max(CAR_RADIUS + 4, w2 * 0.12);
        const all = Array.from(this.players.values());
        // Put human first (center lane), then bots
        all.sort((a,b) => (a.isBot?1:0) - (b.isBot?1:0));
        const n = all.length;
        const span = (w2 - margin) - (-w2 + margin);
        const step = n > 1 ? span / (n - 1) : 0;
        for (let i=0;i<n;i++) {
          const p = all[i];
          const off = -w2 + margin + step * i;
          const r = rc + off;
          p.x = Math.cos(theta) * r;
          p.y = Math.sin(theta) * r;
          p.angle = theta + Math.PI / 2;
          p.vx = 0; p.vy = 0; p.steerState = 0; p.brake = 0; p.throttle = 0; p.targetThrottle = 0; p.throttleState = 0;
          p.lastTheta = theta; p.laps = 0; p.progress = 0; p.lapStartAt = now; p.lastLapMs = 0; p.bestLapMs = null;
        }
      } else {
        for (const p of this.players.values()) {
          const spawn = this.spawnPoint();
          p.x = spawn.x; p.y = spawn.y; p.angle = spawn.angle;
          p.vx = 0; p.vy = 0; p.steerState = 0; p.brake = 0; p.throttle = 0; p.targetThrottle = 0; p.throttleState = 0;
          p.lastTheta = spawn.theta; p.laps = 0; p.progress = 0; p.lapStartAt = now; p.lastLapMs = 0; p.bestLapMs = null;
        }
      }
    }
    if (this.state === 'running' && now >= this.raceEndAt) {
      // Determine winner by best progress
      let winner = null;
      let bestProg = -Infinity;
      for (const p of this.players.values()) {
        if (p.progress > bestProg) { bestProg = p.progress; winner = p; }
      }
      if (this.stats && !this.isCampaign) {
        for (const name of this.participants) this.stats.addRace(name);
        if (winner && this.participants.has(winner.name)) this.stats.addWin(winner.name);
      }
      // Race finished — hold results for 10s before cleanup
      this.state = 'finished';
      this.finishedAt = now;
      this.results = Array.from(this.players.values()).map(p => ({ id: p.id, name: p.name, laps: p.laps, bestLapMs: p.bestLapMs || 0 })).sort((a,b)=>{
        const pa = this.players.get(a.id).progress;
        const pb = this.players.get(b.id).progress;
        return pb - pa;
      });
      return;
    }
    if (this.state === 'finished' && this.finishedAt && now >= this.finishedAt + 10000) {
      // Reset to waiting with new track
      this.state = 'waiting';
      this.track = createTrack();
      this.countdownEndAt = null;
      this.raceEndAt = 0;
      this.waitingSince = now;
      this.finishedAt = null;
      this.results = null;
      for (const p of this.players.values()) {
        const spawn = this.spawnPoint();
        p.x = spawn.x; p.y = spawn.y; p.angle = spawn.angle;
        p.vx = 0; p.vy = 0; p.steerState = 0;
        p.lastTheta = spawn.theta; p.laps = 0; p.progress = 0;
      }
    }

    // Auto-start after timeout with whoever is present
    if (this.state === 'waiting') {
      const humans = Array.from(this.players.values()).filter(p => !p.isBot).length;
      if (humans >= 1 && this.waitingSince && (now - this.waitingSince) >= AUTO_START_WAIT_MS) {
        this.state = 'countdown';
        this.countdownEndAt = now + COUNTDOWN_MS;
        this.waitingSince = null;
      }
    }

    // If not running, freeze players
    const allowSim = this.state === 'running';

    for (const p of this.players.values()) {
      if (!allowSim) {
        // Keep players stationary during waiting/countdown
        p.vx = 0; p.vy = 0; // don't change angle either
        continue;
      }
      // Local vectors
      const fx = Math.cos(p.angle);
      const fy = Math.sin(p.angle);
      const sx = -fy, sy = fx;

      // AI update for bots (sets p.steer/throttle/brake before physics)
      if (p.isBot) {
        this.updateBot(p, dt);
      }

      // Speed and steering smoothing
      const speed = Math.hypot(p.vx, p.vy);
      const steerTarget = clamp(p.steer || 0, -1, 1);
      const lerpAmt = clamp(STEER_RESP * dt, 0, 1);
      p.steerState = p.steerState + (steerTarget - p.steerState) * lerpAmt;
      // Throttle smoothing
      const thrAmt = clamp(THROTTLE_RESP * dt, 0, 1);
      p.throttleState = p.throttleState + ((p.targetThrottle||0) - p.throttleState) * thrAmt;

      // Speed-aware steering: more stable at high speed
      const damp = 1 / (1 + Math.pow(speed / VREF, 1.2)); // 0..1
      const turnRate = MAX_TURN_RATE * damp;
      p.angle += p.steerState * turnRate * dt;

      // Acceleration / braking
      let ax = 0, ay = 0;
      if (p.throttleState) { ax += fx * ACCEL * p.throttleState; ay += fy * ACCEL * p.throttleState; }
      if (p.brake) {
        // project velocity onto forward and apply braking or reverse accel
        const vdotf = p.vx * fx + p.vy * fy;
        if (vdotf > 40) {
          // Still moving forward: brake
          ax += -fx * BRAKE;
          ay += -fy * BRAKE;
        } else {
          // Near stop or moving backward: reverse throttle
          ax += -fx * REV_ACCEL;
          ay += -fy * REV_ACCEL;
        }
      }

      p.vx += ax * dt;
      p.vy += ay * dt;

      // Base drag
      const dragPow = Math.pow(DRAG, dt / (1 / 60));
      p.vx *= dragPow;
      p.vy *= dragPow;

      // Lateral grip: damp sideways velocity, less at high speed
      const vSide = p.vx * sx + p.vy * sy;
      const vFwd = p.vx * fx + p.vy * fy;
      const grip = GRIP_LOW_SPEED + (GRIP_HIGH_SPEED - GRIP_LOW_SPEED) * clamp(speed / 900, 0, 1);
      const sideAfter = vSide * Math.exp(-Math.max(0, grip) * dt);
      // Recompose
      p.vx = fx * vFwd + sx * sideAfter;
      p.vy = fy * vFwd + sy * sideAfter;

      // Curvature-based corner speed handling
      const pol = worldToTrackPolar(p.x, p.y);
      const seg = segmentAtTheta(pol.theta, this.track);
      const kappa = curvatureAt(pol.theta, this.track); // 1/units
      let aLatMax = ALAT_MED;
      if (seg) {
        switch (seg.kind) {
          case 'hairpin': aLatMax = ALAT_LOW; break;
          case 'sweeper': aLatMax = ALAT_HIGH; break;
          case 'kink': aLatMax = ALAT_MED; break;
          case 'chicane': aLatMax = ALAT_MED; break;
          default: aLatMax = ALAT_MED; break;
        }
      }
      const vmaxCorner = Math.sqrt(aLatMax / Math.max(kappa, 1e-6));
      if (speed > vmaxCorner) {
        // Extra drag when exceeding corner speed; also reduce steering authority (understeer)
        const excess = clamp((speed - vmaxCorner) / Math.max(vmaxCorner, 1), 0, 3);
        const extraDrag = Math.exp(-excess * 3.0 * dt);
        p.vx *= extraDrag;
        p.vy *= extraDrag;
        // Reduce steer state temporarily
        p.steerState *= Math.max(0.5, 1 - 0.4 * excess);
      }

      // Slow down when sliding (high lateral slip)
      {
        const vSide2 = p.vx * sx + p.vy * sy;
        const vFwd2 = p.vx * fx + p.vy * fy;
        const slip = Math.abs(vSide2) / (Math.abs(vFwd2) + 1);
        const cap = MAX_SPEED * SLIDE_CAP_FACTOR;
        const spd = Math.hypot(p.vx, p.vy);
        if (slip > SLIDE_THRESHOLD && spd > cap) {
          const s = cap / (spd || 1);
          p.vx *= s; p.vy *= s;
        }
      }

      // Speed cap (forward magnitude) and reverse cap along forward axis
      const newSpeed = Math.hypot(p.vx, p.vy);
      if (newSpeed > MAX_SPEED) {
        const s = MAX_SPEED / newSpeed;
        p.vx *= s; p.vy *= s;
      }
      // Limit reverse: clamp forward component not to exceed MAX_REVERSE_SPEED
      {
        const vFwd = p.vx * fx + p.vy * fy;
        if (vFwd < -MAX_REVERSE_SPEED) {
          const vSide = p.vx * sx + p.vy * sy;
          const clampedF = -MAX_REVERSE_SPEED;
          p.vx = fx * clampedF + sx * vSide;
          p.vy = fy * clampedF + sy * vSide;
        }
      }

      // Integrate position
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Track boundary collision (ring with variable radius)
      // Recompute polar AFTER integration for accurate contact
      const pol2 = worldToTrackPolar(p.x, p.y);
      const rc = rAt(pol2.theta, this.track);
      const w2 = this.track.width / 2;
      const minR = rc - w2 + CAR_RADIUS;
      const maxR = rc + w2 - CAR_RADIUS;
      let r = pol2.r;

      if (r < minR || r > maxR) {
        // Compute radial and tangential unit vectors in world space
        const ux = Math.cos(pol2.theta);
        const uy = Math.sin(pol2.theta);
        const tx = -Math.sin(pol2.theta);
        const ty = Math.cos(pol2.theta);

        // Where did we hit?
        const hitOuter = r > maxR;
        const hitInner = r < minR;

        // Push back to edge (depenetration)
        const EPS = 2; // keep a hair inside the boundary to avoid re-contact
        r = clamp(r, minR + EPS, maxR - EPS);
        p.x = ux * r;
        p.y = uy * r;

        // Decompose velocity into radial + tangential
        const vrad0 = p.vx * ux + p.vy * uy;
        const vtan0x = p.vx - vrad0 * ux;
        const vtan0y = p.vy - vrad0 * uy;

        // Reflect only if moving further into the wall
        let vrad = vrad0;
        const movingIntoOuter = hitOuter && vrad0 > 0;
        const movingIntoInner = hitInner && vrad0 < 0;
        if (movingIntoOuter || movingIntoInner) {
          const bounce = -0.25; // slightly softer
          vrad = vrad0 * bounce;
          // Impact slowdown: at least 50% slower
          const curSpd = Math.hypot(p.vx, p.vy);
          if (curSpd > 1) {
            p.vx *= WALL_IMPACT_SLOW; p.vy *= WALL_IMPACT_SLOW;
          }
        }

        // If player is holding throttle into the wall, prevent radial re-penetration
        const fDotU = fx * ux + fy * uy; // forward vs wall normal
        if (p.throttle && hitOuter && fDotU > 0) vrad = Math.min(vrad, 0);
        if (p.throttle && hitInner && fDotU < 0) vrad = Math.max(vrad, 0);

        // Tangential scraping friction (time-based), stronger when throttling into wall
        const scrape = Math.exp(-WALL_SCRAPE * dt * (p.throttle ? 1.3 : 1.0));
        let vtanx = vtan0x * scrape;
        let vtany = vtan0y * scrape;
        // Cap sliding speed along wall to <= 50% of max speed (or absolute cap)
        const capAlongWall = Math.min(WALL_SLIDE_MAX, MAX_SPEED * 0.5);
        const vtanSpeed = Math.hypot(vtanx, vtany);
        if (vtanSpeed > capAlongWall) {
          const s = capAlongWall / (vtanSpeed || 1);
          vtanx *= s; vtany *= s;
        }

        // Nudge along wall when very slow and throttling, to help escape
        const speed2 = p.vx * p.vx + p.vy * p.vy;
        if (p.throttle && speed2 < 25 * 25) {
          const nudge = 320; // units/sec along tangent
          const dir = (fDotU >= 0) ? 1 : -1; // approximate direction relative to forward
          vtanx += tx * nudge * dt * dir;
          vtany += ty * nudge * dt * dir;
        }

        // Recompose
        p.vx = vtanx + vrad * ux;
        p.vy = vtany + vrad * uy;
      }

      // Progress and laps tracking
      const theta = pol.theta;
      // Determine direction using tangential unit
      const tx = -Math.sin(theta), ty = Math.cos(theta);
      const forward = (p.vx * tx + p.vy * ty) >= 0; // moving along increasing theta
      // wrap detection with lap arming (must pass mid-track before counting)
      const TAU = Math.PI * 2;
      const startTheta = (this.track && typeof this.track.startTheta === 'number') ? this.track.startTheta : 0;
      const rel = ((theta - startTheta) % TAU + TAU) % TAU; // 0..TAU
      const lastRel = ((p.lastTheta - startTheta) % TAU + TAU) % TAU;
      // Arm when car reaches opposite half of track (between 90 and 270 degrees from start)
      if (rel > TAU * 0.25 && rel < TAU * 0.75) p.lapArmed = true;
      // Count lap only when armed and crossing start forward
      if (p.lapArmed && lastRel > TAU * 0.75 && rel < TAU * 0.25 && forward) {
        p.laps += 1;
        p.lapArmed = false;
        if (p.lapStartAt) {
          const lapMs = now - p.lapStartAt;
          p.lastLapMs = lapMs;
          if (p.bestLapMs == null || lapMs < p.bestLapMs) p.bestLapMs = lapMs;
        }
        p.lapStartAt = now;
        if (this.stats && !this.isCampaign && !p.isBot) this.stats.addLap(p.name, 1);
      }
      // Do not allow negative lap exploit; still track reverse crossing but keep >= 0
      if (lastRel < TAU * 0.25 && rel > TAU * 0.75 && !forward) p.laps = Math.max(0, p.laps - 1);
      p.lastTheta = theta;
      p.progress = p.laps * TAU + theta;
    }
  }

  snapshot(now) {
    const players = Array.from(this.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      accent: p.accent,
      shape: p.shape,
      x: p.x,
      y: p.y,
      angle: p.angle,
      laps: p.laps || 0,
      speed: Math.round(Math.hypot(p.vx || 0, p.vy || 0)),
      lastLapMs: p.lastLapMs || 0,
      bestLapMs: p.bestLapMs,
      resets: p.resets || 0,
      throttle: !!p.throttle,
      brake: !!p.brake,
    }));
    players.sort((a, b) => {
      const pa = this.players.get(a.id).progress;
      const pb = this.players.get(b.id).progress;
      return pb - pa;
    });
    // Time remaining depends on state
    let timeRemaining = 0;
    if (this.state === 'countdown' && this.countdownEndAt) timeRemaining = Math.max(0, this.countdownEndAt - now);
    else if (this.state === 'running' && this.raceEndAt) timeRemaining = Math.max(0, this.raceEndAt - now);
    else if (this.state === 'finished' && this.finishedAt) timeRemaining = Math.max(0, (this.finishedAt + 10000) - now);

    return {
      now,
      room: { id: this.id, name: this.name },
      state: this.state,
      timeRemaining,
      track: this.track,
      players,
      isCustom: !!this.isCustom,
      results: this.state === 'finished' ? (this.results || []) : undefined,
      leaderboard: players.map(p => ({ id: p.id, name: p.name })),
    };
  }
}

module.exports = Rooms;
