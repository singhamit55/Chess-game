/* =========================================================
   chess.js  —  Complete Chess Engine + UI Logic
   Mr.Singh  |  Features:
     ✔ Full Chess Rules (castling, en-passant, promotion)
     ✔ Minimax AI with alpha-beta pruning
     ✔ Sound Engine (Web Audio API — no files needed)
     ✔ ♟ Move History Panel (chess.com style)
     ✔ ⏮ Undo  /  ⏭ Redo
     ✔ 💡 Hint Move (highlights best from/to squares)
     ✔ 📊 Evaluation Bar (real-time position score)
     ✔ Confetti celebration on checkmate
     ✔ Algebraic Notation  (Nf3, O-O, exd5+, etc.)
   ========================================================= */
'use strict';

// ─────────────────────────────────────────────────────────
// CHESS ENGINE  —  data & pure functions
// ─────────────────────────────────────────────────────────
const UNI = {
  wK:"♔", wQ:"♕", wR:"♖", wB:"♗", wN:"♘", wP:"♙",
  bK:"♚", bQ:"♛", bR:"♜", bB:"♝", bN:"♞", bP:"♟"
};
const FILES = ["a","b","c","d","e","f","g","h"];

const pc  = p => p ? p[0] : null;           // piece colour  "w"|"b"
const pt  = p => p ? p[1] : null;           // piece type    "K"|"Q"|…
const opp = c => c === "w" ? "b" : "w";
const inB = (r,c) => r >= 0 && r < 8 && c >= 0 && c < 8;

function initBoard() {
  const b = Array(8).fill(null).map(() => Array(8).fill(null));
  b[0] = ["bR","bN","bB","bQ","bK","bB","bN","bR"];
  b[1] = Array(8).fill("bP");
  b[6] = Array(8).fill("wP");
  b[7] = ["wR","wN","wB","wQ","wK","wB","wN","wR"];
  return b;
}

function newGame() {
  return {
    board:     initBoard(),
    turn:      "w",
    status:    "playing",
    castling:  { wK:true, wKR:true, wQR:true, bK:true, bKR:true, bQR:true },
    enPassant: null,
    lastMove:  null,
    kingInCheck: false
  };
}

function attacked(board, byColor) {
  const s = new Set();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || pc(p) !== byColor) continue;
      const t = pt(p);
      if (t === "P") {
        const d = byColor === "w" ? -1 : 1;
        if (inB(r+d, c-1)) s.add(`${r+d},${c-1}`);
        if (inB(r+d, c+1)) s.add(`${r+d},${c+1}`);
      } else if (t === "N") {
        for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]])
          if (inB(r+dr, c+dc)) s.add(`${r+dr},${c+dc}`);
      } else if (t === "K") {
        for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]])
          if (inB(r+dr, c+dc)) s.add(`${r+dr},${c+dc}`);
      } else {
        const dirs = [];
        if (t === "R" || t === "Q") dirs.push([0,1],[0,-1],[1,0],[-1,0]);
        if (t === "B" || t === "Q") dirs.push([1,1],[1,-1],[-1,1],[-1,-1]);
        for (const [dr,dc] of dirs) {
          let nr = r+dr, nc = c+dc;
          while (inB(nr,nc)) {
            s.add(`${nr},${nc}`);
            if (board[nr][nc]) break;
            nr += dr; nc += dc;
          }
        }
      }
    }
  }
  return s;
}

function findKing(board, color) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c] === color + "K") return [r, c];
  return null;
}

function isInCheck(board, color) {
  const k = findKing(board, color);
  if (!k) return false;
  return attacked(board, opp(color)).has(`${k[0]},${k[1]}`);
}

