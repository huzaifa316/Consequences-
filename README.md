# Who / What / Where / When / With whom — Multiplayer (v2)

Online, turn-based version of the fold-over sentence game. **Up to 5 players.**  
If there are fewer than 5 players, the game **assigns multiple categories per player** by alternating turns:
- Turn N's **category** = `["who","what","where","when","withWhom"][N % 5]`
- Turn N's **player**   = `players[N % players.length]`

A sentence completes after all five categories are filled. It is immediately revealed to everyone with headings above each word. All completed sentences remain visible.

## Run Locally
```bash
npm install
npm start
# open http://localhost:3000
```

## Free Hosting
- **Render** (Web Service):  
  - Build: `npm install`  
  - Start: `node server.js`
- **Glitch**: Import the repo; it runs automatically.
- **Railway**: Node template, same commands.

## Notes
- No database — room state is in memory (ephemeral).
- Host starts the game; at least 2 players required.
- Max 5 players per room.
- Turn order always **resets** to start each new sentence with **Who** at Player 1.  
  (You can change this by removing the `turnIndex = 0` reset in `server.js`.)

Have fun! 🎉
