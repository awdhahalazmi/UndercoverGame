/* ═══════════════════════════════════════════
   UNDERCOVER — client (design-enhancement)
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
const AV_COLORS = [
  '#E27439','#1D2A44','#78B9D6','#9B59B6','#2ECC71',
  '#E74C3C','#F39C12','#1ABC9C','#3498DB','#E91E63',
];
function avColor(name) {
  return AV_COLORS[name.split('').reduce((a,c) => a + c.charCodeAt(0), 0) % AV_COLORS.length];
}
function avInit(name) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0,2) || '?';
}

// ── Escape HTML ─────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ══════════════════════════════════════════════════════════
// NAVIGATION — with entrance animation
// ══════════════════════════════════════════════════════════
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const next = document.getElementById(`view-${name}`);
  next.classList.add('active');
  // Force CSS animation to re-play on every navigation
  next.style.animation = 'none';
  void next.offsetHeight; // trigger reflow
  next.style.animation = '';
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// ── Toast ───────────────────────────────────────────────────
let _toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  // Restart animation so it always plays fresh
  el.style.animation = 'none';
  void el.offsetHeight;
  el.style.animation = '';
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

// ══════════════════════════════════════════════════════════
// BUTTON RIPPLE — delegated to all .btn clicks
// ══════════════════════════════════════════════════════════
document.addEventListener('click', e => {
  const btn = e.target.closest('.btn');
  if (!btn || btn.disabled) return;
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2.2;
  const ripple = document.createElement('span');
  ripple.className = 'btn-ripple';
  ripple.style.cssText = [
    `width:${size}px`,
    `height:${size}px`,
    `left:${e.clientX - rect.left - size / 2}px`,
    `top:${e.clientY - rect.top - size / 2}px`,
  ].join(';');
  btn.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
}, { passive: true });

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
  const chip = document.getElementById('room-code-display');
  chip.textContent = 'Copied! ✓';
  setTimeout(() => { chip.textContent = S.roomCode; }, 1400);
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

// Track which player IDs are already rendered so only new ones bounce in
const _renderedPids = new Set();

function renderPlayerGrid() {
  const grid  = document.getElementById('player-list');
  const count = S.players.length;
  document.getElementById('lobby-count').textContent =
    count === 1 ? '1 player' : `${count} players`;

  // Empty state
  if (!count) {
    _renderedPids.clear();
    grid.innerHTML = `<div class="empty-state">
      <span class="empty-state-icon">👥</span>
      <p class="empty-state-text">Waiting for players…</p>
    </div>`;
    return;
  }

  // Clear empty-state placeholder on first player
  if (grid.querySelector('.empty-state')) {
    _renderedPids.clear();
    grid.innerHTML = '';
  }

  // Remove cards for players who left
  Array.from(grid.querySelectorAll('[data-pid]')).forEach(card => {
    const pid = card.getAttribute('data-pid');
    if (!S.players.find(p => p.id === pid)) {
      card.style.animation = 'pop-out .22s ease forwards';
      setTimeout(() => { card.remove(); _renderedPids.delete(pid); }, 240);
    }
  });

  // Add / update player cards
  S.players.forEach(p => {
    const existing = Array.from(grid.querySelectorAll('[data-pid]'))
                          .find(el => el.getAttribute('data-pid') === p.id);
    const isHost = p.id === S.hostId;
    const isMe   = p.id === S.playerId;

    if (existing) {
      // Sync host badge only (name never changes)
      let hostBadge = existing.querySelector('.pc-host');
      if (isHost && !hostBadge) {
        existing.insertAdjacentHTML('beforeend', '<div class="pc-host">HOST 👑</div>');
      } else if (!isHost && hostBadge) {
        hostBadge.remove();
      }
    } else {
      // New player → bounce-in animation
      const c = avColor(p.name), i = avInit(p.name);
      const card = document.createElement('div');
      card.className = 'player-card new-arrival';
      card.setAttribute('data-pid', p.id);
      card.innerHTML = `
        <div class="av" style="background:${c}">${i}</div>
        <div class="pc-name">${esc(p.name)}</div>
        ${isHost ? '<div class="pc-host">HOST 👑</div>' : ''}
        ${isMe   ? '<div class="pc-you">YOU ✨</div>'   : ''}
      `;
      grid.appendChild(card);
      card.addEventListener('animationend', () => card.classList.remove('new-arrival'), { once: true });
      _renderedPids.add(p.id);
    }
  });
}

// ════════════════════════════════════════════
// MISSION
// ════════════════════════════════════════════
document.getElementById('mission-card').onclick = () => { if (!S.missionRevealed) revealMission(); };
document.getElementById('btn-reveal').onclick    = () => revealMission();

function revealMission() {
  if (S.missionRevealed) return;
  S.missionRevealed = true;
  const card = document.getElementById('mission-card');
  card.classList.add('revealed');
  document.getElementById('btn-reveal').classList.add('hidden');
  // Show complete button after flip animation (≈500ms)
  setTimeout(() => {
    document.getElementById('btn-complete').classList.remove('hidden');
  }, 520);
}

document.getElementById('btn-complete').onclick = () => {
  if (S.missionCompleted) return;
  S.missionCompleted = true;
  socket.emit('completeMission', { code: S.roomCode });
  document.getElementById('btn-complete').classList.add('hidden');
  document.getElementById('submitted-state').classList.remove('hidden');
  // results arrive via gameEnded broadcast from server
};

function renderMissionView() {
  document.getElementById('mission-player-name').textContent = S.playerName;
  document.getElementById('mission-text').textContent = S.mission;
  S.missionRevealed  = false;
  S.missionCompleted = false;
  // Reset card state
  const card = document.getElementById('mission-card');
  card.classList.remove('revealed');
  card.style.animation = 'none';
  void card.offsetHeight;
  card.style.animation = '';
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
      <div class="agent-name">${esc(p.name)}${me ? ' <span style="color:var(--blue);font-size:11px">(you)</span>' : ''}</div>
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
  const isMe = winner.id === S.playerId;

  return `
    <div class="winner-wrap">
      <div class="w-crown">👑</div>
      <div class="w-avatar" style="background:${wc}">${wi}</div>
      <div class="w-name">${esc(winner.name)} Wins!</div>

      ${isMe ? '<div style="color:var(--orange-l);font-size:14px;font-weight:800;margin:-14px 0 14px;animation:fade-in .4s ease .6s both">🎉 That\'s you!</div>' : ''}

      <div class="w-mission-box">
        <div class="w-mission-label">THEIR MISSION WAS</div>
        <div class="w-mission-text">${esc(winner.mission)}</div>
        <div class="w-mission-done">✅ Completed!</div>
      </div>

      <div class="vs-divider" style="margin:20px 0 16px"><span class="vs-txt">VS</span></div>

      <div class="w-loser">
        <div class="av" style="background:${lc}">${li}</div>
        <div class="w-loser-info">
          <div class="w-loser-name">${esc(loser.name)}</div>
          <div class="w-loser-mission">"${esc(loser.mission)}"</div>
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
          ${isWinner ? '<div style="font-size:22px;margin-bottom:2px;animation:crown-drop .55s cubic-bezier(.34,1.56,.64,1) .2s both">👑</div>' : ''}
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
    return `<div class="mission-row" style="animation-delay:${idx * .09}s">
      <div class="mr-av" style="background:${c}">${i}</div>
      <div class="mr-body">
        <div class="mr-name">
          ${esc(p.name)}
          ${me ? '<span style="color:var(--blue);font-size:11px;font-weight:800"> YOU</span>' : ''}
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
  const colors = ['#E27439','#FFD700','#F9F7F3','#78B9D6','#22c55e','#fff','#9B59B6','#F08A50'];
  const go = opts => confetti({ colors, zIndex: 9999, ...opts });

  // Opening burst from center
  go({ particleCount: 100, spread: 75, origin: { y: 0.35 } });

  // Side cannons
  setTimeout(() => {
    go({ angle: 55,  spread: 68, particleCount: 65, origin: { x: 0,  y: 0.62 } });
    go({ angle: 125, spread: 68, particleCount: 65, origin: { x: 1,  y: 0.62 } });
  }, 300);

  // Shower from top
  setTimeout(() => {
    go({ particleCount: 160, spread: 170, origin: { y: 0 }, gravity: 1.2, ticks: 460 });
  }, 700);

  // Final sparkle
  setTimeout(() => {
    go({ particleCount: 80, spread: 90, origin: { y: 0.42 }, shapes: ['circle', 'square'] });
  }, 1200);
}

// Play Again
document.getElementById('btn-play-again').onclick = () => {
  Object.assign(S, {
    playerId: null, playerName: null, roomCode: null, hostId: null,
    players: [], mission: null, missionRevealed: false, missionCompleted: false,
  });
  _renderedPids.clear();
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
  _renderedPids.clear();
  renderLobby();
  showView('lobby');
});

socket.on('joinedRoom', ({ code, playerId, hostId, players }) => {
  Object.assign(S, { playerId, roomCode: code, hostId, players });
  _renderedPids.clear();
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
  S.isHost = true;
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
  S.players = players;
  renderResults(players, winnerId);
  showView('results');
  setTimeout(launchConfetti, 380);

  const winner = players.find(p => p.id === winnerId);
  if (winner && winner.id !== S.playerId) {
    toast(`🎉 ${winner.name} completed their mission!`);
  }
});

socket.on('disconnect', () => toast('Connection lost… 📡'));
socket.on('connect',    () => { if (S.roomCode) toast('Reconnected! 🔄'); });
