// Everything drawn on the #hud canvas: health and money top-left, the mission banner top-centre,
// wanted stars top-right, the minimap bottom-left (roads, Nico, the mission blip, police dots) and
// the weapon readout and control hints bottom-right. main.js builds one plain `state` object a
// frame and hands it to draw(); nothing here owns game state, it only reads it.
import { CITY, CITY_HALF, PLAYER, WANTED } from './config.js';

const MINIMAP = { size: 176, margin: 18, range: 95 };

export function createHud(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  function bar(x, y, w, h, frac, color, bg = 'rgba(10,12,16,0.55)') {
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  function drawStar(cx, cy, r, filled) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
      const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = filled ? '#f2c94c' : 'rgba(120,120,130,0.35)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawMinimap(state) {
    const { size, margin, range } = MINIMAP;
    const cx = margin + size / 2;
    const cy = window.innerHeight - margin - size / 2;
    const r = size / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(8,10,16,0.72)';
    ctx.fillRect(cx - r, cy - r, size, size);

    const px = state.px, pz = state.pz;
    const toMap = (x, z) => ({ mx: cx + ((x - px) / range) * r, my: cy + ((z - pz) / range) * r });

    ctx.strokeStyle = 'rgba(210,210,225,0.22)';
    ctx.lineWidth = 2;
    const blocks = CITY.blockSize;
    const kx0 = Math.floor((px - range + CITY_HALF) / blocks), kx1 = Math.ceil((px + range + CITY_HALF) / blocks);
    for (let k = kx0; k <= kx1; k++) {
      const x = -CITY_HALF + k * blocks;
      const a = toMap(x, pz - range), b = toMap(x, pz + range);
      ctx.beginPath(); ctx.moveTo(a.mx, a.my); ctx.lineTo(b.mx, b.my); ctx.stroke();
    }
    const kz0 = Math.floor((pz - range + CITY_HALF) / blocks), kz1 = Math.ceil((pz + range + CITY_HALF) / blocks);
    for (let k = kz0; k <= kz1; k++) {
      const z = -CITY_HALF + k * blocks;
      const a = toMap(px - range, z), b = toMap(px + range, z);
      ctx.beginPath(); ctx.moveTo(a.mx, a.my); ctx.lineTo(b.mx, b.my); ctx.stroke();
    }

    for (const dot of state.policeDots) {
      const m = toMap(dot.x, dot.z);
      ctx.fillStyle = '#ff3b3b';
      ctx.beginPath(); ctx.arc(m.mx, m.my, 4, 0, Math.PI * 2); ctx.fill();
    }

    if (state.blip) {
      const m = toMap(state.blip.x, state.blip.z);
      ctx.fillStyle = '#ffd24c';
      ctx.beginPath(); ctx.moveTo(m.mx, m.my - 7); ctx.lineTo(m.mx - 6, m.my + 5); ctx.lineTo(m.mx + 6, m.my + 5); ctx.closePath(); ctx.fill();
    }

    // Nico: a fixed arrow at the centre, rotated to his heading (north-up map, not player-up).
    ctx.translate(cx, cy);
    ctx.rotate(state.heading);
    ctx.fillStyle = '#5fd0ff';
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(-6, 7); ctx.lineTo(0, 3); ctx.lineTo(6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = state.stars > 0 ? '#ff5a3c' : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, cy, r - 1, 0, Math.PI * 2); ctx.stroke();

    ctx.fillStyle = 'rgba(230,236,244,0.85)';
    ctx.font = '600 11px Segoe UI, Arial';
    ctx.textAlign = 'left';
    ctx.fillText(state.district, margin, cy + r + 16);
  }

  function draw(state) {
    const w = window.innerWidth, h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    if (state.hitFlash > 0) {
      ctx.fillStyle = `rgba(200,20,20,${Math.min(0.45, state.hitFlash * 0.9)})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Health + money, top-left.
    ctx.textAlign = 'left';
    ctx.font = '700 12px Segoe UI, Arial';
    ctx.fillStyle = '#e6ecf4';
    ctx.fillText('HEALTH', 18, 20);
    bar(18, 24, 180, 14, state.health / PLAYER.maxHealth, state.health > 30 ? '#3fb66f' : '#d8453a');
    ctx.fillText(`$${Math.round(state.money).toLocaleString()}`, 18, 56);

    // Weapon / ammo, under health.
    ctx.font = '600 12px Segoe UI, Arial';
    ctx.fillStyle = '#cfd6e0';
    const weaponLabel = state.weapon === 'fists' ? 'Fists' : `${state.weaponName}  ${state.ammo}/${state.clip}`;
    ctx.fillText(weaponLabel, 18, 74);
    if (state.reloading) {
      ctx.fillStyle = '#f2c94c';
      ctx.fillText('reloading…', 150, 74);
    }

    // Wanted stars, top-right.
    const starsX = w - 18 - (WANTED.max - 1) * 22;
    for (let i = 0; i < WANTED.max; i++) drawStar(starsX + i * 22, 24, 10, i < state.stars);

    // Mission banner, top-centre.
    if (state.objective) {
      ctx.textAlign = 'center';
      ctx.font = '700 14px Segoe UI, Arial';
      const tw = ctx.measureText(state.objective).width;
      ctx.fillStyle = 'rgba(8,10,16,0.55)';
      ctx.fillRect(w / 2 - tw / 2 - 16, 10, tw + 32, 28);
      ctx.fillStyle = '#ffd98a';
      ctx.fillText(state.objective, w / 2, 29);
    }

    // Toast (mission complete, pickup, etc.), just under the banner.
    if (state.toast && state.toast.timer > 0) {
      ctx.textAlign = 'center';
      ctx.font = '600 13px Segoe UI, Arial';
      ctx.fillStyle = `rgba(255,255,255,${Math.min(1, state.toast.timer)})`;
      ctx.fillText(state.toast.text, w / 2, 56);
    }

    // Interaction prompt, bottom-centre.
    if (state.prompt) {
      ctx.textAlign = 'center';
      ctx.font = '600 13px Segoe UI, Arial';
      ctx.fillStyle = 'rgba(230,236,244,0.9)';
      ctx.fillText(state.prompt, w / 2, h - 118);
    }

    drawMinimap(state);

    // Control hints, bottom-right.
    ctx.textAlign = 'right';
    ctx.font = '600 11px Segoe UI, Arial';
    ctx.fillStyle = 'rgba(210,216,226,0.65)';
    const hints = state.driving
      ? ['W/S drive · A/D steer', 'Space handbrake', 'F/E exit']
      : ['WASD move · Shift run', 'F/E enter vehicle', 'LMB attack · R reload · 1/2 weapon'];
    hints.forEach((line, i) => ctx.fillText(line, w - 18, h - 18 - (hints.length - 1 - i) * 16));
  }

  return { draw, resize };
}
