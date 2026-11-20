// renderer、後製（bloom）、resize。依 tier 設定開關陰影與 bloom。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function createStage(container, tierSettings) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, tierSettings.pixelRatioMax));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = tierSettings.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.append(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.1, 400);
  let scene = new THREE.Scene();

  let composer = null;
  let renderPass = null;
  let bloomPass = null;
  if (tierSettings.bloom) {
    composer = new EffectComposer(renderer);
    renderPass = new RenderPass(scene, camera);
    bloomPass = new UnrealBloomPass(new THREE.Vector2(container.clientWidth, container.clientHeight), 0.9, 0.55, 0.82);
    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  }

  const stage = {
    renderer, camera, composer, bloomPass,
    get scene() { return scene; },
    setScene(s) {
      scene = s;
      if (renderPass) renderPass.scene = s;
    },
    render() {
      if (composer) composer.render();
      else renderer.render(scene, camera);
    },
    onResize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      // 直式螢幕加大垂直視角，避免左右被切掉；基準視角可依場景調整（camera.userData.baseFov，室內用廣角）
      const base = camera.userData.baseFov ?? 42;
      // 直式不疊加：取「基準視角」與「原本的直式加寬」較大者，避免室內廣角在手機上變成魚眼
      camera.fov = camera.aspect >= 1 ? base : Math.max(base, 42 + (1 - camera.aspect) * 45);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (composer) composer.setSize(w, h);
    },
  };
  window.addEventListener('resize', stage.onResize);
  stage.onResize();
  return stage;
}
