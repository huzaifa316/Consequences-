import React from 'react';

export default function CompletedView({ room, leave }) {
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-2">Completed Sentence</h1>
      <ul>
        {room.entries.map((e,idx)=>(<li key={idx}><b>{e.heading}:</b> {e.text}</li>))}
      </ul>
      <button onClick={leave} className="mt-4 bg-blue-500 text-white p-2 rounded">Back to Lobby</button>
    </div>
  );
}
