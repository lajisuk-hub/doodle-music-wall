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

// ── 그린 순서·빠르기 그대로 연주하기 ─────────────────────
// 선 위를 펜이 STEP만큼 지나갈 때마다 한 음(높이 = 음 높낮이, 색 = 악기).
// 빨리 그린 선은 음이 빨리, 천천히 그린 선은 음이 천천히 나온다. 그릴 때 나는 소리와 같은 규칙.
export const STEP = 0.035;   // 이만큼 움직일 때마다 한 음 (도화지 폭 기준)
export const MIN_GAP = 70;   // 한 선에서 음과 음 사이 최소 간격(ms) — 너무 빠르면 시끄러워서
const dist = (a, b) => Math.hypot(a[0] - b[0], (a[1] - b[1]) * 0.5625);
const GAP_MAX = 600;         // 선과 선 사이 쉬는 시간은 최대 0.6초로 줄여서
const MAX_DUR = 30000;       // 아주 오래 그렸으면 30초 안에 끝나게 빠르게

// 선 목록 → 시간표 {timed:[{...선, pts:[[x,y,절대ms]]}], events:[{t,n,inst}], dur}
export function timeline(strokes) {
  // 1) 선마다 그 선 안의 시간(ms). 예전 그림(시간 기록 없음)은 보통 빠르기로 그린 것처럼
  const list = (strokes || []).filter((s) => s.p?.length).map((s) => {
    let rel = s.p.map((q) => q[2]);
    if (rel.some((v) => v == null)) { rel = [0]; for (let i = 1; i < s.p.length; i++) rel.push(rel[i - 1] + (dist(s.p[i - 1], s.p[i]) / 0.6) * 1000); }
    return { s, rel };
  });
  // 2) 언제 그렸는지(t0). 없으면 앞 선이 끝나고 0.25초 뒤로
  let fake = 0;
  for (const it of list) { it.t0 = it.s.t0 != null ? it.s.t0 : fake; fake = it.t0 + it.rel[it.rel.length - 1] + 250; }
  // 3) 같이 그린 선은 같이, 오래 쉰 시간만 GAP_MAX로 줄인다
  const order = [...list].sort((a, b) => a.t0 - b.t0);
  let shift = 0, end = null;
  for (const it of order) {
    if (end != null && it.t0 > end + GAP_MAX) shift += it.t0 - end - GAP_MAX;
    if (end == null) shift = it.t0;
    it.start = it.t0 - shift;
    end = Math.max(end ?? -1e9, it.t0 + it.rel[it.rel.length - 1]);
  }
  const timed = list.map((it) => ({ ...it.s, pts: it.s.p.map((q, i) => [q[0], q[1], it.start + it.rel[i]]) }));
  const cursor = timed.reduce((m, t) => Math.max(m, t.pts[t.pts.length - 1][2]), 0);
  const k = cursor > MAX_DUR ? MAX_DUR / cursor : 1;
  if (k < 1) for (const s of timed) for (const q of s.pts) q[2] *= k;
  const events = [];
  for (const s of timed) {
    const inst = COLORS[s.c]?.inst || "piano";
    let acc = 0, last = -1e9;
    s.pts.forEach((q, i) => {
      if (i) acc += dist(s.pts[i - 1], q);
      if ((i === 0 || acc >= STEP) && q[2] - last >= MIN_GAP * k) { events.push({ t: q[2], n: noteForY(q[1], inst), inst }); acc = 0; last = q[2]; }
    });
  }
  return { timed, events, dur: cursor * k };
}

// 연주: 시간표대로 음을 예약하고, onFrame(지난 ms)로 「다시 그리기」 위치를 알려 준다. 멈추는 함수를 돌려준다.
export function playDrawing(strokes, { onFrame, onEnd } = {}) {
  const ac = audio();
  const tl = timeline(strokes);
  const start = ac.currentTime + 0.15;
  for (const e of tl.events) playNote(e.n, e.inst, start + e.t / 1000, 0.85);
  let raf = 0, stopped = false;
  const tick = () => {
    if (stopped) return;
    const ms = (ac.currentTime - start) * 1000;
    onFrame && onFrame(Math.max(0, ms), tl);
    if (ms >= tl.dur + 300) { onEnd && onEnd(); return; }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => { stopped = true; cancelAnimationFrame(raf); master.disconnect(); master = ac.createDynamicsCompressor(); master.connect(ac.destination); };
}
