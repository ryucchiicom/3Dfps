// client.js
const socket = io();
let myId = null;
let players = {};
let bullets = {};
let lastStateAt = Date.now();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, 1.0);
light.position.set(10,20,10);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040, 1.2));

const ground = new THREE.Mesh(new THREE.PlaneGeometry(200,200), new THREE.MeshStandardMaterial({ color:0x333333 }));
ground.rotation.x = -Math.PI/2;
scene.add(ground);

const obstacles = [];
function makeBox(x,z,w=2,h=2,d=2){
  const g = new THREE.BoxGeometry(w,h,d);
  const m = new THREE.MeshStandardMaterial({ color: 0x666666 });
  const mesh = new THREE.Mesh(g,m);
  mesh.position.set(x, h/2, z);
  scene.add(mesh);
  obstacles.push(mesh);
}
makeBox(0, -6, 4,2,2);
makeBox(5, 2, 3,2,4);
makeBox(-6, 3, 5,2,2);

const otherPlayerMeshes = {};
const bulletMeshes = {};

const rig = new THREE.Object3D();
rig.add(camera);
camera.position.set(0, 0.6, 0);
scene.add(rig);

const state = {
  x: Math.random()*8-4,
  y: 1.6,
  z: Math.random()*8-4,
  rotY: 0,
  velX:0,
  velZ:0,
  speed: 6,
  yaw: 0, pitch: 0,
  ammo: 12,
  health: 100,
  alive: true
};

const bodyGeo = new THREE.BoxGeometry(0.6,1.6,0.6);
const bodyMat = new THREE.MeshStandardMaterial({ color: 0x88ccff });
const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
bodyMesh.visible = false;
scene.add(bodyMesh);

const fpsEl = document.getElementById('fps');
const healthEl = document.getElementById('health');
const ammoEl = document.getElementById('ammo');

window.addEventListener('resize', ()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let keys = {};
document.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

const pointerBtn = document.getElementById('pointerBtn');
pointerBtn.onclick = ()=>{ renderer.domElement.requestPointerLock(); };
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === renderer.domElement) {
    document.addEventListener('mousemove', onMouseMove);
    pointerBtn.textContent = 'Mouse Look: ON';
  } else {
    document.removeEventListener('mousemove', onMouseMove);
    pointerBtn.textContent = 'Enable Mouse Look';
  }
});
function onMouseMove(e){
  const sensitivity = 0.002;
  state.yaw -= e.movementX * sensitivity;
  state.pitch -= e.movementY * sensitivity;
  state.pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, state.pitch));
}

renderer.domElement.addEventListener('mousedown', e=>{
  if (e.button === 0) { shoot(); } else if (e.button === 2) { reload(); }
});
renderer.domElement.addEventListener('contextmenu', e=> e.preventDefault());

const leftStick = document.getElementById('leftStick');
const rightStick = document.getElementById('rightStick');
let leftTouchId = null, rightTouchId = null;
let leftOrigin = null, rightOrigin = null;
let leftVector = {x:0,y:0}, rightVector={x:0,y:0};

function showLeftStick(x,y){
  leftStick.style.display = 'block';
  leftStick.style.left = x + 'px';
  leftStick.style.top = y + 'px';
  leftOrigin = {x,y};
  leftStick.querySelector('.stickInner').style.transform = 'translate(-50%,-50%)';
}
function hideLeftStick(){ leftStick.style.display = 'none'; leftOrigin = null; leftVector={x:0,y:0}; }
function showRightStick(x,y){
  rightStick.style.display = 'block';
  rightStick.style.left = x + 'px';
  rightStick.style.top = y + 'px';
  rightOrigin = {x,y};
  rightStick.querySelector('.stickInner').style.transform = 'translate(-50%,-50%)';
}
function hideRightStick(){ rightStick.style.display = 'none'; rightOrigin = null; rightVector={x:0,y:0}; }

renderer.domElement.addEventListener('touchstart', e=>{
  for(const t of e.changedTouches){
    const x = t.clientX, y = t.clientY;
    if (x < window.innerWidth/2 && leftTouchId === null){
      leftTouchId = t.identifier;
      showLeftStick(x, y);
    } else if (x >= window.innerWidth/2 && rightTouchId === null){
      rightTouchId = t.identifier;
      showRightStick(x, y);
    }
  }
}, {passive:false});

renderer.domElement.addEventListener('touchmove', e=>{
  e.preventDefault();
  for(const t of e.changedTouches){
    if (t.identifier === leftTouchId && leftOrigin){
      const dx = t.clientX - leftOrigin.x;
      const dy = t.clientY - leftOrigin.y;
      const max = 60;
      const nx = Math.max(-1, Math.min(1, dx / max));
      const ny = Math.max(-1, Math.min(1, dy / max));
      leftVector = { x: nx, y: -ny };
      leftStick.querySelector('.stickInner').style.transform = `translate(calc(-50% + ${nx*30}px), calc(-50% + ${-ny*30}px))`;
    } else if (t.identifier === rightTouchId && rightOrigin){
      const dx = t.clientX - rightOrigin.x;
      const dy = t.clientY - rightOrigin.y;
      const max = 60;
      const nx = Math.max(-1, Math.min(1, dx / max));
      const ny = Math.max(-1, Math.min(1, dy / max));
      rightVector = { x: nx, y: -ny };
      rightStick.querySelector('.stickInner').style.transform = `translate(calc(-50% + ${nx*30}px), calc(-50% + ${-ny*30}px))`;
      state.yaw -= nx * 0.04;
      state.pitch -= ny * 0.04;
      state.pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, state.pitch));
    }
  }
}, {passive:false});

