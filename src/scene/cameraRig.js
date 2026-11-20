// 鏡頭控制：OrbitControls 加上 flyTo 轉場。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createCameraRig(camera, domElement) {
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  let idleTimer = 0;
  let reducedMotion = false;

  const stopAuto = () => {
    controls.autoRotate = false;
    clearTimeout(idleTimer);
    if (rig.mode === 'island' && !reducedMotion) {
      idleTimer = setTimeout(() => { controls.autoRotate = true; }, 4000);
    }
  };
  controls.addEventListener('start', stopAuto);

  // 島上可平移視野中心（右鍵／Shift＋左鍵拖曳、雙指拖曳），但注視點限制在島的周圍，
  // 避免把島拖出畫面找不回來。初始與重新整理都回到取景算出的中心（setMode 時重設）。
  const PAN_BOX = { x: 10, z: 10, down: 11, up: 5 };
  const panMin = new THREE.Vector3();
  const panMax = new THREE.Vector3();
  const before = new THREE.Vector3();
  controls.addEventListener('change', () => {
    if (rig.mode !== 'island' || rig.flying) return;
    before.copy(controls.target);
    controls.target.clamp(panMin, panMax);
    // 注視點被擋住的量，鏡頭也跟著退回，維持原本的視角
    camera.position.add(before.sub(controls.target).negate());
  });

  const rig = {
    controls,
    mode: 'island',
    // flyTo 期間（直到下一次 setMode）不呼叫 controls.update()，避免距離/角度限制把鏡頭拉回去
    flying: false,
    setReducedMotion(v) { reducedMotion = v; if (v) controls.autoRotate = false; },
    // distance：取景算出的鏡頭距離，縮放範圍以它為準（至少保留原本的 12～34）
    // mode：island（可旋轉、縮放、平移）、interior（小幅環視）、forge（第一人稱打鐵：鏡頭固定，主迴圈不呼叫 controls.update()）
    setMode(mode, target, { distance = 22 } = {}) {
      rig.mode = mode;
      rig.flying = false;
      controls.target.copy(target);
      controls.enabled = mode !== 'forge';
      if (mode === 'forge') {
        controls.autoRotate = false;
        clearTimeout(idleTimer);
        camera.lookAt(target);
        return;
      }
      if (mode === 'island') {
        controls.minPolarAngle = 0.6;
        // 可以壓低到略低於水平，從側下方看到岩底與懸掛的魔晶
        controls.maxPolarAngle = 1.62;
        controls.minAzimuthAngle = -Infinity;
        controls.maxAzimuthAngle = Infinity;
        controls.minDistance = Math.min(12, distance * 0.5);
        controls.maxDistance = Math.max(34, distance * 1.35);
        controls.enableZoom = true;
        controls.enablePan = true;
        controls.screenSpacePanning = true;
        controls.panSpeed = 0.8;
        panMin.set(target.x - PAN_BOX.x, target.y - PAN_BOX.down, target.z - PAN_BOX.z);
        panMax.set(target.x + PAN_BOX.x, target.y + PAN_BOX.up, target.z + PAN_BOX.z);
        controls.autoRotateSpeed = 0.4;
        stopAuto();
      } else {
        // 室內：以目前方位為中心，左右各 0.35 rad
        const offset = camera.position.clone().sub(target);
        const az = Math.atan2(offset.x, offset.z);
        controls.minAzimuthAngle = az - 0.35;
        controls.maxAzimuthAngle = az + 0.35;
        controls.minPolarAngle = 1.05;
        controls.maxPolarAngle = 1.55; // 鏡頭在人眼高度，允許略微仰視
        controls.enableZoom = false;
        controls.enablePan = false;
        controls.minDistance = 0;
        controls.maxDistance = 100;
        controls.autoRotate = false;
        clearTimeout(idleTimer);
      }
      controls.update();
    },
    flyTo(position, target, ms) {
      const p0 = camera.position.clone();
      const t0 = controls.target.clone();
      const enabled = controls.enabled;
      controls.enabled = false;
      controls.autoRotate = false;
      clearTimeout(idleTimer);
      rig.flying = true;
      return new Promise((resolve) => {
        const start = performance.now();
        const step = (now) => {
          const k = Math.min(1, (now - start) / ms);
          const e = ease(k);
          camera.position.lerpVectors(p0, position, e);
          controls.target.lerpVectors(t0, target, e);
          camera.lookAt(controls.target);
          if (k < 1) requestAnimationFrame(step);
          else { controls.enabled = enabled; resolve(); }
        };
        requestAnimationFrame(step);
      });
    },
  };
  return rig;
}

