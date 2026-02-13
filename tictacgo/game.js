const SIZE = 6;
const EMPTY = "";
const X = "X";
const O = "O";

const DIRECTIONS = [
  { dr: -1, dc: 0, key: "up" },
  { dr: 1, dc: 0, key: "down" },
  { dr: 0, dc: -1, key: "left" },
  { dr: 0, dc: 1, key: "right" },
];

const SEARCH_STEP_DELAY_MS = 6;
const PLAYBACK_STEP_DELAY_MS = 130;
const MAX_EXPANSIONS = 200000;
const RENDER_EVERY_N_EXPANSIONS = 2;

const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const solverStatsEl = document.getElementById("solverStats");
const resetBtn = document.getElementById("resetBtn");
const solveBtn = document.getElementById("solveBtn");

let board = [];
let player = { r: 2, c: 0 };
let gameOver = false;
let baselineXLines = new Set();
let isAutoSolving = false;
let solveRunId = 0;

class MinHeap {
  constructor() {
    this.items = [];
  }

  push(value) {
    this.items.push(value);
    this.bubbleUp(this.items.length - 1);
  }

  pop() {
    if (this.items.length === 0) return null;
    const top = this.items[0];
    const end = this.items.pop();
    if (this.items.length > 0) {
      this.items[0] = end;
      this.bubbleDown(0);
    }
    return top;
  }

  size() {
    return this.items.length;
  }

  bubbleUp(index) {
    let i = index;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.items[parent].f <= this.items[i].f) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  bubbleDown(index) {
    let i = index;
    while (true) {
      const left = i * 2 + 1;
      const right = i * 2 + 2;
      let smallest = i;

      if (left < this.items.length && this.items[left].f < this.items[smallest].f) {
        smallest = left;
      }
      if (right < this.items.length && this.items[right].f < this.items[smallest].f) {
        smallest = right;
      }
      if (smallest === i) break;
      [this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
      i = smallest;
    }
  }
}

function createEmptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
}

function cloneBoard(sourceBoard) {
  return sourceBoard.map((row) => [...row]);
}

function cloneState(state) {
  return {
    board: cloneBoard(state.board),
    player: { ...state.player },
  };
}

function boardToString(sourceBoard) {
  return sourceBoard.map((row) => row.join(".")).join("|");
}

function inBounds(r, c) {
  return r >= 0 && c >= 0 && r < SIZE && c < SIZE;
}

function setStatus(text, cls = "") {
  statusEl.className = `status ${cls}`.trim();
  statusEl.textContent = text;
}

function setSolverStats(text) {
  solverStatsEl.textContent = text;
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

function getLineKeys(piece, sourceBoard = board) {
  const dirs = [
    [0, 1],
    [1, 0],
  ];
  const keys = new Set();

  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (sourceBoard[r][c] !== piece) continue;
      for (const [dr, dc] of dirs) {
        const r2 = r + dr;
        const c2 = c + dc;
        const r3 = r + dr * 2;
        const c3 = c + dc * 2;
        if (
          inBounds(r3, c3) &&
          sourceBoard[r2][c2] === piece &&
          sourceBoard[r3][c3] === piece
        ) {
          keys.add(`${r},${c}|${dr},${dc}`);
        }
      }
    }
  }

  return [...keys];
}

