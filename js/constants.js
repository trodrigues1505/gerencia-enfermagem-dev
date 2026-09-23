/* ─── CONSTANTS ─── */
const GC = {
  emergencia:      { bg:"#FEE2E2", border:"#FCA5A5", text:"#991B1B", dot:"#EF4444", label:"Emergência",      emoji:"🔴" },
  urgencia:        { bg:"#FEF9C3", border:"#FDE047", text:"#713F12", dot:"#EAB308", label:"Urgência",         emoji:"🟡" },
  andamento_cor:   { bg:"#FEF3C7", border:"#FCD34D", text:"#92400E", dot:"#F59E0B", label:"Em andamento",     emoji:"🟠" },
  menor_gravidade: { bg:"#DCFCE7", border:"#86EFAC", text:"#14532D", dot:"#22C55E", label:"Menor gravidade",  emoji:"🟢" },
  finalizado_cor:  { bg:"#F3E8FF", border:"#D8B4FE", text:"#581C87", dot:"#A855F7", label:"Finalizado",       emoji:"⚪" },
  agendamento:     { bg:"#F1F5F9", border:"#CBD5E1", text:"#334155", dot:"#94A3B8", label:"Agendamento",      emoji:"⚪" },
  retorno:         { bg:"#FDF2F8", border:"#F9A8D4", text:"#831843", dot:"#EC4899", label:"Retorno",          emoji:"🔵" }
};

const STATUS_OPTIONS = ["", "REINSERIR", "EVADIU", "EVASÃO", "ALTA", "ALTA MÉDICA", "RESOLVIDO COM RECURSOS LOCAIS", "FINALIZADO VIA CROSS", "ENCAMINHAR AMANHÃ"];

const STATUS_EMOJI = {
  "EVADIU": "[!]", "EVASÃO": "[!]",
  "ALTA": "[ALTA]", "ALTA MÉDICA": "[ALTA]",
  "FINALIZADO VIA CROSS": "[OK]", "RESOLVIDO COM RECURSOS LOCAIS": "[OK]",
  "REINSERIR": "[>>]", "ENCAMINHAR AMANHÃ": "[>>]"
};

const PR_EMOJI = { "01":"[P1]", "02":"[P2]", "03":"[P3]", "04":"[P4]" };

/* ─── IDs dos usuários com funções especiais ─── */
const AUTH_UID_VICTOR  = "43b06664-2357-4e82-a1cf-218232e43603";
const AUTH_UID_CARLOS  = "9514cb90-88d5-4f34-a638-5de3a44772e8";
const AUTH_UID_SANTUZA = "164f7435-79f6-4aad-aae4-4eee27fad72c";