function pseudoMoves(board, r, c, castling, enPassant) {
  const p = board[r][c];
  if (!p) return [];
  const col = pc(p), t = pt(p);
  const mvs = [];

  const slide = dirs => {
    for (const [dr,dc] of dirs) {
      let nr = r+dr, nc = c+dc;
      while (inB(nr,nc)) {
        if (pc(board[nr][nc]) === col) break;
        mvs.push([nr, nc, null]);
        if (board[nr][nc]) break;
        nr += dr; nc += dc;
      }
    }
  };

  if (t === "P") {
    const d = col === "w" ? -1 : 1, start = col === "w" ? 6 : 1;
    if (inB(r+d,c) && !board[r+d][c]) {
      mvs.push([r+d, c, null]);
      if (r === start && !board[r+2*d][c]) mvs.push([r+2*d, c, null]);
    }
    for (const dc of [-1,1]) {
      if (!inB(r+d, c+dc)) continue;
      if (board[r+d][c+dc] && pc(board[r+d][c+dc]) !== col) mvs.push([r+d, c+dc, null]);
      if (enPassant && enPassant[0] === r+d && enPassant[1] === c+dc) mvs.push([r+d, c+dc, "ep"]);
    }
  } else if (t === "N") {
    for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]])
      if (inB(r+dr,c+dc) && pc(board[r+dr][c+dc]) !== col) mvs.push([r+dr,c+dc,null]);
  } else if (t === "K") {
    for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]])
      if (inB(r+dr,c+dc) && pc(board[r+dr][c+dc]) !== col) mvs.push([r+dr,c+dc,null]);
    const br = col === "w" ? 7 : 0;
    if (r === br && c === 4) {
      const atk = attacked(board, opp(col));
      if (!atk.has(`${br},4`)) {
        const km = col === "w" ? castling.wK : castling.bK;
        if (km) {
          if ((col==="w"?castling.wKR:castling.bKR) && !board[br][5] && !board[br][6] && board[br][7]===col+"R" && !atk.has(`${br},5`) && !atk.has(`${br},6`))
            mvs.push([br, 6, "castle-k"]);
          if ((col==="w"?castling.wQR:castling.bQR) && !board[br][3] && !board[br][2] && !board[br][1] && board[br][0]===col+"R" && !atk.has(`${br},3`) && !atk.has(`${br},2`))
            mvs.push([br, 2, "castle-q"]);
        }
      }
    }
  } else if (t === "R") slide([[0,1],[0,-1],[1,0],[-1,0]]);
  else if   (t === "B") slide([[1,1],[1,-1],[-1,1],[-1,-1]]);
  else if   (t === "Q") slide([[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]);

  return mvs;
}

function legalMoves(gs, r, c) {
  const { board, castling, enPassant } = gs;
  const p = board[r][c];
  if (!p) return [];
  const col = pc(p);
  return pseudoMoves(board, r, c, castling, enPassant).filter(([nr,nc,sp]) => {
    const nb = board.map(row => [...row]);
    nb[nr][nc] = nb[r][c]; nb[r][c] = null;
    if (sp === "ep")       nb[col==="w"?nr+1:nr-1][nc] = null;
    if (sp === "castle-k") { const br=col==="w"?7:0; nb[br][5]=col+"R"; nb[br][7]=null; }
    if (sp === "castle-q") { const br=col==="w"?7:0; nb[br][3]=col+"R"; nb[br][0]=null; }
    return !isInCheck(nb, col);
  });
}

function applyMove(gs, fr, fc, tr, tc, special) {
  const board = gs.board.map(row => [...row]);
  const p = board[fr][fc];
  const col = pc(p), t = pt(p);
  let nc = { ...gs.castling };

  if (t === "K") {
    if (col === "w") { nc.wK=false; nc.wKR=false; nc.wQR=false; }
    else             { nc.bK=false; nc.bKR=false; nc.bQR=false; }
  }
  if (t === "R") {
    if (col==="w") { if(fr===7&&fc===7)nc.wKR=false; if(fr===7&&fc===0)nc.wQR=false; }
    else           { if(fr===0&&fc===7)nc.bKR=false; if(fr===0&&fc===0)nc.bQR=false; }
  }

  let mp = p;
  if (t === "P" && (tr === 0 || tr === 7)) mp = col + "Q"; // auto-promote

  board[tr][tc] = mp; board[fr][fc] = null;
  if (special === "ep")       board[col==="w"?tr+1:tr-1][tc] = null;
  if (special === "castle-k") { const br=col==="w"?7:0; board[br][5]=col+"R"; board[br][7]=null; }
  if (special === "castle-q") { const br=col==="w"?7:0; board[br][3]=col+"R"; board[br][0]=null; }

  const nep = (t==="P" && Math.abs(tr-fr)===2) ? [(fr+tr)/2, tc] : null;
  const nextTurn = opp(col);
  const chk = isInCheck(board, nextTurn);
  const tmpGs = { board, castling: nc, enPassant: nep };

  let hasMove = false;
  outer: for (let r=0; r<8; r++) for (let c=0; c<8; c++) {
    if (pc(board[r][c])===nextTurn && legalMoves(tmpGs,r,c).length>0) { hasMove=true; break outer; }
  }

  let status = "playing";
  if (!hasMove) status = chk ? (nextTurn==="w" ? "black_wins" : "white_wins") : "stalemate";

  return { board, turn:nextTurn, status, castling:nc, enPassant:nep, lastMove:[fr,fc,tr,tc], kingInCheck: chk && status==="playing" };
}

