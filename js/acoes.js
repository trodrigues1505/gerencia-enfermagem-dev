function AcoesEnfermagem({ currentUser, userId, onClose }) {
  var isAdmin    = !!(currentUser && currentUser.role === "admin");
  var podeGerir  = isAdmin || !!(currentUser && currentUser.can_acoes);

  var [acoes,    setAcoes]    = React.useState([]);
  var [users,    setUsers]    = React.useState([]);
  var [loading,  setLoading]  = React.useState(true);
  var [aba,      setAba]      = React.useState("pendentes"); // pendentes | concluidas | nova
  var [editing,  setEditing]  = React.useState(null);
  var [toastMsg, setToastMsg] = React.useState(null);
  var [conflito, setConflito] = React.useState(null);

  /* form como ref para não re-renderizar a cada keystroke */
  var formRef = React.useRef({titulo:"",descricao:"",prioridade:"",responsavel_id:"",prazo:""});
  var [formV, setFormV] = React.useState(0); // version só para forçar re-render quando necessário

  function getForm(){ return formRef.current; }
  function setField(k,v){ formRef.current = Object.assign({},formRef.current,{[k]:v}); }

  function showT(msg,type){ setToastMsg({msg,type:type||"ok"}); setTimeout(function(){setToastMsg(null);},4000); }

  React.useEffect(function(){ load(); loadUsers(); },[]);

  async function load(){
    setLoading(true);
    try{
      var r=await fetch(SB_URL+"/rest/v1/acoes_enfermagem?order=prioridade.asc.nullslast,created_at.asc&limit=300",{headers:H()});
      setAcoes(await r.json());
    }catch(e){}
    setLoading(false);
  }
  async function loadUsers(){
    try{ setUsers(await sbGet("users","status=eq.aprovado&order=nome.asc")); }catch(e){}
  }

  async function callFn(body){
    var r=await fetch(FN_URL+"/acoes-write",{method:"POST",headers:H(userId),body:JSON.stringify(body)});
    var d=await r.json();
    if(!r.ok) throw new Error(d.error||"Erro");
    return d;
  }

  /* Prazo: converte datetime-local (sem tz) para ISO com -03:00 */
  function prazoISO(val){ return val ? val+":00-03:00" : null; }

  async function handleSave(){
    var f=getForm();
    if(!f.titulo.trim()){ showT("Título obrigatório","err"); return; }
    /* Bloquear prioridade duplicada para o mesmo responsável */
    if(f.prioridade&&f.responsavel_id){
      var pr=parseInt(f.prioridade,10);
      var conflitoPr=acoes.find(function(a){
        return a.responsavel_id===f.responsavel_id
          && parseInt(a.prioridade,10)===pr
          && a.status!=="concluida"
          && (!editing||a.id!==editing.id);
      });
      if(conflitoPr){
        showT("Prioridade P"+pr+" já existe para "+conflitoPr.responsavel_nome+". Escolha outra.","err");
        return;
      }
    }
    var pr=f.prioridade?parseInt(f.prioridade,10):null;
    var resp=users.find(function(u){return u.id===f.responsavel_id;});
    var body={
      titulo:f.titulo.trim(), descricao:f.descricao.trim()||null,
      prioridade:pr,
      responsavel_id:f.responsavel_id||null,
      responsavel_nome:resp?resp.nome:null,
      prazo:prazoISO(f.prazo),
    };
    try{
      if(editing){
        await callFn({action:"update",id:editing.id,body:body});
        showT("Tarefa atualizada.");
      } else {
        await callFn({action:"create",body:body});
        showT("Tarefa criada.");
      }
      setEditing(null);
      formRef.current={titulo:"",descricao:"",prioridade:"",responsavel_id:"",prazo:""};
      setConflito(null);
      setAba("pendentes");
      load();
    } catch(ex){
      if(ex.message&&ex.message.includes("já está com:")){
        setConflito({msg:ex.message});
        setFormV(function(v){return v+1;});
      } else {
        showT(ex.message,"err");
      }
    }
  }

  async function handleConcluir(a){
    try{ await callFn({action:"concluir",id:a.id}); showT("Concluída!"); load(); }
    catch(ex){ showT(ex.message,"err"); }
  }
  async function handleIniciar(a){
    try{ await callFn({action:"iniciar",id:a.id}); showT("Iniciada!"); load(); }
    catch(ex){ showT(ex.message,"err"); }
  }
  async function handlePausar(a){
    try{ await callFn({action:"pausar",id:a.id}); showT("Pausada."); load(); }
    catch(ex){ showT(ex.message,"err"); }
  }
  async function handleReabrir(a){
    try{ await callFn({action:"reabrir",id:a.id}); showT("Reaberta."); load(); }
    catch(ex){ showT(ex.message,"err"); }
  }
  async function handleDelete(a){
    if(!window.confirm("Excluir \""+a.titulo+"\"?")) return;
    try{ await callFn({action:"delete",id:a.id}); showT("Excluída."); load(); }
    catch(ex){ showT(ex.message,"err"); }
  }

  function startEdit(a){
    var prazoLocal="";
    if(a.prazo){
      // Converte ISO para datetime-local (corta tz)
      var d=new Date(a.prazo);
      var pad=function(n){return String(n).padStart(2,"0");};
      prazoLocal=d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+"T"+pad(d.getHours())+":"+pad(d.getMinutes());
    }
    formRef.current={titulo:a.titulo||"",descricao:a.descricao||"",prioridade:a.prioridade||"",responsavel_id:a.responsavel_id||"",prazo:prazoLocal};
    setEditing(a); setConflito(null); setAba("nova"); setFormV(function(v){return v+1;});
  }

  var pendentes  = Array.isArray(acoes)?acoes.filter(function(a){return a.status==="pendente"||a.status==="iniciada"||a.status==="pausada";}):[];
  var concluidas = Array.isArray(acoes)?acoes.filter(function(a){return a.status==="concluida";}):[];

  /* Agrupar pendentes por responsável */
  var porResponsavel = {};
  pendentes.forEach(function(a){
    var nome=a.responsavel_nome||"Sem responsável";
    if(!porResponsavel[nome]) porResponsavel[nome]=[];
    porResponsavel[nome].push(a);
  });
  var grupos=Object.keys(porResponsavel).sort();

  var iS={width:"100%",padding:"8px 10px",border:"1px solid #E2E8F0",borderRadius:7,fontSize:13,fontFamily:"inherit",background:"#fff",outline:"none",boxSizing:"border-box"};
  var lS={fontSize:10,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:".04em",display:"block",marginBottom:3};

  var ABA_S=function(id,label,count){
    var active=aba===id;
    return React.createElement("button",{
      onClick:function(){setAba(id);},
      style:{padding:"6px 14px",border:"none",borderBottom:"2px solid "+(active?"#7C3AED":"transparent"),
             background:"none",fontWeight:active?700:400,fontSize:12,color:active?"#7C3AED":"#64748B",
             cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}
    }, label, count!=null&&React.createElement("span",{style:{marginLeft:4,background:active?"#EDE9FE":"#F1F5F9",color:active?"#6D28D9":"#64748B",borderRadius:99,padding:"1px 7px",fontSize:11,fontWeight:700}},count));
  };

  function CardAcao(props){
    var a=props.acao;
    var vencida=a.prazo&&new Date(a.prazo)<new Date()&&a.status!=="concluida";
    var meu=currentUser&&a.responsavel_id===currentUser.id;
    var podeConcluir=isAdmin||podeGerir||meu;
    var statusInfo={
      pendente:{cor:"#CBD5E1",label:"Pendente"},
      iniciada:{cor:"#3B82F6",label:"▶ Em andamento"},
      pausada:{cor:"#F59E0B",label:"⏸ Pausada"},
      concluida:{cor:"#22C55E",label:"✓ Concluída"}
    }[a.status||"pendente"]||{cor:"#CBD5E1",label:"Pendente"};
    var tempoLabel=a.tempo_min>0?(a.tempo_min>=60?Math.floor(a.tempo_min/60)+"h"+String(a.tempo_min%60).padStart(2,"0")+"min":a.tempo_min+"min"):null;
    return React.createElement("div",{style:{background:"#fff",border:"1px solid "+(vencida?"#FCA5A5":"#E2E8F0"),borderLeft:"3px solid "+statusInfo.cor,borderRadius:10,padding:"11px 13px",marginBottom:7}},
      React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}},
        React.createElement("div",{style:{flex:1,minWidth:0}},
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6,marginBottom:2,flexWrap:"wrap"}},
            a.prioridade&&React.createElement("span",{style:{fontSize:9,fontWeight:800,padding:"2px 7px",borderRadius:99,background:"#EDE9FE",color:"#6D28D9",border:"1px solid #DDD6FE",flexShrink:0}},"P"+a.prioridade),
            React.createElement("span",{style:{fontWeight:700,fontSize:13,color:"#0F172A"}},a.titulo),
            React.createElement("span",{style:{fontSize:9,fontWeight:600,padding:"2px 7px",borderRadius:99,background:statusInfo.cor+"22",color:statusInfo.cor,border:"1px solid "+statusInfo.cor+"44",flexShrink:0}},statusInfo.label)
          ),
          a.descricao&&React.createElement("div",{style:{fontSize:11,color:"#64748B",marginBottom:3}},a.descricao),
          React.createElement("div",{style:{display:"flex",gap:8,flexWrap:"wrap",fontSize:10,color:"#94A3B8"}},
            a.prazo&&React.createElement("span",{style:{color:vencida?"#EF4444":"#94A3B8",fontWeight:vencida?700:400}},
              (vencida?"⚠️ Venceu: ":"🕐 Prazo: ")+new Date(a.prazo).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})
            ),
            tempoLabel&&React.createElement("span",{style:{color:"#3B82F6",fontWeight:600}},"⏱ "+tempoLabel),
            React.createElement("span",null,"Criada: "+new Date(a.created_at).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}))
          )
        ),
        React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:4,flexShrink:0,alignItems:"flex-end"}},
          React.createElement("div",{style:{display:"flex",gap:4}},
            (a.status==="pendente"||a.status==="pausada")&&(podeConcluir)&&React.createElement("button",{onClick:function(){handleIniciar(a);},style:{padding:"5px 9px",border:"none",borderRadius:6,background:"#3B82F6",color:"#fff",fontWeight:700,fontSize:11,cursor:"pointer"}},"▶ Iniciar"),
            a.status==="iniciada"&&(podeConcluir)&&React.createElement("button",{onClick:function(){handlePausar(a);},style:{padding:"5px 9px",border:"none",borderRadius:6,background:"#F59E0B",color:"#fff",fontWeight:700,fontSize:11,cursor:"pointer"}},"⏸ Pausar"),
            (a.status==="iniciada"||a.status==="pausada")&&(podeConcluir)&&React.createElement("button",{onClick:function(){handleConcluir(a);},style:{padding:"5px 9px",border:"none",borderRadius:6,background:"#16A34A",color:"#fff",fontWeight:700,fontSize:11,cursor:"pointer"}},"✓ Concluir"),
            a.status==="pendente"&&(podeConcluir)&&React.createElement("button",{onClick:function(){handleConcluir(a);},style:{padding:"5px 9px",border:"none",borderRadius:6,background:"#16A34A",color:"#fff",fontWeight:700,fontSize:11,cursor:"pointer"}},"✓ Concluir")
          ),
          React.createElement("div",{style:{display:"flex",gap:4}},
            podeGerir&&React.createElement("button",{onClick:function(){startEdit(a);},style:{padding:"5px 8px",border:"1px solid #E2E8F0",borderRadius:6,background:"none",color:"#374151",cursor:"pointer",fontSize:11}},"✏️"),
            podeGerir&&React.createElement("button",{onClick:function(){handleDelete(a);},style:{padding:"5px 8px",border:"1px solid #E2E8F0",borderRadius:6,background:"none",color:"#94A3B8",cursor:"pointer",fontSize:11}},"✕")
          )
        )
      )
    );
  }

  return React.createElement("div",{
    onClick:function(e){if(e.target===e.currentTarget)onClose();},
    style:{position:"fixed",inset:0,background:"rgba(15,23,42,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"12px"}
  },
    React.createElement("div",{style:{background:"#fff",borderRadius:16,width:"100%",maxWidth:640,maxHeight:"92vh",display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,.25)"}},

      /* Header */
      React.createElement("div",{style:{background:"#0F172A",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}},
        React.createElement("div",null,
          React.createElement("div",{style:{color:"#fff",fontSize:15,fontWeight:700}},"\u2705 A\xE7\xF5es de Enfermagem"),
          React.createElement("div",{style:{color:"#475569",fontSize:11,marginTop:2}},pendentes.length+" pendente"+(pendentes.length!==1?"s":"")+" \xB7 "+concluidas.length+" concluid"+(concluidas.length!==1?"as":"a"))
        ),
        React.createElement("div",{style:{display:"flex",gap:8,alignItems:"center"}},
          podeGerir&&aba!=="nova"&&React.createElement("button",{
            onClick:function(){setEditing(null);formRef.current={titulo:"",descricao:"",prioridade:"",responsavel_id:"",prazo:""};setConflito(null);setAba("nova");setFormV(function(v){return v+1;});},
            style:{padding:"6px 14px",border:"none",borderRadius:7,background:"#16A34A",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}
          },"+ Nova tarefa"),
          React.createElement("button",{onClick:onClose,style:{background:"rgba(255,255,255,.12)",border:"none",color:"#fff",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:16}},"\u2715")
        )
      ),

      /* Toast */
      toastMsg&&React.createElement("div",{style:{background:toastMsg.type==="ok"?"#F0FDF4":"#FEF2F2",borderBottom:"1px solid "+(toastMsg.type==="ok"?"#86EFAC":"#FCA5A5"),padding:"7px 20px",fontSize:12,color:toastMsg.type==="ok"?"#166534":"#991B1B",fontWeight:600,flexShrink:0}},toastMsg.msg),

      /* Abas */
      React.createElement("div",{style:{display:"flex",borderBottom:"1px solid #F1F5F9",flexShrink:0,overflowX:"auto"}},
        ABA_S("pendentes","Pendentes",pendentes.length),
        ABA_S("concluidas","Conclu\xEDdas",concluidas.length),
        podeGerir&&ABA_S("nova",editing?"Editar tarefa":"Nova tarefa",null)
      ),

      /* Conteúdo */
      React.createElement("div",{style:{flex:1,overflowY:"auto",padding:"14px 18px"}},

        /* ABA: Nova/Editar */
        aba==="nova"&&React.createElement("div",null,
          /* Conflito de prioridade */
          conflito&&React.createElement("div",{style:{background:"#FEF3C7",border:"1px solid #FDE68A",borderRadius:8,padding:"10px 12px",marginBottom:12,fontSize:12}},
            React.createElement("div",{style:{fontWeight:700,color:"#92400E",marginBottom:4}},"\u26A0\uFE0F "+conflito.msg),
            React.createElement("button",{onClick:function(){setConflito(null);setField("prioridade","");setFormV(function(v){return v+1;});},style:{padding:"4px 12px",border:"none",borderRadius:6,background:"#D97706",color:"#fff",fontWeight:700,fontSize:11,cursor:"pointer"}},"Limpar prioridade e tentar novamente")
          ),

          React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}},
            React.createElement("div",{style:{gridColumn:"1/-1"}},
              React.createElement("label",{style:lS},"T\xEDtulo ",React.createElement("span",{style:{color:"#EF4444"}},"*")),
              React.createElement("input",{
                key:"titulo-"+formV,
                defaultValue:getForm().titulo,
                onChange:function(e){setField("titulo",e.target.value);},
                style:Object.assign({},iS,{marginBottom:10}),
                placeholder:"Ex: Conferir medica\xE7\xE3o UTI"
              })
            ),
            React.createElement("div",null,
              React.createElement("label",{style:lS},"Prioridade"),
              React.createElement("input",{
                key:"prio-"+formV,
                type:"number",min:1,step:1,
                defaultValue:getForm().prioridade,
                onChange:function(e){setField("prioridade",e.target.value);},
                style:Object.assign({},iS,{marginBottom:10}),
                placeholder:"1 = mais urgente"
              })
            ),
            React.createElement("div",null,
              React.createElement("label",{style:lS},"Prazo"),
              React.createElement("input",{
                key:"prazo-"+formV,
                type:"datetime-local",
                defaultValue:getForm().prazo,
                onChange:function(e){setField("prazo",e.target.value);},
                style:Object.assign({},iS,{marginBottom:10})
              })
            ),
            React.createElement("div",{style:{gridColumn:"1/-1"}},
              React.createElement("label",{style:lS},"Respons\xE1vel"),
              React.createElement("select",{
                key:"resp-"+formV,
                defaultValue:getForm().responsavel_id,
                onChange:function(e){setField("responsavel_id",e.target.value);},
                style:Object.assign({},iS,{marginBottom:10})
              },
                React.createElement("option",{value:""},"\u2014 sem respons\xE1vel \u2014"),
                users.map(function(u){return React.createElement("option",{key:u.id,value:u.id},u.nome+" ("+u.tipo+" "+(u.coren||u.crm||"")+")");})
              )
            ),
            React.createElement("div",{style:{gridColumn:"1/-1"}},
              React.createElement("label",{style:lS},"Descri\xE7\xE3o"),
              React.createElement("textarea",{
                key:"desc-"+formV,
                rows:2,
                defaultValue:getForm().descricao,
                onChange:function(e){setField("descricao",e.target.value);},
                style:Object.assign({},iS,{resize:"vertical",marginBottom:10})
              })
            )
          ),
          React.createElement("div",{style:{display:"flex",gap:8,justifyContent:"flex-end"}},
            React.createElement("button",{onClick:function(){setAba("pendentes");setEditing(null);setConflito(null);},style:{padding:"7px 16px",borderRadius:8,border:"1px solid #E2E8F0",background:"none",color:"#64748B",fontWeight:600,fontSize:13,cursor:"pointer"}},"Cancelar"),
            React.createElement("button",{onClick:handleSave,style:{padding:"7px 22px",borderRadius:8,border:"none",background:"#0F172A",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}},editing?"Salvar altera\xE7\xF5es":"Criar tarefa")
          )
        ),

        /* ABA: Pendentes (agrupadas por responsável) */
        aba==="pendentes"&&React.createElement("div",null,
          loading&&React.createElement("div",{style:{textAlign:"center",padding:32,color:"#94A3B8"}},"Carregando\u2026"),
          !loading&&pendentes.length===0&&React.createElement("div",{style:{textAlign:"center",padding:"48px 0"}},
            React.createElement("div",{style:{fontSize:32,marginBottom:8}},"\u2705"),
            React.createElement("div",{style:{fontWeight:700,fontSize:14,color:"#0F172A"}},"Nenhuma tarefa pendente"),
            podeGerir&&React.createElement("div",{style:{fontSize:12,color:"#94A3B8",marginTop:4}},"Clique em \"+ Nova tarefa\" para criar.")
          ),
          !loading&&grupos.map(function(nome){
            return React.createElement("div",{key:nome,style:{marginBottom:16}},
              React.createElement("div",{style:{fontSize:10,fontWeight:700,color:"#7C3AED",textTransform:"uppercase",letterSpacing:".06em",marginBottom:8,display:"flex",alignItems:"center",gap:6}},
                React.createElement("span",{style:{background:"#EDE9FE",borderRadius:99,padding:"2px 9px"}},"\uD83D\uDC64 "+nome),
                React.createElement("span",{style:{color:"#CBD5E1"}},porResponsavel[nome].length+" tarefa"+(porResponsavel[nome].length!==1?"s":""))
              ),
              porResponsavel[nome].map(function(a){ return React.createElement(CardAcao,{key:a.id,acao:a}); })
            );
          })
        ),

        /* ABA: Concluídas */
        aba==="concluidas"&&React.createElement("div",null,
          loading&&React.createElement("div",{style:{textAlign:"center",padding:32,color:"#94A3B8"}},"Carregando\u2026"),
          !loading&&concluidas.length===0&&React.createElement("div",{style:{textAlign:"center",padding:"48px 0"}},
            React.createElement("div",{style:{fontSize:11,color:"#94A3B8"}},"Nenhuma tarefa concluid\xE1 ainda.")
          ),
          !loading&&concluidas.map(function(a){
            var tempoLabel=a.tempo_min>0?(a.tempo_min>=60?Math.floor(a.tempo_min/60)+"h"+String(a.tempo_min%60).padStart(2,"0")+"min":a.tempo_min+"min"):null;
            return React.createElement("div",{key:a.id,style:{background:"#F8FAFC",border:"1px solid #E2E8F0",borderLeft:"3px solid #22C55E",borderRadius:10,padding:"10px 13px",marginBottom:6,opacity:0.85}},
              React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}},
                React.createElement("div",{style:{flex:1,minWidth:0}},
                  React.createElement("div",{style:{fontWeight:600,fontSize:12,color:"#374151",textDecoration:"line-through"}},a.titulo),
                  a.responsavel_nome&&React.createElement("div",{style:{fontSize:10,color:"#7C3AED",marginTop:1,fontWeight:600}},"👤 "+a.responsavel_nome),
                  React.createElement("div",{style:{display:"flex",gap:8,flexWrap:"wrap",fontSize:10,color:"#94A3B8",marginTop:2}},
                    React.createElement("span",null,"✓ ",a.concluida_por_nome," · ",new Date(a.concluida_em).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})),
                    tempoLabel&&React.createElement("span",{style:{color:"#3B82F6",fontWeight:600}},"⏱ "+tempoLabel)
                  )
                ),
                podeGerir&&React.createElement("button",{onClick:function(){handleReabrir(a);},style:{padding:"4px 10px",border:"1px solid #E2E8F0",borderRadius:6,background:"none",color:"#64748B",cursor:"pointer",fontSize:10}},"↩ Reabrir")
              )
            );
          })
        )
      )
    )
  );
}
