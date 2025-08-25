
import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import xss from "xss";

const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const app = express();
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.get("/", (req, res) => {
  res.json({ ok: true, message: "Who/What/Where/When server running" });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CORS_ORIGIN, methods: ["GET", "POST"] }
});

// In-memory room store
const rooms = new Map(); // code -> room
const PROMPTS = ["Who", "What", "WithWhom", "Where", "When"];
const MAX_PUBLIC_LIST = 5;

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function sanitize(text) {
  // strip tags and trim, hard length cap
  const clean = xss(text || "", { whiteList: {}, stripIgnoreTag: true });
  return clean.substring(0, 120).trim();
}

// very light PG-13 filter (extensible)
const banned = ["fuck","shit","bitch","cunt","dick","cock","asshole","fag","slut","whore"];
function passesFilter(text) {
  const t = (text || "").toLowerCase();
  return !banned.some(b => t.includes(b));
}

function computeAssignments(playerIds, round) {
  const assigns = {}; // prompt -> playerId
  for (let i = 0; i < PROMPTS.length; i++) {
    const idx = (round + i) % playerIds.length;
    assigns[PROMPTS[i]] = playerIds[idx];
  }
  return assigns;
}

function roomSnapshot(room) {
  const { id, code, name, public: isPublic, maxPlayers, hostId, players, state, round, createdAt, updatedAt } = room;
  const snapshot = {
    id, code, name, public: isPublic, maxPlayers, hostId,
    players: players.map(p => ({ id: p.id, name: p.name, color: p.color, isHost: p.isHost, connected: p.connected })),
    state, round, createdAt, updatedAt,
  };
  if (room.state === "collecting") {
    const currentPrompt = PROMPTS.find(p => !room.submissions[p]);
    const currentPlayerId = room.assignments[currentPrompt];
    snapshot.active = { prompt: currentPrompt, playerId: currentPlayerId };
  } else {
    snapshot.active = null;
  }
  return snapshot;
}

function listPublicRooms() {
  const arr = Array.from(rooms.values())
    .filter(r => r.public && r.state !== "ended" && r.players.filter(p => p.connected).length < r.maxPlayers)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_PUBLIC_LIST)
    .map(r => ({
      code: r.code, name: r.name, players: r.players.filter(p => p.connected).length, maxPlayers: r.maxPlayers
    }));
  return arr;
}

