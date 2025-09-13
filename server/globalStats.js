const fs = require('fs');
const path = require('path');

class GlobalStats {
  constructor(opts = {}) {
    this.file = opts.file || path.join(__dirname, '..', 'data', 'stats.json');
    this.map = new Map(); // name -> { name, wins, laps, races }
    this._loaded = false;
    this._ensureDir();
    this._load();
  }

  _ensureDir() {
    try {
      const dir = path.dirname(this.file);
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) { /* ignore */ }
  }

  _load() {
    try {
      if (fs.existsSync(this.file)) {
        const raw = fs.readFileSync(this.file, 'utf8');
        const obj = JSON.parse(raw || '{}');
        for (const [k, v] of Object.entries(obj)) {
          this.map.set(k, { name: v.name || k, wins: v.wins|0, laps: v.laps|0, races: v.races|0 });
        }
      }
      this._loaded = true;
    } catch (e) {
      this._loaded = true;
    }
  }

  _save() {
    try {
      const obj = {};
      for (const [k, v] of this.map.entries()) obj[k] = v;
      fs.writeFileSync(this.file, JSON.stringify(obj));
    } catch (e) { /* ignore */ }
  }

  ensure(name) {
    const key = String(name || 'Racer');
    if (!this.map.has(key)) {
      this.map.set(key, { name: key, wins: 0, laps: 0, races: 0 });
      this._save();
    }
    return this.map.get(key);
  }

  addLap(name, n = 1) {
    const p = this.ensure(name);
    p.laps += n;
    this._save();
  }

  addRace(name, n = 1) {
    const p = this.ensure(name);
    p.races += n;
    this._save();
  }

  addWin(name, n = 1) {
    const p = this.ensure(name);
    p.wins += n;
    this._save();
  }

  listTop(limit = 20) {
    const arr = Array.from(this.map.values());
    arr.sort((a, b) => (
      b.wins - a.wins ||
      b.laps - a.laps ||
      b.races - a.races ||
      a.name.localeCompare(b.name)
    ));
    return arr.slice(0, limit);
  }

  all() { return Array.from(this.map.values()); }
}

module.exports = GlobalStats;

