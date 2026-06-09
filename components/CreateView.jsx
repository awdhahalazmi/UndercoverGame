'use client';

import { useState } from 'react';

export default function CreateView({ onBack, onCreate }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleCreate = () => {
    if (!name.trim()) {
      setError('Please enter your name!');
      setTimeout(() => setError(''), 3500);
      return;
    }
    onCreate(name.trim());
  };

  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>← Back</button>

      <div className="screen-head">
        <div className="screen-icon">🏠</div>
        <h2>Create Room</h2>
        <p>Enter your name to get started</p>
      </div>

      <div className="field">
        <label htmlFor="create-name">YOUR NAME</label>
        <input
          id="create-name"
          type="text"
          placeholder="e.g. Layla"
          maxLength={20}
          autoComplete="off"
          autoCorrect="off"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
        />
      </div>

      {error && <div className="err">{error}</div>}

      <button className="btn btn-orange btn-xl" onClick={handleCreate}>
        Create Room 🚀
      </button>
    </div>
  );
}