// ─────────────────────────────────────────────────────────
// AI ENGINE  —  minimax + alpha-beta
// ─────────────────────────────────────────────────────────
const PV = { P:100, N:320, B:330, R:500, Q:900, K:20000 };
const PST = {
  P:[[0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],[5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],[5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]],
  N:[[-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],[-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],[-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],[-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]],
  B:[[-20,-10,-10,-10,-10,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,10,10,5,0,-10],[-10,5,5,10,10,5,5,-10],[-10,0,10,10,10,10,0,-10],[-10,10,10,10,10,10,10,-10],[-10,5,0,0,0,0,5,-10],[-20,-10,-10,-10,-10,-10,-10,-20]],
  R:[[0,0,0,0,0,0,0,0],[5,10,10,10,10,10,10,5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[0,0,0,5,5,0,0,0]],
  Q:[[-20,-10,-10,-5,-5,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,5,5,5,0,-10],[-5,0,5,5,5,5,0,-5],[0,0,5,5,5,5,0,-5],[-10,5,5,5,5,5,0,-10],[-10,0,5,0,0,0,0,-10],[-20,-10,-10,-5,-5,-10,-10,-20]],
  K:[[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-20,-30,-30,-40,-40,-30,-30,-20],[-10,-20,-20,-20,-20,-20,-20,-10],[20,20,0,0,0,0,20,20],[20,30,10,0,0,10,30,20]]
};

function evalBoard(board) {
  let s = 0;
  for (let r=0; r<8; r++) for (let c=0; c<8; c++) {
    const p = board[r][c];
    if (!p) continue;
    const col=pc(p), t=pt(p), v=PV[t]||0, pr=col==="w"?r:7-r, pst=PST[t]?PST[t][pr][c]:0;
    s += col === "w" ? v+pst : -(v+pst);
  }
  return s;
}

function getAllMoves(gs, color) {
  const all = [];
  for (let r=0; r<8; r++) for (let c=0; c<8; c++) {
    if (pc(gs.board[r][c]) !== color) continue;
    for (const [tr,tc,sp] of legalMoves(gs,r,c)) all.push([r,c,tr,tc,sp]);
  }
  return all;
}

function minimax(gs, depth, alpha, beta, max) {
  if (gs.status !== "playing" || depth === 0) return evalBoard(gs.board);
  const mvs = getAllMoves(gs, max ? "w" : "b");
  if (!mvs.length) return evalBoard(gs.board);
  if (max) {
    let b = -Infinity;
    for (const [fr,fc,tr,tc,sp] of mvs) {
      b = Math.max(b, minimax(applyMove(gs,fr,fc,tr,tc,sp), depth-1, alpha, beta, false));
      alpha = Math.max(alpha, b);
      if (beta <= alpha) break;
    }
    return b;
  } else {
    let b = Infinity;
    for (const [fr,fc,tr,tc,sp] of mvs) {
      b = Math.min(b, minimax(applyMove(gs,fr,fc,tr,tc,sp), depth-1, alpha, beta, true));
      beta = Math.min(beta, b);
      if (beta <= alpha) break;
    }
    return b;
  }
}

function getBestMove(gs, aiColor, depth) {
  const mvs = getAllMoves(gs, aiColor);
  if (!mvs.length) return null;
  mvs.sort(() => Math.random() - 0.5); // shuffle for variety at equal scores
  const max = aiColor === "w";
  let bScore = max ? -Infinity : Infinity, bMove = null;
  for (const [fr,fc,tr,tc,sp] of mvs) {
    const score = minimax(applyMove(gs,fr,fc,tr,tc,sp), depth-1, -Infinity, Infinity, !max);
    if (max ? score > bScore : score < bScore) { bScore = score; bMove = [fr,fc,tr,tc,sp]; }
  }
  return bMove;
}

const AI_DEPTH = { easy: 1, medium: 2, hard: 3 };

// ─────────────────────────────────────────────────────────
// SOUND ENGINE  —  Web Audio API (zero external files)
// ─────────────────────────────────────────────────────────
let _muted = false;

function toggleMute() {
  _muted = !_muted;
  const btn = document.getElementById("btn-mute");
  if (btn) btn.textContent = _muted ? "🔇" : "🔊";
}
let _actx = null;

function getACtx() {
  if (!_actx) _actx = new (window.AudioContext || window.webkitAudioContext)();
  return _actx;
}

/** Play a simple synthesised tone */
function tone(freq, dur, type = 'square', vol = 0.16, delay = 0) {
  if (_muted) return;
  try {
    const ctx = getACtx();
    if (ctx.state === 'suspended') ctx.resume();
    const t   = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t); osc.stop(t + dur + 0.02);
  } catch (e) { /* silently ignore on unsupported browsers */ }
}

// Named sound events
function sndMove()    { tone(760, 0.045, 'square',   0.13); }
function sndCapture() { tone(300, 0.06,  'sawtooth', 0.22); tone(180, 0.12, 'sawtooth', 0.16, 0.055); }
function sndCheck()   { tone(540, 0.065, 'square',   0.26); tone(860, 0.12, 'square',   0.22, 0.09); }
function sndCastle()  { tone(640, 0.05,  'square',   0.15); tone(860, 0.08, 'square',   0.15, 0.075); }
function sndDraw()    { tone(440, 0.15,  'triangle', 0.22); tone(440, 0.15, 'triangle', 0.22, 0.24); }

function sndMate() {
  // Dramatic descending fanfare
  [[440,0.28],[370,0.28],[310,0.28],[220,0.38]].forEach(([f,d],i) => tone(f, d, 'sawtooth', 0.30, i*0.18));
}

