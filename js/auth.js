/* ─── Supabase Realtime client (carregado lazy via CDN) ─── */
let _sbClient = null;
async function getSbClient() {
  if (_sbClient) return _sbClient;
  if (!window.supabase) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
      s.onload = res;
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  _sbClient = window.supabase.createClient(SB_URL, SB_KEY);
  _sbClient.auth.onAuthStateChange((_e, sess) => setAccessToken(sess?.access_token));
  return _sbClient;
}

/* ─── Autenticacao ─── */
async function authLogin(registro, senha) {
  const sb = await getSbClient();
  const { data, error } = await sb.auth.signInWithPassword({
    email: emailDeRegistro(registro), password: senha
  });
  if (error) throw new Error("Registro ou senha inválidos.");
  setAccessToken(data.session.access_token);
  return await carregarPerfil(data.session.user.id);
}

async function carregarPerfil(authUid) {
  const rows = await sbGet("users", `auth_uid=eq.${authUid}&limit=1`);
  if (!rows.length) {
    await authLogout();
    throw new Error("Cadastro não aprovado. Procure a administradora.");
  }
  return rows[0];
}

async function authLogout() {
  try { const sb = await getSbClient(); await sb.auth.signOut(); } catch (e) {}
  setAccessToken(null);
}

async function authRestaurar() {
  const sb = await getSbClient();
  const { data } = await sb.auth.getSession();
  if (!data.session) return null;
  setAccessToken(data.session.access_token);
  try { return await carregarPerfil(data.session.user.id); }
  catch (e) { return null; }
}

async function authTrocarSenha(novaSenha, userRowId) {
  const sb = await getSbClient();
  const { error } = await sb.auth.updateUser({ password: novaSenha });
  if (error) throw new Error(error.message);
  const r = await fetch(`${SB_URL}/rest/v1/users?id=eq.${userRowId}`, {
    method: "PATCH",
    headers: { ...H(), Prefer: "return=representation" },
    body: JSON.stringify({ senha_trocada: true })
  });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json())[0];
}
