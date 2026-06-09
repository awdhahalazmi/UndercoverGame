'use client';

const AV_COLORS = [
  '#E27439','#1D2A44','#78B9D6','#9B59B6','#2ECC71',
  '#E74C3C','#F39C12','#1ABC9C','#3498DB','#E91E63',
];
function avColor(name) {
  return AV_COLORS[name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length];
}
function avInit(name) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

export default function LobbyView({
  roomCode, players, playerId, hostId,
  startError, onCopyCode, onStartGame,
}) {
  const isHost = playerId === hostId;
  const count = players.length;

  return (
    <div className="screen">
      {/* Room code chip */}
      <div className="code-chip-wrap">
        <span className="code-chip-label">ROOM CODE</span>
        <button className="code-chip" onClick={onCopyCode}>
          {roomCode || '----'}
        </button>
        <span className="code-chip-hint">Tap to copy &amp; share</span>
      </div>

      <div className="screen-head" style={{ marginTop: '4px' }}>
        <h2>Waiting Room</h2>
        <p>{count === 1 ? '1 player joined' : `${count} players joined`}</p>
      </div>

      {/* Player grid */}
      <div className="player-grid">
        {count === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">👥</span>
            <p className="empty-state-text">Waiting for players…</p>
          </div>
        ) : players.map(p => (
          <div key={p.id} className="player-card">
            <div className="av" style={{ background: avColor(p.name) }}>
              {avInit(p.name)}
            </div>
            <div className="pc-name">{p.name}</div>
            {p.id === hostId   && <div className="pc-host">HOST</div>}
            {p.id === playerId && <div className="pc-you">YOU</div>}
          </div>
        ))}
      </div>

      {startError && <div className="err">{startError}</div>}

      {/* CTA */}
      <div id="lobby-cta">
        {isHost ? (
          <button className="btn btn-orange btn-xl" onClick={onStartGame}>
            Start Game 🚀
          </button>
        ) : (
          <div className="waiting-pill">
            <div className="dots"><span /><span /><span /></div>
            Waiting for host to start
          </div>
        )}
      </div>
    </div>
  );
}
