'use client';

import { useState, useEffect } from 'react';

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

export default function MissionView({ playerName, mission, players, playerId, onComplete }) {
  const [revealed, setRevealed] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Reset on new mission (new game round)
  useEffect(() => {
    setRevealed(false);
    setCompleted(false);
  }, [mission]);

  const handleReveal = () => {
    if (!revealed) setRevealed(true);
  };

  const handleComplete = () => {
    if (completed) return;
    setCompleted(true);
    onComplete();
  };

  return (
    <div className="screen mission-screen">
      {/* Identity label */}
      <div className="mission-who">
        <span className="mission-who-label">YOUR MISSION</span>
        <span className="mission-who-name">{playerName}</span>
      </div>

      {/* 3-D flip card */}
      <div className="card-scene">
        <div
          className={`flip-card${revealed ? ' revealed' : ''}`}
          onClick={handleReveal}
        >
          <div className="flip-inner">
            {/* Front: classified */}
            <div className="flip-front">
              <div className="flip-front-glow" />
              <div className="fc-lock">🔒</div>
              <div className="fc-title">Mission<br />Classified</div>
              <div className="fc-hint">Tap to reveal</div>
            </div>
            {/* Back: mission text */}
            <div className="flip-back">
              <div className="fb-label">OBJECTIVE</div>
              <div className="fb-text">{mission}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mission-actions">
        {!revealed && (
          <button className="btn btn-orange btn-xl" onClick={handleReveal}>
            Tap to Reveal 👁️
          </button>
        )}
        {revealed && !completed && (
          <button className="btn btn-green btn-xl" onClick={handleComplete}>
            Mission Complete ✅
          </button>
        )}
        {completed && (
          <div className="submitted-state">
            <div className="submitted-icon">🎯</div>
            <div className="submitted-text">Mission Submitted!</div>
            <div className="submitted-sub">Waiting for results…</div>
            <div className="submitted-dots">
              <span /><span /><span />
            </div>
          </div>
        )}
      </div>

      {/* Agent tracker */}
      <div className="agent-panel">
        <div className="agent-panel-title">AGENT STATUS</div>
        {players.map(p => (
          <div key={p.id} className="agent-row">
            <div className="av-sm" style={{ background: avColor(p.name) }}>
              {avInit(p.name)}
            </div>
            <div className="agent-name">
              {p.name}{p.id === playerId ? ' (you)' : ''}
            </div>
            <div className={`pill ${p.missionCompleted ? 'pill-done' : 'pill-active'}`}>
              {p.missionCompleted ? '✓ Done' : 'Active'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
