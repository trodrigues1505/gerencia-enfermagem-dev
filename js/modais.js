/* ─── MODAL ACEITE OBRIGATÓRIO ─── */
function AceiteModal({
  card,
  onConfirm,
  onCancel
}) {
  const [form, setForm] = useState({
    receptor: "",
    data_aceite: new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }),
    hora_aceite: nowStr()
  });
  const [err, setErr] = useState("");
  const upd = (k, v) => setForm(p => ({
    ...p,
    [k]: v
  }));
  function confirm() {
    if (!form.receptor.trim()) {
      setErr("Receptor é obrigatório.");
      return;
    }
    if (!form.data_aceite.trim()) {
      setErr("Data é obrigatória.");
      return;
    }
    if (!form.hora_aceite.trim()) {
      setErr("Hora é obrigatória.");
      return;
    }
    onConfirm(form);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 2000,
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#fff",
      borderRadius: 16,
      width: "100%",
      maxWidth: 420,
      boxShadow: "0 20px 60px rgba(0,0,0,.25)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px 20px",
      borderBottom: "1px solid #F1F5F9",
      background: "#F0FDF4",
      borderRadius: "16px 16px 0 0"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 600,
      color: "#16A34A",
      textTransform: "uppercase",
      letterSpacing: ".05em"
    }
  }, "Aceite Confirmado"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 15,
      color: "#0F172A",
      marginTop: 2
    }
  }, "Registrar dados do aceite"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#64748B",
      marginTop: 2
    }
  }, card.nome)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px 20px"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: "#64748B",
      marginBottom: 14
    }
  }, "Preencha os dados do aceite antes de mover o paciente para esta coluna."), /*#__PURE__*/React.createElement(Field, {
    label: "Receptor *",
    fieldKey: "receptor",
    value: form.receptor,
    onChange: upd,
    placeholder: "Nome do médico, setor ou hospital"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Data do aceite *",
    fieldKey: "data_aceite",
    value: form.data_aceite,
    onChange: upd,
    placeholder: "05/09/2026"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Hora do aceite *",
    fieldKey: "hora_aceite",
    value: form.hora_aceite,
    onChange: upd,
    placeholder: "14:35"
  }), err && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#FEE2E2",
      color: "#991B1B",
      padding: "8px 12px",
      borderRadius: 8,
      fontSize: 12,
      marginTop: 8
    }
  }, err)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 20px",
      borderTop: "1px solid #F1F5F9",
      display: "flex",
      gap: 8,
      justifyContent: "flex-end"
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: onCancel
  }, "Cancelar movimentação"), /*#__PURE__*/React.createElement(Btn, {
    onClick: confirm
  }, "✅ Confirmar aceite"))));
}

/* ─── SHARE MODAL ─── */
function ShareModal({
  onClose,
  settings,
  cards,
  cols,
  showT,
  exportPNG,
  generatePDF,
  exportExcel,
  currentView
}) {
  const text = buildText(cards, cols, settings);
  function doShare() {
    window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank");
    navigator.clipboard.writeText(text).catch(() => {});
    showT("✅ WhatsApp aberto!");
    onClose();
  }
  return /*#__PURE__*/React.createElement(ModalShell, {
    title: "Compartilhar no WhatsApp",
    onClose: onClose,
    maxWidth: 520
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#F0FDF4",
      border: "1px solid #86EFAC",
      borderRadius: 10,
      padding: "12px 14px",
      marginBottom: 14,
      fontSize: 12,
      color: "#166534",
      lineHeight: 1.8
    }
  }, /*#__PURE__*/React.createElement("strong", null, "Como funciona:"), /*#__PURE__*/React.createElement("br", null), "① WhatsApp Web abre com o texto já preenchido", /*#__PURE__*/React.createElement("br", null), "② Escolha o grupo na lista", /*#__PURE__*/React.createElement("br", null), "③ Clique em Enviar", settings?.app_url && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("br", null), "④ Link do app incluído automaticamente")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#F8FAFC",
      borderRadius: 8,
      padding: "10px 12px",
      marginBottom: 14,
      maxHeight: 280,
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 600,
      color: "#94A3B8",
      marginBottom: 6,
      textTransform: "uppercase",
      letterSpacing: ".05em"
    }
  }, "Pré-visualização"), /*#__PURE__*/React.createElement("pre", {
    style: {
      fontSize: 11,
      color: "#374151",
      whiteSpace: "pre-wrap",
      fontFamily: "inherit",
      lineHeight: 1.7
    }
  }, text)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 8,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => {
      onClose();
      setTimeout(() => exportPNG(currentView), 200);
    },
    style: {
      fontSize: 12,
      padding: "9px",
      textAlign: "center"
    }
  }, "🖼 PNG da tela atual"), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => {
      onClose();
      setTimeout(() => exportExcel(), 200);
    },
    style: {
      fontSize: 12,
      padding: "9px",
      textAlign: "center"
    }
  }, "📊 Exportar Excel"), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => {
      onClose();
      setTimeout(() => generatePDF("text"), 200);
    },
    style: {
      fontSize: 12,
      padding: "9px",
      textAlign: "center"
    }
  }, "📄 PDF Formatado"), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => {
      onClose();
      setTimeout(() => generatePDF("visual"), 200);
    },
    style: {
      fontSize: 12,
      padding: "9px",
      textAlign: "center"
    }
  }, "🗂 PDF Visual")), /*#__PURE__*/React.createElement(Btn, {
    variant: "wa",
    onClick: doShare,
    style: {
      width: "100%",
      justifyContent: "center",
      padding: "12px",
      fontSize: 14
    }
  }, "📤 Abrir WhatsApp com o texto"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#94A3B8",
      textAlign: "center",
      marginTop: 8
    }
  }, "Funciona no computador e no celular"));
}

