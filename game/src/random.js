// A small deterministic RNG (mulberry32): the same seed always builds the same city, places the
// same traffic and answers the same way in a ?shot= capture.
export function createRandom(seed) {
  let a = seed >>> 0;
  function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range(min, max) { return min + next() * (max - min); },
    int(min, max) { return Math.floor(this.range(min, max + 1)); },
    pick(list) { return list[Math.floor(next() * list.length) % list.length]; },
    bool(p = 0.5) { return next() < p; },
    // In-place Fisher–Yates, drawing exactly one int per step so a given seed always shuffles the
    // same way. Returns the same array for convenient chaining.
    shuffle(list) {
      for (let i = list.length - 1; i > 0; i--) {
        const j = this.int(0, i);
        [list[i], list[j]] = [list[j], list[i]];
      }
      return list;
    },
  };
}
