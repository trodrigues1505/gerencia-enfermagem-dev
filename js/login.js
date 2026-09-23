/* ─── LOGIN ─── */
/* ─── Troca obrigatoria de senha ───────────────────────────────────────────
 * A senha inicial e o proprio COREN/CRM, que e consultavel no site do
 * Conselho. Enquanto senha_trocada for false, o app NAO abre: e isto que
 * separa "tem senha" de "nao tem autenticacao".
 */
function TrocaSenhaScreen({ user, onPronto, onSair }) {
  const [s1, setS1] = useState("");
  const [s2, setS2] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const registro = (user.coren || user.crm || "").trim();

  async function salvar(e) {
    e.preventDefault();
    setErr("");
    if (s1.length < 8) return setErr("A senha precisa ter ao menos 8 caracteres.");
    if (s1 !== s2)     return setErr("As senhas não conferem.");
    if (s1.trim() === registro) return setErr("A nova senha não pode ser igual ao seu registro.");
    setLoading(true);
    try { onPronto(await authTrocarSenha(s1, user.id)); }
    catch (ex) { setErr(ex.message); }
    setLoading(false);
  }
  const inp2 = { ...inp_s, padding: "10px 12px", fontSize: 14 };
  const campo = (label, val, set) => /*#__PURE__*/React.createElement("div", { style:{ marginBottom:12 } },
    /*#__PURE__*/React.createElement("label", { style:{ display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:5 } }, label),
    /*#__PURE__*/React.createElement("input", { type:"password", value:val, onChange:e=>set(e.target.value), style:inp2, autoComplete:"new-password" })
  );
  return /*#__PURE__*/React.createElement("div", {
    style:{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#F1F5F9", padding:20 }
  }, /*#__PURE__*/React.createElement("form", {
    onSubmit: salvar,
    style:{ background:"#fff", borderRadius:16, padding:"28px 30px", width:"100%", maxWidth:400, boxShadow:"0 4px 24px rgba(15,23,42,.08)" }
  },
    /*#__PURE__*/React.createElement("div", { style:{ fontSize:19, fontWeight:700, color:"#0F172A", marginBottom:6 } }, "Defina sua senha"),
    /*#__PURE__*/React.createElement("div", { style:{ fontSize:13, color:"#64748B", lineHeight:1.5, marginBottom:20 } },
      "Olá, ", user.nome || registro, ". Você ainda está usando o seu registro como senha. ",
      "Como ele é uma informação pública, é preciso escolher uma senha própria antes de continuar."),
    campo("Nova senha", s1, setS1),
    campo("Repita a nova senha", s2, setS2),
    err && /*#__PURE__*/React.createElement("div", { style:{ fontSize:12, color:"#B91C1C", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, padding:"8px 10px", marginBottom:12 } }, err),
    /*#__PURE__*/React.createElement("button", {
      type:"submit", disabled:loading,
      style:{ width:"100%", padding:"11px 16px", border:"none", borderRadius:10, background:"#0F172A", color:"#fff", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit", opacity:loading?.6:1 }
    }, loading ? "Salvando…" : "Salvar e entrar"),
    /*#__PURE__*/React.createElement("button", {
      type:"button", onClick:onSair,
      style:{ width:"100%", marginTop:8, padding:"9px 16px", border:"none", borderRadius:10, background:"transparent", color:"#64748B", fontSize:13, cursor:"pointer", fontFamily:"inherit" }
    }, "Sair")
  ));
}

function LoginScreen({
  onLogin,
  showT
}) {
  const [mode, setMode] = useState("login");
  const [coren, setCoren] = useState("");
  const [senha, setSenha] = useState("");
  const [showP, setShowP] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [reg, setReg] = useState({
    tipo: "COREN",
    registro: "",
    nome: "",
    zap: "",
    foto: null
  });
  async function doLogin(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      // Antes: Edge Function auth-login, que devolvia o usuario e o app
      // guardava em localStorage — sessao so no navegador, invisivel para o
      // Postgres. Agora passa pelo Supabase Auth e gera JWT de verdade.
      const perfil = await authLogin(coren.trim(), senha);
      onLogin(perfil);
    } catch (ex) {
      setErr(ex.message);
    }
    setLoading(false);
  }
  async function doRegister(e) {
    e.preventDefault();
    setErr("");
    if (!reg.registro.trim() || !reg.nome.trim()) {
      setErr("Preencha os campos obrigatórios.");
      return;
    }
    try {
      await fn("users-register", {
        tipo: reg.tipo,
        registro: reg.registro.trim(),
        nome: reg.nome.trim(),
        zap: reg.zap,
        foto: reg.foto
      });
      setMode("login");
      showT("Cadastro enviado! Aguarde aprovação da administradora.");
    } catch (ex) {
      setErr(ex.message);
    }
  }
  function handleFoto(e, setter) {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => setter(p => ({
      ...p,
      foto: ev.target.result
    }));
    r.readAsDataURL(f);
  }
  const inp2 = {
    ...inp_s,
    padding: "10px 12px",
    fontSize: 14
  };
  if (mode === "register") return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      background: "#F1F5F9",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#fff",
      borderRadius: 16,
      width: "100%",
      maxWidth: 420,
      boxShadow: "0 8px 40px rgba(0,0,0,.1)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#0F172A",
      padding: "20px 24px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 16,
      color: "#fff"
    }
  }, "+ Gerência de Enfermagem"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#475569",
      marginTop: 2
    }
  }, "Solicitar acesso")), /*#__PURE__*/React.createElement("form", {
    onSubmit: doRegister,
    style: {
      padding: "20px 24px",
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, ["COREN", "CRM"].map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    type: "button",
    onClick: () => setReg(p => ({
      ...p,
      tipo: t
    })),
    style: {
      flex: 1,
      padding: "8px",
      borderRadius: 8,
      border: `2px solid ${reg.tipo === t ? "#0F172A" : "#E2E8F0"}`,
      background: reg.tipo === t ? "#0F172A" : "#fff",
      color: reg.tipo === t ? "#fff" : "#64748B",
      cursor: "pointer",
      fontWeight: 600,
      fontSize: 13
    }
  }, t))), [["Número do registro *", "registro", `Digite seu ${reg.tipo}`], ["Nome completo *", "nome", "Nome completo"], ["WhatsApp", "zap", "(19) 99999-9999"]].map(([label, key, ph]) => /*#__PURE__*/React.createElement("div", {
    key: key
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      ...lbl_s,
      marginBottom: 4
    }
  }, label), /*#__PURE__*/React.createElement("input", {
    value: reg[key] || "",
    onChange: e => setReg(p => ({
      ...p,
      [key]: e.target.value
    })),
    placeholder: ph,
    style: inp2,
    required: label.includes("*")
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      ...lbl_s,
      marginBottom: 6
    }
  }, "Foto (opcional)"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, reg.foto && /*#__PURE__*/React.createElement("img", {
    src: reg.foto,
    style: {
      width: 44,
      height: 44,
      borderRadius: "50%",
      objectFit: "cover"
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      padding: "7px 14px",
      border: "1px solid #E2E8F0",
      borderRadius: 8,
      cursor: "pointer",
      fontSize: 12,
      color: "#64748B",
      background: "#F8FAFC"
    }
  }, "Escolher foto", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*",
    onChange: e => handleFoto(e, setReg),
    style: {
      display: "none"
    }
  })))), err && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#FEE2E2",
      color: "#991B1B",
      padding: "8px 12px",
      borderRadius: 8,
      fontSize: 12
    }
  }, err), /*#__PURE__*/React.createElement(Btn, {
    type: "submit",
    style: {
      padding: "11px",
      fontSize: 14
    }
  }, "Enviar cadastro"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      setMode("login");
      setErr("");
    },
    style: {
      padding: "8px",
      border: "none",
      background: "none",
      color: "#64748B",
      cursor: "pointer",
      fontSize: 13
    }
  }, "← Voltar ao login"))));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      background: "#F1F5F9",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#fff",
      borderRadius: 16,
      width: "100%",
      maxWidth: 380,
      boxShadow: "0 8px 40px rgba(0,0,0,.1)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#0F172A",
      padding: "28px 24px",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 48,
      height: 48,
      borderRadius: 12,
      background: "#1E40AF",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#fff",
      fontSize: 22,
      fontWeight: 700
    }
  }, "+")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 17,
      color: "#fff"
    }
  }, "Gerência de Enfermagem"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#475569",
      marginTop: 4
    }
  }, "Acesso restrito a profissionais autorizados")), /*#__PURE__*/React.createElement("form", {
    onSubmit: doLogin,
    style: { padding: "24px", display: "flex", flexDirection: "column", gap: 14 }
  },
    /*#__PURE__*/React.createElement("div", null,
      /*#__PURE__*/React.createElement("label", { style: { ...lbl_s, marginBottom: 4 } }, "COREN / CRM"),
      /*#__PURE__*/React.createElement("input", {
        value: coren, onChange: e => setCoren(e.target.value), style: inp2,
        placeholder: "Número do seu registro", autoComplete: "username",
        inputMode: "numeric"
      })),
    /* O campo de senha antes so aparecia para o COREN do admin — os demais
       entravam so com o registro. Com o Supabase Auth todos tem senha. */
    /*#__PURE__*/React.createElement("div", null,
      /*#__PURE__*/React.createElement("label", { style: { ...lbl_s, marginBottom: 4 } }, "Senha"),
      /*#__PURE__*/React.createElement("div", { style: { position: "relative" } },
        /*#__PURE__*/React.createElement("input", {
          type: showP ? "text" : "password", value: senha,
          onChange: e => setSenha(e.target.value),
          style: { ...inp2, paddingRight: 44 },
          placeholder: "••••••••", autoComplete: "current-password"
        }),
        /*#__PURE__*/React.createElement("button", {
          type: "button", onClick: () => setShowP(p => !p),
          "aria-label": showP ? "Ocultar senha" : "Mostrar senha",
          style: { position:"absolute", right:12, top:"50%", transform:"translateY(-50%)",
                   background:"none", border:"none", cursor:"pointer", color:"#94A3B8", fontSize:16 }
        }, showP ? "🙈" : "👁")),
      /*#__PURE__*/React.createElement("div", {
        style: { fontSize: 11, color: "#94A3B8", marginTop: 6, lineHeight: 1.5 }
      }, "Primeiro acesso? Use o seu próprio registro como senha — o sistema pede uma nova em seguida.")),
    err && /*#__PURE__*/React.createElement("div", {
      style: { background:"#FEF2F2", border:"1px solid #FECACA", color:"#991B1B",
               padding:"9px 12px", borderRadius:8, fontSize:12, lineHeight:1.5 }
    }, err),
    /*#__PURE__*/React.createElement(Btn, {
      type: "submit", disabled: loading || !coren.trim() || !senha,
      style: { padding: "11px", fontSize: 14 }
    }, loading ? "Entrando…" : "Entrar"),
    /*#__PURE__*/React.createElement("button", {
      type: "button", onClick: () => { setMode("register"); setErr(""); },
      style: { padding:"8px", border:"none", background:"none", color:"#64748B",
               cursor:"pointer", fontSize:13, fontFamily:"inherit" }
    }, "Sou novo aqui — solicitar acesso"))));
}