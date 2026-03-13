import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import StartScreen from './pages/StartScreen';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import Voting from './pages/Voting';
import Results from './pages/Results';
import LocalGame from './pages/LocalGame';
import { ToastProvider } from './context/ToastContext';

function App() {
  return (
    <BrowserRouter>
      {/* Animated Background Blobs */}
      <div className="bg-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      <ToastProvider>
        <Routes>
          <Route path="/" element={<StartScreen />} />
          <Route path="/lobby/:roomId" element={<Lobby />} />
          <Route path="/game/local" element={<LocalGame />} />
          <Route path="/game/:roomId" element={<Game />} />
          <Route path="/vote/:roomId" element={<Voting />} />
          <Route path="/results/:roomId" element={<Results />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
