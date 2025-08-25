(() => {
  const socket = io();
  let name = "";
  let roomCode = "";
  let isHost = false;
  let myTurn = false;

  // Views
  const viewAuth = document.getElementById("view-auth");
  const viewLobby = document.getElementById("view-lobby");
  const viewGame = document.getElementById("view-game");
  const viewFinal = document.getElementById("view-final");

  // Auth
  const nameInput = document.getElementById("name");
  const createBtn = document.getElementById("create");
  const roomCodeInput = document.getElementById("roomCodeInput");
  const joinBtn = document.getElementById("join");
  const errorEl = document.getElementById("error");

  // Lobby
  const roomCodeEl = document.getElementById("roomCode");
  const playersEl = document.getElementById("players");
  const startBtn = document.getElementById("start");

  // Game
  const turnPlayerEl = document.getElementById("turnPlayer");
  const turnCategoryEl = document.getElementById("turnCategory");
  const inputArea = document.getElementById("inputArea");
  const waitingEl = document.getElementById("waiting");
  const answerInput = document.getElementById("answer");
  const submitBtn = document.getElementById("submit");
  const curr = {
    who: document.getElementById("currWho"),
    what: document.getElementById("currWhat"),
    where: document.getElementById("currWhere"),
    when: document.getElementById("currWhen"),
    withWhom: document.getElementById("currWith"),
  };

  // Final
  const sentencesList = document.getElementById("sentencesList");
  const playAgainBtn = document.getElementById("playAgain");

  function show(view) {
    [viewAuth, viewLobby, viewGame, viewFinal].forEach(v => v.classList.add("hidden"));
    view.classList.remove("hidden");
  }

  function setError(msg) {
    errorEl.textContent = msg || "";
  }

  // Actions
  createBtn.onclick = () => {
    name = nameInput.value.trim() || "Player";
    socket.emit("setName", name);
    socket.emit("createRoom");
    isHost = true;
  };
  joinBtn.onclick = () => {
    name = nameInput.value.trim() || "Player";
    socket.emit("setName", name);
    const code = (roomCodeInput.value || "").toUpperCase().trim();
    if (!code) return setError("Enter a room code.");
    roomCode = code;
    socket.emit("joinRoom", code);
    isHost = false;
  };
  startBtn.onclick = () => {
    if (!isHost) return;
    socket.emit("startGame", roomCode);
  };
  submitBtn.onclick = () => {
    const txt = (answerInput.value || "").trim();
    if (!txt || !myTurn) return;
    socket.emit("submitAnswer", { code: roomCode, answer: txt });
    answerInput.value = "";
    myTurn = false;
    inputArea.classList.add("hidden");
    waitingEl.classList.remove("hidden");
  };
  playAgainBtn.onclick = () => window.location.reload();

  // Sockets
  socket.on("roomCreated", (code) => {
    roomCode = code;
    roomCodeEl.textContent = code;
    show(viewLobby);
  });
  socket.on("lobbyUpdate", ({ code, players, started, hostId }) => {
    roomCodeEl.textContent = roomCode || code;
    playersEl.innerHTML = "";
    players.forEach(p => {
      const span = document.createElement("span");
      span.className = "pill";
      span.textContent = p.name;
      playersEl.appendChild(span);
    });
    if (!started) show(viewLobby);
    startBtn.style.display = isHost && !started ? "inline-block" : "none";
  });
  socket.on("errorMsg", (msg) => setError(msg));
  socket.on("gameStarted", () => {
    // reset UI
    Object.values(curr).forEach(el => el.textContent = "");
    sentencesList.innerHTML = "";
    show(viewGame);
  });
  socket.on("turnState", ({ category, playerIndex, playerName }) => {
    turnPlayerEl.textContent = playerName;
    turnCategoryEl.textContent = categoryLabel(category);
    // default state is waiting
    myTurn = false;
    inputArea.classList.add("hidden");
    waitingEl.classList.remove("hidden");
  });
  socket.on("yourTurn", ({ category }) => {
    myTurn = true;
    turnCategoryEl.textContent = categoryLabel(category);
    inputArea.classList.remove("hidden");
    waitingEl.classList.add("hidden");
    answerInput.focus();
  });
  socket.on("partialUpdate", ({ labels, current }) => {
    curr.who.textContent = current.who || "";
    curr.what.textContent = current.what || "";
    curr.where.textContent = current.where || "";
    curr.when.textContent = current.when || "";
    curr.withWhom.textContent = current.withWhom || "";
  });
  socket.on("sentenceComplete", ({ labels, sentence, all }) => {
    // render one card
    const card = document.createElement("div");
    card.className = "sentence";
    const title = document.createElement("h4");
    title.textContent = "Completed Sentence";
    const grid = document.createElement("table");
    grid.className = "grid";
    grid.innerHTML = `
      <thead><tr>
        <th>${labels.who}</th><th>${labels.what}</th><th>${labels.where}</th>
        <th>${labels.when}</th><th>${labels.withWhom}</th>
      </tr></thead>
      <tbody><tr>
        <td>${escapeHtml(sentence.who||"")}</td>
        <td>${escapeHtml(sentence.what||"")}</td>
        <td>${escapeHtml(sentence.where||"")}</td>
        <td>${escapeHtml(sentence.when||"")}</td>
        <td>${escapeHtml(sentence.withWhom||"")}</td>
      </tr></tbody>`;
    card.appendChild(title);
    card.appendChild(grid);
    sentencesList.prepend(card); // newest first

    // reset current progress display
    Object.values(curr).forEach(el => el.textContent = "");

    // also show the "All Completed Sentences" view button if desired
    // staying on game view so players can continue
  });

  function categoryLabel(c) {
    return { who:"Who", what:"What", where:"Where", when:"When", withWhom:"With whom" }[c] || c;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
    })[m]);
  }
})();