function sndWin() {
  // Ascending triumphant arpeggio
  [[523,0.18],[659,0.18],[784,0.18],[1047,0.38]].forEach(([f,d],i) => tone(f, d, 'sine', 0.34, i*0.14));
}

// Unlock audio context on very first user gesture
document.addEventListener('click', () => { try { getACtx().resume(); } catch(e){} }, { once: true });
// ── Mute toggle ──────────────────────────────────────────
let muted= false;

function toggleMute() {
  _muted = !_muted;
  const btn = document.getElementById("btn-mute");
  if (btn) btn.textContent = _muted ? "🔇" : "🔊";
}
// ─────────────────────────────────────────────────────────
// ALGEBRAIC NOTATION
// ─────────────────────────────────────────────────────────
/**
 * Build standard algebraic notation for a move, including
 * disambiguation, capture symbol 'x', check '+' and mate '#'.
 */
function buildNotation(board, fr, fc, tr, tc, sp, isChk, isMate) {
  const sfx = isMate ? "#" : isChk ? "+" : "";
  if (sp === "castle-k") return "O-O"   + sfx;
  if (sp === "castle-q") return "O-O-O" + sfx;

  const p = board[fr][fc];
  if (!p) return "?";
  const t = pt(p);
  const isCapture = !!board[tr][tc] || sp === "ep";

  if (t === "P") {
    let n = isCapture ? FILES[fc] + "x" + FILES[tc] + (8-tr) : FILES[tc] + (8-tr);
    if (tr === 0 || tr === 7) n += "=Q";
    return n + sfx;
  }

  // Disambiguation for non-pawn pieces
  let ambig = false, sameFile = false, sameRank = false;
  const fakeCast = { wK:true,wKR:true,wQR:true,bK:true,bKR:true,bQR:true };
  for (let r=0; r<8; r++) for (let c=0; c<8; c++) {
    if (r===fr && c===fc) continue;
    if (board[r][c] !== board[fr][fc]) continue;
    if (pseudoMoves(board, r, c, fakeCast, null).some(m => m[0]===tr && m[1]===tc)) {
      ambig = true;
      if (c === fc) sameFile = true;
      if (r === fr) sameRank = true;
    }
  }

  let n = t;
  if (ambig) {
    if (!sameFile)       n += FILES[fc];
    else if (!sameRank)  n += (8-fr);
    else                 n += FILES[fc] + (8-fr);
  }
  if (isCapture) n += "x";
  n += FILES[tc] + (8-tr);
  return n + sfx;
}

// ─────────────────────────────────────────────────────────
// CONFETTI CELEBRATION
// ─────────────────────────────────────────────────────────
const CONFETTI_COLS = [
  "#ffd700","#fff3a0","#ff6b6b","#6bceff","#6bff9e",
  "#ffb347","#d4af37","#f0c040","#e8dcc8","#c0ff80","#ff80c0"
  ,"#1834ea","#f86306","#f40b0b","#e8f80b","#2310fa",
];
let _cfAf = null;

function startConfetti() {
  const canvas = document.getElementById("confetti");
  if (!canvas) return;
  const ctx  = canvas.getContext("2d");
  const wrap = document.getElementById("board-wrap");
  canvas.width  = wrap ? wrap.offsetWidth  : 500;
  canvas.height = wrap ? wrap.offsetHeight : 500;

  const pieces = Array.from({ length: 220 }, () => ({
    x:   Math.random() * canvas.width,
    y:   (Math.random() - 1.3) * canvas.height,
    w:   Math.random() * 14 + 5,
    h:   Math.random() * 7  + 3,
    ang: Math.random() * Math.PI * 2,
    spd: Math.random() * 3.5 + 1.5,
    rot: (Math.random() - 0.5) * 0.12,
    vx:  (Math.random() - 0.5) * 1.4,
    col: CONFETTI_COLS[Math.floor(Math.random() * CONFETTI_COLS.length)]
  }));

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.ang);
      ctx.fillStyle = p.col; ctx.globalAlpha = 0.9;
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
      p.y += p.spd; p.x += p.vx; p.ang += p.rot;
      if (p.y > canvas.height) { p.y = -14; p.x = Math.random() * canvas.width; }
    });
    frame++;
    if (frame < 700) _cfAf = requestAnimationFrame(draw);
    else stopConfetti();
  }
  if (_cfAf) cancelAnimationFrame(_cfAf);
  draw();
}

function stopConfetti() {
  if (_cfAf) { cancelAnimationFrame(_cfAf); _cfAf = null; }
  const c = document.getElementById("confetti");
  if (c) c.getContext("2d").clearRect(0, 0, c.width, c.height);
}

// ─────────────────────────────────────────────────────────
// TIMER
// ─────────────────────────────────────────────────────────
let timerInterval = null, clockW = 0, clockB = 0;
let moveCount = 0;
let moveLog   = [];   // algebraic notation strings  e.g. ["e4","e5","Nf3",…]

