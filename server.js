import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Serve static client
app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_, res) => res.status(200).send("ok"));
app.get("*", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

// ---- Game Logic ----
const CATEGORIES = ["who", "what", "where", "when", "withWhom"];
const LABELS = { who: "Who", what: "What", where: "Where", when: "When", withWhom: "With whom" };

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const rooms = new Map();
// Room shape:
// {
//   code, hostId,
//   started: false,
//   players: [{id, name}],
//   turnIndex: 0, // global step counter across the sentence (0..4 then reset)
//   current: { who:null, what:null, where:null, when:null, withWhom:null },
//   sentences: [ { who, what, where, when, withWhom } ]
// }

function createRoom(hostId, hostName) {
  let code = genCode();
  while (rooms.has(code)) code = genCode();
  const room = {
    code,
    hostId,
    started: false,
    players: [],
    turnIndex: 0,
    current: { who:null, what:null, where:null, withWhom:null, when:null },
    sentences: []
  };
  rooms.set(code, room);
  addPlayer(room, hostId, hostName);
  return room;
}

function addPlayer(room, id, name) {
  if (room.players.length >= 5) return false;
  const display = (name || "").toString().trim().slice(0,40) || `Player ${room.players.length+1}`;
  room.players.push({ id, name: display });
  return true;
}

function removePlayer(room, id) {
  const idx = room.players.findIndex(p => p.id === id);
  if (idx >= 0) {
    room.players[idx].name += " (left)";
    room.players[idx].id = `left-${Date.now()}-${Math.random()}`;
  }
}

function broadcastLobby(room) {
  io.to(room.code).emit("lobbyUpdate", {
    code: room.code,
    players: room.players.map(p => ({ name: p.name })),
    hostId: room.hostId,
    started: room.started
  });
}

function currentCategory(room) {
  return CATEGORIES[room.turnIndex % CATEGORIES.length];
}
function currentPlayer(room) {
  return room.players[room.turnIndex % room.players.length];
}

function advanceTurn(room) {
  room.turnIndex += 1;
  if (room.turnIndex % CATEGORIES.length === 0) {
    // sentence completed
    const s = { ...room.current };
    room.sentences.push(s);
    io.to(room.code).emit("sentenceComplete", {
      labels: LABELS, sentence: s, all: room.sentences
    });
    // reset for next sentence
    room.current = { who:null, what:null, where:null, when:null, withWhom:null };
    room.turnIndex = 0; // Always start next sentence at first player+who
  }
  // announce next turn
  const np = currentPlayer(room);
  const nc = currentCategory(room);
  io.to(room.code).emit("turnState", {
    category: nc, playerIndex: room.players.indexOf(np), playerName: np?.name || "Player"
  });
  io.to(np.id).emit("yourTurn", { category: nc });
}

io.on("connection", (socket) => {
  socket.data.name = "";

  socket.on("setName", (name) => {
    socket.data.name = (name || "").toString().slice(0,40);
  });

  socket.on("createRoom", () => {
    const room = createRoom(socket.id, socket.data.name);
    socket.join(room.code);
    socket.emit("roomCreated", room.code);
    broadcastLobby(room);
  });

  socket.on("joinRoom", (codeRaw) => {
    const code = String(codeRaw || "").toUpperCase();
    const room = rooms.get(code);
    if (!room) { socket.emit("errorMsg", "Room not found."); return; }
    if (room.started) { socket.emit("errorMsg", "Game already started."); return; }
    if (!addPlayer(room, socket.id, socket.data.name)) {
      socket.emit("errorMsg", "Room is full (max 5 players).");
      return;
    }
    socket.join(code);
    broadcastLobby(room);
  });

  socket.on("startGame", (codeRaw) => {
    const code = String(codeRaw || "").toUpperCase();
    const room = rooms.get(code);
    if (!room) return;
    if (socket.id !== room.hostId) return;
    if (room.players.length < 2) {
      socket.emit("errorMsg", "Need at least 2 players.");
      return;
    }
    room.started = true;
    room.turnIndex = 0;
    room.current = { who:null, what:null, where:null, when:null, withWhom:null };
    io.to(code).emit("gameStarted");
    // Announce first turn
    const p = currentPlayer(room);
    const c = currentCategory(room);
    io.to(code).emit("turnState", {
      category: c, playerIndex: room.players.indexOf(p), playerName: p.name
    });
    io.to(p.id).emit("yourTurn", { category: c });
  });

  socket.on("submitAnswer", ({ code: codeRaw, answer }) => {
    const code = String(codeRaw || "").toUpperCase();
    const room = rooms.get(code);
    if (!room || !room.started) return;
    const expectedPlayer = currentPlayer(room);
    const expectedCategory = currentCategory(room);
    if (socket.id !== expectedPlayer.id) {
      socket.emit("errorMsg", "Not your turn.");
      return;
    }
    const value = (answer || "").toString().trim().slice(0,140);
    room.current[expectedCategory] = value || "(blank)";
    // broadcast partial progress
    io.to(code).emit("partialUpdate", { labels: LABELS, current: room.current });
    // advance
    advanceTurn(room);
  });

  socket.on("disconnecting", () => {
    for (const code of socket.rooms) {
      const room = rooms.get(code);
      if (room) {
        removePlayer(room, socket.id);
        broadcastLobby(room);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
