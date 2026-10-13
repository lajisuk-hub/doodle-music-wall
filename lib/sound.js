// 칸딘스키처럼 그림을 소리로 바꾼다. 소리 파일 없이 브라우저에서 바로 만든다.
// 색깔마다 악기가 다르고, 화면 위쪽일수록 높은 음(도레미솔라 5음계라 아무렇게나 그려도 어울림).
let ctx = null, master = null;
export function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createDynamicsCompressor(); // 여러 음이 겹쳐도 소리가 깨지지 않게
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}
const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// 색 6가지 = 악기 6가지
export const COLORS = [
  { c: "#ff4d4d", name: "빨강", inst: "piano", label: "피아노" },
  { c: "#ff9f1c", name: "주황", inst: "marimba", label: "마림바" },
  { c: "#ffd60a", name: "노랑", inst: "bell", label: "종소리" },
  { c: "#2ec27e", name: "초록", inst: "flute", label: "피리" },
  { c: "#3a86ff", name: "파랑", inst: "bass", label: "콘트라베이스" },
  { c: "#9b5de5", name: "보라", inst: "strings", label: "바이올린" },
];

// 도레미솔라 × 3옥타브 (아래 → 위)
const SCALE = [0, 2, 4, 7, 9];
const BASE = { piano: 60, marimba: 60, bell: 72, flute: 67, bass: 36, strings: 55 };
export function noteForY(y, inst) { // y: 0(위)~1(아래)
  const steps = 12;
  const k = Math.max(0, Math.min(steps - 1, Math.floor((1 - y) * steps)));
  return BASE[inst] + Math.floor(k / 5) * 12 + SCALE[k % 5];
}

export function playNote(midi, inst = "piano", when, vol = 1) {
  const ac = audio();
  const t0 = when ?? ac.currentTime;
  const f = freq(midi);
  const out = ac.createGain();
  out.connect(master);
  const V = {
    piano: { v: [[1, 1, "triangle"], [2, 0.35, "sine"], [3, 0.12, "sine"]], a: 0.008, d: 1.4, p: 0.45 },
    marimba: { v: [[1, 1, "sine"], [4, 0.3, "sine"]], a: 0.004, d: 0.6, p: 0.55 },
    bell: { v: [[1, 1, "sine"], [2.76, 0.45, "sine"], [5.4, 0.2, "sine"]], a: 0.003, d: 2.2, p: 0.35 },
    flute: { v: [[1, 1, "sine"], [2, 0.12, "sine"]], a: 0.07, d: 0.7, p: 0.4 },
    bass: { v: [[1, 1, "triangle"], [2, 0.4, "sine"]], a: 0.01, d: 0.9, p: 0.7 },
    strings: { v: [[1, 1, "sawtooth"], [1.006, 0.8, "sawtooth"]], a: 0.12, d: 0.9, p: 0.18 },
  }[inst] || { v: [[1, 1, "sine"]], a: 0.01, d: 1, p: 0.4 };
  const peak = V.p * vol;
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.linearRampToValueAtTime(peak, t0 + V.a);
  out.gain.exponentialRampToValueAtTime(0.001, t0 + V.a + V.d);
  let dest = out;
  if (inst === "strings") { // 톱니파는 부드럽게 깎아서
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1800; lp.connect(out); dest = lp;
  }
  for (const [mul, amp, type] of V.v) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = f * mul; g.gain.value = amp / V.v.length;
    if (inst === "flute") { const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 5; lg.gain.value = f * 0.006; lfo.connect(lg).connect(o.frequency); lfo.start(t0); lfo.stop(t0 + V.a + V.d + 0.1); }
    o.connect(g).connect(dest);
    o.start(t0); o.stop(t0 + V.a + V.d + 0.1);
  }
}

// 그림(선 목록) → 악보. 화면을 COLS칸으로 나눠 칸마다 선이 지나가는 높이의 음을 낸다.
export const COLS = 32;
export function scoreOf(strokes) {
  const ev = [];
  for (const s of strokes || []) {
    const inst = COLORS[s.c]?.inst || "piano";
    const cols = new Map();
    for (const [x, y] of s.p) {
      const col = Math.max(0, Math.min(COLS - 1, Math.floor(x * COLS)));
      if (!cols.has(col)) cols.set(col, []);
      cols.get(col).push(y);
    }
    for (const [col, ys] of cols) {
      const y = ys.reduce((a, b) => a + b, 0) / ys.length;
      ev.push({ col, n: noteForY(y, inst), inst });
    }
  }
  // 한 칸에 너무 많은 음이 몰리면 시끄러우니 서로 다른 음 5개까지만
  const out = [];
  for (let col = 0; col < COLS; col++) {
    const seen = new Set();
    for (const e of ev.filter((e) => e.col === col)) {
      const k = e.inst + e.n;
      if (seen.has(k) || seen.size >= 5) continue;
      seen.add(k); out.push(e);
    }
  }
  return out;
}

// 연주: dur초 동안 왼쪽→오른쪽. onFrame(0~1)로 빛줄 위치를 알려 준다. 멈추는 함수를 돌려준다.
export function playScore(strokes, { dur = 7, onFrame, onEnd } = {}) {
  const ac = audio();
  const start = ac.currentTime + 0.1;
  const score = scoreOf(strokes);
  const vol = Math.min(1, 3 / Math.sqrt(Math.max(1, score.length / COLS + 1)));
  for (const e of score) playNote(e.n, e.inst, start + (e.col / COLS) * dur, vol);
  let raf = 0, stopped = false;
  const tick = () => {
    if (stopped) return;
    const t = (ac.currentTime - start) / dur;
    onFrame && onFrame(Math.max(0, Math.min(1, t)));
    if (t >= 1) { onEnd && onEnd(); return; }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => { stopped = true; cancelAnimationFrame(raf); master.disconnect(); master = ac.createDynamicsCompressor(); master.connect(ac.destination); };
}
