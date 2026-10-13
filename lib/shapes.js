// 따라 그리기 기본 밑그림 6가지. 16:9 도화지 한가운데에 큼직하게 점선으로 그린다.
// draw(ctx, W, H): 이미 점선·색이 정해진 ctx에 길만 그린다.
const P = Math.PI;
export const SHAPES = [
  {
    id: "circle", name: "동그라미", emoji: "⚪",
    draw(x, W, H) { x.beginPath(); x.arc(W / 2, H / 2, H * 0.34, 0, P * 2); x.stroke(); },
  },
  {
    id: "sun", name: "해", emoji: "☀️",
    draw(x, W, H) {
      const cx = W / 2, cy = H / 2, r = H * 0.2;
      x.beginPath(); x.arc(cx, cy, r, 0, P * 2); x.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * P * 2;
        x.beginPath(); x.moveTo(cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r * 1.3); x.lineTo(cx + Math.cos(a) * r * 1.95, cy + Math.sin(a) * r * 1.95); x.stroke();
      }
    },
  },
  {
    id: "star", name: "별", emoji: "⭐",
    draw(x, W, H) {
      const cx = W / 2, cy = H * 0.53, R = H * 0.38, r = R * 0.45;
      x.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -P / 2 + (i / 10) * P * 2, rr = i % 2 ? r : R;
        const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
        i ? x.lineTo(px, py) : x.moveTo(px, py);
      }
      x.closePath(); x.stroke();
    },
  },
  {
    id: "fish", name: "물고기", emoji: "🐟",
    draw(x, W, H) {
      const cx = W * 0.46, cy = H / 2, rx = H * 0.36, ry = H * 0.22;
      x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, P * 2); x.stroke();
      x.beginPath(); x.moveTo(cx + rx * 0.92, cy); x.lineTo(cx + rx * 1.55, cy - ry * 0.95); x.lineTo(cx + rx * 1.55, cy + ry * 0.95); x.closePath(); x.stroke();
      x.beginPath(); x.arc(cx - rx * 0.55, cy - ry * 0.2, H * 0.03, 0, P * 2); x.stroke();
    },
  },
  {
    id: "car", name: "자동차", emoji: "🚗",
    draw(x, W, H) {
      const cx = W / 2, by = H * 0.62, w = H * 0.95, h = H * 0.2;
      x.beginPath(); x.rect(cx - w / 2, by - h, w, h); x.stroke();
      x.beginPath(); x.moveTo(cx - w * 0.3, by - h); x.lineTo(cx - w * 0.18, by - h * 2.1); x.lineTo(cx + w * 0.2, by - h * 2.1); x.lineTo(cx + w * 0.32, by - h); x.stroke();
      for (const k of [-0.28, 0.28]) { x.beginPath(); x.arc(cx + w * k, by + H * 0.02, H * 0.09, 0, P * 2); x.stroke(); }
    },
  },
  {
    id: "apple", name: "사과", emoji: "🍎",
    draw(x, W, H) {
      const cx = W / 2, cy = H * 0.55, r = H * 0.3;
      x.beginPath();
      x.moveTo(cx, cy - r * 0.75);
      x.bezierCurveTo(cx + r * 0.6, cy - r * 1.25, cx + r * 1.35, cy - r * 0.5, cx + r * 0.95, cy + r * 0.5);
      x.bezierCurveTo(cx + r * 0.7, cy + r * 1.05, cx + r * 0.25, cy + r * 1.1, cx, cy + r * 0.95);
      x.bezierCurveTo(cx - r * 0.25, cy + r * 1.1, cx - r * 0.7, cy + r * 1.05, cx - r * 0.95, cy + r * 0.5);
      x.bezierCurveTo(cx - r * 1.35, cy - r * 0.5, cx - r * 0.6, cy - r * 1.25, cx, cy - r * 0.75);
      x.stroke();
      x.beginPath(); x.moveTo(cx, cy - r * 0.75); x.quadraticCurveTo(cx + r * 0.05, cy - r * 1.15, cx + r * 0.2, cy - r * 1.3); x.stroke();
      x.beginPath(); x.ellipse(cx + r * 0.42, cy - r * 1.05, r * 0.25, r * 0.11, -0.5, 0, P * 2); x.stroke();
    },
  },
];

