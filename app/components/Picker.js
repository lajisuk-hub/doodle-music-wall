"use client";

import { useEffect, useRef } from "react";
import { SHAPES, drawShape } from "../../lib/shapes";

// 무엇을 그릴지 고르는 화면: 자유 그림 / 따라 그리기 / 선생님 그림
function ShapeThumb({ shape }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; const W = 320, H = 180; c.width = W; c.height = H;
    const x = c.getContext("2d"); x.fillStyle = "#fffdf7"; x.fillRect(0, 0, W, H);
    drawShape(x, shape, W, H, { color: "#8f86a8", width: 4 });
  }, [shape]);
  return <canvas ref={ref} />;
}

export default function Picker({ guides, onPick, onClose }) {
  return (
    <div className="picker" onContextMenu={(e) => e.preventDefault()}>
      <button className="pad-x" onClick={onClose} aria-label="닫기">✕</button>
      <h2>무엇을 그릴까요? 🖍️</h2>
      <div className="pk-scroll">
        <section>
          <h3>🖐️ 마음대로 그리기</h3>
          <div className="pk-grid">
            <button className="pk-card free" onClick={() => onPick({ kind: "free" })}>
              <span className="pk-img blank">✨</span>
              <b>하얀 도화지</b>
            </button>
          </div>
        </section>
        <section>
          <h3>✏️ 따라 그리기</h3>
          <div className="pk-grid">
            {SHAPES.map((s) => (
              <button key={s.id} className="pk-card" onClick={() => onPick({ kind: "shape", shape: s })}>
                <span className="pk-img"><ShapeThumb shape={s} /></span>
                <b>{s.emoji} {s.name}</b>
              </button>
            ))}
          </div>
        </section>
        {guides.length > 0 && (
          <section>
            <h3>🧑‍🏫 선생님 그림</h3>
            <div className="pk-grid">
              {guides.map((g) => (
                <button key={g.id} className="pk-card" onClick={() => onPick({ kind: "img", url: g.url })}>
                  <span className="pk-img"><img src={g.url} alt="" draggable={false} /></span>
                  <b>{g.name || "선생님 그림"}</b>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
