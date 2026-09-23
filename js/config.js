/* ─── CONFIG ─── */
const SB_URL = "https://ahcrscstdtfawoogsugi.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoY3JzY3N0ZHRmYXdvb2dzdWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2Mjk1MDgsImV4cCI6MjEwNDIwNTUwOH0.8ivWRA99AXXyBVFT3TQd5NuSod2eiowiI490Blt2zHM";
const FN_URL = `${SB_URL}/functions/v1`;
const ADMIN_COREN = "299283";

const EMAIL_DOM = "@scfm.local";
const emailDeRegistro = reg => String(reg||"").trim().toLowerCase() + EMAIL_DOM;

let _accessToken = null;
const setAccessToken = t => { _accessToken = t || null; };
const getAccessToken = () => _accessToken;

/* ─── API helpers ─── */
const H = userId => ({
  "Content-Type": "application/json",
  "apikey": SB_KEY,
  "Authorization": `Bearer ${_accessToken || SB_KEY}`,
  ...(userId ? { "x-user-id": userId } : {})
});

async function sbGet(table, params = "") {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${params}`, { headers: H() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function fn(name, body, userId) {
  const r = await fetch(`${FN_URL}/${name}`, {
    method: "POST",
    headers: H(userId),
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Erro desconhecido");
  return data;
}
