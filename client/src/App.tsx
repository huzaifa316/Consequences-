import React, { useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";

type Prompt = "Who" | "What" | "WithWhom" | "Where" | "When";

type Player = {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
  connected: boolean;
};

type RoomSnapshot = {
  id: string;
  code: string;
  name: string;
  public: boolean;
  maxPlayers: number;
  hostId: string | null;
  players: Player[];
  state: "lobby" | "collecting" | "revealing" | "ended";
  round: number;
  active: { prompt: Prompt; playerId: string } | null;
  createdAt: number;
  updatedAt: number;
};

const PROMPTS: Prompt[] = ["Who", "What", "WithWhom", "Where", "When"];

const SERVER_URL = import.meta.env.VITE_SERVER_URL || window.location.origin;

function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  useEffect(() => {
    const s = io(SERVER_URL, { transports: ["websocket"], withCredentials: true });
    setSocket(s);
    return () => { s.disconnect(); };
  }, []);
  return socket;
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/10">{children}</span>;
}

function TopBar({
  room, onLeave
}: {
  room: RoomSnapshot | null;
  onLeave: () => void;
}) {
  return (
    <div className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/70 backdrop-blur supports-[backdrop-filter]:bg-slate-950/60">
      <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-brand-600 grid place-items-center font-semibold">W</div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Who · What · With Whom · Where · When</div>
            <div className="text-xs text-slate-300">
              {room ? <>Room <button className="underline decoration-dotted" onClick={() => navigator.clipboard.writeText(room.code)}>{room.code}</button></> : "Lobby"}
            </div>
          </div>
        </div>
        {room && (
          <button onClick={onLeave} className="text-sm px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20">Leave</button>
        )}
      </div>
    </div>
  );
}

function Card({ children, className="" }: { children: React.ReactNode, className?: string }) {
  return <div className={"glass rounded-2xl p-4 shadow-lg " + className}>{children}</div>
}

type PublicRoom = { code: string; name: string; players: number; maxPlayers: number };

