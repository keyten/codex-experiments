import * as THREE from 'https://unpkg.com/three@0.164.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.164.0/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://unpkg.com/three@0.164.0/examples/jsm/controls/OrbitControls.js';
import { SkeletonUtils } from 'https://unpkg.com/three@0.164.0/examples/jsm/utils/SkeletonUtils.js';

let camera, scene, renderer;
const clock = new THREE.Clock();
const move = { forward: false, backward: false, left: false, right: false };
const speed = 5;
const cameraOffset = new THREE.Vector3(0, 3, -5);
const projectiles = [];
const enemies = [];
let player;
let ground;

init();
animate();

class Character {
  constructor(model, clips) {
    this.model = model;
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};
    clips.forEach(clip => {
      this.actions[clip.name] = this.mixer.clipAction(clip);
    });
    this.state = 'Idle';
    this.setAction('Idle');
    this.shield = null;
  }

  setAction(name) {
    const action = this.actions[name];
    if (!action || this.state === name) return;
    const prev = this.actions[this.state];
    if (prev) prev.fadeOut(0.2);
    action.reset().fadeIn(0.2).play();
    this.state = name;
  }

  playOnce(name, onFinished) {
    const action = this.actions[name];
    if (!action) return;
    action.reset().play();
    action.clampWhenFinished = true;
    action.loop = THREE.LoopOnce;
    const mixer = this.mixer;
    const callback = (e) => {
      if (e.action === action) {
        mixer.removeEventListener('finished', callback);
        if (onFinished) onFinished();
      }
    };
    mixer.addEventListener('finished', callback);
  }

  strike() {
    this.playOnce('Punch');
  }

  block() {
    this.playOnce('No');
  }

  dodge() {
    this.playOnce('Roll');
  }

  fireball(targetDir) {
    this.playOnce('Wave');
    const geo = new THREE.SphereGeometry(0.1, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff5500 });
    const fireball = new THREE.Mesh(geo, mat);
    const pos = new THREE.Vector3();
    this.model.getWorldPosition(pos);
    fireball.position.copy(pos).add(new THREE.Vector3(0, 1, 0));
    fireball.userData.dir = targetDir.clone().normalize();
    fireball.userData.owner = this;
    scene.add(fireball);
    projectiles.push(fireball);
  }

  shieldUp() {
    this.playOnce('Yes');
    if (this.shield) {
      this.model.remove(this.shield);
    }
    const geo = new THREE.SphereGeometry(1.5, 32, 32);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3 });
    const shield = new THREE.Mesh(geo, mat);
    shield.position.set(0, 1, 0);
    this.model.add(shield);
    this.shield = shield;
    setTimeout(() => {
      if (this.shield) {
        this.model.remove(this.shield);
        this.shield = null;
      }
    }, 3000);
  }

  teleport(target) {
    this.playOnce('Jump');
    this.model.position.copy(target);
  }

  update(delta) {
    this.mixer.update(delta);
  }
}

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x202020);

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

  ground = new THREE.Mesh(
    new THREE.PlaneGeometry(10000, 10000),
    new THREE.MeshPhongMaterial({ color: 0x555555, depthWrite: false })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const loader = new GLTFLoader();
  loader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/RobotExpressive/RobotExpressive.glb', gltf => {
    const base = gltf.scene;
    player = new Character(base, gltf.animations);
    scene.add(player.model);
    attachSword(player.model);

    for (let i = 0; i < 2; i++) {
      const clone = SkeletonUtils.clone(base);
      const enemy = new Character(clone, gltf.animations);
      enemy.model.position.set((i + 1) * 5, 0, -5);
      scene.add(enemy.model);
      attachSword(enemy.model);
      enemies.push(enemy);
      aiLoop(enemy);
    }
  });

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.target.set(0, 1, 0);

  window.addEventListener('resize', onResize);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('mousedown', onMouseDown);
}

function attachSword(model) {
  const sword = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.8, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  const hand = model.getObjectByName('RightHand') || model.getObjectByName('mixamorigRightHand');
  if (hand) {
    sword.position.set(0, -0.2, 0.1);
    hand.add(sword);
  } else {
    sword.position.set(0.3, 1, 0);
    model.add(sword);
  }
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
    case 'Space': if (player) player.block(); break;
    case 'KeyZ': if (player) player.dodge(); break;
    case 'KeyX': if (player) player.fireball(getAimDir()); break;
    case 'KeyQ': if (player) teleportPlayer(); break;
    case 'KeyE': if (player) player.shieldUp(); break;
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

function onMouseDown(event) {
  if (player) player.strike();
}

function getAimDir() {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  return dir;
}

function teleportPlayer() {
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(0, 0), camera);
  const intersect = ray.intersectObject(ground);
  if (intersect.length > 0) {
    player.teleport(intersect[0].point);
  }
}

function aiLoop(enemy) {
  setInterval(() => {
    const actions = ['strike', 'block', 'dodge', 'fireball', 'shieldUp', 'teleport'];
    const act = actions[Math.floor(Math.random() * actions.length)];
    if (act === 'fireball') {
      const dir = new THREE.Vector3();
      player.model.getWorldPosition(dir);
      dir.sub(enemy.model.position).normalize();
      enemy.fireball(dir);
    } else if (act === 'teleport') {
      const target = enemy.model.position.clone().add(new THREE.Vector3((Math.random()-0.5)*10, 0, (Math.random()-0.5)*10));
      enemy.teleport(target);
    } else {
      enemy[act]();
    }
  }, 3000 + Math.random() * 2000);
}

function updateMovement(delta) {
  if (!player) return;
  const dir = new THREE.Vector3();
  if (move.forward) dir.z -= 1;
  if (move.backward) dir.z += 1;
  if (dir.lengthSq() > 0) {
    dir.normalize();
    dir.applyAxisAngle(new THREE.Vector3(0,1,0), player.model.rotation.y);
    player.model.position.addScaledVector(dir, delta * speed);
    player.setAction('Run');
  } else if (player.state === 'Run') {
    player.setAction('Idle');
  }

  if (move.left) player.model.rotation.y += delta * 2;
  if (move.right) player.model.rotation.y -= delta * 2;

  const camPos = player.model.position.clone().add(cameraOffset.clone().applyAxisAngle(new THREE.Vector3(0,1,0), player.model.rotation.y));
  camera.position.lerp(camPos, 0.1);
  camera.lookAt(player.model.position);
}

function updateProjectiles(delta) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.position.addScaledVector(p.userData.dir, delta * 10);

    const chars = [player, ...enemies];
    for (const c of chars) {
      if (c && c.shield) {
        const pos = new THREE.Vector3();
        c.model.getWorldPosition(pos);
        if (p.position.distanceTo(pos) < 1.5) {
          scene.remove(p);
          projectiles.splice(i, 1);
          break;
        }
      }
    }

    if (p.position.length() > 1000) {
      scene.remove(p);
      projectiles.splice(i, 1);
    }
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (player) player.update(delta);
  enemies.forEach(e => e.update(delta));
  updateMovement(delta);
  updateProjectiles(delta);
  renderer.render(scene, camera);
}
