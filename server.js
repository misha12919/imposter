import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const PORT = process.env.PORT || 3000;

const wordsRaw = readFileSync(
  path.join(__dirname, "public", "js", "words.js"),
  "utf-8"
);
const wordsMatch = wordsRaw.match(/export const WORDS = \[([\s\S]*?)\];/);
const WORDS = wordsMatch
  ? [...wordsMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
  : ["слово"];

app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function pickWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function roomPayload(room) {
  return {
    code: room.code,
    maxPlayers: room.maxPlayers,
    playerCount: room.players.length,
    started: room.started,
    hostId: room.hostId,
  };
}

io.on("connection", (socket) => {
  socket.on("create-room", ({ playerCount }, cb) => {
    const count = Math.max(3, Math.min(20, Number(playerCount) || 3));
    let code;
    do {
      code = generateCode();
    } while (rooms.has(code));

    const room = {
      code,
      maxPlayers: count,
      hostId: socket.id,
      players: [{ id: socket.id, name: "Хост" }],
      word: null,
      spyIndex: null,
      started: false,
    };
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.isHost = true;

    cb?.({ ok: true, ...roomPayload(room) });
  });

  socket.on("join-room", ({ code, name }, cb) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!room) {
      cb?.({ ok: false, error: "Комната не найдена" });
      return;
    }
    if (room.started) {
      cb?.({ ok: false, error: "Игра уже началась" });
      return;
    }
    if (room.players.length >= room.maxPlayers) {
      cb?.({ ok: false, error: "Комната заполнена" });
      return;
    }
    if (room.players.some((p) => p.id === socket.id)) {
      cb?.({ ok: true, ...roomPayload(room), playerIndex: room.players.findIndex((p) => p.id === socket.id) });
      return;
    }

    const playerName = (name || `Игрок ${room.players.length + 1}`).trim().slice(0, 24) || `Игрок ${room.players.length + 1}`;
    room.players.push({ id: socket.id, name: playerName });
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.isHost = false;

    io.to(room.code).emit("room-update", roomPayload(room));
    cb?.({ ok: true, ...roomPayload(room), playerIndex: room.players.length - 1, isHost: false });
  });

  socket.on("start-game", (_, cb) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id) {
      cb?.({ ok: false, error: "Только хост может начать игру" });
      return;
    }
    if (room.players.length < 3) {
      cb?.({ ok: false, error: "Нужно минимум 3 игрока" });
      return;
    }
    if (room.started) {
      cb?.({ ok: false, error: "Игра уже началась" });
      return;
    }

    room.word = pickWord();
    room.spyIndex = Math.floor(Math.random() * room.players.length);
    room.started = true;

    room.players.forEach((player, index) => {
      const isSpy = index === room.spyIndex;
      io.to(player.id).emit("game-start", {
        role: isSpy ? "spy" : "civilian",
        display: isSpy ? null : room.word,
        playerIndex: index,
        totalPlayers: room.players.length,
      });
    });

    io.to(room.code).emit("room-update", roomPayload(room));
    cb?.({ ok: true });
  });

  socket.on("new-round", (_, cb) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id || !room.started) {
      cb?.({ ok: false, error: "Нельзя начать новый раунд" });
      return;
    }

    room.word = pickWord();
    room.spyIndex = Math.floor(Math.random() * room.players.length);

    room.players.forEach((player, index) => {
      const isSpy = index === room.spyIndex;
      io.to(player.id).emit("game-start", {
        role: isSpy ? "spy" : "civilian",
        display: isSpy ? null : room.word,
        playerIndex: index,
        totalPlayers: room.players.length,
      });
    });

    cb?.({ ok: true });
  });

  socket.on("get-room", (_, cb) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) {
      cb?.({ ok: false });
      return;
    }
    cb?.({ ok: true, ...roomPayload(room), isHost: socket.id === room.hostId });
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    const wasHost = room.hostId === socket.id;
    room.players = room.players.filter((p) => p.id !== socket.id);

    if (room.players.length === 0) {
      rooms.delete(code);
      return;
    }

    if (wasHost) {
      room.hostId = room.players[0].id;
      room.players[0].name = room.players[0].name || "Хост";
      io.to(room.players[0].id).emit("became-host");
    }

    if (room.started && room.players.length < 3) {
      room.started = false;
      room.word = null;
      room.spyIndex = null;
    }

    io.to(code).emit("room-update", roomPayload(room));
  });
});

httpServer.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Порт ${PORT} уже занят. Остановите другой процесс (например, предыдущий npm start) или запустите: set PORT=3001&& npm start`
    );
    process.exit(1);
  }
  throw err;
});

httpServer.listen(PORT, () => {
  console.log(`Шпион: http://localhost:${PORT}`);
});