export default function App() {
  const socket = useSocket();
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [sentence, setSentence] = useState<Record<Prompt, string> | null>(null);
  const [meName, setMeName] = useState<string>("");
  const [meColor, setMeColor] = useState<string>("#60a5fa");
  const [joiningCode, setJoiningCode] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;
    socket.emit("room:list");
    const t = setInterval(() => socket.emit("room:list"), 5000);
    return () => clearInterval(t);
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    const onRooms = (p: { rooms: PublicRoom[] }) => setPublicRooms(p.rooms);
    const onUpdate = (p: { room: RoomSnapshot }) => setRoom(p.room);
    const onReveal = (p: { sentence: Record<Prompt, string> }) => setSentence(p.sentence);
    const onToast = (p: { type: string, message: string }) => { setToast(p.message); setTimeout(() => setToast(null), 3000); };
    socket.on("rooms:list", onRooms);
    socket.on("room:update", onUpdate);
    socket.on("reveal:show", onReveal);
    socket.on("toast", onToast);
    return () => {
      socket.off("rooms:list", onRooms);
      socket.off("room:update", onUpdate);
      socket.off("reveal:show", onReveal);
      socket.off("toast", onToast);
    };
  }, [socket]);

  function createRoom(publicFlag=true) {
    socket?.emit("room:create", { public: publicFlag });
  }

  function joinRoom(code: string, name: string) {
    if (!code || !name) { setToast("Enter code and a display name"); return; }
    socket?.emit("room:join", { code: code.toUpperCase(), name, color: meColor });
  }

  function leaveRoom() {
    socket?.emit("room:leave");
    setRoom(null);
    setSentence(null);
  }

  function startGame() {
    socket?.emit("game:start");
    setSentence(null);
  }

  function playAgain() {
    socket?.emit("game:again");
    setSentence(null);
  }

  function submit(prompt: Prompt, text: string) {
    socket?.emit("submission:send", { prompt, text });
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <TopBar room={room} onLeave={leaveRoom} />
      <main className="flex-1">
        {!room ? (
          <div className="max-w-md mx-auto p-4 pb-[calc(1rem+var(--safe-bottom))] space-y-4">
            <Card>
              <div className="text-xl font-semibold">Play now</div>
              <div className="text-sm text-slate-300 mt-1">Jump into a public room or join by code with a display name.</div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button onClick={() => createRoom(true)} className="px-4 py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 font-semibold">Create public room</button>
                <button onClick={() => createRoom(false)} className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20">Create unlisted</button>
              </div>
            </Card>

            <Card className="space-y-3">
              <div className="font-semibold">Join a room</div>
              <div className="grid grid-cols-3 gap-2">
                <input placeholder="Code" value={joiningCode} onChange={e => setJoiningCode(e.target.value.toUpperCase())}
                  className="col-span-1 rounded-xl px-3 py-2 bg-white/5 outline-none ring-1 ring-white/10 focus:ring-brand-600"/>
                <input placeholder="Display name" value={meName} onChange={e => setMeName(e.target.value)}
                  className="col-span-2 rounded-xl px-3 py-2 bg-white/5 outline-none ring-1 ring-white/10 focus:ring-brand-600"/>
              </div>
              <div className="flex items-center gap-3">
                <input type="color" value={meColor} onChange={e => setMeColor(e.target.value)} className="w-10 h-10 rounded-xl border border-white/10"/>
                <button onClick={() => joinRoom(joiningCode, meName)} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20">Join</button>
              </div>
            </Card>

            <Card>
              <div className="font-semibold mb-2">Happening now</div>
              <div className="space-y-2">
                {publicRooms.length === 0 && <div className="text-sm text-slate-400">No public rooms yet. Create one!</div>}
                {publicRooms.map(r => (
                  <div key={r.code} className="flex items-center justify-between rounded-xl bg-white/5 p-3">
                    <div className="">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-slate-300">Players {r.players}/{r.maxPlayers}</div>
                    </div>
                    <button onClick={() => joinRoom(r.code, meName || "Player")} className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700">Join</button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ) : (
          <RoomView room={room} submit={submit} startGame={startGame} playAgain={playAgain} sentence={sentence} />
        )}
      </main>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-[calc(1rem+var(--safe-bottom))] left-0 right-0 mx-auto w-fit px-4 py-2 rounded-full bg-white/10 border border-white/10 backdrop-blur"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RoomView({
  room, submit, startGame, playAgain, sentence
}: {
  room: RoomSnapshot;
  submit: (prompt: Prompt, text: string) => void;
  startGame: () => void;
  playAgain: () => void;
  sentence: Record<Prompt, string> | null;
}) {
  const [text, setText] = useState("");
  const activePrompt = room.active?.prompt ?? null;

  const isLobby = room.state === "lobby";
  const isCollecting = room.state === "collecting";
  const isRevealing = room.state === "revealing";

  const players = room.players;

  return (
    <div className="max-w-md mx-auto p-4 pb-[calc(1rem+var(--safe-bottom))] space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <div className="font-semibold">{room.name}</div>
          <Pill>Code {room.code}</Pill>
        </div>
        <div className="mt-3 flex -space-x-2">
          {players.map(p => (
            <div key={p.id} title={p.name} className="w-9 h-9 rounded-full ring-2 ring-slate-900 grid place-items-center text-xs font-semibold"
                 style={{ background: p.color }}>{p.name.slice(0,2).toUpperCase()}</div>
          ))}
        </div>
        <div className="text-xs text-slate-300 mt-2">
          {players.length} player{players.length!==1?'s':''} · Host: {players.find(p=>p.id===room.hostId)?.name || "—"}
        </div>
      </Card>

      {isLobby && (
        <Card className="space-y-3">
          <div className="text-lg font-semibold">Lobby</div>
          <div className="text-sm text-slate-300">Need at least 2 players to start.</div>
          <button onClick={startGame} className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700">Start game</button>
        </Card>
      )}

      {isCollecting && (
        <Card className="space-y-3">
          <div className="text-sm text-slate-300">Round {room.round + 1}</div>
          <div className="text-xl font-semibold">Write: <span className="text-brand-500">{activePrompt ?? "…"}</span></div>
          <div className="text-sm text-slate-300">Only the assigned player can submit for this prompt.</div>
          <input
            value={text} onChange={e => setText(e.target.value)}
            placeholder={`Type your ${activePrompt ?? ""}…`}
            className="w-full rounded-xl px-3 py-3 bg-white/5 outline-none ring-1 ring-white/10 focus:ring-brand-600"
          />
          <button onClick={() => { if (activePrompt) { submit(activePrompt, text); setText(""); } }}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20">
            Submit
          </button>
        </Card>
      )}

      {isRevealing && sentence && (
        <Card className="space-y-3">
          <div className="text-lg font-semibold">Reveal</div>
          <div className="text-sm grid gap-1">
            <div><span className="text-slate-300">Who:</span> <span className="font-medium">{sentence.Who}</span></div>
            <div><span className="text-slate-300">What:</span> <span className="font-medium">{sentence.What}</span></div>
            <div><span className="text-slate-300">With whom:</span> <span className="font-medium">{sentence.WithWhom}</span></div>
            <div><span className="text-slate-300">Where:</span> <span className="font-medium">{sentence.Where}</span></div>
            <div><span className="text-slate-300">When:</span> <span className="font-medium">{sentence.When}</span></div>
          </div>
          <button onClick={playAgain} className="w-full px-4 py-3 rounded-xl bg-brand-600 hover:bg-brand-700">Play again</button>
        </Card>
      )}
    </div>
  );
}
