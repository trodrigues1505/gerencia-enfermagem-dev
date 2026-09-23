/* ─── SUBCATEGORIAS: especialidades que agrupam visualmente dentro de cada coluna ─── */
const SUBCOL_SPECS = [{
  key: "psiquiatria",
  label: "Psiquiatria",
  emoji: "🧠",
  color: "#8B5CF6",
  keywords: ["psiquiatri", "psico"]
}, {
  key: "pediatria",
  label: "Pediatria",
  emoji: "👶",
  color: "#EC4899",
  keywords: ["pediatri", "pedi", "neonat", "rn de", "rn ", "recém"]
}];
function detectSubcat(card) {
  const cat = card.categoria;
  if (cat && cat !== "normal") return SUBCOL_SPECS.find(s => s.key === cat) || null;
  if (card.is_rn) return SUBCOL_SPECS.find(s => s.key === "pediatria") || null;
  return null;
}

/* Renderiza os cards de uma coluna agrupados por subcategoria */
function GroupedCards({
  cards,
  onClick,
  isAdmin,
  onDragStart,
  onDragEnd
}) {
  const subMap = {};
  const normal = [];
  cards.forEach(c => {
    const sc = detectSubcat(c);
    if (sc) {
      if (!subMap[sc.key]) subMap[sc.key] = [];
      subMap[sc.key].push(c);
    } else normal.push(c);
  });
  const hasGroups = Object.keys(subMap).length > 0;
  return /*#__PURE__*/React.createElement(React.Fragment, null, normal.map(card => /*#__PURE__*/React.createElement(KCard, {
    key: card.id,
    c: card,
    onClick: onClick,
    isAdmin: isAdmin,
    onDragStart: e => onDragStart(e, card.id),
    onDragEnd: onDragEnd
  })), SUBCOL_SPECS.map(sc => {
    const group = subMap[sc.key];
    if (!group || !group.length) return null;
    return /*#__PURE__*/React.createElement("div", {
      key: sc.key,
      style: {
        marginTop: normal.length > 0 ? 8 : 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 5,
        marginBottom: 5,
        paddingBottom: 4,
        borderBottom: `1.5px solid ${sc.color}30`
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10
      }
    }, sc.emoji), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        fontWeight: 700,
        color: sc.color,
        textTransform: "uppercase",
        letterSpacing: ".06em"
      }
    }, sc.label), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        fontWeight: 700,
        color: sc.color,
        background: sc.color + "18",
        padding: "1px 5px",
        borderRadius: 99,
        marginLeft: "auto"
      }
    }, group.length)), group.map(card => /*#__PURE__*/React.createElement(KCard, {
      key: card.id,
      c: card,
      onClick: onClick,
      isAdmin: isAdmin,
      onDragStart: e => onDragStart(e, card.id),
      onDragEnd: onDragEnd
    })));
  }));
}

