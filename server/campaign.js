function makeEvents() {
  const mixes = [
    { rookie: 0.75, pro: 0.25, legend: 0.0, name: 'Rookie Rush' },
    { rookie: 0.6, pro: 0.35, legend: 0.05, name: 'Amateur Circuit' },
    { rookie: 0.45, pro: 0.45, legend: 0.10, name: 'Club Series' },
    { rookie: 0.35, pro: 0.5, legend: 0.15, name: 'Regional Showdown' },
    { rookie: 0.25, pro: 0.55, legend: 0.2, name: 'Semi-Pro Clash' },
    { rookie: 0.18, pro: 0.57, legend: 0.25, name: 'National Cup' },
    { rookie: 0.12, pro: 0.58, legend: 0.30, name: 'Contender Series' },
    { rookie: 0.08, pro: 0.55, legend: 0.37, name: 'Elite Sprint' },
    { rookie: 0.04, pro: 0.48, legend: 0.48, name: 'Pro Championship' },
    { rookie: 0.0, pro: 0.35, legend: 0.65, name: 'Legend Finals' },
  ];

  const pickStyle = (weights) => {
    const entries = Object.entries(weights);
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let r = Math.random() * total;
    for (const [style, weight] of entries) {
      r -= weight;
      if (r <= 0) return style;
    }
    return entries[entries.length - 1][0];
  };

  const events = [];
  for (let i = 0; i < mixes.length; i++) {
    const mix = mixes[i];
    const bots = 7 + Math.floor((i + 1) * 0.9); // 8..15 bots
    const arr = [];
    for (let b = 0; b < bots; b++) {
      arr.push({ style: pickStyle(mix) });
    }
    events.push({ id: i + 1, name: mix.name, bots: arr });
  }
  return events;
}

module.exports = { makeEvents };
