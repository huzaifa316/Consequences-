import React from 'react';

export default function PlayerList({ players, currentIndex }) {
  return (
    <ul className="mb-2">
      {players.map((p,idx)=>(<li key={p.id} className={idx===currentIndex%players.length ? 'font-bold' : ''}>{p.name}</li>))}
    </ul>
  );
}
