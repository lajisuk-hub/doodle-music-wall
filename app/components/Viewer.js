"use client";

import { useEffect, useRef, useState } from "react";
import { playScore } from "../../lib/sound";
import { COLORS } from "../../lib/sound";
import { drawStrokes, loadImg, drawContain } from "../../lib/shapes";

// 전시된 그림을 크게 열기. 「선으로 연주하기」 그림이면 빛줄이 지나가며 그 그림의 음악이 나온다
export default function Viewer({ art, onClose }) {
  const scan = useRef(null);
  const cvs = useRef(null);
  const stop = useRef(null);
  const [playing, setPlaying] = useState(false);
  const music = art.music !== false && (art.strokes || []).length > 0;

  // 선 기록으로 다시 그린다(빛줄 위치와 선이 정확히 맞게)
  useEffect(() => {
    const c = cvs.current; if (!c) return;
    const W = 1600, H = 900; c.width = W; c.height = H;
    const x = c.getContext("2d");
    const draw = (im) => { x.clearRect(0, 0, W, H); if (im) drawContain(x, im, W, H); drawStrokes(x, art.strokes || [], W, H, COLORS); };
    draw(null);
    if (art.guideImg) loadImg(art.guideImg).then(draw).catch(() => {});
  }, [art]);

  const play = () => {
    stop.current?.(); setPlaying(true);
    stop.current = playScore(art.strokes || [], {
      onFrame: (t) => { if (scan.current) scan.current.style.left = `${t * 100}%`; },
      onEnd: () => { setPlaying(false); if (scan.current) scan.current.style.left = "-10%"; },
    });
  };
  useEffect(() => { if (music) play(); return () => stop.current?.(); }, [art.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="viewer" onClick={onClose} onContextMenu={(e) => e.preventDefault()}>
      <div className="vw-paper" onClick={(e) => e.stopPropagation()}>
        {art.strokes?.length ? <canvas ref={cvs} /> : <img src={art.img} alt="친구 그림" draggable={false} />}
        {music && <div className="scan" ref={scan} />}
      </div>
      <div className="vw-bar" onClick={(e) => e.stopPropagation()}>
        {music && <button className="big ghost" onClick={play} disabled={playing}>{playing ? "🎵 연주 중…" : "🔁 다시 듣기"}</button>}
        <button className="big go" onClick={onClose}>👋 닫기</button>
      </div>
    </div>
  );
}
