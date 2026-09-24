/* ─── INSTALL MODAL ─── */
function InstallModal({
  onClose
}) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isAndroid = /Android/.test(navigator.userAgent);
  const isWindows = /Windows/.test(navigator.userAgent) && !isAndroid;
  // O prompt nativo so existe em navegadores Chromium (Android, Windows,
  // macOS). Safari/iOS nao implementa beforeinstallprompt: la o caminho
  // continua sendo o passo a passo manual.
  const [podeInstalar, setPodeInstalar] = useState(Boolean(window.__gePrompt));
  const [instalando, setInstalando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const jaInstalado = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

  useEffect(() => {
    const on = () => setPodeInstalar(true);
    const off = () => { setPodeInstalar(false); setResultado("instalado"); };
    window.addEventListener("ge-instalavel", on);
    window.addEventListener("ge-instalado", off);
    return () => { window.removeEventListener("ge-instalavel", on); window.removeEventListener("ge-instalado", off); };
  }, []);

  async function instalarAgora() {
    const ev = window.__gePrompt;
    if (!ev) return;
    setInstalando(true);
    try {
      ev.prompt();
      const { outcome } = await ev.userChoice;
      // O evento e de uso unico: depois de prompt() ele nao serve mais.
      window.__gePrompt = null;
      setPodeInstalar(false);
      setResultado(outcome === "accepted" ? "instalado" : "recusado");
    } catch (e) {
      console.error("[install]", e);
      setResultado("erro");
    }
    setInstalando(false);
  }

  const BLOCO_ACAO = jaInstalado
    ? React.createElement("div", { style: { background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 } },
        React.createElement("span", { style: { fontSize: 18 } }, "\u2713"),
        React.createElement("div", null,
          React.createElement("div", { style: { fontWeight: 700, fontSize: 13, color: "#15803D" } }, "App j\u00E1 instalado"),
          React.createElement("div", { style: { fontSize: 11, color: "#16A34A", marginTop: 1 } }, "Voc\u00EA est\u00E1 usando a vers\u00E3o instalada.")))
    : podeInstalar
      ? React.createElement("div", { style: { background: "#0F172A", borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 } },
          React.createElement("div", { style: { flex: 1, minWidth: 0 } },
            React.createElement("div", { style: { fontWeight: 700, fontSize: 13, color: "#F1F5F9" } }, "Instalar neste dispositivo"),
            React.createElement("div", { style: { fontSize: 11, color: "#94A3B8", marginTop: 2, lineHeight: 1.45 } }, "Abre como aplicativo, sem barra do navegador.")),
          React.createElement("button", { onClick: instalarAgora, disabled: instalando,
            style: { flexShrink: 0, background: "#38BDF8", color: "#06263A", border: "none", borderRadius: 9, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: instalando ? "default" : "pointer", opacity: instalando ? .6 : 1 } },
            instalando ? "Aguarde\u2026" : "Instalar"))
      : resultado === "recusado"
        ? React.createElement("div", { style: { background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12, padding: "12px 14px", fontSize: 12, color: "#92400E" } },
            "Instala\u00E7\u00E3o cancelada. Feche e abra este aviso para tentar de novo, ou siga o passo a passo abaixo.")
        : resultado === "instalado"
          ? React.createElement("div", { style: { background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 12, padding: "12px 14px", fontSize: 12, color: "#15803D", fontWeight: 600 } },
              "\u2713 Instalado. Procure o \u00EDcone na tela inicial.")
          : React.createElement("div", { style: { background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: "12px 14px", fontSize: 11, color: "#64748B", lineHeight: 1.5 } },
              isIOS
                ? "No iPhone e iPad a Apple n\u00E3o permite instala\u00E7\u00E3o autom\u00E1tica. Siga o passo a passo do Safari abaixo."
                : "Instala\u00E7\u00E3o autom\u00E1tica indispon\u00EDvel neste navegador. Use o passo a passo abaixo.");
  return /*#__PURE__*/React.createElement(ModalShell, {
    title: "Instalar o app",
    onClose: onClose,
    maxWidth: 420
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, BLOCO_ACAO, /*#__PURE__*/React.createElement("div", {
    style: {
      background: isAndroid ? "#F0FDF4" : "#F8FAFC",
      border: `1px solid ${isAndroid ? "#86EFAC" : "#E2E8F0"}`,
      borderRadius: 10,
      padding: "12px 14px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 12,
      color: "#0F172A",
      marginBottom: 6
    }
  }, "🤖 Android (Chrome)"), /*#__PURE__*/React.createElement("ol", {
    style: {
      paddingLeft: 16,
      fontSize: 11,
      color: "#374151",
      lineHeight: 1.9
    }
  }, /*#__PURE__*/React.createElement("li", null, "Abra o app no ", /*#__PURE__*/React.createElement("strong", null, "Google Chrome")), /*#__PURE__*/React.createElement("li", null, "Toque no menu ", /*#__PURE__*/React.createElement("strong", null, "⋮"), " (canto superior direito)"), /*#__PURE__*/React.createElement("li", null, "Toque em ", /*#__PURE__*/React.createElement("strong", null, "\"Adicionar à tela inicial\"")), /*#__PURE__*/React.createElement("li", null, "Confirme em ", /*#__PURE__*/React.createElement("strong", null, "\"Adicionar\""))), isAndroid && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      fontSize: 11,
      color: "#16A34A",
      fontWeight: 600
    }
  }, "✓ Você está no Android — siga os passos acima")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: isIOS ? "#F0FDF4" : "#F8FAFC",
      border: `1px solid ${isIOS ? "#86EFAC" : "#E2E8F0"}`,
      borderRadius: 10,
      padding: "12px 14px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 12,
      color: "#0F172A",
      marginBottom: 6
    }
  }, "🍎 iPhone / iPad (Safari)"), /*#__PURE__*/React.createElement("ol", {
    style: {
      paddingLeft: 16,
      fontSize: 11,
      color: "#374151",
      lineHeight: 1.9
    }
  }, /*#__PURE__*/React.createElement("li", null, "Abra o app no ", /*#__PURE__*/React.createElement("strong", null, "Safari")), /*#__PURE__*/React.createElement("li", null, "Toque no botão de ", /*#__PURE__*/React.createElement("strong", null, "Compartilhar"), " (□↑ na barra inferior)"), /*#__PURE__*/React.createElement("li", null, "Role para baixo e toque em ", /*#__PURE__*/React.createElement("strong", null, "\"Adicionar à Tela de Início\"")), /*#__PURE__*/React.createElement("li", null, "Toque em ", /*#__PURE__*/React.createElement("strong", null, "\"Adicionar\""))), isIOS && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      fontSize: 11,
      color: "#16A34A",
      fontWeight: 600
    }
  }, "✓ Você está no iOS — siga os passos acima")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: isWindows ? "#F0FDF4" : "#F8FAFC",
      border: `1px solid ${isWindows ? "#86EFAC" : "#E2E8F0"}`,
      borderRadius: 10,
      padding: "12px 14px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 12,
      color: "#0F172A",
      marginBottom: 6
    }
  }, "🖥 Windows (Chrome / Edge)"), /*#__PURE__*/React.createElement("ol", {
    style: {
      paddingLeft: 16,
      fontSize: 11,
      color: "#374151",
      lineHeight: 1.9
    }
  }, /*#__PURE__*/React.createElement("li", null, "Abra o app no ", /*#__PURE__*/React.createElement("strong", null, "Google Chrome"), " ou ", /*#__PURE__*/React.createElement("strong", null, "Microsoft Edge")), /*#__PURE__*/React.createElement("li", null, "Clique no ícone ", /*#__PURE__*/React.createElement("strong", null, "⊕"), " na barra de endereços (canto direito)"), /*#__PURE__*/React.createElement("li", null, "Clique em ", /*#__PURE__*/React.createElement("strong", null, "\"Instalar\""))), isWindows && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      fontSize: 11,
      color: "#16A34A",
      fontWeight: 600
    }
  }, "✓ Você está no Windows — siga os passos acima")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: "#94A3B8",
      textAlign: "center"
    }
  }, "Após instalar, o app abre como aplicativo nativo, sem barra do browser.")));
}

