import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.152.2/examples/jsm/loaders/GLTFLoader.js';
import { SkeletonUtils } from 'https://unpkg.com/three@0.152.2/examples/jsm/utils/SkeletonUtils.js';

// scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const light = new THREE.HemisphereLight(0xffffff, 0x444444);
scene.add(light);
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5,10,2);
scene.add(dirLight);

// ground plane (effectively infinite for gameplay)
const groundGeo = new THREE.PlaneGeometry(2000,2000);
const groundMat = new THREE.MeshStandardMaterial({ color:0x555555 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI/2;
ground.receiveShadow = true;
scene.add(ground);

const loader = new GLTFLoader();
const modelUrl = 'https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/knight-animations.glb';

let player;
const enemies = [];
const fireballs = [];

class Character {
  constructor(gltf, position){
    this.group = gltf.scene;
    this.group.position.copy(position);
    this.mixer = new THREE.AnimationMixer(this.group);
    this.actions = {};
    gltf.animations.forEach(clip => {
      this.actions[clip.name] = this.mixer.clipAction(clip);
    });
    this.play('Idle');
    this.velocity = new THREE.Vector3();
  }
  play(name){
    if(this.current === name) return;
    if(this.actions[this.current]) this.actions[this.current].fadeOut(0.2);
    const action = this.actions[name];
    if(action){
      action.reset().fadeIn(0.2).play();
      this.current = name;
    }
  }
  update(dt){
    this.mixer.update(dt);
    this.group.position.addScaledVector(this.velocity, dt);
  }
}

loader.load(modelUrl, gltf => {
  player = new Character(gltf, new THREE.Vector3(0,0,0));
  scene.add(player.group);

  // create two enemies
  for(let i=0;i<2;i++){
    const clone = SkeletonUtils.clone(gltf.scene);
    const enemy = new Character({scene:clone, animations:gltf.animations}, new THREE.Vector3(5*(i+1),0,5*(i+1)));
    enemies.push(enemy);
    scene.add(enemy.group);
  }
});

// camera follows the player
const camOffset = new THREE.Vector3(0,5,10);
function updateCamera(){
  if(!player) return;
  const pos = player.group.position.clone();
  const offset = camOffset.clone().applyQuaternion(player.group.quaternion);
  camera.position.copy(pos).add(offset);
  camera.lookAt(pos);
}

// controls
const keys = {};
window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

window.addEventListener('click', () => attack(player));
window.addEventListener('keydown', e => {
  switch(e.key){
    case ' ': block(player); break;
    case 'z': dodge(player); break;
    case 'x': fireball(player); break;
    case 'q': teleport(player); break;
    case 'e': shield(player); break;
  }
});

// reusable geometry/material for fireballs
const ballGeo = new THREE.SphereGeometry(0.2,16,16);
const ballMat = new THREE.MeshBasicMaterial({color:0xff4500});

function attack(actor){
  if(!actor) return;
  actor.play('Attack');
  setTimeout(()=>actor.play('Idle'),500);
}
function block(actor){
  if(!actor) return;
  actor.play('Block');
  setTimeout(()=>actor.play('Idle'),800);
}
function dodge(actor){
  if(!actor) return;
  actor.play('Dodge');
  if(actor===player){
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0,1,0));
    actor.group.position.add(right.multiplyScalar(2));
  } else {
    actor.group.position.add(new THREE.Vector3(Math.random()*2-1,0,Math.random()*2-1).setLength(2));
  }
  setTimeout(()=>actor.play('Idle'),600);
}
function fireball(actor){
  if(!actor) return;
  actor.play('Cast');
  const ball = new THREE.Mesh(ballGeo, ballMat.clone());
  let dir = new THREE.Vector3();
  if(actor===player){
    camera.getWorldDirection(dir);
  } else {
    dir.subVectors(player.group.position, actor.group.position).normalize();
  }
  ball.position.copy(actor.group.position).add(new THREE.Vector3(0,1,0));
  ball.userData.vel = dir.multiplyScalar(20);
  fireballs.push(ball);
  scene.add(ball);
  setTimeout(()=>actor.play('Idle'),600);
}
function shield(actor){
  if(!actor || actor.shield) return;
  actor.play('Shield');
  const geo = new THREE.SphereGeometry(2,16,16);
  const mat = new THREE.MeshBasicMaterial({color:0x00ffff,transparent:true,opacity:0.3});
  const sphere = new THREE.Mesh(geo, mat);
  sphere.position.set(0,1,0);
  actor.group.add(sphere);
  actor.shield = sphere;
  setTimeout(()=>{actor.group.remove(sphere);actor.shield=null;actor.play('Idle');},3000);
}
function teleport(actor){
  if(!actor) return;
  if(actor===player){
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
    const hit = raycaster.intersectObject(ground);
    if(hit.length>0) actor.group.position.copy(hit[0].point);
  } else {
    const pos = player.group.position.clone().add(new THREE.Vector3((Math.random()-0.5)*10,0,(Math.random()-0.5)*10));
    actor.group.position.copy(pos);
  }
}

function updatePlayer(dt){
  if(!player) return;
  const speed = 5;
  const dir = new THREE.Vector3();
  if(keys['w']) dir.z -= 1;
  if(keys['s']) dir.z += 1;
  if(keys['a']) dir.x -= 1;
  if(keys['d']) dir.x += 1;
  dir.normalize();
  player.velocity.set(dir.x*speed,0,dir.z*speed);
  if(dir.lengthSq()>0){ player.play('Run'); }
  else if(player.current==='Run'){ player.play('Idle'); }
}

function updateFireballs(dt){
  for(let i=fireballs.length-1;i>=0;i--){
    const b = fireballs[i];
    b.position.addScaledVector(b.userData.vel, dt);
    if(b.position.length()>100){ scene.remove(b); fireballs.splice(i,1); }
  }
}

function enemyAI(enemy, dt){
  if(!player) return;
  const toPlayer = player.group.position.clone().sub(enemy.group.position);
  enemy.group.lookAt(player.group.position);
  if(toPlayer.length()>3){
    enemy.velocity.copy(toPlayer.setLength(2));
    enemy.play('Run');
  } else {
    enemy.velocity.set(0,0,0);
    const r = Math.random();
    if(r < 0.02) attack(enemy);
    else if(r < 0.04) fireball(enemy);
    else if(r < 0.05) shield(enemy);
    else if(r < 0.06) teleport(enemy);
    else if(r < 0.07) dodge(enemy);
    else if(r < 0.08) block(enemy);
  }
}

function animate(){
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  updatePlayer(dt);
  if(player) player.update(dt);
  enemies.forEach(e=>{ enemyAI(e, dt); e.update(dt); });
  updateFireballs(dt);
  updateCamera();
  renderer.render(scene, camera);
}
const clock = new THREE.Clock();
animate();

window.addEventListener('resize', ()=>{
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
