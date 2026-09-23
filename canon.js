/* ============================================================================
 * canon.js — Canonicalização de domínio — Regulação SCFM
 * ----------------------------------------------------------------------------
 * Peça única compartilhada por index.html (Kanban) e remocao.html (Planilha).
 * Sem dependências, sem rede, sem chave de API.
 *
 * Duas funções na operação:
 *   1. AGREGAÇÃO  — o dashboard agrupa pelo canônico, não pela string crua.
 *   2. VALIDAÇÃO  — o import barra valor que pertence a outro campo.
 *
 * Regra de ouro: valor desconhecido NUNCA é adivinhado. Vira NAO_CLASSIFICADO
 * e aparece na tela de pendências para decisão humana.
 * ==========================================================================*/

(function (root) {
  "use strict";

  var NAO_CLASSIFICADO = "__NAO_CLASSIFICADO__";
  var NAO_INFORMADO    = "__NAO_INFORMADO__";

  /* ── Normalizador base ────────────────────────────────────────────────────
   * Resolve a duplicata invisível de "TOMOGRAFIA" (31 + 1): dois valores
   * visualmente idênticos que diferiam por caractere não-imprimível.
   * Ordem importa: NFD antes de remover diacríticos; pontuação antes de
   * colapsar espaço (senão "C.GERAL" != "C. GERAL").
   */
  function norm(v) {
    if (v === null || v === undefined) return "";
    return String(v)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")   // diacríticos
      .replace(/[\u00a0\u200b-\u200d\ufeff]/g, " ") // nbsp, zero-width
      .replace(/[.\-_/\\,;:º°ª'"()\[\]]/g, " ")     // pontuação -> espaço
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  /* Valores que significam "vazio" mesmo tendo texto. */
  var VAZIOS = ["", "N A", "NA", "NAO INFORMADO", "SEM INFORMACAO", "-", "?",
                "NENHUM", "NAO SE APLICA", "INDEFINIDO"];

  function isVazio(v) { return VAZIOS.indexOf(norm(v)) !== -1; }

  /* Constrói índice alias->canônico a partir de {canônico: [aliases]} */
  function idx(mapa) {
    var out = {};
    Object.keys(mapa).forEach(function (canon) {
      out[norm(canon)] = canon;
      mapa[canon].forEach(function (a) { out[norm(a)] = canon; });
    });
    return out;
  }

  /* ══ HOSPITAIS ═══════════════════════════════════════════════════════════
   * 15 grafias -> 6 instituições. Dicionário explícito, nunca fuzzy:
   * "SANTA CASA SAO PAULO" e "HOSPITAL SAO PAULO" são instituições
   * DIFERENTES, e qualquer similaridade de string funde as duas. "SCSP"
   * também não tem distância computável até "Santa Casa".
   * Lacaz = Hospital de Francisco Morato — confirmado pelo usuário.
   */
  var HOSPITAIS = idx({
    "Hospital Dr. Albano da Franca Rocha Sobrinho": [
      "HOSP DR ALBANO FRANCA ROCHA SOBRINHO", "HOSPITAL ALBANO", "ALBANO",
      "HOSPITAL DR ALBANO", "ALBANO DA FRANCA ROCHA SOBRINHO", "HDAFRS"
    ],
    "Hospital de Francisco Morato": [
      "HOSP FRANCISCO MORATO", "HOSPITAL LACAZ", "LACAZ",
      "HOSPITAL DE FRANCISCO MORATO", "HOSPITAL FRANCISCO MORATO",
      "HFM", "HOSP LACAZ"
    ],
    "Santa Casa de São Paulo": [
      "SANTA CASA SAO PAULO", "SCSP", "HOSPITAL SANTA CASA DE SAO PAULO",
      "SANTA CASA DE SAO PAULO", "SANTA CASA SP", "ISCMSP"
    ],
    "Hospital São Paulo — UNIFESP": [
      "HOSP SAO PAULO UNIFESP", "HOSPITAL SAO PAULO", "UNIFESP",
      "HOSPITAL SAO PAULO UNIFESP", "HSP UNIFESP"
    ],
    "IMON": ["IMON", "INSTITUTO IMON"],
    "CAISM": ["CAISM", "CAISM UNICAMP"]
  });

  /* ══ STATUS ══════════════════════════════════════════════════════════════
   * 9 valores -> 5 desfechos. As 3 grafias de "encerrada pela CROSS"
   * (ENCERRADA PELO / FINALIZADA PELA / FINALIZADA VIA) são o mesmo evento.
   * HEMODIÁLISE NÃO entra aqui: é procedimento vazado de outro campo,
   * detectado por ehVazamento() abaixo.
   */
  var STATUS = idx({
    "Encerrada pela CROSS": [
      "FICHA ENCERRADA PELO CROSS", "FICHA ENCERRADA PELA CROSS",
      "FICHA FINALIZADA PELA CROSS", "FICHA FINALIZADA VIA CROSS",
      "FICHA FINALIZADA", "REMOCAO CONCLUIDA", "CONCLUIDO"
    ],
    "Cancelada pelo solicitante": [
      "FICHA CANCELADA PELO SOLICITANTE", "FICHA CANCELADA", "CANCELADA"
    ],
    "Aguardando ambulância": [
      "PACIENTE AGUARDANDO AMBULANCIA", "AGUARDANDO AMBULANCIA"
    ],
    "Em remoção": ["PACIENTE EM REMOCAO", "EM REMOCAO"],
    "Resolvido com recursos locais": [
      "RESOLVIDO COM RECURSOS LOCAIS", "RESOLVIDO LOCALMENTE",
      "NAO REALIZADA", "REMOCAO NAO REALIZADA"
    ]
  });

  /* Status que contam como desfecho fechado (para taxa de conclusão). */
  var STATUS_FECHADOS = ["Encerrada pela CROSS", "Cancelada pelo solicitante",
                         "Resolvido com recursos locais"];

  /* ══ GRAVIDADE ═══════════════════════════════════════════════════════════
   * CINZA/agendamento ENTRA no denominador — decisão do usuário.
   * "urgencia" minúsculo é a chave interna do Kanban que pode vazar crua
   * pelo `gravidade: data.grav || "urgencia"` (index.html linha 5745).
   */
  var GRAVIDADE = idx({
    "Vermelho":  ["VERMELHO", "EMERGENCIA", "EMERGENCIA VERMELHO", "0"],
    "Amarelo":   ["AMARELO", "URGENCIA", "1"],
    "Verde":     ["VERDE", "MENOR GRAVIDADE", "POUCO URGENTE", "2"],
    "Cinza":     ["CINZA", "AGENDAMENTO", "AGENDADO", "ELETIVO", "RETORNO", "3"]
  });

  var GRAVIDADE_ORDEM = ["Vermelho", "Amarelo", "Verde", "Cinza"];
  var GRAVIDADE_COR   = { "Vermelho":"#DC2626", "Amarelo":"#D97706",
                          "Verde":"#16A34A",   "Cinza":"#64748B" };

  /* ══ AMBULÂNCIA ══════════════════════════════════════════════════════════
   * SBV/SAV são a nomenclatura corrente do CROSS e hoje viram null
   * silenciosamente em normalizeAmbValue (remocao.html linha 700) — provável
   * origem de boa parte dos 56 nulos (44% da base).
   */
  var AMBULANCIA = idx({
    "BÁSICA":   ["BASICA", "BASICO", "SBV", "USB", "UNIDADE DE SUPORTE BASICO"],
    "AVANÇADA": ["AVANCADA", "AVANCADO", "SAV", "USA", "UTI MOVEL",
                 "UNIDADE DE SUPORTE AVANCADO"]
  });

  /* ══ SETOR ═══════════════════════════════════════════════════════════════
   * Dois vocabulários misturados num campo só:
   *   - nomenclatura CROSS (CLÍNICA MÉDICA, PEDIATRIA...) — 108 registros
   *   - notação de leito do Kanban (CM/L.14, CM - L11...) — 13 registros
   *     em 11 grafias, vindas do campo livre "Setor / Leito".
   * Por isso separamos unidade (agrega) de leito (detalhe do card).
   *
   * ATENÇÃO — o usuário confirmou: "CLÍNICA MÉDICA" na ficha do CROSS
   * indica a especialidade solicitante, NÃO onde o paciente está. Logo este
   * campo NÃO reproduz o indicador "Por unidade" do Painel de Bordo.
   * Rotular no dashboard como "Setor informado na CROSS".
   */
  var SETOR_UNIDADE = idx({
    "Pronto Socorro": [
      "OBSERVACAO ADULTO", "EMERGENCIA", "OBS", "OBSERVACAO", "PS",
      "PRONTO SOCORRO", "PA", "SALA DE EMERGENCIA"
    ],
    "Pronto Socorro Infantil": [
      "OBSERVACAO INFANTIL", "OBS INFANTIL", "PS INFANTIL"
    ],
    "Clínica Médica":    ["CLINICA MEDICA", "CM", "ENFERMARIA", "ENF"],
    "Clínica Pediátrica":["CLINICA PEDIATRICA", "CP", "PED"],
    /* "PEDIATRIA" na CROSS é AMBÍGUO — pode ser PS infantil ou clínica.
     * Bucket próprio em vez de forçar um dos dois: 14 registros (11%) que
     * não podem ser atribuídos sem inventar. O dashboard exibe como
     * "Pediatria (não especificado)" e a origem se resolve no preenchimento. */
    "Pediatria (não especificado)": ["PEDIATRIA"],
    "UTI":               ["UTI", "UNIDADE DE TERAPIA INTENSIVA", "UTI ADULTO"],
    "UTI Pediátrica":    ["UTI PEDIATRICA", "UTI PED", "UTIP"],
    "Maternidade":       ["MATERNIDADE", "CENTRO OBSTETRICO", "CO"]
  });

  /* Extrai {unidade, leito} de "CM / L.14", "CM - L11", "UTI L04", "OBS". */
  function parseSetor(v) {
    if (isVazio(v)) return { unidade: NAO_INFORMADO, leito: null, raw: v };
    var n = norm(v);                       // "CM / L.14" -> "CM L 14"
    var m = n.match(/^(.*?)\s*\bL?\s*(\d{1,3})$/); // leito no fim
    var leito = null, corpo = n;
    if (m && m[1].trim()) { corpo = m[1].trim(); leito = m[2].replace(/^0+/, "") || "0"; }
    // remove "L" solto que sobrou de "L.14" -> "L 14"
    corpo = corpo.replace(/\s+L$/, "").trim();
    var uni = SETOR_UNIDADE[corpo];
    return { unidade: uni || NAO_CLASSIFICADO, leito: leito, raw: v };
  }

  /* ══ ESPECIALIDADE / RECURSO ═════════════════════════════════════════════
   * Decisões do usuário aplicadas:
   *   1. "Exames" é categoria ampla (TC hoje, RM e outros no futuro)
   *   2. Cateterismo/arteriografia/angiografia -> Cardiologia
   *   3. C. Torácica -> grupo Cirurgia
   *   4. Cirurgia Pediátrica -> linha própria
   *
   * `grupo` separa RECURSO de CLÍNICA: exames são 27% da base e não
   * competem com especialidades — estão em outra dimensão. O dashboard
   * deve exibi-los visualmente apartados.
   */
  var ESPEC_META = {
    "Exames":               { grupo: "recurso" },
    "Vaga de UTI":          { grupo: "recurso" },
    "Vaga de enfermaria":   { grupo: "recurso" },
    "Ortopedia":            { grupo: "clinica" },
    "Cirurgia":             { grupo: "clinica" },
    "Cirurgia Pediátrica":  { grupo: "clinica" },
    "Psiquiatria":          { grupo: "clinica" },
    "Cardiologia":          { grupo: "clinica" },
    "Neurologia":           { grupo: "clinica" },
    "Nefrologia":           { grupo: "clinica" },
    "Urologia":             { grupo: "clinica" },
    "Obstetrícia":          { grupo: "clinica" },
    "Outros":               { grupo: "clinica" }
  };

  var ESPECIALIDADE = idx({
    "Exames": [
      "TOMOGRAFIA", "TOMOGRAFIA COMPUTADORIZADA", "TC", "TC ARO", "ANGIO TC",
      "ANGIOTOMOGRAFIA", "RESSONANCIA MAGNETICA", "RM", "RNM",
      "EXAME", "EXAMES", "ULTRASSONOGRAFIA", "USG", "RAIO X", "RX"
    ],
    "Vaga de UTI": [
      "VAGA DE UTI", "UTI", "UTI PEDIATRICA", "UTI PEDIATRIA", "UTI ADULTO",
      "VAGA UTI", "LEITO DE UTI"
    ],
    // Pedido de leito de enfermaria. Nao e vazamento do campo setor: assim
    // como "UTI Pediatrica", o que a ficha do CROSS registra e o RECURSO
    // solicitado — e um leito de enfermaria e um recurso como qualquer outro.
    "Vaga de enfermaria": [
      "CLINICA MEDICA", "ENFERMARIA", "ENFERMARIA ADULTO",
      "ENFERMARIA PEDIATRICA", "VAGA DE ENFERMARIA", "VAGA ENFERMARIA",
      "LEITO DE ENFERMARIA", "CLINICA PEDIATRICA", "ENFERMARIA ADULTA",
      // "clinico geral" e sinonimo de "clinica medica" no preenchimento
      "CLINICO GERAL", "CLINICA GERAL", "CLINICO", "MEDICO CLINICO",
      "AVALIACAO CLINICA"
    ],
    "Ortopedia":   ["ORTOPEDIA", "ORTOPEDISTA", "ORTO", "TRAUMATOLOGIA"],
    "Cirurgia": [
      "CIRURGIA GERAL", "C GERAL", "CIRURGIA", "C TORACICA",
      "CIRURGIA TORACICA", "VASCULAR", "CIRURGIA VASCULAR",
      "BUCO MAXILO", "CIRURGIA BUCOMAXILO", "BUCOMAXILO",
      "CIRURGIA BUCO MAXILO FACIAL"
    ],
    "Cirurgia Pediátrica": [
      "CIRURGIA PEDIATRICA", "C PEDIATRICA", "CIR PEDIATRICA"
    ],
    "Psiquiatria": ["PSIQUIATRIA", "PSIQUIATRA", "SAUDE MENTAL"],
    "Cardiologia": [
      "CARDIOLOGIA", "CARDIOLOGISTA", "CARDIO",
      "CATETERISMO CARDIACO HEMODINAMICA ARTERIOGRAFIA ANGIOGRAFIA",
      "CATETERISMO CARDIACO", "CATETERISMO", "HEMODINAMICA",
      "ARTERIOGRAFIA", "ANGIOGRAFIA"
    ],
    "Neurologia": [
      "NEUROLOGIA", "NEUROLOGISTA", "NEURO", "NEUROCIRURGIA",
      "AVALIACAO PRIMARIA PARA PACIENTE COM AVC", "AVC"
    ],
    "Nefrologia":  ["NEFROLOGIA", "NEFROLOGISTA", "HEMODIALISE", "DIALISE"],
    // Avaliacao por clinico — especialidade medica, NAO pedido de leito.
    // "CLINICA MEDICA" sozinho e vaga de enfermaria (ver acima); "CLINICO
    // GERAL" e consulta. Pedidos diferentes, categorias diferentes.
    "Urologia":    ["UROLOGIA", "UROLOGISTA"],
    "Obstetrícia": [
      "OBSTETRICIA", "OBSTETRICIA ALTO RISCO", "GESTANTE ALTO RISCO",
      "ALTO RISCO"
    ],
    "Outros": [
      "OFTALMOLOGIA", "OFTALMO", "OTORRINOLARINGOLOGIA", "OTORRINO", "ORL",
      "GINECOLOGIA", "GINECO", "HEMATOLOGIA", "SANGUE", "ENDOCRINOLOGIA",
      "GASTROENTEROLOGIA", "PNEUMOLOGIA", "REUMATOLOGIA", "DERMATOLOGIA",
      "INFECTOLOGIA", "OUTROS"
    ]
  });

  /* ══ DETECÇÃO DE VAZAMENTO ENTRE CAMPOS ══════════════════════════════════
   * 7 casos confirmados na base:
   *   TOMOGRAFIA em instituicao_destino  (o bug que abriu a investigação)
   *   HEMODIALISE em status
   *   SANTA CASA FRANCISCO MORATO em setor
   *   CLINICA MEDICA e ENFERMARIA em especialidade
   * Causa: fallback sem cabeçalho do PasteModal desloca o lote inteiro
   * (procedimento, coluna 251, costuma faltar na cópia do CROSS).
   * Aqui detectamos a CONSEQUÊNCIA; B2/B3 corrigem a CAUSA.
   */
  var DOMINIOS = {
    instituicao_destino: HOSPITAIS,
    status:              STATUS,
    gravidade:           GRAVIDADE,
    tipo_ambulancia:     AMBULANCIA,
    especialidade:       ESPECIALIDADE,
    setor:               SETOR_UNIDADE
  };

  function ehVazamento(campo, valor) {
    if (isVazio(valor)) return null;
    var n = norm(valor);
    if (DOMINIOS[campo] && DOMINIOS[campo][n]) return null; // pertence aqui
    var achados = [];
    Object.keys(DOMINIOS).forEach(function (outro) {
      if (outro === campo) return;
      if (DOMINIOS[outro][n]) achados.push(outro);
    });
    // setor e especialidade compartilham termos (UTI, Clínica Pediátrica);
    // só acusamos vazamento quando o valor NÃO pertence ao campo atual.
    return achados.length ? { campo: campo, valor: valor, pertenceA: achados } : null;
  }

  /* ══ API PÚBLICA ═════════════════════════════════════════════════════════ */

  function classificar(campo, valor) {
    if (isVazio(valor)) {
      return { canonico: NAO_INFORMADO, ok: false, motivo: "vazio", raw: valor };
    }
    if (campo === "setor") {
      var s = parseSetor(valor);
      return {
        canonico: s.unidade, leito: s.leito, raw: valor,
        ok: s.unidade !== NAO_CLASSIFICADO,
        motivo: s.unidade === NAO_CLASSIFICADO ? "desconhecido" : null,
        vazamento: ehVazamento("setor", valor)
      };
    }
    var dic = DOMINIOS[campo];
    if (!dic) return { canonico: String(valor).trim(), ok: true, raw: valor };
    var hit = dic[norm(valor)];
    var vaz = ehVazamento(campo, valor);
    var res = {
      canonico: hit || NAO_CLASSIFICADO,
      ok: !!hit,
      motivo: hit ? null : (vaz ? "vazamento" : "desconhecido"),
      raw: valor,
      vazamento: vaz
    };
    if (campo === "especialidade" && hit) res.grupo = ESPEC_META[hit].grupo;
    return res;
  }

  /* Valida uma linha inteira antes de gravar (usado por B4 no import). */
  function validarLinha(row) {
    var problemas = [];
    Object.keys(DOMINIOS).forEach(function (campo) {
      if (!(campo in row)) return;
      var r = classificar(campo, row[campo]);
      if (r.vazamento) {
        problemas.push({
          campo: campo, valor: row[campo], tipo: "vazamento",
          msg: "«" + row[campo] + "» parece ser valor de " +
               r.vazamento.pertenceA.join(" ou ") + ", não de " + campo
        });
      } else if (!r.ok && r.motivo === "desconhecido") {
        problemas.push({
          campo: campo, valor: row[campo], tipo: "desconhecido",
          msg: "«" + row[campo] + "» não reconhecido em " + campo
        });
      }
    });
    return { ok: problemas.length === 0, problemas: problemas };
  }

  /* Agrupa um array de registros por campo canônico.
   * Devolve buckets + cobertura — porque nenhum campo desta base passa de
   * 80% de preenchimento, e exibir percentual sem cobertura mente por omissão.
   */
  function agrupar(registros, campo) {
    var buckets = {}, informados = 0, naoClassificados = [];
    registros.forEach(function (r) {
      var res = classificar(campo, r[campo]);
      if (res.canonico === NAO_INFORMADO) return;
      informados++;
      if (res.canonico === NAO_CLASSIFICADO) naoClassificados.push(r[campo]);
      var k = res.canonico;
      buckets[k] = (buckets[k] || 0) + 1;
    });
    var itens = Object.keys(buckets).map(function (k) {
      return {
        canonico: k, n: buckets[k],
        pct: informados ? (buckets[k] / informados * 100) : 0,
        grupo: (campo === "especialidade" && ESPEC_META[k]) ? ESPEC_META[k].grupo : null
      };
    }).sort(function (a, b) { return b.n - a.n; });
    return {
      itens: itens,
      total: registros.length,
      informados: informados,
      cobertura: registros.length ? (informados / registros.length * 100) : 0,
      naoClassificados: naoClassificados
    };
  }

  root.Canon = {
    norm: norm, isVazio: isVazio,
    classificar: classificar, validarLinha: validarLinha,
    agrupar: agrupar, parseSetor: parseSetor, ehVazamento: ehVazamento,
    NAO_CLASSIFICADO: NAO_CLASSIFICADO, NAO_INFORMADO: NAO_INFORMADO,
    GRAVIDADE_ORDEM: GRAVIDADE_ORDEM, GRAVIDADE_COR: GRAVIDADE_COR,
    STATUS_FECHADOS: STATUS_FECHADOS, ESPEC_META: ESPEC_META
  };

  if (typeof module !== "undefined" && module.exports) module.exports = root.Canon;

})(typeof globalThis !== "undefined" ? globalThis : this);
