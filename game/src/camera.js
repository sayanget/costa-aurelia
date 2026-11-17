// A single third-person rig that follows either Nico on foot or whatever he is driving: mouse-look
// orbits it around the target, and it smooths toward the target's back so cuts between foot and car
// never jump. camera.js owns the yaw/pitch state; main.js just calls update() every frame.
import * as THREE from 'three';
import { CAMERA } from './config.js';

export function createCameraRig(camera) {
  const state = {
    yaw: Math.PI,
    pitch: 0.18,
    pos: new THREE.Vector3(0, 5, -8),
    lookAt: new THREE.Vector3(),
  };

  function applyMouse(dx, dy) {
    state.yaw -= dx * CAMERA.mouseSensitivity;
    state.pitch = Math.max(CAMERA.minPitch, Math.min(CAMERA.maxPitch, state.pitch - dy * CAMERA.mouseSensitivity));
  }

  function update(dt, targetX, targetZ, targetHeight, driving) {
    const offset = driving ? CAMERA.driveOffset : CAMERA.footOffset;
    const horiz = Math.cos(state.pitch) * offset.back;
    const desiredX = targetX - Math.sin(state.yaw) * horiz;
    const desiredZ = targetZ - Math.cos(state.yaw) * horiz;
    const desiredY = targetHeight + offset.height + Math.sin(state.pitch) * offset.back;
    const t = 1 - Math.exp(-CAMERA.smoothing * dt);
    state.pos.x += (desiredX - state.pos.x) * t;
    state.pos.y += (desiredY - state.pos.y) * t;
    state.pos.z += (desiredZ - state.pos.z) * t;
    const lookX = targetX + Math.sin(state.yaw) * 2;
    const lookZ = targetZ + Math.cos(state.yaw) * 2;
    const lookY = targetHeight + 0.9;
    state.lookAt.x += (lookX - state.lookAt.x) * t;
    state.lookAt.y += (lookY - state.lookAt.y) * t;
    state.lookAt.z += (lookZ - state.lookAt.z) * t;
    camera.position.copy(state.pos);
    camera.lookAt(state.lookAt);
  }

  return {
    state,
    applyMouse,
    update,
    get yaw() { return state.yaw; },
    set yaw(v) { state.yaw = v; },
    set pitch(v) { state.pitch = v; },
    setPose(x, z, h, yaw, pitch) {
      state.pos.set(x - Math.sin(yaw) * h, h, z - Math.cos(yaw) * h);
      state.yaw = yaw;
      if (pitch !== undefined) state.pitch = pitch;
    },
  };
}