function formatTime(s) {
  return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
}

function startClock() {
  stopClock();
  if (!gs || gs.status !== "playing") return;
  timerInterval = setInterval(() => {
    if (!gs || gs.status !== "playing") { stopClock(); return; }
    if (gs.turn === "w") clockW++; else clockB++;
    renderClocks();
  }, 1000);
}

function stopClock()  {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function resetClocks() {
  stopClock();
  clockW = 0; clockB = 0; moveCount = 0; moveLog = [];
  renderClocks();
}

function renderClocks() {
  const cw = document.getElementById("clock-w");
  const cb = document.getElementById("clock-b");
  if (!cw || !cb) return;

  const playing = gs && gs.status === "playing";
  const wT = playing && gs.turn === "w";
  const bT = playing && gs.turn === "b";

  cw.textContent = formatTime(clockW);
  cb.textContent = formatTime(clockB);
  cw.className = "clock-time" + (wT ? " active" : bT ? " inactive" : "");
  cb.className = "clock-time" + (bT ? " active" : wT ? " inactive" : "");

  const fm = document.getElementById("move-count");
  if (fm) fm.textContent = Math.ceil(moveCount / 2);

  const mh = document.getElementById("move-history-mini");
  if (mh) mh.textContent = moveLog.slice(-4).join("  ");
}

// ─────────────────────────────────────────────────────────
// UI STATE
// ─────────────────────────────────────────────────────────
let gs          = null;
let mode        = null;          // "ai" | "local"
let playerColor = "w";
let aiColorG    = "b";
let difficultyG = "medium";
let selected    = null;          // [r, c] of selected square
let legalMvs    = [];            // legal target squares
let aiThinking  = false;
let cfgColor    = "w";
let cfgDiff     = "medium";

// Undo / redo stacks  — each entry = { gsStr, n, log }
let historyStack = [];
let redoStack    = [];

// Hint state
let hintSqs     = null;   // [fr, fc, tr, tc] or null
let hintTimer   = null;

// ── Save a snapshot before each human move ──────────────
function saveSnap() {
  historyStack.push({ gsStr: JSON.stringify(gs), n: moveCount, log: [...moveLog] });
  redoStack = [];
}

// ─────────────────────────────────────────────────────────
// SCREEN NAVIGATION
// ─────────────────────────────────────────────────────────
function show(id) {
  ["home","setup-ai","game"].forEach(s => {
    document.getElementById(s).style.display = "none";
  });
  const el = document.getElementById(id);
  el.style.display = "flex";
  el.classList.remove("screen"); void el.offsetWidth; el.classList.add("screen");
}

function showSetupAI() { show("setup-ai"); updateColorBtns(); updateDiffBtns(); }
function selColor(c)   { cfgColor = c; updateColorBtns(); }
function selDiff(d)    { cfgDiff  = d; updateDiffBtns(); }

function updateColorBtns() {
  document.getElementById("btn-white").className = cfgColor==="w" ? "btn-gold" : "btn-out";
  document.getElementById("btn-black").className = cfgColor==="b" ? "btn-gold" : "btn-out";
}
function updateDiffBtns() {
  ["easy","medium","hard"].forEach(v => {
    document.getElementById("btn-"+v).className = cfgDiff===v ? "btn-gold" : "btn-out";
  });
}

// ─────────────────────────────────────────────────────────
// GAME START / RESET
// ─────────────────────────────────────────────────────────
function startAI() {
  playerColor = cfgColor; aiColorG = opp(cfgColor); difficultyG = cfgDiff; mode = "ai";
  gs = newGame(); selected = null; legalMvs = []; historyStack = []; redoStack = []; hintSqs = null;
  document.getElementById("player-badge").textContent = playerColor === "w" ? "♔" : "♚";
  document.getElementById("mode-label").textContent   = "VS COMPUTER";
  document.getElementById("diff-badge").textContent   = difficultyG.toUpperCase();
  stopConfetti(); resetClocks();
  show("game"); renderAll(); renderFooter(); startClock();
  if (gs.turn === aiColorG) scheduleAI();
}

function startLocal() {
  mode = "local"; gs = newGame(); selected = null; legalMvs = [];
  historyStack = []; redoStack = []; hintSqs = null; playerColor = "w";
  document.getElementById("player-badge").textContent = "♟";
  document.getElementById("mode-label").textContent   = "LOCAL 2 PLAYERS";
  document.getElementById("diff-badge").textContent   = "";
  stopConfetti(); resetClocks();
  show("game"); renderAll(); renderFooter(); startClock();
}

function resetHome() {
  stopClock(); stopConfetti();
  gs = null; selected = null; legalMvs = []; aiThinking = false;
  show("home");
}

// ─────────────────────────────────────────────────────────
// UNDO
// ─────────────────────────────────────────────────────────
function undoMove() {
  if (!historyStack.length || aiThinking) return;
  redoStack.push({ gsStr: JSON.stringify(gs), n: moveCount, log: [...moveLog] });
  const prev = historyStack.pop();
  gs = JSON.parse(prev.gsStr); moveCount = prev.n; moveLog = [...prev.log];
  selected = null; legalMvs = []; hintSqs = null;
  stopConfetti();
  const wm = document.getElementById("win-message");
  if (wm) wm.style.display = "none";
  renderAll(); renderFooter();
  if (gs.status === "playing") startClock(); else stopClock();
}

// ─────────────────────────────────────────────────────────
// REDO
// ─────────────────────────────────────────────────────────
function redoMove() {
  if (!redoStack.length || aiThinking) return;
  historyStack.push({ gsStr: JSON.stringify(gs), n: moveCount, log: [...moveLog] });
  const nxt = redoStack.pop();
  gs = JSON.parse(nxt.gsStr); moveCount = nxt.n; moveLog = [...nxt.log];
  selected = null; legalMvs = []; hintSqs = null;
  renderAll(); renderFooter();
  if (gs.status === "playing") {
    startClock();
    if (mode === "ai" && gs.turn === aiColorG) scheduleAI();
  } else stopClock();
}

// ─────────────────────────────────────────────────────────
// HINT  —  highlight best move for current player
// ─────────────────────────────────────────────────────────
function showHint() {
  if (!gs || gs.status !== "playing" || aiThinking) return;
  if (hintTimer) clearTimeout(hintTimer);
  const col = mode === "ai" ? playerColor : gs.turn;
  setStatus("💡 Computing hint…", "#6a8aaa");
  setTimeout(() => {
    const best = getBestMove(gs, col, Math.min(AI_DEPTH[difficultyG] || 2, 2));
    if (!best) { updateStatus(); return; }
    hintSqs = best.slice(0, 4); // [fr, fc, tr, tc]
    renderBoard();
    hintTimer = setTimeout(() => {
      hintSqs = null;
      renderBoard();
      updateStatus();
    }, 3000);
  }, 10);
}

// ─────────────────────────────────────────────────────────
// AI SCHEDULING
// ─────────────────────────────────────────────────────────
function scheduleAI() {
  if (aiThinking) return;
  aiThinking = true;
  setStatus("🤖 AI is thinking…", "#6a8aaa");
  setTimeout(() => {
    const best = getBestMove(gs, aiColorG, AI_DEPTH[difficultyG] || 2);
    if (best) {
      const [fr, fc, tr, tc, sp] = best;
      const prevBoard  = gs.board.map(r => [...r]);
      const wasCapture = !!gs.board[tr][tc] || sp === "ep";
      const wasCastle  = sp === "castle-k" || sp === "castle-q";

      gs = applyMove(gs, fr, fc, tr, tc, sp);
      const label = buildNotation(prevBoard, fr, fc, tr, tc, sp, gs.kingInCheck, gs.status !== "playing");
      moveCount++; moveLog.push(label);

      // Play appropriate sound
      if (gs.status !== "playing" && gs.status !== "stalemate") { sndMate(); setTimeout(sndWin, 750); }
      else if (gs.status === "stalemate")                        { sndDraw(); }
      else if (gs.kingInCheck)                                   { sndCheck(); }
      else if (wasCastle)                                        { sndCastle(); }
      else if (wasCapture)                                       { sndCapture(); }
      else                                                       { sndMove(); }
    }
    aiThinking = false; selected = null; legalMvs = [];
    renderAll(); renderFooter();
    if (gs.status === "playing") startClock(); else stopClock();
    if (gs.status === "playing" && gs.turn === aiColorG) scheduleAI();
  }, 380);
}

// ─────────────────────────────────────────────────────────
// PLAYER CLICK HANDLER
// ─────────────────────────────────────────────────────────
function onSquareClick(r, c) {
  if (!gs || gs.status !== "playing" || aiThinking) return;
  if (mode === "ai" && gs.turn !== playerColor) return;

  const p = gs.board[r][c];
  const myColor = mode === "local" ? gs.turn : playerColor;

  if (selected) {
    const mv = legalMvs.find(m => m[0] === r && m[1] === c);
    if (mv) {
      const prevBoard  = gs.board.map(row => [...row]);
      const wasCapture = !!gs.board[r][c] || mv[2] === "ep";
      const wasCastle  = mv[2] === "castle-k" || mv[2] === "castle-q";

      saveSnap();
      gs = applyMove(gs, selected[0], selected[1], r, c, mv[2]);
      const label = buildNotation(prevBoard, selected[0], selected[1], r, c, mv[2], gs.kingInCheck, gs.status !== "playing");
      moveCount++; moveLog.push(label);

      // Sound
      if (gs.status !== "playing" && gs.status !== "stalemate") { sndMate(); setTimeout(sndWin, 750); }
      else if (gs.status === "stalemate")                        { sndDraw(); }
      else if (gs.kingInCheck)                                   { sndCheck(); }
      else if (wasCastle)                                        { sndCastle(); }
      else if (wasCapture)                                       { sndCapture(); }
      else                                                       { sndMove(); }

      selected = null; legalMvs = []; hintSqs = null;
      if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }

      renderAll(); renderFooter();
      if (gs.status === "playing") startClock(); else stopClock();
      if (mode === "ai" && gs.status === "playing" && gs.turn === aiColorG) scheduleAI();
      return;
    }
    if (p && pc(p) === myColor) {
      selected = [r, c]; legalMvs = legalMoves(gs, r, c); renderBoard(); return;
    }
    selected = null; legalMvs = []; renderBoard(); return;
  }
  if (p && pc(p) === myColor) {
    selected = [r, c]; legalMvs = legalMoves(gs, r, c); renderBoard();
  }
}

