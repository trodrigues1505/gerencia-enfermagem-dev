/* ─── CARD MODAL ─── */
// Normaliza cabeçalho para comparação (remove acentos, minúsculas, espaços extras)
function normKanbanHdr(s){
  // B2: remove pontuacao ANTES de colapsar espaco. Sem isto, cabecalhos reais
  // do CROSS ("Nº DA FICHA CROSS", "LOCALIZACAO/SETOR") nao casam com o mapa,
  // matched cai abaixo de 40% e o lote inteiro entra deslocado.
  return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[\u00a0\u200b-\u200d\ufeff]/g," ")
    .replace(/[.\-_/\\,;:\u00ba\u00b0\u00aa'"()\[\]]/g," ")
    .toLowerCase().replace(/\s+/g," ").trim();
}

// Mapa de cabeçalhos TSV -> campo interno do card
// Aceita tanto os nomes "amigáveis" para a IA externa quanto abreviações
const KANBAN_HDR_MAP = (()=>{
  const m = {};
  const entries = [
    // [cabeçalho normalizado, campo interno]
    ["nome paciente",      "nome"],
    ["nome do paciente",   "nome"],
    ["paciente",           "nome"],
    ["nome",               "nome"],
    ["idade",              "idade"],
    ["data admissao cross","adm"],
    ["data admissao",      "adm"],
    ["data solicitacao",   "adm"],
    ["data solic.",        "adm"],
    ["data solic",         "adm"],
    ["data",               "adm"],
    ["hora admissao",      "hora_adm"],
    ["hora solicitacao",   "hora_adm"],
    ["hora solic.",        "hora_adm"],
    ["hora solic",         "hora_adm"],
    ["hora",               "hora_adm"],
    ["no ficha cross",     "ficha_cross"],
    ["n\u00ba ficha cross","ficha_cross"],
    ["nº ficha cross",     "ficha_cross"],
    ["n ficha cross",      "ficha_cross"],
    ["ficha cross",        "ficha_cross"],
    ["ficha",              "ficha_cross"],
    ["ss",                 "ficha_cross"],
    ["hipotese diagnostica","hd"],
    ["hipotese",           "hd"],
    ["diagnostico",        "hd"],
    ["hd",                 "hd"],
    ["cid",                "hd"],
    ["setor",              "setor"],
    ["leito",              "setor"],
    ["setor leito",        "setor"],
    ["unidade solicitante","setor"],
    ["recurso especialidade","rec"],
    ["especialidade",      "rec"],
    ["recurso",            "rec"],
    ["1o recurso",         "rec"],
    ["hospital receptor",  "hosp"],
    ["hospital",           "hosp"],
    ["destino",            "hosp"],
    ["instituicao destino","hosp"],
    ["gravidade",          "grav"],
    ["prioridade",         "grav"],
    ["medico solicitante", "medico_solic"],
    ["medico",             "medico_solic"],
    ["dr",                 "medico_solic"],
    ["observacoes",        "obs"],
    ["observacao",         "obs"],
    ["resumo clinico",     "obs"],
    ["obs",                "obs"],
    ["ambulancia",         "amb"],
    ["tipo ambulancia",    "amb"],
    ["categoria",          "categoria"],
  ];
  entries.forEach(([h,f])=>{ m[normKanbanHdr(h)]=f; });
  return m;
})();

// Normaliza valor de gravidade para chave interna do GC
const KANBAN_GRAV_NORM = (()=>{
  const m = {};
  // por chave
  Object.keys(GC).forEach(k=>{ m[normKanbanHdr(k)]=k; });
  // por label
  Object.entries(GC).forEach(([k,v])=>{ m[normKanbanHdr(v.label)]=k; });
  // aliases comuns
  const extra = {
    "vermelho":"emergencia","amarelo":"urgencia","verde":"menor_gravidade","cinza":"agendamento",
    "emergencia":"emergencia","urgencia":"urgencia","menor gravidade":"menor_gravidade","agendamento":"agendamento",
    "0":"emergencia","1":"urgencia","2":"menor_gravidade",
  };
  Object.entries(extra).forEach(([k,v])=>{ m[normKanbanHdr(k)]=v; });
  return m;
})();

// Normaliza ambulância para valor aceito pelo banco
function normKanbanAmb(v){
  if(!v)return "";
  const u=String(v).trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  if(u==="BASICA"||u==="SBV"||u==="BASICO")return "Básica";
  if(u==="AVANCADA"||u==="SAV"||u==="AVANCADO")return "Avançada";
  return v;
}

// Parseia um bloco TSV e retorna { data, aviso? }
// Aceita: 1 linha sem cabeçalho (assume ordem padrão)
//         OU cabeçalho + 1 linha de dados (detecta automaticamente)
// Problema conhecido: se a IA omitir uma célula sem deixar vazio (\t\t),
// todas as colunas seguintes ficam deslocadas. Detectamos e avisamos.
function parseTSVToCard(txt){
  const lines = txt.replace(/\r/g,"").split("\n").filter(l=>l.trim()!=="");
  if(lines.length===0) return null;

  const DEFAULT_ORDER = ["nome","idade","adm","hora_adm","ficha_cross","medico_solic","hd","setor","rec","hosp","grav","obs"];

  const firstCells = lines[0].split("\t").map(normKanbanHdr);
  const matchedCount = firstCells.filter(c=>KANBAN_HDR_MAP[c]).length;
  const hasHeader = matchedCount >= Math.max(2, Math.floor(firstCells.length * 0.4));

  let fieldOrder, dataLine, aviso = null;
  if(hasHeader && lines.length >= 2){
    fieldOrder = firstCells.map(c=>KANBAN_HDR_MAP[c]||null);
    dataLine = lines[1].split("\t");
    // Detectar desalinhamento: dados têm menos colunas que cabeçalho
    if(dataLine.length < fieldOrder.length){
      const faltando = fieldOrder.length - dataLine.length;
      aviso = `⚠ A IA gerou ${faltando} coluna${faltando>1?"s":""} a menos que o cabeçalho — verifique se os campos estão corretos. Peça à IA para deixar célula vazia (—) quando não houver valor.`;
    }
  } else {
    fieldOrder = DEFAULT_ORDER;
    dataLine = lines[0].split("\t");
  }

  const raw = {};
  fieldOrder.forEach((f,i)=>{
    if(f && dataLine[i]!==undefined && dataLine[i].trim()!=="" && dataLine[i].trim()!=="—" && dataLine[i].trim()!=="-"){
      raw[f] = dataLine[i].trim();
    }
  });

  if(Object.keys(raw).length===0) return null;

  // Normalizar gravidade — aceita VERMELHO/AMARELO/VERDE/CINZA e labels
  if(raw.grav){
    const gravNorm = KANBAN_GRAV_NORM[normKanbanHdr(raw.grav)];
    if(gravNorm) raw.grav = gravNorm;
    // Se o valor não parece gravidade (ex: texto longo), descarta
    else if(raw.grav.length > 30) delete raw.grav;
  }
  // Normalizar ambulância
  if(raw.amb) raw.amb = normKanbanAmb(raw.amb);

  raw._aviso = aviso;
  return raw;
}

function CardModal({
  card,
  cols,
  onClose,
  onSave,
  onUpdateCard,
  onDel,
  isAdmin,
  currentUser,
  comments,
  onAddComment,
  onDelComment
}) {
  const [form, setForm] = useState({
    ...card
  });
  const [tab, setTab] = useState("info");
  const [commentText, setCommentText] = useState("");
  const [tsvText, setTsvText] = useState("");
  const [showTsvBox, setShowTsvBox] = useState(false);
  const [tsvStatus, setTsvStatus] = useState("");
  const [conflito, setConflito] = useState(null);

  function runTsvImport() {
    if (!tsvText.trim()) return;
    const c = parseTSVToCard(tsvText);
    if(!c){
      setTsvStatus("⚠ Nenhum dado reconhecível. Verifique se o arquivo tem os cabeçalhos corretos e cole pelo menos uma linha de dados.");
      return;
    }
    const idadeStr = c.idade||"";
    const idM = idadeStr.match(/\d+/);
    const idadeAnos = idM ? idM[0]+" anos" : idadeStr;
    setForm(f => {
      const novaCategoria = (idM && parseInt(idM[0],10) <= 11 && (!f.categoria || f.categoria === "normal"))
        ? "pediatria" : (c.categoria || f.categoria);
      return { ...f,
        nome:         c.nome          || f.nome,
        idade:        idadeAnos       || f.idade,
        hd:           c.hd            || f.hd,
        setor:        c.setor         || f.setor,
        rec:          c.rec           || f.rec,
        adm:          c.adm           || f.adm,
        hora_adm:     c.hora_adm      || f.hora_adm,
        grav:         c.grav          || f.grav,
        obs:          c.obs           || f.obs,
        ficha_cross:  c.ficha_cross   || f.ficha_cross,
        medico_solic: c.medico_solic  || f.medico_solic,
        hosp:         c.hosp          || f.hosp,
        amb:          c.amb           || f.amb,
        categoria:    novaCategoria,
      };
    });
    const camposOk = [c.nome, c.hd, c.ficha_cross, c.medico_solic, c.hora_adm, c.setor].filter(Boolean);
    if(c._aviso){
      setTsvStatus(c._aviso + (camposOk.length > 0 ? ` (${camposOk.length} campo${camposOk.length>1?"s":""} preenchido${camposOk.length>1?"s":""}.)` : ""));
      // mantém o box aberto para o usuário poder corrigir
    } else {
      setShowTsvBox(false);
      setTsvText("");
      setTsvStatus(camposOk.length > 0
        ? `✓ ${camposOk.length} campo${camposOk.length>1?"s":""} preenchido${camposOk.length>1?"s":""}!`
        : "⚠ Dados importados, mas poucos campos foram reconhecidos. Confira o formato.");
    }
  }
  const upd = useCallback((k, v) => setForm(p => ({
    ...p,
    [k]: v
  })), []);
  function addComment() {
    if (!commentText.trim()) return;
    onAddComment(card.id, commentText.trim());
    setCommentText("");
  }
  const selOpts = opts => opts.map(o => typeof o === "string" ? {
    v: o,
    t: o || "(sem status)"
  } : o);
  const isAceite = form.col_id === "aceite";
  return /*#__PURE__*/React.createElement(ModalShell, {
    title: form.nome || "Paciente",
    subtitle: card.id === "new" ? "Novo Paciente" : "Card",
    onClose: onClose,
    footer: isAdmin && /*#__PURE__*/React.createElement(React.Fragment, null, card.id !== "new" && /*#__PURE__*/React.createElement(Btn, {
      variant: "danger",
      onClick: () => onDel(card.id)
    }, "Excluir"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        marginLeft: "auto"
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      variant: "ghost",
      onClick: onClose
    }, "Cancelar"), /*#__PURE__*/React.createElement(Btn, {
      onClick: () => {
        // Captura automática de horários no momento do Salvar
        const formFinal = { ...form };
        // Validar justificativa obrigatória para prioridade
        if (formFinal.prioridade_remocao && !formFinal.justificativa_prioridade?.trim()) {
          alert("Justificativa obrigatória ao definir prioridade.");
          return;
        }
        // Hora da prioridade: captura se Victor definiu prioridade mas hora ainda não foi registrada
        if (formFinal.prioridade_remocao && !formFinal.hora_prioridade) {
          formFinal.hora_prioridade = nowStr();
        }
        // Hora da escala: captura se equipe foi preenchida mas hora ainda não foi registrada
        const temEquipe = formFinal.enfermeiro_escalado || formFinal.medico_escala || formFinal.tecnico_auxiliar_escala;
        if (temEquipe && !formFinal.hora_escala_equipe) {
          formFinal.hora_escala_equipe = nowStr();
        }
        onSave(formFinal);
      }
    }, "Salvar")))
  },
  isAdmin && /*#__PURE__*/React.createElement("div", {style:{marginBottom:10}}, !showTsvBox ? /*#__PURE__*/React.createElement("button", {onClick:function(){setShowTsvBox(true);setTsvStatus("");}, style:{width:"100%",padding:"7px 14px",border:"1px dashed #0369A1",borderRadius:8,background:"#F0F9FF",color:"#0369A1",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"}}, "📋 Importar do Excel — colar dados da ficha CROSS") : /*#__PURE__*/React.createElement("div",{style:{background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:10,padding:12}},/*#__PURE__*/React.createElement("div",{style:{fontSize:11,fontWeight:600,color:"#0369A1",marginBottom:4}},"Cole os dados copiados do Excel (com cabeçalho):"),/*#__PURE__*/React.createElement("div",{style:{fontSize:10,color:"#64748B",marginBottom:6}},/*#__PURE__*/React.createElement("span",{style:{fontFamily:"monospace",background:"#E0F2FE",borderRadius:4,padding:"1px 4px"}},"NOME PACIENTE"),"\xa0·\xa0",/*#__PURE__*/React.createElement("span",{style:{fontFamily:"monospace",background:"#E0F2FE",borderRadius:4,padding:"1px 4px"}},"DATA"),"\xa0·\xa0",/*#__PURE__*/React.createElement("span",{style:{fontFamily:"monospace",background:"#E0F2FE",borderRadius:4,padding:"1px 4px"}},"HORA"),"\xa0·\xa0",/*#__PURE__*/React.createElement("span",{style:{fontFamily:"monospace",background:"#E0F2FE",borderRadius:4,padding:"1px 4px"}},"FICHA CROSS"),"\xa0·\xa0","..."),/*#__PURE__*/React.createElement("textarea",{value:tsvText,onChange:function(e){setTsvText(e.target.value);},placeholder:"Cole aqui (Ctrl+V) as células copiadas do Excel. A primeira linha deve ser o cabeçalho das colunas.",rows:5,style:{width:"100%",padding:"8px 10px",border:"1px solid #BAE6FD",borderRadius:7,fontSize:12,fontFamily:"monospace",resize:"vertical",outline:"none",background:"#fff",color:"#0F172A",lineHeight:1.5}}),tsvStatus&&/*#__PURE__*/React.createElement("div",{style:{fontSize:11,color:tsvStatus.startsWith("✓")?"#15803D":"#B45309",marginTop:4,fontWeight:600}},tsvStatus),/*#__PURE__*/React.createElement("div",{style:{display:"flex",gap:8,marginTop:8,justifyContent:"flex-end"}},/*#__PURE__*/React.createElement("button",{onClick:function(){setShowTsvBox(false);setTsvText("");setTsvStatus("");},style:{padding:"5px 12px",border:"1px solid #E2E8F0",borderRadius:7,background:"none",color:"#64748B",cursor:"pointer",fontSize:12,fontFamily:"inherit"}},"Cancelar"),/*#__PURE__*/React.createElement("button",{onClick:runTsvImport,disabled:!tsvText.trim(),style:{padding:"5px 14px",border:"none",borderRadius:7,background:"#0369A1",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit",opacity:!tsvText.trim()?0.6:1}},"📋 Importar")))
  ), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 2,
      marginBottom: 16,
      background: "#F8FAFC",
      borderRadius: 8,
      padding: 2
    }
  }, (() => {
    const tabs = [["info", "📋 Informações"], ["aceite_info", "🟢 Aceite"], ["comments", "💬 Comentários" + (comments.length ? ` (${comments.length})` : "")]];
    const isAceiteCol = form.col_id === "aceite";
    const canPrioridade = currentUser?.can_prioridade || currentUser?.role === "admin";
    const canEscala = currentUser?.can_escala || currentUser?.role === "admin";
    if (isAceiteCol && canPrioridade) tabs.push(["prioridade", "🔢 Prioridade"]);
    if (isAceiteCol && canEscala) tabs.push(["equipe", "👥 Equipe"]);
    return tabs;
  })().map(([id, label]) => /*#__PURE__*/React.createElement("button", {
    key: id,
    type: "button",
    onClick: () => setTab(id),
    style: {
      flex: 1,
      padding: "6px 10px",
      borderRadius: 6,
      border: "none",
      fontSize: 12,
      fontWeight: tab === id ? 600 : 400,
      background: tab === id ? "#fff" : "transparent",
      color: tab === id ? "#0F172A" : "#64748B",
      cursor: "pointer",
      boxShadow: tab === id ? "0 1px 3px rgba(0,0,0,.08)" : undefined
    }
  }, label))), tab === "info" && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "0 12px"
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Nome completo",
    fieldKey: "nome",
    value: form.nome,
    onChange: upd,
    disabled: !isAdmin,
    full: true
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Categoria",
    fieldKey: "categoria",
    value: form.categoria || "normal",
    onChange: upd,
    disabled: !isAdmin,
    opts: [{
      v: "normal",
      t: "Normal"
    }, {
      v: "pediatria",
      t: "👶 Pediatria"
    }, {
      v: "psiquiatria",
      t: "🧠 Psiquiatria"
    }, {
      v: "obstetricia",
      t: "🤰 Obstetrícia"
    }]
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Recém-nascido?",
    fieldKey: "is_rn",
    value: form.is_rn ? "Sim" : "Não",
    onChange: (k, v) => upd(k, v === "Sim"),
    disabled: !isAdmin,
    opts: [{
      v: "Não",
      t: "Não"
    }, {
      v: "Sim",
      t: "Sim (RN)"
    }]
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Idade",
    fieldKey: "idade",
    value: form.idade,
    onChange: (k, v) => {
      upd(k, v);
      const m = String(v || "").match(/\d+/);
      if (m && parseInt(m[0], 10) <= 11 && (!form.categoria || form.categoria === "normal")) {
        upd("categoria", "pediatria");
      }
    },
    disabled: !isAdmin,
    placeholder: "44 anos"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Data Admissão (CROSS)",
    fieldKey: "adm",
    value: form.adm,
    onChange: upd,
    disabled: !isAdmin,
    placeholder: "05/09"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Hora Admissão",
    fieldKey: "hora_adm",
    value: form.hora_adm,
    onChange: upd,
    disabled: !isAdmin,
    placeholder: "11:00"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Nº Ficha CROSS",
    fieldKey: "ficha_cross",
    value: form.ficha_cross,
    onChange: upd,
    disabled: !isAdmin,
    placeholder: "SS-XXXXXXXX-XX"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Médico Solicitante",
    fieldKey: "medico_solic",
    value: form.medico_solic,
    onChange: upd,
    disabled: !isAdmin,
    placeholder: "Dr. Nome"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Hipótese diagnóstica (HD)",
    fieldKey: "hd",
    value: form.hd,
    onChange: upd,
    disabled: !isAdmin,
    full: true
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Setor / Leito",
    fieldKey: "setor",
    value: form.setor,
    onChange: upd,
    disabled: !isAdmin,
    placeholder: "CM/L.14"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Recurso / Especialidade",
    fieldKey: "rec",
    value: form.rec,
    onChange: upd,
    disabled: !isAdmin,
    placeholder: "Ortopedia"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Hospital receptor",
    fieldKey: "hosp",
    value: form.hosp,
    onChange: upd,
    disabled: !isAdmin,
    placeholder: "Lacaz"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Ambulância",
    fieldKey: "amb",
    value: form.amb,
    onChange: upd,
    disabled: !isAdmin,
    opts: selOpts([{
      v: "",
      t: "—"
    }, {
      v: "Básica",
      t: "🚐 Básica (SBV)"
    }, {
      v: "Avançada",
      t: "🚨 Avançada (SAV)"
    }])
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Prioridade (nº)",
    fieldKey: "pr",
    value: form.prioridade_remocao ? "P" + form.prioridade_remocao : (form.pr || ""),
    onChange: () => {},
    disabled: true,
    placeholder: "Definida na aba Prioridade"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Status",
    fieldKey: "status",
    value: form.status,
    onChange: upd,
    disabled: !isAdmin,
    opts: selOpts(STATUS_OPTIONS)
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Gravidade",
    fieldKey: "grav",
    value: form.grav,
    onChange: upd,
    disabled: !isAdmin,
    opts: Object.entries(GC).map(([k, v]) => ({
      v: k,
      t: v.label
    }))
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Coluna",
    fieldKey: "col_id",
    value: form.col_id,
    onChange: upd,
    disabled: !isAdmin,
    opts: cols.map(c => ({
      v: c.id,
      t: c.label
    }))
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Finalizado Cross",
    fieldKey: "cross_info",
    value: form.cross_info,
    onChange: upd,
    disabled: !isAdmin,
    full: true,
    placeholder: "04/09 às 13:56"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Horário de saída",
    fieldKey: "saida",
    value: form.saida,
    onChange: upd,
    disabled: !isAdmin
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Horário de retorno",
    fieldKey: "retorno",
    value: form.retorno,
    onChange: upd,
    disabled: !isAdmin
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Observações",
    fieldKey: "obs",
    value: form.obs,
    onChange: upd,
    disabled: !isAdmin,
    as: "textarea",
    full: true
  })), tab === "aceite_info" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      background: isAceite ? "#F0FDF4" : "#F8FAFC",
      border: `1px solid ${isAceite ? "#86EFAC" : "#E2E8F0"}`,
      borderRadius: 10,
      padding: "12px 14px",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: isAceite ? "#16A34A" : "#94A3B8",
      fontWeight: 600
    }
  }, isAceite ? "✅ Paciente na coluna Aceite Confirmado" : "ℹ️ Preencher quando o aceite for confirmado")), /*#__PURE__*/React.createElement(Field, {
    label: "Receptor *",
    fieldKey: "receptor",
    value: form.receptor,
    onChange: upd,
    disabled: !isAdmin,
    placeholder: "Dr. João Silva / Hospital SCSP"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Data do aceite",
    fieldKey: "data_aceite",
    value: form.data_aceite,
    onChange: upd,
    disabled: !isAdmin,
    placeholder: "05/09/2026"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Hora do aceite",
    fieldKey: "hora_aceite",
    value: form.hora_aceite,
    onChange: upd,
    disabled: !isAdmin,
    placeholder: "14:35"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Data Finalização CROSS",
    fieldKey: "data_resolucao",
    value: form.data_resolucao,
    onChange: upd,
    disabled: !isAdmin,
    placeholder: "06/09/2026"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Hora Finalização CROSS",
    fieldKey: "hora_resolucao",
    value: form.hora_resolucao,
    onChange: upd,
    disabled: !isAdmin,
    placeholder: "16:19"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Unidade Receptora (CROSS)",
    fieldKey: "unidade_receptora",
    value: form.unidade_receptora,
    onChange: upd,
    disabled: !isAdmin,
    placeholder: "Hospital Francisco Morato"
  })), tab === "prioridade" && React.createElement("div", null,
    (() => {
      const canEdit = (currentUser?.can_prioridade || currentUser?.role === "admin") && form.col_id === "aceite";
      const cardCreatedAt = card.created_at;
      const delta = calcDeltaMin(cardCreatedAt, form.hora_prioridade);

      function handlePrioridade(v, allCards) {
        if (!canEdit) return;
        // Limpar prioridade
        if (!v || v === "") {
          setConflito(null);
          upd("prioridade_remocao", "");
          upd("hora_prioridade", "");
          return;
        }
        // Verifica se já existe outro card na coluna aceite com esse número
        const duplicata = (allCards || []).find(c =>
          c.col_id === "aceite" &&
          c.id !== card.id &&
          c.prioridade_remocao === String(v)
        );
        if (duplicata) {
          setConflito({ valor: v, nomeConflito: duplicata.nome, idConflito: duplicata.id, prioridadeOriginal: duplicata.prioridade_remocao || '', confirmado: false, novaPrioridade: duplicata.prioridade_remocao ? String(parseInt(duplicata.prioridade_remocao,10)+1) : '' });
        } else {
          setConflito(null);
          upd("prioridade_remocao", String(v));
          upd("hora_prioridade", nowStr());
        }
      }

      return React.createElement(React.Fragment, null,
        /* Cabeçalho informativo */
        React.createElement("div", { style: { background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 10, padding: "12px 14px", marginBottom: 14 } },
          React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: "#6D28D9", marginBottom: 4 } }, "🔢 Prioridade de Remoção"),
          React.createElement("div", { style: { fontSize: 11, color: "#7C3AED" } }, "Definida pelo Dr. Victor Alfonso. Indica a ordem de saída entre os pacientes em aceite confirmado."),
          cardCreatedAt && React.createElement("div", { style: { fontSize: 10, color: "#94A3B8", marginTop: 6 } },
            "Card criado em: ", new Date(cardCreatedAt).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }),
            form.hora_prioridade && delta !== null && React.createElement("span", { style: { marginLeft: 8, fontWeight: 700, color: "#7C3AED" } },
              "· Prioridade definida ", fmtDelta(delta), " depois"
            )
          )
        ),
        /* Aviso de conflito */
        conflito && React.createElement("div", { style: { background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 12px", marginBottom: 12, fontSize: 12 } },
          React.createElement("div", { style: { fontWeight: 700, color: "#92400E", marginBottom: 6 } },
            "⚠️ Prioridade " + conflito.valor + " já está com: " + conflito.nomeConflito
          ),
          React.createElement("div", { style: { color: "#78350F", marginBottom: 8 } },
            "Se confirmar, este card assume a posição " + conflito.valor + " e o card anterior perde a prioridade."
          ),
          !conflito.confirmado && React.createElement("div", { style: { display: "flex", gap: 8 } },
            React.createElement("button", {
              onClick: () => setConflito(c => ({...c, confirmado:true, novaPrioridade:""})),
              style: { padding: "5px 14px", border: "none", borderRadius: 7, background: "#D97706", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }
            }, "✓ Confirmar — definir nova prioridade"),
            React.createElement("button", {
              onClick: () => setConflito(null),
              style: { padding: "5px 14px", border: "1px solid #FDE68A", borderRadius: 7, background: "none", color: "#92400E", fontSize: 12, cursor: "pointer" }
            }, "Cancelar")
          ),
          conflito.confirmado && React.createElement("div", { style: { marginTop: 6 } },
            React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: "#92400E", marginBottom: 6 } },
              "Nova prioridade de \"" + conflito.nomeConflito + "\" (deixe vazio para remover):"),
            React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
              React.createElement("input", {
                type: "number", min: 1, step: 1, autoFocus: true,
                value: conflito.novaPrioridade || "",
                onChange: e => setConflito(c => ({...c, novaPrioridade: e.target.value})),
                placeholder: "Ex: 2",
                style: { width: 80, padding: "6px 10px", border: "1.5px solid #FDE68A", borderRadius: 7, fontFamily: "inherit", fontSize: 14, fontWeight: 700, textAlign: "center", outline: "none" }
              }),
              React.createElement("button", {
                onClick: async () => {
                  var np = conflito.novaPrioridade ? String(parseInt(conflito.novaPrioridade, 10)) : "";
                  // 1. Atualiza este card
                  upd("prioridade_remocao", conflito.valor);
                  upd("hora_prioridade", nowStr());
                  // 2. Salva nova prioridade do card anterior direto no banco
                  if (conflito.idConflito) {
                    try {
                      await fetch(FN_URL + "/cards-write", {
                        method: "POST",
                        headers: H(userId),
                        body: JSON.stringify({
                          action: "update",
                          id: conflito.idConflito,
                          body: { prioridade_remocao: np, hora_prioridade: np ? nowStr() : "" }
                        })
                      });
                    } catch(ex) { console.warn("Falha ao atualizar prioridade anterior:", ex); }
                  }
                  // Atualiza state local do card anterior imediatamente
                  if (conflito.idConflito && onUpdateCard) {
                    onUpdateCard(conflito.idConflito, { prioridade_remocao: np, hora_prioridade: np ? nowStr() : "" });
                  }
                  setConflito(null);
                },
                style: { padding: "6px 14px", border: "none", borderRadius: 7, background: "#0F172A", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }
              }, conflito.novaPrioridade ? "Salvar P" + parseInt(conflito.novaPrioridade, 10) : "Remover prioridade")
            )
          )
        ),
        /* Seletor numérico livre de prioridade */
        React.createElement("div", { style: { marginBottom: 14 } },
          React.createElement("div", { style: { fontSize: 11, color: "#64748B", marginBottom: 6, fontWeight: 600 } },
            "Número de prioridade (1 = maior prioridade, sem limite máximo)"
          ),
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
            React.createElement("input", {
              type: "number",
              min: 1,
              step: 1,
              disabled: !canEdit,
              value: form.prioridade_remocao || "",
              onChange: e => {
                const v = e.target.value;
                if (v === "" || /^[0-9]+$/.test(v)) handlePrioridade(v, window.__geCards);
              },
              style: {
                width: 100, padding: "10px 14px", borderRadius: 10, fontFamily: "inherit",
                border: form.prioridade_remocao ? "2px solid #7C3AED" : "1.5px solid #E2E8F0",
                background: form.prioridade_remocao ? "#EDE9FE" : "#F8FAFC",
                color: "#6D28D9", fontWeight: 700, fontSize: 22, textAlign: "center",
                outline: "none"
              }
            }),
            form.prioridade_remocao && React.createElement("div", { style: { fontSize: 13, color: "#6D28D9", fontWeight: 600 } },
              "P", form.prioridade_remocao, " — posição ", form.prioridade_remocao, " na fila de saída"
            ),
            !form.prioridade_remocao && React.createElement("div", { style: { fontSize: 12, color: "#94A3B8" } },
              "Digite um número para definir a posição na fila"
            )
          ),
          canEdit && React.createElement("button", {
            onClick: () => { upd("prioridade_remocao", ""); upd("hora_prioridade", ""); upd("justificativa_prioridade", ""); },
            style: { marginTop: 8, padding: "3px 10px", border: "1px solid #E2E8F0", borderRadius: 6,
              background: "none", color: "#94A3B8", fontSize: 11, cursor: "pointer" }
          }, "✕ Limpar prioridade"),
          form.prioridade_remocao && React.createElement("div", { style: { marginTop: 10 } },
            React.createElement("div", { style: { fontSize: 10, fontWeight: 700, color: "#7C3AED", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 } },
              "Justificativa clínica ", React.createElement("span", { style: { color: "#EF4444" } }, "*")
            ),
            React.createElement("textarea", {
              rows: 2,
              disabled: !canEdit,
              value: form.justificativa_prioridade || "",
              onChange: e => upd("justificativa_prioridade", e.target.value),
              placeholder: "Ex: Paciente com risco de deterioração — prioridade justificada pelo Dr. Silva",
              style: {
                width: "100%", padding: "8px 10px", fontFamily: "inherit", fontSize: 12, resize: "vertical",
                outline: "none", borderRadius: 8, boxSizing: "border-box",
                border: (!form.justificativa_prioridade && canEdit) ? "1.5px solid #FCA5A5" : "1.5px solid #DDD6FE",
                background: canEdit ? "#FEFBFF" : "#F8FAFC", color: "#0F172A"
              }
            }),
            !form.justificativa_prioridade && canEdit && React.createElement("div", {
              style: { fontSize: 10, color: "#EF4444", marginTop: 2, fontWeight: 600 }
            }, "Obrigatória para salvar com prioridade definida.")
          )
        ),
        /* Hora capturada automaticamente ao salvar */
        form.hora_prioridade && React.createElement("div", {
          style: { background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 8,
            padding: "8px 12px", marginTop: 4, fontSize: 11, color: "#6D28D9", fontWeight: 600 }
        }, "🕐 Prioridade registrada às ", form.hora_prioridade),
        !form.hora_prioridade && canEdit && React.createElement("div", {
          style: { fontSize: 11, color: "#94A3B8", fontStyle: "italic", marginTop: 4 }
        }, "O horário será registrado automaticamente ao salvar."),
        !canEdit && React.createElement("div", { style: { fontSize: 11, color: "#94A3B8", fontStyle: "italic", marginTop: 4 } }, "Somente o Dr. Victor ou a administradora podem definir a prioridade.")
      );
    })()
  ),
  tab === "equipe" && React.createElement("div", null,
    (() => {
      const canEdit = (currentUser?.can_escala || currentUser?.role === "admin") && form.col_id === "aceite";
      const cardCreatedAt = card.created_at;
      const delta = calcDeltaMin(cardCreatedAt, form.hora_escala_equipe);

      /* Mini-seção de membro da equipe */
      const MembroSection = ({ emoji, titulo, corBg, corBorder, corTexto, fields }) =>
        React.createElement("div", {
          style: { background: corBg, border: `1px solid ${corBorder}`, borderRadius: 10,
            padding: "12px 14px", marginBottom: 12 }
        },
          React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: corTexto,
            marginBottom: 10, display: "flex", alignItems: "center", gap: 6 } },
            emoji, " ", titulo
          ),
          React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
            fields.map(([label, fieldKey, placeholder, full]) =>
              React.createElement(Field, {
                key: fieldKey, label, fieldKey,
                value: form[fieldKey] || "",
                onChange: upd, disabled: !canEdit,
                placeholder, full: !!full
              })
            )
          )
        );

      return React.createElement(React.Fragment, null,
        /* Cabeçalho */
        React.createElement("div", { style: { background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "12px 14px", marginBottom: 14 } },
          React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: "#1D4ED8", marginBottom: 4 } }, "👥 Escala da Equipe de Remoção"),
          React.createElement("div", { style: { fontSize: 11, color: "#1E40AF" } }, "Definida por Carlos ou Santuza. Cada membro pode sair de um setor diferente."),
          cardCreatedAt && React.createElement("div", { style: { fontSize: 10, color: "#94A3B8", marginTop: 6 } },
            "Card criado em: ", new Date(cardCreatedAt).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }),
            form.hora_escala_equipe && delta !== null && React.createElement("span", { style: { marginLeft: 8, fontWeight: 700, color: "#1D4ED8" } },
              "· Equipe escalada ", fmtDelta(delta), " depois"
            )
          )
        ),
        /* Destino da remoção */
        React.createElement(Field, {
          label: "Remoção de destino *", fieldKey: "remocao_destino",
          value: form.remocao_destino, onChange: upd, disabled: !canEdit,
          placeholder: "Ex: SCSP — Cirurgia Torácica", full: true
        }),
        /* Médico */
        React.createElement(MembroSection, {
          emoji: "🩺", titulo: "Médico",
          corBg: "#F0FDF4", corBorder: "#86EFAC", corTexto: "#15803D",
          fields: [
            ["Nome do médico", "medico_escala", "Ex: Dr. Victor", false],
            ["Setor de origem", "setor_medico_escala", "Ex: PS", false],
          ]
        }),
        /* Enfermeiro */
        React.createElement(MembroSection, {
          emoji: "🧑", titulo: "Enfermeiro",
          corBg: "#EFF6FF", corBorder: "#BFDBFE", corTexto: "#1D4ED8",
          fields: [
            ["Nome do enfermeiro", "enfermeiro_escalado", "Ex: Ana Paula", false],
            ["Setor de origem", "setor_saida_enfermeiro", "Ex: CM / L3", false],
          ]
        }),
        /* Técnico / Auxiliar */
        React.createElement(MembroSection, {
          emoji: "💊", titulo: "Técnico / Auxiliar",
          corBg: "#F5F3FF", corBorder: "#DDD6FE", corTexto: "#6D28D9",
          fields: [
            ["Nome do técnico/auxiliar", "tecnico_auxiliar_escala", "Ex: João Carlos", false],
            ["Setor de origem", "setor_tecnico_escala", "Ex: UTI", false],
          ]
        }),
        /* Hora capturada automaticamente ao salvar */
        form.hora_escala_equipe && React.createElement("div", {
          style: { background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8,
            padding: "8px 12px", marginTop: 4, fontSize: 11, color: "#1D4ED8", fontWeight: 600 }
        }, "🕐 Equipe escalada às ", form.hora_escala_equipe),
        !form.hora_escala_equipe && canEdit && React.createElement("div", {
          style: { fontSize: 11, color: "#94A3B8", fontStyle: "italic", marginTop: 4 }
        }, "O horário será registrado automaticamente ao salvar."),
        !canEdit && React.createElement("div", { style: { fontSize: 11, color: "#94A3B8", fontStyle: "italic", marginTop: 4 } },
          "Somente Carlos, Santuza ou a administradora podem escalar a equipe."
        )
      );
    })()
  ),
  tab === "comments" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: 300,
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      gap: 8,
      marginBottom: 12
    }
  }, comments.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "24px",
      color: "#CBD5E1",
      fontSize: 12
    }
  }, "Nenhum comentário ainda."), comments.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.id,
    style: {
      background: c.is_system ? "#FEFBFF" : c.is_admin ? "#EFF6FF" : "#F8FAFC",
      borderRadius: 8,
      padding: "10px 12px",
      border: `1px solid ${c.is_system ? "#DDD6FE" : c.is_admin ? "#BFDBFE" : "#E2E8F0"}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 30,
      height: 30,
      borderRadius: "50%",
      flexShrink: 0,
      overflow: "hidden",
      background: c.is_admin ? "#1E40AF" : "#F1F5F9",
      border: "1px solid #E2E8F0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, c.autor_foto ? /*#__PURE__*/React.createElement("img", {
    src: c.autor_foto,
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: c.is_admin ? "#fff" : "#94A3B8"
    }
  }, (c.autor_nome || "?")[0].toUpperCase())), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 5,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: c.is_admin ? "#1E40AF" : "#374151"
    }
  }, c.autor_nome), c.is_admin && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      padding: "1px 5px",
      borderRadius: 3,
      background: "#1E40AF",
      color: "#fff"
    }
  }, "ADMIN")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: "#94A3B8"
    }
  }, new Date(c.created_at).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => setCommentText("@" + c.autor_nome.split(" ")[0] + " "),
    style: {
      background: "none",
      border: "none",
      cursor: "pointer",
      color: "#94A3B8",
      fontSize: 10,
      padding: "0 2px"
    }
  }, "↩"), !c.is_system && (currentUser?.role === "admin" || c.autor_id === currentUser?.id) && /*#__PURE__*/React.createElement("button", {
    onClick: () => onDelComment(c.id, card.id),
    style: {
      background: "none",
      border: "none",
      cursor: "pointer",
      color: "#CBD5E1",
      fontSize: 12,
      padding: 0
    }
  }, "✕"))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "#374151",
      lineHeight: 1.5,
      marginTop: 2
    }
  }, c.texto)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: commentText,
    onChange: e => setCommentText(e.target.value),
    onKeyDown: e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), addComment()),
    placeholder: "Comentário… (Enter para enviar)",
    style: {
      ...inp_s,
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(Btn, {
    onClick: addComment
  }, "Enviar"))));
}