/* ─── SETTINGS MODAL ─── */
function SettingsModal({
  settings,
  onClose,
  onSave
}) {
  const [form, setForm] = useState({
    admin_nome: settings.admin_nome || "",
    admin_coren: settings.admin_coren || "",
    admin_zap: settings.admin_zap || "",
    app_url: settings.app_url || ""
  });
  const upd = (k, v) => setForm(p => ({
    ...p,
    [k]: v
  }));
  return /*#__PURE__*/React.createElement(ModalShell, {
    title: "Configurações",
    onClose: onClose,
    maxWidth: 440,
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Btn, {
      variant: "ghost",
      onClick: onClose
    }, "Cancelar"), /*#__PURE__*/React.createElement(Btn, {
      onClick: () => onSave(form)
    }, "Salvar"))
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: "#0F172A",
      marginBottom: 12,
      textTransform: "uppercase"
    }
  }, "Administradora"), /*#__PURE__*/React.createElement(Field, {
    label: "Nome completo",
    fieldKey: "admin_nome",
    value: form.admin_nome,
    onChange: upd,
    placeholder: "Enf.ª Fabiana Faria de Figueiredo"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "COREN",
    fieldKey: "admin_coren",
    value: form.admin_coren,
    onChange: upd,
    placeholder: "COREN-SP 299283"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "WhatsApp",
    fieldKey: "admin_zap",
    value: form.admin_zap,
    onChange: upd,
    placeholder: "(19) 99999-9999"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: "#F1F5F9",
      margin: "16px 0"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: "#0F172A",
      marginBottom: 6,
      textTransform: "uppercase"
    }
  }, "Link do aplicativo"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "#94A3B8",
      marginBottom: 10
    }
  }, "Incluído automaticamente nas mensagens do WhatsApp."), /*#__PURE__*/React.createElement(Field, {
    label: "URL do app",
    fieldKey: "app_url",
    value: form.app_url,
    onChange: upd,
    placeholder: "https://trodrigues1505.github.io/gerencia-enfermagem/"
  }));
}

/* ─── PUBLISH MODAL ─── */
function PubModal({
  onClose,
  onPub,
  cards,
  cols
}) {
  return /*#__PURE__*/React.createElement(ModalShell, {
    title: "Publicar atualização",
    onClose: onClose,
    maxWidth: 420,
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Btn, {
      variant: "ghost",
      onClick: onClose
    }, "Cancelar"), /*#__PURE__*/React.createElement(Btn, {
      onClick: onPub
    }, "Publicar versão"))
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: "#64748B",
      marginBottom: 14
    }
  }, "Esta versão ficará visível para todos os profissionais."), cols.map(c => {
    const n = cards.filter(k => k.col_id === c.id).length;
    return /*#__PURE__*/React.createElement("div", {
      key: c.id,
      style: {
        display: "flex",
        justifyContent: "space-between",
        padding: "7px 0",
        borderBottom: "1px solid #F8FAFC"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: "#374151"
      }
    }, c.emoji, " ", c.label), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: "#0F172A"
      }
    }, n));
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      padding: "10px 14px",
      background: "#F0FDF4",
      borderRadius: 8,
      border: "1px solid #86EFAC"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: "#166534",
      fontWeight: 600
    }
  }, "Total: ", cards.length, " pacientes")));
}