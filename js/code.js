const app = document.getElementById("app");

const state = {
  screen: "home",
  secret: null,
  guesses: [],
  error: null,
};

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function normalizeDigits(raw) {
  return String(raw || "").replace(/\D/g, "").slice(0, 4);
}

function isValidCode(code) {
  return /^\d{4}$/.test(code);
}

/**
 * Как в Wordle: сначала «зелёные» (цифра на своём месте),
 * затем «жёлтые» среди оставшихся (цифра есть в коде, но не на этом месте).
 * Какие именно позиции — не сообщаем, только количество.
 */
function scoreGuess(secret, guess) {
  let greens = 0;
  const secretRest = [];
  const guessRest = [];

  for (let i = 0; i < 4; i++) {
    if (secret[i] === guess[i]) {
      greens++;
    } else {
      secretRest.push(secret[i]);
      guessRest.push(guess[i]);
    }
  }

  let yellows = 0;
  const counts = {};
  for (const d of secretRest) {
    counts[d] = (counts[d] || 0) + 1;
  }
  for (const d of guessRest) {
    if (counts[d] > 0) {
      yellows++;
      counts[d]--;
    }
  }

  return { greens, yellows };
}

function feedbackPills(greens, yellows) {
  return `<span class="guess-feedback-pills">
    <span class="feedback-pill feedback-green" title="На месте">${greens}</span>
    <span class="feedback-pill feedback-yellow" title="В коде, не на месте">${yellows}</span>
  </span>`;
}

function feedbackLabel(greens, yellows) {
  return `${greens} на месте, ${yellows} не на месте`;
}

function render() {
  switch (state.screen) {
    case "home":
      renderHome();
      break;
    case "set-code":
      renderSetCode();
      break;
    case "pass":
      renderPass();
      break;
    case "guess":
      renderGuess();
      break;
    case "won":
      renderWon();
      break;
    default:
      renderHome();
  }
}

function renderHome() {
  app.innerHTML = `
    <section class="screen">
      <a href="index.html" class="back-link">← Шпион</a>
      <div class="logo">
        <h1>Код</h1>
        <p class="tagline">Угадай четырёхзначный код</p>
      </div>
      <div class="card">
        <p style="margin:0;color:var(--muted)">Как в Wordle, но без подсветки конкретных цифр — только <span class="inline-green">сколько на месте</span> и <span class="inline-yellow">сколько в коде, но не на месте</span>.</p>
      </div>
      <button type="button" class="btn" id="start-code">Начать игру</button>
      <div class="rules">
        <h3>Как играть</h3>
        <ul>
          <li>Первый игрок вводит секретный код и передаёт устройство.</li>
          <li>Второй вводит догадки, пока не будет 4 «на месте».</li>
          <li>Цифры в догадке не подсвечиваются — видно только количество подсказок.</li>
        </ul>
        <p style="margin:12px 0 0;font-size:0.82rem"><strong>Примеры:</strong> код <code>3847</code>, догадка <code>3147</code> → <span class="inline-green">3</span> на месте, <span class="inline-yellow">0</span> не на месте. Код <code>1122</code>, догадка <code>2211</code> → <span class="inline-green">0</span> на месте, <span class="inline-yellow">4</span> не на месте.</p>
      </div>
    </section>
  `;

  document.getElementById("start-code").addEventListener("click", () => {
    state.screen = "set-code";
    state.error = null;
    render();
  });
}

function renderSetCode() {
  app.innerHTML = `
    <section class="screen">
      <button type="button" class="back-link" data-back>← Назад</button>
      <div class="logo">
        <h1>Загадайте код</h1>
        <p class="tagline">Игрок 1 — секретный код</p>
      </div>
      <div class="card">
        <label for="secret-code">Код из 4 цифр</label>
        <input type="text" id="secret-code" class="code-input" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="off" />
        <p class="hint" style="margin:12px 0 0;text-align:left">Никто не должен видеть экран. После ввода код будет скрыт.</p>
      </div>
      <button type="button" class="btn" id="confirm-secret">Сохранить код</button>
      ${state.error ? `<p class="error-msg">${escapeHtml(state.error)}</p>` : ""}
    </section>
  `;

  document.querySelector("[data-back]").addEventListener("click", goHome);
  const input = document.getElementById("secret-code");
  bindCodeInput(input);
  document.getElementById("confirm-secret").addEventListener("click", () => {
    const code = normalizeDigits(input.value);
    if (!isValidCode(code)) {
      state.error = "Введите ровно 4 цифры";
      render();
      return;
    }
    state.secret = code;
    state.guesses = [];
    state.error = null;
    state.screen = "pass";
    render();
  });
}