// ─────────────────────────────────────────────────────────
// STATUS LINE
// ─────────────────────────────────────────────────────────
function setStatus(txt, color) {
  const el = document.getElementById("status");
  if (el) { el.textContent = txt; el.style.color = color || "#7a6a50"; }
}

function updateStatus() {
  if (!gs) return;
  const { status, turn, kingInCheck } = gs;
  const wm = document.getElementById("win-message");

  if (status === "white_wins") {
    const aiWon = mode === "ai" && aiColorG === "w";
    setStatus(aiWon ? "🤖 AI wins by checkmate!" : "♔ White wins by checkmate!", "#d4af37");
    if (wm) { wm.style.display = "flex"; wm.textContent = aiWon ? "AI WINS! 🤖" : "WHITE WINS ♔"; }
    startConfetti();
    return;
  }
  if (status === "black_wins") {
    const aiWon = mode === "ai" && aiColorG === "b";
    setStatus(aiWon ? "🤖 AI wins by checkmate!" : "♚ Black wins by checkmate!", "#d4af37");
    if (wm) { wm.style.display = "flex"; wm.textContent = aiWon ? "AI WINS! 🤖" : "BLACK WINS ♚"; }
    startConfetti();
    return;
  }
  if (status === "stalemate") {
    setStatus("½ Draw — Stalemate", "#c0a030");
    if (wm) { wm.style.display = "flex"; wm.textContent = "DRAW  ½"; }
    return;
  }
  if (wm) wm.style.display = "none";

  if (kingInCheck) {
    setStatus(`${turn === "w" ? "♔ White" : "♚ Black"} is in CHECK!`, "#e05050");
    return;
  }
  if (mode === "ai" && turn === aiColorG) { setStatus("🤖 AI's turn", "#4a8a6a"); return; }
  setStatus(`${turn === "w" ? "♔ White" : "♚ Black"} to move`, "#7a6a50");
}

