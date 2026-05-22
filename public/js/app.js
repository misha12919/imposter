import { pickRandomWord } from "./words.js";

const app = document.getElementById("app");

const state = {
  screen: "home",
  mode: null,
  playerCount: 3,
  local: {
    word: null,
    spyIndex: null,
    currentPlayer: 0,
    revealed: false,
    allViewed: false,
  },
  online: {
    socket: null,
    code: null,
    isHost: false,
    role: null,
    display: null,
    playerIndex: 0,
    totalPlayers: 0,
    room: null,
    error: null,
  },
};

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function render() {
  switch (state.screen) {
    case "home":
      renderHome();
      break;
    case "local-setup":
      renderLocalSetup();
      break;
    case "local-game":
      renderLocalGame();
      break;
    case "online-host":
      renderOnlineHost();
      break;
    case "online-join":
      renderOnlineJoin();
      break;
    case "online-lobby":
      renderOnlineLobby();
      break;
    case "online-game":
      renderOnlineGame();
      break;
    default:
      renderHome();
  }
}

function renderHome() {
  app.innerHTML = `
    <section class="screen">
      <div class="logo">
        <h1>Шпион</h1>
        <p class="tagline">Угадай слово — или останься незамеченным</p>
      </div>
      <div class="card">
        <label for="player-count">Количество игроков</label>
        <input type="number" id="player-count" min="3" max="20" value="${state.playerCount}" />
      </div>
      <div class="mode-grid">
        <button type="button" class="mode-btn" data-mode="local">
          <strong>Одно устройство</strong>
          <span>Передавайте телефон по кругу — слово видит только тот, кто нажал кнопку</span>
        </button>
        <button type="button" class="mode-btn" data-mode="online">
          <strong>Несколько устройств</strong>
          <span>Хост создаёт комнату, остальные подключаются по коду</span>
        </button>
      </div>
      <div class="rules">
        <h3>Как играть</h3>
        <ul>
          <li>Всем показывается одно и то же слово, кроме одного игрока — он шпион.</li>
          <li>Шпион не знает слово и должен его угадать по разговору.</li>
          <li>Остальные задают вопросы и ищут шпиона.</li>
        </ul>
      </div>
    </section>
  `;

  const countInput = document.getElementById("player-count");
  countInput.addEventListener("change", () => {
    state.playerCount = clampPlayers(Number(countInput.value));
    countInput.value = state.playerCount;
  });

  app.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.playerCount = clampPlayers(Number(countInput.value));
      state.mode = btn.dataset.mode;
      if (state.mode === "local") {
        state.screen = "local-setup";
      } else {
        state.screen = "online-host";
      }
      render();
    });
  });
}

function clampPlayers(n) {
  if (Number.isNaN(n) || n < 3) return 3;
  if (n > 20) return 20;
  return Math.floor(n);
}

function renderLocalSetup() {
  app.innerHTML = `
    <section class="screen">
      <button type="button" class="back-link" data-back>← Назад</button>
      <div class="logo">
        <h1>Одно устройство</h1>
        <p class="tagline">${state.playerCount} игроков</p>
      </div>
      <div class="card">
        <p style="margin:0;color:var(--muted)">Случайно выберется слово и один шпион. Каждый игрок по очереди нажимает кнопку, чтобы увидеть своё слово, затем скрывает его и передаёт устройство следующему.</p>
      </div>
      <button type="button" class="btn" id="start-local">Начать игру</button>
    </section>
  `;

  document.querySelector("[data-back]").addEventListener("click", goHome);
  document.getElementById("start-local").addEventListener("click", startLocalGame);
}

function startLocalGame() {
  state.local.word = pickRandomWord();
  state.local.spyIndex = Math.floor(Math.random() * state.playerCount);
  state.local.currentPlayer = 0;
  state.local.revealed = false;
  state.local.allViewed = false;
  state.screen = "local-game";
  render();
}

