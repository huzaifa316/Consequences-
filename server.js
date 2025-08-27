const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {};

io.on('connection', (socket) => {
  console.log('New connection', socket.id);

  socket.on('joinRoom', ({ roomCode, playerName }) => {
    if (!rooms[roomCode]) {
      rooms[roomCode] = { players: [], currentTurn: 0, round: 0, entries: {}, lastActive: Date.now() };
    }

    const room = rooms[roomCode];
    const player = { id: socket.id, name: playerName };
    room.players.push(player);
    room.lastActive = Date.now();

    socket.join(roomCode);
    io.to(roomCode).emit('roomUpdate', room);
  });

  socket.on('submitEntry', ({ roomCode, entry }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const currentPlayer = room.players[room.currentTurn];
    room.entries[currentPlayer.name] = entry;

    // Move turn forward
    room.currentTurn = (room.currentTurn + 1) % room.players.length;

    // If all players submitted
    if (Object.keys(room.entries).length === room.players.length) {
      io.to(roomCode).emit('sentenceComplete', room.entries);
      room.entries = {};
      room.currentTurn = 0;
    } else {
      io.to(roomCode).emit('roomUpdate', room);
    }
  });

  socket.on('disconnect', () => {
    console.log('Disconnected', socket.id);
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        setTimeout(() => {
          const stillHere = io.sockets.adapter.rooms.get(roomCode)?.has(socket.id);
          if (!stillHere) {
            room.players.splice(playerIndex, 1);
            io.to(roomCode).emit('roomUpdate', room);
          }
        }, 5000);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server running on port ' + PORT));