io.on("connection", (socket) => {
  let currentRoomCode = null;
  let playerId = uuidv4();

  socket.on("room:create", (payload = {}) => {
    const {
      name = "",
      public: isPublic = true,
      maxPlayers = 5,
      filter = true
    } = payload;

    const code = randomCode();
    const room = {
      id: uuidv4(),
      code,
      name: name || `Room ${code}`,
      public: !!isPublic,
      maxPlayers: Math.min(5, Math.max(2, maxPlayers)),
      hostId: null,
      players: [],
      state: "lobby",
      round: 0,
      assignments: {},
      submissions: {},
      filter: !!filter,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastActiveAt: Date.now()
    };
    rooms.set(code, room);
    socket.emit("rooms:list", { rooms: listPublicRooms() });
  });

  socket.on("room:list", () => {
    socket.emit("rooms:list", { rooms: listPublicRooms() });
  });

  socket.on("room:join", (payload = {}) => {
    const { code, name, color } = payload;
    const room = rooms.get((code || "").toUpperCase());
    if (!room) return socket.emit("toast", { type: "error", message: "Room not found." });

    if (room.players.filter(p => p.connected).length >= room.maxPlayers) {
      return socket.emit("toast", { type: "error", message: "Room is full." });
    }

    const displayName = sanitize(name || "Player");
    const colorSafe = sanitize(color || "#6b7280");

    const player = {
      id: playerId,
      name: displayName or "Player",
      color: colorSafe,
      isHost: room.players.length === 0,
      connected: true,
      socketId: socket.id
    };
    if (room.hostId === null) room.hostId = player.id;

    room.players.push(player);
    room.updatedAt = Date.now();
    currentRoomCode = room.code;

    socket.join(room.code);
    io.to(room.code).emit("room:update", { room: roomSnapshot(room) });
  });

  socket.on("player:rename", (payload = {}) => {
    const room = rooms.get(currentRoomCode || "");
    if (!room) return;
    const p = room.players.find(p => p.id === playerId);
    if (!p) return;
    p.name = sanitize(payload.name || p.name);
    if (payload.color) p.color = sanitize(payload.color);
    room.updatedAt = Date.now();
    io.to(room.code).emit("room:update", { room: roomSnapshot(room) });
  });

  socket.on("game:start", () => {
    const room = rooms.get(currentRoomCode || "");
    if (!room) return;
    if (room.state !== "lobby") return;
    const connectedPlayers = room.players.filter(p => p.connected);
    if (connectedPlayers.length < 2) return socket.emit("toast", { type: "error", message: "Need at least 2 players." });

    room.state = "collecting";
    room.round = 0;
    room.submissions = {};
    room.assignments = computeAssignments(connectedPlayers.map(p => p.id), room.round);
    room.updatedAt = Date.now();

    io.to(room.code).emit("room:update", { room: roomSnapshot(room) });
    io.to(room.code).emit("turn:assigned", { prompt: PROMPTS[0], playerId: room.assignments[PROMPTS[0]], round: room.round });
  });

  socket.on("submission:send", (payload = {}) => {
    const room = rooms.get(currentRoomCode || "");
    if (!room || room.state !== "collecting") return;
    const { prompt, text } = payload;
    if (!PROMPTS.includes(prompt)) return;

    const assigned = room.assignments[prompt];
    if (assigned !== playerId) {
      return socket.emit("toast", { type: "error", message: "It's not your turn for this prompt." });
    }

    const cleaned = sanitize(text);
    if (!cleaned) return socket.emit("toast", { type: "error", message: "Please write something." });
    if (room.filter && !passesFilter(cleaned)) {
      return socket.emit("toast", { type: "error", message: "Please keep it PG‑13." });
    }

    if (room.submissions[prompt]) return; // already submitted
    room.submissions[prompt] = { prompt, playerId, text: cleaned, at: Date.now() };
    room.updatedAt = Date.now();

    // check if done
    const done = PROMPTS.every(p => !!room.submissions[p]);
    if (done) {
      room.state = "revealing";
      const sentence = {
        Who: room.submissions["Who"]?.text,
        What: room.submissions["What"]?.text,
        WithWhom: room.submissions["WithWhom"]?.text,
        Where: room.submissions["Where"]?.text,
        When: room.submissions["When"]?.text
      };
      io.to(room.code).emit("reveal:show", { sentence, round: room.round });
      io.to(room.code).emit("room:update", { room: roomSnapshot(room) });
    } else {
      io.to(room.code).emit("room:update", { room: roomSnapshot(room) });
      const nextPrompt = PROMPTS.find(p => !room.submissions[p]);
      io.to(room.code).emit("turn:assigned", { prompt: nextPrompt, playerId: room.assignments[nextPrompt], round: room.round });
    }
  });

  socket.on("game:again", () => {
    const room = rooms.get(currentRoomCode || "");
    if (!room) return;
    const connectedPlayers = room.players.filter(p => p.connected);
    if (connectedPlayers.length < 2) return socket.emit("toast", { type: "error", message: "Need at least 2 players." });

    room.state = "collecting";
    room.round += 1;
    room.submissions = {};
    room.assignments = computeAssignments(connectedPlayers.map(p => p.id), room.round);
    room.updatedAt = Date.now();

    io.to(room.code).emit("room:update", { room: roomSnapshot(room) });
    const nextPrompt = PROMPTS.find(p => !room.submissions[p]);
    io.to(room.code).emit("turn:assigned", { prompt: nextPrompt, playerId: room.assignments[nextPrompt], round: room.round });
  });

  socket.on("room:leave", () => {
    const room = rooms.get(currentRoomCode || "");
    if (!room) return;
    const idx = room.players.findIndex(p => p.id === playerId);
    if (idx >= 0) {
      room.players.splice(idx, 1);
      if (room.players.length === 0) {
        rooms.delete(room.code);
      } else {
        if (room.hostId === playerId && room.players.length > 0) {
          room.hostId = room.players[0].id;
          room.players[0].isHost = true;
        }
        room.updatedAt = Date.now();
        io.to(room.code).emit("room:update", { room: roomSnapshot(room) });
      }
    }
    socket.leave(currentRoomCode);
    currentRoomCode = null;
  });

  socket.on("disconnect", () => {
    const room = rooms.get(currentRoomCode || "");
    if (!room) return;

    const p = room.players.find(p => p.id === playerId);
    if (p) p.connected = false;
    room.updatedAt = Date.now();

    const connectedCount = room.players.filter(p => p.connected).length;
    if (connectedCount < 2) {
      room.state = "lobby";
      room.submissions = {};
    }

    io.to(room.code).emit("room:update", { room: roomSnapshot(room) });
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on :${PORT}`);
});
