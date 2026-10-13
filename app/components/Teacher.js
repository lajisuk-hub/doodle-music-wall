"use client";

import { useEffect, useState } from "react";
import { loadConfig, saveConfig, loadArts, setArtHidden, uploadFile, sha256, DEFAULT_PIN } from "../../lib/supabase";

// 그림 파일을 알맞은 크기로 줄여서 올린다 (배경은 JPG, 밑그림은 투명 살리려 PNG)
async function shrink(file, max, type) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const x = c.getContext("2d");
  if (type === "image/jpeg") { x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); }
  x.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((ok) => c.toBlob(ok, type, 0.88));
}
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

export default function Teacher() {
  const [cfg, setCfg] = useState(null);
  const [ok, setOk] = useState(false);
  const [pin, setPin] = useState("");
  const [arts, setArts] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [gName, setGName] = useState("");
  const [newPin, setNewPin] = useState("");

  useEffect(() => {
    loadConfig().then((c) => {
      setCfg(c);
      try { if (sessionStorage.getItem("dw-teacher") === c.pinHash) setOk(true); } catch {}
    }).catch((e) => setMsg("보관소에 연결하지 못했어요: " + e.message));
  }, []);
  useEffect(() => { if (ok) loadArts().then((a) => setArts(a.sort((x, y) => (x.id < y.id ? 1 : -1)))).catch(() => {}); }, [ok]);

  const login = async () => {
    const h = await sha256(pin);
    if (h !== cfg.pinHash) return setMsg("비밀번호가 달라요.");
    try { sessionStorage.setItem("dw-teacher", h); } catch {}
    setMsg(""); setOk(true);
  };
  const save = async (next, done) => {
    try { await saveConfig(next); setCfg(next); setMsg(done || "저장했어요 ✅ 칠판 화면은 1분 안에 바뀌어요(바로 보려면 새로고침)."); }
    catch (e) { setMsg("저장하지 못했어요: " + e.message); }
  };

  const addBgs = async (files) => {
    if (!files.length) return;
    setBusy("bg");
    try {
      const add = [];
      for (let i = 0; i < files.length; i++) {
        setMsg(`배경 ${i + 1} / ${files.length}장 올리는 중…`);
        add.push({ id: newId(), url: await uploadFile("bg", await shrink(files[i], 2400, "image/jpeg"), "jpg", "image/jpeg") });
      }
      const next = { ...cfg, bgs: [...cfg.bgs, ...add], bg: cfg.bg || add[0].id };
      await save(next, `배경 ${add.length}장을 올렸어요 ✅ 「이 배경 쓰기」로 칠판 배경을 고르세요.`);
    } catch (e) { setMsg("올리지 못했어요: " + e.message); }
    setBusy("");
  };
  const addGuides = async (files) => {
    if (!files.length) return;
    setBusy("guide");
    try {
      const add = [];
      for (let i = 0; i < files.length; i++) {
        setMsg(`그림 ${i + 1} / ${files.length}장 올리는 중…`);
        const name = files.length === 1 && gName.trim() ? gName.trim() : files[i].name.replace(/\.[^.]+$/, "");
        add.push({ id: newId(), name: name.slice(0, 20), url: await uploadFile("guide", await shrink(files[i], 1600, "image/png"), "png", "image/png") });
      }
      setGName("");
      await save({ ...cfg, guides: [...cfg.guides, ...add] }, `그림 ${add.length}장을 넣었어요 ✅ 아이들이 「선생님 그림」에서 고를 수 있어요.`);
    } catch (e) { setMsg("올리지 못했어요: " + e.message); }
    setBusy("");
  };
  const toggle = async (a) => {
    try { await setArtHidden(a, !a.hidden); setArts((p) => p.map((x) => (x.id === a.id ? { ...x, hidden: !a.hidden } : x))); }
    catch (e) { setMsg("바꾸지 못했어요: " + e.message); }
  };
  const changePin = async () => {
    if (!/^\d{4,8}$/.test(newPin)) return setMsg("새 비밀번호는 숫자 4~8자리로 정해 주세요.");
    const h = await sha256(newPin);
    await save({ ...cfg, pinHash: h }, "비밀번호를 바꿨어요 ✅ 다음부터 새 비밀번호로 들어와요.");
    try { sessionStorage.setItem("dw-teacher", h); } catch {}
    setNewPin("");
  };

  if (!cfg) return <main className="tpage"><div className="card">{msg || "여는 중…"}</div></main>;
  if (!ok)
    return (
      <main className="tpage">
        <div className="card narrow">
          <h1>🔐 선생님 화면</h1>
          <p className="sub">비밀번호를 넣어 주세요. (처음 비밀번호는 {DEFAULT_PIN} — 들어가서 꼭 바꿔 주세요)</p>
          <input className="inp" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} autoFocus />
          {msg && <div className="err">{msg}</div>}
          <button className="btn" onClick={login}>들어가기</button>
          <a className="back" href="/">← 칠판 화면으로</a>
        </div>
      </main>
    );

  const usingDefault = cfg.pinHash === "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4";
  return (
    <main className="tpage">
      <div className="thead"><h1>🧑‍🏫 선생님 화면</h1><a className="btn sm" href="/">← 칠판 화면으로</a></div>
      {msg && <div className="toast" onClick={() => setMsg("")}>{msg}</div>}

      <div className="card">
        <h2>1. 배경 그림</h2>
        <p className="sub">칠판 첫 화면 뒤에 깔리는 그림이에요. 여러 장 올려 두고 그날그날 골라 쓸 수 있어요. 가로로 긴 그림(16:9)이 가장 잘 맞아요.</p>
        <label className="btn file">{busy === "bg" ? "올리는 중…" : "🖼️ 배경 그림 올리기 (여러 장 가능)"}
          <input type="file" accept="image/*" multiple hidden disabled={!!busy} onChange={(e) => { addBgs([...e.target.files]); e.target.value = ""; }} />
        </label>
        <div className="grid">
          {cfg.bgs.map((b) => (
            <div key={b.id} className={`tile${(cfg.bg || cfg.bgs[0]?.id) === b.id ? " on" : ""}`}>
              <img src={b.url} alt="" />
              {(cfg.bg || cfg.bgs[0]?.id) === b.id ? <b className="using">✅ 지금 쓰는 배경</b>
                : <button className="btn sm" onClick={() => save({ ...cfg, bg: b.id })}>이 배경 쓰기</button>}
              <button className="btn sm ghost" onClick={() => confirm("이 배경을 목록에서 뺄까요?") && save({ ...cfg, bgs: cfg.bgs.filter((x) => x.id !== b.id), bg: cfg.bg === b.id ? "" : cfg.bg })}>빼기</button>
            </div>
          ))}
          {!cfg.bgs.length && <p className="sub">아직 배경이 없어요. 지금은 기본 색 배경이 나와요.</p>}
        </div>
      </div>

      <div className="card">
        <h2>2. 선생님 그림 (따라 그리기·색칠하기)</h2>
        <p className="sub">아이들이 「무엇을 그릴까요?」에서 고르는 밑그림이에요. 테두리만 있는 색칠 그림이 가장 좋아요. 아이가 그린 선과 함께 전시돼요.</p>
        <input className="inp" value={gName} onChange={(e) => setGName(e.target.value)} maxLength={20} placeholder="그림 이름 (예: 토끼) — 한 장 올릴 때만, 비우면 파일 이름" />
        <label className="btn file">{busy === "guide" ? "올리는 중…" : "✏️ 선생님 그림 넣기 (여러 장 가능)"}
          <input type="file" accept="image/*" multiple hidden disabled={!!busy} onChange={(e) => { addGuides([...e.target.files]); e.target.value = ""; }} />
        </label>
        <div className="grid">
          {cfg.guides.map((g) => (
            <div key={g.id} className="tile">
              <img src={g.url} alt="" style={{ objectFit: "contain", background: "#fff" }} />
              <b>{g.name}</b>
              <button className="btn sm ghost" onClick={() => confirm("이 그림을 뺄까요?") && save({ ...cfg, guides: cfg.guides.filter((x) => x.id !== g.id) })}>빼기</button>
            </div>
          ))}
          {!cfg.guides.length && <p className="sub">아직 없어요. 기본 따라 그리기(동그라미·해·별·물고기·자동차·사과)는 늘 나와요.</p>}
        </div>
      </div>

      <div className="card">
        <h2>3. 전시된 그림 ({arts.filter((a) => !a.hidden).length}장 전시 중 / 전체 {arts.length}장)</h2>
        <p className="sub">칠판에는 최근 30장이 떠 있어요. 잘못 올라간 그림은 「숨기기」, 언제든 「되살리기」.</p>
        <div className="grid">
          {arts.map((a) => (
            <div key={a.id} className={`tile${a.hidden ? " off" : ""}`}>
              <img src={a.img} alt="" loading="lazy" />
              <small>{new Date(a.at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}</small>
              <button className="btn sm ghost" onClick={() => toggle(a)}>{a.hidden ? "되살리기" : "숨기기"}</button>
            </div>
          ))}
          {!arts.length && <p className="sub">아직 그림이 없어요.</p>}
        </div>
      </div>

      <div className="card">
        <h2>4. 비밀번호 바꾸기</h2>
        {usingDefault && <p className="err">지금 처음 비밀번호(1234)를 쓰고 있어요. 바꿔 두세요.</p>}
        <input className="inp" type="password" inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder="새 비밀번호 (숫자 4~8자리)" />
        <button className="btn" onClick={changePin}>바꾸기</button>
      </div>
    </main>
  );
}
