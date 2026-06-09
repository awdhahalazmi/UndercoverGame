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

// ── 2-player winner screen ──────────────────────────────────
function TwoPlayerResult({ sorted }) {
  const winner = sorted[0];
  const loser  = sorted[1];
  return (
    <div className="winner-wrap">
      <div className="w-crown">👑</div>
      <div className="w-avatar" style={{ background: avColor(winner.name) }}>
        {avInit(winner.name)}
      </div>
      <div className="w-name">{winner.name} Wins!</div>

      <div className="w-mission-box">
        <div className="w-mission-label">THEIR MISSION WAS</div>
        <div className="w-mission-text">{winner.mission}</div>
        <div className="w-mission-done">✅ Completed!</div>
      </div>

      <div className="vs-divider">
        <span className="vs-txt">VS</span>
      </div>

      <div className="w-loser">
        <div className="av" style={{ background: avColor(loser.name) }}>
          {avInit(loser.name)}
        </div>
        <div className="w-loser-info">
          <div className="w-loser-name">{loser.name}</div>
          <div className="w-loser-mission">{loser.mission}</div>
        </div>
        <div className="w-loser-status">❌</div>
      </div>
    </div>
  );
}

// ── Podium screen (3+ players) ──────────────────────────────
function PodiumResult({ sorted, playerId }) {
  const p1 = sorted[0];
  const p2 = sorted[1];
  const p3 = sorted[2] || null;

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

  return (
    <>
      <div className="podium-wrap">
        <div className="podium-heading">
          <span className="podium-trophy">🏆</span>
          <div className="podium-win-label">{p1.name} Wins!</div>
          <div className="podium-win-sub">First to complete the mission</div>
        </div>
        <div className="podium-stage">
          {slots.map(({ player, barClass, medal, pos, isWinner }) => (
            <div key={player.id} className="podium-col">
              <div className="podium-player-wrap">
                <div
                  className={`podium-av${isWinner ? ' is-winner' : ''}`}
                  style={{ background: avColor(player.name) }}
                >
                  {avInit(player.name)}
                </div>
                <div className={`podium-pname${isWinner ? ' is-winner' : ''}`}>
                  {player.name}
                </div>
              </div>
              <div className={`podium-bar ${barClass}`}>
                <div className="bar-medal">{medal}</div>
                <div className="bar-pos">{pos}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="missions-section">
        <div className="missions-title">MISSIONS REVEALED</div>
        {sorted.map((p, idx) => (
          <div
            key={p.id}
            className="mission-row"
            style={{ animationDelay: `${idx * 0.08}s` }}
          >
            <div className="mr-av" style={{ background: avColor(p.name) }}>
              {avInit(p.name)}
            </div>
            <div className="mr-body">
              <div className="mr-name">
                {p.name}
                {p.id === playerId && (
                  <span style={{ color: 'var(--blue)', fontSize: '11px' }}> YOU</span>
                )}
                <span className="mr-rank"> #{p.rank}</span>
              </div>
              <div className="mr-mission">{p.mission}</div>
            </div>
            <div className="mr-icon">{p.missionCompleted ? '✅' : '❌'}</div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Main Results view ───────────────────────────────────────
export default function ResultsView({ players, playerId, onPlayAgain }) {
  const sorted = [...players].sort((a, b) => a.rank - b.rank);

  return (
    <div className="results-scroll">
      {sorted.length === 2
        ? <TwoPlayerResult sorted={sorted} />
        : <PodiumResult sorted={sorted} playerId={playerId} />
      }
      <button className="btn btn-orange btn-xl" onClick={onPlayAgain}>
        Play Again 🕵️
      </button>
    </div>
  );
}
