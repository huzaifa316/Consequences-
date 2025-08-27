import React, { useState } from 'react';
import Lobby from './components/Lobby';
import GameRoom from './components/GameRoom';

export default function App() {
  const [room, setRoom] = useState(null);
  const [socket, setSocket] = useState(null);

  return room ? (
    <GameRoom room={room} socket={socket} leave={() => { setRoom(null); setSocket(null); }} />
  ) : (
    <Lobby onJoin={(r, s) => { setRoom(r); setSocket(s); }} />
  );
}
