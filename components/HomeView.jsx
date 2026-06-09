'use client';

export default function HomeView({ onCreateRoom, onJoinRoom }) {
  return (
    <div className="home-bg">
      <div className="floating-emojis" aria-hidden="true">
        <span>🕵️</span>
        <span>👀</span>
        <span>🤫</span>
        <span>🎯</span>
        <span>🕵️</span>
      </div>
      <div className="home-content">
        <div className="logo-area">
          <div className="logo-icon">🕵️</div>
          <h1 className="logo-title">Undercover</h1>
          <p className="tagline">
            Complete your mission.<br />Don&apos;t get caught.
          </p>
        </div>
        <div className="home-cta">
          <button className="btn btn-orange btn-xl" onClick={onCreateRoom}>
            Create Room
          </button>
          <button className="btn btn-ghost btn-xl" onClick={onJoinRoom}>
            Join Room
          </button>
        </div>
      </div>
    </div>
  );
}
