/* ─── LINHA DO TEMPO ─── */
function TimelineView({
  cards,
  cols
}) {
  const [filterCol, setFilterCol] = useState("all");
  const [tlMode, setTlMode] = useState("paciente");
  const colLabel = cols.reduce((acc, c) => ({
    ...acc,
    [c.id]: c.label
  }), {});
  const COL_DOT = {
    pendente: "#F59E0B",
    aceite: "#3B82F6",
    psiquiatria: "#8B5CF6",
    andamento: "#EF4444",
    finalizado: "#6B7280",
    pediatria: "#EC4899"
  };
  const GRAV_DOT = {
    emergencia: "#EF4444",
    urgencia: "#EAB308",
    andamento_cor: "#F59E0B",
    menor_gravidade: "#22C55E",
    finalizado_cor: "#A855F7",
    agendamento: "#94A3B8",
    retorno: "#EC4899"
  };
  const filtered = filterCol === "all" ? cards : cards.filter(c => c.col_id === filterCol);
  const colsOrdered = cols.filter(col => filtered.some(c => c.col_id === col.id));
  function buildCronEvents() {
    const events = [];
    filtered.forEach(c => {
      const push = (dt, label, color) => {
        if (dt) events.push({
          card: c,
          label,
          color,
          ts: dt.getTime(),
          dtStr: dt.toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
          })
        });
      };
      if (c.created_at) push(new Date(c.created_at), "Criado no sistema", COL_DOT[c.col_id] || "#94A3B8");
      if (c.adm) push(parseAdm(c.adm), "Admissão", "#F59E0B");
      if (c.data_aceite) push(parseAdm(c.data_aceite), "Aceite confirmado", "#3B82F6");
      if (c.saida) push(parseAdm(c.saida), "Saída", "#16A34A");
      if (c.retorno) push(parseAdm(c.retorno), "Retorno", "#EC4899");
      if (c.cross_info) {
        const dt = parseAdm(c.cross_info);
        if (dt) push(dt, "Cross", COL_DOT.andamento || "#EF4444");
      }
    });
    return events.sort((a, b) => b.ts - a.ts);
  }
  function parseAdm(str) {
    if (!str) return null;
    const parts = str.split("/");
    if (parts.length < 2) return null;
    const d = parseInt(parts[0]),
      m = parseInt(parts[1]) - 1,
      y = parts.length >= 3 ? parseInt(parts[2]) : new Date().getFullYear();
    const dt = new Date(y < 100 ? 2000 + y : y, m, d);
    return isNaN(dt.getTime()) ? null : dt;
  }
  const CardChip = ({
    c
  }) => {
    const dot = GRAV_DOT[c.grav] || "#EAB308";
    const accent = COL_DOT[c.col_id] || "#94A3B8";
    return /*#__PURE__*/React.createElement("div", {
      style: {
        background: "#fff",
        border: "1px solid #E2E8F0",
        borderRadius: 10,
        padding: "10px 14px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 8,
        marginBottom: 4
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 600,
        fontSize: 12,
        color: "#0F172A"
      }
    }, c.is_rn ? "👶 " : "", c.nome, c.idade ? " · " + c.idade : ""), c.pr && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        fontWeight: 700,
        background: "#F1F5F9",
        color: "#475569",
        padding: "2px 6px",
        borderRadius: 4,
        flexShrink: 0
      }
    }, "P", c.pr)), c.hd && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: "#374151",
        marginBottom: 4
      }
    }, c.hd), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 5,
        flexWrap: "wrap"
      }
    }, c.adm && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        background: "#FEF3C7",
        color: "#92400E",
        padding: "1px 5px",
        borderRadius: 3
      }
    }, "Adm: ", c.adm), c.setor && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        background: "#F1F5F9",
        color: "#475569",
        padding: "1px 5px",
        borderRadius: 3
      }
    }, c.setor), c.rec && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        background: "#EFF6FF",
        color: "#1E40AF",
        padding: "1px 5px",
        borderRadius: 3
      }
    }, c.rec), c.hosp && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        background: "#F0FDF4",
        color: "#166534",
        padding: "1px 5px",
        borderRadius: 3
      }
    }, "→ ", c.hosp), c.amb && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        background: c.amb.includes("Av") ? "#FEF2F2" : "#EFF6FF",
        color: c.amb.includes("Av") ? "#991B1B" : "#1E40AF",
        padding: "1px 5px",
        borderRadius: 3
      }
    }, c.amb.includes("Av") ? "Avançada" : "Básica")), (c.data_aceite || c.receptor) && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 4,
        fontSize: 10,
        color: "#16A34A"
      }
    }, c.data_aceite && "Aceite: " + c.data_aceite, c.hora_aceite ? " às " + c.hora_aceite : "", c.receptor ? " · " + c.receptor : ""), c.cross_info && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 2,
        fontSize: 10,
        color: "#94A3B8"
      }
    }, "Cross: ", c.cross_info), c.status && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 4,
        fontSize: 9,
        fontWeight: 700,
        textTransform: "uppercase",
        color: "#64748B"
      }
    }, c.status), c.created_at && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 3,
        fontSize: 9,
        color: "#CBD5E1"
      }
    }, new Date(c.created_at).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    })));
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
      flexWrap: "wrap",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 15,
      color: "#0F172A"
    }
  }, "Linha do Tempo"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#F1F5F9",
      borderRadius: 8,
      padding: 2,
      display: "flex",
      gap: 1
    }
  }, [["paciente", "👤 Por paciente"], ["cronologico", "📅 Cronológico"]].map(([id, label]) => /*#__PURE__*/React.createElement("button", {
    key: id,
    onClick: () => setTlMode(id),
    style: {
      padding: "5px 12px",
      borderRadius: 6,
      border: "none",
      fontSize: 11,
      fontWeight: tlMode === id ? 700 : 400,
      background: tlMode === id ? "#0F172A" : "transparent",
      color: tlMode === id ? "#fff" : "#64748B",
      cursor: "pointer",
      transition: "all .15s"
    }
  }, label))), /*#__PURE__*/React.createElement("select", {
    value: filterCol,
    onChange: e => setFilterCol(e.target.value),
    style: {
      padding: "5px 8px",
      border: "1px solid #E2E8F0",
      borderRadius: 7,
      fontSize: 11,
      background: "#fff",
      color: "#374151",
      fontFamily: "inherit"
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "Todas as colunas"), cols.map(c => /*#__PURE__*/React.createElement("option", {
    key: c.id,
    value: c.id
  }, c.label))))), tlMode === "paciente" && /*#__PURE__*/React.createElement(React.Fragment, null, colsOrdered.map(col => {
    const colCards = (() => {
      const arr = filtered.filter(c => c.col_id === col.id);
      if (col.id !== "aceite") return arr;
      // Ordenar por prioridade numérica: cards sem prioridade vão para o fim
      return [...arr].sort((a, b) => {
        const pa = a.prioridade_remocao ? parseInt(a.prioridade_remocao, 10) : 99999;
        const pb = b.prioridade_remocao ? parseInt(b.prioridade_remocao, 10) : 99999;
        return pa - pb;
      });
    })();
    const accent = col.accent || "#94A3B8";
    return /*#__PURE__*/React.createElement("div", {
      key: col.id,
      style: {
        marginBottom: 24
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 12,
        height: 12,
        borderRadius: "50%",
        background: accent,
        flexShrink: 0
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 700,
        fontSize: 13,
        color: "#0F172A"
      }
    }, col.emoji, " ", col.label), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 600,
        background: accent + "22",
        color: accent,
        padding: "1px 8px",
        borderRadius: 99
      }
    }, colCards.length)), /*#__PURE__*/React.createElement("div", {
      style: {
        paddingLeft: 20,
        borderLeft: `2px solid ${accent}30`
      }
    }, colCards.map(c => {
      const dot = GRAV_DOT[c.grav] || "#EAB308";
      return /*#__PURE__*/React.createElement("div", {
        key: c.id,
        style: {
          position: "relative",
          marginBottom: 12
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          position: "absolute",
          left: -25,
          top: 10,
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: dot,
          border: "2px solid #fff",
          boxShadow: "0 0 0 1px " + dot
        }
      }), /*#__PURE__*/React.createElement(CardChip, {
        c: c
      }));
    })));
  }), filtered.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "48px",
      color: "#CBD5E1",
      fontSize: 13
    }
  }, "Nenhum card encontrado.")), tlMode === "cronologico" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      paddingLeft: 20,
      borderLeft: "2px solid #E2E8F0"
    }
  }, buildCronEvents().map((ev, i) => {
    const dot = GRAV_DOT[ev.card.grav] || "#EAB308";
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        position: "relative",
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        left: -25,
        top: 10,
        width: 9,
        height: 9,
        borderRadius: "50%",
        background: ev.color,
        border: "2px solid #fff",
        boxShadow: "0 0 0 1px " + ev.color
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        background: "#fff",
        border: "1px solid #E2E8F0",
        borderRadius: 10,
        padding: "10px 14px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 8,
        marginBottom: 4
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        fontWeight: 700,
        padding: "1px 6px",
        borderRadius: 3,
        background: ev.color + "20",
        color: ev.color,
        marginRight: 6
      }
    }, ev.label), /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 600,
        fontSize: 12,
        color: "#0F172A"
      }
    }, ev.card.nome), ev.card.idade && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: "#94A3B8"
      }
    }, " · ", ev.card.idade)), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: "#94A3B8",
        flexShrink: 0,
        whiteSpace: "nowrap"
      }
    }, ev.dtStr)), ev.card.hd && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10,
        color: "#64748B"
      }
    }, ev.card.hd), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 9,
        color: "#94A3B8",
        marginTop: 2
      }
    }, colLabel[ev.card.col_id])));
  }), buildCronEvents().length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "48px",
      color: "#CBD5E1",
      fontSize: 13
    }
  }, "Nenhum evento encontrado."))));
}