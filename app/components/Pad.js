"use client";

import { useEffect, useRef, useState } from "react";
import { COLORS, noteForY, playNote, playScore, audio } from "../../lib/sound";
import { drawShape, drawStrokes, loadImg, drawContain } from "../../lib/shapes";
import { addArt, uploadFile } from "../../lib/supabase";

const LINE = 0.024; // 선 굵기(도화지 높이 대비) — 영아 손가락에 맞게 굵게
const r3 = (v) => Math.round(v * 1000) / 1000;

// 그리는 화면. pick = {kind:"free"} | {kind:"shape", shape} | {kind:"img", url}
export default function Pad({ pick, onClose, onSaved }) {
  const wrap = useRef(null);
  const guide = useRef(null);
  const cvs = useRef(null);
  const scan = useRef(null);
  const strokes = useRef([]);
  const live = useRef(new Map()); // 손가락마다 그리는 중인 선 (여러 아이가 동시에)
  const lastNote = useRef(new Map());
  const guideImg = useRef(null);
  const stopPlay = useRef(null);
  const [box, setBox] = useState({ w: 800, h: 450 });
  const [color, setColor] = useState(0);
  const [count, setCount] = useState(0);
  const [phase, setPhase] = useState("draw"); // draw | playing | ask | saving
  const [err, setErr] = useState("");

  // 도화지 크기: 남는 공간에 16:9로 꽉
  useEffect(() => {
    const on = () => {
      const el = wrap.current; if (!el) return;
      const W = el.clientWidth, H = el.clientHeight;
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
  const sound = (id, y) => {
    const now = performance.now();
    if (now - (lastNote.current.get(id) || 0) < 140) return;
    lastNote.current.set(id, now);
    const inst = COLORS[color].inst;
    playNote(noteForY(y, inst), inst, undefined, 0.7);
  };
  const down = (e) => {
    if (phase !== "draw") return;
    e.preventDefault(); audio();
    try { cvs.current.setPointerCapture?.(e.pointerId); } catch {} // 손가락이 도화지 밖으로 나가도 선이 이어지게
    const p = pos(e);
    const s = { c: color, w: LINE, p: [p] };
    live.current.set(e.pointerId, s);
    lastNote.current.set(e.pointerId, 0);
    sound(e.pointerId, p[1]);
    redraw();
  };
  const move = (e) => {
    const s = live.current.get(e.pointerId); if (!s) return;
    e.preventDefault();
    const p = pos(e); const q = s.p[s.p.length - 1];
    if (Math.hypot(p[0] - q[0], (p[1] - q[1]) * 0.5625) < 0.004) return; // 너무 촘촘한 점은 버림
    s.p.push(p);
    const x = ctx2d(); x.lineCap = "round"; x.strokeStyle = COLORS[s.c].c; x.lineWidth = s.w * box.h;
    x.beginPath(); x.moveTo(q[0] * box.w, q[1] * box.h); x.lineTo(p[0] * box.w, p[1] * box.h); x.stroke();
    sound(e.pointerId, p[1]);
  };
  const up = (e) => {
    const s = live.current.get(e.pointerId); if (!s) return;
    live.current.delete(e.pointerId);
    strokes.current.push(s); setCount(strokes.current.length);
  };

  const undo = () => { strokes.current.pop(); setCount(strokes.current.length); redraw(); };
  const clear = () => { strokes.current = []; setCount(0); redraw(); };

  // 연주: 빛줄이 왼쪽→오른쪽
  const play = (then) => {
    if (!strokes.current.length) return setErr("먼저 그림을 그려 주세요 🖍️");
    setErr(""); stopPlay.current?.(); setPhase("playing");
    stopPlay.current = playScore(strokes.current, {
      onFrame: (t) => { if (scan.current) scan.current.style.left = `${t * 100}%`; },
      onEnd: () => { if (scan.current) scan.current.style.left = "-10%"; setPhase(then || "draw"); },
    });
  };
  useEffect(() => () => stopPlay.current?.(), []);
  const stop = () => { stopPlay.current?.(); if (scan.current) scan.current.style.left = "-10%"; setPhase("draw"); };

  // 전시용 그림(960×540, 밑그림 점선은 빼고 선생님 그림은 넣음)
  const exportJpg = async () => {
    const W = 960, H = 540, o = document.createElement("canvas"); o.width = W; o.height = H;
    const x = o.getContext("2d"); x.fillStyle = "#fffdf7"; x.fillRect(0, 0, W, H);
    if (pick.kind === "img" && guideImg.current) drawContain(x, guideImg.current, W, H);
    drawStrokes(x, strokes.current, W, H, COLORS);
    return new Promise((ok) => o.toBlob(ok, "image/jpeg", 0.88));
  };
  const save = async () => {
    setPhase("saving"); setErr("");
    try {
      const img = await uploadFile("art", await exportJpg(), "jpg", "image/jpeg");
      const art = await addArt({ img, strokes: strokes.current, guideImg: pick.kind === "img" ? pick.url : "" });
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
          <div className="scan" ref={scan} />
        </div>
      </div>

      {phase === "ask" || phase === "saving" ? (
        <div className="pad-bar ask">
          <button className="big ghost" onClick={() => play("ask")} disabled={phase === "saving"}>🔁 다시 듣기</button>
          <button className="big ghost" onClick={() => setPhase("draw")} disabled={phase === "saving"}>✏️ 더 그릴래요</button>
          <button className="big go" onClick={save} disabled={phase === "saving"}>{phase === "saving" ? "전시하는 중…" : "🎉 전시해요!"}</button>
        </div>
      ) : (
        <div className="pad-bar">
          <div className="colors">
            {COLORS.map((c, i) => (
              <button key={c.c} className={`dot${color === i ? " on" : ""}`} style={{ "--c": c.c }} onClick={() => setColor(i)} aria-label={`${c.name} · ${c.label}`}>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
          <div className="tools">
            <button className="tool" onClick={undo} disabled={!count || phase !== "draw"}>↶<small>되돌리기</small></button>
            <button className="tool" onClick={clear} disabled={!count || phase !== "draw"}>🗑<small>다 지우기</small></button>
            {phase === "playing"
              ? <button className="tool play" onClick={stop}>■<small>멈추기</small></button>
              : <button className="tool play" onClick={() => play()}>▶<small>연주</small></button>}
            <button className="tool done" onClick={() => play("ask")} disabled={phase !== "draw"}>✅<small>다 그렸어요</small></button>
          </div>
        </div>
      )}
      {phase === "ask" && <div className="pad-ask">이 그림을 전시할까요? 🎨🎵</div>}
      {err && <div className="pad-err" onClick={() => setErr("")}>{err}</div>}
    </div>
  );
}
