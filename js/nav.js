const GAMES = [
  { id: "spy", href: "index.html", title: "Шпион", icon: "img/spy.svg" },
  { id: "code", href: "code.html", title: "Код", icon: "img/code.svg" },
];

export function initGameNav(activeId) {
  const nav = document.getElementById("game-nav");
  if (!nav) return;

  nav.className = "game-nav";
  nav.setAttribute("aria-label", "Переключение игр");
  nav.innerHTML = GAMES.map((game) => {
    const isActive = game.id === activeId;
    return `
      <a href="${game.href}" class="game-nav__link${isActive ? " is-active" : ""}"${isActive ? ' aria-current="page"' : ""}>
        <img class="game-nav__icon" src="${game.icon}" alt="" width="36" height="36" decoding="async" />
        <span class="game-nav__title">${game.title}</span>
      </a>`;
  }).join("");
}
