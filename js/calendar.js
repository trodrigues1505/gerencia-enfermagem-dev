/* ─── CALENDÁRIO ─── */
function CalendarView({
  cards,
  cols
}) {
  const today = new Date();
  const [viewMode, setViewMode] = useState("month");
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState(null);
  const [filterCol, setFilterCol] = useState("all");
  const [dateSources, setDateSources] = useState({
    adm: true,
    aceite: true,
    criado: false,
    saida: false,
    retorno: false
  });
  const [rangeStart, setRangeStart] = useState(() => today.toISOString().split("T")[0]);
  const [rangeEnd, setRangeEnd] = useState(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 6);
    return d.toISOString().split("T")[0];
  });
  const colLabel = cols.reduce((acc, c) => ({
    ...acc,
    [c.id]: c.label
  }), {});
  function parseDate(str, refYear) {
    if (!str) return null;
    if (str.includes("T")) return new Date(str);
    const parts = str.split("/");
    if (parts.length < 2) return null;
    const d = parseInt(parts[0]),
      m = parseInt(parts[1]) - 1;
    const y = parts.length >= 3 ? parseInt(parts[2]) : refYear;
    const fullY = y < 100 ? 2000 + y : y;
    const dt = new Date(fullY, m, d);
    return isNaN(dt.getTime()) ? null : dt;
  }
  function getCardDates(c) {
    const dates = [];
    const push = (dt, label) => {
      if (dt) dates.push({
        date: dt,
        label,
        col: c.col_id,
        card: c
      });
    };
    if (dateSources.adm) push(parseDate(c.adm, year), "Admissão");
    if (dateSources.aceite) push(parseDate(c.data_aceite, year), "Aceite");
    if (dateSources.criado && c.created_at) push(new Date(c.created_at), "Criado");
    if (dateSources.saida) push(parseDate(c.saida, year), "Saída");
    if (dateSources.retorno) push(parseDate(c.retorno, year), "Retorno");
    return dates;
  }
  const filteredCards = filterCol === "all" ? cards : cards.filter(c => c.col_id === filterCol);
  const cardsByDay = {};
  filteredCards.forEach(c => {
    getCardDates(c).forEach(({
      date,
      label,
      col,
      card
    }) => {
      const key = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
      if (!cardsByDay[key]) cardsByDay[key] = [];
      cardsByDay[key].push({
        card,
        label,
        col
      });
    });
  });
  const SRC_OPTS = [{
    k: "adm",
    label: "Admissão",
    color: "#F59E0B"
  }, {
    k: "aceite",
    label: "Aceite",
    color: "#3B82F6"
  }, {
    k: "criado",
    label: "Criado",
    color: "#8B5CF6"
  }, {
    k: "saida",
    label: "Saída",
    color: "#16A34A"
  }, {
    k: "retorno",
    label: "Retorno",
    color: "#EC4899"
  }];
  const SRC_COLOR = SRC_OPTS.reduce((acc, o) => ({
    ...acc,
    [o.k]: o.color
  }), {});
  const labelToSrc = {
    "Admissão": "adm",
    "Aceite": "aceite",
    "Criado": "criado",
    "Saída": "saida",
    "Retorno": "retorno"
  };
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const todayKey = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear(y => y - 1);
    } else setMonth(m => m - 1);
    setSelected(null);
  }
  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear(y => y + 1);
    } else setMonth(m => m + 1);
    setSelected(null);
  }
  function toggleSrc(k) {
    setDateSources(p => ({
      ...p,
      [k]: !p[k]
    }));
    setSelected(null);
  }
  function getRangeDays() {
    const days = [];
    const s = new Date(rangeStart + "T00:00:00");
    const e = new Date(rangeEnd + "T00:00:00");
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return days;
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      days.push({
        key,
        date: new Date(d),
        cards: cardsByDay[key] || []
      });
    }
    return days.slice(0, 62);
  }
  const Controls = () => /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 10,
      alignItems: "center"
    }
  }, SRC_OPTS.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.k,
    onClick: () => toggleSrc(o.k),
    style: {
      padding: "3px 9px",
      borderRadius: 5,
      fontSize: 10,
      fontWeight: 600,
      cursor: "pointer",
      transition: "all .12s",
      background: dateSources[o.k] ? o.color : "#F1F5F9",
      color: dateSources[o.k] ? "#fff" : "#64748B",
      border: `1px solid ${dateSources[o.k] ? o.color : "#E2E8F0"}`
    }
  }, o.label)), /*#__PURE__*/React.createElement("select", {
    value: filterCol,
    onChange: e => setFilterCol(e.target.value),
    style: {
      padding: "4px 8px",
      border: "1px solid #E2E8F0",
      borderRadius: 6,
      fontSize: 11,
      background: "#fff",
      color: "#374151",
      fontFamily: "inherit",
      marginLeft: "auto"
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "Todas as colunas"), cols.map(c => /*#__PURE__*/React.createElement("option", {
    key: c.id,
    value: c.id
  }, c.label))));
  const DayDetail = () => selected && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      background: "#fff",
      border: "1px solid #E2E8F0",
      borderRadius: 10,
      padding: "12px 16px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 13,
      color: "#0F172A"
    }
  }, selected.day, " — ", selected.cards.length, " evento", selected.cards.length !== 1 ? "s" : ""), /*#__PURE__*/React.createElement("button", {
    onClick: () => setSelected(null),
    style: {
      background: "none",
      border: "none",
      cursor: "pointer",
      color: "#94A3B8",
      fontSize: 16
    }
  }, "✕")), selected.cards.map((item, i) => {
    const gc = {
      emergencia: "#EF4444",
      urgencia: "#EAB308",
      andamento_cor: "#F59E0B",
      menor_gravidade: "#22C55E",
      finalizado_cor: "#A855F7",
      agendamento: "#94A3B8",
      retorno: "#EC4899"
    };
    const dot = gc[item.card.grav] || "#EAB308";
    const srcColor = SRC_COLOR[labelToSrc[item.label] || "adm"] || "#94A3B8";
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: "flex",
        gap: 8,
        padding: "7px 0",
        borderBottom: i < selected.cards.length - 1 ? "1px solid #F1F5F9" : "none",
        alignItems: "flex-start"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 3,
        minHeight: 28,
        borderRadius: 99,
        background: dot,
        flexShrink: 0
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 5,
        alignItems: "center",
        marginBottom: 1
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: "#0F172A"
      }
    }, item.card.nome), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        fontWeight: 700,
        padding: "1px 5px",
        borderRadius: 3,
        background: srcColor + "20",
        color: srcColor
      }
    }, item.label)), item.card.hd && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10,
        color: "#64748B"
      }
    }, item.card.hd), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 9,
        color: "#94A3B8"
      }
    }, colLabel[item.card.col_id])));
  }));
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 2,
      marginBottom: 10,
      background: "#F1F5F9",
      borderRadius: 8,
      padding: 2,
      width: "fit-content"
    }
  }, [["month", "📅 Mês"], ["range", "📆 Período"]].map(([id, label]) => /*#__PURE__*/React.createElement("button", {
    key: id,
    onClick: () => {
      setViewMode(id);
      setSelected(null);
    },
    style: {
      padding: "5px 14px",
      borderRadius: 6,
      border: "none",
      fontSize: 11,
      fontWeight: viewMode === id ? 700 : 400,
      background: viewMode === id ? "#0F172A" : "transparent",
      color: viewMode === id ? "#fff" : "#64748B",
      cursor: "pointer"
    }
  }, label))), /*#__PURE__*/React.createElement(Controls, null), viewMode === "month" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: prevMonth,
    style: {
      background: "#fff",
      border: "1px solid #E2E8F0",
      borderRadius: 6,
      padding: "4px 10px",
      cursor: "pointer",
      fontSize: 13,
      fontWeight: 700
    }
  }, "‹"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 13,
      color: "#0F172A",
      minWidth: 140,
      textAlign: "center"
    }
  }, monthNames[month], " ", year), /*#__PURE__*/React.createElement("button", {
    onClick: nextMonth,
    style: {
      background: "#fff",
      border: "1px solid #E2E8F0",
      borderRadius: 6,
      padding: "4px 10px",
      cursor: "pointer",
      fontSize: 13,
      fontWeight: 700
    }
  }, "›"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setMonth(today.getMonth());
      setYear(today.getFullYear());
      setSelected(null);
    },
    style: {
      background: "#0F172A",
      border: "none",
      borderRadius: 5,
      padding: "4px 10px",
      cursor: "pointer",
      fontSize: 11,
      fontWeight: 600,
      color: "#fff"
    }
  }, "Hoje")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#fff",
      borderRadius: 10,
      border: "1px solid #E2E8F0",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(7,1fr)",
      background: "#F8FAFC",
      borderBottom: "1px solid #E2E8F0"
    }
  }, weekDays.map(d => /*#__PURE__*/React.createElement("div", {
    key: d,
    style: {
      padding: "6px 3px",
      textAlign: "center",
      fontSize: 9,
      fontWeight: 700,
      color: "#94A3B8",
      textTransform: "uppercase",
      letterSpacing: ".05em"
    }
  }, d))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(7,1fr)"
    }
  }, Array.from({
    length: firstWeekday
  }).map((_, i) => /*#__PURE__*/React.createElement("div", {
    key: "e" + i,
    style: {
      minHeight: 68,
      borderBottom: "1px solid #F1F5F9",
      borderRight: "1px solid #F1F5F9",
      background: "#FAFAFA"
    }
  })), Array.from({
    length: daysInMonth
  }).map((_, idx) => {
    const day = idx + 1;
    const key = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
    const dayCards = cardsByDay[key] || [];
    const isToday = key === todayKey;
    const isSel = selected?.key === key;
    const dayLabel = monthNames[month].slice(0, 3) + " " + day;
    return /*#__PURE__*/React.createElement("div", {
      key: day,
      onClick: () => setSelected(dayCards.length ? {
        key,
        day: dayLabel,
        cards: dayCards
      } : null),
      style: {
        minHeight: 68,
        borderBottom: "1px solid #F1F5F9",
        borderRight: "1px solid #F1F5F9",
        padding: "3px",
        cursor: dayCards.length ? "pointer" : "default",
        background: isSel ? "#EFF6FF" : isToday ? "#FFF7ED" : "#fff",
        transition: "background .1s"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10,
        fontWeight: isToday ? 700 : 500,
        color: isToday ? "#C2410C" : "#374151",
        marginBottom: 1,
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: isToday ? "#FED7AA" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, day), dayCards.slice(0, 3).map((item, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        fontSize: 8,
        fontWeight: 600,
        padding: "1px 3px",
        borderRadius: 2,
        marginBottom: 1,
        background: (SRC_COLOR[labelToSrc[item.label] || "adm"] || "#94A3B8") + "25",
        color: SRC_COLOR[labelToSrc[item.label] || "adm"] || "#94A3B8",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, item.label[0], ": ", item.card.nome.split(" ")[0])), dayCards.length > 3 && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 8,
        color: "#94A3B8",
        fontWeight: 600
      }
    }, "+", dayCards.length - 3));
  }))), /*#__PURE__*/React.createElement(DayDetail, null)), viewMode === "range" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      marginBottom: 12,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: "#64748B"
    }
  }, "De"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: rangeStart,
    onChange: e => {
      setRangeStart(e.target.value);
      setSelected(null);
    },
    style: {
      padding: "5px 8px",
      border: "1px solid #E2E8F0",
      borderRadius: 6,
      fontSize: 11,
      fontFamily: "inherit"
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: "#64748B"
    }
  }, "até"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: rangeEnd,
    onChange: e => {
      setRangeEnd(e.target.value);
      setSelected(null);
    },
    style: {
      padding: "5px 8px",
      border: "1px solid #E2E8F0",
      borderRadius: 6,
      fontSize: 11,
      fontFamily: "inherit"
    }
  })), [["7d", "7 dias"], ["14d", "14 dias"], ["30d", "30 dias"]].map(([code, label]) => /*#__PURE__*/React.createElement("button", {
    key: code,
    onClick: () => {
      const s = new Date();
      const e = new Date();
      e.setDate(e.getDate() + (code === "7d" ? 6 : code === "14d" ? 13 : 29));
      setRangeStart(s.toISOString().split("T")[0]);
      setRangeEnd(e.toISOString().split("T")[0]);
      setSelected(null);
    },
    style: {
      padding: "4px 8px",
      border: "1px solid #E2E8F0",
      borderRadius: 5,
      background: "#fff",
      color: "#64748B",
      cursor: "pointer",
      fontSize: 10
    }
  }, label))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 4
    }
  }, getRangeDays().map(({
    key,
    date,
    cards: dayCards
  }) => {
    if (!dayCards.length) return null;
    const isToday = key === todayKey;
    const isSel = selected?.key === key;
    const dayLabel = date.toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit"
    });
    return /*#__PURE__*/React.createElement("div", {
      key: key,
      onClick: () => setSelected({
        key,
        day: dayLabel,
        cards: dayCards
      }),
      style: {
        display: "flex",
        gap: 10,
        padding: "8px 12px",
        borderRadius: 8,
        cursor: "pointer",
        background: isSel ? "#EFF6FF" : isToday ? "#FFF7ED" : "#fff",
        border: `1px solid ${isSel ? "#BFDBFE" : isToday ? "#FDE68A" : "#E2E8F0"}`,
        transition: "background .1s"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 80,
        fontWeight: isToday ? 700 : 600,
        fontSize: 11,
        color: isToday ? "#C2410C" : "#374151"
      }
    }, dayLabel), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        display: "flex",
        gap: 4,
        flexWrap: "wrap"
      }
    }, dayCards.map((item, i) => {
      const srcColor = SRC_COLOR[labelToSrc[item.label] || "adm"] || "#94A3B8";
      return /*#__PURE__*/React.createElement("span", {
        key: i,
        style: {
          fontSize: 9,
          fontWeight: 600,
          padding: "1px 5px",
          borderRadius: 3,
          background: srcColor + "20",
          color: srcColor,
          whiteSpace: "nowrap"
        }
      }, item.label[0], ": ", item.card.nome.split(" ")[0]);
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: "#94A3B8",
        flexShrink: 0
      }
    }, dayCards.length, " evento", dayCards.length !== 1 ? "s" : ""));
  }), getRangeDays().filter(d => d.cards.length).length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "32px",
      color: "#CBD5E1",
      fontSize: 12
    }
  }, "Nenhum evento no período selecionado.")), /*#__PURE__*/React.createElement(DayDetail, null)));
}