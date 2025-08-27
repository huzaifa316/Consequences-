// client/src/components/Lobby.jsx
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io(import.meta.env.VITE_WS_URL || window.location.origin);

export default function Lobby({ onJoin }) {
  const [rooms, setRooms] = useState([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    socket.on('rooms:update', setRooms);
    socket.emit('rooms:update');
    return () => socket.off('rooms:update');
  }, []);

  const createRoom = () => {
    socket.emit('room:create', { name, maxPlayers: 5 }, (room) => onJoin(room, socket));
  };

  const joinRoom = () => {
    socket.emit('room:join', { code, name }, (room) => onJoin(room, socket));
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-2">Lobby</h1>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="border p-1 mb-2 w-full" />
      <button onClick={createRoom} className="bg-blue-500 text-white p-2 rounded mb-2 w-full">Create Room</button>
      <input value={code} onChange={e => setCode(e.target.value)} placeholder="Enter code" className="border p-1 mb-2 w-full" />
      <button onClick={joinRoom} className="bg-green-500 text-white p-2 rounded mb-2 w-full">Join Room</button>
      <h2 className="text-lg font-semibold mt-4">Active Games</h2>
      {rooms.map(r => (
        <div key={r.code} className="border p-2 my-1">
          {r.code} - {r.players.length} players - {r.status}
        </div>
      ))}
    </div>
  );
}
