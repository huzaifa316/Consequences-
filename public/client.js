const socket = io();

const form = document.getElementById("entryForm");
const input = document.getElementById("entryInput");
const prompt = document.getElementById("prompt");
const sentenceDisplay = document.getElementById("sentenceDisplay");

let currentCategory = null;
let myTurn = false;

socket.on("nextTurn", ({ player, category }) => {
  if (socket.id === player) {
    myTurn = true;
    currentCategory = category;
    prompt.innerText = `Your turn! Enter a ${category}:`;
    form.style.display = "flex";
    input.focus();
  } else {
    myTurn = false;
    form.style.display = "none";
    prompt.innerText = `Waiting for other players...`;
  }
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (myTurn && input.value.trim()) {
    socket.emit("submitEntry", { category: currentCategory, text: input.value });
    input.value = "";
    form.style.display = "none";
    prompt.innerText = "Waiting for others...";
  }
});

socket.on("sentenceComplete", (entries) => {
  const html = `
    <h3>Who: <strong>${entries.who}</strong></h3>
    <h3>What: <strong>${entries.what}</strong></h3>
    <h3>Where: <strong>${entries.where}</strong></h3>
    <h3>When: <strong>${entries.when}</strong></h3>
    <h3>With whom: <strong>${entries.withWhom}</strong></h3>
  `;
  sentenceDisplay.innerHTML = html;
});