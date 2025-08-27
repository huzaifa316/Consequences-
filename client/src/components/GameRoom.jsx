import React, { useEffect, useState } from 'react';
import PlayerList from './PlayerList';
import TurnInput from './TurnInput';
import CompletedView from './CompletedView';

export default function GameRoom({ room: initialRoom, socket, leave }) {
  const [room, setRoom] = useState(initialRoom);

  useEffect(() => {
    socket.on('room:update', setRoom);
    socket.on('room:completed', setRoom);
    return () => { socket.off('room:update'); socket.off('room:completed'); };
  }, [socket]);

  if (room.status === 'completed') return <CompletedView room={room} leave={leave} />;
  if (room.status === 'stopped') return <div className="p-4"><h2>Game stopped (not enough players)</h2><button onClick={leave}>Back</button></div>;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Room {room.code}</h1>
      <PlayerList players={room.players} currentIndex={room.currentIndex} />
      {room.status==='waiting' && <button onClick={()=>socket.emit('room:start',{code:room.code})} className="bg-blue-500 text-white p-2 rounded">Start Game</button>}
      {room.status==='in-progress' && <TurnInput room={room} socket={socket} />}
      <button onClick={leave} className="mt-4 bg-red-500 text-white p-2 rounded">Leave Room</button>
    </div>
  );
}
