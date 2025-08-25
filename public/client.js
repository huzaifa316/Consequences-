const socket = io();
let roomCode = '';
let playerName = '';
let stage = 0;

const prompts = ['Who', 'What', 'Where', 'When', 'With whom'];

function joinRoom() {
  roomCode = document.getElementById('roomCode').value;
  playerName = document.getElementById('playerName').value;
  if (!roomCode || !playerName) return alert('Enter room code and name');

  socket.emit('joinRoom', { roomCode, playerName });
  document.getElementById('join').style.display = 'none';
  document.getElementById('game').style.display = 'block';
  document.getElementById('prompt').innerText = prompts[0];
}

function submitPart() {
  const text = document.getElementById('response').value;
  if (!text) return;
  socket.emit('submitPart', { roomCode, text });
  document.getElementById('response').value = '';
}

socket.on('nextTurn', (nextStage) => {
  stage = nextStage;
  document.getElementById('prompt').innerText = prompts[stage];
});

socket.on('revealSentence', (parts) => {
  document.getElementById('game').style.display = 'none';
  document.getElementById('sentence').style.display = 'block';
  document.getElementById('sentenceText').innerText =
    `${prompts[0]}: ${parts[0]}\n${prompts[1]}: ${parts[1]}\n${prompts[2]}: ${parts[2]}\n${prompts[3]}: ${parts[3]}\n${prompts[4]}: ${parts[4]}`;
});

function newRound() {
  document.getElementById('sentence').style.display = 'none';
  document.getElementById('game').style.display = 'block';
  stage = 0;
  document.getElementById('prompt').innerText = prompts[0];
}