// ─────────────────────────────────────────────────────────
// ♟ MOVE HISTORY PANEL
// ─────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────
// Update undo/hint button states for both sides
// ─────────────────────────────────────────────────────────
function updateControlButtons() {
  const canUndo = historyStack.length > 0 && !aiThinking;

  // In AI mode: only the human player's undo is active
  // In local mode: both sides share the same undo stack
  const wCanUndo = canUndo && (mode === "local" || playerColor === "w");
  const bCanUndo = canUndo && (mode === "local" || playerColor === "b");

  const buw = document.getElementById("btn-undo-w");
  const bub = document.getElementById("btn-undo-b");
  const bhw = document.getElementById("btn-hint-w");
  const bhb = document.getElementById("btn-hint-b");

  if (buw) buw.disabled = !wCanUndo;
  if (bub) bub.disabled = !bCanUndo;

  // Hint buttons: disabled when game over or AI is thinking
  const playing = gs && gs.status === "playing" && !aiThinking;
  const wHint = playing && (mode === "local" || playerColor === "w");
  const bHint = playing && (mode === "local" || playerColor === "b");
  if (bhw) bhw.disabled = !wHint;
  if (bhb) bhb.disabled = !bHint;
}

// ─────────────────────────────────────────────────────────
// 📊 EVALUATION BAR
// ─────────────────────────────────────────────────────────
function updateEvalBar() {
  if (!gs) return;
  const raw = evalBoard(gs.board);
  let score = raw;
  if (gs.status === "white_wins") score =  9999;
  if (gs.status === "black_wins") score = -9999;

  // Map score → white-fill percentage: centre=50%, ±700cp = ±50%
  const clamped = Math.max(-700, Math.min(700, score));
  const wPct    = 50 + clamped / 14;

  const fill  = document.getElementById("eval-white-fill");
  const label = document.getElementById("eval-score");

  if (fill)  fill.style.width = wPct.toFixed(1) + "%";
  if (label) {
    if      (score >=  9999) { label.textContent = "+M"; label.style.color = "#d4af37"; }
    else if (score <= -9999) { label.textContent = "−M"; label.style.color = "#888"; }
    else {
      const d = (raw / 100).toFixed(1);
      label.textContent = raw >= 0 ? "+" + d : d;
      label.style.color = raw > 20 ? "#d4af37" : raw < -20 ? "#999" : "#888";
    }
  }
}

