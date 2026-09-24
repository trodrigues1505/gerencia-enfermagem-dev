/* ── Bloco 1: estilos globais e componentes ── */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;-webkit-tap-highlight-color:transparent}
body{font-family:'Inter',system-ui,-apple-system,sans-serif;background:#F1F5F9;color:#0F172A}
input,select,textarea,button{font-family:inherit}
.k-card{transition:box-shadow .14s,transform .12s}
.k-card:hover{box-shadow:0 3px 12px rgba(0,0,0,.1);transform:translateY(-1px)}
.k-card[draggable=true]{cursor:grab}
.k-card[draggable=true]:active{cursor:grabbing}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:99px}
kbd{font-family:monospace;background:#F1F5F9;padding:1px 5px;border-radius:3px;border:1px solid #E2E8F0;font-size:10px}
/* ── Mobile: kanban accordion ── */
@media(max-width:640px){
  #kanban-board{flex-direction:column!important;gap:6px!important;overflow-x:visible!important}
  #kanban-board>div{min-width:100%!important;max-width:100%!important;flex:none!important}
}
/* ── Tooltip ── */
.tip{position:relative;display:inline-flex;align-items:center;cursor:help}
.tip .tipbox{
  position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%) translateY(4px);
  background:#0F172A;color:#F8FAFC;font-size:11px;line-height:1.5;font-weight:400;
  padding:8px 11px;border-radius:8px;width:230px;z-index:9000;pointer-events:none;
  opacity:0;transition:opacity .15s,transform .15s;white-space:normal;text-align:left;box-shadow:0 4px 16px rgba(0,0,0,.3)
}
.tip .tipbox::after{content:"";position:absolute;top:100%;left:50%;transform:translateX(-50%);
  border:5px solid transparent;border-top-color:#0F172A}
.tip:hover .tipbox,.tip:focus-within .tipbox{opacity:1;transform:translateX(-50%) translateY(0)}
/* ── Tooltip: reset text-transform herdado ── */
.tip .tipbox{text-transform:none!important;letter-spacing:0!important}
/* ── Floating actions ── */
#ge-fab{position:fixed;bottom:20px;right:16px;z-index:8000;display:flex;flex-direction:column;align-items:flex-end;gap:6px}
@media(max-width:640px){#ge-fab{bottom:calc(96px + env(safe-area-inset-bottom,0px));right:max(12px,env(safe-area-inset-right,12px))}}
/* ── Mobile: nav barra ── */
@media(max-width:640px){
  .ge-nav-bar{overflow-x:auto!important;overflow-y:visible!important;flex-wrap:nowrap!important;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:#94A3B8 #F1F5F9;gap:4px!important;margin-bottom:8px!important;padding-bottom:6px!important}
  .ge-nav-bar::-webkit-scrollbar{height:5px;display:block!important}
  .ge-nav-bar::-webkit-scrollbar-track{background:#F1F5F9;border-radius:99px}
  .ge-nav-bar::-webkit-scrollbar-thumb{background:#94A3B8;border-radius:99px}
  .ge-nav-inner{flex-shrink:0}
  /* Modais */
  .ge-modal-wrap{padding:8px!important}
  .ge-modal-inner{max-height:90vh!important;margin:0!important;border-radius:12px!important}
  /* Kanban cards menores no mobile */
  #kanban-board>div{min-width:92vw!important;max-width:92vw!important}
  /* Users */
  .ge-user-card{flex-wrap:wrap!important;align-items:flex-start!important}
  .ge-user-perms{display:flex!important;flex-wrap:wrap!important;gap:4px!important;width:100%!important;margin-top:6px!important}
  .ge-user-perms button{font-size:10px!important;padding:3px 7px!important}
  /* Livro modal */
  .ls-modal{max-height:90vh!important;margin:0 4px!important}
  .ls-grid.ls-g2,.ls-grid.ls-g3{grid-template-columns:1fr!important}
}
/* ── Mobile modal fixes ── */
@media(max-width:640px){
  .modal-shell-inner{max-height:95vh!important;overflow-y:auto!important}
  .ls-modal{max-height:95vh!important}
  .ls-grid.ls-g2,.ls-grid.ls-g3{grid-template-columns:1fr!important}
}
/* ── Livro de Saída ── */
.ls-overlay{position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:2000;display:flex;align-items:center;justify-content:center;padding:16px}
.ls-modal{background:#fff;border-radius:16px;width:100%;max-width:680px;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.35)}
.ls-hd{background:#0F172A;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.ls-hd h2{color:#fff;font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px}
.ls-hd-sub{color:#94A3B8;font-size:11px;margin-top:2px}
.ls-body{flex:1;overflow-y:auto;padding:20px}
.ls-ft{padding:14px 20px;border-top:1px solid #F1F5F9;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;gap:8px}
.ls-section{margin-bottom:18px}
.ls-section-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#94A3B8;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #F1F5F9}
.ls-grid{display:grid;gap:10px}
.ls-g2{grid-template-columns:1fr 1fr}
.ls-g3{grid-template-columns:1fr 1fr 1fr}
.ls-field{display:flex;flex-direction:column;gap:3px}
.ls-field label{font-size:10px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.04em}
.ls-field label .req{color:#EF4444;margin-left:2px}
.ls-field input,.ls-field select,.ls-field textarea{border:1.5px solid #E2E8F0;border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit;color:#0F172A;outline:none;background:#fff;transition:border-color .15s}
.ls-field input:focus,.ls-field select:focus,.ls-field textarea:focus{border-color:#3B82F6;box-shadow:0 0 0 3px rgba(59,130,246,.1)}
.ls-field input.err,.ls-field select.err{border-color:#EF4444;box-shadow:0 0 0 3px rgba(239,68,68,.1)}
.ls-bool{display:flex;gap:16px;align-items:center;padding-top:4px}
.ls-bool label{display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:#374151;font-weight:500}
/* Pendentes */
.ls-pending-card{background:#fff;border:1.5px solid #E2E8F0;border-radius:10px;padding:14px 16px;margin-bottom:8px;transition:border-color .15s}
.ls-pending-card:hover{border-color:#3B82F6}
/* Match */
@keyframes lsToastIn{from{opacity:0;transform:translate(-50%,-8px)}to{opacity:1;transform:translate(-50%,0)}}
.ls-match-overlay{position:absolute;inset:0;background:rgba(15,23,42,.7);display:flex;align-items:center;justify-content:center;padding:16px;z-index:10;border-radius:16px}
.ls-match-box{background:#fff;border-radius:14px;padding:24px;max-width:540px;width:100%;box-shadow:0 16px 48px rgba(0,0,0,.3)}
/* Toggle livro */
.livro-btn{position:relative;display:inline-flex;align-items:center;gap:6px}
.livro-badge{position:absolute;top:-6px;right:-6px;background:#EF4444;color:#fff;font-size:9px;font-weight:800;min-width:16px;height:16px;border-radius:99px;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid #fff}
/* Toggle can_livro no UsersPanel */
.can-livro-toggle{display:inline-flex;align-items:center;gap:5px;padding:4px 8px;border-radius:6px;border:1px solid #E2E8F0;background:#F8FAFC;cursor:pointer;font-size:11px;font-weight:600;color:#64748B;transition:all .15s}
.can-livro-toggle.on{background:#F0FDF4;border-color:#86EFAC;color:#16A34A}

/* ── Bloco 2: versão, update banner, SW UI ── */
#ge-version{
    position:fixed; left:10px; bottom:10px; z-index:9998;
    display:inline-flex; align-items:center; gap:6px;
    padding:5px 10px; border-radius:999px;
    background:rgba(15,23,42,.055); border:1px solid rgba(15,23,42,.08);
    color:#64748B; font:500 11px/1 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;
    font-variant-numeric:tabular-nums; letter-spacing:.01em;
    cursor:pointer; user-select:none;
    transition:background .16s ease, color .16s ease, opacity .16s ease;
    opacity:.65;
  }
  #ge-version:hover{opacity:1; background:rgba(15,23,42,.09); color:#334155}
  #ge-version:focus-visible{outline:2px solid #0F172A; outline-offset:2px; opacity:1}
  #ge-version .ge-pip{width:5px;height:5px;border-radius:999px;background:#94A3B8;flex:none}
  #ge-version[data-state="checking"] .ge-pip{background:#0EA5E9;animation:ge-pulse 1s ease-in-out infinite}
  #ge-version[data-state="current"] .ge-pip{background:#22C55E}
  #ge-version[data-state="stale"]{opacity:1;background:#FEF3C7;border-color:#FDE68A;color:#92400E}
  #ge-version[data-state="stale"] .ge-pip{background:#F59E0B}
  @keyframes ge-pulse{50%{opacity:.3}}
  @media (max-width:640px){ #ge-version{left:8px;bottom:8px;font-size:10px;padding:4px 8px} }

  #ge-update{
    position:fixed; z-index:9999; left:50%; bottom:24px; transform:translate(-50%,16px);
    width:min(420px,calc(100vw - 32px));
    display:flex; align-items:flex-start; gap:14px;
    background:#0F172A; color:#F1F5F9; border-radius:14px; padding:16px 18px;
    box-shadow:0 12px 32px -12px rgba(15,23,42,.55);
    font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;
    opacity:0; pointer-events:none;
    transition:opacity .2s ease, transform .2s ease;
  }
  #ge-update.show{opacity:1; transform:translate(-50%,0); pointer-events:auto}
  #ge-update .ge-txt{flex:1; min-width:0}
  #ge-update b{display:block; font-size:14px; font-weight:600; margin-bottom:3px}
  #ge-update span{display:block; font-size:13px; line-height:1.45; color:#94A3B8}
  #ge-update .ge-acts{display:flex; flex-direction:column; gap:6px; flex:none}
  #ge-update button{
    font:600 13px/1 inherit; cursor:pointer; border:0; border-radius:8px;
    padding:9px 14px; transition:background .16s ease, color .16s ease;
  }
  #ge-update .ge-now{background:#38BDF8; color:#06263A}
  #ge-update .ge-now:hover{background:#7DD3FC}
  #ge-update .ge-later{background:transparent; color:#94A3B8}
  #ge-update .ge-later:hover{color:#F1F5F9}
  #ge-update button:focus-visible{outline:2px solid #38BDF8; outline-offset:2px}
  @media (max-width:520px){
    #ge-update{flex-direction:column; gap:12px}
    #ge-update .ge-acts{flex-direction:row-reverse; justify-content:flex-start; width:100%}
  }
  @media (prefers-reduced-motion:reduce){ #ge-version,#ge-update{transition:none} #ge-version .ge-pip{animation:none} }
