/* ═══════════════════════════════════════════
   UNDERCOVER — client
   ═══════════════════════════════════════════ */

// ── Thin WebSocket wrapper (mirrors Socket.IO API) ──────────
class GameSocket {
  constructor(url) {
    this._h = {};
    this._q = [];
    this.ws = new WebSocket(url);
    this.ws.onopen    = () => { this._q.forEach(m => this.ws.send(m)); this._q = []; };
    this.ws.onclose   = () => this._fire('disconnect');
    this.ws.onerror   = () => this._fire('disconnect');
    this.ws.onmessage = (e) => {
      const { type, ...data } = JSON.parse(e.data);
      this._fire(type, data);
    };
  }
  on(ev, fn) { (this._h[ev] = this._h[ev] || []).push(fn); }
  emit(type, data = {}) {
    const m = JSON.stringify({ type, ...data });
    this.ws.readyState === WebSocket.OPEN ? this.ws.send(m) : this._q.push(m);
  }
  _fire(ev, data) { (this._h[ev] || []).forEach(fn => fn(data)); }
}
const socket = new GameSocket(`ws://${location.hostname}:3001`);

// ── State ───────────────────────────────────────────────────
const S = {
  playerId: null, playerName: null,
  roomCode: null, hostId: null,
  players: [],
  isHost: false,
  mission: null,
  missionRevealed: false,
  missionCompleted: false,
};

// ── Avatar helpers ──────────────────────────────────────────
const AV_COLORS = ['#E27439','#1D2A44','#78B9D6','#9B59B6','#2ECC71',
                   '#E74C3C','#F39C12','#1ABC9C','#3498DB','#E91E63'];
function avColor(name) {
  return AV_COLORS[name.split('').reduce((a,c) => a + c.charCodeAt(0), 0) % AV_COLORS.length];
}
function avInit(name) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0,2) || '?';
}

// ── Navigation ──────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Toast ───────────────────────────────────────────────────
let _toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.add('hidden'), 2800);
}

// ── Inline errors ───────────────────────────────────────────
function showErr(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3500);
}
function clearErr(id) {
  const el = document.getElementById(id);
  el.textContent = '';
  el.classList.add('hidden');
}

// ── Clipboard ───────────────────────────────────────────────
function copyText(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => _legacyCopy(text));
  } else { _legacyCopy(text); }
}
function _legacyCopy(text) {
  const el = Object.assign(document.createElement('textarea'), { value: text });
  el.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(el); el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}

// ── Escape HTML ─────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ════════════════════════════════════════════
// HOME
// ════════════════════════════════════════════
document.getElementById('btn-go-create').onclick = () => showView('create');
document.getElementById('btn-go-join').onclick   = () => showView('join');

// ════════════════════════════════════════════
// CREATE
// ════════════════════════════════════════════
document.getElementById('btn-back-create').onclick = () => showView('home');
document.getElementById('create-name').addEventListener('keypress', e => {
  if (e.key === 'Enter') document.getElementById('btn-create-room').click();
});
document.getElementById('btn-create-room').onclick = () => {
  const name = document.getElementById('create-name').value.trim();
  if (!name) { showErr('create-error', 'Please enter your name!'); return; }
  clearErr('create-error');
  S.playerName = name;
  socket.emit('createRoom', { playerName: name });
};

// ════════════════════════════════════════════
// JOIN
// ════════════════════════════════════════════
document.getElementById('btn-back-join').onclick = () => showView('home');
document.getElementById('join-code').addEventListener('input', e => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});
document.getElementById('join-name').addEventListener('keypress', e => {
  if (e.key === 'Enter') document.getElementById('join-code').focus();
});
document.getElementById('join-code').addEventListener('keypress', e => {
  if (e.key === 'Enter') document.getElementById('btn-join-room').click();
});
document.getElementById('btn-join-room').onclick = () => {
  const name = document.getElementById('join-name').value.trim();
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  if (!name) { showErr('join-error', 'Please enter your name!'); return; }
  if (code.length < 4) { showErr('join-error', 'Enter the 4-letter room code.'); return; }
  clearErr('join-error');
  S.playerName = name;
  socket.emit('joinRoom', { playerName: name, code });
};

