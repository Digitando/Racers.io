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
const EMPTY_ROOM_GRACE_MS = 5 * 60 * 1000; // allow empty rooms to persist briefly
const AUTO_FILL_WAIT_MS = 30 * 1000; // 30 seconds
const SHAPE_LIST = ['capsule', 'wedge', 'formula', 'roadster', 'buggy', 'dragster', 'hover'];
const ALLOWED_SHAPES = new Set(SHAPE_LIST);
const DEFAULT_SHAPE = SHAPE_LIST[0];
const PLAYER_NAME_MAX = 10;

const AUTO_FILL_BOT_STYLES = ['rookie', 'pro', 'legend'];

const sanitizeShape = (shape) => {
  const s = typeof shape === 'string' ? shape.toLowerCase() : '';
  return ALLOWED_SHAPES.has(s) ? s : DEFAULT_SHAPE;
};

const sanitizePlayerName = (name) => {
  let str = typeof name === 'string' ? name : '';
  str = str.replace(/\s+/g, ' ').trim();
  if (!str) str = 'Racer';
  if (str.length > PLAYER_NAME_MAX) str = str.slice(0, PLAYER_NAME_MAX);
  return str;
};

const randRange = (min, max) => min + Math.random() * (max - min);

function createBotProfile(style = 'pro') {
  switch (String(style || '').toLowerCase()) {
    case 'legend':
    case 'god':
    case 'extreme':
      return {
        style: 'legend',
        aLat: randRange(620, 820),
        maxSpeed: randRange(BOT_MAX_SPEED - 4, BOT_MAX_SPEED + 6),
        steerGain: randRange(2.05, 2.45),
        look: randRange(0.28, 0.38),
        brakeAgg: randRange(0.1, 0.22),
        laneBias: randRange(-0.08, 0.08),
        apexBias: randRange(0.92, 1.1),
        jitterAmp: randRange(0.0, 0.016),
        jitterFreq: randRange(0.32, 0.6),
        reaction: randRange(0.018, 0.032),
        bravery: randRange(1.7, 2.05),
        throttleFloor: randRange(0.82, 0.94),
        throttleAgg: randRange(1.8, 2.1),
        slipBrakeThreshold: randRange(0.97, 0.99),
        panicSlipThreshold: randRange(0.988, 0.999),
        kdGain: randRange(0.16, 0.26),
      };
    case 'rookie':
    case 'easy':
    case 'novice':
      return {
        style: 'rookie',
        aLat: randRange(260, 360),
        maxSpeed: randRange(SOFT_SPEED_CAP + 40, SOFT_SPEED_CAP + 80),
        steerGain: randRange(1.35, 1.6),
        look: randRange(0.2, 0.28),
        brakeAgg: randRange(0.5, 0.72),
        laneBias: randRange(-0.28, 0.28),
        apexBias: randRange(0.5, 0.82),
        jitterAmp: randRange(0.04, 0.08),
        jitterFreq: randRange(0.4, 0.9),
        reaction: randRange(0.065, 0.11),
        bravery: randRange(1.12, 1.32),
        throttleFloor: randRange(0.26, 0.42),
        throttleAgg: randRange(1.18, 1.4),
        slipBrakeThreshold: randRange(0.76, 0.84),
        panicSlipThreshold: randRange(0.88, 0.94),
        kdGain: randRange(0.08, 0.14),
      };
    default:
      return {
        style: 'pro',
        aLat: randRange(520, 700),
        maxSpeed: randRange(SOFT_SPEED_CAP + 110, BOT_MAX_SPEED + 2),
        steerGain: randRange(1.85, 2.2),
        look: randRange(0.24, 0.34),
        brakeAgg: randRange(0.2, 0.32),
        laneBias: randRange(-0.16, 0.16),
        apexBias: randRange(0.78, 1.0),
        jitterAmp: randRange(0.015, 0.05),
        jitterFreq: randRange(0.32, 0.78),
        reaction: randRange(0.028, 0.05),
        bravery: randRange(1.55, 1.9),
        throttleFloor: randRange(0.68, 0.82),
        throttleAgg: randRange(1.55, 1.85),
        slipBrakeThreshold: randRange(0.9, 0.96),
        panicSlipThreshold: randRange(0.965, 0.992),
        kdGain: randRange(0.14, 0.22),
      };
  }
}

