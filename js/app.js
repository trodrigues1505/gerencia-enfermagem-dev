const {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo
} = React;
function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [bootAuth, setBootAuth] = useState(true);
  // Restaura a sessao do Supabase Auth ao abrir. Antes o usuario vinha de
  // localStorage ("ge_session"), que o servidor nunca via.
  useEffect(() => {
    let vivo = true;
    authRestaurar()
      .then(u => { if (vivo) setCurrentUser(u); })
      .finally(() => { if (vivo) setBootAuth(false); });
    return () => { vivo = false; };
  }, []);
  const [cards, setCards] = useState([]);
  const [cols, setCols] = useState([]);
  const [comments, setComments] = useState({});
  const [settings, setSettings] = useState({});
  const [lastPub, setLastPub] = useState(null);
  const [pubCards, setPubCards] = useState(null);
  const [pubCols, setPubCols] = useState(null);
  const [selected, setSelected] = useState(null);
  const [pendingMove, setPendingMove] = useState(null);
  const [showPub, setShowPub] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [search, setSearch] = useState("");
  const [fGrav, setFGrav] = useState("all");
  const [view, setView] = useState("kanban");
  const [dashMode, setDashMode] = useState("acumulado");
  const [showNewCol, setShowNewCol] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [minimized, setMinimized] = useState(new Set());
  const [singleCol, setSingleCol] = useState(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 640;
  const [mobileOpen, setMobileOpen] = useState(null);
  const [sortCol, setSortCol] = useState(null);
  const [sortByPriority, setSortByPriority] = useState(false);
  const [toast, setToast] = useState(null);
  const [undoQueue, setUndoQueue] = useState([]);
  const [newComAlerts, setNewComAlerts] = useState([]);
  const [showComPanel, setShowComPanel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showInstall, setShowInstall] = useState(false);
  const [showSnapPanel, setShowSnapPanel] = useState(false);
  const [snapshots, setSnapshots] = useState(() => loadLS("ge_snapshots", []));
  const [showHistory, setShowHistory] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showLivro, setShowLivro] = useState(false);
  const [pendentesCount, setPendentesCount] = useState(0);
  const [pendenciasCount, setPendenciasCount] = useState(0);
  const [acoesCount, setAcoesCount] = useState(0);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [showAcoes, setShowAcoes] = useState(false);
  const dragId = useRef(null);
  const dragOverCol = useRef(null);
  const dragColId = useRef(null);
  const newColRef = useRef(null);
  const isAdmin = currentUser?.role === "admin";
  // Espelho no front das policies do banco. Se divergirem, o usuario ve um
  // botao que o Postgres recusa — pior que nao ver botao nenhum.
  const podeKanban   = isAdmin || !!currentUser?.can_kanban;
  const podePlanilha = isAdmin || !!currentUser?.can_planilha;
  const podeLivro    = isAdmin || !!currentUser?.can_livro;
  const userId = currentUser?.id || "";

  const displayCards = isAdmin ? cards : pubCards || [];
  const displayCols = isAdmin ? cols : pubCols || cols;

  // ===== Contagem global de ações pendentes (para o balão) =====
  useEffect(() => {
    if (!currentUser) { setAcoesCount(0); return; }
    let vivo = true;
    async function fetchPendentes() {
      try {
        const rows = await sbGet("acoes_enfermagem", "status=in.(pendente,iniciada,pausada)&select=id");
        if (vivo) setAcoesCount(Array.isArray(rows) ? rows.length : 0);
      } catch(e) {}
    }
    fetchPendentes();
    // Restaurar pendenciasCount do cache local (calculado pelo Dashboard quando montado)
    const cached = loadLS("ge_pend_count", 0);
    if (cached) setPendenciasCount(cached);
    const iv = setInterval(fetchPendentes, 60000);
    return () => { vivo = false; clearInterval(iv); };
  }, [currentUser]);

  // ===== Funções de login/logout =====
  function handleLogin(user) {
    setCurrentUser(user);
  }

  async function handleLogout() {
    await authLogout();
    setCurrentUser(null);
  }

  /* ── Funções de sincronização de snapshots ── */
  async function syncColsToDb(colsToSync) {
    const result = [];
    for (const col of colsToSync) {
      try {
        const created = await fn("columns-write", { action: "create", body: col }, userId);
        result.push(created);
      } catch (e) {
        result.push(col);
      }
    }
    return result;
  }

  async function syncCardsToDb(cardsToSync) {
    const result = [];
    for (const card of cardsToSync) {
      const { id, ...body } = card;
      try {
        const created = await fn("cards-write", { action: "create", body }, userId);
        result.push(created);
      } catch (e) {
        console.error("Erro ao criar card:", e);
        showT("Erro ao sincronizar card: " + e.message, "err");
        result.push(card);
      }
    }
    return result;
  }

  // Aplica um snapshot criando as colunas e cards no Supabase
  async function applySnapshot(cardsData, colsData) {
    setLoading(true);
    const fails = [];
    try {
      const syncedCols = await syncColsToDb(colsData || cols);
      const cardsToSync = cardsData || [];
      const syncedCards = [];
      for (const card of cardsToSync) {
        const { id, ...body } = card;
        try {
          const created = await fn("cards-write", { action: "create", body }, userId);
          syncedCards.push(created);
        } catch (e) {
          fails.push({ nome: card.nome || "(sem nome)", erro: e.message || "erro desconhecido" });
          syncedCards.push(card);
        }
      }
      setCols(syncedCols);
      setCards(syncedCards);
      setShowSnapPanel(false);
      setImportResult({ ok: syncedCards.length - fails.length, total: cardsToSync.length, fails });
    } catch (err) {
      showT("Erro ao aplicar snapshot: " + err.message, "err");
    } finally {
      setLoading(false);
    }
  }

  // Carrega um snapshot do estado local
  function loadSnapshot(snap) {
    applySnapshot(snap.cards, snap.cols);
  }

  // Remove um snapshot do estado e do localStorage
  function deleteSnapshot(id) {
    if (!window.confirm("Remover este snapshot?")) return;
    const updated = snapshots.filter(s => s.id !== id);
    saveLS("ge_snapshots", updated);
    setSnapshots(updated);
    showT("Snapshot removido.");
  }

  // Importa um arquivo JSON
  function importSnapshotFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const snap = JSON.parse(e.target.result);
        applySnapshot(snap.cards, snap.cols);
      } catch (err) {
        showT("Erro ao importar: " + err.message, "err");
      }
    };
    reader.readAsText(file);
  }

  /* ── Demais funções (loadAll, move, etc.) ── */
  useEffect(() => {
    if (!currentUser) return;
    loadAll();
    let last = Date.now();
    const ivUsers = setInterval(async () => {
      if (!isAdmin) return;
      try {
        const rows = await sbGet("users", `status=eq.pendente&created_at=gt.${new Date(last).toISOString()}`);
        if (rows.length) {
          last = Date.now();
          showT(`📋 ${rows.length} novo(s) cadastro(s) aguardando aprovação!`);
        }
      } catch {}
    }, 5000);
    let realtimeChannel = null;
    let lastPubId = null;
    getSbClient().then(sb => {
      realtimeChannel = sb.channel("publications-changes").on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "publications"
      }, payload => {
        const p = payload.new;
        if (!p || p.id === lastPubId) return;
        lastPubId = p.id;
        const isAutoSnap = (p.label || "").includes("automático");
        if (isAutoSnap) return;
        const snap = p.snapshot || {};
        setPubCards(snap.cards || []);
        setPubCols(snap.cols || []);
        setLastPub(new Date(p.created_at).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }));
        if (!isAdmin) showT("🔄 Kanban atualizado pela administradora!");
      }).on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "users"
      }, payload => {
        const u = payload.new;
        if (isAdmin && u?.status === "pendente") showT(`📋 Novo cadastro pendente: ${u.nome}`);
      }).subscribe();
    }).catch(() => {
      const ivPub = setInterval(async () => {
        try {
          const allPubs = await sbGet("publications", "order=created_at.desc&limit=10");
          const pub = allPubs.find(p => !(p.label || "").includes("automático"));
          if (!pub) return;
          if (pub.id === lastPubId) return;
          lastPubId = pub.id;
          const snap = pub.snapshot || {};
          setPubCards(snap.cards || []);
          setPubCols(snap.cols || []);
          setLastPub(new Date(pub.created_at).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          }));
          if (!isAdmin) showT("🔄 Kanban atualizado!");
        } catch {}
      }, 15000);
      return () => clearInterval(ivPub);
    });
    return () => {
      clearInterval(ivUsers);
      if (realtimeChannel) getSbClient().then(sb => sb.removeChannel(realtimeChannel)).catch(() => {});
    };
  }, [currentUser]);

  const knownComIds = useRef(new Set());
  const cardsRef = useRef([]);
  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);
  useEffect(() => {
    if (!currentUser) return;
    Object.values(comments).flat().forEach(c => knownComIds.current.add(c.id));
    let comChannel = null;
    getSbClient().then(sb => {
      comChannel = sb.channel("comments-realtime-" + currentUser.id).on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "comments"
      }, payload => {
        const c = payload.new;
        if (!c || knownComIds.current.has(c.id)) return;
        if (c.autor_id === currentUser.id) {
          knownComIds.current.add(c.id);
          return;
        }
        knownComIds.current.add(c.id);
        setComments(prev => {
          const next = { ...prev };
          const existing = next[c.card_id] || [];
          if (!existing.find(x => x.id === c.id)) next[c.card_id] = [...existing, c];
          return next;
        });
        const cardName = cardsRef.current.find(k => k.id === c.card_id)?.nome || "card";
        setNewComAlerts(prev => [...prev, {
          id: c.id,
          card_id: c.card_id,
          card_nome: cardName,
          autor: c.autor_nome,
          texto: c.texto,
          hora: new Date(c.created_at).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
          })
        }]);
        setShowComPanel(true);
      }).subscribe();
    }).catch(() => {
      const iv = setInterval(async () => {
        try {
          const currentCards = cardsRef.current;
          if (!currentCards.length) return;
          const ids = currentCards.map(x => x.id).join(",");
          const newComs = await sbGet("comments", `card_id=in.(${ids})&order=created_at.desc&limit=30`);
          const toProcess = newComs.filter(c => !knownComIds.current.has(c.id) && c.autor_id !== currentUser.id);
          newComs.forEach(c => knownComIds.current.add(c.id));
          if (toProcess.length) {
            setComments(prev => {
              const next = { ...prev };
              toProcess.forEach(c => {
                const ex = next[c.card_id] || [];
                if (!ex.find(x => x.id === c.id)) next[c.card_id] = [...ex, c];
              });
              return next;
            });
            setNewComAlerts(prev => [...prev, ...toProcess.map(c => ({
              id: c.id,
              card_id: c.card_id,
              card_nome: cardsRef.current.find(k => k.id === c.card_id)?.nome || "card",
              autor: c.autor_nome,
              texto: c.texto,
              hora: new Date(c.created_at).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit"
              })
            }))]);
            setShowComPanel(true);
          }
        } catch {}
      }, 8000);
      return () => clearInterval(iv);
    });
    return () => {
      if (comChannel) getSbClient().then(sb => sb.removeChannel(comChannel)).catch(() => {});
    };
  }, [currentUser]);

  useEffect(() => {
    function handleKey(e) {
      if (!currentUser || !isAdmin) return;
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        newCard();
      }
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        setShowPub(true);
      }
      if (e.key === "Escape") {
        setSelected(null);
        setShowPub(false);
        setShowShare(false);
        setShowSettings(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentUser, isAdmin]);

  async function loadAll() {
    setLoading(true);
    try {
      const [c, cl, s, pub] = await Promise.all([
        sbGet("cards", "order=card_order.asc,created_at.asc"),
        sbGet("columns", "order=col_order.asc"),
        sbGet("settings", "id=eq.1&limit=1"),
        sbGet("publications", "order=created_at.desc&label=not.like.*automático*&limit=10")
      ]);
      setCards(c);
      window.__geCards = c;
      setCols(cl);
      if (s.length) setSettings(s[0]);
      const manualPub = pub.find(p => !(p.label || "").includes("automático"));
      if (manualPub) {
        const snap = manualPub.snapshot;
        setPubCards(snap.cards || []);
        setPubCols(snap.cols || cl);
        setLastPub(new Date(manualPub.created_at).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }));
      }
      if (c.length) {
        const ids = c.map(x => x.id).join(",");
        const coms = await sbGet("comments", `card_id=in.(${ids})&order=created_at.asc`);
        const g = {};
        coms.forEach(cm => {
          g[cm.card_id] = [...(g[cm.card_id] || []), cm];
        });
        setComments(g);
      }
    } catch (e) {
      showT("Erro ao carregar dados.", "err");
    }
    setLoading(false);
    if (isAdmin) setTimeout(() => maybeAutoSnapshot(), 2000);
  }

  async function maybeAutoSnapshot() {
    if (!isAdmin) return;
    const key = "ge_auto_snap_" + new Date().toISOString().split("T")[0];
    if (loadLS(key, false)) return;
    try {
      await fn("publish", { label: "Snapshot automático " + todayStr() }, userId);
      saveLS(key, true);
    } catch {}
  }

  function showT(msg, type = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  }

  /* ── CRUD cards ── */
  async function onSave(form) {
    try {
      const action = form.id === "new" ? "create" : "update";
      // Verificar se justificativa de prioridade mudou para inserir comentário de sistema
      const cardAnterior = cards.find(c => c.id === form.id);
      const justifMudou = form.justificativa_prioridade?.trim() &&
        form.justificativa_prioridade !== cardAnterior?.justificativa_prioridade;
      const data = await fn("cards-write", { action, id: form.id, body: form }, userId);
      if (action === "create") setCards(p => { const next = [...p, data]; window.__geCards = next; return next; });
      else setCards(p => { const next = p.map(c => c.id === form.id ? data : c); window.__geCards = next; return next; });
      // Inserir comentário de sistema com a justificativa
      if (justifMudou && data.id) {
        const textoJustif = "📌 Justificativa da prioridade (P" + form.prioridade_remocao + "): " + form.justificativa_prioridade.trim();
        try {
          const comentario = await fn("comments-write", { action: "create", card_id: data.id, texto: textoJustif, is_system: true }, userId);
          setComments(p => ({ ...p, [data.id]: [...(p[data.id] || []), comentario] }));
        } catch(e) { console.warn("Erro ao registrar justificativa como comentário:", e); }
      }
      showT("Salvo.");
    } catch (ex) {
      showT(ex.message, "err");
    }
    setSelected(null);
  }

  async function onDel(id) {
    if (!window.confirm("Remover este card?")) return;
    await onDelSilent(id);
  }
  async function onDelSilent(id) {
    try {
      const data = await fn("cards-write", { action: "delete", id }, userId);
      const deleted = data.deleted;
      setCards(p => p.filter(c => c.id !== id));
      setSelected(null);
      const timer = setTimeout(async () => {
        setUndoQueue(q => q.filter(x => x.id !== id));
      }, 15000);
      setUndoQueue(q => [...q, { id, card: deleted, timer }]);
    } catch (ex) {
      showT(ex.message, "err");
      throw ex;
    }
  }

  async function onDelAll() {
    if (cards.length === 0) return;
    const conf = window.prompt(`Isso vai excluir TODOS os ${cards.length} cards do Kanban, permanentemente. Digite EXCLUIR para confirmar:`);
    if (conf !== "EXCLUIR") return;
    let ok = 0, fail = 0;
    for (const c of [...cards]) {
      try {
        await fn("cards-write", { action: "delete", id: c.id }, userId);
        ok++;
      } catch (ex) { fail++; }
    }
    setCards([]);
    setSelected(null);
    showT(`${ok} card(s) excluído(s)${fail > 0 ? ` — ${fail} falharam` : ""}.`, fail > 0 ? "err" : "ok");
  }

  async function undoDelete(id) {
    const item = undoQueue.find(x => x.id === id);
    if (!item) return;
    clearTimeout(item.timer);
    setUndoQueue(q => q.filter(x => x.id !== id));
    try {
      const data = await fn("cards-write", { action: "restore", body: item.card }, userId);
      setCards(p => [...p, data]);
      showT("Card restaurado!");
    } catch (ex) {
      showT(ex.message, "err");
    }
  }

  async function moveCard(cardId, newColId, aceiteData) {
    try {
      const data = await fn("cards-move", { card_id: cardId, new_col_id: newColId, aceite: aceiteData || null }, userId);
      setCards(p => { const next = p.map(c => c.id === cardId ? data : c); window.__geCards = next; return next; });
      showT("Card movido.");
    } catch (ex) { showT(ex.message, "err"); }
  }

  function handleMoveAttempt(cardId, newColId) {
    if (newColId === "aceite") {
      const card = cards.find(c => c.id === cardId);
      setPendingMove({ card, newColId });
    } else {
      moveCard(cardId, newColId);
    }
  }

  function handleDragStart(e, cardId) {
    dragId.current = cardId;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(cardId));
    requestAnimationFrame(() => {
      if (e.currentTarget) e.currentTarget.style.opacity = ".35";
    });
  }
  function handleDragEnd(e) {
    dragId.current = null;
    if (e.currentTarget) e.currentTarget.style.opacity = "1";
    document.querySelectorAll("[data-dropzone]").forEach(z => {
      z.style.borderColor = "#E2E8F0";
      z.style.boxShadow = "none";
    });
    dragOverCol.current = null;
  }
  function handleDrop(e, colId) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId.current;
    if (!id) return;
    handleMoveAttempt(id, colId);
  }
  function handleDragOver(e, colId) {
    e.preventDefault();
    if (dragOverCol.current === colId) return;
    if (dragOverCol.current) {
      const p = document.querySelector(`[data-dropzone="${dragOverCol.current}"]`);
      if (p) {
        p.style.borderColor = "#E2E8F0";
        p.style.boxShadow = "none";
      }
    }
    dragOverCol.current = colId;
    const el = document.querySelector(`[data-dropzone="${colId}"]`);
    if (el) {
      el.style.borderColor = "#3B82F6";
      el.style.boxShadow = "0 0 0 3px rgba(59,130,246,.15)";
    }
  }
  function handleDragLeave(e, colId) {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    const el = document.querySelector(`[data-dropzone="${colId}"]`);
    if (el) {
      el.style.borderColor = "#E2E8F0";
      el.style.boxShadow = "none";
    }
    if (dragOverCol.current === colId) dragOverCol.current = null;
  }

  /* ── Reordenar colunas ── */
  function handleColDragStart(e, colId) {
    dragColId.current = colId;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/col", colId);
    requestAnimationFrame(function(){ if(e.currentTarget) e.currentTarget.style.opacity=".45"; });
  }
  function handleColDragEnd(e) { dragColId.current=null; if(e.currentTarget) e.currentTarget.style.opacity="1"; }
  async function handleColDrop(e, targetColId) {
    e.preventDefault(); e.stopPropagation();
    var srcId=dragColId.current||e.dataTransfer.getData("text/col");
    if(!srcId||srcId===targetColId) return;
    var arr=cols.slice(), si=arr.findIndex(function(c){return c.id===srcId;}), ti=arr.findIndex(function(c){return c.id===targetColId;});
    if(si<0||ti<0) return;
    var moved=arr.splice(si,1)[0]; arr.splice(ti,0,moved); setCols(arr);
    showT("Colunas reordenadas. A ordem será salva ao publicar.");
  }

  /* ── Discrepâncias (Caso A): menor grav com aceite, mesma especialidade, sem prioridade médica ── */
  const GRAV_PESO_D = {emergencia:1,urgencia:2,andamento_cor:3,menor_gravidade:4,agendamento:99,retorno:99,finalizado_cor:99};
  const discrepancias = useMemo(function(){
    if(!isAdmin) return [];
    var ac=cards.filter(function(c){return c.col_id==="aceite"&&c.rec&&c.rec.trim()&&!c.prioridade_remocao;});
    var pe=cards.filter(function(c){return c.col_id==="pendente"&&c.rec&&c.rec.trim();});
    var out=[];
    ac.forEach(function(a){
      var pA=GRAV_PESO_D[a.grav]||99;
      pe.forEach(function(b){
        if(a.id===b.id) return;
        if(a.rec.trim().toUpperCase()!==b.rec.trim().toUpperCase()) return;
        var pB=GRAV_PESO_D[b.grav]||99;
        if(pA>pB) out.push({id:a.id+"_"+b.id,aceitado:a,pendente:b});
      });
    });
    return out;
  },[cards,isAdmin]);

  /* ── Comments ── */
  async function onAddComment(cardId, texto) {
    if (!userId) { showT("Faça login para comentar.", "err"); return; }
    try {
      const data = await fn("comments-write", { action: "create", card_id: cardId, texto }, userId);
      setComments(p => ({ ...p, [cardId]: [...(p[cardId] || []), data] }));
    } catch (ex) {
      showT("Erro ao comentar: " + ex.message, "err");
    }
  }
  async function onDelComment(commentId, cardId) {
    try {
      await fn("comments-write", { action: "delete", id: commentId }, userId);
      setComments(p => ({ ...p, [cardId]: (p[cardId] || []).filter(c => c.id !== commentId) }));
    } catch (ex) {
      showT(ex.message, "err");
    }
  }

  /* ── Publish ── */
  async function onPub() {
    try {
      await fn("publish", {}, userId);
      const pub = await sbGet("publications", "order=created_at.desc&limit=1");
      if (pub.length) {
        const snap = pub[0].snapshot;
        setPubCards(snap.cards || []);
        setPubCols(snap.cols || cols);
        setLastPub(new Date(pub[0].created_at).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }));
      }
      setShowPub(false);
      showT("✅ Publicado!");
    } catch (ex) {
      showT(ex.message, "err");
    }
  }

  /* ── Columns ── */
  async function addColumn() {
    const name = newColName.trim();
    if (!name) return;
    const id = "col_" + Date.now();
    try {
      const data = await fn("columns-write", {
        action: "create",
        body: { id, label: name, sub: "", emoji: "📌", col_order: cols.length + 1, accent: "#94A3B8" }
      }, userId);
      setCols(p => [...p, data]);
      setNewColName("");
      setShowNewCol(false);
      showT(`Coluna "${name}" criada.`);
    } catch (ex) {
      showT(ex.message, "err");
    }
  }
  async function removeColumn(id) {
    if (cols.find(c => c.id === id)?.fixed) {
      showT("Coluna fixa.", "err");
      return;
    }
    try {
      await fn("columns-write", { action: "delete", id }, userId);
      setCols(p => p.filter(c => c.id !== id));
      setCards(p => p.map(c => c.col_id === id ? { ...c, col_id: "pendente" } : c));
      showT("Coluna removida.");
    } catch (ex) {
      showT(ex.message, "err");
    }
  }

  /* ── Settings ── */
  async function saveSettings(form) {
    try {
      await fn("settings-write", form, userId);
      setSettings(s => ({ ...s, ...form }));
      setShowSettings(false);
      showT("Configurações salvas.");
    } catch (ex) {
      showT(ex.message, "err");
    }
  }

  /* ── Export functions ── */
  async function exportPNG(targetView) {
    showT("Gerando imagem...");
    if (targetView && targetView !== "kanban") {
      const el = document.getElementById("view-content");
      if (!el) { showT("Nada para capturar.", "err"); return; }
      try {
        const canvas = await html2canvas(el, { scale: 3, backgroundColor: "#F1F5F9", useCORS: true, logging: false });
        const a = document.createElement("a");
        a.href = canvas.toDataURL("image/png");
        a.download = "ge-" + targetView + "-" + new Date().toLocaleDateString("pt-BR").replace(/\//g, "-") + ".png";
        a.click();
        showT("PNG exportado!");
      } catch (e) {
        showT("Erro: " + e.message, "err");
      }
      return;
    }
    showT("Gerando imagem do Kanban completo...");
    try {
      const wrap = document.createElement("div");
      wrap.style.cssText = "position:fixed;left:-9999px;top:0;background:#F1F5F9;padding:20px;display:flex;gap:10px;align-items:flex-start;font-family:Inter,system-ui,sans-serif;min-width:max-content;";
      const colsToRender = isAdmin ? cols : pubCols || cols;
      const cardsToRender = isAdmin ? cards : pubCards || [];
      colsToRender.forEach(col => {
        const colCards = cardsToRender.filter(c => c.col_id === col.id);
        const colDiv = document.createElement("div");
        colDiv.style.cssText = "background:#fff;border-radius:10px;border:1px solid #E2E8F0;width:240px;flex-shrink:0;overflow:visible;border-top:3px solid " + (col.accent || "#94A3B8") + ";";
        const hdr = document.createElement("div");
        hdr.style.cssText = "padding:10px 12px;border-bottom:1px solid #F1F5F9;";
        hdr.innerHTML = "<div style='font-weight:700;font-size:12px;color:#0F172A;'>" + (col.emoji || "") + " " + col.label + "</div>" +
          "<div style='font-size:9px;color:#94A3B8;margin-top:1px;'>" + (col.sub || "") + "</div>" +
          "<span style='display:inline-block;background:#F1F5F9;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;color:#475569;margin-top:5px;'>" + colCards.length + "</span>";
        colDiv.appendChild(hdr);
        const body = document.createElement("div");
        body.style.cssText = "padding:8px;";
        colCards.forEach(c => {
          const gc = { emergencia:"#EF4444", urgencia:"#EAB308", andamento_cor:"#F59E0B", menor_gravidade:"#22C55E", finalizado_cor:"#A855F7", agendamento:"#94A3B8", retorno:"#EC4899" };
          const dot = gc[c.grav] || "#EAB308";
          const card = document.createElement("div");
          card.style.cssText = "background:#fff;border:1px solid #E2E8F0;border-left:3px solid " + dot + ";border-radius:8px;padding:9px 10px;margin-bottom:6px;";
          let html = "";
          if (c.pr) html += "<div style='font-size:9px;font-weight:700;color:#94A3B8;margin-bottom:1px;'>#" + c.pr + "</div>";
          html += "<div style='font-weight:600;font-size:12px;color:#0F172A;margin-bottom:4px;'>" + (c.is_rn ? "👶 " : "") + c.nome + "</div>";
          if (c.hd) html += "<div style='font-size:11px;color:#374151;margin-bottom:3px;'><span style='color:#CBD5E1;'>HD: </span>" + c.hd + "</div>";
          if (c.setor || c.rec) html += "<div style='display:flex;gap:4px;flex-wrap:wrap;margin-bottom:3px;'>" +
            (c.setor ? "<span style='font-size:10px;background:#F1F5F9;color:#475569;padding:1px 5px;border-radius:3px;'>" + c.setor + "</span>" : "") +
            (c.rec ? "<span style='font-size:10px;background:#EFF6FF;color:#1E40AF;padding:1px 5px;border-radius:3px;'>" + c.rec + "</span>" : "") + "</div>";
          if (c.hosp) html += "<div style='font-size:10px;color:#64748B;'>→ <strong>" + c.hosp + "</strong></div>";
          if (c.cross_info) html += "<div style='font-size:10px;color:#94A3B8;margin-top:2px;'>Cross: " + c.cross_info + "</div>";
          if (c.receptor) html += "<div style='font-size:10px;color:#16A34A;margin-top:2px;'>Receptor: " + c.receptor + "</div>";
          if (c.status) html += "<div style='font-size:9px;font-weight:700;color:#64748B;margin-top:3px;text-transform:uppercase;'>" + c.status + "</div>";
          card.innerHTML = html;
          body.appendChild(card);
        });
        colDiv.appendChild(body);
        wrap.appendChild(colDiv);
      });
      document.body.appendChild(wrap);
      await new Promise(r => setTimeout(r, 100));
      const canvas = await html2canvas(wrap, {
        scale: 3,
        backgroundColor: "#F1F5F9",
        useCORS: true,
        logging: false,
        width: wrap.scrollWidth,
        height: wrap.scrollHeight,
        windowWidth: wrap.scrollWidth,
        windowHeight: wrap.scrollHeight
      });
      document.body.removeChild(wrap);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = "kanban-" + new Date().toLocaleDateString("pt-BR").replace(/\//g, "-") + ".png";
      a.click();
      showT("PNG exportado com sucesso!");
    } catch (e) {
      showT("Erro ao gerar PNG: " + e.message, "err");
    }
  }

  async function exportExcel() {
    showT("Gerando Excel...");
    try {
      if (!window.XLSX) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
          s.onload = res;
          s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      const colsData = isAdmin ? cols : pubCols || cols;
      const cardsData = isAdmin ? cards : pubCards || [];
      const colLabel = colsData.reduce((acc, c) => ({ ...acc, [c.id]: c.label }), {});
      const str = v => v === null || v === undefined || v === false ? "" : v === true ? "Sim" : String(v);
      const GRAV_LABEL = { emergencia:"Emergência", urgencia:"Urgência", andamento_cor:"Em andamento", menor_gravidade:"Menor gravidade", finalizado_cor:"Finalizado", agendamento:"Agendamento", retorno:"Retorno" };
      const CAT_LABEL = { normal:"Normal", pediatria:"Pediatria", psiquiatria:"Psiquiatria", obstetricia:"Obstetrícia" };
      const rows = cardsData.map(c => ({
        "Coluna": str(colLabel[c.col_id] || c.col_id),
        "Prioridade": str(c.pr),
        "Status": str(c.status),
        "Categoria": str(CAT_LABEL[c.categoria] || "Normal"),
        "RN": c.is_rn ? "Sim" : "Não",
        "Nome": str(c.nome),
        "Idade": str(c.idade),
        "Admissão": str(c.adm),
        "HD": str(c.hd),
        "Setor/Leito": str(c.setor),
        "Recurso": str(c.rec),
        "Hospital": str(c.hosp),
        "Ambulância": str(c.amb),
        "Cross": str(c.cross_info),
        "Receptor": str(c.receptor),
        "Data Aceite": str(c.data_aceite),
        "Hora Aceite": str(c.hora_aceite),
        "Gravidade": str(GRAV_LABEL[c.grav] || c.grav),
        "Observações": str(c.obs),
        "Saída": str(c.saida),
        "Retorno": str(c.retorno),
        "Criado em": c.created_at ? new Date(c.created_at).toLocaleString("pt-BR") : ""
      }));
      const ws = window.XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [{wch:22},{wch:10},{wch:22},{wch:12},{wch:5},{wch:30},{wch:8},{wch:10},{wch:30},{wch:16},{wch:18},{wch:15},{wch:12},{wch:22},{wch:20},{wch:12},{wch:10},{wch:18},{wch:30},{wch:10},{wch:10},{wch:20}];
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, "Kanban", ws);
      const dateStr = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
      window.XLSX.writeFile(wb, "kanban-" + dateStr + ".xlsx");
      showT("Excel exportado!");
    } catch (e) {
      showT("Erro ao gerar Excel: " + e.message, "err");
    }
  }

  async function generatePDF(mode) {
    showT("Gerando PDF...");
    try {
      if (!window.jspdf) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
          s.onload = res;
          s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      const { jsPDF } = window.jspdf;
      const colsData = isAdmin ? cols : pubCols || cols;
      const cardsData = isAdmin ? cards : pubCards || [];
      const dateStr = new Date().toLocaleDateString("pt-BR");
      const timeStr = new Date().toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" });
      if (mode === "text") {
        const doc = new jsPDF({ unit: "mm", format: "a4" });
        const PW = 190;
        let y = 15;
        const LHEIGHT = 5;
        function addLine(text, opts = {}) {
          const { size = 10, bold = false, color = [0,0,0], indent = 0 } = opts;
          doc.setFontSize(size);
          doc.setFont("helvetica", bold ? "bold" : "normal");
          doc.setTextColor(...color);
          const lines = doc.splitTextToSize(text, PW - indent);
          lines.forEach(l => {
            if (y > 275) { doc.addPage(); y = 15; }
            doc.text(l, 10 + indent, y);
            y += LHEIGHT + (size > 10 ? 1 : 0);
          });
        }
        function sep(color = [200,200,200]) {
          if (y > 275) { doc.addPage(); y = 15; }
          doc.setDrawColor(...color);
          doc.line(10, y, 200, y);
          y += 3;
        }
        const COL_COLORS = { pendente:[245,158,11], aceite:[59,130,246], psiquiatria:[139,92,246], andamento:[239,68,68], finalizado:[107,114,128] };
        const GRAV_COLORS = { emergencia:[239,68,68], urgencia:[234,179,8], andamento_cor:[245,158,11], menor_gravidade:[34,197,94], finalizado_cor:[168,85,247], retorno:[236,72,153], agendamento:[148,163,184] };
        addLine("GERENCIA DE ENFERMAGEM", { size:16, bold:true, color:[15,23,42] });
        addLine("Data: " + dateStr + "  Hora: " + timeStr, { size:9, color:[100,116,139] });
        y += 3; sep([59,130,246]); y += 2;
        colsData.forEach(col => {
          const cc = cardsData.filter(c => c.col_id === col.id);
          if (!cc.length) return;
          const colColor = COL_COLORS[col.id] || [100,116,139];
          y += 3;
          doc.setFillColor(...colColor);
          doc.roundedRect(10, y-4, PW, 8, 2, 2, "F");
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(255,255,255);
          doc.text(col.label.toUpperCase() + "  (" + cc.length + " paciente" + (cc.length!==1?"s":"") + ")", 14, y+1);
          y += 8;
          cc.forEach((c, idx) => {
            if (y > 268) { doc.addPage(); y = 15; }
            const gravColor = GRAV_COLORS[c.grav] || [234,179,8];
            const cardStartY = y;
            doc.setFillColor(...gravColor);
            doc.rect(10, cardStartY, 2, 1, "F");
            const prTxt = c.pr ? "[P"+c.pr+"] " : "";
            const rnTxt = c.is_rn ? "[RN] " : "";
            addLine(prTxt + rnTxt + c.nome, { size:10, bold:true, indent:4 });
            if (c.idade || c.adm) addLine((c.idade||"") + (c.idade&&c.adm?" | ":"") + (c.adm?"Adm: "+c.adm:""), { size:8, color:[100,116,139], indent:4 });
            if (c.hd) addLine("HD: " + c.hd, { size:9, indent:4 });
            if (c.setor) addLine("Local: " + c.setor, { size:8, color:[71,85,105], indent:4 });
            const ambTxt = c.amb ? c.amb.includes("Av") ? "Amb. Avancada" : "Amb. Basica" : "";
            if (c.rec && c.hosp) addLine("Enc: " + c.rec + " -> " + c.hosp + (ambTxt ? " | " + ambTxt : ""), { size:8, indent:4 });
            else if (c.rec) addLine("Rec: " + c.rec + (ambTxt ? " | " + ambTxt : ""), { size:8, indent:4 });
            if (c.cross_info) addLine("Cross: " + c.cross_info, { size:8, color:[100,116,139], indent:4 });
            if (c.receptor) addLine("Receptor: " + c.receptor + (c.data_aceite ? " | " + c.data_aceite : "") + (c.hora_aceite ? " as " + c.hora_aceite : ""), { size:8, color:[22,163,74], indent:4 });
            if (c.status) addLine(c.status, { size:8, bold:true, color:[100,116,139], indent:4 });
            doc.setFillColor(...gravColor);
            doc.rect(10, cardStartY, 2, y-cardStartY, "F");
            y += 2;
            if (idx < cc.length - 1) sep();
          });
          y += 4;
        });
        sep([59,130,246]); y += 2;
        addLine("RESUMO", { size:10, bold:true, color:[15,23,42] });
        addLine("Total: " + cardsData.length + " pacientes", { size:9 });
        colsData.forEach(col => {
          const n = cardsData.filter(c => c.col_id === col.id).length;
          if (n > 0) addLine(col.label + ": " + n, { size:9, indent:4 });
        });
        doc.save("kanban-" + dateStr.replace(/\//g, "-") + ".pdf");
        showT("PDF de texto gerado!");
      } else {
        const wrap = document.createElement("div");
        wrap.style.cssText = "position:fixed;left:-9999px;top:0;background:#F1F5F9;padding:20px;display:flex;gap:10px;align-items:flex-start;font-family:Inter,system-ui,sans-serif;min-width:max-content;";
        colsData.forEach(col => {
          const colCards = cardsData.filter(c => c.col_id === col.id);
          const colDiv = document.createElement("div");
          colDiv.style.cssText = "background:#fff;border-radius:10px;border:1px solid #E2E8F0;width:220px;flex-shrink:0;border-top:3px solid " + (col.accent || "#94A3B8") + ";";
          const hdr = document.createElement("div");
          hdr.style.cssText = "padding:10px 12px;border-bottom:1px solid #F1F5F9;";
          hdr.innerHTML = "<div style='font-weight:700;font-size:11px;color:#0F172A;'>" + (col.emoji || "") + " " + col.label + "</div><span style='display:inline-block;background:#F1F5F9;padding:2px 7px;border-radius:99px;font-size:9px;font-weight:700;color:#475569;margin-top:4px;'>" + colCards.length + "</span>";
          colDiv.appendChild(hdr);
          const body = document.createElement("div");
          body.style.cssText = "padding:6px;";
          const gc2 = { emergencia:"#EF4444", urgencia:"#EAB308", andamento_cor:"#F59E0B", menor_gravidade:"#22C55E", finalizado_cor:"#A855F7", agendamento:"#94A3B8", retorno:"#EC4899" };
          colCards.forEach(c => {
            const dot = gc2[c.grav] || "#EAB308";
            const card = document.createElement("div");
            card.style.cssText = "background:#fff;border:1px solid #E2E8F0;border-left:3px solid " + dot + ";border-radius:7px;padding:8px;margin-bottom:5px;";
            let html = "";
            if (c.pr) html += "<div style='font-size:8px;font-weight:700;color:#94A3B8;'>#" + c.pr + "</div>";
            html += "<div style='font-weight:600;font-size:11px;color:#0F172A;margin-bottom:3px;'>" + (c.is_rn ? "RN: " : "") + c.nome + "</div>";
            if (c.hd) html += "<div style='font-size:9px;color:#374151;margin-bottom:2px;'>" + c.hd + "</div>";
            if (c.setor || c.rec) html += "<div style='font-size:8px;color:#64748B;'>" + [c.setor,c.rec].filter(Boolean).join(" | ") + "</div>";
            if (c.hosp) html += "<div style='font-size:8px;color:#64748B;'>→ " + c.hosp + "</div>";
            if (c.receptor) html += "<div style='font-size:8px;color:#16A34A;'>Receptor: " + c.receptor + "</div>";
            if (c.status) html += "<div style='font-size:8px;font-weight:700;color:#475569;text-transform:uppercase;margin-top:2px;'>" + c.status + "</div>";
            card.innerHTML = html;
            body.appendChild(card);
          });
          colDiv.appendChild(body);
          wrap.appendChild(colDiv);
        });
        document.body.appendChild(wrap);
        await new Promise(r => setTimeout(r, 150));
        const canvas = await html2canvas(wrap, {
          scale: 2,
          backgroundColor: "#F1F5F9",
          useCORS: true,
          logging: false,
          width: wrap.scrollWidth,
          height: wrap.scrollHeight,
          windowWidth: wrap.scrollWidth,
          windowHeight: wrap.scrollHeight
        });
        document.body.removeChild(wrap);
        const imgData = canvas.toDataURL("image/png");
        const imgW = canvas.width, imgH = canvas.height;
        const orient = imgW > imgH ? "l" : "p";
        const doc2 = new jsPDF({ orientation: orient, unit: "px", format: [imgW/2, imgH/2] });
        doc2.addImage(imgData, "PNG", 0, 0, imgW/2, imgH/2);
        doc2.save("kanban-visual-" + dateStr.replace(/\//g, "-") + ".pdf");
        showT("PDF visual gerado!");
      }
    } catch (e) {
      showT("Erro ao gerar PDF: " + e.message, "err");
    }
  }

  function saveSnapshot() {
    const colsData = isAdmin ? cols : pubCols || cols;
    const cardsData = isAdmin ? cards : pubCards || [];
    const snap = {
      id: Date.now(),
      label: "Snapshot " + todayStr() + " " + nowStr(),
      date: new Date().toISOString(),
      cards: cardsData,
      cols: colsData
    };
    const list = loadLS("ge_snapshots", []);
    const updated = [snap, ...list].slice(0, 20);
    saveLS("ge_snapshots", updated);
    setSnapshots(updated);
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const now = new Date();
    const pad = n => String(n).padStart(2, "0");
    const fname = `kanban-${pad(now.getDate())}-${pad(now.getMonth()+1)}-${now.getFullYear()}-${pad(now.getHours())}-${pad(now.getMinutes())}.json`;
    a.download = fname;
    a.click();
    URL.revokeObjectURL(a.href);
    showT("💾 Snapshot salvo e baixado!");
  }

  function newCard(col = "pendente") {
    setSelected({
      id: "new",
      col_id: col,
      pr: "",
      status: "",
      nome: "",
      idade: "",
      adm: "",
      hd: "",
      setor: "",
      rec: "",
      hosp: "",
      cross_info: "",
      amb: "Básica",
      saida: "",
      retorno: "",
      grav: "urgencia",
      obs: "",
      is_rn: false,
      receptor: "",
      data_aceite: "",
      hora_aceite: "",
      categoria: "normal"
    });
  }

  const filtered = displayCards.filter(c => {
    const q = search.toLowerCase();
    const ms = !q || [c.nome, c.hd, c.setor, c.rec, c.hosp].some(s => (s || "").toLowerCase().includes(q));
    return ms && (fGrav === "all" || c.grav === fGrav);
  });

  function toggleSort(key) {
    setSortCol(p => p?.key === key ? p.dir === "asc" ? { key, dir: "desc" } : null : { key, dir: "asc" });
  }
  const sortedFiltered = sortCol ? [...filtered].sort((a,b) => {
    const av = (a[sortCol.key] || "").toString().toLowerCase(), bv = (b[sortCol.key] || "").toString().toLowerCase();
    return sortCol.dir === "asc" ? av.localeCompare(bv, "pt") : bv.localeCompare(av, "pt");
  }) : filtered;

  // ===== Renderização =====
  if (bootAuth) return /*#__PURE__*/React.createElement("div", {
    style: { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#F1F5F9", color:"#94A3B8", fontSize:13 }
  }, "Carregando…");

  if (!currentUser) return /*#__PURE__*/React.createElement(React.Fragment, null,
    /*#__PURE__*/React.createElement(LoginScreen, { onLogin: handleLogin, showT: showT }),
    /*#__PURE__*/React.createElement(Toast, { toast: toast })
  );

  // Gate da senha inicial: nada do app renderiza antes da troca.
  if (currentUser.senha_trocada === false) return /*#__PURE__*/React.createElement(React.Fragment, null,
    /*#__PURE__*/React.createElement(TrocaSenhaScreen, {
      user: currentUser, onPronto: setCurrentUser, onSair: handleLogout
    }),
    /*#__PURE__*/React.createElement(Toast, { toast: toast })
  );

  // Funções de navegação
  const NavBtn = ({ id, label }) => /*#__PURE__*/React.createElement("button", {
    onClick: () => setView(id),
    style: {
      padding: "5px 14px",
      borderRadius: 6,
      border: "none",
      fontSize: 12,
      fontWeight: view === id ? 600 : 400,
      background: view === id ? "#0F172A" : "transparent",
      color: view === id ? "#fff" : "#64748B",
      cursor: "pointer",
      transition: "all .15s",
      flexShrink: 0,
      whiteSpace: "nowrap"
    }
  }, label);

  function KanbanDropdown({ view, setView }) {
    const [open, setOpen] = React.useState(false);
    const [pos, setPos] = React.useState({ top: 0, left: 0 });
    const btnRef = React.useRef(null);
    const SUB = [["lista","📄 Lista"],["calendario","📅 Calendário"],["timeline","⏱ Linha do Tempo"]];
    const isSubView = SUB.some(s => s[0] === view);
    const activeLabel = isSubView ? SUB.find(s => s[0] === view)[1] : "📋 Kanban";
    function handleEnter() {
      if (btnRef.current) {
        const r = btnRef.current.getBoundingClientRect();
        setPos({ top: r.bottom + 2, left: r.left });
      }
      setOpen(true);
    }
    return /*#__PURE__*/React.createElement("div", {
      style: { position:"relative", display:"inline-block", flexShrink: 0 },
      onMouseEnter: handleEnter,
      onMouseLeave: () => setOpen(false)
    },
      /*#__PURE__*/React.createElement("button", {
        ref: btnRef,
        onClick: () => setView("kanban"),
        style: {
          padding:"5px 14px", borderRadius:6, border:"none", fontSize:12,
          fontWeight: view==="kanban"||isSubView ? 600 : 400,
          background: view==="kanban"||isSubView ? "#0F172A" : "transparent",
          color: view==="kanban"||isSubView ? "#fff" : "#64748B",
          cursor:"pointer", display:"inline-flex", alignItems:"center", gap:4, fontFamily:"inherit"
        }
      }, activeLabel, " ▾"),
      open && ReactDOM.createPortal(
        /*#__PURE__*/React.createElement("div", {
          onMouseEnter: () => setOpen(true),
          onMouseLeave: () => setOpen(false),
          style: {
            position:"fixed", top: pos.top, left: pos.left, zIndex:99999,
            background:"#fff", border:"1px solid #E2E8F0", borderRadius:10,
            boxShadow:"0 8px 24px rgba(0,0,0,.12)", padding:"4px 0", minWidth:168
          }
        },
        /*#__PURE__*/React.createElement("div", { style:{padding:"5px 14px 4px",fontSize:9,fontWeight:700,color:"#CBD5E1",textTransform:"uppercase",letterSpacing:".06em"} }, "Outras visualizações"),
        SUB.map(([id,label]) => /*#__PURE__*/React.createElement("button", {
          key: id,
          onClick: () => { setView(id); setOpen(false); },
          style: {
            display:"flex", alignItems:"center", gap:8, width:"100%",
            padding:"8px 14px", border:"none",
            background: view===id ? "#F1F5F9" : "transparent",
            fontSize:13, fontWeight: view===id ? 600 : 400,
            color: view===id ? "#0F172A" : "#374151",
            cursor:"pointer", textAlign:"left", fontFamily:"inherit"
          },
          onMouseEnter: e => e.currentTarget.style.background="#F8FAFC",
          onMouseLeave: e => e.currentTarget.style.background=view===id?"#F1F5F9":"transparent"
        }, label)),
        /*#__PURE__*/React.createElement("div", { style:{height:1,background:"#F1F5F9",margin:"3px 0"} }),
        /*#__PURE__*/React.createElement("button", {
          onClick: () => { setView("kanban"); setOpen(false); },
          style: {
            display:"flex", alignItems:"center", gap:8, width:"100%",
            padding:"8px 14px", border:"none",
            background: view==="kanban" ? "#F1F5F9" : "transparent",
            fontSize:13, fontWeight: view==="kanban" ? 600 : 400,
            color: view==="kanban" ? "#0F172A" : "#374151",
            cursor:"pointer", textAlign:"left", fontFamily:"inherit"
          },
          onMouseEnter: e => e.currentTarget.style.background="#F8FAFC",
          onMouseLeave: e => e.currentTarget.style.background=view==="kanban"?"#F1F5F9":"transparent"
        }, "📋 Kanban")
      ), document.body)
    );
  }

  return /*#__PURE__*/React.createElement("div", {
    style: { minHeight: "100vh", background: "#F1F5F9", fontFamily: "'Inter',system-ui,sans-serif" }
  },
    /* Cabeçalho */
    /*#__PURE__*/React.createElement("div", {
      style: { background: "#0F172A", padding: "0 20px", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 12px rgba(0,0,0,.2)" }
    },
      /*#__PURE__*/React.createElement("div", {
        style: { maxWidth: 1600, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 52, flexWrap: "wrap", gap: 6, padding: "6px 0" }
      },
        /*#__PURE__*/React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
          /*#__PURE__*/React.createElement("div", { style: { width: 30, height: 30, borderRadius: 8, background: "#1E40AF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } },
            /*#__PURE__*/React.createElement("span", { style: { color: "#fff", fontSize: 14, fontWeight: 700 } }, "+")
          ),
          /*#__PURE__*/React.createElement("div", null,
            /*#__PURE__*/React.createElement("div", { style: { fontWeight: 700, fontSize: 14, color: "#fff", letterSpacing: "-.01em" } }, "Gerência de Enfermagem"),
            /*#__PURE__*/React.createElement("div", { style: { fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: ".08em" } }, isAdmin ? "modo de edição · " + currentUser.nome : "visualização · " + currentUser.nome)
          )
        ),
        /*#__PURE__*/React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
          isAdmin && /*#__PURE__*/React.createElement("button", { onClick: () => setShowShare(true), style: { padding: "6px 12px", border: "none", borderRadius: 7, background: "#25D366", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700 } }, "📤 WhatsApp"),
          isAdmin && /*#__PURE__*/React.createElement("button", { onClick: () => setShowPub(true), style: { padding: "6px 14px", border: "none", borderRadius: 7, background: "#16A34A", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700 } }, "↑ Publicar"),
          newComAlerts.length > 0 && /*#__PURE__*/React.createElement("button", {
            onClick: () => setShowComPanel(true),
            style: { padding: "5px 10px", border: "none", borderRadius: 7, background: "#3B82F6", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700, position: "relative", display: "flex", alignItems: "center", gap: 5 }
          }, "💬", /*#__PURE__*/React.createElement("span", { style: { background: "#EF4444", color: "#fff", borderRadius: 99, fontSize: 9, fontWeight: 800, padding: "1px 5px", minWidth: 16, textAlign: "center" } }, newComAlerts.length)),
          /*#__PURE__*/React.createElement("button", { onClick: () => setShowInstall(true), title: "Instalar app", style: { padding: "6px 10px", border: "1px solid #334155", borderRadius: 7, background: "none", color: "#94A3B8", cursor: "pointer", fontSize: 12 } }, "📲"),
          /*#__PURE__*/React.createElement("button", { onClick: () => setShowSettings(true), style: { padding: "6px 10px", border: "1px solid #334155", borderRadius: 7, background: "none", color: "#64748B", cursor: "pointer", fontSize: 12 } }, "⚙"),
          currentUser.foto ? /*#__PURE__*/React.createElement("img", { src: currentUser.foto, style: { width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: "2px solid #334155", cursor: "pointer" }, onClick: handleLogout, title: "Sair" }) :
          /*#__PURE__*/React.createElement("button", { onClick: handleLogout, style: { padding: "5px 11px", border: "1px solid #334155", borderRadius: 7, background: "none", color: "#64748B", cursor: "pointer", fontSize: 11 } }, "Sair")
        )
      )
    ),
    /* Banner edição / visualização */
    isAdmin && /*#__PURE__*/React.createElement("div", {
      style: { background: "#FFFBEB", borderBottom: "1px solid #FDE68A" }
    },
      /* Linha de título clicável no mobile */
      /*#__PURE__*/React.createElement("div", {
        onClick: () => setBannerOpen(o => !o),
        style: { padding: "5px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer" }
      },
        /*#__PURE__*/React.createElement("span", { style: { fontSize: 11, color: "#92400E", fontWeight: 500 } }, "✎ Modo de edição", lastPub ? ` · ${lastPub}` : ""),
        /*#__PURE__*/React.createElement("span", { style: { fontSize: 11, color: "#92400E", transition: "transform .2s", display: "inline-block", transform: bannerOpen ? "rotate(180deg)" : "rotate(0deg)" } }, "▾")
      ),
      /* Conteúdo expandível */
      bannerOpen && /*#__PURE__*/React.createElement("div", { style: { padding: "0 20px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" } },
      /*#__PURE__*/React.createElement("div", { style: { display: "flex", gap: 6, alignItems: "center" } },
        /*#__PURE__*/React.createElement("div", { style: { display: "flex", gap: 6 } },
          /*#__PURE__*/React.createElement("button", { onClick: saveSnapshot, style: { padding: "3px 10px", border: "1px solid #FDE68A", borderRadius: 5, background: "none", color: "#92400E", cursor: "pointer", fontSize: 11, fontWeight: 600 } }, "💾 Salvar"),
          /*#__PURE__*/React.createElement("button", { onClick: () => setShowSnapPanel(true), style: { padding: "3px 10px", border: "1px solid #FDE68A", borderRadius: 5, background: "none", color: "#92400E", cursor: "pointer", fontSize: 11 } }, "📂 Carregar (", snapshots.length, ")"),
          /*#__PURE__*/React.createElement("button", { onClick: () => setShowDuplicates(true), title: "Verificar pacientes com nomes repetidos", style: { padding: "3px 10px", border: "1px solid #FDE68A", borderRadius: 5, background: "none", color: "#92400E", cursor: "pointer", fontSize: 11 } }, "🔍 Duplicatas"),
          /*#__PURE__*/React.createElement("button", { onClick: onDelAll, title: "Excluir todos os cards do Kanban", style: { padding: "3px 10px", border: "1px solid #FCA5A5", borderRadius: 5, background: "none", color: "#B91C1C", cursor: "pointer", fontSize: 11, fontWeight: 600 } }, "🗑 Limpar todos os cards")
        ),
        /*#__PURE__*/React.createElement("span", { style: { fontSize: 10, color: "#92400E" } }, "Atalhos: ", /*#__PURE__*/React.createElement("kbd", { style: { background: "#FDE68A", padding: "1px 4px", borderRadius: 3, fontFamily: "monospace" } }, "N"), " novo paciente\u00A0", /*#__PURE__*/React.createElement("kbd", { style: { background: "#FDE68A", padding: "1px 4px", borderRadius: 3, fontFamily: "monospace" } }, "P"), " publicar\u00A0", /*#__PURE__*/React.createElement("kbd", { style: { background: "#FDE68A", padding: "1px 4px", borderRadius: 3, fontFamily: "monospace" } }, "Esc"), " fechar")
      )
      )
    ),
    !isAdmin && /*#__PURE__*/React.createElement("div", {
      style: { background: "#EFF6FF", borderBottom: "1px solid #BFDBFE", padding: "5px 20px", display: "flex", alignItems: "center", gap: 8 }
    },
      /*#__PURE__*/React.createElement("span", { style: { fontSize: 11, color: "#1E40AF", fontWeight: 500 } }, "👁 Visualização somente leitura", lastPub ? ` · Publicado em: ${lastPub}` : "")
    ),
    showAcoes && React.createElement(AcoesEnfermagem, { currentUser: currentUser, userId: userId, onClose: () => setShowAcoes(false) }),
    showLivro && /*#__PURE__*/React.createElement(LivroSaida, { currentUser: currentUser, userId: userId, onClose: () => setShowLivro(false), onPendentesChange: n => setPendentesCount(n) }),
    undoQueue.map(item => /*#__PURE__*/React.createElement("div", {
      key: item.id,
      style: { position: "fixed", bottom: 72, left: "50%", transform: "translateX(-50%)", background: "#0F172A", color: "#fff", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500, boxShadow: "0 4px 20px rgba(0,0,0,.3)", zIndex: 9998, display: "flex", alignItems: "center", gap: 12, whiteSpace: "nowrap" }
    }, "Card removido", /*#__PURE__*/React.createElement("button", { onClick: () => undoDelete(item.id), style: { background: "#3B82F6", border: "none", color: "#fff", padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 } }, "↩ Desfazer"))),

    /* Conteúdo principal */
    /*#__PURE__*/React.createElement("div", { style: { maxWidth: 1600, margin: "0 auto", padding: "16px 20px" } },
      /* Barra de navegação e filtros */
      /*#__PURE__*/React.createElement("div", { className: "ge-nav-bar", style: { display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "nowrap", paddingBottom: 4, overflowX: "auto", WebkitOverflowScrolling: "touch" } },
        /*#__PURE__*/React.createElement("div", { className: "ge-nav-inner", style: { background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, padding: "2px", display: "flex", gap: 1, flexShrink: 0, minWidth: "max-content" } },
          /*#__PURE__*/React.createElement(NavBtn, { id: "dashboard", label: "📊 Dashboard" }),
          /*#__PURE__*/React.createElement(KanbanDropdown, { view: view, setView: setView }),
          /*#__PURE__*/React.createElement("a", { href: "remocao.html", style: { padding: "5px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 400, background: "transparent", color: "#64748B", cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center" , flexShrink: 0, whiteSpace: "nowrap" } }, "🚑 Remoção"),
          podeLivro && /*#__PURE__*/React.createElement("div", { className: "livro-btn", style: { flexShrink: 0 } }, /*#__PURE__*/React.createElement("button", { onClick: () => setShowLivro(true), style: { padding: "5px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 400, background: "transparent", color: "#64748B", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 } }, "📒 Livro de Saída"), pendentesCount > 0 && /*#__PURE__*/React.createElement("span", { className: "livro-badge" }, pendentesCount)),
          /*#__PURE__*/React.createElement("div", { className: "livro-btn", style: { flexShrink: 0 } }, /*#__PURE__*/React.createElement("button", { onClick: () => setShowAcoes(true), title: "Tarefas de enfermagem persistentes entre turnos", style: { padding: "5px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 400, background: "transparent", color: "#64748B", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 } }, "\u2705 A\xE7\xF5es")),
          isAdmin && /*#__PURE__*/React.createElement(NavBtn, { id: "usuarios", label: "\u{1F465} Profissionais" }),
          isAdmin && /*#__PURE__*/React.createElement(NavBtn, { id: "historico", label: "📜 Histórico" }),
          isAdmin && /*#__PURE__*/React.createElement(NavBtn, { id: "publicacoes", label: "📰 Publicações" })
        ),
        /*#__PURE__*/React.createElement("input", {
          placeholder: "Buscar…",
          value: search,
          onChange: e => setSearch(e.target.value),
          style: { padding: "6px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12, color: "#0F172A", width: 220, background: "#fff", fontFamily: "inherit" }
        }),
        /*#__PURE__*/React.createElement("select", {
          value: fGrav,
          onChange: e => setFGrav(e.target.value),
          style: { padding: "6px 10px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12, color: "#374151", background: "#fff", fontFamily: "inherit" }
        },
          /*#__PURE__*/React.createElement("option", { value: "all" }, "Todas as gravidades"),
          Object.entries(GC).map(([k, v]) => /*#__PURE__*/React.createElement("option", { key: k, value: k }, v.emoji, " ", v.label))
        ),
        isAdmin && view === "kanban" && /*#__PURE__*/React.createElement("button", {
          onClick: () => setSortByPriority(p => !p),
          style: { padding: "5px 12px", border: `1px solid ${sortByPriority ? "#3B82F6" : "#E2E8F0"}`, borderRadius: 7, background: sortByPriority ? "#EFF6FF" : "#fff", color: sortByPriority ? "#1D4ED8" : "#64748B", cursor: "pointer", fontSize: 11, fontWeight: sortByPriority ? 700 : 400, transition: "all .15s" }
        }, sortByPriority ? "🔢 Prioridade ✓" : "🔢 Prioridade"),
        isAdmin && view === "kanban" && (showNewCol ?
          /*#__PURE__*/React.createElement("div", { style: { display: "flex", gap: 6, alignItems: "center" } },
            /*#__PURE__*/React.createElement("input", {
              ref: newColRef,
              value: newColName,
              onChange: e => setNewColName(e.target.value),
              onKeyDown: e => { if (e.key === "Enter") addColumn(); if (e.key === "Escape") { setShowNewCol(false); setNewColName(""); } },
              placeholder: "Nome da coluna…",
              style: { padding: "6px 10px", border: "1px solid #3B82F6", borderRadius: 8, fontSize: 12, width: 180, fontFamily: "inherit", background: "#fff", outline: "none" }
            }),
            /*#__PURE__*/React.createElement(Btn, { onClick: addColumn, style: { padding: "6px 12px", fontSize: 12 } }, "✓"),
            /*#__PURE__*/React.createElement(Btn, { variant: "ghost", onClick: () => { setShowNewCol(false); setNewColName(""); }, style: { padding: "6px 10px", fontSize: 12 } }, "✕")
          ) :
          /*#__PURE__*/React.createElement(Btn, { variant: "ghost", onClick: () => { setShowNewCol(true); setTimeout(() => newColRef.current?.focus(), 50); }, style: { fontSize: 12, padding: "6px 12px" } }, "+ Coluna")
        ),
        isAdmin && view !== "usuarios" && /*#__PURE__*/React.createElement(Btn, { onClick: () => newCard(), style: { marginLeft: "auto", fontSize: 12, padding: "6px 16px" } }, "+ Paciente")
      ),

      loading && /*#__PURE__*/React.createElement("div", { style: { textAlign: "center", padding: 48, color: "#94A3B8", fontSize: 14 } }, "Carregando dados…"),

      !loading && view === "dashboard" && /*#__PURE__*/React.createElement("div", { id: "view-content" },
        /*#__PURE__*/React.createElement(Dashboard, { cards: filtered, cols: displayCols, dashMode: dashMode, setDashMode: setDashMode, isAdmin: isAdmin, lastPub: lastPub, currentUser: currentUser, discrepancias: discrepancias, onPendenciasChange: (n) => { setPendenciasCount(n); saveLS("ge_pend_count", n); } })
      ),
      !loading && view === "usuarios" && isAdmin && /*#__PURE__*/React.createElement(UsersPanel, { currentUser: currentUser, userId: userId, showT: showT, cards: cards }),
      !loading && view === "historico" && isAdmin && /*#__PURE__*/React.createElement("div", { id: "view-content" },
        /*#__PURE__*/React.createElement(HistoryPanel, null)
      ),
      !loading && view === "publicacoes" && isAdmin && /*#__PURE__*/React.createElement("div", { id: "view-content" },
        /*#__PURE__*/React.createElement(PublicationsHistory, {
          onRestoreSnapshot: async (c, cl) => { await applySnapshot(c, cl); setView("kanban"); }
        })
      ),
      !loading && view === "calendario" && /*#__PURE__*/React.createElement("div", { id: "view-content" },
        /*#__PURE__*/React.createElement(CalendarView, { cards: filtered, cols: displayCols })
      ),
      !loading && view === "timeline" && /*#__PURE__*/React.createElement("div", { id: "view-content" },
        /*#__PURE__*/React.createElement(TimelineView, { cards: filtered, cols: displayCols })
      ),
      !loading && view === "kanban" && /*#__PURE__*/React.createElement("div", { style: { isolation: "isolate" } },
        /*#__PURE__*/React.createElement("div", { style: { display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" } },
          Object.entries(GC).map(([k, v]) => /*#__PURE__*/React.createElement("div", { key: k, style: { display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#64748B" } }, /*#__PURE__*/React.createElement("span", null, v.emoji), v.label))
        ),
        !isAdmin && !pubCards && /*#__PURE__*/React.createElement("div", { style: { background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 10, padding: "14px 16px", marginBottom: 16, fontSize: 13, color: "#92400E" } }, "⚠️ Nenhuma versão publicada ainda. Aguarde a administradora publicar o Kanban."),
        /*#__PURE__*/React.createElement("div", { id: "kanban-board", style: { display: "flex", gap: 8, alignItems: "start", overflowX: "auto", paddingBottom: 8 } },
          (singleCol ? displayCols.filter(c => c.id === singleCol) : displayCols).map(col => {
            const colCards = filtered.filter(c => c.col_id === col.id).sort((a, b) => {
              if (sortByPriority) {
                const pa = a.pr ? parseInt(a.pr) : 9999;
                const pb = b.pr ? parseInt(b.pr) : 9999;
                if (pa !== pb) return pa - pb;
                const ha = a.hora_aceite || "99:99";
                const hb = b.hora_aceite || "99:99";
                return ha.localeCompare(hb);
              }
              if (col.id === "aceite") {
                const pa = a.prioridade_remocao ? parseInt(a.prioridade_remocao,10) : 9999;
                const pb = b.prioridade_remocao ? parseInt(b.prioridade_remocao,10) : 9999;
                if (pa !== pb) return pa - pb;
                const ha = a.hora_aceite || "99:99";
                const hb = b.hora_aceite || "99:99";
                return ha.localeCompare(hb);
              }
              return 0;
            });
            var isMin = isMobile ? (mobileOpen !== null ? mobileOpen !== col.id : true) : minimized.has(col.id);
            return /*#__PURE__*/React.createElement("div", {
              key: col.id,
              "data-dropzone": col.id,
              onDragOver: function(e){
                e.preventDefault();
                if(e.dataTransfer.types&&Array.prototype.indexOf.call(e.dataTransfer.types,"text/col")>=0) return;
                if(isAdmin) handleDragOver(e,col.id);
              },
              onDragLeave: e => isAdmin && handleDragLeave(e, col.id),
              onDrop: function(e){
                if(e.dataTransfer.types&&Array.prototype.indexOf.call(e.dataTransfer.types,"text/col")>=0){handleColDrop(e,col.id);}
                else if(isAdmin){handleDrop(e,col.id);}
              },
              style: {
                background: "#fff",
                borderRadius: 12,
                border: "1.5px solid #E2E8F0",
                overflow: "hidden",
                minWidth: isMin ? (isMobile?"100%":48) : 220,
                flex: isMin ? (isMobile?"none":"0 0 48px") : singleCol === col.id ? "1 1 100%" : "1 1 200px",
                maxWidth: isMin ? (isMobile?"100%":48) : singleCol === col.id ? "100%" : 340,
                transition: "all .2s"
              }
            },
              /*#__PURE__*/React.createElement("div", { style: { padding: "10px 12px", borderBottom: isMin ? "none" : "1px solid #F1F5F9", borderTop: `3px solid ${col.accent || "#94A3B8"}` } },
                isMin ? (
                  isMobile
                    ? React.createElement("div", {
                        onClick:function(){setMobileOpen(function(p){return p===col.id?null:col.id;});},
                        style:{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",userSelect:"none",padding:"2px 0"}
                      },
                        React.createElement("div", {style:{display:"flex",alignItems:"center",gap:8}},
                          React.createElement("span", {style:{fontSize:16}}, col.emoji),
                          React.createElement("span", {style:{fontWeight:700,fontSize:13,color:"#0F172A"}}, col.label),
                          React.createElement("span", {style:{background:col.accent?col.accent+"22":"#F1F5F9",color:col.accent||"#475569",borderRadius:99,padding:"2px 9px",fontSize:11,fontWeight:700}}, colCards.length)
                        ),
                        React.createElement("span", {style:{color:"#94A3B8",fontSize:14}}, "\u25BC")
                      )
                    : React.createElement("div", {
                        style:{writingMode:"vertical-rl",fontWeight:700,fontSize:11,color:"#64748B",padding:"4px 0",cursor:"pointer",userSelect:"none",display:"flex",alignItems:"center",gap:4},
                        onClick:function(){setMinimized(function(p){var n=new Set(p);n.delete(col.id);return n;});}
                      },
                        React.createElement("span", null, col.emoji),
                        React.createElement("span", null, col.label),
                        React.createElement("span", {style:{background:"#F1F5F9",borderRadius:99,padding:"2px 4px",fontSize:9,fontWeight:700,writingMode:"horizontal-tb"}}, colCards.length)
                      )
                ) :
                  /*#__PURE__*/React.createElement(React.Fragment, null,
                    /*#__PURE__*/React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } },
                      React.createElement("div", {
                          draggable: isAdmin&&!isMobile,
                          onDragStart:function(e){e.stopPropagation();handleColDragStart(e,col.id);},
                          onDragEnd:handleColDragEnd,
                          style:{flex:1,minWidth:0,cursor:isAdmin&&!isMobile?"grab":"default"}
                        },
                          React.createElement("div", {style:{fontWeight:700,fontSize:12,color:"#0F172A",lineHeight:1.2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",display:"flex",alignItems:"center",gap:4}},
                            isAdmin&&!isMobile&&React.createElement("span",{style:{color:"#CBD5E1",fontSize:11}},"\u2630"),
                            col.emoji," ",col.label),
                          col.sub&&React.createElement("div",{style:{fontSize:9,color:"#94A3B8",marginTop:1}},col.sub)
                        ),
                        isMobile
                          ? React.createElement("button", {
                              onClick:function(){setMobileOpen(function(p){return p===col.id?null:col.id;});},
                              style:{background:"none",border:"none",cursor:"pointer",color:"#94A3B8",fontSize:16,padding:"2px 6px",flexShrink:0}
                            }, "\u25B2")
                          : React.createElement("div", {style:{display:"flex",gap:3,flexShrink:0,marginLeft:4}},
                              React.createElement("button", {onClick:()=>setSingleCol(p=>p===col.id?null:col.id),style:{background:"none",border:"none",cursor:"pointer",color:singleCol===col.id?"#3B82F6":"#CBD5E1",fontSize:12,padding:"2px 3px"}}, singleCol===col.id?"\u229E":"\u229F"),
                              React.createElement("button", {onClick:function(){setMinimized(function(p){var n=new Set(p);n.add(col.id);return n;});},style:{background:"none",border:"none",cursor:"pointer",color:"#CBD5E1",fontSize:12,padding:"2px 3px"}}, "\u2212"),
                              !col.fixed&&isAdmin&&React.createElement("button", {onClick:()=>removeColumn(col.id),style:{background:"none",border:"none",cursor:"pointer",color:"#CBD5E1",fontSize:12,padding:"2px 3px"}}, "\u2715")
                            )
                    ),
                    /*#__PURE__*/React.createElement("span", { style: { marginTop: 5, display: "inline-flex", background: "#F1F5F9", padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700, color: "#475569" } }, colCards.length)
                  )
              ),
              !isMin && /*#__PURE__*/React.createElement(React.Fragment, null,
                isAdmin && /*#__PURE__*/React.createElement("div", { style: { padding: "6px 8px 0" } },
                  /*#__PURE__*/React.createElement("button", {
                    onClick: () => newCard(col.id),
                    style: { width: "100%", padding: "5px", border: "1.5px dashed #E2E8F0", borderRadius: 6, background: "none", color: "#94A3B8", cursor: "pointer", fontSize: 11, transition: "all .15s" },
                    onMouseEnter: e => { e.currentTarget.style.borderColor = "#3B82F6"; e.currentTarget.style.color = "#3B82F6"; },
                    onMouseLeave: e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.color = "#94A3B8"; }
                  }, "+ Adicionar paciente")
                ),
                /*#__PURE__*/React.createElement("div", { style: { padding: "6px 8px 8px", minHeight: 80, maxHeight: singleCol ? "75vh" : "58vh", overflowY: "auto" } },
                  colCards.length === 0 ?
                    /*#__PURE__*/React.createElement("div", { style: { textAlign: "center", padding: "18px 8px", color: "#CBD5E1", fontSize: 11, border: "1.5px dashed #F1F5F9", borderRadius: 8, margin: "4px 0" } }, isAdmin ? "Arraste ou adicione" : "Sem pacientes") :
                    /*#__PURE__*/React.createElement(GroupedCards, { cards: colCards, onClick: setSelected, isAdmin: isAdmin, onDragStart: handleDragStart, onDragEnd: handleDragEnd })
                )
              )
            );
          })
        )
      ),
      !loading && view === "lista" && /*#__PURE__*/React.createElement("div", { id: "view-content", style: { background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" } },
        /*#__PURE__*/React.createElement("div", { style: { overflowX: "auto" } },
          /*#__PURE__*/React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12 } },
            /*#__PURE__*/React.createElement("thead", null,
              /*#__PURE__*/React.createElement("tr", { style: { background: "#F8FAFC" } },
                [["pr", "#"], ["nome", "Paciente"], ["status", "Status"], ["adm", "Adm."], ["hd", "HD"], ["setor", "Setor"], ["rec", "Recurso"], ["hosp", "Hospital"], ["col_id", "Coluna"], ["grav", "Gravidade"], ["amb", "Amb."], ["receptor", "Receptor"]].map(([key, h]) => /*#__PURE__*/React.createElement("th", {
                  key: key,
                  onClick: () => toggleSort(key),
                  style: { padding: "9px 11px", textAlign: "left", fontWeight: 600, color: "#64748B", fontSize: 10, textTransform: "uppercase", letterSpacing: ".04em", borderBottom: "1px solid #E2E8F0", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }
                }, h, sortCol?.key === key ? sortCol.dir === "asc" ? " ↑" : " ↓" : ""))
              )
            ),
            /*#__PURE__*/React.createElement("tbody", null,
              sortedFiltered.map((card, i) => {
                const c = displayCols.find(c => c.id === card.col_id);
                return /*#__PURE__*/React.createElement("tr", {
                  key: card.id,
                  onClick: () => setSelected(card),
                  style: { cursor: "pointer", background: i % 2 === 0 ? "#fff" : "#FAFAFA" },
                  onMouseEnter: e => e.currentTarget.style.background = "#EFF6FF",
                  onMouseLeave: e => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#FAFAFA"
                },
                  /*#__PURE__*/React.createElement("td", { style: { padding: "8px 11px", borderBottom: "1px solid #F1F5F9", color: "#94A3B8", fontWeight: 700, fontSize: 11 } }, card.pr || "—"),
                  /*#__PURE__*/React.createElement("td", { style: { padding: "8px 11px", borderBottom: "1px solid #F1F5F9", fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap" } }, card.is_rn ? "👶 " : "", card.nome),
                  /*#__PURE__*/React.createElement("td", { style: { padding: "8px 11px", borderBottom: "1px solid #F1F5F9", whiteSpace: "nowrap" } }, /*#__PURE__*/React.createElement(StatusPill, { status: card.status })),
                  /*#__PURE__*/React.createElement("td", { style: { padding: "8px 11px", borderBottom: "1px solid #F1F5F9", color: "#64748B", whiteSpace: "nowrap" } }, card.adm),
                  /*#__PURE__*/React.createElement("td", { style: { padding: "8px 11px", borderBottom: "1px solid #F1F5F9", color: "#374151", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, card.hd),
                  /*#__PURE__*/React.createElement("td", { style: { padding: "8px 11px", borderBottom: "1px solid #F1F5F9", color: "#64748B", whiteSpace: "nowrap" } }, card.setor),
                  /*#__PURE__*/React.createElement("td", { style: { padding: "8px 11px", borderBottom: "1px solid #F1F5F9", whiteSpace: "nowrap" } }, /*#__PURE__*/React.createElement("span", { style: { background: "#EFF6FF", color: "#1E40AF", padding: "1px 5px", borderRadius: 3, fontSize: 10 } }, card.rec)),
                  /*#__PURE__*/React.createElement("td", { style: { padding: "8px 11px", borderBottom: "1px solid #F1F5F9", color: "#374151", whiteSpace: "nowrap" } }, card.hosp),
                  /*#__PURE__*/React.createElement("td", { style: { padding: "8px 11px", borderBottom: "1px solid #F1F5F9", whiteSpace: "nowrap" } }, /*#__PURE__*/React.createElement("span", { style: { background: "#F1F5F9", color: "#475569", padding: "1px 5px", borderRadius: 3, fontSize: 10 } }, c?.emoji, " ", c?.label)),
                  /*#__PURE__*/React.createElement("td", { style: { padding: "8px 11px", borderBottom: "1px solid #F1F5F9", whiteSpace: "nowrap" } }, /*#__PURE__*/React.createElement(Badge, { grav: card.grav })),
                  /*#__PURE__*/React.createElement("td", { style: { padding: "8px 11px", borderBottom: "1px solid #F1F5F9", whiteSpace: "nowrap" } }, /*#__PURE__*/React.createElement(AmbBadge, { amb: card.amb })),
                  /*#__PURE__*/React.createElement("td", { style: { padding: "8px 11px", borderBottom: "1px solid #F1F5F9", color: "#64748B", whiteSpace: "nowrap", fontSize: 11 } }, card.receptor || "")
                );
              }),
              sortedFiltered.length === 0 && /*#__PURE__*/React.createElement("tr", null,
                /*#__PURE__*/React.createElement("td", { colSpan: 12, style: { padding: 32, textAlign: "center", color: "#CBD5E1" } }, "Nenhum resultado.")
              )
            )
          )
        )
      )
    ),

    /* Modais */
    selected && /*#__PURE__*/React.createElement(CardModal, {
      card: selected,
      cols: isAdmin ? cols : displayCols,
      onClose: () => setSelected(null),
      onSave: onSave,
      onUpdateCard: (id, fields) => setCards(p => { const next = p.map(c => c.id === id ? {...c, ...fields} : c); window.__geCards = next; return next; }),
      onDel: onDel,
      isAdmin: isAdmin,
      currentUser: currentUser,
      comments: selected.id === "new" ? [] : comments[selected.id] || [],
      onAddComment: onAddComment,
      onDelComment: cid => onDelComment(cid, selected.id)
    }),
    showPub && /*#__PURE__*/React.createElement(PubModal, { onClose: () => setShowPub(false), onPub: onPub, cards: cards, cols: cols }),
    showShare && /*#__PURE__*/React.createElement(ShareModal, {
      onClose: () => setShowShare(false),
      settings: settings,
      cards: isAdmin ? cards : pubCards || [],
      cols: isAdmin ? cols : pubCols || cols,
      showT: showT,
      exportPNG: exportPNG,
      generatePDF: generatePDF,
      exportExcel: exportExcel,
      currentView: view
    }),
    showSettings && /*#__PURE__*/React.createElement(SettingsModal, { settings: settings, onClose: () => setShowSettings(false), onSave: saveSettings }),
    pendingMove && /*#__PURE__*/React.createElement(AceiteModal, {
      card: pendingMove.card,
      onConfirm: aceite => {
        moveCard(pendingMove.card.id, pendingMove.newColId, aceite);
        setPendingMove(null);
      },
      onCancel: () => setPendingMove(null)
    }),
    showComPanel && newComAlerts.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: { position: "fixed", top: 60, right: 16, width: 320, background: "#fff", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,.18)", border: "1px solid #E2E8F0", zIndex: 9000, overflow: "hidden" }
    },
      /*#__PURE__*/React.createElement("div", { style: { padding: "10px 14px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#EFF6FF" } },
        /*#__PURE__*/React.createElement("div", { style: { fontWeight: 700, fontSize: 13, color: "#1E40AF" } }, "💬 Novos comentários (", newComAlerts.length, ")"),
        /*#__PURE__*/React.createElement("button", { onClick: () => setShowComPanel(false), style: { background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 16 } }, "✕")
      ),
      /*#__PURE__*/React.createElement("div", { style: { maxHeight: 340, overflowY: "auto" } },
        newComAlerts.map((alert, i) => /*#__PURE__*/React.createElement("div", { key: alert.id, style: { padding: "10px 14px", borderBottom: "1px solid #F1F5F9", display: "flex", flexDirection: "column", gap: 4 } },
          /*#__PURE__*/React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 } },
            /*#__PURE__*/React.createElement("div", null,
              /*#__PURE__*/React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: "#0F172A" } }, alert.card_nome),
              /*#__PURE__*/React.createElement("div", { style: { fontSize: 10, color: "#64748B" } }, alert.autor, " · ", alert.hora)
            ),
            /*#__PURE__*/React.createElement("button", { onClick: () => setNewComAlerts(p => p.filter(x => x.id !== alert.id)), style: { background: "none", border: "none", cursor: "pointer", color: "#CBD5E1", fontSize: 13, padding: 0, flexShrink: 0 } }, "✕")
          ),
          /*#__PURE__*/React.createElement("div", { style: { fontSize: 12, color: "#374151", background: "#F8FAFC", borderRadius: 6, padding: "5px 8px" } }, alert.texto),
          /*#__PURE__*/React.createElement("button", {
            onClick: () => {
              const card = cards.find(c => c.id === alert.card_id);
              if (card) { setSelected(card); setShowComPanel(false); }
              setNewComAlerts(p => p.filter(x => x.id !== alert.id));
            },
            style: { alignSelf: "flex-start", padding: "3px 10px", border: "1px solid #BFDBFE", borderRadius: 6, background: "none", color: "#1E40AF", cursor: "pointer", fontSize: 11, fontWeight: 600 }
          }, "Abrir card e responder →")
        ))
      ),
      /*#__PURE__*/React.createElement("div", { style: { padding: "8px 14px", borderTop: "1px solid #F1F5F9", display: "flex", gap: 6, justifyContent: "flex-end" } },
        /*#__PURE__*/React.createElement("button", { onClick: () => { setNewComAlerts([]); setShowComPanel(false); }, style: { padding: "4px 12px", border: "1px solid #E2E8F0", borderRadius: 6, background: "none", color: "#64748B", cursor: "pointer", fontSize: 11 } }, "Ignorar todos")
      )
    ),
    showInstall && /*#__PURE__*/React.createElement(InstallModal, { onClose: () => setShowInstall(false) }),
    showSnapPanel && /*#__PURE__*/React.createElement(SnapshotPanel, {
      snapshots: snapshots,
      onLoad: loadSnapshot,
      onDelete: deleteSnapshot,
      onClose: () => setShowSnapPanel(false),
      onImportFile: importSnapshotFile
    }),
    importResult && /*#__PURE__*/React.createElement(KanbanImportResultModal, {
      result: importResult,
      onClose: () => setImportResult(null)
    }),
    showDuplicates && /*#__PURE__*/React.createElement(KanbanDuplicatesModal, {
      cards: cards,
      cols: cols,
      onClose: () => setShowDuplicates(false),
      onDel: onDelSilent
    }),
    isAdmin && React.createElement(FloatingActions, {
      cards: cards,
      discrepancias: discrepancias,
      pendencias: pendenciasCount,
      acoes: acoesCount,
      setView: setView
    }),
    /*#__PURE__*/React.createElement(Toast, { toast: toast })
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));
