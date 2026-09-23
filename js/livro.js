// Similaridade de strings (Dice bigram)
function strSim(a, b) {
  if (!a || !b) return 0;
  a = a.toUpperCase().trim(); b = b.toUpperCase().trim();
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bg = s => { const m = new Map(); for (let i=0;i<s.length-1;i++){const k=s[i]+s[i+1];m.set(k,(m.get(k)||0)+1);} return m; };
  const aB=bg(a),bB=bg(b); let inter=0;
  for (const [k,v] of aB) inter+=Math.min(v,bB.get(k)||0);
  return (2*inter)/(a.length+b.length-2);
}

const LS_EMPTY={data_saida:"",nome_paciente:"",idade:"",especialidade:"",destino:"",ambulancia:"",medico:"",enfermeiro:"",tecnico_auxiliar:"",hora_solic_ambulancia:"",hora_saida:"",hora_retorno:"",finalizado:false,permaneceu:false,observacao:""};
const LS_REQUIRED=["data_saida","nome_paciente","idade","especialidade","destino","ambulancia","medico","enfermeiro","tecnico_auxiliar","hora_solic_ambulancia","hora_saida","hora_retorno"];
// Usa H() do app: resolve o JWT da sessao a cada chamada. Header fixo com a
// anon key fazia o PostgREST tratar as requisicoes como "anon" e as policies
// de livro_saida (todas {authenticated}) barravam o INSERT com 42501.
const LS_H=()=>H();

// ─── Auditoria ───────────────────────────────────────────────────────────────
// A autoria e carimbada por trigger no banco (auth.uid() -> public.users).
// O cliente apenas exibe: nada aqui e fonte de verdade.
const LS_ACOES={
  criou:{txt:"Lancou o registro",ico:"\u270E",cor:"#0F172A"},
  vinculou:{txt:"Vinculou a remocao",ico:"\u{1F517}",cor:"#1D4ED8"},
  desvinculou:{txt:"Desfez o vinculo",ico:"\u21A9",cor:"#B45309"},
  sem_vinculo:{txt:"Marcou como sem vinculo",ico:"\u2014",cor:"#64748B"},
  reabriu:{txt:"Reabriu para pendentes",ico:"\u21A9",cor:"#B45309"},
  editou:{txt:"Alterou o registro",ico:"\u270E",cor:"#64748B"}
};
function lsAutor(p){
  if(!p)return null;
  const nome=(p.preenchido_por_nome||"").trim();
  if(!nome)return null;
  const reg=[(p.preenchido_por_tipo||"").trim(),(p.preenchido_por_registro||"").trim()].filter(Boolean).join(" ");
  return {nome,reg};
}
function lsQuando(iso){
  if(!iso)return "";
  try{
    const d=new Date(iso);
    return d.toLocaleDateString("pt-BR")+" "+d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
  }catch(e){return "";}
}
// Linha de assinatura exibida em cada card do livro.
function LS_ASSINATURA(p){
  const a=lsAutor(p);
  return React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6,marginTop:6,fontSize:11,color:a?"#475569":"#B91C1C",fontWeight:600}},
    React.createElement("span",{style:{opacity:.7}},"\u{1F464}"),
    a
      ?React.createElement("span",null,a.nome,a.reg?React.createElement("span",{style:{fontWeight:500,color:"#64748B"}}," \u00B7 ",a.reg):null)
      :React.createElement("span",null,"Autoria nao registrada"),
    p.preenchido_em?React.createElement("span",{style:{fontWeight:500,color:"#94A3B8"}}," \u00B7 ",lsQuando(p.preenchido_em)):null
  );
}