// ─────────────────────────────────────────────────────────
// BOARD RENDERING
// ─────────────────────────────────────────────────────────
function renderBoard() {
  if (!gs) return;
  const flip  = mode === "ai" && playerColor === "b";
  const rows  = flip ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];
  const cols  = flip ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
  const files = flip ? ["h","g","f","e","d","c","b","a"] : ["a","b","c","d","e","f","g","h"];
  const ranks = flip ? ["1","2","3","4","5","6","7","8"] : ["8","7","6","5","4","3","2","1"];

  const kingPos   = gs.kingInCheck ? findKing(gs.board, gs.turn) : null;
  const { board, lastMove } = gs;

  // Coordinate labels
  ["files-top","files-bot"].forEach(id => {
    const el = document.getElementById(id); if (!el) return; el.innerHTML = "";
    files.forEach(f => { const d = document.createElement("div"); d.className="coord-file"; d.textContent=f; el.appendChild(d); });
  });
  const rl = document.getElementById("ranks-left");
  if (rl) {
    rl.innerHTML = "";
    ranks.forEach(rk => { const d = document.createElement("div"); d.className="coord-rank"; d.textContent=rk; rl.appendChild(d); });
  }

  const brd = document.getElementById("board"); if (!brd) return; brd.innerHTML = "";

  for (const r of rows) {
    for (const c of cols) {
      const light      = (r+c) % 2 === 0;
      const piece      = board[r][c];
      const isSel      = selected && selected[0]===r && selected[1]===c;
      const isTarget   = legalMvs.some(m => m[0]===r && m[1]===c);
      const isLast     = lastMove && ((lastMove[0]===r && lastMove[1]===c) || (lastMove[2]===r && lastMove[3]===c));
      const isChk      = kingPos && kingPos[0]===r && kingPos[1]===c;
      const isHintFrom = hintSqs && hintSqs[0]===r && hintSqs[1]===c;
      const isHintTo   = hintSqs && hintSqs[2]===r && hintSqs[3]===c;

      // Square background
      let bg = light ? "#f0d9b5" : "#b58863";
      if      (isSel)                   bg = light ? "#9dd07a" : "#5c9e3a";
      else if (isHintFrom || isHintTo)  bg = light ? "#a8d8f8" : "#5a9fc0";
      else if (isLast)                  bg = light ? "#e0c070" : "#a89042";
      if (isChk) bg = "#b83030";

      const sq = document.createElement("div");
      sq.className = "sq";
      sq.style.background = bg;
      sq.onclick = () => onSquareClick(r, c);

      if (isHintFrom) sq.classList.add("hint-from");
      if (isHintTo)   sq.classList.add("hint-to");

      if (isTarget) {
        const hint = document.createElement("div");
        hint.className = piece ? "hint-cap" : "hint-dot";
        sq.appendChild(hint);
      }
      if (piece) {
        const span = document.createElement("span");
        span.className = `piece ${pc(piece)==="w" ? "white" : "black"}${isSel ? " selected-piece" : ""}`;
        span.textContent = UNI[piece];
        sq.appendChild(span);
      }
      brd.appendChild(sq);
    }
  }
}

// ─────────────────────────────────────────────────────────
// FOOTER  (game-over summary + play-again)
// ─────────────────────────────────────────────────────────
function renderFooter() {
  const f = document.getElementById("game-footer");
  if (!f) return;
  f.innerHTML = "";
  if (!gs || gs.status === "playing") return;

  const fm = Math.ceil(moveCount / 2);
  const summary = document.createElement("div");
  summary.style.cssText = "font-size:0.62rem;letter-spacing:0.12em;color:#6a5a30;text-align:center;width:100%;padding:0.15rem 0";
  summary.textContent = `Game over · ${fm} move${fm!==1?"s":""} · ♔ ${formatTime(clockW)}  ♚ ${formatTime(clockB)}`;
  f.appendChild(summary);

  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:0.75rem";
  const b1 = document.createElement("button");
  b1.className = "btn-gold"; b1.textContent = "▶ Play Again";
  b1.onclick = () => { if (mode === "ai") startAI(); else startLocal(); };
  const b2 = document.createElement("button");
  b2.className = "btn-out"; b2.textContent = "← Menu";
  b2.onclick = resetHome;
  row.appendChild(b1); row.appendChild(b2);
  f.appendChild(row);
}

// ─────────────────────────────────────────────────────────
// RENDER ALL  — convenience wrapper
// ─────────────────────────────────────────────────────────
function renderAll() {
  renderBoard();
  updateStatus();
  renderClocks();
  updateControlButtons();
  updateEvalBar();
}

// ─────────────────────────────────────────────────────────
// INIT  — set defaults visible on setup screen
// ─────────────────────────────────────────────────────────
(function init() {
  updateColorBtns();
  updateDiffBtns();
})();
