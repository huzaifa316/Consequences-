// server/gameStore.js
const { nanoid } = require('nanoid');

class GameStore {
  constructor() { this.rooms = {}; }

  createRoom(hostName, maxPlayers, hostSocket) {
    const code = nanoid(6);
    this.rooms[code] = {
      code,
      players: [{ id: hostSocket, name: hostName }],
      host: hostSocket,
      maxPlayers,
      status: 'waiting',
      entries: [],
      currentIndex: 0,
      headings: ['Who', 'What', 'Where', 'When', 'With Whom']
    };
    return this.rooms[code];
  }

  joinRoom(code, name, socketId) {
    const room = this.rooms[code];
    if (!room || room.players.length >= room.maxPlayers || room.status !== 'waiting') return null;
    room.players.push({ id: socketId, name });
    return room;
  }

  startRoom(code, socketId) {
    const room = this.rooms[code];
    if (!room || room.host !== socketId || room.players.length < 2) return null;
    room.status = 'in-progress';
    room.currentIndex = 0;
    room.entries = [];
    return room;
  }

  submitEntry(code, socketId, text) {
    const room = this.rooms[code];
    if (!room) return null;
    const playerTurn = room.players[room.currentIndex % room.players.length];
    if (playerTurn.id !== socketId) return null;
    room.entries.push({ heading: room.headings[room.currentIndex], text, author: socketId });
    room.currentIndex++;
    if (room.currentIndex >= room.headings.length) { room.status = 'completed'; }
    return room;
  }

  leaveAllRooms(socketId) {
    const affectedRooms = [];
    Object.values(this.rooms).forEach(room => {
      const idx = room.players.findIndex(p => p.id === socketId);
      if (idx !== -1) {
        room.players.splice(idx, 1);
        affectedRooms.push(room);
      }
    });
    return affectedRooms;
  }

  listRooms() { return Object.values(this.rooms).slice(-5); }
}

module.exports = GameStore;
