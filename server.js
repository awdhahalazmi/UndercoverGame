const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

// ── Game data ─────────────────────────────────────────────────
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

// ── Shared state ──────────────────────────────────────────────
const rooms = {};

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 4 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  } while (rooms[code]);
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

// ── Boot Next.js + attach Socket.IO ──────────────────────────
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  const io = new Server(httpServer);

  io.on('connection', (socket) => {

    socket.on('createRoom', ({ playerName }) => {
      const name = String(playerName || '').trim().slice(0, 20);
      if (!name) return;

      const code = generateCode();
      socket.data.roomCode = code;

      rooms[code] = {
        code,
        hostId: socket.id,
        status: 'lobby',
        players: [{
          id: socket.id, name,
          mission: null, missionCompleted: false, completedAt: null,
        }],
      };

      socket.join(code);
      socket.emit('roomCreated', {
        code,
        playerId: socket.id,
        hostId: socket.id,
        players: serializePlayers(rooms[code]),
      });
    });

    socket.on('joinRoom', ({ playerName, code: rawCode }) => {
      const name = String(playerName || '').trim().slice(0, 20);
      const code = String(rawCode || '').toUpperCase().trim();
      const room = rooms[code];

      if (!room) {
        socket.emit('joinError', { message: 'Room not found. Check your code.' });
        return;
      }
      if (room.status !== 'lobby') {
        socket.emit('joinError', { message: 'Game already in progress.' });
        return;
      }

      socket.data.roomCode = code;
      room.players.push({
        id: socket.id, name,
        mission: null, missionCompleted: false, completedAt: null,
      });
      socket.join(code);

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
        socket.emit('startError', { message: 'Need at least 2 players to start!' });
        return;
      }

      room.status = 'playing';
      const shuffled = [...MISSIONS].sort(() => Math.random() - 0.5);
      room.players.forEach((p, i) => { p.mission = shuffled[i % shuffled.length]; });

      room.players.forEach(p => {
        io.to(p.id).emit('gameStarted', {
          mission: p.mission,
          players: room.players.map(pl => ({
            id: pl.id, name: pl.name, missionCompleted: pl.missionCompleted,
          })),
        });
      });
    });

    // First player to complete ends the game for everyone
    socket.on('completeMission', ({ code }) => {
      const room = rooms[code];
      if (!room || room.status !== 'playing') return;

      const player = room.players.find(p => p.id === socket.id);
      if (!player || player.missionCompleted) return;

      player.missionCompleted = true;
      player.completedAt = Date.now();
      room.status = 'ended';

      let rankCounter = 2;
      const playerData = room.players.map(p => ({
        id: p.id,
        name: p.name,
        mission: p.mission,
        missionCompleted: p.missionCompleted,
        completedAt: p.completedAt,
        rank: p.id === socket.id ? 1 : rankCounter++,
      }));

      io.to(code).emit('gameEnded', { winnerId: socket.id, players: playerData });
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

  httpServer.listen(port, () => {
    console.log(`\n🕵️  Undercover — Next.js + Socket.IO`);
    console.log(`   http://localhost:${port}\n`);
  });
});
