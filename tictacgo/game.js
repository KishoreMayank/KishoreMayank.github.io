const SIZE = 6;
const EMPTY = "";
const X = "X";
const O = "O";

const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const resetBtn = document.getElementById("resetBtn");

let board = [];
let player = { r: 2, c: 0 };
let gameOver = false;
let baselineXLines = new Set();

function createEmptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
}

function placeInitialPieces() {
  board[0][2] = X;
  board[1][1] = X;
  board[1][4] = X;
  board[2][2] = X;
  board[2][3] = X;
  board[3][0] = X;
  board[3][4] = X;
  board[3][5] = X;
  board[4][1] = X;
  board[4][3] = X;
  board[4][5] = X;
  board[5][0] = X;

  board[2][4] = O;
  board[4][4] = O;
}

function resetGame() {
  board = createEmptyBoard();
  player = { r: 2, c: 0 };
  gameOver = false;
  placeInitialPieces();
  baselineXLines = new Set(getLineKeys(X));
  setStatus("Line up 3 O's to win.");
  render();
}

function inBounds(r, c) {
  return r >= 0 && c >= 0 && r < SIZE && c < SIZE;
}

function setStatus(text, cls = "") {
  statusEl.className = `status ${cls}`.trim();
  statusEl.textContent = text;
}

function getLineKeys(piece) {
  const dirs = [
    [0, 1],
    [1, 0],
  ];
  const keys = new Set();

  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (board[r][c] !== piece) continue;
      for (const [dr, dc] of dirs) {
        const r2 = r + dr;
        const c2 = c + dc;
        const r3 = r + dr * 2;
        const c3 = c + dc * 2;

        if (
          inBounds(r3, c3) &&
          board[r2][c2] === piece &&
          board[r3][c3] === piece
        ) {
          keys.add(`${r},${c}|${dr},${dc}`);
        }
      }
    }
  }

  return [...keys];
}

function hasWin() {
  const dirs = [
    [0, 1],
    [1, 0],
  ];

  const isOAt = (r, c) => {
    if (player.r === r && player.c === c) return true;
    return board[r][c] === O;
  };

  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (!isOAt(r, c)) continue;
      for (const [dr, dc] of dirs) {
        const r2 = r + dr;
        const c2 = c + dc;
        const r3 = r + dr * 2;
        const c3 = c + dc * 2;
        if (inBounds(r3, c3) && isOAt(r2, c2) && isOAt(r3, c3)) {
          return true;
        }
      }
    }
  }
  return false;
}

function hasLoss() {
  const xLines = getLineKeys(X);
  return xLines.some((line) => !baselineXLines.has(line));
}

function checkGameState() {
  if (hasWin()) {
    gameOver = true;
    setStatus("You win: 3 O's in a row.", "win");
    return;
  }
  if (hasLoss()) {
    gameOver = true;
    setStatus("You lose: 3 X's in a row.", "lose");
    return;
  }
  setStatus("Keep pushing blocks. Make 3 O's before X lines up.");
}

function makePlayerEl() {
  const playerEl = document.createElement("div");
  playerEl.className = "player";

  const leftEye = document.createElement("span");
  leftEye.className = "eye left";
  const rightEye = document.createElement("span");
  rightEye.className = "eye right";

  playerEl.append(leftEye, rightEye);
  return playerEl;
}

function makePieceEl(type) {
  const el = document.createElement("div");
  el.className = `piece ${type.toLowerCase()}`;
  return el;
}

function render() {
  boardEl.textContent = "";
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";

      const piece = board[r][c];
      if (piece === X || piece === O) {
        cell.appendChild(makePieceEl(piece));
      }

      if (player.r === r && player.c === c) {
        cell.appendChild(makePlayerEl());
      }

      boardEl.appendChild(cell);
    }
  }
}

function tryMove(dr, dc) {
  if (gameOver) return;

  const nextR = player.r + dr;
  const nextC = player.c + dc;
  if (!inBounds(nextR, nextC)) return;

  const target = board[nextR][nextC];

  if (target === EMPTY) {
    player = { r: nextR, c: nextC };
    render();
    checkGameState();
    return;
  }

  const pushR = nextR + dr;
  const pushC = nextC + dc;
  const canPush = inBounds(pushR, pushC) && board[pushR][pushC] === EMPTY;

  if (!canPush) {
    setStatus("That block is blocked and cannot be pushed.");
    return;
  }

  board[pushR][pushC] = target;
  board[nextR][nextC] = EMPTY;
  player = { r: nextR, c: nextC };
  render();
  checkGameState();
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
    event.preventDefault();
  }

  if (key === "arrowup" || key === "w") tryMove(-1, 0);
  if (key === "arrowdown" || key === "s") tryMove(1, 0);
  if (key === "arrowleft" || key === "a") tryMove(0, -1);
  if (key === "arrowright" || key === "d") tryMove(0, 1);
});

resetBtn.addEventListener("click", resetGame);

resetGame();