function renderLocalGame() {
  if (state.local.allViewed) {
    app.innerHTML = `
      <section class="screen">
        <button type="button" class="back-link" data-back>← Выйти</button>
        <div class="reveal-zone">
          <p class="word-display" style="font-size:1.5rem;color:var(--success)">Все посмотрели!</p>
          <p class="hint">Обсуждайте, задавайте вопросы и ищите шпиона. Шпион должен угадать слово, не выдав себя.</p>
        </div>
        <button type="button" class="btn" id="new-round">Новый раунд</button>
        <button type="button" class="btn btn-secondary" id="restart-same">Новое слово</button>
      </section>
    `;
    document.querySelector("[data-back]").addEventListener("click", goHome);
    document.getElementById("new-round").addEventListener("click", startLocalGame);
    document.getElementById("restart-same").addEventListener("click", startLocalGame);
    return;
  }

  const playerNum = state.local.currentPlayer + 1;
  const isSpy = state.local.currentPlayer === state.local.spyIndex;

  let revealContent = "";
  if (!state.local.revealed) {
    revealContent = `
      <p class="word-display hidden-text">Нажмите кнопку, чтобы увидеть своё слово</p>
    `;
  } else if (isSpy) {
    revealContent = `
      <p class="word-display spy">Вы — шпион!</p>
      <p class="hint">Вы не знаете загаданное слово. Слушайте остальных и постарайтесь угадать его, не выдав себя.</p>
    `;
  } else {
    revealContent = `
      <p class="word-display">${escapeHtml(state.local.word)}</p>
      <p class="hint">Запомните слово и не выдавайте его слишком явно. Ищите шпиона среди игроков.</p>
    `;
  }

  const btnLabel = state.local.revealed ? "Скрыть и передать" : "Показать моё слово";

  app.innerHTML = `
    <section class="screen">
      <button type="button" class="back-link" data-back>← Выйти</button>
      <div class="reveal-zone">
        <span class="player-badge">Игрок ${playerNum} из ${state.playerCount}</span>
        ${revealContent}
      </div>
      <button type="button" class="btn btn-spy" id="reveal-btn">${btnLabel}</button>
      <p class="hint" style="text-align:center;margin-top:12px">Передайте устройство следующему игроку после скрытия слова</p>
    </section>
  `;

  document.querySelector("[data-back]").addEventListener("click", goHome);
  document.getElementById("reveal-btn").addEventListener("click", () => {
    if (!state.local.revealed) {
      state.local.revealed = true;
    } else {
      state.local.revealed = false;
      if (state.local.currentPlayer < state.playerCount - 1) {
        state.local.currentPlayer += 1;
      } else {
        state.local.allViewed = true;
      }
    }
    render();
  });
}

function renderOnlineHost() {
  app.innerHTML = `
    <section class="screen">
      <button type="button" class="back-link" data-back>← Назад</button>
      <div class="logo">
        <h1>Несколько устройств</h1>
        <p class="tagline">${state.playerCount} игроков в комнате</p>
      </div>
      <button type="button" class="btn" id="create-room">Создать комнату (я хост)</button>
      <button type="button" class="btn btn-secondary" id="go-join">Войти в комнату</button>
      ${state.online.error ? `<p class="error-msg">${escapeHtml(state.online.error)}</p>` : ""}
    </section>
  `;

  document.querySelector("[data-back]").addEventListener("click", goHome);
  document.getElementById("go-join").addEventListener("click", () => {
    state.screen = "online-join";
    state.online.error = null;
    render();
  });
  document.getElementById("create-room").addEventListener("click", createRoom);
}

async function loadSocket() {
  if (state.online.socket) return state.online.socket;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "/socket.io/socket.io.js";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  state.online.socket = io();
  bindSocketEvents(state.online.socket);
  return state.online.socket;
}

function bindSocketEvents(socket) {
  socket.on("room-update", (room) => {
    state.online.room = room;
    if (state.screen === "online-lobby") render();
  });

  socket.on("game-start", (data) => {
    state.online.role = data.role;
    state.online.display = data.display;
    state.online.playerIndex = data.playerIndex;
    state.online.totalPlayers = data.totalPlayers;
    state.screen = "online-game";
    render();
  });

  socket.on("became-host", () => {
    state.online.isHost = true;
    render();
  });
}

async function createRoom() {
  state.online.error = null;
  try {
    const socket = await loadSocket();
    socket.emit("create-room", { playerCount: state.playerCount }, (res) => {
      if (!res?.ok) {
        state.online.error = res?.error || "Не удалось создать комнату";
        render();
        return;
      }
      state.online.code = res.code;
      state.online.isHost = true;
      state.online.room = res;
      state.screen = "online-lobby";
      render();
    });
  } catch {
    state.online.error = "Ошибка подключения к серверу";
    render();
  }
}

function renderOnlineJoin() {
  app.innerHTML = `
    <section class="screen">
      <button type="button" class="back-link" data-back>← Назад</button>
      <div class="logo">
        <h1>Вход в комнату</h1>
      </div>
      <div class="card">
        <label for="room-code">Код комнаты</label>
        <input type="text" id="room-code" maxlength="6" placeholder="ABC123" autocomplete="off" style="text-transform:uppercase;letter-spacing:0.15em;text-align:center" />
        <label for="player-name" style="margin-top:16px">Ваше имя (необязательно)</label>
        <input type="text" id="player-name" maxlength="24" placeholder="Игрок" />
      </div>
      <button type="button" class="btn" id="join-room">Войти</button>
      ${state.online.error ? `<p class="error-msg">${escapeHtml(state.online.error)}</p>` : ""}
    </section>
  `;

  document.querySelector("[data-back]").addEventListener("click", () => {
    state.screen = "online-host";
    state.online.error = null;
    render();
  });

  document.getElementById("join-room").addEventListener("click", joinRoom);
}