/* ─── KANBAN CARD ─── */
function KCard({
  c,
  onClick,
  isAdmin,
  onDragStart,
  onDragEnd
}) {
  const gc = GC[c.grav] || GC.urgencia;
  const hasAceite = c.receptor || c.data_aceite;
  return /*#__PURE__*/React.createElement("div", {
    className: "k-card",
    "data-id": c.id,
    draggable: isAdmin,
    onDragStart: onDragStart,
    onDragEnd: onDragEnd,
    onClick: () => onClick(c),
    style: {
      background: "#fff",
      border: "1px solid #E2E8F0",
      borderLeft: `3px solid ${gc.dot}`,
      borderRadius: 8,
      padding: "10px 11px",
      marginBottom: 6,
      userSelect: "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 6,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      alignItems: "center",
      marginBottom: 2,
      flexWrap: "wrap"
    }
  }, c.pr && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      color: "#94A3B8"
    }
  }, "#", c.pr), /*#__PURE__*/React.createElement(StatusPill, {
    status: c.status
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 12,
      color: "#0F172A",
      lineHeight: 1.3,
      display: "flex",
      alignItems: "center",
      gap: 3,
      minWidth: 0
    }
  }, (() => {
    const B = {
      pediatria: {
        e: "👶",
        c: "#EC4899"
      },
      psiquiatria: {
        e: "🧠",
        c: "#8B5CF6"
      },
      obstetricia: {
        e: "🤰",
        c: "#F97316"
      }
    };
    const b = c.categoria && c.categoria !== "normal" ? B[c.categoria] : c.is_rn ? B.pediatria : null;
    return b ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        fontWeight: 800,
        padding: "1px 4px",
        borderRadius: 3,
        background: b.c + "20",
        color: b.c,
        flexShrink: 0
      }
    }, b.e) : null;
  })(), /*#__PURE__*/React.createElement("span", {
    style: {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, c.nome))), /*#__PURE__*/React.createElement(Badge, {
    grav: c.grav
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#374151",
      marginBottom: 5,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#CBD5E1"
    }
  }, "HD: "), c.hd), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 4,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      flexWrap: "wrap"
    }
  }, c.setor && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      background: "#F1F5F9",
      color: "#475569",
      padding: "1px 5px",
      borderRadius: 3
    }
  }, c.setor), c.rec && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      background: "#EFF6FF",
      color: "#1E40AF",
      padding: "1px 5px",
      borderRadius: 3
    }
  }, c.rec)), /*#__PURE__*/React.createElement(AmbBadge, {
    amb: c.amb
  })), c.hosp && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4,
      fontSize: 10,
      color: "#64748B"
    }
  }, "→ ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: "#0F172A"
    }
  }, c.hosp)), c.cross_info && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 2,
      fontSize: 10,
      color: "#94A3B8"
    }
  }, "Cross: ", c.cross_info), (() => {
    if (!c.created_at) return null;
    const hrs = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 3600000);
    if (hrs < 1) return null;
    const color = hrs >= 24 ? "#EF4444" : hrs >= 12 ? "#F59E0B" : "#94A3B8";
    return /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 2,
        fontSize: 9,
        color,
        fontWeight: hrs >= 12 ? 700 : 400
      }
    }, hrs >= 24 ? Math.floor(hrs / 24) + "d " : "", hrs % 24 > 0 ? hrs % 24 + "h " : "", "no sistema");
  })(), hasAceite && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 3,
      fontSize: 10,
      color: "#16A34A"
    }
  }, "📥 ", c.receptor, c.hora_aceite ? " às " + c.hora_aceite : ""),
    c.prioridade_remocao && React.createElement("div", {
      style: { marginTop:3, display:"flex", alignItems:"center", gap:4 }
    },
      React.createElement("span", {
        style: { fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:99,
          background:"#EDE9FE", color:"#6D28D9", border:"1px solid #DDD6FE" }
      }, "P" + c.prioridade_remocao)
    ),
    (c.medico_escala || c.enfermeiro_escalado || c.tecnico_auxiliar_escala) && React.createElement("div", {
      style: { marginTop:3, borderTop:"1px solid #BFDBFE", paddingTop:3 }
    },
      c.medico_escala && React.createElement("div", { style:{ fontSize:9, color:"#15803D", fontWeight:600 } },
        "🩺 ", c.medico_escala, c.setor_medico_escala ? " · " + c.setor_medico_escala : ""),
      c.enfermeiro_escalado && React.createElement("div", { style:{ fontSize:9, color:"#1D4ED8", fontWeight:600 } },
        "🧑 ", c.enfermeiro_escalado, c.setor_saida_enfermeiro ? " · " + c.setor_saida_enfermeiro : ""),
      c.tecnico_auxiliar_escala && React.createElement("div", { style:{ fontSize:9, color:"#6D28D9", fontWeight:600 } },
        "💊 ", c.tecnico_auxiliar_escala, c.setor_tecnico_escala ? " · " + c.setor_tecnico_escala : "")
    )
  );
}

