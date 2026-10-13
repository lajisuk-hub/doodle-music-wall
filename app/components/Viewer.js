"use client";

import { useEffect, useRef, useState } from "react";
import { playScore } from "../../lib/sound";

// 전시된 그림을 크게 열면 빛줄이 지나가며 그 그림의 음악이 나온다
export default function Viewer({ art, onClose }) {
  const scan = useRef(null);
  const stop = useRef(null);
  const [playing, setPlaying] = useState(false);
  const play = () => {
    stop.current?.(); setPlaying(true);
    stop.current = playScore(art.strokes || [], {
      onFrame: (t) => { if (scan.current) scan.current.style.left = `${t * 100}%`; },
      onEnd: () => { setPlaying(false); if (scan.current) scan.current.style.left = "-10%"; },
    });
  };
  useEffect(() => { play(); return () => stop.current?.(); }, [art.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="viewer" onClick={onClose} onContextMenu={(e) => e.preventDefault()}>
      <div className="vw-paper" onClick={(e) => e.stopPropagation()}>
        <img src={art.img} alt="친구 그림" draggable={false} />
        <div className="scan" ref={scan} />
      </div>
      <div className="vw-bar" onClick={(e) => e.stopPropagation()}>
        <button className="big ghost" onClick={play} disabled={playing}>{playing ? "🎵 연주 중…" : "🔁 다시 듣기"}</button>
        <button className="big go" onClick={onClose}>👋 닫기</button>
      </div>
    </div>
  );
}
