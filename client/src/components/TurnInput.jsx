import React, { useState } from 'react';

export default function TurnInput({ room, socket }) {
  const [text, setText] = useState('');
  const currentPlayer = room.players[room.currentIndex % room.players.length];
  const myId = socket.id;

  if (currentPlayer.id !== myId) return <div>Waiting for {currentPlayer.name}...</div>;

  const submit = () => { socket.emit('turn:submit',{code:room.code,text}); setText(''); };

  return (
    <div className="mt-2">
      <h2 className="text-lg font-semibold">{room.headings[room.currentIndex]}</h2>
      <input value={text} onChange={e=>setText(e.target.value)} placeholder="Enter text" className="border p-1 w-full" />
      <button onClick={submit} className="bg-green-500 text-white p-2 mt-2 rounded">Submit</button>
    </div>
  );
}
