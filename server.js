const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const categories = ["who", "what", "where", "when", "withWhom"];

let game = {
  players: [],
  turnIndex: 0,
  assignments: {},
  entries: {},
};

io.on("connection", (socket) => {
  console.log("A player connected:", socket.id);

  // Add player
  game.players.push(socket.id);

  // Reassign categories whenever number of players changes
  assignCategories();

  socket.on("submitEntry", ({ category, text }) => {
    game.entries[category] = text;

    // Check if sentence is complete
    if (Object.keys(game.entries).length === categories.length) {
      io.emit("sentenceComplete", game.entries);

      // Reset for next round
      game.entries = {};
      game.turnIndex = 0;
    } else {
      // Next player’s turn
      game.turnIndex = (game.turnIndex + 1) % game.players.length;
      io.emit("nextTurn", {
        player: game.players[game.turnIndex],
        category: game.assignments[game.turnIndex],
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("A player disconnected:", socket.id);
    game.players = game.players.filter((p) => p !== socket.id);
    assignCategories();
  });
});

// Helper: distribute categories among players
function assignCategories() {
  game.assignments = {};
  let i = 0;
  for (let c of categories) {
    const player = game.players[i % game.players.length];
    if (!game.assignments[i % game.players.length]) {
      game.assignments[i % game.players.length] = [];
    }
    game.assignments[i % game.players.length].push(c);
    i++;
  }
  if (game.players.length > 0) {
    io.emit("nextTurn", {
      player: game.players[game.turnIndex],
      category: game.assignments[game.turnIndex][0],
    });
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
