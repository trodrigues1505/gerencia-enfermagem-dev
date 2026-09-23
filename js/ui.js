/* ─── SMALL UI ─── */
const inp_s = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #E2E8F0",
  borderRadius: 7,
  fontSize: 13,
  color: "#0F172A",
  background: "#fff",
  fontFamily: "inherit"
};
const lbl_s = {
  fontSize: 10,
  fontWeight: 600,
  color: "#94A3B8",
  textTransform: "uppercase",
  letterSpacing: ".05em",
  display: "block",
  marginBottom: 3
};
function Btn({
  children,
  onClick,
  variant = "primary",
  style: ex = {},
  disabled = false,
  type = "button"
}) {
  const v = {
    primary: {
      background: "#0F172A",
      color: "#fff",
      border: "none"
    },
    ghost: {
      background: "none",
      color: "#64748B",
      border: "1px solid #E2E8F0"
    },
    danger: {
      background: "none",
      color: "#DC2626",
      border: "1px solid #FCA5A5"
    },
    green: {
      background: "#16A34A",
      color: "#fff",
      border: "none"
    },
    wa: {
      background: "#25D366",
      color: "#fff",
      border: "none"
    }
  };
  return /*#__PURE__*/React.createElement("button", {
    type: type,
    onClick: onClick,
    disabled: disabled,
    style: {
      padding: "7px 16px",
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? .6 : 1,
      ...(v[variant] || v.primary),
      ...ex
    }
  }, children);
}
function Badge({
  grav
}) {
  const c = GC[grav] || GC.urgencia;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      fontSize: 10,
      fontWeight: 600,
      padding: "2px 8px",
      borderRadius: 99,
      background: c.bg,
      color: c.text,
      border: `1px solid ${c.border}`,
      whiteSpace: "nowrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 5,
      height: 5,
      borderRadius: "50%",
      background: c.dot,
      flexShrink: 0
    }
  }), c.label);
}
function StatusPill({
  status
}) {
  if (!status) return null;
  const m = {
    "EVADIU": "#FEE2E2|#991B1B",
    "EVASÃO": "#FEE2E2|#991B1B",
    "ALTA": "#DCFCE7|#14532D",
    "ALTA MÉDICA": "#DCFCE7|#14532D",
    "FINALIZADO VIA CROSS": "#F3E8FF|#581C87",
    "RESOLVIDO COM RECURSOS LOCAIS": "#DCFCE7|#14532D",
    "REINSERIR": "#FEF3C7|#92400E",
    "ENCAMINHAR AMANHÃ": "#EFF6FF|#1E40AF"
  };
  const [bg, color] = (m[status] || "#F1F5F9|#475569").split("|");
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      padding: "1px 6px",
      borderRadius: 3,
      background: bg,
      color,
      whiteSpace: "nowrap",
      textTransform: "uppercase",
      letterSpacing: ".04em"
    }
  }, status);
}
function AmbBadge({
  amb
}) {
  if (!amb) return null;
  const av = amb.includes("Av");
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 600,
      padding: "2px 7px",
      borderRadius: 4,
      whiteSpace: "nowrap",
      background: av ? "#FEE2E2" : "#EFF6FF",
      color: av ? "#991B1B" : "#1E40AF",
      border: `1px solid ${av ? "#FCA5A5" : "#BFDBFE"}`
    }
  }, av ? "🚨 Avançada" : "🚐 Básica");
}
function Toast({
  toast
}) {
  if (!toast) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      bottom: 24,
      left: "50%",
      transform: "translateX(-50%)",
      padding: "10px 20px",
      borderRadius: 10,
      fontSize: 13,
      fontWeight: 500,
      boxShadow: "0 4px 20px rgba(0,0,0,.14)",
      zIndex: 9999,
      whiteSpace: "nowrap",
      pointerEvents: "none",
      background: toast.type === "err" ? "#FEE2E2" : "#F0FDF4",
      border: `1px solid ${toast.type === "err" ? "#FCA5A5" : "#86EFAC"}`,
      color: toast.type === "err" ? "#991B1B" : "#166534"
    }
  }, toast.msg);
}
function ModalShell({
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 560
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: 16
    },
    onClick: undefined
  }, /*#__PURE__*/React.createElement("div", {
    className: "ge-modal-inner", style: {
      background: "#fff",
      borderRadius: 16,
      width: "100%",
      maxWidth,
      maxHeight: "92vh",
      overflowY: "auto",
      boxShadow: "0 20px 60px rgba(0,0,0,.22)",
      WebkitOverflowScrolling: "touch"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "14px 20px",
      borderBottom: "1px solid #F1F5F9",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      position: "sticky",
      top: 0,
      background: "#fff",
      borderRadius: "16px 16px 0 0",
      zIndex: 1
    }
  }, /*#__PURE__*/React.createElement("div", null, subtitle && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 600,
      color: "#94A3B8",
      textTransform: "uppercase",
      letterSpacing: ".05em"
    }
  }, subtitle), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 15,
      color: "#0F172A",
      marginTop: subtitle ? 2 : 0
    }
  }, title)), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: "none",
      border: "none",
      cursor: "pointer",
      color: "#94A3B8",
      fontSize: 20,
      padding: 4
    }
  }, "✕")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px 20px"
    }
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 20px",
      borderTop: "1px solid #F1F5F9",
      display: "flex",
      gap: 8,
      justifyContent: "flex-end",
      position: "sticky",
      bottom: 0,
      background: "#fff",
      borderRadius: "0 0 16px 16px"
    }
  }, footer)));
}

/* Field fora dos modais — fix do perde foco */
function Field({
  label,
  fieldKey,
  value,
  onChange,
  disabled,
  as,
  opts,
  full,
  placeholder = ""
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10,
      gridColumn: full ? "1/-1" : undefined
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: lbl_s
  }, label), opts ? /*#__PURE__*/React.createElement("select", {
    value: value || "",
    onChange: e => onChange(fieldKey, e.target.value),
    disabled: disabled,
    style: inp_s
  }, opts.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.v ?? o,
    value: o.v ?? o
  }, o.t ?? o))) : as === "textarea" ? /*#__PURE__*/React.createElement("textarea", {
    rows: 2,
    value: value || "",
    onChange: e => onChange(fieldKey, e.target.value),
    disabled: disabled,
    placeholder: placeholder,
    style: {
      ...inp_s,
      resize: "vertical"
    }
  }) : /*#__PURE__*/React.createElement("input", {
    value: value || "",
    onChange: e => onChange(fieldKey, e.target.value),
    disabled: disabled,
    placeholder: placeholder,
    style: inp_s
  }));
}

function TempoTag({ label, color, bg }) {
  if (!label) return null;
  return React.createElement("span", {
    style: { fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:99,
      background: bg||"#F0F9FF", color: color||"#0369A1",
      border:`1px solid ${color||"#0369A1"}33`, whiteSpace:"nowrap" }
  }, label);
}


/* ════════════════════════════════════════════
   AÇÕES DE ENFERMAGEM
   ════════════════════════════════════════════ */