function hasWin(sourceBoard, playerPos) {
  const dirs = [
    [0, 1],
    [1, 0],
  ];

  const isOAt = (r, c) => {
    if (playerPos && playerPos.r === r && playerPos.c === c) return true;
    return sourceBoard[r][c] === O;
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

function hasLoss(sourceBoard) {
  const xLines = getLineKeys(X, sourceBoard);
  return xLines.some((line) => !baselineXLines.has(line));
}

function checkGameState() {
  if (hasWin(board, player)) {
    gameOver = true;
    setStatus("You win: 3 O's in a row.", "win");
    updateControls();
    return;
  }
  if (hasLoss(board)) {
    gameOver = true;
    setStatus("You lose: 3 X's in a row.", "lose");
    updateControls();
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

function renderState(state) {
  boardEl.textContent = "";
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      const piece = state.board[r][c];
      if (piece === X || piece === O) {
        cell.appendChild(makePieceEl(piece));
      }
      if (state.player.r === r && state.player.c === c) {
        cell.appendChild(makePlayerEl());
      }
      boardEl.appendChild(cell);
    }
  }
}

function render() {
  renderState({ board, player });
}

function applyMoveToState(state, direction) {
  const nextR = state.player.r + direction.dr;
  const nextC = state.player.c + direction.dc;
  if (!inBounds(nextR, nextC)) return null;

  const nextState = cloneState(state);
  const target = nextState.board[nextR][nextC];

  if (target === EMPTY) {
    nextState.player = { r: nextR, c: nextC };
    return nextState;
  }

  const pushR = nextR + direction.dr;
  const pushC = nextC + direction.dc;
  const canPush = inBounds(pushR, pushC) && nextState.board[pushR][pushC] === EMPTY;
  if (!canPush) return null;

  nextState.board[pushR][pushC] = target;
  nextState.board[nextR][nextC] = EMPTY;
  nextState.player = { r: nextR, c: nextC };
  return nextState;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getReachable(boardState, start) {
  const reachable = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  const prev = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  const queue = [start];
  reachable[start.r][start.c] = true;

  for (let head = 0; head < queue.length; head += 1) {
    const cur = queue[head];
    for (const d of DIRECTIONS) {
      const nr = cur.r + d.dr;
      const nc = cur.c + d.dc;
      if (!inBounds(nr, nc) || reachable[nr][nc]) continue;
      if (boardState[nr][nc] !== EMPTY) continue;
      reachable[nr][nc] = true;
      prev[nr][nc] = cur;
      queue.push({ r: nr, c: nc });
    }
  }

  return { reachable, prev };
}

function pathFromPrev(prev, end) {
  const path = [];
  let cur = end;
  while (prev[cur.r][cur.c]) {
    path.push(cur);
    cur = prev[cur.r][cur.c];
  }
  path.push(cur);
  path.reverse();
  return path;
}

function canonicalRegionKey(boardState, playerPos) {
  const { reachable } = getReachable(boardState, playerPos);
  let minIdx = SIZE * SIZE;
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (!reachable[r][c]) continue;
      minIdx = Math.min(minIdx, r * SIZE + c);
    }
  }
  return `${boardToString(boardState)}@${minIdx}`;
}

function pushHeuristic(boardState, playerPos) {
  // The solver treats the player circle as an O for win detection.
  if (hasWin(boardState, playerPos)) return 0;
  let best = 0;

  for (let r = 0; r < SIZE; r += 1) {
    let run = 0;
    for (let c = 0; c < SIZE; c += 1) {
      run = boardState[r][c] === O ? run + 1 : 0;
      best = Math.max(best, run);
    }
  }
  for (let c = 0; c < SIZE; c += 1) {
    let run = 0;
    for (let r = 0; r < SIZE; r += 1) {
      run = boardState[r][c] === O ? run + 1 : 0;
      best = Math.max(best, run);
    }
  }

  return Math.max(0, 3 - best);
}

function generatePushNeighbors(state) {
  const neighbors = [];
  const { reachable, prev } = getReachable(state.board, state.player);

  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (!reachable[r][c]) continue;

      for (const d of DIRECTIONS) {
        const blockR = r + d.dr;
        const blockC = c + d.dc;
        const pushToR = blockR + d.dr;
        const pushToC = blockC + d.dc;
        if (!inBounds(blockR, blockC) || !inBounds(pushToR, pushToC)) continue;
        if (state.board[blockR][blockC] === EMPTY) continue;
        if (state.board[pushToR][pushToC] !== EMPTY) continue;

        const nextBoard = cloneBoard(state.board);
        nextBoard[pushToR][pushToC] = nextBoard[blockR][blockC];
        nextBoard[blockR][blockC] = EMPTY;
        const nextPlayer = { r: blockR, c: blockC };

        const walkPath = pathFromPrev(prev, { r, c });
        const walkMoves = [];
        for (let i = 1; i < walkPath.length; i += 1) {
          const pr = walkPath[i - 1];
          const cr = walkPath[i];
          walkMoves.push({ dr: cr.r - pr.r, dc: cr.c - pr.c });
        }
        walkMoves.push({ dr: d.dr, dc: d.dc });

        neighbors.push({
          state: { board: nextBoard, player: nextPlayer },
          replayMoves: walkMoves,
        });
      }
    }
  }

  return neighbors;
}