/* ─── SNAPSHOT PANEL ─── */
function SnapshotPanel({
  snapshots,
  onLoad,
  onDelete,
  onClose,
  onImportFile
}) {
  const fileInputRef = React.useRef(null);
  return /*#__PURE__*/React.createElement(ModalShell, {
    title: "Snapshots salvos",
    subtitle: "Carregar estado anterior",
    onClose: onClose,
    maxWidth: 460,
    footer: /*#__PURE__*/React.createElement(Btn, {
      variant: "ghost",
      onClick: onClose
    }, "Fechar")
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      padding: "0 0 12px 0",
      marginBottom: 12,
      borderBottom: "1px solid #F1F5F9"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#94A3B8"
    }
  }, "Importar um arquivo .json baixado anteriormente"), /*#__PURE__*/React.createElement("input", {
    ref: fileInputRef,
    type: "file",
    accept: ".json,application/json",
    style: { display: "none" },
    onChange: (e) => {
      const file = e.target.files && e.target.files[0];
      if (file && onImportFile) onImportFile(file);
      e.target.value = "";
    }
  }), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => fileInputRef.current && fileInputRef.current.click(),
    style: {
      fontSize: 11,
      padding: "4px 12px",
      flexShrink: 0
    }
  }, "📁 Importar JSON")), snapshots.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "32px",
      color: "#CBD5E1",
      fontSize: 12
    }
  }, "Nenhum snapshot salvo.", /*#__PURE__*/React.createElement("br", null), "Use o botão 💾 Salvar no banner de edição."), snapshots.map(snap => /*#__PURE__*/React.createElement("div", {
    key: snap.id,
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "10px 0",
      borderBottom: "1px solid #F8FAFC",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 13,
      color: "#0F172A"
    }
  }, snap.label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#94A3B8"
    }
  }, snap.cards?.length || 0, " pacientes · ", snap.cols?.length || 0, " colunas")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => onLoad(snap),
    style: {
      fontSize: 11,
      padding: "4px 12px"
    }
  }, "Carregar"), /*#__PURE__*/React.createElement("button", {
    onClick: () => onDelete(snap.id),
    style: {
      background: "none",
      border: "none",
      cursor: "pointer",
      color: "#CBD5E1",
      fontSize: 15,
      padding: "4px 6px"
    }
  }, "✕")))));
}