const RAW_AI_NAMES = [
  'Blaze', 'Nova', 'Orbit', 'Zephyr', 'Quasar', 'Vortex', 'Falcon', 'Comet', 'Nitro', 'Nebula',
  'Photon', 'Mirage', 'Turbo', 'Drift', 'Vector', 'Raptor', 'Aurora', 'Pulse', 'Impulse', 'Circuit',
  'Streak', 'Bolt', 'Echo', 'Tempest', 'Ion', 'Cyclone', 'Rocket', 'Sable', 'Zenith', 'Titan',
  'Skye', 'Jolt', 'Pyro', 'Plasma', 'Quake', 'Rift', 'Glide', 'Talon', 'Frost', 'Strider',
  'Cipher', 'Pixel', 'Neon', 'Fury', 'Spark', 'Helix', 'Blitz', 'Nimbus', 'Sonic', 'Crusher',
  'Rally', 'Tracer', 'PhotonX', 'Blazer', 'Onyx', 'Lancer', 'Specter', 'Flux', 'Apex', 'Saber',
  'OrbitX', 'Lyric', 'Astro', 'Skid', 'Spry', 'Glyph', 'NovaX', 'CipherX', 'TracerX', 'Vivid',
  'Dynamo', 'Spire', 'Rapid', 'Whirl', 'Fable', 'Swift', 'Vyper', 'Cipher9', 'SparkX', 'FableX',
  'Gale', 'Nexus', 'Dart', 'Phoenix', 'Orion', 'Quartz', 'BlitzX', 'Horizon', 'Ionix', 'VectorX'
];

const AI_NAME_POOL = Array.from(new Set(RAW_AI_NAMES.map(sanitizePlayerName)));

