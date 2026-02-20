// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const TICK = 50; // ms server tick (20Hz)
const BULLET_TICK = 20; // ms bullet physics
const BULLET_SPEED = 40; // units / sec
const BULLET_LIFETIME = 2000; // ms
const PLAYER_SPEED = 6; // units / sec
const HIT_RADIUS = 1.2;

const players = {}; // socketId -> player
const bullets = []; // {id, owner, pos:{x,y,z}, vel:{x,y,z}, born}

function now(){ return Date.now(); }

io.on('connection', socket => {
  console.log('connect', socket.id);

  players[socket.id] = {
    id: socket.id,
    x: Math.random()*10-5,
    y: 1.6,
    z: Math.random()*10-5,
    rotY: 0,
    health: 100,
    ammo: 12,
    alive: true,
    lastShot: 0
  };

  socket.emit('welcome', { id: socket.id });
  io.emit('playersUpdate', players);

  socket.on('input', data => {
    const p = players[socket.id];
    if(!p) return;
    p.x = data.x;
    p.y = data.y;
    p.z = data.z;
    p.rotY = data.rotY;
  });

  socket.on('shoot', data => {
    const p = players[socket.id];
    if(!p || !p.alive) return;
    const nowt = now();
    if (p.ammo <= 0) return;
    if (nowt - p.lastShot < 150) return;
    p.lastShot = nowt;
    p.ammo -= 1;

    const startPos = { x: p.x, y: p.y, z: p.z };
    const dir = data.dir;
    const len = Math.sqrt(dir.x*dir.x + dir.y*dir.y + dir.z*dir.z);
    const norm = len>0 ? { x:dir.x/len, y:dir.y/len, z:dir.z/len } : {x:0,z:1,y:0};

    bullets.push({
      id: Math.random().toString(36).slice(2),
      owner: socket.id,
      pos: { x: startPos.x + norm.x*1.0, y: startPos.y + norm.y*0.2, z: startPos.z + norm.z*1.0 },
      vel: { x: norm.x * BULLET_SPEED, y: norm.y * BULLET_SPEED, z: norm.z * BULLET_SPEED },
      born: now()
    });

    io.emit('playedShot', { owner: socket.id });
  });

  socket.on('reload', () => {
    const p = players[socket.id];
    if(!p) return;
    p.ammo = 12;
    socket.emit('reloaded', { ammo: p.ammo });
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('playersUpdate', players);
    console.log('disconnect', socket.id);
  });
});

setInterval(() => {
  const dt = BULLET_TICK / 1000;
  const nowt = now();
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.pos.x += b.vel.x * dt;
    b.pos.y += b.vel.y * dt;
    b.pos.z += b.vel.z * dt;

    if (nowt - b.born > BULLET_LIFETIME) {
      bullets.splice(i,1);
      continue;
    }

    for (const id in players) {
      if (id === b.owner) continue;
      const p = players[id];
      if (!p.alive) continue;
      const dx = p.x - b.pos.x;
      const dy = (p.y - b.pos.y);
      const dz = p.z - b.pos.z;
      const d2 = dx*dx + dy*dy + dz*dz;
      if (d2 < HIT_RADIUS*HIT_RADIUS) {
        p.health -= 30;
        bullets.splice(i,1);
        io.to(id).emit('hit', { from: b.owner, health: p.health });
        io.to(b.owner).emit('hitConfirm', { target: id });
        if (p.health <= 0) {
          p.alive = false;
          io.emit('playerDied', { id: id, by: b.owner });
          setTimeout(()=>{
            if (!players[id]) return;
            players[id].alive = true;
            players[id].health = 100;
            players[id].x = Math.random()*10 - 5;
            players[id].z = Math.random()*10 - 5;
            io.emit('playersUpdate', players);
          }, 2000);
        }
        break;
      }
    }
  }
}, BULLET_TICK);

setInterval(() => {
  const playersSnapshot = {};
  for(const id in players){
    const p = players[id];
    playersSnapshot[id] = { id: p.id, x: p.x, y: p.y, z: p.z, rotY: p.rotY, health: p.health, ammo: p.ammo, alive: p.alive };
  }
  const bulletsSnapshot = bullets.map(b => ({ id: b.id, x: b.pos.x, y: b.pos.y, z: b.pos.z }));
  io.emit('state', { players: playersSnapshot, bullets: bulletsSnapshot });
}, TICK);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('listening on', PORT));
