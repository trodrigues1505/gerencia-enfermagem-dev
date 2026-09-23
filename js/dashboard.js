/* ─── DASHBOARD ─── */
/* ════════════════════════════════════════════════════════════════════════════
   DASHBOARD — indicadores de regulação
   ----------------------------------------------------------------------------
   FONTE: tabela `remocoes` (registro oficial, digitado manualmente).
   O Kanban (`cards`) entra SÓ no pulso operacional — é fila viva, sem
   histórico: cards são movidos, editados e apagados, então não sustentam
   série temporal nenhuma.

   Três princípios que o desenho carrega:
   1. COBERTURA SEMPRE VISÍVEL. Nenhum campo de remocoes passa de 80% de
      preenchimento (tipo_ambulancia tem 44% de nulos). Percentual sem
      denominador declarado mente por omissão — e isto vira ata de SGQ.
   2. ESCALA CONFORME O DADO. A base começa em 20 dias. Mês parcial ao lado
      de mês completo sugere queda que não existe.
   3. RECURSO ≠ ESPECIALIDADE. Exames são ~29% dos pedidos e não competem
      com as clínicas; ficam visualmente apartados.
   ══════════════════════════════════════════════════════════════════════════ */

function Dashboard({ cards, cols, dashMode, setDashMode, isAdmin, lastPub, currentUser, discrepancias, onPendenciasChange }) {
  const [remocoes, setRemocoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [escala, setEscala] = useState("dia");
  const [periodo, setPeriodo] = useState("tudo");
  const [ini, setIni] = useState("");
  const [fim, setFim] = useState("");
  const [verPendencias, setVerPendencias] = useState(false);
  const [verDiscrep, setVerDiscrep] = useState(false);
  const [justModal, setJustModal] = useState(null);
  const [justTexto, setJustTexto] = useState("");
  const [justSaving, setJustSaving] = useState(false);
  const podeJustificar = isAdmin || !!(currentUser && currentUser.can_justificativa);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await sbGet("remocoes", "select=*&order=data_solicitacao.desc&limit=5000");
        if (vivo) setRemocoes(r);
      } catch (e) { if (vivo) setErro(e.message); }
      finally { if (vivo) setCarregando(false); }
    })();
    return () => { vivo = false; };
  }, []);

  /* ── Recorte temporal ─────────────────────────────────────────────────── */
  const hoje = new Date();
  const iso = d => d.toISOString().slice(0, 10);
  const dados = useMemo(() => {
    if (periodo === "tudo") return remocoes;
    if (periodo === "custom") {
      if (!ini || !fim) return remocoes;
      return remocoes.filter(r => r.data_solicitacao >= ini && r.data_solicitacao <= fim);
    }
    const dias = periodo === "7d" ? 7 : periodo === "30d" ? 30 : 90;
    const corte = iso(new Date(hoje.getTime() - dias * 86400000));
    return remocoes.filter(r => (r.data_solicitacao || "") >= corte);
  }, [remocoes, periodo, ini, fim]);

  /* ── Amplitude real da base: decide quais escalas fazem sentido ───────── */
  const amplitude = useMemo(() => {
    const ds = remocoes.map(r => r.data_solicitacao).filter(Boolean).sort();
    if (!ds.length) return { dias: 0, meses: 0, min: null, max: null };
    const min = ds[0], max = ds[ds.length - 1];
    const dias = Math.round((new Date(max) - new Date(min)) / 86400000) + 1;
    // Meses COMPLETOS: um mês parcial comparado a um completo distorce a leitura
    const mesesSet = new Set(ds.map(d => d.slice(0, 7)));
    return { dias, meses: mesesSet.size, min, max, mesesSet };
  }, [remocoes]);

  const escalaLiberada = {
    dia: true,
    semana: amplitude.dias >= 28,
    mes: amplitude.meses >= 3
  };
  const motivoBloqueio = {
    semana: `precisa de 4 semanas (hoje: ${amplitude.dias} dias)`,
    mes: `precisa de 3 meses completos (hoje: ${amplitude.meses})`
  };
  const escalaEfetiva = escalaLiberada[escala] ? escala : "dia";

  /* ── Série temporal ───────────────────────────────────────────────────── */
  const serie = useMemo(() => {
    const chave = d => {
      if (!d) return null;
      if (escalaEfetiva === "mes") return d.slice(0, 7);
      if (escalaEfetiva === "semana") {
        const dt = new Date(d + "T00:00:00");
        const seg = new Date(dt); seg.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
        return iso(seg);
      }
      return d;
    };
    const m = {};
    dados.forEach(r => { const k = chave(r.data_solicitacao); if (k) m[k] = (m[k] || 0) + 1; });
    return Object.keys(m).sort().map(k => ({ k, n: m[k] }));
  }, [dados, escalaEfetiva]);

  /* ── Agregações canonicalizadas ───────────────────────────────────────── */
  const C = typeof Canon !== "undefined" ? Canon : null;
  const ag = campo => C ? C.agrupar(dados, campo)
    : { itens: [], total: dados.length, informados: 0, cobertura: 0, naoClassificados: [] };

  const gGrav   = useMemo(() => ag("gravidade"),           [dados]);
  const gEspec  = useMemo(() => ag("especialidade"),       [dados]);
  const gHosp   = useMemo(() => ag("instituicao_destino"), [dados]);
  const gSetor  = useMemo(() => ag("setor"),               [dados]);
  const gAmb    = useMemo(() => ag("tipo_ambulancia"),     [dados]);
  const gStatus = useMemo(() => ag("status"),              [dados]);

  /* ── Tempos: calculados dos timestamps, não dos campos texto ──────────── */
  // tempo_espera e duracao_remocao sao `text` com formato variavel — servem
  // para exibir, nao para media. Aqui reconstruimos a partir das datas/horas.
  const tempos = useMemo(() => {
    const min = (d1, h1, d2, h2) => {
      if (!d1 || !h1 || !d2 || !h2) return null;
      const a = new Date(`${d1}T${h1.padStart(5, "0")}:00`);
      const b = new Date(`${d2}T${h2.padStart(5, "0")}:00`);
      if (isNaN(a) || isNaN(b)) return null;
      let diff = (b - a) / 60000;
      // Horarios sem data associada: saida 23:10 / retorno 01:40 daria negativo
      if (diff < 0 && diff > -1440) diff += 1440;
      return diff >= 0 && diff < 4320 ? diff : null;
    };
    const resp = [], remo = [];
    dados.forEach(r => {
      const a = min(r.data_solicitacao, r.horario_solicitacao, r.data_resposta_cross, r.horario_resposta_cross);
      if (a !== null) resp.push(a);
      const b = min(r.data_saida_ambulancia || r.data_solicitacao, r.horario_saida_ambulancia,
                    r.data_saida_ambulancia || r.data_solicitacao, r.horario_retorno);
      if (b !== null) remo.push(b);
    });
    const med = arr => { if (!arr.length) return null;
      const s = [...arr].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    return {
      respCross: { mediana: med(resp), n: resp.length },
      remocao:   { mediana: med(remo), n: remo.length }
    };
  }, [dados]);

  /* ── Permanência: denominador são os vinculados, não o total ──────────── */
  const perm = useMemo(() => {
    const vinc = dados.filter(r => r.finalizado === true || r.permaneceu === true);
    const p = dados.filter(r => r.permaneceu === true).length;
    return { n: p, base: vinc.length, pct: vinc.length ? p / vinc.length * 100 : 0 };
  }, [dados]);

  // Percorre os registros (nao os agregados) para levar o id junto: sem ele
  // o aviso diz que existe um valor invalido mas nao onde corrigir.
  const pendencias = useMemo(() => {
    if (!C) return [];
    const out = [];
    ["especialidade", "instituicao_destino", "setor", "status"].forEach(campo => {
      dados.forEach(r => {
        const res = C.classificar(campo, r[campo]);
        if (res.canonico === C.NAO_CLASSIFICADO)
          out.push({ id: r.id, campo, valor: r[campo],
                     paciente: r.nome_paciente, ficha: r.ficha_cross,
                     data: r.data_solicitacao,
                     sugestao: res.vazamento ? res.vazamento.pertenceA.join(" ou ") : null });
      });
    });
    return out;
  }, [dados]);
  useEffect(() => { if(onPendenciasChange) onPendenciasChange(pendencias.length); }, [pendencias.length]);

  /* ── Pulso operacional (Kanban) ───────────────────────────────────────── */
  const fila = useMemo(() => {
    const porCol = {};
    cols.forEach(c => { porCol[c.id] = cards.filter(k => k.col_id === c.id).length; });
    const semHosp = cards.filter(c => !c.hosp && c.col_id !== "finalizado").length;
    const emerg = cards.filter(c => c.grav === "emergencia").length;
    return { porCol, semHosp, emerg, total: cards.length };
  }, [cards, cols]);

  /* ═══ Animação de entrada ═════════════════════════════════════════════
   * Números sobem até o valor e barras preenchem ao montar. easeOutCubic:
   * começa rápido e desacelera — dá a sensação de chegar ao número, em vez
   * de contar mecanicamente. ~900ms, curto o bastante para não atrasar a
   * leitura de quem só quer conferir um dado.
   * Respeita prefers-reduced-motion: quem pediu menos movimento no sistema
   * recebe o valor final direto, sem animação nenhuma.
   */
  const semMovimento = typeof window !== "undefined" && window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function useContagem(alvo, dur = 900) {
    const [v, setV] = useState(semMovimento ? alvo : 0);
    useEffect(() => {
      if (semMovimento || typeof alvo !== "number" || !isFinite(alvo)) { setV(alvo); return; }
      let raf, t0 = null;
      const passo = t => {
        if (t0 === null) t0 = t;
        const p = Math.min((t - t0) / dur, 1);
        setV(alvo * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(passo);
      };
      raf = requestAnimationFrame(passo);
      return () => cancelAnimationFrame(raf);
    }, [alvo, dur]);
    return v;
  }

  // Dispara uma vez, logo após a montagem: as barras saem de 0 e crescem.
  const [entrou, setEntrou] = useState(semMovimento);
  useEffect(() => {
    if (semMovimento) return;
    const t = setTimeout(() => setEntrou(true), 40);
    return () => clearTimeout(t);
  }, []);

  const Num = ({ valor, sufixo = "", casas = 0 }) => {
    const v = useContagem(typeof valor === "number" ? valor : null);
    if (typeof valor !== "number") return valor;
    return /*#__PURE__*/React.createElement(React.Fragment, null, v.toFixed(casas), sufixo);
  };

  /* ═══ Primitivas visuais ══════════════════════════════════════════════ */
  const Card = ({ children, style }) => /*#__PURE__*/React.createElement("div", {
    style: { background: "#fff", border: "1px solid #E8EDF3", borderRadius: 14,
             padding: "16px 18px", ...style }
  }, children);

  const Titulo = ({ children, extra, tooltip }) => /*#__PURE__*/React.createElement("div", {
    style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }
  },
    /*#__PURE__*/React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: "#0F172A", letterSpacing: ".01em", display:"flex", alignItems:"center", gap:3 } }, children, tooltip && React.createElement(TipIcon,{texto:tooltip})),
    extra && /*#__PURE__*/React.createElement("div", { style: { fontSize: 10.5, color: "#94A3B8" } }, extra)
  );

  // Cobertura: quantos registros informaram o campo. Sem isto, um percentual
  // sobre 56% da base parece um fato sobre 100%.
  const Cobertura = ({ g }) => {
    const baixa = g.cobertura < 80;
    return /*#__PURE__*/React.createElement("div", {
      title: `${g.informados} de ${g.total} registros informaram este campo`,
      style: { fontSize: 10.5, color: baixa ? "#B45309" : "#94A3B8",
               background: baixa ? "#FFFBEB" : "transparent",
               border: baixa ? "1px solid #FDE68A" : "1px solid transparent",
               borderRadius: 6, padding: baixa ? "1px 6px" : "1px 0" }
    }, `${g.informados}/${g.total} informados`);
  };

  const Barra = ({ label, n, pct, max, cor, tag }) => /*#__PURE__*/React.createElement("div", {
    style: { marginBottom: 9 }
  },
    /*#__PURE__*/React.createElement("div", {
      style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, gap: 8 }
    },
      /*#__PURE__*/React.createElement("span", {
        style: { fontSize: 12, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
      }, label,
        tag && /*#__PURE__*/React.createElement("span", {
          style: { marginLeft: 6, fontSize: 9, fontWeight: 700, color: "#6D28D9",
                   background: "#F5F3FF", borderRadius: 4, padding: "1px 5px", verticalAlign: "middle" }
        }, tag)),
      /*#__PURE__*/React.createElement("span", {
        style: { fontSize: 11.5, color: "#64748B", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }
      }, /*#__PURE__*/React.createElement(Num, { valor: n }),
         /*#__PURE__*/React.createElement("span", { style: { color: "#CBD5E1" } },
           "  ", /*#__PURE__*/React.createElement(Num, { valor: pct, sufixo: "%" })))),
    /*#__PURE__*/React.createElement("div", { style: { height: 6, background: "#F1F5F9", borderRadius: 99, overflow: "hidden" } },
      /*#__PURE__*/React.createElement("div", {
        style: { height: "100%", width: entrou ? `${max ? (n / max * 100) : 0}%` : "0%",
                 background: cor, borderRadius: 99,
                 transition: "width .75s cubic-bezier(.22,.9,.3,1)" } }))
  );

  const Vazio = ({ children }) => /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 11.5, color: "#CBD5E1", padding: "14px 0", textAlign: "center" }
  }, children);

  function TipIcon(props) {
    return React.createElement("span", {className:"tip", style:{marginLeft:4,color:"#CBD5E1",fontSize:10,fontWeight:700,verticalAlign:"middle",userSelect:"none"}},
      "?", React.createElement("span", {className:"tipbox"}, props.texto));
  }
  const Kpi = ({ label, valor, sub, cor, alerta, tooltip }) => /*#__PURE__*/React.createElement(Card, {
    style: alerta ? { borderColor: "#FDE68A", background: "#FFFBEB" } : null
  },
    /*#__PURE__*/React.createElement("div", {
      style: { fontSize: 10.5, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8, display:"flex", alignItems:"center", gap:2 }
    }, label, tooltip && React.createElement(TipIcon, {texto: tooltip})),
    /*#__PURE__*/React.createElement("div", {
      style: { fontSize: 27, fontWeight: 700, color: cor || "#0F172A", lineHeight: 1, fontVariantNumeric: "tabular-nums" }
    }, typeof valor === "number" ? /*#__PURE__*/React.createElement(Num, { valor }) : valor),
    sub && /*#__PURE__*/React.createElement("div", { style: { fontSize: 10.5, color: "#94A3B8", marginTop: 6 } }, sub)
  );

  /* ─── Estados de carga ─────────────────────────────────────────────── */
  if (carregando) return /*#__PURE__*/React.createElement("div", {
    style: { padding: 60, textAlign: "center", color: "#94A3B8", fontSize: 13 }
  }, "Carregando indicadores…");

  if (erro) return /*#__PURE__*/React.createElement("div", {
    style: { padding: 28, margin: 20, background: "#FEF2F2", border: "1px solid #FECACA",
             borderRadius: 12, color: "#991B1B", fontSize: 13, lineHeight: 1.6 }
  }, /*#__PURE__*/React.createElement("b", null, "Não foi possível carregar as remoções."), " ", erro);

  const fmtMin = m => m === null ? "—" : m >= 60 ? `${Math.floor(m / 60)}h${String(Math.round(m % 60)).padStart(2, "0")}` : `${Math.round(m)}min`;
  const rotuloSerie = k => escalaEfetiva === "mes"
    ? new Date(k + "-01T00:00:00").toLocaleDateString("pt-BR", { month: "short" })
    : new Date(k + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const maxSerie = Math.max(...serie.map(s => s.n), 1);

  const clinicas = gEspec.itens.filter(i => i.grupo === "clinica");
  const recursos = gEspec.itens.filter(i => i.grupo === "recurso");
  const naoClass = gEspec.itens.filter(i => !i.grupo);

  const btnEscala = (id, txt) => {
    const on = escalaEfetiva === id, livre = escalaLiberada[id];
    return /*#__PURE__*/React.createElement("button", {
      key: id, onClick: () => livre && setEscala(id), disabled: !livre,
      title: livre ? "" : motivoBloqueio[id],
      style: { padding: "5px 13px", borderRadius: 7, border: "none", fontSize: 12,
               fontWeight: on ? 650 : 450, cursor: livre ? "pointer" : "not-allowed",
               background: on ? "#0F172A" : "transparent",
               color: on ? "#fff" : livre ? "#64748B" : "#CBD5E1", fontFamily: "inherit" }
    }, txt);
  };

  const btnPeriodo = (id, txt) => /*#__PURE__*/React.createElement("button", {
    key: id, onClick: () => setPeriodo(id),
    style: { padding: "5px 13px", borderRadius: 7, border: "none", fontSize: 12,
             fontWeight: periodo === id ? 650 : 450, cursor: "pointer",
             background: periodo === id ? "#E2E8F0" : "transparent",
             color: periodo === id ? "#0F172A" : "#64748B", fontFamily: "inherit" }
  }, txt);

  return /*#__PURE__*/React.createElement("div", { style: { padding: "4px 0 40px" } },

    /* ══ Controles ══ */
    /*#__PURE__*/React.createElement("div", {
      style: { display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 18 }
    },
      /*#__PURE__*/React.createElement("div", {
        style: { display: "flex", gap: 2, background: "#F1F5F9", borderRadius: 9, padding: 3 }
      }, ["tudo", "90d", "30d", "7d"].map(p =>
        btnPeriodo(p, p === "tudo" ? "Tudo" : p === "90d" ? "90 dias" : p === "30d" ? "30 dias" : "7 dias"))),

      /*#__PURE__*/React.createElement("div", {
        style: { display: "flex", gap: 2, background: "#F1F5F9", borderRadius: 9, padding: 3 }
      }, [["dia", "Diária"], ["semana", "Semanal"], ["mes", "Mensal"]].map(([i, t]) => btnEscala(i, t))),

      /*#__PURE__*/React.createElement("div", { style: { fontSize: 11, color: "#94A3B8", marginLeft: "auto" } },
        dados.length, " remoções",
        amplitude.min && ` · ${new Date(amplitude.min + "T00:00:00").toLocaleDateString("pt-BR")} a ${new Date(amplitude.max + "T00:00:00").toLocaleDateString("pt-BR")}`)
    ),

    /* Escala indisponível: diz o porquê em vez de esconder o botão */
    !escalaLiberada[escala] && escala !== "dia" && /*#__PURE__*/React.createElement("div", {
      style: { fontSize: 11.5, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A",
               borderRadius: 9, padding: "9px 13px", marginBottom: 16 }
    }, "Escala ", escala === "mes" ? "mensal" : "semanal", " ainda não disponível — ", motivoBloqueio[escala],
       ". Mostrando a diária."),

    /* ══ Pulso operacional — única seção que vem do Kanban ══ */
    /*#__PURE__*/React.createElement("div", { style: { marginBottom: 22 } },
      /*#__PURE__*/React.createElement("div", {
        style: { fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase",
                 letterSpacing: ".06em", marginBottom: 10 }
      }, "Agora · fila do Kanban"),
      /*#__PURE__*/React.createElement("div", {
        style: { display: "grid", gridTemplateColumns: `repeat(auto-fit,minmax(150px,1fr))`, gap: 11 }
      },
        cols.map(c => /*#__PURE__*/React.createElement(Card, { key: c.id, style: { padding: "13px 15px" } },
          /*#__PURE__*/React.createElement("div", {
            style: { fontSize: 10, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase",
                     letterSpacing: ".04em", marginBottom: 6, overflow: "hidden",
                     textOverflow: "ellipsis", whiteSpace: "nowrap" }
          }, c.label),
          /*#__PURE__*/React.createElement("div", {
            style: { fontSize: 23, fontWeight: 700, color: c.accent || "#64748B", lineHeight: 1 }
          }, /*#__PURE__*/React.createElement(Num, { valor: fila.porCol[c.id] || 0 })))),
        fila.semHosp > 0 && /*#__PURE__*/React.createElement(Card, {
          key: "sh", style: { padding: "13px 15px", borderColor: "#FDE68A", background: "#FFFBEB" }
        },
          /*#__PURE__*/React.createElement("div", {
            style: { fontSize: 10, fontWeight: 600, color: "#B45309", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }
          }, "Sem hospital"),
          /*#__PURE__*/React.createElement("div", { style: { fontSize: 23, fontWeight: 700, color: "#B45309", lineHeight: 1 } },
            /*#__PURE__*/React.createElement(Num, { valor: fila.semHosp }))))
    ),

    /* ══ KPIs do período (remocoes) ══ */
    /*#__PURE__*/React.createElement("div", {
      style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(185px,1fr))", gap: 12, marginBottom: 22 }
    },
      /*#__PURE__*/React.createElement(Kpi, {
        label: "Remoções", valor: dados.length,
        sub: amplitude.dias ? `${(dados.length / Math.max(amplitude.dias, 1)).toFixed(1)} por dia` : null,
        tooltip: "Total de saídas registradas na planilha no período selecionado. Fonte: planilha de remoções." }),
      /*#__PURE__*/React.createElement(Kpi, {
        label: "Ambulância avançada",
        valor: gAmb.informados ? `${((gAmb.itens.find(i => i.canonico === "AVANÇADA")?.n || 0) / gAmb.informados * 100).toFixed(0)}%` : "—",
        sub: `${gAmb.informados} de ${gAmb.total} informados`,
        alerta: gAmb.cobertura < 80,
        tooltip: "% de remoções que usaram SAV (Suporte Avançado de Vida). Calculado só sobre registros com tipo de ambulância preenchido — o denominador aparece abaixo." }),
      /*#__PURE__*/React.createElement(Kpi, {
        label: "Resposta da CROSS", valor: fmtMin(tempos.respCross.mediana),
        sub: `mediana · ${tempos.respCross.n} com horário`, cor: "#0369A1",
        tooltip: "Tempo mediano entre a hora da solicitação e a hora da resposta da CROSS. Usa mediana (não média) para não ser distorcido por esperas extremas. Calculado só para registros com ambos os horários." }),
      /*#__PURE__*/React.createElement(Kpi, {
        label: "Duração da remoção", valor: fmtMin(tempos.remocao.mediana),
        sub: `mediana · ${tempos.remocao.n} com horário`, cor: "#0369A1",
        tooltip: "Tempo mediano que a ambulância ficou fora: da saída ao retorno à Santa Casa. Mediana para não ser distorcido por casos extremos." }),
      /*#__PURE__*/React.createElement(Kpi, {
        label: "Permaneceu", valor: perm.base ? `${perm.pct.toFixed(0)}%` : "—",
        sub: `${perm.n} de ${perm.base} com desfecho`, alerta: perm.base < dados.length * 0.8,
        tooltip: "% de pacientes removidos que permaneceram na unidade de destino — não retornaram à Santa Casa. Calculado sobre registros com campo Permaneceu ou Finalizado preenchido." })
    ),

    /* ══ Série temporal ══ */
    /*#__PURE__*/React.createElement(Card, { style: { marginBottom: 14 } },
      /*#__PURE__*/React.createElement(Titulo, {
        extra: escalaEfetiva === "dia" ? "por dia" : escalaEfetiva === "semana" ? "por semana" : "por mês"
      }, "Volume de remoções"),
      serie.length === 0 ? /*#__PURE__*/React.createElement(Vazio, null, "Sem remoções no período") :
      /*#__PURE__*/React.createElement("div", {
        style: { display: "flex", alignItems: "flex-end", gap: 3, height: 130, paddingTop: 8 }
      }, serie.map(s => /*#__PURE__*/React.createElement("div", {
        key: s.k, title: `${rotuloSerie(s.k)}: ${s.n}`,
        style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 0 }
      },
        /*#__PURE__*/React.createElement("div", { style: { fontSize: 9.5, color: "#94A3B8", fontVariantNumeric: "tabular-nums" } }, s.n),
        /*#__PURE__*/React.createElement("div", {
          style: { width: "100%", height: entrou ? `${s.n / maxSerie * 92}px` : "0px", minHeight: entrou ? 3 : 0,
                   background: "#3B82F6", borderRadius: "4px 4px 2px 2px", opacity: .85,
                   transition: "height .7s cubic-bezier(.22,.9,.3,1)" } }),
        /*#__PURE__*/React.createElement("div", {
          style: { fontSize: 8.5, color: "#CBD5E1", whiteSpace: "nowrap", overflow: "hidden" }
        }, rotuloSerie(s.k)))))
    ),

    /* ══ Distribuições ══ */
    /*#__PURE__*/React.createElement("div", {
      style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(310px,1fr))", gap: 14 }
    },

      /* Gravidade — proporção importa mais que valor absoluto */
      /*#__PURE__*/React.createElement(Card, null,
        /*#__PURE__*/React.createElement(Titulo, { extra: /*#__PURE__*/React.createElement(Cobertura, { g: gGrav }), tooltip: "Distribuição por nível de urgência do paciente conforme registrado na planilha. VERMELHO=emergência, AMARELO=urgência, VERDE=menor gravidade." }, "Gravidade"),
        gGrav.itens.length === 0 ? /*#__PURE__*/React.createElement(Vazio, null, "Sem dados") :
        /*#__PURE__*/React.createElement(React.Fragment, null,
          /*#__PURE__*/React.createElement("div", {
            style: { display: "flex", height: 10, borderRadius: 99, overflow: "hidden", marginBottom: 14, background: "#F1F5F9" }
          }, (C ? C.GRAVIDADE_ORDEM : []).map(g => {
            const it = gGrav.itens.find(i => i.canonico === g); if (!it) return null;
            return /*#__PURE__*/React.createElement("div", {
              key: g, title: `${g}: ${it.n} (${it.pct.toFixed(0)}%)`,
              style: { width: entrou ? `${it.pct}%` : "0%", background: C.GRAVIDADE_COR[g],
                       transition: "width .8s cubic-bezier(.22,.9,.3,1)" } });
          })),
          (C ? C.GRAVIDADE_ORDEM : []).map(g => {
            const it = gGrav.itens.find(i => i.canonico === g); if (!it) return null;
            return /*#__PURE__*/React.createElement(Barra, {
              key: g, label: g, n: it.n, pct: it.pct,
              max: Math.max(...gGrav.itens.map(i => i.n)), cor: C.GRAVIDADE_COR[g] });
          }))),

      /* Especialidades — recursos apartados das clínicas */
      /*#__PURE__*/React.createElement(Card, null,
        /*#__PURE__*/React.createElement(Titulo, { extra: /*#__PURE__*/React.createElement(Cobertura, { g: gEspec }), tooltip: "Especialidades e exames solicitados à CROSS. Recursos (exames, procedimentos) ficam separados das especialidades clínicas pois não competem pelas mesmas vagas." }, "Recursos solicitados"),
        gEspec.itens.length === 0 ? /*#__PURE__*/React.createElement(Vazio, null, "Sem dados") :
        /*#__PURE__*/React.createElement(React.Fragment, null,
          recursos.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null,
            recursos.map(i => /*#__PURE__*/React.createElement(Barra, {
              key: i.canonico, label: i.canonico, n: i.n, pct: i.pct, tag: "recurso",
              max: Math.max(...gEspec.itens.map(x => x.n)), cor: "#8B5CF6" })),
            /*#__PURE__*/React.createElement("div", {
              style: { height: 1, background: "#F1F5F9", margin: "12px 0 13px" } })),
          clinicas.map(i => /*#__PURE__*/React.createElement(Barra, {
            key: i.canonico, label: i.canonico, n: i.n, pct: i.pct,
            max: Math.max(...gEspec.itens.map(x => x.n)), cor: "#6366F1" })),
          naoClass.map(i => /*#__PURE__*/React.createElement(Barra, {
            key: "nc", label: "Não classificado", n: i.n, pct: i.pct,
            max: Math.max(...gEspec.itens.map(x => x.n)), cor: "#CBD5E1" })))),

      /* Hospitais */
      /*#__PURE__*/React.createElement(Card, null,
        /*#__PURE__*/React.createElement(Titulo, { extra: /*#__PURE__*/React.createElement(Cobertura, { g: gHosp }), tooltip: "Hospitais e unidades que receberam os pacientes. Mostra para onde a Santa Casa mais encaminha." }, "Instituições de destino"),
        gHosp.itens.length === 0 ? /*#__PURE__*/React.createElement(Vazio, null, "Sem dados") :
        gHosp.itens.map(i => /*#__PURE__*/React.createElement(Barra, {
          key: i.canonico,
          label: i.canonico === (C && C.NAO_CLASSIFICADO) ? "Não classificado" : i.canonico,
          n: i.n, pct: i.pct, max: gHosp.itens[0].n,
          cor: i.canonico === (C && C.NAO_CLASSIFICADO) ? "#CBD5E1" : "#0EA5E9" }))),

      /* Setor — rótulo honesto: é o que a CROSS informa, não a unidade real */
      /*#__PURE__*/React.createElement(Card, null,
        /*#__PURE__*/React.createElement(Titulo, { extra: /*#__PURE__*/React.createElement(Cobertura, { g: gSetor }), tooltip: "Setor/especialidade solicitante informado na ficha CROSS. Atencao: Clinica Medica indica quem fez o pedido, nao onde o paciente esta internado." }, "Setor informado na CROSS"),
        /*#__PURE__*/React.createElement("div", {
          style: { fontSize: 10.5, color: "#94A3B8", marginTop: -8, marginBottom: 12, lineHeight: 1.5 }
        }, '"Clínica Médica" na ficha indica a especialidade solicitante, não onde o paciente está.'),
        gSetor.itens.length === 0 ? /*#__PURE__*/React.createElement(Vazio, null, "Sem dados") :
        gSetor.itens.map(i => /*#__PURE__*/React.createElement(Barra, {
          key: i.canonico,
          label: i.canonico === (C && C.NAO_CLASSIFICADO) ? "Não classificado" : i.canonico,
          n: i.n, pct: i.pct, max: gSetor.itens[0].n,
          cor: i.canonico === (C && C.NAO_CLASSIFICADO) ? "#CBD5E1" : "#14B8A6" }))),

      /* Status */
      /*#__PURE__*/React.createElement(Card, null,
        /*#__PURE__*/React.createElement(Titulo, { extra: /*#__PURE__*/React.createElement(Cobertura, { g: gStatus }), tooltip: "O que aconteceu com cada remocao: paciente transferido, evadiu, resolvido localmente etc. Campo status da planilha." }, "Desfecho"),
        gStatus.itens.length === 0 ? /*#__PURE__*/React.createElement(Vazio, null, "Sem dados") :
        gStatus.itens.map(i => /*#__PURE__*/React.createElement(Barra, {
          key: i.canonico,
          label: i.canonico === (C && C.NAO_CLASSIFICADO) ? "Não classificado" : i.canonico,
          n: i.n, pct: i.pct, max: gStatus.itens[0].n,
          cor: i.canonico === (C && C.NAO_CLASSIFICADO) ? "#CBD5E1" : "#64748B" }))),

      /* Ambulância */
      /*#__PURE__*/React.createElement(Card, null,
        /*#__PURE__*/React.createElement(Titulo, { extra: /*#__PURE__*/React.createElement(Cobertura, { g: gAmb }), tooltip: "Básica (SBV) = apenas técnico e motorista. Avançada (SAV) = médico a bordo, usada em casos críticos. O percentual de avançada é um indicador de gravidade da demanda." }, "Tipo de ambulância"),
        gAmb.itens.length === 0 ? /*#__PURE__*/React.createElement(Vazio, null, "Sem dados") :
        gAmb.itens.map(i => /*#__PURE__*/React.createElement(Barra, {
          key: i.canonico, label: i.canonico, n: i.n, pct: i.pct, max: gAmb.itens[0].n,
          cor: i.canonico === "AVANÇADA" ? "#F59E0B" : "#64748B" })))
    ),

    /* ══ Pendências de qualidade ══ */
    pendencias.length > 0 && /*#__PURE__*/React.createElement(Card, {
      style: { marginTop: 14, borderColor: "#FDE68A", background: "#FFFBEB" }
    },
      /*#__PURE__*/React.createElement("div", {
        style: { display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" },
        onClick: () => setVerPendencias(v => !v)
      },
        /*#__PURE__*/React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: "#92400E" } },
          pendencias.length, " valor", pendencias.length !== 1 ? "es" : "", " a corrigir"),
        /*#__PURE__*/React.createElement("span", { style: { fontSize: 11, color: "#B45309" } },
          verPendencias ? "ocultar" : "ver e corrigir")),
      verPendencias && /*#__PURE__*/React.createElement("div", { style: { marginTop: 12 } },
        /*#__PURE__*/React.createElement("div", {
          style: { fontSize: 11, color: "#78350F", marginBottom: 10, lineHeight: 1.55 }
        }, "Cada item abre a planilha na linha exata. Enquanto não forem corrigidos, ficam de fora dos indicadores."),
        pendencias.map((p, i) => /*#__PURE__*/React.createElement("a", {
          key: i,
          href: `remocao.html?foco=${encodeURIComponent(p.id)}&campo=${encodeURIComponent(p.campo)}`,
          style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                   fontSize: 11.5, color: "#92400E", padding: "8px 10px", textDecoration: "none",
                   borderTop: i ? "1px solid #FDE68A" : "none", borderRadius: 6,
                   transition: "background .15s" },
          onMouseEnter: e => e.currentTarget.style.background = "#FEF3C7",
          onMouseLeave: e => e.currentTarget.style.background = "transparent"
        },
          /*#__PURE__*/React.createElement("code", {
            style: { background: "#FEF3C7", borderRadius: 4, padding: "2px 6px", fontSize: 11, fontWeight: 600 }
          }, p.valor),
          /*#__PURE__*/React.createElement("span", { style: { color: "#B45309" } }, "em ", p.campo),
          p.sugestao && /*#__PURE__*/React.createElement("span", {
            style: { fontSize: 10.5, color: "#9A3412", background: "#FFEDD5",
                     border: "1px solid #FED7AA", borderRadius: 5, padding: "1px 6px" }
          }, "parece ser de ", p.sugestao),
          /*#__PURE__*/React.createElement("span", {
            style: { marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", color: "#A16207", fontSize: 10.5 }
          },
            p.paciente && /*#__PURE__*/React.createElement("span", null, p.paciente),
            p.ficha && /*#__PURE__*/React.createElement("span", { style: { color: "#CA8A04" } }, p.ficha),
            /*#__PURE__*/React.createElement("span", { style: { fontWeight: 700, color: "#B45309" } }, "corrigir →"))))))
    ,

    /* ══ Discrepâncias de fila ══ */
    discrepancias && discrepancias.length > 0 && React.createElement("div", {
      style:{marginTop:14,background:"#FEF2F2",border:"1px solid #FCA5A5",borderRadius:12,overflow:"hidden"}
    },
      React.createElement("div", {
        onClick:function(){setVerDiscrep(function(v){return !v;});},
        style:{padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}
      },
        React.createElement("div", {style:{display:"flex",alignItems:"center",gap:8}},
          React.createElement("span", {style:{fontSize:13,fontWeight:700,color:"#B91C1C"}},
            "\u26A0\uFE0F " + discrepancias.length + " discrepânci" + (discrepancias.length===1?"a":"as") + " de fila"),
          React.createElement("span", {className:"tip"},
            React.createElement("span", {style:{fontSize:10,color:"#EF4444",border:"1px solid #FCA5A5",borderRadius:99,padding:"1px 6px"}},"?"),
            React.createElement("span", {className:"tipbox"}, "Paciente menos grave com aceite confirmado, mesma especialidade que outro mais grave ainda pendente, sem avaliação médica registrada. Pode indicar inversão de fila.")
          )
        ),
        React.createElement("span", {style:{fontSize:11,color:"#94A3B8"}}, verDiscrep?"ocultar":"ver casos")
      ),
      verDiscrep && React.createElement("div", {style:{padding:"0 16px 14px"}},
        React.createElement("div", {style:{fontSize:11,color:"#64748B",marginBottom:10,lineHeight:1.55}},
          "Cada caso: paciente de menor gravidade teve aceite antes de um mais grave da mesma especialidade, sem prioridade médica definida. ",
          podeJustificar?"Clique em Justificar para registrar a razão clínica.":"Peça ao coordenador médico para justificar."
        ),
        (discrepancias||[]).map(function(disc,i){
          var a=disc.aceitado, b=disc.pendente;
          var gcA=GC[a.grav]||GC.urgencia, gcB=GC[b.grav]||GC.urgencia;
          return React.createElement("div", {
            key:disc.id,
            style:{padding:"10px 0",borderTop:i?"1px solid #FEE2E2":"none",display:"flex",gap:10,alignItems:"flex-start",flexWrap:"wrap"}
          },
            React.createElement("div", {style:{flex:1,minWidth:180}},
              React.createElement("div", {style:{fontSize:11,color:"#374151",marginBottom:3}},
                React.createElement("span", {style:{fontWeight:700,color:gcA.text,background:gcA.bg,border:"1px solid "+gcA.border,borderRadius:4,padding:"1px 5px",fontSize:10}}, gcA.label),
                " ", a.nome, React.createElement("span", {style:{color:"#94A3B8",marginLeft:4,fontSize:10}}, "(aceito \u2022 "+a.rec+")")
              ),
              React.createElement("div", {style:{fontSize:11,color:"#374151"}},
                "espera: ", React.createElement("span", {style:{fontWeight:700,color:gcB.text,background:gcB.bg,border:"1px solid "+gcB.border,borderRadius:4,padding:"1px 5px",fontSize:10}}, gcB.label),
                " ", b.nome
              )
            ),
            podeJustificar && React.createElement("button", {
              onClick:function(){setJustModal(disc);setJustTexto("");},
              style:{flexShrink:0,padding:"5px 14px",border:"none",borderRadius:7,background:"#0F172A",color:"#fff",fontWeight:700,fontSize:11,cursor:"pointer"}
            }, "Justificar")
          );
        })
      )
    ),

    /* ── Modal de justificativa ── */
    justModal && React.createElement("div", {
      onClick:function(e){if(e.target===e.currentTarget)setJustModal(null);},
      style:{position:"fixed",inset:0,background:"rgba(15,23,42,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:16}
    },
      React.createElement("div", {style:{background:"#fff",borderRadius:16,width:"100%",maxWidth:460,boxShadow:"0 20px 60px rgba(0,0,0,.25)",overflow:"hidden"}},
        React.createElement("div", {style:{padding:"14px 20px",borderBottom:"1px solid #F1F5F9",background:"#FEF2F2"}},
          React.createElement("div", {style:{fontSize:10,fontWeight:700,color:"#B91C1C",textTransform:"uppercase",letterSpacing:".05em"}}, "Justificativa de discrepância"),
          React.createElement("div", {style:{fontWeight:700,fontSize:14,color:"#0F172A",marginTop:2}}, "Por que este paciente tem prioridade?")
        ),
        React.createElement("div", {style:{padding:"16px 20px"}},
          React.createElement("div", {style:{background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:8,padding:"10px 12px",marginBottom:14,fontSize:12}},
            React.createElement("div", {style:{fontWeight:700,marginBottom:2}}, justModal.aceitado.nome,
              React.createElement("span", {style:{fontWeight:400,color:"#94A3B8",marginLeft:6,fontSize:11}},
                "(" + ((GC[justModal.aceitado.grav]&&GC[justModal.aceitado.grav].label)||"") + ") \u2022 " + (justModal.aceitado.rec||""))),
            React.createElement("div", {style:{fontSize:11,color:"#64748B",marginTop:4}},
              "Aguarda: ", justModal.pendente.nome, " (", (GC[justModal.pendente.grav]&&GC[justModal.pendente.grav].label)||"", ")")
          ),
          React.createElement("label", {style:{fontSize:11,fontWeight:700,color:"#374151",display:"block",marginBottom:6}}, "Justificativa cl\xednica *"),
          React.createElement("textarea", {
            rows:4, value:justTexto,
            onChange:function(e){setJustTexto(e.target.value);},
            placeholder:"Ex: Protocolo de dor tor\xe1cica, aguarda exame. Complicação aguda justifica prioridade...",
            style:{width:"100%",padding:"9px 11px",border:"1.5px solid #E2E8F0",borderRadius:8,fontSize:13,fontFamily:"inherit",resize:"vertical",outline:"none",lineHeight:1.5}
          })
        ),
        React.createElement("div", {style:{padding:"10px 20px",borderTop:"1px solid #F1F5F9",display:"flex",gap:8,justifyContent:"flex-end"}},
          React.createElement("button", {onClick:function(){setJustModal(null);},style:{padding:"7px 16px",borderRadius:8,border:"1px solid #E2E8F0",background:"none",color:"#64748B",fontWeight:600,fontSize:13,cursor:"pointer"}}, "Cancelar"),
          React.createElement("button", {
            disabled:!justTexto.trim()||justSaving,
            onClick:async function(){
              if(!justTexto.trim())return; setJustSaving(true);
              var d=justModal;
              try{
                await fetch(SB_URL+"/rest/v1/discrepancia_justificativas",{method:"POST",headers:Object.assign({},H(),{Prefer:"return=minimal"}),body:JSON.stringify({card_id:d.aceitado.id,card_nome:d.aceitado.nome,card_grav:d.aceitado.grav,conflito_card_id:d.pendente.id,conflito_card_nome:d.pendente.nome,conflito_card_grav:d.pendente.grav,justificativa:justTexto.trim(),justificado_por_nome:(currentUser&&currentUser.nome)||""})});
                setJustModal(null); showT("Justificativa registrada.");
              }catch(ex){showT("Erro ao salvar: "+ex.message,"err");}
              setJustSaving(false);
            },
            style:{padding:"7px 20px",borderRadius:8,border:"none",background:"#0F172A",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",opacity:(!justTexto.trim()||justSaving)?0.6:1}
          }, justSaving?"Salvando...":"Registrar")
        )
      )
    ),

    /* Rodapé honesto sobre a base */
    /*#__PURE__*/React.createElement("div", {
      style: { fontSize: 10.5, color: "#CBD5E1", marginTop: 18, lineHeight: 1.6 }
    }, "Indicadores calculados sobre a planilha de remoções. ",
       "Percentuais usam como denominador os registros que informaram cada campo — o número aparece ao lado de cada bloco.")
  );
}

