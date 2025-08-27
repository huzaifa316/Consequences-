
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { randomBytes } from "crypto";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

// Store rooms in memory
const rooms = {};

// Helper: generate a unique 4-letter room code
function generateRoomCode() {
  let code;
  do {
    code = randomBytes(2).toString("hex").toUpperCase();
  } while (rooms[code]);
  return code;
}

io.on("connection", (socket) => {
  let currentRoom = null;
  let playerName = null;

  socket.on("createRoom", (name, callback) => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = {
      players: {},
      gameStarted: false,
      turnIndex: 0,
      contributions: [],
    };
    currentRoom = roomCode;
    playerName = name;
    rooms[roomCode].players[socket.id] = { name, lastPing: Date.now() };
    socket.join(roomCode);
    callback({ roomCode });
    io.to(roomCode).emit("updatePlayers", Object.values(rooms[roomCode].players));
  });

  socket.on("joinRoom", (roomCode, name, callback) => {
    if (!rooms[roomCode]) {
      callback({ error: "Room does not exist." });
      return;
    }
    const room = rooms[roomCode];
    if (Object.keys(room.players).length >= 5) {
      callback({ error: "Room is full (max 5 players)." });
      return;
    }
    currentRoom = roomCode;
    playerName = name;
    room.players[socket.id] = { name, lastPing: Date.now() };
    socket.join(roomCode);
    callback({ success: true });
    io.to(roomCode).emit("updatePlayers", Object.values(room.players));
  });

  socket.on("startGame", () => {
    const room = rooms[currentRoom];
    if (!room) return;
    const playerCount = Object.keys(room.players).length;
    if (playerCount < 2) {
      socket.emit("errorMessage", "At least 2 players required to start.");
      return;
    }
    room.gameStarted = true;
    room.turnIndex = 0;
    room.contributions = [];
    io.to(currentRoom).emit("gameStarted");
    io.to(currentRoom).emit("nextTurn", getCurrentPlayer(room));
  });

  socket.on("submitContribution", (text) => {
    const room = rooms[currentRoom];
    if (!room) return;
    room.contributions.push({ player: playerName, text });
    room.turnIndex++;
    if (room.turnIndex >= Object.keys(room.players).length * 5) {
      // Game complete → reveal
      io.to(currentRoom).emit("sentenceComplete", room.contributions);
      room.gameStarted = false;
    } else {
      io.to(currentRoom).emit("nextTurn", getCurrentPlayer(room));
    }
  });

  socket.on("disconnect", () => {
    if (!currentRoom || !rooms[currentRoom]) return;
    const room = rooms[currentRoom];
    delete room.players[socket.id];
    io.to(currentRoom).emit("updatePlayers", Object.values(room.players));
    if (Object.keys(room.players).length === 0) {
      delete rooms[currentRoom];
    }
  });
});

function getCurrentPlayer(room) {
  const playerIds = Object.keys(room.players);
  const playerIndex = room.turnIndex % playerIds.length;
  return room.players[playerIds[playerIndex]].name;
}

httpServer.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
