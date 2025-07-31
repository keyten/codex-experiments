import * as THREE from 'https://unpkg.com/three@0.164.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.164.0/examples/jsm/loaders/GLTFLoader.js';
import { SkeletonUtils } from 'https://unpkg.com/three@0.164.0/examples/jsm/utils/SkeletonUtils.js';

let camera, scene, renderer, ground;
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const move = { forward: false, backward: false, left: false, right: false };

const characters = [];
const projectiles = [];
let player;

const cameraOffset = new THREE.Vector3(0, 3, -6);

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

  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  ground = new THREE.Mesh(
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
  loader.load('https://threejs.org/examples/models/gltf/Knight.glb', (gltf) => {
    const base = gltf.scene;
    const anims = gltf.animations;
    player = createCharacter(base, anims, new THREE.Vector3(0, 0, 0), true);
    const enemy1 = createCharacter(
      SkeletonUtils.clone(base),
      anims,
      new THREE.Vector3(10, 0, 10)
    );
    const enemy2 = createCharacter(
      SkeletonUtils.clone(base),
      anims,
      new THREE.Vector3(-10, 0, 10)
    );
    characters.push(player, enemy1, enemy2);
  });

  window.addEventListener('resize', onResize);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('click', () => strike(player));
}

function createCharacter(model, animations, position, isPlayer = false) {
  scene.add(model);
  model.position.copy(position);
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  animations.forEach((clip) => (actions[clip.name] = mixer.clipAction(clip)));
  if (actions['Idle']) actions['Idle'].play();
  return {
    model,
    mixer,
    actions,
    state: 'Idle',
    isPlayer,
    shield: null,
    dodgeDir: 1,
    aiTimer: 0,
  };
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
  switch (event.code) {
    case 'KeyW':
      move.forward = true;
      break;
    case 'KeyS':
      move.backward = true;
      break;
    case 'KeyA':
      move.left = true;
      break;
    case 'KeyD':
      move.right = true;
      break;
    case 'Space':
      block(player);
      break;
    case 'KeyZ':
      dodge(player);
      break;
    case 'KeyX':
      fireball(player);
      break;
    case 'KeyQ':
      teleport(player);
      break;
    case 'KeyE':
      shield(player);
      break;
  }
}

function onKeyUp(event) {
  switch (event.code) {
    case 'KeyW':
      move.forward = false;
      break;
    case 'KeyS':
      move.backward = false;
      break;
    case 'KeyA':
      move.left = false;
      break;
    case 'KeyD':
      move.right = false;
      break;
  }
}

function setAction(ch, name) {
  const next = ch.actions[name];
  if (!next || ch.state === name) return;
  const prev = ch.actions[ch.state];
  if (prev) prev.fadeOut(0.2);
  next.reset().fadeIn(0.2).play();
  ch.state = name;
}

function playTemp(ch, name) {
  const action = ch.actions[name];
  if (!action) return;
  setAction(ch, name);
  action.clampWhenFinished = true;
  action.loop = THREE.LoopOnce;
  action.reset().play();
  setTimeout(() => {
    setAction(ch, 'Idle');
  }, (action._clip?.duration || 1) * 1000);
}

function strike(ch) {
  if (!ch) return;
  playTemp(ch, 'Strike');
}

function block(ch) {
  if (!ch) return;
  playTemp(ch, 'Block');
}

function dodge(ch) {
  if (!ch) return;
  const side = new THREE.Vector3(ch.dodgeDir, 0, 0)
    .applyQuaternion(ch.model.quaternion)
    .multiplyScalar(3);
  ch.model.position.add(side);
  ch.dodgeDir *= -1;
  playTemp(ch, 'Dodge');
}

function fireball(ch) {
  if (!ch) return;
  playTemp(ch, 'Cast');
  const geom = new THREE.SphereGeometry(0.2, 8, 8);
  const mat = new THREE.MeshBasicMaterial({ color: 0xff5500 });
  const mesh = new THREE.Mesh(geom, mat);
  const dir = new THREE.Vector3(0, 0, -1)
    .applyQuaternion(ch.model.quaternion)
    .normalize();
  mesh.position.copy(ch.model.position).add(dir.clone().multiplyScalar(1.5));
  mesh.position.y += 1;
  scene.add(mesh);
  projectiles.push({ mesh, dir, owner: ch, life: 5 });
}

function teleport(ch) {
  if (!ch) return;
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const hit = raycaster.intersectObject(ground, false);
  if (hit.length > 0) {
    ch.model.position.copy(hit[0].point);
  }
  playTemp(ch, 'Teleport');
}

function shield(ch) {
  if (!ch || ch.shield) return;
  const geom = new THREE.SphereGeometry(2, 16, 16);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.3,
  });
  const s = new THREE.Mesh(geom, mat);
  s.position.y = 1;
  ch.model.add(s);
  ch.shield = s;
  setTimeout(() => {
    ch.model.remove(s);
    ch.shield = null;
  }, 3000);
  playTemp(ch, 'Shield');
}

function updatePlayer(delta) {
  if (!player) return;
  const model = player.model;
  const dir = new THREE.Vector3();
  if (move.forward) dir.z -= 1;
  if (move.backward) dir.z += 1;
  if (move.left) model.rotation.y += delta * 2;
  if (move.right) model.rotation.y -= delta * 2;

  if (dir.lengthSq() > 0) {
    dir.normalize();
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), model.rotation.y);
    model.position.addScaledVector(dir, delta * 5);
    setAction(player, 'Run');
  } else if (player.state === 'Run') {
    setAction(player, 'Idle');
  }

  const camPos = model.position
    .clone()
    .add(
      cameraOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), model.rotation.y)
    );
  camera.position.lerp(camPos, 0.1);
  camera.lookAt(model.position.clone().setY(model.position.y + 1));
}

function updateEnemy(enemy, delta) {
  enemy.aiTimer -= delta;
  if (enemy.aiTimer <= 0) {
    const r = Math.random();
    if (r < 0.3) strike(enemy);
    else if (r < 0.5) fireball(enemy);
    else if (r < 0.6) shield(enemy);
    else if (r < 0.7) teleport(enemy);
    else if (r < 0.85) dodge(enemy);
    else block(enemy);
    enemy.aiTimer = 1 + Math.random() * 2;
  }

  if (player) {
    const dir = player.model.position.clone().sub(enemy.model.position);
    const dist = dir.length();
    if (dist > 5) {
      dir.normalize();
      enemy.model.position.addScaledVector(dir, delta * 2);
      enemy.model.lookAt(player.model.position);
      setAction(enemy, 'Run');
    } else if (enemy.state === 'Run') {
      setAction(enemy, 'Idle');
    }
  }
}

function updateProjectiles(delta) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.mesh.position.addScaledVector(p.dir, delta * 20);
    p.life -= delta;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      projectiles.splice(i, 1);
      continue;
    }

    for (const ch of characters) {
      if (ch === p.owner) continue;
      const dist = ch.model.position
        .clone()
        .add(new THREE.Vector3(0, 1, 0))
        .distanceTo(p.mesh.position);
      if (dist < 1.5) {
        scene.remove(p.mesh);
        projectiles.splice(i, 1);
        break;
      }
    }
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  characters.forEach((c) => c.mixer.update(delta));
  updatePlayer(delta);
  characters
    .filter((c) => !c.isPlayer)
    .forEach((e) => updateEnemy(e, delta));
  updateProjectiles(delta);
  renderer.render(scene, camera);
}