/* ── FloatingActions: balão flutuante de alertas (admin only) ── */
function FloatingActions({ cards, discrepancias, pendencias, acoes, setView }) {
  var [open, setOpen] = React.useState(false);
  var emergP  = (cards||[]).filter(function(c){return c.grav==="emergencia"&&c.col_id==="pendente";}).length;
  var semHosp = (cards||[]).filter(function(c){return !c.hosp&&c.col_id!=="finalizado";}).length;
  var disc    = (discrepancias||[]).length;
  var pend    = (pendencias||0);
  var ac      = (acoes||0);
  var total   = emergP + disc + pend + semHosp + ac;
  if(total === 0) return null;
  var items = [];
  if(ac>0)       items.push({cor:"#7C3AED",label:ac+" tarefa"+(ac===1?"":"s")+" pendente"+(ac===1?"":"s"),acao:function(){},dica:"Tarefas de enfermagem pendentes, iniciadas ou pausadas"});
  if(emergP>0)   items.push({cor:"#EF4444",label:emergP+" emergênci"+(emergP===1?"a":"as")+" pendente"+(emergP===1?"":"s"),acao:function(){setView("kanban");},dica:"Pacientes com emergência aguardando aceite"});
  if(disc>0)     items.push({cor:"#F59E0B",label:disc+" discrepânci"+(disc===1?"a":"as")+" de fila",acao:function(){setView("dashboard");},dica:"Menor gravidade com aceite antes de mais grave na mesma especialidade"});
  if(pend>0)     items.push({cor:"#B91C1C",label:pend+" valor"+(pend===1?"":"es")+" a corrigir",acao:function(){setView("dashboard");},dica:"Valores não classificados na planilha de remoções"});
  if(semHosp>0)  items.push({cor:"#94A3B8",label:semHosp+" card"+(semHosp===1?"":"s")+" sem hospital",acao:function(){setView("kanban");},dica:"Cards ativos sem hospital receptor definido"});
  return React.createElement("div", {id:"ge-fab"},
    open && React.createElement("div", {
      style:{background:"#0F172A",borderRadius:12,padding:"10px 14px",minWidth:230,boxShadow:"0 8px 32px rgba(0,0,0,.3)",marginBottom:6}
    },
      React.createElement("div", {style:{fontSize:10,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}, "A\u00E7\u00F5es pendentes"),
      items.map(function(item,i){
        return React.createElement("div", {
          key:i, onClick:function(){item.acao();setOpen(false);}, title:item.dica,
          style:{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderTop:i?"1px solid #1E293B":"none",cursor:"pointer"}
        },
          React.createElement("div", {style:{width:8,height:8,borderRadius:"50%",background:item.cor,flexShrink:0}}),
          React.createElement("span", {style:{fontSize:12,color:"#F1F5F9",flex:1}}, item.label),
          React.createElement("span", {style:{fontSize:11,color:"#475569"}}, "\u2192")
        );
      })
    ),
    React.createElement("button", {
      onClick:function(){setOpen(function(p){return !p;});},
      style:{width:46,height:46,borderRadius:"50%",border:"none",background:"#EF4444",color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer",boxShadow:"0 4px 16px rgba(239,68,68,.4)",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",flexShrink:0}
    },
      React.createElement("span", null, total),
      React.createElement("span", {style:{position:"absolute",top:-2,right:-2,width:10,height:10,borderRadius:"50%",background:"#F59E0B",border:"2px solid #fff"}})
    )
  );
}

/* ════════════════════════════════════════════
   MAIN APP
   ════════════════════════════════════════════ */