async function joinRoom() {
  const code = document.getElementById("room-code").value.trim().toUpperCase();
  const name = document.getElementById("player-name").value.trim();
  if (code.length < 4) {
    state.online.error = "Введите код комнаты";
    render();
    return;
  }
  state.online.error = null;
  try {
    const socket = await loadSocket();
    socket.emit("join-room", { code, name }, (res) => {
      if (!res?.ok) {
        state.online.error = res?.error || "Не удалось войти";
        render();
        return;
      }
      state.online.code = res.code;
      state.online.isHost = false;
      state.online.room = res;
      state.screen = "online-lobby";
      render();
    });
  } catch {
    state.online.error = "Ошибка подключения к серверу";
    render();
  }
}

function renderOnlineLobby() {
  const room = state.online.room || {};
  const filled = room.playerCount >= 3;
  const canStart = state.online.isHost && filled && !room.started;

  app.innerHTML = `
    <section class="screen">
      <button type="button" class="back-link" data-back>← Выйти</button>
      <div class="logo">
        <h1>Комната</h1>
        <p class="tagline">Поделитесь кодом с друзьями</p>
      </div>
      <div class="card">
        <p class="status-bar" style="margin:0">Код комнаты</p>
        <p class="room-code">${escapeHtml(state.online.code || "")}</p>
        <p class="status-bar">Игроков: ${room.playerCount || 0} / ${room.maxPlayers || state.playerCount}</p>
        ${state.online.isHost ? `<p class="hint" style="margin:8px 0 0">Вы — хост. Начните игру, когда все подключатся (минимум 3).</p>` : `<p class="hint" style="margin:8px 0 0">Ожидайте, пока хост начнёт игру.</p>`}
      </div>
      ${canStart ? `<button type="button" class="btn" id="start-online">Начать игру</button>` : ""}
      ${state.online.isHost && !filled ? `<p class="hint" style="text-align:center">Нужно ещё ${3 - (room.playerCount || 0)} игрок(а)</p>` : ""}
      ${state.online.error ? `<p class="error-msg">${escapeHtml(state.online.error)}</p>` : ""}
    </section>
  `;

  document.querySelector("[data-back]").addEventListener("click", goHome);

  const startBtn = document.getElementById("start-online");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      state.online.socket.emit("start-game", {}, (res) => {
        if (!res?.ok) {
          state.online.error = res?.error || "Не удалось начать";
          render();
        }
      });
    });
  }
}

function renderOnlineGame() {
  const isSpy = state.online.role === "spy";
  const content = isSpy
    ? `<p class="word-display spy">Вы — шпион!</p>
       <p class="hint">Вы не знаете загаданное слово. Слушайте остальных и постарайтесь угадать его.</p>`
    : `<p class="word-display">${escapeHtml(state.online.display || "")}</p>
       <p class="hint">Запомните слово. Не выдавайте его слишком явно и ищите шпиона.</p>`;

  const hostControls = state.online.isHost
    ? `<button type="button" class="btn btn-secondary" id="new-round-online">Новый раунд</button>`
    : "";

  app.innerHTML = `
    <section class="screen">
      <div class="reveal-zone" style="min-height:240px">
        <span class="player-badge">Игрок ${state.online.playerIndex + 1} из ${state.online.totalPlayers}</span>
        ${content}
      </div>
      ${hostControls}
      <button type="button" class="btn btn-secondary" data-back style="margin-top:12px">В главное меню</button>
    </section>
  `;

  document.querySelector("[data-back]").addEventListener("click", goHome);

  const newRoundBtn = document.getElementById("new-round-online");
  if (newRoundBtn) {
    newRoundBtn.addEventListener("click", () => {
      state.online.socket.emit("new-round", {}, (res) => {
        if (!res?.ok) {
          state.online.error = res?.error || "Ошибка";
        }
      });
    });
  }
}

function goHome() {
  if (state.online.socket) {
    state.online.socket.disconnect();
    state.online.socket = null;
  }
  state.screen = "home";
  state.mode = null;
  state.online = {
    socket: null,
    code: null,
    isHost: false,
    role: null,
    display: null,
    playerIndex: 0,
    totalPlayers: 0,
    room: null,
    error: null,
  };
  state.local = {
    word: null,
    spyIndex: null,
    currentPlayer: 0,
    revealed: false,
    allViewed: false,
  };
  render();
}

render();
