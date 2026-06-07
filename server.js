const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

const MISSIONS = [
  "Get someone to say 'wallah'",
  "Make someone laugh out loud",
  "Get someone to check their phone",
  "Get someone to talk about food",
  "Convince someone to order dessert",
  "Get someone to stand up from their seat",
  "Make someone say 'seriously?'",
  "Get someone to look at the ceiling",
  "Make someone say your name twice",
  "Get someone to give you a high five",
  "Get someone to hum any song",
  "Make someone say 'I don't know'",
  "Get someone to compliment you",
  "Make someone look at their watch",
  "Get someone to say 'no way'",
  "Make two people shake hands",
  "Get someone to take a sip of their drink",
  "Make someone say a number over 100",
  "Get someone to snap their fingers",
  "Make someone say 'let's go'",
];

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function serializePlayers(room) {
  return room.players.map(p => ({
    id: p.id,
    name: p.name,
    isHost: p.id === room.hostId,
    missionCompleted: p.missionCompleted,
  }));
}

io.on('connection', (socket) => {
  socket.on('createRoom', ({ playerName }) => {
    let code;
    do { code = generateCode(); } while (rooms[code]);

    rooms[code] = {
      code,
      hostId: socket.id,
      players: [{ id: socket.id, name: playerName, mission: null, missionCompleted: false, completedAt: null }],
      status: 'lobby',
    };

    socket.join(code);
    socket.data.roomCode = code;

    socket.emit('roomCreated', {
      code,
      playerId: socket.id,
      hostId: socket.id,
      players: serializePlayers(rooms[code]),
    });
  });

  socket.on('joinRoom', ({ playerName, code }) => {
    const room = rooms[code];
    if (!room) { socket.emit('joinError', 'Room not found. Check your code.'); return; }
    if (room.status !== 'lobby') { socket.emit('joinError', 'Game already in progress.'); return; }

    room.players.push({ id: socket.id, name: playerName, mission: null, missionCompleted: false, completedAt: null });
    socket.join(code);
    socket.data.roomCode = code;

    socket.emit('joinedRoom', {
      code,
      playerId: socket.id,
      hostId: room.hostId,
      players: serializePlayers(room),
    });

    socket.to(code).emit('lobbyUpdate', {
      players: serializePlayers(room),
      hostId: room.hostId,
    });
  });

  socket.on('startGame', ({ code }) => {
    const room = rooms[code];
    if (!room || room.hostId !== socket.id || room.status !== 'lobby') return;
    if (room.players.length < 2) {
      socket.emit('startError', 'Need at least 2 players to start!');
      return;
    }

    room.status = 'playing';

    const shuffled = [...MISSIONS].sort(() => Math.random() - 0.5);
    room.players.forEach((p, i) => { p.mission = shuffled[i % shuffled.length]; });

    room.players.forEach(p => {
      io.to(p.id).emit('gameStarted', {
        mission: p.mission,
        players: room.players.map(pl => ({ id: pl.id, name: pl.name, missionCompleted: pl.missionCompleted })),
      });
    });
  });

  socket.on('completeMission', ({ code }) => {
    const room = rooms[code];
    if (!room || room.status !== 'playing') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.missionCompleted) return;

    player.missionCompleted = true;
    player.completedAt = Date.now();

    io.to(code).emit('missionUpdate', {
      completedPlayerId: player.id,
      completedPlayerName: player.name,
      players: room.players.map(p => ({ id: p.id, name: p.name, missionCompleted: p.missionCompleted })),
    });
  });

  socket.on('getResults', ({ code }) => {
    const room = rooms[code];
    if (!room) return;

    socket.emit('resultsData', {
      players: room.players.map(p => ({
        id: p.id,
        name: p.name,
        mission: p.mission,
        missionCompleted: p.missionCompleted,
        completedAt: p.completedAt,
      })),
    });
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    if (!code || !rooms[code]) return;

    const room = rooms[code];
    room.players = room.players.filter(p => p.id !== socket.id);

    if (room.players.length === 0) {
      delete rooms[code];
      return;
    }

    if (room.hostId === socket.id) {
      room.hostId = room.players[0].id;
      io.to(room.hostId).emit('youAreHost');
    }

    io.to(code).emit('lobbyUpdate', {
      players: serializePlayers(room),
      hostId: room.hostId,
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🕵️  Undercover running at http://localhost:${PORT}`);
});
