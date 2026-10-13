"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadConfig, loadArts } from "../../lib/supabase";
import { playDrawing, audio, COLORS } from "../../lib/sound";
import Picker from "./Picker";
import Pad from "./Pad";
import Viewer from "./Viewer";
import Guide from "./Guide";

const MAX_SHOWN = 30; // 벽에 동시에 떠 있는 그림 수 (최근 것부터)
// 예전 방식(흰 종이째 저장)의 그림도 모양만 보이게: 선 기록을 그 자리에서 그림(SVG)으로
function StrokeShape({ strokes, maxW, maxH }) {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (const s of strokes) for (const [x, y] of s.p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const W = 1600, H = 900, pad = 0.03 * H;
  const vb = [x0 * W - pad, y0 * H - pad, (x1 - x0) * W + pad * 2, (y1 - y0) * H + pad * 2];
  return (
    <svg viewBox={vb.join(" ")} style={{ width: Math.min(maxW, (maxH * vb[2]) / vb[3]) }} className="shape">
      {strokes.map((s, i) => (
        <polyline key={i} points={s.p.map(([x, y]) => `${x * W},${y * H}`).join(" ")} fill="none" stroke={COLORS[s.c]?.c || "#333"} strokeWidth={s.w * H} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

// 첫 화면: 선생님이 고른 배경 위에 아이들 그림이 둥둥. 누르면 크게 + 음악
export default function Wall() {
  const [cfg, setCfg] = useState(null);
  const [arts, setArts] = useState([]);
  const [err, setErr] = useState("");
  const [picker, setPicker] = useState(false);
  const [pick, setPick] = useState(null);
  const [open, setOpen] = useState(null);
  const [guide, setGuide] = useState(false);
  const [mine, setMine] = useState(null);
  const [scr, setScr] = useState({ w: 1600, h: 900 });
  const since = useRef(null);
  const els = useRef(new Map());

  // 사용법 팝업: 이 창에서 처음 열 때 한 번 (❓ 단추로 언제든 다시)
  useEffect(() => {
    try { if (!sessionStorage.getItem("dw-guide")) { setGuide(true); sessionStorage.setItem("dw-guide", "1"); } } catch { setGuide(true); }
  }, []);
  useEffect(() => {
    loadConfig().then(setCfg).catch((e) => setErr("보관소에 연결하지 못했어요. 잠시 뒤 새로고침해 주세요. (" + e.message + ")"));
    const on = () => setScr({ w: window.innerWidth, h: window.innerHeight });
    on(); window.addEventListener("resize", on); return () => window.removeEventListener("resize", on);
  }, []);

  const merge = useCallback((rows) => {
    if (!rows.length) return;
    for (const r of rows) if (!since.current || r.at > since.current) since.current = r.at;
    setArts((prev) => { const by = new Map(prev.map((r) => [r.id, r])); for (const r of rows) by.set(r.id, r); return [...by.values()]; });
  }, []);
  // 처음 전부, 그 뒤 새 것만 10초마다 (선생님이 숨긴 것도 반영)
  useEffect(() => {
    let stop = false;
    const tick = async () => { try { const r = await loadArts(since.current); if (!stop) merge(r); } catch {} };
    tick(); const id = setInterval(tick, 10000);
    // 선생님이 배경을 바꾸면 1분 안에 따라오게
    const id2 = setInterval(() => loadConfig().then((c) => !stop && setCfg(c)).catch(() => {}), 60000);
    return () => { stop = true; clearInterval(id); clearInterval(id2); };
  }, [merge]);

  const shown = useMemo(() => arts.filter((a) => !a.hidden && a.img).map((a) => (!a.cut && !a.guideImg && a.strokes?.length ? { ...a, cut: true, svg: true } : a)).sort((a, b) => (a.id < b.id ? 1 : -1)).slice(0, MAX_SHOWN), [arts]);

  // 자리 배치: 화면을 칸으로 나눠 고르게, 아래쪽 단추 자리는 비움
  const n = shown.length;
  const cardW = Math.round(scr.w * (n <= 4 ? 0.22 : n <= 9 ? 0.17 : n <= 16 ? 0.14 : 0.11));
  const placed = useMemo(() => {
    const cols = Math.max(2, Math.ceil(Math.sqrt(n * 1.8)));
    const rows = Math.max(1, Math.ceil(n / cols));
    const top = scr.h * 0.06, bottom = scr.h * 0.78;
    return shown.map((a, i) => {
      const h = hash(a.id);
      const col = i % cols, row = Math.floor(i / cols);
      const cw = scr.w / cols, ch = (bottom - top) / rows;
      const jx = ((h % 1000) / 1000 - 0.5) * cw * 0.35, jy = (((h >> 10) % 1000) / 1000 - 0.5) * ch * 0.3;
      return { ...a, x: (col + 0.5) * cw + jx + (row % 2 ? cw * 0.25 : 0), y: top + (row + 0.5) * ch + jy, ph: (h % 628) / 100, sp: 0.35 + ((h >> 5) % 40) / 100 };
    });
  }, [shown, n, scr]);

  // 둥둥 떠다니기 (rAF 하나로, React 다시 그리기 없이)
  useEffect(() => {
    let raf;
    const loop = (now) => {
      const t = now / 1000;
      for (const p of placed) {
        const el = els.current.get(p.id); if (!el) continue;
        const dx = Math.sin(t * p.sp + p.ph) * 22, dy = Math.cos(t * p.sp * 0.8 + p.ph) * 16, rot = Math.sin(t * p.sp * 0.6 + p.ph) * 3;
        el.style.transform = `translate3d(${p.x + dx}px,${p.y + dy}px,0) translate(-50%,-50%) rotate(${rot}deg)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [placed]);

  const bg = cfg?.bgs?.find((b) => b.id === cfg.bg) || cfg?.bgs?.[0];

  const onSaved = (art) => {
    setPick(null); merge([art]); setMine(art.id);
    if (art.music !== false) playDrawing(art.strokes || []); // 음악 그림이면 전시되며 한 번 연주
    setTimeout(() => setMine(null), 8000);
  };

  return (
    <>
    <main className="wall" style={bg ? { backgroundImage: `url(${bg.url})` } : undefined} onContextMenu={(e) => e.preventDefault()}>
      {placed.map((p) => (
        <button
          key={p.id}
          ref={(el) => (el ? els.current.set(p.id, el) : els.current.delete(p.id))}
          className={`art${p.cut ? " cut" : ""}${p.id === mine ? " mine" : ""}`}
          style={p.cut ? { maxWidth: cardW, "--mh": `${Math.round(cardW * 0.8)}px` } : { width: cardW }}
          onClick={() => { audio(); setOpen(p); }}
        >
          {p.svg ? <StrokeShape strokes={p.strokes} maxW={cardW} maxH={Math.round(cardW * 0.8)} /> : <img src={p.img} alt="" draggable={false} loading="lazy" />}
          {p.music !== false && <i>🎵</i>}
        </button>
      ))}
      {!n && cfg && <div className="empty">아직 그림이 없어요. 첫 번째 그림을 그려 볼까요? 🖍️</div>}
      {err && <div className="empty">{err}</div>}

      <button className="draw-btn" onClick={() => { audio(); setPicker(true); }}>🖍️ 그림 그리기</button>
      <a className="teacher-link" href="/teacher" aria-label="선생님 화면">⚙</a>
      <button className="help-btn" onClick={() => setGuide(true)} aria-label="사용법">❓ 사용법</button>
      <button className="fs-btn" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())} aria-label="전체 화면">⛶</button>
    </main>

      {picker && <Picker guides={cfg?.guides || []} onClose={() => setPicker(false)} onPick={(p) => { setPicker(false); setPick(p); }} />}
      {pick && <Pad pick={pick} onClose={() => setPick(null)} onSaved={onSaved} />}
      {open && <Viewer art={open} onClose={() => setOpen(null)} />}
      {guide && <Guide onClose={() => setGuide(false)} />}
    </>
  );
}