function shuffleArray(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const aiNameDeck = [];

function nextBotName() {
  if (AI_NAME_POOL.length === 0) return 'AI';
  if (aiNameDeck.length === 0) {
    aiNameDeck.push(...shuffleArray(AI_NAME_POOL));
  }
  return aiNameDeck.pop();
}

// Physics constants
const CAR_RADIUS = 12;
const ACCEL = 900; // forward accel units/sec^2
const BRAKE = 1200; // braking decel units/sec^2
const REV_ACCEL = 650; // reverse accel units/sec^2
const DRAG = 0.995; // per 16ms frame multiplier baseline
const MAX_TURN_RATE = 4.5; // rad/sec base at low speed (smoothed)
const VREF = 450; // speed at which steering begins to damp
const SOFT_SPEED_CAP = 200; // comfortable top speed before extra drag kicks in
const MAX_SPEED = 300; // absolute forward cap (magnitude) for humans
const BOT_MAX_SPEED = 360; // bots can exceed human cap slightly
const EXTENDED_SPEED_RANGE = MAX_SPEED - SOFT_SPEED_CAP;
const EXTENDED_SPEED_ACCEL_FALLOFF = 0.95; // >0 slows acceleration when over soft cap
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
const WALL_SLIDE_MAX = 1e9;    // absolute cap; effective cap = min(this, SOFT_SPEED_CAP * 0.5)
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
      const humans = r.humanCount || 0;
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
    room.autoFillBotsAdded = true;
    room.nextAutoFillAt = null;
    room.setupCampaign(event);
    this.rooms.set(id, room);
    return room;
  }

  createCustom({ name, maxPlayers, durationMs, password, aiCount, aiLevel, minPlayersToStart } = {}) {
    const id = nanoid();
    const room = new Room({ id, name: name || `Custom ${id}`, maxPlayers: Math.min(MAX_PLAYERS_DEFAULT, maxPlayers || MAX_PLAYERS_DEFAULT) }, this.stats);
    room.isCustom = true;
    room.password = password ? String(password) : null;
    room.autoFillBotsAdded = true;
    room.nextAutoFillAt = null;
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
      const humans = room.humanCount || 0;
      if (humans > 0) {
        room.emptySince = null;
      } else if (!room.emptySince) {
        room.emptySince = now;
      }
      const idleFor = room.emptySince ? (now - room.emptySince) : 0;
      const finishedFor = room.finishedAt ? (now - room.finishedAt) : 0;
      const waitingEmptyTooLong = room.state === 'waiting' && humans === 0 && idleFor >= EMPTY_ROOM_GRACE_MS;
      const finishedEmptyTooLong = room.state === 'finished' && humans === 0 && finishedFor >= EMPTY_ROOM_GRACE_MS;
      if (waitingEmptyTooLong || finishedEmptyTooLong) {
        // remove empty rooms after a grace period so clients can join
        toDelete.push(room.id);
      }
    }
    for (const id of toDelete) this.rooms.delete(id);
    return updates;
  }

  totalHumans() {
    let count = 0;
    for (const room of this.rooms.values()) {
      count += room.humanCount || 0;
    }
    return count;
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
    this.emptySince = Date.now();
    this.humanCount = 0;
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
    this.autoFillBotsAdded = false;
    this.autoFillBotStyleIndex = 0;
    this.nextAutoFillAt = this.waitingSince + AUTO_FILL_WAIT_MS;
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
    const bestLap = (!p.isBot && this.stats) ? this.stats.getBestLap(p.name) : null;
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      accent: p.accent,
      shape: p.shape,
      bestLapMs: bestLap,
      skill: p.skill || (p.isBot ? (p.profile && p.profile.style) : 'human'),
    };
  }

  addPlayer(socket, { name, color, accent, shape, password }) {
    if (this.password && String(password || '') !== String(this.password)) {
      throw new Error('Invalid password');
    }
    if (this.isCampaign) {
      // Single human only in campaign; bots don't count
      if (this.humanCount >= 1) throw new Error('Room is full');
    } else {
      if (this.players.size >= this.maxPlayers) {
        throw new Error('Room is full');
      }
    }
    if (this.state === 'running') {
      throw new Error('Race in progress — room is locked');
    }
    const spawn = this.spawnPoint();
    const safeName = sanitizePlayerName(name);
    const chosenShape = sanitizeShape(shape);
    this.players.set(socket.id, {
      id: socket.id,
      name: safeName,
      color,
      accent: accent || '#ffffff',
      shape: chosenShape,
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
      skill: 'human',
    });
    this.humanCount += 1;
    if (!this.isCampaign && !this.isCustom && this.humanCount === 1 && this.players.size < this.minPlayersToStart) {
      this.nextAutoFillAt = Date.now() + AUTO_FILL_WAIT_MS;
      this.autoFillBotsAdded = false;
    }
    this.emptySince = null;
    if (this.stats) this.stats.ensure(safeName);
    // If enough players joined and we're waiting, start countdown
    const humanCount = this.humanCount;
    if (!this.isCampaign && this.state === 'waiting') {
      const totalDrivers = this.players.size;
      const minDrivers = Math.min(this.minPlayersToStart, this.maxPlayers);
      const hasEnoughHumans = humanCount >= this.minPlayersToStart;
      const hasRosterWithBots = humanCount > 0 && totalDrivers >= minDrivers;
      if (hasEnoughHumans || hasRosterWithBots) {
        this.state = 'countdown';
        this.countdownEndAt = Date.now() + COUNTDOWN_MS;
        this.nextAutoFillAt = null;
        this.autoFillBotsAdded = true;
      }
    }
    if (this.isCampaign && this.state === 'waiting') {
      this.state = 'countdown';
      this.countdownEndAt = Date.now() + 3000;
    }
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (!player) return;
    this.players.delete(socketId);
    if (!player.isBot && this.humanCount > 0) this.humanCount -= 1;
    if (this.humanCount === 0) this.emptySince = Date.now();
  }

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
    for (const botSpec of ev.bots) {
      const profile = createBotProfile(botSpec && botSpec.style ? botSpec.style : 'pro');
      const id = `bot-${nanoid()}`;
      const offsetFromCenter = -w2 + margin + step * idx; // radial offset relative to centerline
      const r = rc + offsetFromCenter;
      const x = Math.cos(theta) * r;
      const y = Math.sin(theta) * r;
      const color = `hsl(${(idx * 47) % 360} 75% 50%)`;
      const botName = nextBotName();
      const botShape = SHAPE_LIST[idx % SHAPE_LIST.length];
      this.players.set(id, {
        id,
        name: botName,
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
        profile,
        shape: botShape,
        skill: profile.style,
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
    const levelKey = String(level || 'medium').toLowerCase();
    const stylePalette = {
      easy: ['rookie', 'rookie', 'pro'],
      medium: ['rookie', 'pro', 'pro'],
      hard: ['pro', 'legend', 'pro'],
      veryhard: ['legend', 'legend', 'pro'],
      legend: ['legend', 'legend', 'legend'],
    };
    const styles = stylePalette[levelKey] || stylePalette.medium;
    for (let i = 0; i < n; i++) {
      const id = `bot-${nanoid()}`;
      const off = -w2 + margin + step * i;
      const r = rc + off;
      const x = Math.cos(theta) * r;
      const y = Math.sin(theta) * r;
      const color = `hsl(${(i * 47) % 360} 75% 50%)`;
      const shape = SHAPE_LIST[i % SHAPE_LIST.length];
      const botName = nextBotName();
      const style = styles[Math.floor(Math.random() * styles.length)];
      const profile = createBotProfile(style);
      this.players.set(id, {
        id,
        name: botName,
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
        profile,
        shape,
        skill: profile.style,
      });
    }
    // raise capacity to include one human
    this.maxPlayers = Math.max(this.maxPlayers, this.players.size + 1);
  }

  // Inject a mixed difficulty roster of AI drivers when a room lacks humans.
  addAutoFillBots(count) {
    const n = Math.max(0, count | 0);
    if (n <= 0) return [];
    const theta = (this.track && typeof this.track.startTheta === 'number') ? this.track.startTheta : 0;
    const rc = rAt(theta, this.track);
    const w2 = this.track.width / 2;
    const margin = Math.max(CAR_RADIUS + 4, w2 * 0.12);
    const span = (w2 - margin) - (-w2 + margin);
    const step = n > 1 ? span / (n - 1) : 0;
    const baseIndex = this.players.size;
    const added = [];
    for (let i = 0; i < n; i += 1) {
      const styleIndex = (this.autoFillBotStyleIndex + i) % AUTO_FILL_BOT_STYLES.length;
      const style = AUTO_FILL_BOT_STYLES[styleIndex];
      const profile = createBotProfile(style);
      const id = `bot-${nanoid()}`;
      const off = -w2 + margin + step * i;
      const r = rc + off;
      const x = Math.cos(theta) * r;
      const y = Math.sin(theta) * r;
      const color = `hsl(${((baseIndex + i) * 47) % 360} 75% 50%)`;
      const shape = SHAPE_LIST[(baseIndex + i) % SHAPE_LIST.length];
      const botName = nextBotName();
      this.players.set(id, {
        id,
        name: botName,
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
        profile,
        shape,
        skill: profile.style,
      });
      added.push(id);
    }
    this.autoFillBotStyleIndex = (this.autoFillBotStyleIndex + n) % AUTO_FILL_BOT_STYLES.length;
    return added;
  }

  surfaceModifiers(theta, laneFrac) {
    const track = this.track;
    const features = track && Array.isArray(track.features) ? track.features : null;
    if (!features || features.length === 0) return null;
    const TAU = Math.PI * 2;
    const mods = {
      throttleMul: 1,
      throttleAdd: 0,
      dragMul: 1,
      brakeMul: 1,
      gripMul: 1,
      steerMul: 1,
      speedCapMul: 1,
      speedCapAdd: 0,
      forwardAccel: 0,
      slipThresholdMul: 1,
      slipThresholdAdd: 0,
      lateralAccel: 0,
    };
    let hit = 0;
    for (const f of features) {
      if (!f) continue;
      const diff = ((theta - f.start) % TAU + TAU) % TAU;
      if (diff > (f.length || 0)) continue;
      const laneMin = typeof f.laneMin === 'number' ? f.laneMin - 0.02 : -1.02;
      const laneMax = typeof f.laneMax === 'number' ? f.laneMax + 0.02 : 1.02;
      if (laneFrac < laneMin || laneFrac > laneMax) continue;
      hit += 1;
      const strength = typeof f.strength === 'number' ? f.strength : 1;
      switch (f.type) {
        case 'boost':
          mods.throttleMul *= 1 + 0.35 * strength;
          mods.dragMul *= Math.max(0.25, 1 - 0.28 * strength);
          mods.speedCapAdd += 45 * strength;
          mods.forwardAccel += 1500 * strength;
          mods.gripMul *= 1.05;
          break;
        case 'puddle':
          mods.throttleMul *= 0.4;
          mods.dragMul *= 1.6 + 0.5 * strength;
          mods.brakeMul *= 0.75;
          mods.gripMul *= 0.85;
          mods.slipThresholdMul *= 0.85;
          break;
        case 'dirt':
          mods.throttleMul *= 0.85;
          mods.dragMul *= 1.1;
          mods.gripMul *= 0.6;
          mods.steerMul *= 0.8;
          mods.slipThresholdMul *= 0.75;
          break;
        case 'ice':
          mods.throttleMul *= 0.55;
          mods.dragMul *= Math.max(0.6, 0.9 + (0.08 * (1 - strength)));
          mods.gripMul *= 0.35;
          mods.steerMul *= 0.4;
          mods.brakeMul *= 0.5;
          mods.slipThresholdMul *= 0.6;
          mods.speedCapMul *= 0.9;
          break;
        case 'tar':
          mods.throttleMul *= 0.55;
          mods.dragMul *= 2.1;
          mods.brakeMul *= 1.35;
          mods.gripMul *= 1.2;
          mods.speedCapMul *= 0.65;
          mods.speedCapAdd -= 40 * strength;
          break;
        case 'wind':
          mods.lateralAccel += (f.direction === -1 ? -1 : 1) * (360 * strength);
          mods.steerMul *= 0.95;
          mods.dragMul *= 1.0;
          break;
        default:
          break;
      }
    }
    if (!hit) return null;
    mods.dragMul = clamp(mods.dragMul, 0.2, 4);
    mods.throttleMul = clamp(mods.throttleMul, 0, 3);
    mods.gripMul = clamp(mods.gripMul, 0.05, 2.5);
    mods.steerMul = clamp(mods.steerMul, 0.1, 2.5);
    mods.brakeMul = clamp(mods.brakeMul, 0.1, 2.5);
    mods.speedCapMul = clamp(mods.speedCapMul, 0.2, 2.5);
    mods.slipThresholdMul = clamp(mods.slipThresholdMul, 0.2, 2.5);
    return mods;
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
    const look = clamp(lookBase + 0.00135 * speed, 0.12, 0.55);

    // Track geometry ahead
    const pol = worldToTrackPolar(p.x, p.y);
    const ahead = pol.theta + look;
    const rCenter = rAt(ahead, this.track);
    const kappa = curvatureAt(ahead, this.track);
    const kappa2 = curvatureAt(ahead + 0.03, this.track);
    const kappa3 = curvatureAt(ahead + 0.06, this.track);
    const curveF = clamp(kappa * 600, 0, 1);
    const rcNow = rAt(pol.theta, this.track);
    const laneOffsetNow = pol.r - rcNow;
    const laneFrac = clamp(w2 ? (laneOffsetNow / w2) : 0, -1, 1);
    const edgeSeverity = Math.max(0, Math.abs(laneFrac) - 0.72);

    // Desired lane offset: lane bias ± apex cut on curves + jitter
    const laneBias = prof.laneBias || 0;   // -1..1 across width
    const apexBias = prof.apexBias || 0.6; // 0..1
    const jitA = prof.jitterAmp || 0.05;
    const jitF = prof.jitterFreq || 0.8;
    const jitterScale = clamp(1 - Math.min(speed / (SOFT_SPEED_CAP * 1.25), 1), 0.15, 1);
    const jitter = Math.sin(p.aiT * (2 * Math.PI * jitF) + p.aiPhase) * (jitA * w2 * jitterScale);
    let offset = (laneBias * (w2 * 0.7)) - (apexBias * curveF * (w2 * 0.6)) + jitter;

    if (Math.abs(laneFrac) > 0.35) {
      const correction = (Math.abs(laneFrac) - 0.35) * 0.6;
      offset -= Math.sign(laneFrac) * correction * w2;
    }

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
    if (nearestAhead && bestDist2 < 240 * 240) {
      const qPol = worldToTrackPolar(nearestAhead.x, nearestAhead.y);
      // If target car is inside, we bias outside (and vice versa)
      const isInside = qPol.r < rCenter;
      const sideBias = (isInside ? +1 : -1) * (0.4 * w2);
      offset += sideBias;
      // extra brake when very close
      if (bestDist2 < 110 * 110) { p.brake = Math.max(p.brake, 0.6); p.throttle = 0; }
    }

    // Clamp offset inside track width margins
    const margin = Math.max(CAR_RADIUS + 4, w2 * 0.1);
    const curveAhead = Math.max(kappa, kappa2 * 1.1, kappa3 * 1.2);
    const tightness = clamp(curveAhead * this.track.width * 120, 0, 1);
    offset *= clamp(1 - tightness * 0.55, 0.3, 1);

    offset = clamp(offset, -w2 + margin, +w2 - margin);

    const desiredLane = clamp(offset / w2, -0.92, 0.92);
    const laneResponse = clamp(dt * 5.5, 0, 1);
    p.aiLane = (p.aiLane == null) ? desiredLane : clamp(p.aiLane + (desiredLane - p.aiLane) * laneResponse, -1, 1);
    offset = p.aiLane * w2;

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
    const upcomingKappa = Math.max(kappa, kappa2 * 1.05, kappa3 * 1.1);
    let vCorner = Math.sqrt(aLat / Math.max(upcomingKappa, 1e-6)) * bravery;
    const kGrow = Math.max(kappa2 - kappa, kappa3 - kappa2); // tightening
    if (kGrow > 0) vCorner *= clamp(1 - kGrow * 140, 0.55, 1); // pre-brake on tightening
    if (curveF > 0.45) vCorner *= clamp(1 - curveF * 0.3, 0.55, 1);
    const lanePenalty = 1 - Math.min(Math.abs(laneFrac) * 0.55, 0.45);
    vCorner *= lanePenalty;
    const topSpeedLimit = p.isBot ? BOT_MAX_SPEED : MAX_SPEED;
    const vMax = Math.min(topSpeedLimit, Math.max(SOFT_SPEED_CAP + 52, prof.maxSpeed || topSpeedLimit));
    let target = Math.min(vCorner, vMax);
    if (nearestAhead && bestDist2 < 320 * 320) {
      const draftBoost = clamp(1 - (bestDist2 / (320 * 320)), 0, 0.12);
      target = Math.min(target * (1 + draftBoost), vMax);
    }
    if (Math.abs(p.aiLane || 0) > 0.7) {
      const penalty = clamp(1 - (Math.abs(p.aiLane) - 0.7) * 1.8, 0.45, 1);
      target *= penalty;
    }
    const over = speed - target;
    const margin2 = 1.6 + (prof.brakeAgg || 0.8) * 2.0;
    // Slip-aware throttle
    const sx = -Math.sin(p.angle), sy = Math.cos(p.angle);
    const vSide = p.vx * sx + p.vy * sy;
    const vFwd = p.vx * Math.cos(p.angle) + p.vy * Math.sin(p.angle);
    const slip = Math.abs(vSide) / (Math.abs(vFwd) + 1);
    const slipBrakeThreshold = prof.slipBrakeThreshold ?? 0.68;
    const panicSlipThreshold = prof.panicSlipThreshold ?? Math.min(0.96, slipBrakeThreshold + 0.18);
    const throttleAgg = prof.throttleAgg ?? 1;
    const throttleFloor = prof.throttleFloor ?? 0;

    let throttleCmd = 0;
    let brakeCmd = 0;
    if (edgeSeverity > 0.22 && speed > 44) brakeCmd = 0.45;
    else if (over > margin2) brakeCmd = Math.min(1, over / (margin2 * 2.8));
    else if (slip > slipBrakeThreshold) brakeCmd = 0.35;

    if (!brakeCmd) {
      const speedGap = target - speed;
      if (speedGap > -1) {
        const desired = clamp((speedGap + 14) / 5.4, 0, 1) * throttleAgg;
        throttleCmd = Math.max(throttleCmd, desired);
      }
    }
    if (slip > slipBrakeThreshold) {
      const cap = prof.style === 'legend' ? 0.92 : prof.style === 'pro' ? 0.75 : 0.55;
      throttleCmd = Math.min(throttleCmd, cap);
    }
    if (edgeSeverity > 0.1) {
      const base = prof.style === 'legend' ? 0.88 : prof.style === 'pro' ? 0.65 : 0.45;
      const damp = base - edgeSeverity * (prof.style === 'legend' ? 0.18 : 0.3);
      throttleCmd = Math.min(throttleCmd, Math.max(0.05, damp));
    }
    if (slip > panicSlipThreshold) { brakeCmd = 1; throttleCmd = 0; }

    if (prof.style === 'legend') {
      if (brakeCmd && over < margin2 * 2 && slip < panicSlipThreshold) {
        brakeCmd *= 0.2;
      }
      throttleCmd = Math.max(throttleCmd, throttleFloor, 0.9);
    } else if (prof.style === 'pro' && brakeCmd) {
      brakeCmd *= 0.5;
    }

    throttleCmd = clamp(throttleCmd, 0, 1);
    throttleCmd = Math.max(throttleCmd, throttleFloor);
    brakeCmd = clamp(brakeCmd, 0, 1);

    p.throttle = throttleCmd;
    p.brake = brakeCmd;
    // Feed smoothed throttle pipeline
    p.targetThrottle = throttleCmd;
  }

  tick(dt, now) {
    // Handle state transitions
    if (this.state === 'countdown' && now >= this.countdownEndAt) {
      // Start the race
      this.state = 'running';
      this.raceEndAt = now + (this.raceDurationMs || RACE_DURATION_MS);
      this.waitingSince = null;
      // Record participants for stats (humans only)
      const humans = [];
      for (const p of this.players.values()) {
        if (!p.isBot) humans.push(p.name);
      }
      this.participants = new Set(humans);
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
      const results = [];
      for (const p of this.players.values()) {
        results.push({ id: p.id, name: p.name, laps: p.laps, bestLapMs: p.bestLapMs || 0, _progress: p.progress || 0 });
      }
      if (results.length > 1) {
        results.sort((a, b) => (b._progress || 0) - (a._progress || 0));
      }
      for (const r of results) delete r._progress;
      this.results = results;
      return;
    }
    if (this.state === 'finished' && this.finishedAt && now >= this.finishedAt + 10000) {
      // Reset to waiting with new track
      this.state = 'waiting';
      this.track = createTrack();
      this.countdownEndAt = null;
      this.raceEndAt = 0;
      this.waitingSince = now;
      this.emptySince = now;
      this.finishedAt = null;
      this.results = null;
      if (!this.isCampaign && !this.isCustom) {
        this.autoFillBotsAdded = false;
        this.nextAutoFillAt = this.waitingSince + AUTO_FILL_WAIT_MS;
      } else {
        this.autoFillBotsAdded = true;
        this.nextAutoFillAt = null;
      }
      for (const p of this.players.values()) {
        const spawn = this.spawnPoint();
        p.x = spawn.x; p.y = spawn.y; p.angle = spawn.angle;
        p.vx = 0; p.vy = 0; p.steerState = 0;
        p.lastTheta = spawn.theta; p.laps = 0; p.progress = 0;
      }
    }

    // Auto-start after timeout with whoever is present
    if (this.state === 'waiting') {
      const humans = this.humanCount;
      if (!this.isCampaign && !this.isCustom) {
        if (this.nextAutoFillAt == null && this.waitingSince) {
          this.nextAutoFillAt = this.waitingSince + AUTO_FILL_WAIT_MS;
        }
        const minDrivers = Math.min(this.minPlayersToStart, this.maxPlayers);
        const totalDrivers = this.players.size;
        if (humans > 0 && totalDrivers >= minDrivers) {
          this.autoFillBotsAdded = true;
        } else if (humans > 0 && !this.autoFillBotsAdded && this.nextAutoFillAt && now >= this.nextAutoFillAt) {
          const missing = Math.max(0, Math.min(minDrivers - totalDrivers, this.maxPlayers - totalDrivers));
          if (missing > 0) {
            const added = this.addAutoFillBots(missing);
            if (added.length > 0) {
              this.autoFillBotsAdded = true;
              this.state = 'countdown';
              this.countdownEndAt = now + COUNTDOWN_MS;
              this.waitingSince = null;
              this.nextAutoFillAt = null;
              this.addChatMessage({ name: 'Server', color: '#888', text: `Added ${added.length} AI drivers to start the race.`, system: true });
            } else {
              this.autoFillBotsAdded = true;
            }
          } else {
            this.autoFillBotsAdded = true;
          }
        }
      }
      if (humans >= 1 && this.waitingSince && (now - this.waitingSince) >= AUTO_START_WAIT_MS) {
        this.state = 'countdown';
        this.countdownEndAt = now + COUNTDOWN_MS;
        this.waitingSince = null;
        this.nextAutoFillAt = null;
        this.autoFillBotsAdded = true;
      }
    }

    // Allow practice driving during waiting state, but freeze during countdown/finished phases
    const allowSim = this.state === 'running' || (this.state === 'waiting' && !this.isCampaign);

    for (const p of this.players.values()) {
      if (!allowSim) {
        // Keep players stationary during countdown or post-race states
        p.vx = 0; p.vy = 0; // don't change angle either
        continue;
      }

      const w2 = this.track.width / 2;
      let pol = worldToTrackPolar(p.x, p.y);
      const rc = rAt(pol.theta, this.track);
      const laneOffsetNow = pol.r - rc;
      const laneFrac = w2 ? clamp(laneOffsetNow / w2, -1, 1) : 0;
      const surface = this.surfaceModifiers(pol.theta, laneFrac);

      // Local vectors
      const fx = Math.cos(p.angle);
      const fy = Math.sin(p.angle);
      const sx = -fy, sy = fx;

      // AI update for bots (sets p.steer/throttle/brake before physics)
      if (p.isBot) {
        this.updateBot(p, dt);
      }

      // Speed and steering smoothing
      let speed = Math.hypot(p.vx, p.vy);
      const steerTarget = clamp(p.steer || 0, -1, 1);
      const lerpAmt = clamp(STEER_RESP * dt, 0, 1);
      p.steerState = p.steerState + (steerTarget - p.steerState) * lerpAmt;
      // Throttle smoothing
      const thrAmt = clamp(THROTTLE_RESP * dt, 0, 1);
      p.throttleState = p.throttleState + ((p.targetThrottle||0) - p.throttleState) * thrAmt;

      // Speed-aware steering: more stable at high speed
      const steerMul = surface ? (surface.steerMul || 1) : 1;
      const damp = 1 / (1 + Math.pow(speed / VREF, 1.2)); // 0..1
      const turnRate = MAX_TURN_RATE * damp * steerMul;
      p.angle += p.steerState * turnRate * dt;

      // Acceleration / braking
      let ax = 0, ay = 0;
      let throttleEff = p.throttleState;
      if (surface) {
        const mul = surface.throttleMul != null ? surface.throttleMul : 1;
        const add = surface.throttleAdd || 0;
        throttleEff = throttleEff * mul + add;
      }
      throttleEff = clamp(throttleEff, 0, 1.4);

      let speedCap = p.isBot ? BOT_MAX_SPEED : MAX_SPEED;
      if (surface) {
        const mul = surface.speedCapMul != null ? surface.speedCapMul : 1;
        const add = surface.speedCapAdd || 0;
        speedCap = speedCap * mul + add;
      }
      speedCap = clamp(speedCap, 60, BOT_MAX_SPEED + 100);
      const extendedRange = Math.max(0, speedCap - SOFT_SPEED_CAP);

      if (throttleEff > 0 && speed > SOFT_SPEED_CAP && extendedRange > 0) {
        const over = Math.min(speed - SOFT_SPEED_CAP, extendedRange);
        const ratio = over / extendedRange;
        const falloff = Math.max(0.05, 1 - ratio * EXTENDED_SPEED_ACCEL_FALLOFF);
        throttleEff *= falloff;
      }
      if (throttleEff > 0) {
        ax += fx * ACCEL * throttleEff;
        ay += fy * ACCEL * throttleEff;
      }

      const brakeMul = surface ? (surface.brakeMul || 1) : 1;
      const brakeStrength = clamp((p.brake || 0) * brakeMul, 0, 1);
      if (brakeStrength > 0) {
        // project velocity onto forward and apply braking or reverse accel
        const vdotf = p.vx * fx + p.vy * fy;
        if (vdotf > 40) {
          // Still moving forward: brake
          ax += -fx * BRAKE * brakeStrength;
          ay += -fy * BRAKE * brakeStrength;
        } else {
          // Near stop or moving backward: reverse throttle
          ax += -fx * REV_ACCEL * brakeStrength;
          ay += -fy * REV_ACCEL * brakeStrength;
        }
      }

      if (surface) {
        if (surface.forwardAccel) {
          ax += fx * surface.forwardAccel;
          ay += fy * surface.forwardAccel;
        }
        if (surface.lateralAccel) {
          ax += sx * surface.lateralAccel;
          ay += sy * surface.lateralAccel;
        }
      }

      p.vx += ax * dt;
      p.vy += ay * dt;

      // Base drag
      let dragPow = Math.pow(DRAG, dt / (1 / 60));
      if (surface) {
        dragPow = Math.pow(dragPow, surface.dragMul || 1);
      }
      p.vx *= dragPow;
      p.vy *= dragPow;

      speed = Math.hypot(p.vx, p.vy);
      if (speed > SOFT_SPEED_CAP && extendedRange > 0) {
        const over = Math.min(speed - SOFT_SPEED_CAP, extendedRange);
        const ratio = over / extendedRange;
        let extraDrag = Math.exp(-Math.max(0, ratio) * ratio * 4 * dt);
        if (surface) {
          extraDrag = Math.pow(extraDrag, surface.dragMul || 1);
        }
        p.vx *= extraDrag;
        p.vy *= extraDrag;
        speed = Math.hypot(p.vx, p.vy);
      }

      // Lateral grip: damp sideways velocity, less at high speed
      const vSide = p.vx * sx + p.vy * sy;
      const vFwd = p.vx * fx + p.vy * fy;
      let grip = GRIP_LOW_SPEED + (GRIP_HIGH_SPEED - GRIP_LOW_SPEED) * clamp(speed / 900, 0, 1);
      const gripMul = surface ? (surface.gripMul || 1) : 1;
      grip *= gripMul;
      const sideAfter = vSide * Math.exp(-Math.max(0, grip) * dt);
      // Recompose
      p.vx = fx * vFwd + sx * sideAfter;
      p.vy = fy * vFwd + sy * sideAfter;

      // Curvature-based corner speed handling
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
      aLatMax *= clamp(gripMul, 0.15, 2.5);
      const vmaxCorner = Math.sqrt(aLatMax / Math.max(kappa, 1e-6));
      if (speed > vmaxCorner) {
        // Extra drag when exceeding corner speed; also reduce steering authority (understeer)
        const excess = clamp((speed - vmaxCorner) / Math.max(vmaxCorner, 1), 0, 3);
        let extraDrag = Math.exp(-excess * 3.0 * dt);
        if (surface) {
          extraDrag = Math.pow(extraDrag, surface.dragMul || 1);
        }
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
        let slipLimit = SLIDE_THRESHOLD;
        if (surface) {
          slipLimit = slipLimit * (surface.slipThresholdMul || 1) + (surface.slipThresholdAdd || 0);
        }
        slipLimit = clamp(slipLimit, 0.2, 0.95);
        const cap = speedCap * SLIDE_CAP_FACTOR;
        const spd = Math.hypot(p.vx, p.vy);
        if (slip > slipLimit && spd > cap) {
          const s = cap / (spd || 1);
          p.vx *= s; p.vy *= s;
        }
      }

      // Speed cap (forward magnitude) and reverse cap along forward axis
      const newSpeed = Math.hypot(p.vx, p.vy);
      if (newSpeed > speedCap) {
        const s = speedCap / newSpeed;
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
      const rcBoundary = rAt(pol2.theta, this.track);
      const minR = rcBoundary - w2 + CAR_RADIUS;
      const maxR = rcBoundary + w2 - CAR_RADIUS;
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
        const wallCapBase = Math.min(speedCap, p.isBot ? BOT_MAX_SPEED : SOFT_SPEED_CAP);
        const capAlongWall = Math.min(WALL_SLIDE_MAX, wallCapBase * 0.5);
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

      // Refresh polar coordinates after potential wall resolution
      pol = worldToTrackPolar(p.x, p.y);

      if (this.state === 'running') {
        // Progress and laps tracking while the race is active
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
          if (this.stats && !this.isCampaign && !p.isBot) {
            this.stats.addLap(p.name, 1);
          }
          if (this.stats && !p.isBot && p.bestLapMs != null) {
            this.stats.updateBestLap(p.name, p.bestLapMs);
          }
        }
        // Do not allow negative lap exploit; still track reverse crossing but keep >= 0
        if (lastRel < TAU * 0.25 && rel > TAU * 0.75 && !forward) p.laps = Math.max(0, p.laps - 1);
        p.lastTheta = theta;
        p.progress = p.laps * TAU + theta;
      } else if (this.state === 'waiting') {
        // Practice laps should not accumulate race stats
        p.laps = 0;
        p.progress = 0;
        p.lastLapMs = 0;
        p.bestLapMs = null;
        p.lapArmed = false;
        p.lastTheta = pol.theta;
      }
    }
  }

  snapshot(now) {
    const players = [];
    for (const p of this.players.values()) {
      const speed = (p.vx || p.vy) ? Math.round(Math.hypot(p.vx || 0, p.vy || 0)) : 0;
      const carShape = sanitizeShape(p.shape);
      const progress = p.progress || 0;
      players.push({
        id: p.id,
        name: p.name,
        color: p.color,
        accent: p.accent,
        shape: carShape,
        x: p.x,
        y: p.y,
        angle: p.angle,
        laps: p.laps || 0,
        speed,
        lastLapMs: p.lastLapMs || 0,
        bestLapMs: p.bestLapMs,
        resets: p.resets || 0,
        throttle: !!p.throttle,
        brake: !!p.brake,
        progress,
        isBot: !!p.isBot,
        skill: p.skill || (p.isBot ? (p.profile && p.profile.style) : 'human'),
      });
    }
    if (players.length > 1) {
      players.sort((a, b) => (b.progress || 0) - (a.progress || 0));
    }
    const leaderboard = players.map(p => ({ id: p.id, name: p.name }));
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
      leaderboard,
    };
  }
}

module.exports = Rooms;
