
const socket = io();

const lobby = document.getElementById("lobby");
const roomDiv = document.getElementById("room");
const playerNameInput = document.getElementById("playerName");
const createBtn = document.getElementById("createBtn");
const roomCodeInput = document.getElementById("roomCodeInput");
const joinBtn = document.getElementById("joinBtn");
const errorDiv = document.getElementById("error");

const roomCodeSpan = document.getElementById("roomCode");
const playersDiv = document.getElementById("players");
const startBtn = document.getElementById("startBtn");
const turnInfo = document.getElementById("turnInfo");
const inputArea = document.getElementById("inputArea");
const contributionInput = document.getElementById("contribution");
const submitBtn = document.getElementById("submitBtn");
const resultDiv = document.getElementById("result");

let myName = "";
let currentRoom = "";

createBtn.onclick = () => {
  myName = playerNameInput.value.trim();
  if (!myName) return;
  socket.emit("createRoom", myName, ({ roomCode }) => {
    currentRoom = roomCode;
    roomCodeSpan.textContent = roomCode;
    lobby.style.display = "none";
    roomDiv.style.display = "block";
  });
};

joinBtn.onclick = () => {
  myName = playerNameInput.value.trim();
  const roomCode = roomCodeInput.value.trim().toUpperCase();
  if (!myName || !roomCode) return;
  socket.emit("joinRoom", roomCode, myName, (res) => {
    if (res.error) {
      errorDiv.textContent = res.error;
    } else {
      currentRoom = roomCode;
      roomCodeSpan.textContent = roomCode;
      lobby.style.display = "none";
      roomDiv.style.display = "block";
    }
  });
};

socket.on("updatePlayers", (players) => {
  playersDiv.innerHTML = "<b>Players:</b><br>" + players.map(p => p.name).join("<br>");
  startBtn.disabled = players.length < 2 || players.length > 5;
});

startBtn.onclick = () => {
  socket.emit("startGame");
};

socket.on("gameStarted", () => {
  resultDiv.innerHTML = "";
});

socket.on("nextTurn", (playerName) => {
  turnInfo.textContent = "It's " + playerName + "'s turn";
  if (playerName === myName) {
    inputArea.style.display = "block";
  } else {
    inputArea.style.display = "none";
  }
});

submitBtn.onclick = () => {
  const text = contributionInput.value.trim();
  if (!text) return;
  socket.emit("submitContribution", text);
  contributionInput.value = "";
};

socket.on("sentenceComplete", (contributions) => {
  let output = "<h3>Final Sentence</h3>";
  const categories = ["Who", "What", "Where", "When", "With Whom"];
  contributions.forEach((c, i) => {
    const cat = categories[i % 5];
    output += `<b>${cat}:</b> ${c.text} <br>`;
  });
  resultDiv.innerHTML = output;
});

socket.on("errorMessage", (msg) => {
  alert(msg);
});
