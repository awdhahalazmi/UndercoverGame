'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import HomeView    from '@/components/HomeView';
import CreateView  from '@/components/CreateView';
import JoinView    from '@/components/JoinView';
import LobbyView   from '@/components/LobbyView';
import MissionView from '@/components/MissionView';
import ResultsView from '@/components/ResultsView';

// ── Avatar helpers (shared) ───────────────────────────────────
// (also used in view components; duplicated here for game state)

// ── Initial game state ────────────────────────────────────────
const INITIAL = {
  playerId:   null,
  playerName: null,
  roomCode:   null,
  hostId:     null,
  players:    [],
  mission:    null,
  winnerId:   null,
};

// ── Confetti burst ────────────────────────────────────────────
async function launchConfetti() {
  try {
    const { default: confetti } = await import('canvas-confetti');
    const colors = ['#E27439','#FFD700','#F9F7F3','#78B9D6','#22c55e','#fff'];
    const go = opts => confetti({ colors, zIndex: 9999, ...opts });

    go({ particleCount: 90, spread: 70, origin: { y: 0.35 } });
    setTimeout(() => {
      go({ angle: 55,  spread: 65, particleCount: 55, origin: { x: 0, y: 0.65 } });
      go({ angle: 125, spread: 65, particleCount: 55, origin: { x: 1, y: 0.65 } });
    }, 320);
    setTimeout(() => {
      go({ particleCount: 130, spread: 150, origin: { y: 0 }, gravity: 1.1, ticks: 420 });
    }, 720);
  } catch (_) {}
}

// ── Main component ─────────────────────────────────────────────
export default function GamePage() {
  const [view,       setView]       = useState('home');
  const [gs,         setGs]         = useState(INITIAL);
  const [joinError,  setJoinError]  = useState('');
  const [startError, setStartError] = useState('');
  const [toast,      setToast]      = useState('');

  const socketRef    = useRef(null);
  const toastTimer   = useRef(null);
  // Refs so closures inside useEffect always see latest values
  const playerIdRef  = useRef(null);
  const roomCodeRef  = useRef(null);

  // ── Toast helper ──────────────────────────────────────────
  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2800);
  }, []);

  // ── Socket setup (once on mount) ─────────────────────────
  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on('connect', () => {
      if (roomCodeRef.current) showToast('Reconnected! 🔄');
    });
    socket.on('disconnect', () => showToast('Connection lost…'));

    socket.on('roomCreated', ({ code, playerId, hostId, players }) => {
      playerIdRef.current = playerId;
      roomCodeRef.current = code;
      setGs(prev => ({ ...prev, playerId, roomCode: code, hostId, players }));
      setView('lobby');
    });

    socket.on('joinedRoom', ({ code, playerId, hostId, players }) => {
      playerIdRef.current = playerId;
      roomCodeRef.current = code;
      setGs(prev => ({ ...prev, playerId, roomCode: code, hostId, players }));
      setView('lobby');
    });

    socket.on('lobbyUpdate', ({ players, hostId }) => {
      setGs(prev => ({ ...prev, players, hostId }));
    });

    socket.on('youAreHost', () => {
      setGs(prev => ({ ...prev, hostId: prev.playerId }));
      showToast('You are now the host 👑');
    });

    socket.on('joinError', ({ message }) => {
      setJoinError(message);
      setTimeout(() => setJoinError(''), 3500);
    });

    socket.on('startError', ({ message }) => {
      setStartError(message);
      setTimeout(() => setStartError(''), 3500);
    });

    socket.on('gameStarted', ({ mission, players }) => {
      setGs(prev => ({
        ...prev,
        mission,
        players: prev.players.map(p => {
          const u = players.find(x => x.id === p.id);
          return u ? { ...p, missionCompleted: u.missionCompleted } : p;
        }),
      }));
      setView('mission');
    });

    socket.on('missionUpdate', ({ players }) => {
      setGs(prev => ({
        ...prev,
        players: prev.players.map(p => {
          const u = players.find(x => x.id === p.id);
          return u ? { ...p, missionCompleted: u.missionCompleted } : p;
        }),
      }));
    });

    socket.on('gameEnded', ({ winnerId, players }) => {
      const winner = players.find(p => p.id === winnerId);
      if (winner && winner.id !== playerIdRef.current) {
        showToast(`🎉 ${winner.name} completed their mission!`);
      }
      setGs(prev => ({ ...prev, players, winnerId }));
      setView('results');
      setTimeout(launchConfetti, 450);
    });

    return () => socket.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Emit helper ───────────────────────────────────────────
  const emit = (type, data = {}) => {
    socketRef.current?.emit(type, data);
  };

  // ── Action handlers ───────────────────────────────────────
  const handleCreateRoom = (name) => {
    setGs(prev => ({ ...prev, playerName: name }));
    emit('createRoom', { playerName: name });
  };

  const handleJoinRoom = (name, code) => {
    setGs(prev => ({ ...prev, playerName: name }));
    emit('joinRoom', { playerName: name, code });
  };

  const handleCopyCode = () => {
    if (gs.roomCode) {
      navigator.clipboard?.writeText(gs.roomCode).catch(() => {
        const el = Object.assign(document.createElement('textarea'), { value: gs.roomCode });
        el.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      });
    }
    showToast('Code copied! 📋');
  };

  const handleStartGame = () => {
    if (gs.players.length < 2) {
      setStartError('Need at least 2 players!');
      setTimeout(() => setStartError(''), 3500);
      return;
    }
    emit('startGame', { code: gs.roomCode });
  };

  const handleCompleteMission = () => {
    emit('completeMission', { code: gs.roomCode });
  };

  const handlePlayAgain = () => {
    playerIdRef.current = null;
    roomCodeRef.current = null;
    setGs(INITIAL);
    setJoinError('');
    setStartError('');
    setView('home');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div id="app">
      {/* Toast notification */}
      {toast && <div className="toast">{toast}</div>}

      {view === 'home' && (
        <div className="view active">
          <HomeView
            onCreateRoom={() => setView('create')}
            onJoinRoom={() => setView('join')}
          />
        </div>
      )}

      {view === 'create' && (
        <div className="view active">
          <CreateView
            onBack={() => setView('home')}
            onCreate={handleCreateRoom}
          />
        </div>
      )}

      {view === 'join' && (
        <div className="view active">
          <JoinView
            onBack={() => setView('home')}
            onJoin={handleJoinRoom}
            serverError={joinError}
          />
        </div>
      )}

      {view === 'lobby' && (
        <div className="view active">
          <LobbyView
            roomCode={gs.roomCode}
            players={gs.players}
            playerId={gs.playerId}
            hostId={gs.hostId}
            startError={startError}
            onCopyCode={handleCopyCode}
            onStartGame={handleStartGame}
          />
        </div>
      )}

      {view === 'mission' && (
        <div className="view active">
          <MissionView
            playerName={gs.playerName}
            mission={gs.mission}
            players={gs.players}
            playerId={gs.playerId}
            onComplete={handleCompleteMission}
          />
        </div>
      )}

      {view === 'results' && (
        <div className="view active view-dark">
          <ResultsView
            players={gs.players}
            playerId={gs.playerId}
            onPlayAgain={handlePlayAgain}
          />
        </div>
      )}
    </div>
  );
}
