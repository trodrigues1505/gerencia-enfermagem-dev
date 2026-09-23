/* ─── UTILS ─── */
const todayStr = () => new Date().toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric" });
const nowStr   = () => new Date().toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" });

const loadLS = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const saveLS = (k, v)  => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* ─── buildText (regras 41-65) — emojis compatíveis WhatsApp ─── */
function buildText(cards, cols, settings) {
  const SEP = "--------------------";
  const appLink = settings?.app_url ? "\n\n" + SEP + "\nAcesse o sistema:\n" + settings.app_url : "";
  const lines = ["*GERENCIA DE ENFERMAGEM*", "Data: *" + todayStr() + " as " + nowStr() + "*", SEP];
  const COL_LABEL = {
    pendente:"PENDENTE DE ACEITE", aceite:"ACEITE CONFIRMADO",
    psiquiatria:"PSIQUIATRIA", andamento:"REMOCAO EM ANDAMENTO", finalizado:"FINALIZADAS"
  };
  cols.forEach(col => {
    const cc = cards.filter(c => c.col_id === col.id);
    if (!cc.length) return;
    const colLabel = COL_LABEL[col.id] || col.label.toUpperCase();
    lines.push(""); lines.push("*" + colLabel + "*");
    lines.push(cc.length + " paciente" + (cc.length !== 1 ? "s" : "")); lines.push(SEP);
    cc.forEach(c => {
      lines.push("");
      if (c.pr) lines.push(PR_EMOJI[c.pr] + " *PRIORIDADE " + String(c.pr).padStart(2,"0") + "*");
      const catL = { pediatria:"[Ped]", psiquiatria:"[Psi]", obstetricia:"[Obs]" };
      const catT = c.categoria && c.categoria !== "normal" ? catL[c.categoria] : c.is_rn ? "[RN]" : "";
      lines.push(`[PAC]${catT ? " " + catT : ""} *${c.nome}*${c.idade ? ` - ${c.idade}` : ""}`);
      if (c.setor) lines.push("Local: " + c.setor);
      const ambTxt = c.amb ? c.amb.includes("Av") ? "Amb. Avancada" : "Amb. Basica" : "";
      if (c.rec && c.hosp)       { lines.push("Enc: " + c.rec + " -> " + c.hosp); if (ambTxt) lines.push(ambTxt); }
      else if (c.rec)            { lines.push("Rec: " + c.rec + (ambTxt ? " | " + ambTxt : "")); }
      else if (ambTxt)           { lines.push(ambTxt); }
      if (c.cross_info) lines.push("Cross: " + c.cross_info);
      if (c.receptor)   lines.push("Receptor: " + c.receptor + (c.data_aceite ? " | " + c.data_aceite : "") + (c.hora_aceite ? " as " + c.hora_aceite : ""));
      if (c.status)     lines.push(STATUS_EMOJI[c.status] + " *" + c.status + "*");
    });
    lines.push("");
  });
  lines.push(SEP); lines.push("*RESUMO*");
  lines.push("Total: *" + cards.length + " pacientes*");
  cols.forEach(col => { const n = cards.filter(c => c.col_id === col.id).length; if (n > 0) lines.push((COL_LABEL[col.id] || col.label) + ": " + n); });
  lines.push(appLink);
  return lines.join("\n");
}

/* ─── strSim — similaridade de strings (Dice bigram) ─── */
function strSim(a, b) {
  if (!a || !b) return 0;
  a = a.toUpperCase().trim(); b = b.toUpperCase().trim();
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bg = s => { const m = new Map(); for (let i=0;i<s.length-1;i++){const k=s[i]+s[i+1];m.set(k,(m.get(k)||0)+1);} return m; };
  const aB=bg(a),bB=bg(b); let inter=0;
  for (const [k,v] of aB) inter+=Math.min(v,bB.get(k)||0);
  return (2*inter)/(a.length+b.length-2);
}

/* ─── calcDeltaMin / fmtDelta (AcoesEnfermagem) ─── */
function calcDeltaMin(createdAt, horaStr) {
  if (!createdAt || !horaStr) return null;
  try {
    const base = new Date(createdAt);
    const [h, m] = horaStr.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    const target = new Date(base);
    target.setHours(h, m, 0, 0);
    const diff = (target - base) / 60000;
    return diff >= 0 ? diff : null;
  } catch { return null; }
}
function fmtDelta(min) {
  if (min === null || min === undefined) return null;
  if (min < 60) return Math.round(min) + " min";
  const h = Math.floor(min / 60);
  const rm = Math.round(min % 60);
  return h + "h" + (rm > 0 ? String(rm).padStart(2, "0") : "");
}
