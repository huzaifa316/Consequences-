const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

let rooms = {};

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('joinRoom', ({ roomCode, playerName }) => {
    socket.join(roomCode);
    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        players: [],
        currentSentence: [],
        turn: 0,
        stage: 0
      };
    }

    rooms[roomCode].players.push({ id: socket.id, name: playerName });
    io.to(roomCode).emit('playersUpdate', rooms[roomCode].players);

    if (rooms[roomCode].players.length === 1) {
      io.to(roomCode).emit('gameMessage', 'Waiting for more players...');
    }
  });

  socket.on('submitPart', ({ roomCode, text }) => {
    const room = rooms[roomCode];
    if (!room) return;

    room.currentSentence.push(text);
    room.stage++;

    if (room.stage === 5) {
      io.to(roomCode).emit('revealSentence', room.currentSentence);
      room.currentSentence = [];
      room.stage = 0;
    } else {
      io.to(roomCode).emit('nextTurn', room.stage);
    }
  });

  socket.on('disconnect', () => {
    console.log('a user disconnected');
    for (let code in rooms) {
      rooms[code].players = rooms[code].players.filter(p => p.id !== socket.id);
      io.to(code).emit('playersUpdate', rooms[code].players);
    }
  });
});

http.listen(PORT, () => {
  console.log('listening on *:' + PORT);
});
