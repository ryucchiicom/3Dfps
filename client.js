
const socket = io();
let myId = null;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const light = new THREE.HemisphereLight(0xffffff, 0x444444);
scene.add(light);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(100,100),
  new THREE.MeshStandardMaterial({color:0x333333})
);
ground.rotation.x = -Math.PI/2;
scene.add(ground);

const bodyGeo = new THREE.CylinderGeometry(0.4,0.4,1.6,8);
const bodyMat = new THREE.MeshStandardMaterial({color:0x00aaff});
const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
scene.add(bodyMesh);

camera.position.y = 1.6;

const keys = {};
document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

let player = { x:0, y:1, z:0, rotY:0 };

const otherPlayers = {};
const targets = {};

socket.on("connect", () => {
  myId = socket.id;
});

socket.on("state", (players) => {
  for (const id in players) {
    if (id === myId) {
      targets[id] = players[id];
      continue;
    }
    if (!otherPlayers[id]) {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4,0.4,1.6,8),
        new THREE.MeshStandardMaterial({color:0xff4444})
      );
      scene.add(mesh);
      otherPlayers[id] = mesh;
    }
    targets[id] = players[id];
  }
});

function animate(){
  requestAnimationFrame(animate);

  const speed = 0.1;
  if (keys["w"]) player.z -= speed;
  if (keys["s"]) player.z += speed;
  if (keys["a"]) player.x -= speed;
  if (keys["d"]) player.x += speed;

  camera.position.set(player.x,1.6,player.z);
  bodyMesh.position.set(player.x,1,player.z);

  socket.emit("update", player);

  for (const id in otherPlayers) {
    if (!targets[id]) continue;
    const mesh = otherPlayers[id];
    mesh.position.lerp(
      new THREE.Vector3(targets[id].x,1,targets[id].z),
      0.2
    );
  }

  renderer.render(scene,camera);
}

animate();
