/* ─── AUDIT / HISTORY PANEL ─── */
function HistoryPanel() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [users, setUsers] = useState([]);
  const [exportado, setExportado] = useState(false);
  const [zerando, setZerando] = useState(false);

  /* Mês atual para label do backup */
  const mesAtual = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const mesKey = new Date().toISOString().slice(0, 7); // "2026-09"

  /* Verifica se já existe backup deste mês no localStorage */
  const backupKey = "ge_audit_backup_" + mesKey;
  const jaBackup = !!loadLS(backupKey, null);

  useEffect(() => {
    Promise.all([
      sbGet("card_history", "order=created_at.desc&limit=2000"),
      sbGet("users", "order=nome.asc")
    ]).then(([rows, us]) => {
      setHistory(rows);
      setUsers(us);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  /* Exporta o log atual como JSON e marca backup feito */
  function exportarBackup() {
    if (!history.length) return;
    const blob = new Blob([JSON.stringify({ mes: mesKey, exportado_em: new Date().toISOString(), registros: history }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `audit-log-${mesKey}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    saveLS(backupKey, { exportado_em: new Date().toISOString(), total: history.length });
    setExportado(true);
  }

  /* Zera o log no Supabase — só permitido após exportar */
  async function zerarLog() {
    if (!exportado && !jaBackup) return;
    if (!window.confirm(
      `Isso vai apagar PERMANENTEMENTE os ${history.length} registros do log de auditoria.

O backup JSON já foi salvo no seu computador.

Digite CONFIRMAR para prosseguir:`
    )) return;
    const conf = window.prompt("Digite CONFIRMAR para apagar o log:");
    if (conf !== "CONFIRMAR") return;
    setZerando(true);
    try {
      /* Deleta em lotes de 50 para não estourar timeout */
      const ids = history.map(h => h.id);
      for (let i = 0; i < ids.length; i += 50) {
        const lote = ids.slice(i, i + 50);
        await fetch(`${SB_URL}/rest/v1/card_history?id=in.(${lote.join(",")})`, {
          method: "DELETE",
          headers: { ...H(), Prefer: "return=minimal" }
        });
      }
      setHistory([]);
      saveLS(backupKey, { ...loadLS(backupKey, {}), zerado_em: new Date().toISOString() });
    } catch (e) {
      alert("Erro ao zerar: " + e.message);
    }
    setZerando(false);
  }

  const actionColor = {
    "criou card": "#16A34A",
    "editou card": "#3B82F6",
    "excluiu card": "#EF4444",
    "restaurou card": "#8B5CF6",
    "moveu": "#F59E0B",
    "definiu prioridade": "#7C3AED",
    "escalou equipe": "#0369A1"
  };

  const filtered = history.filter(h => {
    const matchUser = !filterUser || h.user_nome?.toLowerCase().includes(filterUser.toLowerCase());
    const matchDate = !filterDate || h.created_at?.startsWith(filterDate);
    return matchUser && matchDate;
  });
  return React.createElement("div", null,
    /* ── Cabeçalho + controles ── */
    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 12 } },
      React.createElement("div", null,
        React.createElement("div", { style: { fontWeight: 700, fontSize: 16, color: "#0F172A", marginBottom: 2 } }, "📜 Log de Auditoria"),
        React.createElement("div", { style: { fontSize: 12, color: "#64748B" } }, filtered.length + " ação" + (filtered.length !== 1 ? "ões" : "") + " · últimas 2000 registradas")
      ),
      React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" } },
        React.createElement("input", {
          placeholder: "Filtrar por usuário…",
          value: filterUser,
          onChange: e => setFilterUser(e.target.value),
          style: { padding: "6px 10px", border: "1px solid #E2E8F0", borderRadius: 7, fontSize: 12, width: 170, fontFamily: "inherit", background: "#fff" }
        }),
        React.createElement("input", {
          type: "date", value: filterDate,
          onChange: e => setFilterDate(e.target.value),
          style: { padding: "6px 10px", border: "1px solid #E2E8F0", borderRadius: 7, fontSize: 12, fontFamily: "inherit", background: "#fff" }
        }),
        (filterUser || filterDate) && React.createElement("button", {
          onClick: () => { setFilterUser(""); setFilterDate(""); },
          style: { padding: "6px 10px", border: "1px solid #E2E8F0", borderRadius: 7, fontSize: 11, background: "none", color: "#64748B", cursor: "pointer" }
        }, "✕ Limpar")
      )
    ),
    /* ── Banner de backup mensal ── */
    history.length > 0 && React.createElement("div", {
      style: { background: (exportado || jaBackup) ? "#F0FDF4" : "#FEF3C7",
        border: `1px solid ${(exportado || jaBackup) ? "#86EFAC" : "#FDE68A"}`,
        borderRadius: 10, padding: "12px 16px", marginBottom: 16,
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }
    },
      React.createElement("div", null,
        React.createElement("div", { style: { fontWeight: 700, fontSize: 13,
          color: (exportado || jaBackup) ? "#15803D" : "#92400E" } },
          (exportado || jaBackup)
            ? "✅ Backup de " + mesAtual + " já realizado"
            : "💾 Backup mensal — " + mesAtual
        ),
        React.createElement("div", { style: { fontSize: 11, color: "#64748B", marginTop: 2 } },
          (exportado || jaBackup)
            ? "Você pode zerar o log abaixo para liberar espaço."
            : "Exporte o log antes de zerar. O backup fica salvo no seu computador."
        )
      ),
      React.createElement("div", { style: { display: "flex", gap: 8 } },
        React.createElement("button", {
          onClick: exportarBackup,
          style: { padding: "7px 14px", border: "none", borderRadius: 8,
            background: "#0F172A", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }
        }, "📥 Exportar backup"),
        React.createElement("button", {
          onClick: zerarLog,
          disabled: (!exportado && !jaBackup) || zerando,
          title: (!exportado && !jaBackup) ? "Exporte o backup primeiro" : "Apagar todos os registros do log",
          style: { padding: "7px 14px", border: "1px solid #FCA5A5", borderRadius: 8,
            background: (!exportado && !jaBackup) ? "#F1F5F9" : "none",
            color: (!exportado && !jaBackup) ? "#CBD5E1" : "#DC2626",
            fontWeight: 700, fontSize: 12,
            cursor: (!exportado && !jaBackup) ? "not-allowed" : "pointer" }
        }, zerando ? "Zerando…" : "🗑 Zerar log")
      )
    ),
    loading && React.createElement("div", { style: { textAlign: "center", padding: 32, color: "#94A3B8" } }, "Carregando…"),
    !loading && filtered.length === 0 && React.createElement("div", { style: { textAlign: "center", padding: 32, color: "#CBD5E1", fontSize: 13, border: "1.5px dashed #F1F5F9", borderRadius: 10 } }, "Nenhuma ação encontrada para os filtros selecionados."),
    filtered.map(h => {
    const actionKey = Object.keys(actionColor).find(k => h.action.startsWith(k));
    const color = actionColor[actionKey] || "#64748B";
    return /*#__PURE__*/React.createElement("div", {
      key: h.id,
      style: {
        background: "#fff",
        border: "1px solid #E2E8F0",
        borderLeft: `3px solid ${color}`,
        borderRadius: 8,
        padding: "10px 14px",
        marginBottom: 6,
        display: "flex",
        gap: 12,
        alignItems: "flex-start"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        alignItems: "center",
        marginBottom: 2
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 600,
        fontSize: 12,
        color: "#0F172A"
      }
    }, h.user_nome || "Sistema"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        color,
        fontWeight: 600
      }
    }, h.action)), h.new_value?.nome && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: "#64748B"
      }
    }, h.new_value.nome), h.old_value?.nome && !h.new_value && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: "#64748B"
      }
    }, h.old_value.nome)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10,
        color: "#94A3B8",
        whiteSpace: "nowrap",
        flexShrink: 0
      }
    }, new Date(h.created_at).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    })));
  }));
}