/* ─── MODAL RESULTADO DE IMPORTAÇÃO (kanban) ─── */
function KanbanImportResultModal({ result, onClose }) {
  const { ok, total, fails } = result;
  const hasErrors = fails && fails.length > 0;
  return React.createElement("div", { style: { position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 16 } },
    React.createElement("div", { style: { background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,.22)", overflow: "hidden" } },
      React.createElement("div", { style: { padding: "14px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" } },
        React.createElement("div", null,
          React.createElement("div", { style: { fontWeight: 700, fontSize: 15, color: "#0F172A" } }, hasErrors ? "⚠ Importação concluída com erros" : "✅ Importação concluída"),
          React.createElement("div", { style: { fontSize: 11, color: "#94A3B8", marginTop: 2 } }, "Snapshot → Banco de dados")
        ),
        React.createElement("button", { onClick: onClose, style: { background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 20, padding: 4 } }, "✕")
      ),
      React.createElement("div", { style: { padding: "16px 20px" } },
        React.createElement("div", { style: { display: "flex", gap: 10, marginBottom: hasErrors ? 16 : 0 } },
          React.createElement("div", { style: { flex: 1, background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 10, padding: "12px", textAlign: "center" } },
            React.createElement("div", { style: { fontSize: 24, fontWeight: 800, color: "#16A34A" } }, ok),
            React.createElement("div", { style: { fontSize: 11, color: "#166534", marginTop: 2 } }, "importado" + (ok !== 1 ? "s" : "") + " com sucesso")
          ),
          hasErrors && React.createElement("div", { style: { flex: 1, background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "12px", textAlign: "center" } },
            React.createElement("div", { style: { fontSize: 24, fontWeight: 800, color: "#DC2626" } }, fails.length),
            React.createElement("div", { style: { fontSize: 11, color: "#991B1B", marginTop: 2 } }, "não importado" + (fails.length !== 1 ? "s" : ""))
          ),
          React.createElement("div", { style: { flex: 1, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "12px", textAlign: "center" } },
            React.createElement("div", { style: { fontSize: 24, fontWeight: 800, color: "#475569" } }, total),
            React.createElement("div", { style: { fontSize: 11, color: "#64748B", marginTop: 2 } }, "total processado" + (total !== 1 ? "s" : ""))
          )
        ),
        hasErrors && React.createElement("div", { style: { maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 } },
          React.createElement("div", { style: { fontSize: 10, fontWeight: 700, color: "#991B1B", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 } }, "Registros não importados"),
          fails.map((f, i) => React.createElement("div", { key: i, style: { padding: "8px 10px", border: "1px solid #FCA5A5", background: "#FEF2F2", borderRadius: 8 } },
            React.createElement("div", { style: { fontWeight: 700, fontSize: 12, color: "#0F172A" } }, f.nome),
            React.createElement("div", { style: { fontSize: 11, color: "#991B1B", marginTop: 2, wordBreak: "break-word" } }, f.erro)
          ))
        )
      ),
      React.createElement("div", { style: { padding: "10px 20px", borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "flex-end" } },
        React.createElement("button", { onClick: onClose, style: { padding: "7px 20px", borderRadius: 8, border: "none", background: "#0F172A", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" } }, "Entendi")
      )
    )
  );
}

/* ─── MODAL DUPLICATAS (kanban) ─── */
function KanbanDuplicatesModal({ cards, cols, onClose, onDel }) {
  const [selected, setSelected] = useState(new Set());
  const [deleted, setDeleted] = useState(new Set());
  const [loading, setLoading] = useState(false);

  const groups = React.useMemo(() => {
    const norm = s => (s || "").trim().toUpperCase().replace(/\s+/g, " ");
    const map = {};
    cards.forEach(c => { const k = norm(c.nome); if (!map[k]) map[k] = []; map[k].push(c); });
    return Object.values(map).filter(g => g.length > 1);
  }, [cards]);

  const colLabel = id => cols.find(c => c.id === id)?.label || id;

  function toggle(id) { setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function markDups(group) { setSelected(p => { const n = new Set(p); group.slice(1).forEach(c => n.add(c.id)); return n; }); }

  async function handleDelete() {
    setLoading(true);
    for (const id of [...selected]) {
      try { await onDel(id); setDeleted(p => new Set([...p, id])); } catch {}
    }
    setSelected(new Set());
    setLoading(false);
  }

  if (groups.length === 0) return React.createElement("div", { style: { position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 16 } },
    React.createElement("div", { style: { background: "#fff", borderRadius: 16, width: "100%", maxWidth: 400, padding: 24, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,.22)" } },
      React.createElement("div", { style: { fontSize: 32, marginBottom: 8 } }, "✅"),
      React.createElement("div", { style: { fontWeight: 700, fontSize: 16, color: "#0F172A", marginBottom: 4 } }, "Sem duplicatas"),
      React.createElement("div", { style: { fontSize: 13, color: "#64748B", marginBottom: 16 } }, "Nenhum nome de paciente repetido encontrado."),
      React.createElement("button", { onClick: onClose, style: { padding: "8px 24px", borderRadius: 8, border: "none", background: "#0F172A", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" } }, "Fechar")
    )
  );

  return React.createElement("div", { style: { position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 16 } },
    React.createElement("div", { style: { background: "#fff", borderRadius: 16, width: "100%", maxWidth: 720, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,.22)" } },
      // header
      React.createElement("div", { style: { padding: "14px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 } },
        React.createElement("div", null,
          React.createElement("div", { style: { fontWeight: 700, fontSize: 15, color: "#0F172A" } }, "🔍 Verificação de duplicatas"),
          React.createElement("div", { style: { fontSize: 11, color: "#94A3B8", marginTop: 2 } }, groups.length + " nome" + (groups.length !== 1 ? "s" : "") + " repetido" + (groups.length !== 1 ? "s" : "") + " · " + groups.reduce((a, g) => a + g.length, 0) + " cards envolvidos")
        ),
        React.createElement("button", { onClick: onClose, style: { background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 20, padding: 4 } }, "✕")
      ),
      // body
      React.createElement("div", { style: { flex: 1, overflowY: "auto", padding: "12px 20px" } },
        groups.map((group, gi) => {
          const visible = group.filter(c => !deleted.has(c.id));
          if (visible.length <= 1) return null;
          return React.createElement("div", { key: gi, style: { marginBottom: 20, background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0", overflow: "hidden" } },
            // cabeçalho grupo
            React.createElement("div", { style: { padding: "8px 12px", background: "#EFF6FF", borderBottom: "1px solid #DBEAFE", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 } },
              React.createElement("div", { style: { fontWeight: 700, fontSize: 12, color: "#1E40AF" } }, visible[0].nome, React.createElement("span", { style: { fontWeight: 400, color: "#64748B", marginLeft: 6 } }, "(" + visible.length + " cards)")),
              React.createElement("button", { onClick: () => markDups(visible), style: { padding: "3px 10px", border: "1px solid #BFDBFE", borderRadius: 6, background: "none", color: "#1E40AF", cursor: "pointer", fontSize: 11, fontWeight: 600 } }, "Marcar duplicatas")
            ),
            // cards lado a lado
            React.createElement("div", { style: { display: "flex", gap: 10, padding: 10, flexWrap: "wrap" } },
              visible.map(card => {
                const isSel = selected.has(card.id);
                const gc = GC[card.grav] || GC.urgencia;
                return React.createElement("div", {
                  key: card.id,
                  onClick: () => toggle(card.id),
                  style: { flex: "1 1 220px", minWidth: 200, maxWidth: 300, background: "#fff", border: "2px solid " + (isSel ? "#EF4444" : "#E2E8F0"), borderLeft: "4px solid " + gc.dot, borderRadius: 8, padding: "10px 12px", cursor: "pointer", transition: "border-color .15s", position: "relative" }
                },
                  // checkbox
                  React.createElement("div", { style: { position: "absolute", top: 8, right: 8, width: 18, height: 18, borderRadius: 4, border: "2px solid " + (isSel ? "#EF4444" : "#CBD5E1"), background: isSel ? "#EF4444" : "#fff", display: "flex", alignItems: "center", justifyContent: "center" } },
                    isSel && React.createElement("span", { style: { color: "#fff", fontSize: 11, fontWeight: 800, lineHeight: 1 } }, "✓")
                  ),
                  React.createElement("div", { style: { fontWeight: 700, fontSize: 12, color: "#0F172A", marginBottom: 6, paddingRight: 24, lineHeight: 1.3 } }, card.nome),
                  React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 3 } },
                    React.createElement("div", { style: { fontSize: 10, color: "#94A3B8" } }, colLabel(card.col_id)),
                    card.hd && React.createElement("div", { style: { fontSize: 11, color: "#374151" } }, React.createElement("span", { style: { color: "#CBD5E1" } }, "HD: "), card.hd),
                    card.adm && React.createElement("div", { style: { fontSize: 11, color: "#64748B" } }, React.createElement("span", { style: { color: "#CBD5E1" } }, "Adm: "), card.adm),
                    card.setor && React.createElement("div", { style: { fontSize: 11, color: "#64748B" } }, card.setor),
                    card.rec && React.createElement("div", { style: { fontSize: 10, background: "#EFF6FF", color: "#1E40AF", padding: "1px 5px", borderRadius: 3, display: "inline-block", marginTop: 2 } }, card.rec),
                    card.ficha_cross && React.createElement("div", { style: { fontSize: 10, color: "#94A3B8", marginTop: 2 } }, "Ficha: ", card.ficha_cross)
                  ),
                  isSel && React.createElement("div", { style: { marginTop: 8, fontSize: 10, fontWeight: 700, color: "#EF4444", textTransform: "uppercase", letterSpacing: ".05em" } }, "Marcado para excluir")
                );
              })
            )
          );
        }).filter(Boolean),
        groups.every(g => g.filter(c => !deleted.has(c.id)).length <= 1) &&
          React.createElement("div", { style: { textAlign: "center", padding: "24px", color: "#16A34A", fontSize: 13, fontWeight: 600 } }, "✅ Todas as duplicatas foram resolvidas!")
      ),
      // footer
      React.createElement("div", { style: { padding: "10px 20px", borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 } },
        React.createElement("div", { style: { fontSize: 12, color: "#64748B" } }, selected.size > 0 ? selected.size + " selecionado" + (selected.size !== 1 ? "s" : "") + " para excluir" : "Clique nos cards para selecionar"),
        React.createElement("div", { style: { display: "flex", gap: 8 } },
          React.createElement("button", { onClick: onClose, style: { padding: "7px 16px", borderRadius: 8, border: "1px solid #E2E8F0", background: "none", color: "#64748B", fontWeight: 600, fontSize: 13, cursor: "pointer" } }, "Fechar"),
          React.createElement("button", {
            disabled: selected.size === 0 || loading,
            onClick: handleDelete,
            style: { padding: "7px 16px", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", fontWeight: 600, fontSize: 13, cursor: selected.size === 0 || loading ? "not-allowed" : "pointer", opacity: selected.size === 0 || loading ? 0.5 : 1 }
          }, loading ? "Excluindo…" : "🗑 Excluir " + selected.size + " selecionado" + (selected.size !== 1 ? "s" : ""))
        )
      )
    )
  );
}

/* ════════════════════════════════════════════
   LIVRO DE SAÍDA
   ════════════════════════════════════════════ */