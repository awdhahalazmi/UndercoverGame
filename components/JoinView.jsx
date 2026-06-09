'use client';

import { useState, useRef } from 'react';

export default function JoinView({ onBack, onJoin, serverError }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState('');
  const codeRef = useRef(null);

  const error = serverError || localError;

  const handleJoin = () => {
    if (!name.trim()) {
      setLocalError('Please enter your name!');
      setTimeout(() => setLocalError(''), 3500);
      return;
    }
    if (code.length < 4) {
      setLocalError('Enter the 4-letter room code.');
      setTimeout(() => setLocalError(''), 3500);
      return;
    }
    setLocalError('');
    onJoin(name.trim(), code.toUpperCase());
  };

  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>← Back</button>

      <div className="screen-head">
        <div className="screen-icon">🔑</div>
        <h2>Join Room</h2>
        <p>Get the code from your friend</p>
      </div>

      <div className="field">
        <label htmlFor="join-name">YOUR NAME</label>
        <input
          id="join-name"
          type="text"
          placeholder="e.g. Omar"
          maxLength={20}
          autoComplete="off"
          autoCorrect="off"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && codeRef.current?.focus()}
        />
      </div>

      <div className="field">
        <label htmlFor="join-code">ROOM CODE</label>
        <input
          id="join-code"
          ref={codeRef}
          type="text"
          placeholder="XXXX"
          maxLength={4}
          className="code-input"
          autoComplete="off"
          autoCapitalize="characters"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
        />
      </div>

      {error && <div className="err">{error}</div>}

      <button className="btn btn-orange btn-xl" onClick={handleJoin}>
        Join Room →
      </button>
    </div>
  );
}