async function aStarSolveVisual(startState, runId) {
  const openHeap = new MinHeap();
  const bestG = new Map();
  let expansions = 0;

  const startKey = canonicalRegionKey(startState.board, startState.player);
  openHeap.push({
    state: startState,
    g: 0,
    f: pushHeuristic(startState.board, startState.player),
    parent: null,
    stepMoves: [],
  });
  bestG.set(startKey, 0);

  while (openHeap.size() > 0 && expansions < MAX_EXPANSIONS) {
    if (runId !== solveRunId) return { cancelled: true, replayMoves: null };

    const current = openHeap.pop();
    expansions += 1;

    if (expansions % RENDER_EVERY_N_EXPANSIONS === 0) {
      renderState(current.state);
      setStatus("Solver exploring combinations in real time...");
      setSolverStats(
        `Expanded: ${expansions} | Open: ${openHeap.size()} | Visited: ${bestG.size}`
      );
      await sleep(SEARCH_STEP_DELAY_MS);
    }

    if (hasWin(current.state.board, current.state.player)) {
      const replayMoves = [];
      const segments = [];
      let node = current;
      while (node && node.parent) {
        segments.push(node.stepMoves);
        node = node.parent;
      }
      segments.reverse();
      for (const seg of segments) {
        replayMoves.push(...seg);
      }
      return {
        cancelled: false,
        replayMoves,
        expansions,
        visited: bestG.size,
      };
    }
    if (hasLoss(current.state.board)) continue;

    const neighbors = generatePushNeighbors(current.state);
    for (const next of neighbors) {
      if (hasLoss(next.state.board)) continue;

      const key = canonicalRegionKey(next.state.board, next.state.player);
      const nextG = current.g + 1;
      const prevBest = bestG.get(key);
      if (prevBest !== undefined && prevBest <= nextG) continue;

      bestG.set(key, nextG);
      openHeap.push({
        state: next.state,
        g: nextG,
        f: nextG + pushHeuristic(next.state.board, next.state.player),
        parent: current,
        stepMoves: next.replayMoves,
      });
    }
  }

  return {
    cancelled: false,
    replayMoves: null,
    expansions,
    visited: bestG.size,
  };
}

function updateControls() {
  solveBtn.disabled = isAutoSolving || gameOver;
}

function tryMove(dr, dc) {
  if (gameOver || isAutoSolving) return false;
  const nextState = applyMoveToState({ board, player }, { dr, dc });
  if (!nextState) {
    setStatus("That block is blocked and cannot be pushed.");
    return false;
  }
  board = nextState.board;
  player = nextState.player;
  checkGameState();
  render();
  setSolverStats("Solver idle.");
  return true;
}

async function runAutoSolve() {
  if (gameOver || isAutoSolving) return;

  isAutoSolving = true;
  solveRunId += 1;
  const myRunId = solveRunId;
  updateControls();

  const startSnapshot = cloneState({ board, player });
  const result = await aStarSolveVisual(cloneState(startSnapshot), myRunId);

  if (myRunId !== solveRunId || result.cancelled) return;

  board = cloneBoard(startSnapshot.board);
  player = { ...startSnapshot.player };
  render();

  if (!result.replayMoves) {
    isAutoSolving = false;
    setStatus("No solution found from this position.");
    setSolverStats(
      `Expanded: ${result.expansions ?? 0} | Open: 0 | Visited: ${result.visited ?? 0}`
    );
    updateControls();
    return;
  }

  setStatus(`Solution found in ${result.replayMoves.length} moves. Replaying...`);

  for (const move of result.replayMoves) {
    if (myRunId !== solveRunId || gameOver) break;
    const nextState = applyMoveToState({ board, player }, move);
    if (!nextState) break;
    board = nextState.board;
    player = nextState.player;
    checkGameState();
    render();
    await sleep(PLAYBACK_STEP_DELAY_MS);
  }

  if (myRunId !== solveRunId) return;

  if (!gameOver) {
    setStatus("Solver replay finished.");
  }
  setSolverStats(
    `Expanded: ${result.expansions ?? 0} | Open: 0 | Visited: ${result.visited ?? 0}`
  );
  isAutoSolving = false;
  updateControls();
}

function resetGame() {
  solveRunId += 1;
  isAutoSolving = false;
  board = createEmptyBoard();
  player = { r: 2, c: 0 };
  gameOver = false;
  placeInitialPieces();
  baselineXLines = new Set(getLineKeys(X));
  setStatus("Line up 3 O's to win.");
  setSolverStats("Solver idle.");
  render();
  updateControls();
}

window.addEventListener("keydown", (event) => {
  if (isAutoSolving) return;
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
    event.preventDefault();
  }
  if (key === "arrowup" || key === "w") tryMove(-1, 0);
  if (key === "arrowdown" || key === "s") tryMove(1, 0);
  if (key === "arrowleft" || key === "a") tryMove(0, -1);
  if (key === "arrowright" || key === "d") tryMove(0, 1);
});

solveBtn.addEventListener("click", runAutoSolve);
resetBtn.addEventListener("click", resetGame);

resetGame();
