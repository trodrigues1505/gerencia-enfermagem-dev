/* ─── USERS PANEL ─── */
function UsersPanel({
  currentUser,
  userId,
  showT,
  cards
}) {
  const [users, setUsers] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    tipo: "COREN",
    registro: "",
    nome: "",
    zap: "",
    foto: null
  });
  const [loading, setLoading] = useState(true);

  /* Calcula métricas de tempo por auth_uid para os cards da coluna aceite */
  const aceiteCards = React.useMemo(() => (cards || []).filter(c => c.col_id === "aceite"), [cards]);

  function calcMediaTempos(authUid, campo) {
    /* campo: "hora_prioridade" (Victor) ou "hora_escala_equipe" (Carlos/Santuza) */
    const deltas = aceiteCards
      .filter(c => c[campo] && c.created_at)
      .map(c => calcDeltaMin(c.created_at, c[campo]))
      .filter(d => d !== null && d >= 0);
    if (!deltas.length) return null;
    return deltas.reduce((a, b) => a + b, 0) / deltas.length;
  }

  const tempoVictor  = calcMediaTempos(AUTH_UID_VICTOR,  "hora_prioridade");
  const tempoCarlos  = calcMediaTempos(AUTH_UID_CARLOS,  "hora_escala_equipe");
  const tempoSantuza = calcMediaTempos(AUTH_UID_SANTUZA, "hora_escala_equipe");

  /* Mapa auth_uid → tempo médio da função especial */
  const tempoEspecial = {
    [AUTH_UID_VICTOR]:  tempoVictor  !== null ? { label: "Prioridade em " + fmtDelta(tempoVictor),  bg: "#F5F3FF", color: "#6D28D9" } : null,
    [AUTH_UID_CARLOS]:  tempoCarlos  !== null ? { label: "Escala em "    + fmtDelta(tempoCarlos),   bg: "#EFF6FF", color: "#1D4ED8" } : null,
    [AUTH_UID_SANTUZA]: tempoSantuza !== null ? { label: "Escala em "    + fmtDelta(tempoSantuza),  bg: "#EFF6FF", color: "#1D4ED8" } : null,
  };

  useEffect(() => {
    load();
  }, []);
  async function load() {
    setLoading(true);
    try {
      setUsers(await sbGet("users", "order=created_at.asc"));
    } catch {}
    setLoading(false);
  }
  // Aprovar deixou de ser so mudar status: sem conta no Auth a pessoa nao
  // autentica. A Edge Function cria a conta com senha = registro e marca
  // senha_trocada=false, para o gate de troca obrigatoria pegar no 1o acesso.
  async function action(act, id) {
    const mapa = { approve: "aprovar", delete: "remover", block: "bloquear" };
    try {
      const r = await adminUsuarios(mapa[act] || act, id);
      load();
      if (act === "approve" && r?.senhaInicial)
        showT(`Aprovado. Senha inicial: ${r.senhaInicial} (o próprio registro).`);
      else
        showT(act === "delete" ? "Removido." : act === "approve" ? "Aprovado." : "Bloqueado/desbloqueado.",
              act === "delete" ? "err" : "ok");
    } catch (ex) { showT(ex.message, "err"); }
  }

  async function resetarSenha(u) {
    const reg = (u.coren || u.crm || "").trim();
    if (!window.confirm(`Redefinir a senha de ${u.nome || reg} para o registro (${reg})?\n\nA pessoa terá que escolher uma nova senha no próximo acesso.`)) return;
    try {
      const r = await adminUsuarios("redefinir_senha", u.id);
      load();
      showT(`Senha redefinida para: ${r.senhaInicial}`);
    } catch (ex) { showT(ex.message, "err"); }
  }
  function startEdit(u) {
    setEditing(u.id);
    setForm({
      tipo: u.tipo || "COREN",
      registro: u.coren || u.crm || "",
      nome: u.nome,
      zap: u.zap || "",
      foto: u.foto || null
    });
    setShowAdd(true);
  }
  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.registro.trim() || !form.nome.trim()) return;
    const act = editing ? "update" : "create";
    await fn("users-write", {
      action: act,
      id: editing,
      body: {
        tipo: form.tipo,
        registro: form.registro,
        nome: form.nome,
        zap: form.zap,
        foto: form.foto
      }
    }, userId);
    setShowAdd(false);
    setEditing(null);
    setForm({
      tipo: "COREN",
      registro: "",
      nome: "",
      zap: "",
      foto: null
    });
    load();
    showT(editing ? "Atualizado." : "Cadastrado.");
  }
  function handleFoto(e) {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => setForm(p => ({
      ...p,
      foto: ev.target.result
    }));
    r.readAsDataURL(f);
  }
  const sC = {
    aprovado: "#16A34A",
    pendente: "#F59E0B",
    bloqueado: "#EF4444"
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 16,
      color: "#0F172A"
    }
  }, "Profissionais"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#64748B",
      marginTop: 2
    }
  }, "Sincronizado com Supabase em tempo real")), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => {
      setShowAdd(p => !p);
      setEditing(null);
      setForm({
        tipo: "COREN",
        registro: "",
        nome: "",
        zap: "",
        foto: null
      });
    }
  }, showAdd ? "✕ Fechar" : "+ Cadastrar")), showAdd && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#fff",
      border: "1px solid #E2E8F0",
      borderRadius: 12,
      padding: "16px 20px",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 13,
      color: "#0F172A",
      marginBottom: 12
    }
  }, editing ? "Editar profissional" : "Novo profissional"), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleSubmit
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "0 12px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: "1/-1",
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, ["COREN", "CRM"].map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    type: "button",
    onClick: () => setForm(p => ({
      ...p,
      tipo: t
    })),
    style: {
      flex: 1,
      padding: "7px",
      borderRadius: 7,
      border: `2px solid ${form.tipo === t ? "#0F172A" : "#E2E8F0"}`,
      background: form.tipo === t ? "#0F172A" : "#fff",
      color: form.tipo === t ? "#fff" : "#64748B",
      cursor: "pointer",
      fontWeight: 600,
      fontSize: 12
    }
  }, t)))), [["Registro", form.tipo, "registro"], ["Nome completo", "Nome", "nome"], ["WhatsApp", "(19) 99999-9999", "zap"]].map(([label, ph, key]) => /*#__PURE__*/React.createElement("div", {
    key: key,
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: lbl_s
  }, label), /*#__PURE__*/React.createElement("input", {
    value: form[key] || "",
    onChange: e => setForm(p => ({
      ...p,
      [key]: e.target.value
    })),
    placeholder: ph,
    style: inp_s,
    required: key !== "zap"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: "1/-1",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: lbl_s
  }, "Foto"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, form.foto && /*#__PURE__*/React.createElement("img", {
    src: form.foto,
    style: {
      width: 36,
      height: 36,
      borderRadius: "50%",
      objectFit: "cover"
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      padding: "5px 12px",
      border: "1px solid #E2E8F0",
      borderRadius: 6,
      cursor: "pointer",
      fontSize: 11,
      color: "#64748B"
    }
  }, "Escolher", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*",
    onChange: handleFoto,
    style: {
      display: "none"
    }
  }))))), /*#__PURE__*/React.createElement(Btn, {
    type: "submit",
    style: {
      padding: "8px 20px"
    }
  }, editing ? "Salvar" : "Cadastrar e aprovar"))), loading && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: 32,
      color: "#94A3B8",
      fontSize: 13
    }
  }, "Carregando…"), !loading && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#fff",
      border: "2px solid #E2E8F0",
      borderRadius: 10,
      padding: "12px 16px",
      marginBottom: 8,
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: "50%",
      background: "#1E40AF",
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, currentUser?.foto ? /*#__PURE__*/React.createElement("img", {
    src: currentUser.foto,
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      borderRadius: "50%"
    }
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#fff",
      fontWeight: 700,
      fontSize: 14
    }
  }, "F")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 13,
      color: "#0F172A"
    }
  }, "Fabiana Faria de Figueiredo"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#64748B"
    }
  }, "COREN 299283 · Administradora")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      padding: "2px 8px",
      borderRadius: 99,
      background: "#EFF6FF",
      color: "#1E40AF"
    }
  }, "Admin")), !loading && users.filter(u => u.coren !== "299283").map(u =>
  React.createElement("div", {
    key: u.id,
    className: "ge-user-card",
    style: { background:"#fff", border:"1px solid #E2E8F0", borderRadius:10, padding:"12px 16px", marginBottom:8 }
  },
    /* Linha 1: foto + info + status + ações */
    React.createElement("div", { style:{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" } },
      /* Avatar */
      React.createElement("div", { style:{ width:40, height:40, borderRadius:"50%", background:"#F1F5F9", overflow:"hidden", flexShrink:0, border:"1px solid #E2E8F0", display:"flex", alignItems:"center", justifyContent:"center" } },
        u.foto
          ? React.createElement("img", { src:u.foto, style:{ width:"100%", height:"100%", objectFit:"cover" } })
          : React.createElement("span", { style:{ fontSize:16, color:"#CBD5E1" } }, "👤")
      ),
      /* Nome + registro */
      React.createElement("div", { style:{ flex:1, minWidth:0 } },
        React.createElement("div", { style:{ fontWeight:600, fontSize:13, color:"#0F172A", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" } }, u.nome),
        React.createElement("div", { style:{ fontSize:11, color:"#64748B" } }, u.tipo, " ", u.coren || u.crm, u.zap ? " · " + u.zap : "")
      ),
      /* Status badge */
      React.createElement("span", { style:{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:99, whiteSpace:"nowrap", background: u.status==="aprovado"?"#F0FDF4":u.status==="pendente"?"#FFFBEB":"#FEF2F2", color: sC[u.status]||"#64748B" } }, u.status),
      /* TempoTag */
      u.auth_uid && tempoEspecial[u.auth_uid] && React.createElement(TempoTag, tempoEspecial[u.auth_uid]),
      /* Botões de ação */
      React.createElement("div", { style:{ display:"flex", gap:4, flexShrink:0, flexWrap:"wrap" } },
        React.createElement("button", { onClick:()=>resetarSenha(u), className:"can-livro-toggle", title:"Redefinir senha" }, "🔑 Senha"),
        React.createElement("button", { onClick:()=>startEdit(u), style:{ padding:"5px 10px", border:"1px solid #E2E8F0", borderRadius:6, background:"none", color:"#374151", cursor:"pointer", fontSize:11 } }, "✏️"),
        u.status==="pendente" && React.createElement("button", { onClick:()=>action("approve",u.id), style:{ padding:"5px 10px", border:"none", borderRadius:6, background:"#16A34A", color:"#fff", cursor:"pointer", fontSize:11, fontWeight:600 } }, "Aprovar"),
        u.status==="aprovado" && React.createElement("button", { onClick:()=>action("block",u.id), style:{ padding:"5px 10px", border:"1px solid #FCA5A5", borderRadius:6, background:"none", color:"#DC2626", cursor:"pointer", fontSize:11 } }, "Bloquear"),
        u.status==="bloqueado" && React.createElement("button", { onClick:()=>action("unblock",u.id), style:{ padding:"5px 10px", border:"1px solid #86EFAC", borderRadius:6, background:"none", color:"#16A34A", cursor:"pointer", fontSize:11 } }, "Desbloquear"),
        React.createElement("button", { onClick:()=>action("delete",u.id), style:{ padding:"5px 8px", border:"1px solid #E2E8F0", borderRadius:6, background:"none", color:"#94A3B8", cursor:"pointer", fontSize:11 } }, "✕")
      )
    ),
    /* Linha 2: permissões */
    React.createElement("div", { style:{ borderTop:"1px solid #F1F5F9", paddingTop:8 } },
      React.createElement("div", { style:{ fontSize:10, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:".05em", marginBottom:4 } }, "Acesso"),
      React.createElement("div", { style:{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:8 } },
        React.createElement("button", { onClick:()=>toggleFlag(u.id,"can_kanban",u.can_kanban,load), className:"can-livro-toggle"+(u.can_kanban?" on":"") }, u.can_kanban?"🗂 Kanban ✓":"🗂 Kanban"),
        React.createElement("button", { onClick:()=>toggleFlag(u.id,"can_livro",u.can_livro,load), className:"can-livro-toggle"+(u.can_livro?" on":"") }, u.can_livro?"📒 Livro ✓":"📒 Livro"),
        React.createElement("button", { onClick:()=>toggleFlag(u.id,"can_planilha",u.can_planilha,load), className:"can-livro-toggle"+(u.can_planilha?" on":"") }, u.can_planilha?"📋 Planilha ✓":"📋 Planilha")
      ),
      React.createElement("div", { style:{ fontSize:10, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:".05em", marginBottom:4 } }, "Funções especiais"),
      React.createElement("div", { style:{ display:"flex", gap:4, flexWrap:"wrap" } },
        React.createElement("button", { onClick:()=>toggleFlag(u.id,"can_prioridade",u.can_prioridade,load), className:"can-livro-toggle"+(u.can_prioridade?" on":"") }, u.can_prioridade?"🔢 Prioridade ✓":"🔢 Prioridade"),
        React.createElement("button", { onClick:()=>toggleFlag(u.id,"can_escala",u.can_escala,load), className:"can-livro-toggle"+(u.can_escala?" on":"") }, u.can_escala?"👥 Escala ✓":"👥 Escala"),
        React.createElement("button", { onClick:()=>toggleFlag(u.id,"can_justificativa",u.can_justificativa,load), className:"can-livro-toggle"+(u.can_justificativa?" on":"") }, u.can_justificativa?"⚖ Justif. ✓":"⚖ Justif."),
        React.createElement("button", { onClick:()=>toggleFlag(u.id,"can_acoes",u.can_acoes,load), className:"can-livro-toggle"+(u.can_acoes?" on":"") }, u.can_acoes?"✅ Tarefas ✓":"✅ Tarefas")
      )
    )
  )
));
}