function LivroSaida({currentUser,userId,onClose,onPendentesChange}){
  const [tab,setTab]=useState("novo");
  const [form,setForm]=useState({...LS_EMPTY});
  const [errors,setErrors]=useState({});
  const [saving,setSaving]=useState(false);
  const [pendentes,setPendentes]=useState([]);
  const [loadingP,setLoadingP]=useState(false);
  const [erroP,setErroP]=useState(null);
  const [todos,setTodos]=useState([]);
  const [loadingT,setLoadingT]=useState(false);
  const [erroT,setErroT]=useState(null);
  const [confirmIgnorar,setConfirmIgnorar]=useState(null);
  const [match,setMatch]=useState(null);
  const [vinculando,setVinculando]=useState(false);
  const [remocoes,setRemocoes]=useState([]);
  const [toast,setToast]=useState(null);
  const [confirmClose,setConfirmClose]=useState(false);
  // Vinculo e decisao da administracao. Enfermeiro so preenche o livro.
  // O bloqueio real esta no banco (vinculo-somente-admin.sql); isto aqui
  // apenas evita oferecer uma acao que o servidor vai recusar.
  const podeVincular = currentUser?.role === "admin";
  const [auditoria,setAuditoria]=useState(null);   // {registro, linhas|null, erro|null}
  const [loadingA,setLoadingA]=useState(false);

  const notify=(tipo,texto)=>setToast({tipo,texto});
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(null),4500);return()=>clearTimeout(t);},[toast]);

  // Traduz o erro cru do PostgREST numa mensagem util para quem esta no plantao.
  function msgErro(e){
    const t=String(e&&e.message||e||"");
    if(t.includes("42501")||t.includes("row-level security"))
      return "Sua sessao expirou ou voce nao tem permissao para lancar no Livro. Saia e entre novamente; se continuar, procure a coordenacao.";
    if(t.includes("Failed to fetch")||t.includes("NetworkError"))
      return "Sem conexao com o servidor. Os dados continuam na tela — tente salvar de novo.";
    return "Nao foi possivel salvar. Detalhe tecnico no console.";
  }

  // Ha algo digitado que seria perdido ao fechar?
  const dirty=Object.keys(LS_EMPTY).some(k=>form[k]!==LS_EMPTY[k]);
  const pedirFechar=()=>{ if(dirty)setConfirmClose(true); else onClose(); };

  useEffect(()=>{loadPendentes();loadRemocoes();},[]);
  useEffect(()=>{if(tab==="todos")loadTodos();},[tab]);

  // fetch NAO lanca em 401/403 — sem checar r.ok, o corpo de erro virava []
  // e a tela dizia "Nenhum pendente", mascarando falha como sucesso.
  async function loadPendentes(){
    setLoadingP(true);setErroP(null);
    try{
      const r=await fetch(`${SB_URL}/rest/v1/livro_saida?status_vinculo=eq.pendente&order=created_at.desc`,{headers:LS_H()});
      if(!r.ok)throw new Error(await r.text());
      const d=await r.json();
      if(!Array.isArray(d))throw new Error("Resposta inesperada do servidor.");
      setPendentes(d);if(onPendentesChange)onPendentesChange(d.length);
    }catch(e){console.error("[LivroSaida] falha ao carregar pendentes:",e);setErroP(msgErro(e));}
    setLoadingP(false);
  }

  // Aba "Todos": sem filtro de status. Antes, qualquer registro que saisse de
  // "pendente" ficava inalcancavel pela interface.
  async function loadTodos(){
    setLoadingT(true);setErroT(null);
    try{
      const r=await fetch(`${SB_URL}/rest/v1/livro_saida?order=created_at.desc&limit=500`,{headers:LS_H()});
      if(!r.ok)throw new Error(await r.text());
      const d=await r.json();
      if(!Array.isArray(d))throw new Error("Resposta inesperada do servidor.");
      setTodos(d);
    }catch(e){console.error("[LivroSaida] falha ao carregar histórico:",e);setErroT(msgErro(e));}
    setLoadingT(false);
  }

  // Devolve um registro para a fila de pendentes (desfaz "sem vínculo").
  async function handleReabrir(livroId){
    try{
      const r=await fetch(`${SB_URL}/rest/v1/livro_saida?id=eq.${livroId}`,{method:"PATCH",headers:{...LS_H(),Prefer:"return=minimal"},body:JSON.stringify({status_vinculo:"pendente",remocao_id:null})});
      if(!r.ok)throw new Error(await r.text());
      loadPendentes();loadTodos();
      notify("ok","Registro devolvido para Pendentes.");
    }catch(e){console.error("[LivroSaida] falha ao reabrir:",e);notify("erro",msgErro(e));}
  }
  // Historico completo de um registro. Somente leitura: a tabela de log nao
  // aceita INSERT/UPDATE/DELETE de cliente nenhum (ver auditoria-livro.sql).
  async function abrirAuditoria(registro){
    setAuditoria({registro,linhas:null,erro:null});
    setLoadingA(true);
    try{
      const r=await fetch(`${SB_URL}/rest/v1/livro_saida_log?livro_id=eq.${registro.id}&order=criado_em.asc`,{headers:LS_H()});
      if(!r.ok)throw new Error(await r.text());
      const d=await r.json();
      if(!Array.isArray(d))throw new Error("Resposta inesperada do servidor.");
      setAuditoria({registro,linhas:d,erro:null});
    }catch(e){
      console.error("[LivroSaida] falha ao carregar auditoria:",e);
      setAuditoria({registro,linhas:null,erro:msgErro(e)});
    }
    setLoadingA(false);
  }

  async function loadRemocoes(){
    try{const r=await fetch(`${SB_URL}/rest/v1/remocoes?select=id,nome_paciente,data_solicitacao,ficha_cross&order=data_solicitacao.desc&limit=300`,{headers:LS_H()});const d=await r.json();setRemocoes(Array.isArray(d)?d:[]);}catch(e){}
  }

  const set=(k,v)=>{setForm(p=>({...p,[k]:v}));setErrors(p=>({...p,[k]:false}));};

  function validate(){
    const errs={};
    LS_REQUIRED.forEach(k=>{if(!form[k]||String(form[k]).trim()==="")errs[k]=true;});
    setErrors(errs);
    return Object.keys(errs).length===0;
  }

  function findMatches(nome,data){
    if(!nome)return[];
    return remocoes
      .map(r=>({...r,sim:strSim(r.nome_paciente,nome)}))
      .filter(r=>{const sd=data&&r.data_solicitacao&&r.data_solicitacao.startsWith(data);return r.sim>=0.75||(r.sim>=0.55&&sd);})
      .sort((a,b)=>b.sim-a.sim).slice(0,5);
  }

  async function handleSalvar(){
    if(!validate())return;
    setSaving(true);
    try{
      const payload={...form,finalizado:Boolean(form.finalizado),permaneceu:Boolean(form.permaneceu),preenchido_por:userId||null,status_vinculo:"pendente"};
      const r=await fetch(`${SB_URL}/rest/v1/livro_saida`,{method:"POST",headers:{...LS_H(),Prefer:"return=representation"},body:JSON.stringify(payload)});
      if(!r.ok)throw new Error(await r.text());
      const [saved]=await r.json();
      const candidates=findMatches(form.nome_paciente,form.data_saida);
      if(candidates.length>0){setMatch({livroRow:saved,candidates});}
      else{setForm({...LS_EMPTY});loadPendentes();notify("ok","Registro salvo. Sem correspondência na planilha — ficou em Pendentes.");}
    }catch(e){console.error("[LivroSaida] falha ao salvar:",e);notify("erro",msgErro(e));}
    setSaving(false);
  }

  async function handleVincular(livroId,remocaoId){
    setVinculando(true);
    try{
      await fetch(`${SB_URL}/rest/v1/livro_saida?id=eq.${livroId}`,{method:"PATCH",headers:{...LS_H(),Prefer:"return=minimal"},body:JSON.stringify({remocao_id:remocaoId,status_vinculo:"vinculado"})});
      const livroEntry=match?.livroRow||pendentes.find(p=>p.id===livroId);
      if(livroEntry&&remocaoId){
        const u={};
        if(livroEntry.ambulancia)u.tipo_ambulancia=livroEntry.ambulancia;
        if(livroEntry.hora_solic_ambulancia)u.hora_solic_ambulancia=livroEntry.hora_solic_ambulancia;
        if(livroEntry.hora_saida)u.horario_saida_ambulancia=livroEntry.hora_saida;
        if(livroEntry.hora_retorno)u.horario_retorno=livroEntry.hora_retorno;
        if(livroEntry.medico)u.medico=livroEntry.medico;
        if(livroEntry.enfermeiro)u.enfermeiro=livroEntry.enfermeiro;
        if(livroEntry.tecnico_auxiliar)u.tecnico_auxiliar=livroEntry.tecnico_auxiliar;
        if(livroEntry.destino)u.instituicao_destino=livroEntry.destino;
        if(livroEntry.observacao)u.observacao=livroEntry.observacao;
        u.finalizado=Boolean(livroEntry.finalizado);
        u.permaneceu=Boolean(livroEntry.permaneceu);
        if(Object.keys(u).length>0)await fetch(`${SB_URL}/rest/v1/remocoes?id=eq.${remocaoId}`,{method:"PATCH",headers:{...LS_H(),Prefer:"return=minimal"},body:JSON.stringify(u)});
      }
      setMatch(null);setForm({...LS_EMPTY});loadPendentes();
      notify("ok","Vinculado. Dados mesclados na planilha de remoção.");
    }catch(e){console.error("[LivroSaida] falha ao vincular:",e);notify("erro",msgErro(e));}
    setVinculando(false);
  }

  async function handleIndependente(livroId){
    try{
      const r=await fetch(`${SB_URL}/rest/v1/livro_saida?id=eq.${livroId}`,{method:"PATCH",headers:{...LS_H(),Prefer:"return=minimal"},body:JSON.stringify({status_vinculo:"independente"})});
      if(!r.ok)throw new Error(await r.text());
      setMatch(null);setForm({...LS_EMPTY});setConfirmIgnorar(null);loadPendentes();if(tab==="todos")loadTodos();
      notify("ok","Registro mantido sem vínculo. Continua no histórico, na aba Todos.");
    }catch(e){console.error("[LivroSaida] falha ao marcar independente:",e);notify("erro",msgErro(e));}
  }

  async function handleVincularPendente(livro){
    const candidates=findMatches(livro.nome_paciente,livro.data_saida);
    setMatch({livroRow:livro,candidates});setTab("novo");
  }

  const iS=k=>({border:`1.5px solid ${errors[k]?"#EF4444":"#E2E8F0"}`,borderRadius:8,padding:"8px 10px",fontSize:13,fontFamily:"inherit",color:"#0F172A",outline:"none",background:"#fff",width:"100%",boxShadow:errors[k]?"0 0 0 3px rgba(239,68,68,.1)":"none"});
  const sS=k=>({...iS(k),appearance:"none",cursor:"pointer"});
  const LBL=(t,r)=>React.createElement("label",{style:{fontSize:10,fontWeight:600,color:"#374151",textTransform:"uppercase",letterSpacing:".04em",display:"block",marginBottom:3}},t,r&&React.createElement("span",{style:{color:"#EF4444",marginLeft:2}},"*"));
  const FLD=(k,label,el)=>React.createElement("div",{key:k},LBL(label,LS_REQUIRED.includes(k)),el);
  const ERRO_BOX=(msg,retry)=>React.createElement("div",{style:{textAlign:"center",padding:"36px 24px"}},
    React.createElement("div",{style:{fontSize:28,marginBottom:10}},"⚠️"),
    React.createElement("div",{style:{fontSize:13,fontWeight:700,color:"#B91C1C",marginBottom:6}},"Não foi possível carregar"),
    React.createElement("div",{style:{fontSize:12,color:"#64748B",lineHeight:1.5,maxWidth:380,margin:"0 auto 16px"}},msg),
    React.createElement("button",{onClick:retry,style:{background:"#0F172A",color:"#fff",border:"none",borderRadius:8,padding:"8px 18px",fontSize:12,fontWeight:700,cursor:"pointer"}},"Tentar de novo")
  );
  const fmtDate=d=>{try{return new Date(d+"T12:00:00").toLocaleDateString("pt-BR");}catch{return d;}};

  return React.createElement("div",{className:"ls-overlay",onClick:e=>{if(e.target!==e.currentTarget)return;if(match||confirmClose||confirmIgnorar)return;pedirFechar();}},
    React.createElement("div",{className:"ls-modal",style:{position:"relative"}},

      // ── Confirmacao de fechamento (so quando ha texto digitado) ──
      confirmClose&&React.createElement("div",{className:"ls-match-overlay"},
        React.createElement("div",{className:"ls-match-box",style:{maxWidth:400}},
          React.createElement("div",{style:{fontWeight:700,fontSize:15,marginBottom:6}},"Descartar este registro?"),
          React.createElement("div",{style:{fontSize:12,color:"#64748B",lineHeight:1.5,marginBottom:18}},"Os dados digitados ainda não foram salvos e serão perdidos."),
          React.createElement("div",{style:{display:"flex",gap:8,justifyContent:"flex-end"}},
            React.createElement("button",{onClick:()=>setConfirmClose(false),style:{background:"#0F172A",color:"#fff",border:"none",borderRadius:8,padding:"8px 18px",fontSize:12,fontWeight:700,cursor:"pointer"}},"Continuar preenchendo"),
            React.createElement("button",{onClick:()=>{setConfirmClose(false);onClose();},style:{background:"none",border:"1px solid #FECACA",color:"#DC2626",borderRadius:8,padding:"8px 18px",fontSize:12,fontWeight:600,cursor:"pointer"}},"Descartar")
          )
        )
      ),

      // ── Confirmacao de "Sem vinculo" ──
      confirmIgnorar&&React.createElement("div",{className:"ls-match-overlay"},
        React.createElement("div",{className:"ls-match-box",style:{maxWidth:420}},
          React.createElement("div",{style:{fontWeight:700,fontSize:15,marginBottom:6}},"Marcar como sem vínculo?"),
          React.createElement("div",{style:{fontSize:12,color:"#64748B",lineHeight:1.5,marginBottom:18}},
            `"${confirmIgnorar.nome_paciente}" sai da fila de pendentes e deixa de ser cruzado com a planilha de remoção. O registro continua salvo e pode ser reaberto na aba Todos.`),
          React.createElement("div",{style:{display:"flex",gap:8,justifyContent:"flex-end"}},
            React.createElement("button",{onClick:()=>setConfirmIgnorar(null),style:{background:"none",border:"1px solid #E2E8F0",color:"#374151",borderRadius:8,padding:"8px 18px",fontSize:12,cursor:"pointer"}},"Cancelar"),
            React.createElement("button",{onClick:()=>handleIndependente(confirmIgnorar.id),style:{background:"#0F172A",color:"#fff",border:"none",borderRadius:8,padding:"8px 18px",fontSize:12,fontWeight:700,cursor:"pointer"}},"Confirmar")
          )
        )
      ),

      // ── Toast ──
      toast&&React.createElement("div",{onClick:()=>setToast(null),style:{position:"absolute",top:14,left:"50%",transform:"translateX(-50%)",zIndex:20,maxWidth:"90%",display:"flex",alignItems:"flex-start",gap:9,background:toast.tipo==="ok"?"#062B1B":"#3F1114",color:"#fff",borderRadius:10,padding:"11px 15px",fontSize:12,lineHeight:1.45,fontWeight:500,boxShadow:"0 10px 30px rgba(0,0,0,.3)",cursor:"pointer",animation:"lsToastIn .2s ease-out"}},
        React.createElement("span",{style:{fontSize:13,lineHeight:1.2}},toast.tipo==="ok"?"✓":"!"),
        React.createElement("span",null,toast.texto)
      ),

      // ── Match overlay ──
      match&&React.createElement("div",{className:"ls-match-overlay"},
        React.createElement("div",{className:"ls-match-box"},
          React.createElement("div",{style:{fontWeight:700,fontSize:15,marginBottom:4}},
            !podeVincular?"Registro enviado":(match.candidates.length===0?"Sem correspondência na planilha":"Correspondência encontrada")),
          React.createElement("div",{style:{fontSize:12,color:"#64748B",marginBottom:16}},
            !podeVincular
              ?`A saída de "${match.livroRow.nome_paciente}" foi registrada. A conferência com a planilha é feita pela administração.`
              :match.candidates.length===0
              ?`Nenhuma remoção parecida com "${match.livroRow.nome_paciente}" foi localizada na planilha. Isso é normal quando a saída não passou pelo CROSS — mantenha o registro sem vínculo.`
              :`${match.candidates.length} registro(s) parecido(s) para "${match.livroRow.nome_paciente}". Selecione o correto ou salve sem vínculo.`),
          !podeVincular&&React.createElement("div",{style:{background:"#F0FDF4",border:"1px solid #86EFAC",borderRadius:10,padding:"20px 16px",textAlign:"center",marginBottom:4}},
            React.createElement("div",{style:{fontSize:24,marginBottom:6}},"\u2713"),
            React.createElement("div",{style:{fontSize:13,fontWeight:700,color:"#15803D",marginBottom:4}},"Registro salvo no Livro"),
            React.createElement("div",{style:{fontSize:12,color:"#16A34A",lineHeight:1.5}},"Ele fica em Pendentes at\u00E9 a administra\u00E7\u00E3o conferir e vincular \u00E0 planilha de remo\u00E7\u00E3o.")
          ),
          podeVincular&&match.candidates.length===0&&React.createElement("div",{style:{background:"#F8FAFC",border:"1px dashed #CBD5E1",borderRadius:10,padding:"20px 16px",textAlign:"center",marginBottom:4}},
            React.createElement("div",{style:{fontSize:24,marginBottom:6}},"🔍"),
            React.createElement("div",{style:{fontSize:12,color:"#64748B",lineHeight:1.5}},"O registro já está salvo no Livro. Ele fica na aba Pendentes até ser vinculado ou marcado como independente.")
          ),
          podeVincular&&match.candidates.map(c=>React.createElement("div",{key:c.id,style:{background:"#F8FAFC",border:"1.5px solid #E2E8F0",borderRadius:9,padding:"10px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}},
            React.createElement("div",null,
              React.createElement("div",{style:{fontWeight:600,fontSize:13}},c.nome_paciente),
              React.createElement("div",{style:{fontSize:11,color:"#64748B",marginTop:2}},
                c.data_solicitacao||"—",c.ficha_cross?` · ${c.ficha_cross}`:"",
                React.createElement("span",{style:{marginLeft:8,background:"#EFF6FF",color:"#1D4ED8",borderRadius:99,padding:"1px 7px",fontSize:10,fontWeight:700}},Math.round(c.sim*100)+"% similar")
              )
            ),
            React.createElement("button",{disabled:vinculando,onClick:()=>!vinculando&&handleVincular(match.livroRow.id,c.id),style:{background:"#16A34A",color:"#fff",border:"none",borderRadius:7,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}},vinculando?"…":"Vincular")
          )),
          React.createElement("div",{style:{display:"flex",gap:8,marginTop:16,justifyContent:"flex-end"}},
            React.createElement("button",{onClick:()=>setMatch(null),style:podeVincular?{background:"none",border:"1px solid #E2E8F0",borderRadius:7,padding:"7px 16px",fontSize:12,cursor:"pointer",color:"#64748B"}:{background:"#0F172A",color:"#fff",border:"none",borderRadius:7,padding:"7px 20px",fontSize:12,fontWeight:700,cursor:"pointer"}},podeVincular?(match.candidates.length===0?"Decidir depois":"Cancelar"):"Entendi"),
            podeVincular&&React.createElement("button",{onClick:()=>handleIndependente(match.livroRow.id),style:{background:match.candidates.length===0?"#0F172A":"none",color:match.candidates.length===0?"#fff":"#374151",border:match.candidates.length===0?"none":"1px solid #E2E8F0",borderRadius:7,padding:"7px 16px",fontSize:12,fontWeight:match.candidates.length===0?700:400,cursor:"pointer"}},"Manter sem vínculo")
          )
        )
      ),

      // ── Header ──
      React.createElement("div",{className:"ls-hd"},
        React.createElement("div",null,
          React.createElement("h2",null,"📒 Livro de Saída"),
          React.createElement("div",{className:"ls-hd-sub"},"Preenchido por: "+(currentUser?.nome||"—"))
        ),
        React.createElement("button",{onClick:pedirFechar,style:{background:"rgba(255,255,255,.1)",border:"none",color:"#fff",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:16}},"✕")
      ),

      // ── Tabs ──
      React.createElement("div",{style:{display:"flex",borderBottom:"2px solid #F1F5F9",flexShrink:0,background:"#F8FAFC"}},
        [["novo","📝 Novo Registro"],["pendentes",`⏳ Pendentes (${erroP?"!":pendentes.length})`],["todos","📚 Todos"]].map(([id,label])=>
          React.createElement("button",{key:id,onClick:()=>setTab(id),style:{flex:1,padding:"10px 16px",background:"none",border:"none",borderBottom:`3px solid ${tab===id?"#3B82F6":"transparent"}`,color:tab===id?"#1D4ED8":"#64748B",fontWeight:tab===id?700:500,fontSize:12,cursor:"pointer",transition:"all .15s"}},label)
        )
      ),

      // ── Body ──
      React.createElement("div",{className:"ls-body"},

        // TAB NOVO
        tab==="novo"&&React.createElement("div",null,
          // Paciente
          React.createElement("div",{className:"ls-section"},
            React.createElement("div",{className:"ls-section-title"},"Dados do Paciente"),
            React.createElement("div",{className:"ls-grid ls-g2"},
              FLD("data_saida","Data",React.createElement("input",{type:"date",value:form.data_saida,onChange:e=>set("data_saida",e.target.value),style:iS("data_saida")})),
              FLD("idade","Idade",React.createElement("input",{type:"text",placeholder:"ex: 3 anos",value:form.idade,onChange:e=>set("idade",e.target.value),style:iS("idade")}))
            ),
            React.createElement("div",{style:{marginTop:10}},
              FLD("nome_paciente","Nome completo",React.createElement("input",{type:"text",placeholder:"NOME COMPLETO DO PACIENTE",value:form.nome_paciente,onChange:e=>set("nome_paciente",e.target.value.toUpperCase()),style:{...iS("nome_paciente"),textTransform:"uppercase"}}))
            )
          ),
          // Remoção
          React.createElement("div",{className:"ls-section"},
            React.createElement("div",{className:"ls-section-title"},"Dados da Remoção"),
            React.createElement("div",{className:"ls-grid ls-g2"},
              FLD("especialidade","Especialidade / Recurso",React.createElement("input",{type:"text",placeholder:"ex: UTI PEDIÁTRICA, TOMOGRAFIA",value:form.especialidade,onChange:e=>set("especialidade",e.target.value),style:iS("especialidade")})),
              FLD("destino","Destino",React.createElement("input",{type:"text",placeholder:"Hospital / Unidade receptora",value:form.destino,onChange:e=>set("destino",e.target.value),style:iS("destino")})),
              FLD("ambulancia","Tipo de Ambulância",React.createElement("select",{value:form.ambulancia,onChange:e=>set("ambulancia",e.target.value),style:sS("ambulancia")},
                React.createElement("option",{value:""},"— selecione —"),
                React.createElement("option",{value:"BÁSICA"},"🚑 BÁSICA (SBV)"),
                React.createElement("option",{value:"AVANÇADA"},"🚨 AVANÇADA (SAV)"),
                React.createElement("option",{value:"UTI"},"🏥 UTI Móvel")
              ))
            )
          ),
          // Equipe
          React.createElement("div",{className:"ls-section"},
            React.createElement("div",{className:"ls-section-title"},"Equipe"),
            React.createElement("div",{className:"ls-grid ls-g3"},
              FLD("medico","Médico(a)",React.createElement("input",{type:"text",placeholder:"Dr. Nome",value:form.medico,onChange:e=>set("medico",e.target.value),style:iS("medico")})),
              FLD("enfermeiro","Enfermeiro(a)",React.createElement("input",{type:"text",placeholder:"Nome",value:form.enfermeiro,onChange:e=>set("enfermeiro",e.target.value),style:iS("enfermeiro")})),
              FLD("tecnico_auxiliar","Técnico / Auxiliar",React.createElement("input",{type:"text",placeholder:"Nome",value:form.tecnico_auxiliar,onChange:e=>set("tecnico_auxiliar",e.target.value),style:iS("tecnico_auxiliar")}))
            )
          ),
          // Horários
          React.createElement("div",{className:"ls-section"},
            React.createElement("div",{className:"ls-section-title"},"Horários"),
            React.createElement("div",{className:"ls-grid ls-g3"},
              FLD("hora_solic_ambulancia","Solic. Ambulância",React.createElement("input",{type:"time",value:form.hora_solic_ambulancia,onChange:e=>set("hora_solic_ambulancia",e.target.value),style:iS("hora_solic_ambulancia")})),
              FLD("hora_saida","Saída",React.createElement("input",{type:"time",value:form.hora_saida,onChange:e=>set("hora_saida",e.target.value),style:iS("hora_saida")})),
              FLD("hora_retorno","Retorno",React.createElement("input",{type:"time",value:form.hora_retorno,onChange:e=>set("hora_retorno",e.target.value),style:iS("hora_retorno")}))
            )
          ),
          // Encerramento
          React.createElement("div",{className:"ls-section"},
            React.createElement("div",{className:"ls-section-title"},"Encerramento"),
            React.createElement("div",{className:"ls-grid ls-g2"},
              React.createElement("div",null,LBL("Finalizado",true),React.createElement("div",{className:"ls-bool"},
                React.createElement("label",null,React.createElement("input",{type:"radio",name:"ls_fin",checked:form.finalizado===true,onChange:()=>set("finalizado",true)})," Sim"),
                React.createElement("label",null,React.createElement("input",{type:"radio",name:"ls_fin",checked:form.finalizado!==true,onChange:()=>set("finalizado",false)})," Não")
              )),
              React.createElement("div",null,LBL("Permaneceu na unidade",true),React.createElement("div",{className:"ls-bool"},
                React.createElement("label",null,React.createElement("input",{type:"radio",name:"ls_per",checked:form.permaneceu===true,onChange:()=>set("permaneceu",true)})," Sim"),
                React.createElement("label",null,React.createElement("input",{type:"radio",name:"ls_per",checked:form.permaneceu!==true,onChange:()=>set("permaneceu",false)})," Não")
              ))
            ),
            React.createElement("div",{style:{marginTop:10}},
              LBL("Observação",false),
              React.createElement("textarea",{rows:2,value:form.observacao,onChange:e=>set("observacao",e.target.value),placeholder:"Observações adicionais…",style:{...iS("observacao"),resize:"vertical"}})
            )
          ),
          Object.keys(errors).length>0&&React.createElement("div",{style:{background:"#FEF2F2",border:"1px solid #FCA5A5",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#DC2626",marginTop:8}},"⚠ Preencha todos os campos obrigatórios (*) antes de salvar.")
        ),

        // TAB PENDENTES
        tab==="todos"&&React.createElement("div",null,
          loadingT
            ?React.createElement("div",{style:{textAlign:"center",padding:32,color:"#94A3B8"}},"Carregando…")
            :erroT
              ?ERRO_BOX(erroT,loadTodos)
              :todos.length===0
                ?React.createElement("div",{style:{textAlign:"center",padding:48,color:"#94A3B8"}},
                    React.createElement("div",{style:{fontSize:32,marginBottom:8}},"📚"),
                    React.createElement("div",{style:{fontSize:14,fontWeight:600}},"Nenhum registro no Livro"))
                :todos.map(p=>React.createElement("div",{key:p.id,className:"ls-pending-card"},
                    React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}},
                      React.createElement("div",{style:{minWidth:0}},
                        React.createElement("div",{style:{display:"flex",alignItems:"center",gap:7,marginBottom:3}},
                          React.createElement("span",{style:{fontWeight:700,fontSize:13}},p.nome_paciente),
                          React.createElement("span",{style:{flexShrink:0,borderRadius:99,padding:"2px 8px",fontSize:10,fontWeight:700,
                            background:p.status_vinculo==="vinculado"?"#DCFCE7":p.status_vinculo==="pendente"?"#FEF3C7":"#F1F5F9",
                            color:p.status_vinculo==="vinculado"?"#15803D":p.status_vinculo==="pendente"?"#B45309":"#64748B"}},
                            p.status_vinculo==="vinculado"?"Vinculado":p.status_vinculo==="pendente"?"Pendente":"Sem vínculo")
                        ),
                        React.createElement("div",{style:{fontSize:11,color:"#64748B"}},fmtDate(p.data_saida)," · ",p.idade," · ",p.especialidade," → ",p.destino),
                        React.createElement("div",{style:{fontSize:11,color:"#94A3B8",marginTop:2}},"🕐 Saída: ",p.hora_saida||"—"," · ",p.ambulancia," · Enf: ",p.enfermeiro),
                        LS_ASSINATURA(p)
                      ),
                      React.createElement("div",{style:{display:"flex",gap:6,flexShrink:0,alignItems:"center"}},
                        React.createElement("button",{onClick:()=>abrirAuditoria(p),title:"Ver historico de auditoria",style:{background:"none",border:"1px solid #E2E8F0",color:"#475569",borderRadius:7,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}},"\u{1F5D2} Auditoria"),
                        podeVincular&&p.status_vinculo==="independente"&&React.createElement("button",{onClick:()=>handleReabrir(p.id),style:{flexShrink:0,background:"none",border:"1px solid #E2E8F0",color:"#1D4ED8",borderRadius:7,padding:"5px 11px",fontSize:11,fontWeight:600,cursor:"pointer"}},"↩ Reabrir")
                    )
                    )
                  ))
        ),

        tab==="pendentes"&&React.createElement("div",null,
          loadingP
            ?React.createElement("div",{style:{textAlign:"center",padding:32,color:"#94A3B8"}},"Carregando…")
            :erroP
              ?ERRO_BOX(erroP,loadPendentes)
              :pendentes.length===0
              ?React.createElement("div",{style:{textAlign:"center",padding:48,color:"#94A3B8"}},
                  React.createElement("div",{style:{fontSize:32,marginBottom:8}},"✅"),
                  React.createElement("div",{style:{fontSize:14,fontWeight:600}},"Nenhum pendente"),
                  React.createElement("div",{style:{fontSize:12,marginTop:4}},"Todos os registros já estão vinculados.")
                )
              :pendentes.map(p=>React.createElement("div",{key:p.id,className:"ls-pending-card"},
                  React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}},
                    React.createElement("div",null,
                      React.createElement("div",{style:{fontWeight:700,fontSize:13}},p.nome_paciente),
                      React.createElement("div",{style:{fontSize:11,color:"#64748B",marginTop:2}},fmtDate(p.data_saida)," · ",p.idade," · ",p.especialidade," → ",p.destino),
                      React.createElement("div",{style:{fontSize:11,color:"#94A3B8",marginTop:2}},"🕐 Saída: ",p.hora_saida||"—"," · ",p.ambulancia," · Enf: ",p.enfermeiro),
                      LS_ASSINATURA(p)
                    ),
                    React.createElement("div",{style:{display:"flex",gap:6,flexShrink:0,marginLeft:12,alignItems:"center"}},
                      React.createElement("button",{onClick:()=>abrirAuditoria(p),title:"Ver historico de auditoria",style:{background:"none",border:"1px solid #E2E8F0",color:"#475569",borderRadius:7,padding:"5px 10px",fontSize:11,cursor:"pointer",whiteSpace:"nowrap"}},"\u{1F5D2}"),
                      podeVincular&&React.createElement("button",{onClick:()=>handleVincularPendente(p),style:{background:"#EFF6FF",border:"1px solid #BFDBFE",color:"#1D4ED8",borderRadius:7,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}},"🔗 Vincular"),
                      podeVincular&&React.createElement("button",{onClick:()=>setConfirmIgnorar(p),style:{background:"none",border:"1px solid #E2E8F0",color:"#64748B",borderRadius:7,padding:"5px 10px",fontSize:11,cursor:"pointer"}},"Sem vínculo"),
                      !podeVincular&&React.createElement("span",{style:{fontSize:10,fontWeight:700,color:"#B45309",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:99,padding:"4px 10px",whiteSpace:"nowrap"}},"Aguardando confer\u00EAncia")
                    )
                  )
                ))
        )
      ),

      // ── Modal de auditoria ──
      auditoria&&React.createElement("div",{
        onClick:e=>{if(e.target===e.currentTarget)setAuditoria(null);},
        style:{position:"absolute",inset:0,background:"rgba(15,23,42,.45)",backdropFilter:"blur(2px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,zIndex:60}},
        React.createElement("div",{style:{background:"#fff",borderRadius:16,width:"min(520px,100%)",maxHeight:"86%",display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 24px 60px -20px rgba(15,23,42,.5)"}},
          React.createElement("div",{style:{padding:"20px 22px 16px",borderBottom:"1px solid #F1F5F9"}},
            React.createElement("div",{style:{fontSize:11,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:"#94A3B8",marginBottom:6}},"Auditoria do registro"),
            React.createElement("div",{style:{fontSize:16,fontWeight:700,color:"#0F172A"}},auditoria.registro.nome_paciente),
            React.createElement("div",{style:{fontSize:12,color:"#64748B",marginTop:2}},fmtDate(auditoria.registro.data_saida)," \u00B7 ",auditoria.registro.destino||"\u2014")
          ),
          React.createElement("div",{style:{padding:"18px 22px",overflowY:"auto",flex:1}},
            loadingA
              ?React.createElement("div",{style:{textAlign:"center",padding:28,color:"#94A3B8",fontSize:13}},"Carregando hist\u00F3rico\u2026")
              :auditoria.erro
                ?React.createElement("div",{style:{background:"#FEF2F2",border:"1px solid #FCA5A5",borderRadius:10,padding:"12px 14px",fontSize:12,color:"#DC2626"}},auditoria.erro)
                :(auditoria.linhas||[]).length===0
                  ?React.createElement("div",{style:{textAlign:"center",padding:28,color:"#94A3B8"}},
                      React.createElement("div",{style:{fontSize:26,marginBottom:6}},"\u{1F5D2}"),
                      React.createElement("div",{style:{fontSize:13,fontWeight:600,color:"#64748B"}},"Sem hist\u00F3rico registrado"),
                      React.createElement("div",{style:{fontSize:12,marginTop:4}},"Lan\u00E7amento anterior \u00E0 ativa\u00E7\u00E3o da auditoria."))
                  :React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:0}},
                      (auditoria.linhas||[]).map((l,i,arr)=>{
                        const meta=LS_ACOES[l.acao]||LS_ACOES.editou;
                        return React.createElement("div",{key:l.id,style:{display:"flex",gap:12,alignItems:"flex-start"}},
                          React.createElement("div",{style:{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0,alignSelf:"stretch"}},
                            React.createElement("div",{style:{width:26,height:26,borderRadius:99,background:"#F8FAFC",border:"1px solid #E2E8F0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}},meta.ico),
                            i<arr.length-1&&React.createElement("div",{style:{flex:1,width:2,background:"#F1F5F9",minHeight:14}})
                          ),
                          React.createElement("div",{style:{paddingBottom:i<arr.length-1?16:0,minWidth:0}},
                            React.createElement("div",{style:{fontSize:13,fontWeight:700,color:meta.cor}},meta.txt),
                            React.createElement("div",{style:{fontSize:12,color:"#334155",marginTop:2,fontWeight:600}},
                              l.autor_nome||"Autor n\u00E3o identificado",
                              (l.autor_tipo||l.autor_registro)?React.createElement("span",{style:{fontWeight:500,color:"#64748B"}}," \u00B7 ",[l.autor_tipo,l.autor_registro].filter(Boolean).join(" ")):null
                            ),
                            React.createElement("div",{style:{fontSize:11,color:"#94A3B8",marginTop:2}},lsQuando(l.criado_em))
                          )
                        );
                      })
                    )
          ),
          React.createElement("div",{style:{padding:"14px 22px",borderTop:"1px solid #F1F5F9",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}},
            React.createElement("div",{style:{fontSize:11,color:"#94A3B8"}},"Registro imut\u00E1vel \u00B7 gerado pelo servidor"),
            React.createElement("button",{onClick:()=>setAuditoria(null),style:{background:"#0F172A",color:"#fff",border:"none",borderRadius:9,padding:"8px 20px",fontSize:13,fontWeight:600,cursor:"pointer"}},"Fechar")
          )
        )
      ),

      // ── Footer ──
      React.createElement("div",{className:"ls-ft"},
        React.createElement("div",{style:{fontSize:11,color:"#94A3B8"}},tab==="novo"?"Campos com * são obrigatórios":tab==="todos"?`${todos.length} registro(s) no Livro`:`${pendentes.length} registro(s) aguardando vinculação`),
        tab==="novo"&&React.createElement("button",{onClick:handleSalvar,disabled:saving,style:{background:"#0F172A",color:"#fff",border:"none",borderRadius:9,padding:"9px 24px",fontSize:13,fontWeight:700,cursor:saving?"not-allowed":"pointer",opacity:saving?.7:1}},saving?"Salvando…":"💾 Salvar Registro")
      )
    )
  );
}

/* Administracao de usuarios. Criar conta no Auth e redefinir senha exigem a
 * service_role key — por isso passam pela Edge Function users-admin, nunca
 * pelo front. A propria funcao confere, a partir do JWT, se quem chama e
 * admin aprovado; o front so desenha a tela. */
async function adminUsuarios(action, id, extra) {
  return await fn("users-admin", { action, id, ...(extra || {}) });
}

// Liga/desliga uma area de escrita (can_kanban | can_planilha | can_livro).
// Antes era um PATCH direto no REST com a anon key — com RLS ligada isso
// nao passa mais, e nem deveria: permissao se altera no servidor.
async function toggleFlag(uid, campo, atual, reload) {
  await adminUsuarios("flags", uid, { flags: { [campo]: !atual } });
  reload();
}