renderer.domElement.addEventListener('touchend', e=>{
  for(const t of e.changedTouches){
    if (t.identifier === leftTouchId){
      if (Math.abs(leftVector.x) < 0.15 && Math.abs(leftVector.y) < 0.15){ shoot(); }
      hideLeftStick();
      leftTouchId = null;
      leftVector = {x:0,y:0};
    } else if (t.identifier === rightTouchId){
      if (Math.abs(rightVector.x) < 0.15 && Math.abs(rightVector.y) < 0.15){ reload(); }
      hideRightStick();
      rightTouchId = null;
      rightVector = {x:0,y:0};
    }
  }
}, {passive:false});

function shoot(){
  if (!state.alive) return;
  if (state.ammo <= 0) return;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  socket.emit('shoot', { dir: { x: dir.x, y: dir.y, z: dir.z } });
  state.ammo = Math.max(0, state.ammo - 1);
  ammoEl.innerText = 'Ammo: ' + state.ammo;
}

function reload(){ socket.emit('reload'); }

socket.on('welcome', d => { myId = d.id; console.log('my id', myId); });
socket.on('playersUpdate', data => { players = data; });
socket.on('state', data => {
  players = data.players;
  const nowt = Date.now();
  for (const id in players){
    if (id === myId) continue;
    const p = players[id];
    if (!otherPlayerMeshes[id]){
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.6,1.6,0.6), new THREE.MeshStandardMaterial({ color:0xff8855 }));
      scene.add(m);
      otherPlayerMeshes[id] = m;
    }
    const mesh = otherPlayerMeshes[id];
    mesh.position.set(p.x, p.y - 0.8, p.z);
    mesh.rotation.y = p.rotY;
  }
  for (const id in otherPlayerMeshes){
    if (!players[id]) {
      scene.remove(otherPlayerMeshes[id]);
      delete otherPlayerMeshes[id];
    }
  }

  const incomingBullets = data.bullets;
  const seen = new Set();
  for (const b of incomingBullets){
    seen.add(b.id);
    if (!bulletMeshes[b.id]){
      const bm = new THREE.Mesh(new THREE.SphereGeometry(0.12,8,8), new THREE.MeshStandardMaterial({ color:0xffff77 }));
      scene.add(bm);
      bulletMeshes[b.id] = bm;
    }
    bulletMeshes[b.id].position.set(b.x, b.y, b.z);
  }
  for (const id in bulletMeshes){
    if (!seen.has(id)){
      scene.remove(bulletMeshes[id]);
      delete bulletMeshes[id];
    }
  }

  if (players[myId]) {
    state.x = players[myId].x;
    state.y = players[myId].y;
    state.z = players[myId].z;
    state.rotY = players[myId].rotY;
    state.health = players[myId].health;
    state.ammo = players[myId].ammo;
    state.alive = players[myId].alive;
    healthEl.innerText = 'HP: ' + Math.max(0, Math.round(state.health));
    ammoEl.innerText = 'Ammo: ' + state.ammo;
  }

  lastStateAt = Date.now();
});

socket.on('hit', d => { console.log('got hit', d); });
socket.on('reloaded', d => { state.ammo = d.ammo; ammoEl.innerText = 'Ammo: ' + state.ammo; });
socket.on('playerDied', d => {});

setInterval(()=>{
  let moveX = 0, moveZ = 0;
  if (keys['w'] || keys['arrowup']) moveZ -= 1;
  if (keys['s'] || keys['arrowdown']) moveZ += 1;
  if (keys['a'] || keys['arrowleft']) moveX -= 1;
  if (keys['d'] || keys['arrowright']) moveX += 1;
  if (Math.abs(leftVector.x) > 0.05 || Math.abs(leftVector.y) > 0.05){
    moveX = leftVector.x;
    moveZ = leftVector.y;
  }

  const forward = new THREE.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw));
  const right = new THREE.Vector3(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
  const move = new THREE.Vector3();
  move.addScaledVector(forward, -moveZ);
  move.addScaledVector(right, moveX);
  if (move.length() > 0.001) move.normalize();

  const dt = 0.05;
  state.x += move.x * state.speed * dt;
  state.z += move.z * state.speed * dt;

  state.rotY = state.yaw;

  rig.position.set(state.x, state.y, state.z);
  rig.rotation.y = state.yaw;
  camera.rotation.x = state.pitch;

  socket.emit('input', { x: state.x, y: state.y, z: state.z, rotY: state.rotY, velX: move.x, velZ: move.z });
}, 50);

let lastFrame = performance.now();
function animate(){
  requestAnimationFrame(animate);
  const nowt = performance.now();
  const dt = Math.min(0.1, (nowt - lastFrame)/1000);
  lastFrame = nowt;

  bodyMesh.position.set(state.x, state.y - 0.8, state.z);

  renderer.render(scene, camera);

  fpsEl.innerText = 'FPS: ' + Math.round(1/dt);
}
animate();

const cross = document.createElement('div');
cross.style.position = 'absolute';
cross.style.left = '50%';
cross.style.top = '50%';
cross.style.width = '8px';
cross.style.height = '8px';
cross.style.margin = '-4px 0 0 -4px';
cross.style.borderRadius = '50%';
cross.style.background = 'rgba(255,255,255,0.6)';
cross.style.zIndex = 50;
document.body.appendChild(cross);