function PublicationsHistory({
  onRestoreSnapshot
}) {
  const [pubs, setPubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  useEffect(() => {
    sbGet("publications", "order=created_at.desc&limit=50").then(rows => {
      setPubs(rows);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);
  function handleRestore(pub) {
    if (!window.confirm(`Restaurar o kanban para a versão de "${pub.label}"?

Isso vai substituir a visualização atual pelos dados desse snapshot.`)) return;
    const snap = pub.snapshot || {};
    onRestoreSnapshot(snap.cards || [], snap.cols || []);
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 16,
      color: "#0F172A",
      marginBottom: 4
    }
  }, "Histórico de publicações"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#64748B",
      marginBottom: 16
    }
  }, "Todas as versões publicadas — clique para expandir e restaurar"), loading && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: 32,
      color: "#94A3B8"
    }
  }, "Carregando…"), !loading && pubs.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: 32,
      color: "#CBD5E1",
      fontSize: 13
    }
  }, "Nenhuma publicação registrada."), pubs.map((pub, i) => {
    const isAuto = pub.label?.includes("automático");
    const snap = pub.snapshot || {};
    const cards = snap.cards || [];
    const isExp = expanded === pub.id;
    const cols = snap.cols || [];
    return /*#__PURE__*/React.createElement("div", {
      key: pub.id,
      style: {
        background: "#fff",
        border: "1px solid #E2E8F0",
        borderRadius: 10,
        marginBottom: 8,
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement("div", {
      onClick: () => setExpanded(isExp ? null : pub.id),
      style: {
        padding: "12px 16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        cursor: "pointer",
        background: isExp ? "#F8FAFC" : "#fff"
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
        fontSize: 12,
        fontWeight: 700,
        color: "#0F172A"
      }
    }, isAuto?(pub.label||"Snapshot automático"):("Publicação " + new Date(pub.created_at).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}))), isAuto && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        fontWeight: 700,
        padding: "1px 5px",
        borderRadius: 3,
        background: "#F1F5F9",
        color: "#94A3B8"
      }
    }, "AUTO")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10,
        color: "#94A3B8"
      }
    }, new Date(pub.created_at).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }), pub.published_by_nome && /*#__PURE__*/React.createElement("span", null, " · por ", pub.published_by_nome), /*#__PURE__*/React.createElement("span", null, " · ", cards.length, " pacientes"))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: e => {
        e.stopPropagation();
        handleRestore(pub);
      },
      style: {
        padding: "4px 12px",
        border: "1px solid #BFDBFE",
        borderRadius: 6,
        background: "none",
        color: "#1E40AF",
        cursor: "pointer",
        fontSize: 11,
        fontWeight: 600
      }
    }, "Restaurar"), /*#__PURE__*/React.createElement("span", {
      style: {
        color: "#CBD5E1",
        fontSize: 13
      }
    }, isExp ? "▲" : "▼"))), isExp && /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "0 16px 14px",
        borderTop: "1px solid #F1F5F9"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        marginTop: 10
      }
    }, cols.map(col => {
      const n = cards.filter(c => c.col_id === col.id).length;
      return /*#__PURE__*/React.createElement("div", {
        key: col.id,
        style: {
          background: "#F8FAFC",
          borderRadius: 7,
          padding: "6px 12px",
          display: "flex",
          gap: 6,
          alignItems: "center"
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12
        }
      }, col.emoji), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 11,
          color: "#374151"
        }
      }, col.label), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12,
          fontWeight: 700,
          color: "#0F172A"
        }
      }, n));
    })), cards.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10,
        maxHeight: 200,
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
    }, "Pacientes neste snapshot"), cards.slice(0, 20).map((c, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        fontSize: 11,
        color: "#374151",
        padding: "3px 0",
        borderBottom: "1px solid #F8FAFC"
      }
    }, c.nome, " ", c.idade ? "· " + c.idade : "", " ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: "#94A3B8"
      }
    }, "(", c.hd, ")"))), cards.length > 20 && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10,
        color: "#94A3B8",
        marginTop: 4
      }
    }, "…e mais ", cards.length - 20, " pacientes"))));
  }));
}