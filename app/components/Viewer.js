"use client";

import { useEffect, useRef, useState } from "react";
import { playDrawing, COLORS } from "../../lib/sound";
import { drawStrokes, drawTimedUpTo, loadImg, drawContain } from "../../lib/shapes";

// 전시된 그림을 크게 열기. 「선으로 연주하기」 그림이면 그린 순서·빠르기 그대로 다시 그려지며 음악이 나온다
export default function Viewer({ art, onClose }) {
  const guideIm = useRef(null);
  const cvs = useRef(null);
  const stop = useRef(null);
  const [playing, setPlaying] = useState(false);
  const music = art.music !== false && (art.strokes || []).length > 0;

  // 선 기록으로 다시 그린다(빛줄 위치와 선이 정확히 맞게)
  useEffect(() => {
    const c = cvs.current; if (!c) return;
    const W = 1600, H = 900; c.width = W; c.height = H;
    const x = c.getContext("2d");
    const draw = (im) => { guideIm.current = im; if (stop.current && playing) return; x.clearRect(0, 0, W, H); if (im) drawContain(x, im, W, H); drawStrokes(x, art.strokes || [], W, H, COLORS); };
    draw(null);
    if (art.guideImg) loadImg(art.guideImg).then(draw).catch(() => {});
  }, [art]);

  const play = () => {
    stop.current?.(); setPlaying(true);
    const c = cvs.current, x = c?.getContext("2d"), W = 1600, H = 900;
    stop.current = playDrawing(art.strokes || [], {
      onFrame: (ms, tl) => { if (!x) return; x.clearRect(0, 0, W, H); if (guideIm.current) drawContain(x, guideIm.current, W, H); drawTimedUpTo(x, tl.timed, ms, W, H, COLORS); },
      onEnd: () => { setPlaying(false); if (x) { x.clearRect(0, 0, W, H); if (guideIm.current) drawContain(x, guideIm.current, W, H); drawStrokes(x, art.strokes || [], W, H, COLORS); } },
    });
  };
  useEffect(() => { if (music) play(); return () => stop.current?.(); }, [art.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="viewer" onClick={onClose} onContextMenu={(e) => e.preventDefault()}>
      <div className="vw-paper" onClick={(e) => e.stopPropagation()}>
        {art.strokes?.length ? <canvas ref={cvs} /> : <img src={art.img} alt="친구 그림" draggable={false} />}
      </div>
      <div className="vw-bar" onClick={(e) => e.stopPropagation()}>
        {music && <button className="big ghost" onClick={play} disabled={playing}>{playing ? "🎵 연주 중…" : "🔁 다시 듣기"}</button>}
        <button className="big go" onClick={onClose}>👋 닫기</button>
      </div>
    </div>
  );
}
