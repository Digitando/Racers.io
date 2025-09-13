const seedrandom = require('seedrandom');

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

function angleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d < -Math.PI) d += Math.PI * 2; else if (d > Math.PI) d -= Math.PI * 2;
  return d;
}

function createCornerSegments(rng) {
  const segs = [];
  const count = 12 + Math.floor(rng() * 8); // 12..19 more variety
  for (let i = 0; i < count; i++) {
    const kindPick = rng();
    const baseCenter = rng() * Math.PI * 2;
    if (kindPick < 0.18) {
      // Hairpin: tight, strong radius change, single direction
      const halfWidth = (Math.PI / 18) + rng() * (Math.PI / 18); // ~10°..20°
      const intensity = 0.18 + rng() * 0.14; // strong
      const dir = rng() < 0.5 ? -1 : 1;
      segs.push({ kind: 'hairpin', center: baseCenter, halfWidth, intensity, dir });
    } else if (kindPick < 0.42) {
      // Chicane: two quick opposite kinks
      const gap = (Math.PI / 22) + rng() * (Math.PI / 18); // 8°..18° apart
      const halfWidth = (Math.PI / 28) + rng() * (Math.PI / 28); // ~6°..12°
      const intensity = 0.08 + rng() * 0.08;
      const dir = rng() < 0.5 ? -1 : 1;
      segs.push({ kind: 'chicane', center: baseCenter - gap / 2, halfWidth, intensity, dir });
      segs.push({ kind: 'chicane', center: baseCenter + gap / 2, halfWidth, intensity, dir: -dir });
    } else if (kindPick < 0.78) {
      // Sweeper: broad, gentle bend
      const halfWidth = (Math.PI / 8) + rng() * (Math.PI / 5); // ~22°..36°
      const intensity = 0.06 + rng() * 0.08;
      const dir = rng() < 0.5 ? -1 : 1;
      segs.push({ kind: 'sweeper', center: baseCenter, halfWidth, intensity, dir });
    } else {
      // Kink: very narrow, small but sharp
      const halfWidth = (Math.PI / 36) + rng() * (Math.PI / 40); // ~5°..8°
      const intensity = 0.05 + rng() * 0.07;
      const dir = rng() < 0.5 ? -1 : 1;
      segs.push({ kind: 'kink', center: baseCenter, halfWidth, intensity, dir });
    }
  }
  return segs;
}

function createTrack(seed) {
  const seedStr = seed || Math.random().toString(36).slice(2);
  const rng = seedrandom(seedStr);
  const baseRadius = 1200 + rng() * 600; // 1200..1800
  const width = 220 + rng() * 120; // 220..340
  const noiseCount = 3;
  const noises = [];
  for (let i = 0; i < noiseCount; i++) {
    const freq = Math.floor(2 + rng() * 7) + i * 2; // spread frequencies
    const amp = (0.05 + rng() * 0.10) * baseRadius / (i + 1.5); // slightly reduced
    const phase = rng() * Math.PI * 2;
    noises.push({ amp, freq, phase });
  }
  const segments = createCornerSegments(rng);
  // Elliptical warp to break circularity
  const ellipseE = 0.12 + rng() * 0.26; // 0.12..0.38
  const ellipsePhi = rng() * Math.PI * 2;
  const startTheta = 0; // start/finish at theta=0 to align with lap logic
  return { seed: seedStr, baseRadius, width, noises, segments, ellipseE, ellipsePhi, startTheta };
}

function segmentWindow(theta, seg) {
  const d = Math.abs(angleDiff(theta, seg.center));
  if (d > seg.halfWidth) return 0;
  const x = d / seg.halfWidth; // 0..1
  // Raised cosine window
  const w = 0.5 * (1 + Math.cos(Math.PI * x));
  // Shape per kind
  const gamma = seg.kind === 'hairpin' ? 2.2
    : seg.kind === 'chicane' ? 1.6
    : seg.kind === 'kink' ? 1.3
    : 1.0; // sweeper
  return Math.pow(w, gamma);
}

function rAt(theta, track) {
  const { baseRadius, noises, segments } = track;
  let r = baseRadius;
  for (const n of noises) r += n.amp * Math.sin(theta * n.freq + n.phase);
  if (segments) {
    for (const s of segments) {
      const w = segmentWindow(theta, s);
      if (w > 0) {
        const dir = s.dir || 1;
        r += dir * (s.intensity * baseRadius) * w;
      }
    }
  }
  // Elliptical warp factor (approximate ellipse via 2-theta harmonic)
  if (typeof track.ellipseE === 'number' && typeof track.ellipsePhi === 'number') {
    const f = 1 + track.ellipseE * Math.cos(2 * (theta - track.ellipsePhi));
    r *= f;
  }
  return r;
}

function posAt(theta, track) {
  const r = rAt(theta, track);
  return [Math.cos(theta) * r, Math.sin(theta) * r];
}

function curvatureAt(theta, track) {
  // Finite-difference curvature on the centerline curve
  const e = 0.0025; // small angle step
  const [x1, y1] = posAt(theta - e, track);
  const [x2, y2] = posAt(theta, track);
  const [x3, y3] = posAt(theta + e, track);
  const dx = (x3 - x1) / (2 * e);
  const dy = (y3 - y1) / (2 * e);
  const ddx = (x3 - 2 * x2 + x1) / (e * e);
  const ddy = (y3 - 2 * y2 + y1) / (e * e);
  const num = Math.abs(dx * ddy - dy * ddx);
  const den = Math.pow(dx * dx + dy * dy, 1.5) + 1e-9;
  return num / den; // curvature magnitude
}

function segmentAtTheta(theta, track) {
  if (!track.segments) return null;
  for (const s of track.segments) {
    const d = Math.abs(angleDiff(theta, s.center));
    if (d <= s.halfWidth) return s;
  }
  return null;
}

function sample(track, n = 256) {
  const inner = [];
  const outer = [];
  const w2 = track.width / 2;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const rc = rAt(t, track);
    const rin = rc - w2;
    const rout = rc + w2;
    const sin = Math.sin(t);
    const cos = Math.cos(t);
    inner.push([cos * rin, sin * rin]);
    outer.push([cos * rout, sin * rout]);
  }
  return { inner, outer };
}

function worldToTrackPolar(x, y) {
  const r = Math.hypot(x, y);
  let theta = Math.atan2(y, x);
  if (theta < 0) theta += Math.PI * 2;
  return { r, theta };
}

module.exports = {
  createTrack,
  rAt,
  sample,
  worldToTrackPolar,
  clamp,
  curvatureAt,
  segmentAtTheta,
  angleDiff,
};