function renderPass() {
  app.innerHTML = `
    <section class="screen">
      <div class="reveal-zone">
        <p class="word-display" style="font-size:1.5rem;color:var(--success)">Код сохранён</p>
        <p class="hint">Передайте устройство игроку, который будет отгадывать. Код больше не показывается.</p>
      </div>
      <button type="button" class="btn" id="start-guess">Готов — отгадывать</button>
      <button type="button" class="btn btn-secondary" data-back>Загадать другой код</button>
    </section>
  `;

  document.getElementById("start-guess").addEventListener("click", () => {
    state.screen = "guess";
    state.error = null;
    render();
  });
  document.querySelector("[data-back]").addEventListener("click", () => {
    state.secret = null;
    state.screen = "set-code";
    render();
  });
}

function renderGuessHistory() {
  if (state.guesses.length === 0) return "";
  const rows = state.guesses
    .map(
      (g) => `
      <li class="guess-row">
        <span class="guess-digits" aria-label="Догадка">${escapeHtml(g.guess)}</span>
        <span class="guess-feedback" aria-label="${feedbackLabel(g.greens, g.yellows)}">
          ${feedbackPills(g.greens, g.yellows)}
        </span>
      </li>`
    )
    .join("");

  return `
    <div class="card guess-history-card">
      <p class="status-bar" style="margin:0 0 12px">Попытки</p>
      <ul class="guess-history">${rows}</ul>
    </div>
  `;
}

function renderGuess() {
  app.innerHTML = `
    <section class="screen">
      <button type="button" class="back-link" data-quit>← Выйти</button>
      <div class="logo">
        <h1>Отгадайте код</h1>
        <p class="tagline">Игрок 2</p>
      </div>
      ${renderGuessHistory()}
      <div class="card">
        <label for="guess-code">Ваша догадка</label>
        <input type="text" id="guess-code" class="code-input" inputmode="numeric" maxlength="4" placeholder="0000" autocomplete="off" />
      </div>
      <button type="button" class="btn" id="submit-guess">Проверить</button>
      ${state.error ? `<p class="error-msg">${escapeHtml(state.error)}</p>` : ""}
    </section>
  `;

  document.querySelector("[data-quit]").addEventListener("click", goHome);
  const input = document.getElementById("guess-code");
  bindCodeInput(input);
  document.getElementById("submit-guess").addEventListener("click", () => submitGuess(input));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitGuess(input);
  });
}

function submitGuess(input) {
  const guess = normalizeDigits(input.value);
  if (!isValidCode(guess)) {
    state.error = "Введите ровно 4 цифры";
    render();
    return;
  }

  const { greens, yellows } = scoreGuess(state.secret, guess);
  state.guesses.push({ guess, greens, yellows });
  state.error = null;

  if (greens === 4) {
    state.screen = "won";
    render();
    return;
  }

  input.value = "";
  render();
  document.getElementById("guess-code")?.focus();
}

function renderWon() {
  const attempts = state.guesses.length;
  app.innerHTML = `
    <section class="screen">
      <div class="reveal-zone reveal-zone--compact">
        <p class="word-display" style="color:var(--success)">Угадано!</p>
        <p class="room-code" style="font-size:2rem;margin:16px 0">${escapeHtml(state.secret)}</p>
        <p class="hint">Попыток: ${attempts}</p>
      </div>
      ${renderGuessHistory()}
      <button type="button" class="btn" id="play-again">Новая игра</button>
      <button type="button" class="btn btn-secondary" data-home>На главную</button>
    </section>
  `;

  document.getElementById("play-again").addEventListener("click", () => {
    state.secret = null;
    state.guesses = [];
    state.screen = "set-code";
    render();
  });
  document.querySelector("[data-home]").addEventListener("click", goHome);
}

function bindCodeInput(input) {
  input.addEventListener("input", () => {
    const pos = input.selectionStart;
    const cleaned = normalizeDigits(input.value);
    if (input.value !== cleaned) {
      input.value = cleaned;
      input.setSelectionRange(Math.min(pos, cleaned.length), Math.min(pos, cleaned.length));
    }
  });
}

function goHome() {
  state.screen = "home";
  state.secret = null;
  state.guesses = [];
  state.error = null;
  render();
}

render();
