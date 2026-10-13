"use client";

import { useEffect, useRef, useState } from "react";
import { COLORS, noteForY, playNote, playDrawing, audio, STEP, MIN_GAP } from "../../lib/sound";
import { drawShape, drawStrokes, drawTimedUpTo, loadImg, drawContain } from "../../lib/shapes";
import { addArt, uploadFile } from "../../lib/supabase";

const LINE = 0.024; // 선 굵기(도화지 높이 대비) — 영아 손가락에 맞게 굵게
const r3 = (v) => Math.round(v * 1000) / 1000;

// 그리는 화면. pick = {kind:"free"} | {kind:"shape", shape} | {kind:"img", url}
export default function Pad({ pick, onClose, onSaved }) {
  const wrap = useRef(null);
  const guide = useRef(null);
  const cvs = useRef(null);
  const strokes = useRef([]);
  const live = useRef(new Map()); // 손가락마다 그리는 중인 선 (여러 아이가 동시에)
  const lastNote = useRef(new Map()); // 손가락마다 {t: 마지막 음 시각, acc: 그 뒤 움직인 거리}
  const t0 = useRef(null);              // 처음 그리기 시작한 시각 (선마다 언제 그렸는지 기록)
  const strokeStart = useRef(new Map());
  const guideImg = useRef(null);
  const stopPlay = useRef(null);
  const [box, setBox] = useState({ w: 800, h: 450 });
  const [color, setColor] = useState(0);
  const [count, setCount] = useState(0);
  const [phase, setPhase] = useState("draw"); // draw | playing | ask | saving
  const [mode, setMode] = useState("doodle"); // doodle(끼적이기, 소리 없음) | music(선으로 연주하기)
  const [err, setErr] = useState("");

  // 도화지 크기: 남는 공간에 16:9로 꽉
  useEffect(() => {
    const on = () => {
      const el = wrap.current; if (!el) return;
      const cs = getComputedStyle(el); // 여백(위 모드 단추 자리)을 빼고 남는 크기
      const W = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), H = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const w = Math.min(W, (H * 16) / 9);
      setBox({ w: Math.floor(w), h: Math.floor((w * 9) / 16) });
    };
    on(); window.addEventListener("resize", on); return () => window.removeEventListener("resize", on);
  }, []);

  // 밑그림 그리기
  useEffect(() => {
    const g = guide.current; if (!g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    g.width = box.w * dpr; g.height = box.h * dpr;
    const x = g.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.fillStyle = "#fffdf7"; x.fillRect(0, 0, box.w, box.h);
    if (pick.kind === "shape") drawShape(x, pick.shape, box.w, box.h);
    if (pick.kind === "img") {
      loadImg(pick.url).then((im) => { guideImg.current = im; drawContain(x, im, box.w, box.h); }).catch(() => {});
    }
    redraw();
  }, [box, pick]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx2d = () => {
    const c = cvs.current; const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== box.w * dpr) { c.width = box.w * dpr; c.height = box.h * dpr; }
    const x = c.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); return x;
  };
  const redraw = () => {
    if (!cvs.current) return;
    const x = ctx2d(); x.clearRect(0, 0, box.w, box.h);
    drawStrokes(x, [...strokes.current, ...live.current.values()], box.w, box.h, COLORS);
  };

  const pos = (e) => {
    const r = cvs.current.getBoundingClientRect();
    return [r3(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))), r3(Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)))];
  };
  // 그리는 소리: 펜이 STEP만큼 움직일 때마다 한 음 → 빨리 그리면 빠르게, 천천히 그리면 천천히 (연주할 때와 같은 규칙)
  const sound = (id, y, d) => {
    if (mode !== "music") return;
    const now = performance.now();
    const st = lastNote.current.get(id) || { t: -1e9, acc: 0, first: true };
    st.acc += d;
    if ((st.first || st.acc >= STEP) && now - st.t >= MIN_GAP) {
      const inst = COLORS[color].inst;
      playNote(noteForY(y, inst), inst, undefined, 0.7);
      st.t = now; st.acc = 0; st.first = false;
    }
    lastNote.current.set(id, st);
  };
  const down = (e) => {
    if (phase !== "draw") return;
    e.preventDefault(); audio();
    try { cvs.current.setPointerCapture?.(e.pointerId); } catch {} // 손가락이 도화지 밖으로 나가도 선이 이어지게
    const now = performance.now();
    if (t0.current == null) t0.current = now;
    const p = [...pos(e), 0];
    const s = { c: color, w: LINE, t0: Math.round(now - t0.current), p: [p] };
    live.current.set(e.pointerId, s);
    strokeStart.current.set(e.pointerId, now);
    lastNote.current.delete(e.pointerId);
    sound(e.pointerId, p[1], 0);
    redraw();
  };
  const move = (e) => {
    const s = live.current.get(e.pointerId); if (!s) return;
    e.preventDefault();
    const p = pos(e); const q = s.p[s.p.length - 1];
    const d = Math.hypot(p[0] - q[0], (p[1] - q[1]) * 0.5625);
    if (d < 0.004) return; // 너무 촘촘한 점은 버림
    p.push(Math.round(performance.now() - strokeStart.current.get(e.pointerId))); // 이 선을 그리기 시작하고 몇 ms 뒤인지
    s.p.push(p);
    const x = ctx2d(); x.lineCap = "round"; x.strokeStyle = COLORS[s.c].c; x.lineWidth = s.w * box.h;
    x.beginPath(); x.moveTo(q[0] * box.w, q[1] * box.h); x.lineTo(p[0] * box.w, p[1] * box.h); x.stroke();
    sound(e.pointerId, p[1], d);
  };
  const up = (e) => {
    const s = live.current.get(e.pointerId); if (!s) return;
    live.current.delete(e.pointerId);
    strokes.current.push(s); setCount(strokes.current.length);
  };

  const undo = () => { strokes.current.pop(); setCount(strokes.current.length); redraw(); };
  const clear = () => { strokes.current = []; t0.current = null; setCount(0); redraw(); };

  // 연주: 빛줄이 왼쪽→오른쪽
  const play = (then) => {
    if (!strokes.current.length) return setErr("먼저 그림을 그려 주세요 🖍️");
    setErr(""); stopPlay.current?.(); setPhase("playing");
    // 그린 순서·빠르기 그대로 선이 다시 그려지며 소리가 난다
    stopPlay.current = playDrawing(strokes.current, {
      onFrame: (ms, tl) => { const x = ctx2d(); x.clearRect(0, 0, box.w, box.h); drawTimedUpTo(x, tl.timed, ms, box.w, box.h, COLORS); },
      onEnd: () => { redraw(); setPhase(then || "draw"); },
    });
  };
  useEffect(() => () => stopPlay.current?.(), []);
  const stop = () => { stopPlay.current?.(); redraw(); setPhase("draw"); };

  // 전시용 그림: 바탕 없이 그린 모양만(투명 PNG), 그린 곳만 잘라서. 밑그림 점선은 빼고 선생님 그림은 넣음
  const exportPng = async () => {
    const W = 1280, H = 720, o = document.createElement("canvas"); o.width = W; o.height = H;
    const x = o.getContext("2d");
    let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
    if (pick.kind === "img" && guideImg.current) {
      const im = guideImg.current, k = Math.min((W * 0.92) / im.width, (H * 0.92) / im.height);
      const iw = (im.width * k) / W, ih = (im.height * k) / H;
      x0 = (1 - iw) / 2; y0 = (1 - ih) / 2; x1 = 1 - x0; y1 = 1 - y0;
      drawContain(x, im, W, H);
    }
    for (const st of strokes.current) for (const [px, py] of st.p) { x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); }
    drawStrokes(x, strokes.current, W, H, COLORS);
    const pad = LINE * H;
    const cx = Math.max(0, Math.floor(x0 * W - pad)), cy = Math.max(0, Math.floor(y0 * H - pad));
    const cw = Math.min(W, Math.ceil(x1 * W + pad)) - cx, ch = Math.min(H, Math.ceil(y1 * H + pad)) - cy;
    const c = document.createElement("canvas"); c.width = Math.max(1, cw); c.height = Math.max(1, ch);
    c.getContext("2d").drawImage(o, cx, cy, cw, ch, 0, 0, cw, ch);
    return new Promise((ok) => c.toBlob(ok, "image/png"));
  };
  const save = async () => {
    setPhase("saving"); setErr("");
    try {
      const img = await uploadFile("art", await exportPng(), "png", "image/png");
      const art = await addArt({ img, cut: true, music: mode === "music", strokes: strokes.current, guideImg: pick.kind === "img" ? pick.url : "" });
      onSaved(art);
    } catch (e) {
      setErr("전시하지 못했어요. 잠시 뒤 다시 눌러 주세요."); setPhase("ask");
    }
  };

  return (
    <div className="pad" onContextMenu={(e) => e.preventDefault()}>
      <button className="pad-x" onClick={() => { stop(); onClose(); }} aria-label="그만 그리기">✕</button>
      <div className="pad-stage" ref={wrap}>
        <div className="paper" style={{ width: box.w, height: box.h }}>
          <canvas ref={guide} style={{ width: box.w, height: box.h }} />
          <canvas ref={cvs} className="ink" style={{ width: box.w, height: box.h }}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
        </div>
      </div>

      {phase === "ask" || phase === "saving" ? (
        <div className="pad-bar ask">
          {mode === "music" && <button className="big ghost" onClick={() => play("ask")} disabled={phase === "saving"}>🔁 다시 듣기</button>}
          <button className="big ghost" onClick={() => setPhase("draw")} disabled={phase === "saving"}>✏️ 더 그릴래요</button>
          <button className="big go" onClick={save} disabled={phase === "saving"}>{phase === "saving" ? "전시하는 중…" : "🎉 전시해요!"}</button>
        </div>
      ) : (
        <div className="pad-bar">
          <div className="colors">
            {COLORS.map((c, i) => (
              <button key={c.c} className={`dot${color === i ? " on" : ""}`} style={{ "--c": c.c }} onClick={() => setColor(i)} aria-label={`${c.name} · ${c.label}`}>
                {mode === "music" && <span>{c.label}</span>}
              </button>
            ))}
          </div>
          <div className="tools">
            <button className="tool" onClick={undo} disabled={!count || phase !== "draw"}>↶<small>되돌리기</small></button>
            <button className="tool" onClick={clear} disabled={!count || phase !== "draw"}>🗑<small>다 지우기</small></button>
            {mode === "music" && (phase === "playing"
              ? <button className="tool play" onClick={stop}>■<small>멈추기</small></button>
              : <button className="tool play" onClick={() => play()}>▶<small>연주</small></button>)}
            <button className="tool done" disabled={phase !== "draw"}
              onClick={() => (mode === "music" ? play("ask") : strokes.current.length ? setPhase("ask") : setErr("먼저 그림을 그려 주세요 🖍️"))}>✅<small>다 그렸어요</small></button>
          </div>
        </div>
      )}
      {phase === "ask" ? <div className="pad-ask">이 그림을 전시할까요? {mode === "music" ? "🎨🎵" : "🎨"}</div> : (
        <div className="mode">
          <button className={mode === "doodle" ? "on" : ""} disabled={phase === "playing"} onClick={() => setMode("doodle")}>🖍️ 끼적이기</button>
          <button className={mode === "music" ? "on" : ""} disabled={phase === "playing"} onClick={() => { audio(); setMode("music"); }}>🎵 선으로 연주하기</button>
        </div>
      )}
      {err && <div className="pad-err" onClick={() => setErr("")}>{err}</div>}
    </div>
  );
}
