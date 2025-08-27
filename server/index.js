// server/index.js
// Express + Socket.IO server with disconnect handling
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const GameStore = require('./gameStore');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const store = new GameStore();

io.on('connection', (socket) => {
  console.log('New client connected', socket.id);

  // Create room
  socket.on('room:create', ({ name, maxPlayers }, callback) => {
    const room = store.createRoom(name, maxPlayers, socket.id);
    socket.join(room.code);
    callback(room);
    io.emit('rooms:update', store.listRooms());
  });

  // Join room
  socket.on('room:join', ({ code, name }, callback) => {
    const room = store.joinRoom(code, name, socket.id);
    if (room) {
      socket.join(room.code);
      io.to(room.code).emit('room:update', room);
      io.emit('rooms:update', store.listRooms());
      callback(room);
    }
  });

  // Start room
  socket.on('room:start', ({ code }) => {
    const room = store.startRoom(code, socket.id);
    if (room) {
      io.to(code).emit('room:update', room);
    }
  });

  // Submit entry
  socket.on('turn:submit', ({ code, text }) => {
    const room = store.submitEntry(code, socket.id, text);
    if (room) {
      if (room.status === 'completed') {
        io.to(code).emit('room:completed', room);
      } else {
        io.to(code).emit('room:update', room);
      }
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
    const affectedRooms = store.leaveAllRooms(socket.id);
    affectedRooms.forEach(room => {
      if (room.players.length < 2 && room.status === 'in-progress') {
        room.status = 'stopped';
      }
      io.to(room.code).emit('room:update', room);
      io.emit('rooms:update', store.listRooms());
    });
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
