import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static("public"));

const rooms = {};
const categories = ["Who", "What", "When", "Where", "With Whom"];

function createRoom(roomCode, hostName, socketId) {
  rooms[roomCode] = {
    host: socketId,
    players: [{ id: socketId, name: hostName }],
    currentTurn: 0,
    roundEntries: [],
    gameStarted: false,
  };
}

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("createRoom", ({ name }, callback) => {
    const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    createRoom(roomCode, name, socket.id);
    socket.join(roomCode);
    callback({ success: true, roomCode });
    io.to(roomCode).emit("updatePlayers", rooms[roomCode].players);
  });

  socket.on("joinRoom", ({ roomCode, name }, callback) => {
    const room = rooms[roomCode];
    if (!room) {
      callback({ success: false, message: "Room not found" });
      return;
    }
    if (room.players.length >= 5) {
      callback({ success: false, message: "Room is full" });
      return;
    }
    room.players.push({ id: socket.id, name });
    socket.join(roomCode);
    callback({ success: true });
    io.to(roomCode).emit("updatePlayers", room.players);
  });

  socket.on("startGame", ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return;
    if (room.players.length < 2) {
      io.to(socket.id).emit("errorMessage", "Need at least 2 players to start.");
      return;
    }
    room.gameStarted = true;
    room.currentTurn = 0;
    room.roundEntries = [];
    io.to(roomCode).emit("gameStarted");
    const currentPlayer = room.players[0];
    io.to(roomCode).emit("turnUpdate", {
      playerId: currentPlayer.id,
      category: categories[0],
    });
  });

  socket.on("submitEntry", ({ roomCode, text }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const turnIndex = room.currentTurn;
    const category = categories[turnIndex % 5];
    room.roundEntries.push({ category, text });

    if (room.roundEntries.length === 5) {
      // Round complete
      io.to(roomCode).emit("roundComplete", room.roundEntries);
      room.currentTurn = 0;
      room.roundEntries = [];
    } else {
      // Next turn
      room.currentTurn++;
      const nextPlayer = room.players[room.currentTurn % room.players.length];
      const nextCategory = categories[room.currentTurn % 5];
      io.to(roomCode).emit("turnUpdate", {
        playerId: nextPlayer.id,
        category: nextCategory,
      });
    }
  });

  socket.on("disconnect", () => {
    setTimeout(() => {
      for (const code in rooms) {
        const room = rooms[code];
        const idx = room.players.findIndex((p) => p.id === socket.id);
        if (idx !== -1) {
          room.players.splice(idx, 1);
          io.to(code).emit("updatePlayers", room.players);
          if (room.players.length === 0) {
            delete rooms[code];
          }
        }
      }
    }, 5000);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
