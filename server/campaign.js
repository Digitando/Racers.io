function rand(min, max) { return min + Math.random() * (max - min); }

function makeEvents() {
  const events = [];
  for (let i = 1; i <= 10; i++) {
    const bots = 6 + Math.floor(i * 0.8); // 7..14 bots
    // Base difficulty scaling per event
    const baseALat = 140 + i * 40;        // lateral accel limit
    const baseMaxSpeed = Math.min(200, 120 + i * 10); // aim up to 200
    const baseSteer = 1.1 + i * 0.12;     // steering aggressiveness
    const baseLook = 0.11 + i * 0.012;    // lookahead along track (radians)
    const baseBrake = 0.68 + i * 0.035;   // braking aggressiveness
    const arr = [];
    for (let b = 0; b < bots; b++) {
      // Per-bot variation
      const speedScale = rand(0.88, 1.08);
      const steerGain = baseSteer * rand(0.9, 1.15);
      const look = baseLook * rand(0.85, 1.2);
      const aLat = baseALat * rand(0.85, 1.15);
      const maxSpeed = baseMaxSpeed * speedScale;
      const brakeAgg = baseBrake * rand(0.85, 1.15);
      const laneBias = rand(-0.6, 0.6);      // preferred lane across width
      const apexBias = rand(0.2, 0.9);       // how much to cut inside on curves
      const jitterAmp = rand(0.02, 0.12);    // lateral wandering fraction of half-width
      const jitterFreq = rand(0.3, 1.3);     // Hz-ish
      const reaction = rand(0.05, 0.18);     // seconds to react
      const bravery = rand(0.9, 1.15);       // >1 = carries more speed through corners
      arr.push({ aLat, maxSpeed, steerGain, look, brakeAgg, laneBias, apexBias, jitterAmp, jitterFreq, reaction, bravery });
    }
    events.push({ id: i, name: `Event ${i}`, bots: arr });
  }
  return events;
}

module.exports = { makeEvents };
