// A chase camera that rides behind whatever Nico occupies: on foot it is a plain mouse-look
// follow cam; driving, its yaw locks to the car's own heading (mouse only nudges it, then it
// drifts back to dead-behind), and its distance/FOV/look-ahead all ride the car's speed. Position,
// lookAt and FOV each lerp toward their target every frame — nothing here ever snaps.
import * as THREE from 'three';
import { CAMERA } from './config.js';

export function createCameraRig(camera) {
  const baseFov = camera.fov;
  const state = {
    footYaw: Math.PI,
    pitch: 0.18,
    driveYawOffset: 0,
    prevHeading: 0,
    fov: baseFov,
    pos: new THREE.Vector3(0, 5, -8),
    lookAt: new THREE.Vector3(),
  };

  function applyMouse(dx, dy, driving) {
    if (driving) {
      state.driveYawOffset -= dx * CAMERA.mouseSensitivity;
      state.driveYawOffset = Math.max(-CAMERA.driveMaxOffset, Math.min(CAMERA.driveMaxOffset, state.driveYawOffset));
    } else {
      state.footYaw -= dx * CAMERA.mouseSensitivity;
    }
    state.pitch = Math.max(CAMERA.minPitch, Math.min(CAMERA.maxPitch, state.pitch - dy * CAMERA.mouseSensitivity));
  }

  /**
   * `target`: { x, z, height, heading, speed, topSpeed, handbrake }. `driving` picks the rig.
   * `instant`, when true, snaps position/lookAt/FOV straight to their targets instead of lerping —
   * used once on entering/exiting a vehicle so the rig doesn't visibly fly across the old gap.
   */
  function update(dt, target, driving, instant = false) {
    const posT = instant ? 1 : 1 - Math.exp(-CAMERA.smoothing * dt);
    const lookT = instant ? 1 : 1 - Math.exp(-CAMERA.lookSmoothing * dt);

    let camYaw, lookX, lookZ, back, height, fov, lateral = 0, roll = 0;

    if (driving) {
      state.driveYawOffset *= Math.exp(-CAMERA.driveRecenter * dt);
      const speedFrac = Math.max(0, Math.min(1, Math.abs(target.speed) / Math.max(1, target.topSpeed)));
      const tighten = target.handbrake ? 0.7 : 1;
      back = (CAMERA.driveOffset.backMin + (CAMERA.driveOffset.backMax - CAMERA.driveOffset.backMin) * speedFrac) * tighten;
      height = CAMERA.driveOffset.height;
      fov = CAMERA.driveOffset.fovMin + (CAMERA.driveOffset.fovMax - CAMERA.driveOffset.fovMin) * speedFrac;
      camYaw = target.heading + state.driveYawOffset;

      // Bank and nudge sideways proportional to how fast the car's heading is turning, so corners
      // read without ever letting the camera actually orbit away from behind the car. Skipped on
      // an instant snap, where prevHeading hasn't caught up yet and would read as a sudden swerve.
      let headingDelta = target.heading - state.prevHeading;
      headingDelta = Math.atan2(Math.sin(headingDelta), Math.cos(headingDelta));
      const turnRate = instant ? 0 : Math.max(-1.8, Math.min(1.8, dt > 0 ? headingDelta / dt : 0));
      lateral = turnRate * CAMERA.cornerLateral;
      roll = -turnRate * CAMERA.cornerRoll;

      const reversing = target.speed < -0.4;
      const lookYaw = target.heading + state.driveYawOffset * 0.3;
      const lookAhead = (CAMERA.driveLookAhead.min + (CAMERA.driveLookAhead.max - CAMERA.driveLookAhead.min) * speedFrac) * (reversing ? -1 : 1);
      lookX = target.x + Math.sin(lookYaw) * lookAhead;
      lookZ = target.z + Math.cos(lookYaw) * lookAhead;
    } else {
      back = CAMERA.footOffset.back;
      height = CAMERA.footOffset.height;
      fov = baseFov;
      camYaw = state.footYaw;
      lookX = target.x + Math.sin(state.footYaw) * 2;
      lookZ = target.z + Math.cos(state.footYaw) * 2;
    }
    state.prevHeading = target.heading;

    const horiz = Math.cos(state.pitch) * back;
    const rightX = Math.cos(camYaw), rightZ = -Math.sin(camYaw);
    const desiredX = target.x - Math.sin(camYaw) * horiz + rightX * lateral;
    const desiredZ = target.z - Math.cos(camYaw) * horiz + rightZ * lateral;
    const desiredY = target.height + height + Math.sin(state.pitch) * back;

    state.pos.x += (desiredX - state.pos.x) * posT;
    state.pos.y += (desiredY - state.pos.y) * posT;
    state.pos.z += (desiredZ - state.pos.z) * posT;

    const lookY = target.height + 0.9;
    state.lookAt.x += (lookX - state.lookAt.x) * lookT;
    state.lookAt.y += (lookY - state.lookAt.y) * lookT;
    state.lookAt.z += (lookZ - state.lookAt.z) * lookT;

    state.fov += (fov - state.fov) * posT;

    camera.position.copy(state.pos);
    camera.lookAt(state.lookAt);
    if (roll) camera.rotateZ(roll);
    if (Math.abs(camera.fov - state.fov) > 0.02) {
      camera.fov = state.fov;
      camera.updateProjectionMatrix();
    }
  }

  return {
    applyMouse,
    update,
    get yaw() { return state.footYaw; },
    set yaw(v) { state.footYaw = v; },
    set pitch(v) { state.pitch = v; },
  };
}
