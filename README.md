Racers.io — Minimal Multiplayer Racing

Overview

- Multiplayer top‑down racing with minimal visuals.
- Randomly generated track per race; 5‑minute race timer.
- Up to 30 racers per room.
- Built‑in server browser and car customization (name + color).
- Simple but satisfying physics (accel, braking, drift, wall bounce).

Getting Started

- Install dependencies: `npm install`
- Start the server: `npm start`
- Open: `http://localhost:3000`

Controls

- Throttle: `W` or `↑`
- Brake: `S` or `↓`
- Steer: `A/D` or `←/→`

Features

- Server Browser: list active rooms, create new.
- Rooms: capped at 30 players; 5‑minute races auto‑restart with a new track.
- Procedural Track: smooth closed loop generated via seeded sine noise.
- Physics: server‑authoritative integration and collision with track boundaries.
- Rendering: clean canvas graphics inspired by agar.io.

Tech Stack

- Server: Node.js, Express, Socket.IO.
- Client: HTML5 Canvas, vanilla JS.

Notes

- This is a functional prototype designed for simplicity and clarity.
- Track geometry is shared via parameters so clients render exactly what the server simulates.
- For production, consider rate limiting, reconnection handling, and lag compensation.

