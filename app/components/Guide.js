"use client";

// 사용법 팝업 (선생님용): 처음 열 때 한 번 + 오른쪽 위 「❓」로 다시
const STEPS = [
  { ic: "🖍️", t: "그림 그리기", d: "아래 큰 「그림 그리기」 단추를 눌러요." },
  { ic: "✏️", t: "무엇을 그릴지 고르기", d: "하얀 도화지(마음대로) · 따라 그리기(동그라미·해·별 등) · 선생님 그림 중에서 골라요." },
  { ic: "🎵", t: "끼적이기 / 선으로 연주하기", d: "도화지 위 단추로 골라요. 「끼적이기」는 소리 없이 그리기, 「선으로 연주하기」는 그리는 대로 소리가 나요." },
  { ic: "🌈", t: "색깔 = 악기", d: "빨강 피아노 · 주황 마림바 · 노랑 종소리 · 초록 피리 · 파랑 콘트라베이스 · 보라 바이올린. 위로 그리면 높은 음, 아래로 그리면 낮은 음, 빨리 그리면 빠른 음악이 돼요." },
  { ic: "✅", t: "다 그렸어요 → 전시해요", d: "「다 그렸어요」를 누르면 그림이 연주되고, 「🎉 전시해요!」를 누르면 배경 위에 둥둥 떠다녀요." },
  { ic: "👆", t: "친구 그림 눌러 보기", d: "떠다니는 그림을 누르면 크게 열려요. 🎵 표시가 있는 그림은 그렸던 순서·빠르기 그대로 다시 그려지며 연주돼요." },
];

export default function Guide({ onClose }) {
  return (
    <div className="guide-bg" onClick={onClose}>
      <div className="guide" onClick={(e) => e.stopPropagation()}>
        <button className="pad-x guide-x" onClick={onClose} aria-label="닫기">✕</button>
        <h2>🎨🎵 그림 음악 벽 사용법</h2>
        <p className="guide-sub">손가락으로 그린 그림이 음악이 되고, 배경 위에 전시돼요. 여러 친구가 한꺼번에 그려도 돼요.</p>
        <ol>
          {STEPS.map((s) => (
            <li key={s.t}><span className="g-ic">{s.ic}</span><div><b>{s.t}</b><p>{s.d}</p></div></li>
          ))}
        </ol>
        <div className="guide-teacher">
          <b>🧑‍🏫 선생님께</b>
          <p>오른쪽 위 <b>⛶</b>는 화면 가득 보기, <b>⚙</b>는 선생님 화면(배경 그림 바꾸기 · 선생님 그림 넣기 · 그림 숨기기)이에요. 이 사용법은 <b>「❓ 사용법」</b>으로 다시 볼 수 있어요.</p>
        </div>
        <button className="big go guide-go" onClick={onClose}>시작해요! 🖍️</button>
      </div>
    </div>
  );
}
