import * as THREE from 'https://unpkg.com/three@0.164.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.164.0/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://unpkg.com/three@0.164.0/examples/jsm/controls/OrbitControls.js';

let camera, scene, renderer, mixer, model, actions = {};
const clock = new THREE.Clock();
const move = { forward: false, backward: false, left: false, right: false };
const state = { action: 'Idle' };
const speed = 5;
const cameraOffset = new THREE.Vector3(0, 3, -5);

init();
animate();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa0a0a0);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444);
  hemi.position.set(0, 20, 0);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff);
  dir.position.set(3, 10, 10);
  scene.add(dir);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(10000, 10000),
    new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const grid = new THREE.GridHelper(10000, 1000, 0x000000, 0x000000);
  grid.material.opacity = 0.2;
  grid.material.transparent = true;
  scene.add(grid);

  const loader = new GLTFLoader();
  loader.load('https://example.com/models/SwordMan.glb', gltf => {
    model = gltf.scene;
    scene.add(model);

    mixer = new THREE.AnimationMixer(model);
    gltf.animations.forEach((clip) => {
      actions[clip.name] = mixer.clipAction(clip);
    });

    setAction('Idle');
  });

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.target.set(0, 1, 0);

  window.addEventListener('resize', onResize);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
  switch (event.code) {
    case 'KeyW': move.forward = true; break;
    case 'KeyS': move.backward = true; break;
    case 'KeyA': move.left = true; break;
    case 'KeyD': move.right = true; break;
    case 'KeyJ': playOnce('Strike'); break;
    case 'KeyK': playOnce('Block'); break;
    case 'KeyL': playOnce('Dodge'); break;
  }
}

function onKeyUp(event) {
  switch (event.code) {
    case 'KeyW': move.forward = false; break;
    case 'KeyS': move.backward = false; break;
    case 'KeyA': move.left = false; break;
    case 'KeyD': move.right = false; break;
  }
}

function setAction(name) {
  if (!actions[name]) return;
  if (state.action === name) return;
  const prev = actions[state.action];
  const next = actions[name];
  if (prev) prev.fadeOut(0.2);
  next.reset().fadeIn(0.2).play();
  state.action = name;
}

function playOnce(name) {
  const action = actions[name];
  if (!action) return;
  action.reset().play();
  action.clampWhenFinished = true;
  action.loop = THREE.LoopOnce;
  action.onFinished = () => setAction(move.forward || move.backward ? 'Run' : 'Idle');
}

function updateMovement(delta) {
  if (!model) return;

  const dir = new THREE.Vector3();
  if (move.forward) dir.z -= 1;
  if (move.backward) dir.z += 1;
  if (move.left) model.rotation.y += delta * 2;
  if (move.right) model.rotation.y -= delta * 2;

  if (dir.lengthSq() > 0) {
    dir.normalize();
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), model.rotation.y);
    model.position.addScaledVector(dir, delta * speed);
    setAction('Run');
  } else if (state.action === 'Run') {
    setAction('Idle');
  }

  const camPos = model.position.clone().add(cameraOffset.clone().applyAxisAngle(new THREE.Vector3(0,1,0), model.rotation.y));
  camera.position.lerp(camPos, 0.1);
  camera.lookAt(model.position);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);
  updateMovement(delta);
  renderer.render(scene, camera);
}