// ════════════════════════════════════════════
// LOBBY
// ════════════════════════════════════════════
document.getElementById('room-code-display').onclick = () => {
  copyText(S.roomCode);
  toast('Code copied! 📋');
};
document.getElementById('btn-start-game').onclick = () => {
  if (S.players.length < 2) { showErr('start-error', 'Need at least 2 players!'); return; }
  clearErr('start-error');
  socket.emit('startGame', { code: S.roomCode });
};

function renderLobby() {
  document.getElementById('room-code-display').textContent = S.roomCode;
  renderPlayerGrid();
  const isHost = S.playerId === S.hostId;
  document.getElementById('btn-start-game').classList.toggle('hidden', !isHost);
  document.getElementById('waiting-msg').classList.toggle('hidden', isHost);
}

function renderPlayerGrid() {
  const grid = document.getElementById('player-list');
  const count = S.players.length;
  document.getElementById('lobby-count').textContent =
    count === 1 ? '1 player joined' : `${count} players joined`;

  if (!count) {
    grid.innerHTML = `<div class="empty-state">
      <span class="empty-state-icon">👥</span>
      <p class="empty-state-text">Waiting for players…</p></div>`;
    return;
  }
  grid.innerHTML = S.players.map(p => {
    const c = avColor(p.name), i = avInit(p.name);
    const me = p.id === S.playerId, host = p.id === S.hostId;
    return `<div class="player-card">
      <div class="av" style="background:${c}">${i}</div>
      <div class="pc-name">${esc(p.name)}</div>
      ${host ? '<div class="pc-host">HOST</div>' : ''}
      ${me   ? '<div class="pc-you">YOU</div>'   : ''}
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════
// MISSION
// ════════════════════════════════════════════
document.getElementById('mission-card').onclick = () => { if (!S.missionRevealed) revealMission(); };
document.getElementById('btn-reveal').onclick    = () => revealMission();

function revealMission() {
  if (S.missionRevealed) return;
  S.missionRevealed = true;
  document.getElementById('mission-card').classList.add('revealed');
  document.getElementById('btn-reveal').classList.add('hidden');
  setTimeout(() => document.getElementById('btn-complete').classList.remove('hidden'), 420);
}

document.getElementById('btn-complete').onclick = () => {
  if (S.missionCompleted) return;
  S.missionCompleted = true;
  socket.emit('completeMission', { code: S.roomCode });
  document.getElementById('btn-complete').classList.add('hidden');
  document.getElementById('submitted-state').classList.remove('hidden');
  // results will arrive via gameEnded from server
};

function renderMissionView() {
  document.getElementById('mission-player-name').textContent = S.playerName;
  document.getElementById('mission-text').textContent = S.mission;
  S.missionRevealed  = false;
  S.missionCompleted = false;
  document.getElementById('mission-card').classList.remove('revealed');
  document.getElementById('btn-reveal').classList.remove('hidden');
  document.getElementById('btn-complete').classList.add('hidden');
  document.getElementById('submitted-state').classList.add('hidden');
  renderAgentStatuses();
}

function renderAgentStatuses() {
  document.getElementById('agent-statuses').innerHTML = S.players.map(p => {
    const c = avColor(p.name), i = avInit(p.name), me = p.id === S.playerId;
    return `<div class="agent-row">
      <div class="av-sm" style="background:${c}">${i}</div>
      <div class="agent-name">${esc(p.name)}${me ? ' (you)' : ''}</div>
      <div class="pill ${p.missionCompleted ? 'pill-done' : 'pill-active'}">
        ${p.missionCompleted ? '✓ Done' : 'Active'}
      </div>
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════
// RESULTS
// ════════════════════════════════════════════
function renderResults(players, winnerId) {
  const sorted = [...players].sort((a, b) => a.rank - b.rank);
  const winner = sorted[0];
  const container = document.getElementById('results-dynamic');

  if (players.length === 2) {
    container.innerHTML = render2Player(sorted);
  } else {
    container.innerHTML = renderPodium(sorted);
  }
}

// ── 2-player winner screen ──────────────────
function render2Player(sorted) {
  const winner = sorted[0];
  const loser  = sorted[1];
  const wc = avColor(winner.name), wi = avInit(winner.name);
  const lc = avColor(loser.name),  li = avInit(loser.name);

  return `
    <div class="winner-wrap">
      <div class="w-crown">👑</div>
      <div class="w-avatar" style="background:${wc}">${wi}</div>
      <div class="w-name">${esc(winner.name)} Wins!</div>

      <div class="w-mission-box">
        <div class="w-mission-label">THEIR MISSION WAS</div>
        <div class="w-mission-text">${esc(winner.mission)}</div>
        <div class="w-mission-done">✅ Completed!</div>
      </div>

      <div class="vs-divider"><span class="vs-txt">VS</span></div>

      <div class="w-loser">
        <div class="av" style="background:${lc}">${li}</div>
        <div class="w-loser-info">
          <div class="w-loser-name">${esc(loser.name)}</div>
          <div class="w-loser-mission">${esc(loser.mission)}</div>
        </div>
        <div class="w-loser-status">❌</div>
      </div>
    </div>`;
}

// ── Podium screen (3+ players) ──────────────
function renderPodium(sorted) {
  const p1 = sorted[0];
  const p2 = sorted[1];
  const p3 = sorted[2] || null;
  const rest = sorted.slice(3);

  // Podium order: 2nd · 1st · 3rd
  const slots = p3
    ? [
        { player: p2, barClass: 'bar-2', medal: '🥈', pos: '2nd', isWinner: false },
        { player: p1, barClass: 'bar-1', medal: '🥇', pos: '1st', isWinner: true  },
        { player: p3, barClass: 'bar-3', medal: '🥉', pos: '3rd', isWinner: false },
      ]
    : [
        { player: p2, barClass: 'bar-2', medal: '🥈', pos: '2nd', isWinner: false },
        { player: p1, barClass: 'bar-1', medal: '🥇', pos: '1st', isWinner: true  },
      ];

  const podiumCols = slots.map(({ player, barClass, medal, pos, isWinner }) => {
    const c = avColor(player.name), i = avInit(player.name);
    return `
      <div class="podium-col">
        <div class="podium-player-wrap">
          <div class="podium-av ${isWinner ? 'is-winner' : ''}" style="background:${c}">${i}</div>
          <div class="podium-pname ${isWinner ? 'is-winner' : ''}">${esc(player.name)}</div>
        </div>
        <div class="podium-bar ${barClass}">
          <div class="bar-medal">${medal}</div>
          <div class="bar-pos">${pos}</div>
        </div>
      </div>`;
  }).join('');

  const missionRows = sorted.map((p, idx) => {
    const c = avColor(p.name), i = avInit(p.name), me = p.id === S.playerId;
    return `<div class="mission-row" style="animation-delay:${idx * .08}s">
      <div class="mr-av" style="background:${c}">${i}</div>
      <div class="mr-body">
        <div class="mr-name">${esc(p.name)}${me ? ' <span style="color:var(--blue);font-size:11px">YOU</span>' : ''}
          <span class="mr-rank">#${p.rank}</span>
        </div>
        <div class="mr-mission">${esc(p.mission)}</div>
      </div>
      <div class="mr-icon">${p.missionCompleted ? '✅' : '❌'}</div>
    </div>`;
  }).join('');

  return `
    <div class="podium-wrap">
      <div class="podium-heading">
        <span class="podium-trophy">🏆</span>
        <div class="podium-win-label">${esc(p1.name)} Wins!</div>
        <div class="podium-win-sub">First to complete the mission</div>
      </div>
      <div class="podium-stage">${podiumCols}</div>
    </div>
    <div class="missions-section">
      <div class="missions-title">MISSIONS REVEALED</div>
      ${missionRows}
    </div>`;
}

// ── Confetti burst ──────────────────────────
function launchConfetti() {
  if (typeof confetti === 'undefined') return;
  const colors = ['#E27439','#FFD700','#F9F7F3','#78B9D6','#22c55e','#fff'];
  const go = opts => confetti({ colors, zIndex: 9999, ...opts });

  go({ particleCount: 90,  spread: 70,  origin: { y: 0.35 } });
  setTimeout(() => {
    go({ angle: 55,  spread: 65, particleCount: 55, origin: { x: 0,  y: 0.65 } });
    go({ angle: 125, spread: 65, particleCount: 55, origin: { x: 1,  y: 0.65 } });
  }, 320);
  setTimeout(() => {
    go({ particleCount: 130, spread: 150, origin: { y: 0 }, gravity: 1.1, ticks: 420 });
  }, 720);
}

// Play Again
document.getElementById('btn-play-again').onclick = () => {
  Object.assign(S, { playerId: null, playerName: null, roomCode: null, hostId: null,
    players: [], mission: null, missionRevealed: false, missionCompleted: false });
  ['create-name','join-name','join-code'].forEach(id => {
    document.getElementById(id).value = '';
  });
  showView('home');
};

// ════════════════════════════════════════════
// SOCKET EVENTS
// ════════════════════════════════════════════
socket.on('roomCreated', ({ code, playerId, hostId, players }) => {
  Object.assign(S, { playerId, roomCode: code, hostId, players });
  renderLobby();
  showView('lobby');
});

socket.on('joinedRoom', ({ code, playerId, hostId, players }) => {
  Object.assign(S, { playerId, roomCode: code, hostId, players });
  renderLobby();
  showView('lobby');
});

socket.on('lobbyUpdate', ({ players, hostId }) => {
  S.players = players;
  S.hostId  = hostId;
  if (document.getElementById('view-lobby').classList.contains('active')) renderLobby();
});

socket.on('youAreHost', () => {
  S.hostId = S.playerId;
  if (document.getElementById('view-lobby').classList.contains('active')) renderLobby();
  toast('You are now the host 👑');
});

socket.on('joinError',  ({ message }) => showErr('join-error',  message));
socket.on('startError', ({ message }) => showErr('start-error', message));

socket.on('gameStarted', ({ mission, players }) => {
  S.mission  = mission;
  S.players  = S.players.map(p => {
    const u = players.find(x => x.id === p.id);
    return u ? { ...p, missionCompleted: u.missionCompleted } : p;
  });
  renderMissionView();
  showView('mission');
});

socket.on('missionUpdate', ({ players }) => {
  S.players = S.players.map(p => {
    const u = players.find(x => x.id === p.id);
    return u ? { ...p, missionCompleted: u.missionCompleted } : p;
  });
  if (document.getElementById('view-mission').classList.contains('active')) renderAgentStatuses();
});

socket.on('gameEnded', ({ winnerId, players }) => {
  // Update local state with full player data (including missions)
  S.players = players;
  renderResults(players, winnerId);
  showView('results');
  setTimeout(launchConfetti, 450);

  const winner = players.find(p => p.id === winnerId);
  if (winner && winner.id !== S.playerId) {
    toast(`🎉 ${winner.name} completed their mission!`);
  }
});

socket.on('disconnect', () => toast('Connection lost…'));
socket.on('connect',    () => { if (S.roomCode) toast('Reconnected! 🔄'); });