// 점선 밑그림 그리기 (그리는 화면·고르는 카드 둘 다 사용)
export function drawShape(ctx, shape, W, H, { color = "#b9b3c9", width } = {}) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = width || Math.max(3, H * 0.014); ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.setLineDash([H * 0.035, H * 0.03]);
  shape.draw(ctx, W, H);
  ctx.restore();
}

// 저장된 선(0~1 좌표)을 캔버스에 그린다
export function drawStrokes(ctx, strokes, W, H, colors, upto = Infinity) {
  ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
  let n = 0;
  for (const s of strokes) {
    if (n++ >= upto) break;
    ctx.strokeStyle = colors[s.c]?.c || "#333"; ctx.lineWidth = s.w * H;
    ctx.beginPath();
    s.p.forEach(([px, py], i) => (i ? ctx.lineTo(px * W, py * H) : ctx.moveTo(px * W, py * H)));
    if (s.p.length === 1) ctx.lineTo(s.p[0][0] * W + 0.1, s.p[0][1] * H + 0.1);
    ctx.stroke();
  }
  ctx.restore();
}

// 그림 파일 불러오기(다른 주소 그림도 캔버스에 그릴 수 있게)
export function loadImg(url) {
  return new Promise((ok, no) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => ok(im); im.onerror = no; im.src = url; });
}
// 그림을 W×H 안에 비율 유지해 가운데로 (밑그림·색칠 그림용)
export function drawContain(ctx, im, W, H, pad = 0.04) {
  const s = Math.min((W * (1 - pad * 2)) / im.width, (H * (1 - pad * 2)) / im.height);
  const w = im.width * s, h = im.height * s;
  ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
}

// 시간표(timeline)의 선을 ms 시점까지만 그린다 + 지금 펜 끝에 반짝이는 점
export function drawTimedUpTo(ctx, timed, ms, W, H, colors) {
  ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
  const pens = []; // 지금 그려지고 있는 선 끝(여러 선이 동시에 그려질 수 있음)
  for (const s of timed) {
    if (s.pts[0][2] > ms) continue; // 아직 그리기 전인 선
    ctx.strokeStyle = colors[s.c]?.c || "#333"; ctx.lineWidth = s.w * H;
    ctx.beginPath();
    let lastPt = s.pts[0];
    ctx.moveTo(lastPt[0] * W, lastPt[1] * H);
    for (let i = 1; i < s.pts.length; i++) {
      const q = s.pts[i];
      if (q[2] > ms) { // 두 점 사이 중간까지
        const a = (ms - lastPt[2]) / Math.max(1, q[2] - lastPt[2]);
        lastPt = [lastPt[0] + (q[0] - lastPt[0]) * a, lastPt[1] + (q[1] - lastPt[1]) * a, ms];
        ctx.lineTo(lastPt[0] * W, lastPt[1] * H); pens.push({ p: lastPt, w: s.w }); break;
      }
      ctx.lineTo(q[0] * W, q[1] * H); lastPt = q;
    }
    if (s.pts.length === 1) ctx.lineTo(lastPt[0] * W + 0.1, lastPt[1] * H + 0.1);
    ctx.stroke();
  }
  for (const pen of pens) {
    const r = pen.w * H * 1.1;
    ctx.fillStyle = "#fff"; ctx.shadowColor = "#ffd60a"; ctx.shadowBlur = r * 2.5;
    ctx.beginPath(); ctx.arc(pen.p[0] * W, pen.p[1] * H, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
