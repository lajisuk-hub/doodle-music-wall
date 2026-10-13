import { createClient } from "@supabase/supabase-js";

// 전시회 앱들과 같은 Supabase 프로젝트·표·버킷을 쓴다. 줄 이름이 dw- 로 시작해 다른 앱과 섞이지 않는다. (publishable key는 공개용)
//  - dw-config                 : 설정 (pinHash, bgs[{id,url}], bg(사용 중인 배경 id), guides[{id,url,name}])
//  - dw-art-<시각>-<난수>       : 아이 그림 한 장 (img, strokes[{c,w,p:[[x,y]...]}], guideImg, hidden)
const SUPABASE_URL = "https://pgywpdodatjfpivxmymn.supabase.co";
const SUPABASE_KEY = "sb_publishable_FeO3LdfFBB6KEwblcZPa2w_sW9dVuUg";
export const TABLE = "suseong_hub_content";
export const BUCKET = "suseong-hub";
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CONFIG_ID = "dw-config";
const ART = "dw-art-";

export async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── 설정 ─────────────────────────────────────────
export const DEFAULT_PIN = "1234";
export async function loadConfig() {
  const { data, error } = await supabase.from(TABLE).select("data").eq("id", CONFIG_ID).maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return { bgs: [], guides: [], ...data.data };
  // 처음 한 번: 기본 비밀번호 1234로 만든다
  const cfg = { pinHash: await sha256(DEFAULT_PIN), bgs: [], bg: "", guides: [] };
  await supabase.from(TABLE).insert({ id: CONFIG_ID, data: cfg });
  return cfg;
}
export async function saveConfig(cfg) {
  const { error } = await supabase.from(TABLE).update({ data: cfg, updated_at: new Date().toISOString() }).eq("id", CONFIG_ID);
  if (error) throw new Error(error.message);
}

// ── 그림 ─────────────────────────────────────────
const toArt = (row) => ({ id: row.id, ...(row.data || {}), hidden: !!row.data?.hidden, at: row.updated_at });

// since 이후에 생기거나 바뀐 것만. PostgREST는 1000줄씩만 주므로 끝까지 나눠 읽는다.
export async function loadArts(since) {
  const all = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(TABLE).select("id,data,updated_at").like("id", `${ART}%`).order("updated_at", { ascending: true }).range(from, from + 999);
    if (since) q = q.gt("updated_at", since);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    all.push(...data);
    if (data.length < 1000) break;
  }
  return all.map(toArt);
}
export async function addArt(data) {
  const id = `${ART}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { error } = await supabase.from(TABLE).insert({ id, data: { ...data, hidden: false } });
  if (error) throw new Error(error.message);
  return { id, ...data, hidden: false, at: new Date().toISOString() };
}
export async function setArtHidden(art, hidden) {
  const { id, at, ...data } = art;
  const { error } = await supabase.from(TABLE).update({ data: { ...data, hidden }, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

// ── 파일 올리기 (같은 이름 덮어쓰기는 안 되므로 늘 새 이름) ──
export async function uploadFile(folder, blob, ext, type) {
  const name = `doodle-wall/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(name, blob, { contentType: type, cacheControl: "31536000" });
  if (error) throw new Error(error.message);
  return supabase.storage.from(BUCKET).getPublicUrl(name).data.publicUrl;
}
