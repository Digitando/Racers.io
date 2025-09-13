const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const Rooms = require('./rooms');
const GlobalStats = require('./globalStats');
const { makeEvents } = require('./campaign');

let desiredPort = Number(process.env.PORT) || 3000;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// In-memory rooms manager + global stats
const stats = new GlobalStats();
const rooms = new Rooms(stats);

// API: list rooms
app.get('/api/rooms', (req, res) => {
  res.json(rooms.list());
});

// API: global leaderboard
app.get('/api/leaderboard', (req, res) => {
  res.json(stats.listTop(50));
});

// API: create room
app.post('/api/rooms', (req, res) => {
  const { name, maxPlayers } = req.body || {};
  try {
    const room = rooms.create({ name: name || 'Race', maxPlayers });
    res.json({ id: room.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Campaign endpoints
app.get('/api/campaign/events', (req, res) => {
  const events = makeEvents().map(e => ({ id: e.id, name: e.name, bots: e.bots.length }));
  res.json(events);
});
app.post('/api/campaign/start', (req, res) => {
  const { event, name } = req.body || {};
  try {
    const room = rooms.createCampaign({ event: Number(event) || 1, name });
    res.json({ id: room.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

// Lobby namespace for server browser
const lobby = io.of('/lobby');
lobby.on('connection', (socket) => {
  // Send an immediate snapshot on connect
  socket.emit('rooms', rooms.list());
  socket.emit('leaderboard', stats.listTop(20));
});

io.on('connection', (socket) => {
  let joinedRoomId = null;
  let spectator = false;

  socket.on('join', (payload, ack) => {
    try {
      const { roomId, name, color, spectate, password } = payload || {};
      if (!roomId) throw new Error('roomId required');
      const room = rooms.get(roomId);
      if (!room) throw new Error('Room not found');
      spectator = !!spectate;
      if (!spectator) {
        // Validate and add player; may throw on bad password or capacity
        room.addPlayer(socket, { name: String(name || 'Racer'), color: String(color || '#2196F3'), password });
      }
      // Only join socket room after successful validation
      socket.join(roomId);
      joinedRoomId = roomId;
      if (typeof ack === 'function') {
        const you = spectator ? null : room.getPlayerPublic(socket.id);
        ack({ ok: true, room: room.publicInfo(), you, spectator, chat: room.chat.slice(-40) });
      }
    } catch (e) {
      if (typeof ack === 'function') ack({ ok: false, error: e.message });
    }
  });

  socket.on('input', (data) => {
    if (!joinedRoomId) return;
    const room = rooms.get(joinedRoomId);
    if (!room) return;
    room.updateInput(socket.id, data);
  });

  socket.on('reset', () => {
    if (!joinedRoomId) return;
    const room = rooms.get(joinedRoomId);
    if (!room) return;
    room.resetPlayer(socket.id);
  });

  socket.on('disconnect', () => {
    if (!joinedRoomId) return;
    const room = rooms.get(joinedRoomId);
    if (room) room.removePlayer(socket.id);
  });

  // Chat relay
  socket.on('chat', (text) => {
    if (!joinedRoomId) return;
    const room = rooms.get(joinedRoomId);
    if (!room) return;
    const you = spectator ? { name: 'Spectator', color: '#666' } : room.getPlayerPublic(socket.id);
    const name = you && you.name ? you.name : 'Player';
    const color = you && you.color ? you.color : '#444';
    const msg = room.addChatMessage({ name, color, text });
    io.to(joinedRoomId).emit('chat', msg);
  });

  // Custom restart (custom rooms only)
  socket.on('custom_restart', () => {
    if (!joinedRoomId) return;
    const room = rooms.get(joinedRoomId);
    if (!room || !room.isCustom) return;
    const p = room.players.get(socket.id);
    if (!p || p.isBot) return;
    // Reset and begin a short countdown
    room.state = 'waiting';
    room.track = require('./track').createTrack();
    room.countdownEndAt = Date.now() + 3000;
    room.raceEndAt = 0;
    room.finishedAt = null;
    for (const pl of room.players.values()) {
      const spawn = room.spawnPoint();
      pl.x = spawn.x; pl.y = spawn.y; pl.angle = spawn.angle;
      pl.vx = 0; pl.vy = 0; pl.steerState = 0; pl.brake = 0; pl.throttle = 0; pl.targetThrottle = 0; pl.throttleState = 0;
      pl.lastTheta = spawn.theta; pl.laps = 0; pl.progress = 0;
    }
  });

  // (Voting removed)
});

// Create custom room with options
app.post('/api/custom/create', (req, res) => {
  const { name, maxPlayers, durationMin, password, aiCount, aiLevel, minPlayers } = req.body || {};
  try {
    const room = rooms.createCustom({
      name,
      maxPlayers: Number(maxPlayers) || undefined,
      durationMs: (Number(durationMin) || 5) * 60 * 1000,
      password,
      aiCount: Number(aiCount) || 0,
      aiLevel: String(aiLevel || 'medium').toLowerCase(),
      minPlayersToStart: Number(minPlayers) || 2,
    });
    res.json({ id: room.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Game loop broadcasts
const TICK_HZ = Number(process.env.TICK_HZ) || 120;
setInterval(() => {
  const updates = rooms.tick();
  for (const upd of updates) {
    io.to(upd.roomId).emit('state', upd.state);
  }
}, 1000 / TICK_HZ); // network snapshots (default 120 Hz)

// Emit rooms list to lobby clients at 1 Hz
setInterval(() => {
  lobby.emit('rooms', rooms.list());
  lobby.emit('leaderboard', stats.listTop(20));
}, 1000);

// Graceful port binding with fallback
let attemptPort = desiredPort;
let attempts = 0;
const maxAttempts = 10;

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE' && attempts < maxAttempts) {
    const prev = attemptPort;
    attemptPort += 1;
    attempts += 1;
    console.warn(`Port ${prev} in use, trying ${attemptPort}...`);
    setTimeout(() => server.listen(attemptPort), 150);
    return;
  }
  console.error('Server failed to start:', err);
  process.exit(1);
});

server.listen(attemptPort, () => {
  const addr = server.address();
  const port = addr && typeof addr.port === 'number' ? addr.port : attemptPort;
  console.log(`Racers.io server listening on http://localhost:${port}`);
});
