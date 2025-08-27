const socket = io();
let currentRoom = null;
let playerName = null;

document.getElementById('joinBtn').onclick = () => {
  const roomCode = document.getElementById('roomCode').value;
  playerName = document.getElementById('playerName').value;
  socket.emit('joinRoom', { roomCode, playerName });
  currentRoom = roomCode;
  document.getElementById('lobby').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  document.getElementById('roomTitle').textContent = 'Room ' + roomCode;
};

document.getElementById('submitBtn').onclick = () => {
  const entry = document.getElementById('entryInput').value;
  socket.emit('submitEntry', { roomCode: currentRoom, entry });
  document.getElementById('entryInput').value = '';
};

socket.on('roomUpdate', (room) => {
  document.getElementById('players').textContent =
    'Players: ' + room.players.map(p => p.name).join(', ');
  const currentPlayer = room.players[room.currentTurn];
  document.getElementById('turn').textContent = "It's " + currentPlayer.name + "'s turn.";
});

socket.on('sentenceComplete', (entries) => {
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '<h3>Sentence Complete!</h3>';
  for (const [player, text] of Object.entries(entries)) {
    resultsDiv.innerHTML += `<p><b>${player}</b>: ${text}</p>`;
  }
});