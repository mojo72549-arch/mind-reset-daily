(function(){
  'use strict';
  var BUILD='20260905-v12-slim-start1',STORE='shp_db',SESSION='shp_session',scheduled=false;
  function read(storage,key,fallback){try{return JSON.parse(storage.getItem(key)||'null')||fallback}catch(e){return fallback}}
  function db(){return read(localStorage,STORE,{customers:[],orders:[],reports:[],invoices:[]})}
  function session(){return read(sessionStorage,SESSION,null)}
  function shared(){var s=session(),u=String(s&&s.user||'').toLowerCase();return u==='dome'||u==='annette'}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(ch){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}
  function closed(v){return /abgeschlossen|erledigt|storniert|bezahlt/i.test(String(v||''))}
  function money(v){return(+v||0).toLocaleString('de-DE',{style:'currency',currency:'EUR'})}
  function render(){
    if(!shared()||!window.SH)return;
    var main=document.querySelector('main.shell');if(!main)return;
    var dash=main.querySelector('.crm-dashboard-v94');if(!dash||dash.dataset.slimV12===BUILD)return;
    var data=db(),customers={},orders={};
    (data.customers||[]).forEach(function(c){customers[c.id]=c});
    (data.orders||[]).forEach(function(o){orders[o.id]=o});
    var items=[];
    (data.reports||[]).filter(function(r){return !/abgeschlossen/i.test(String(r.status||''))}).slice(0,2).forEach(function(r){var o=orders[r.orderId]||{},c=customers[o.customerId]||{};items.push({label:'Rapport offen',title:(o.no||'Auftrag')+' · '+(o.title||'Rapport'),meta:(c.name||'Kunde')+' · '+(r.status||'Entwurf'),action:'Rapport öffnen',onclick:'SH.openReport('+Number(r.orderId)+')'})});
    (data.orders||[]).filter(function(o){return !closed(o.status)}).forEach(function(o){if(items.length>=3)return;var c=customers[o.customerId]||{};if(items.some(function(x){return x.onclick==='SH.openReport('+Number(o.id)+')'}))return;items.push({label:'Offener Auftrag',title:(o.no||'Auftrag')+' · '+(o.title||''),meta:(c.name||'Kunde')+' · '+(o.date||'Termin offen')+' · '+(o.status||'Offen'),action:'Auftrag öffnen',onclick:"SH.go('orders')"})});
    if(items.length<3){(data.invoices||[]).filter(function(iv){return !/bezahlt|storniert/i.test(String(iv.status||''))}).forEach(function(iv){if(items.length>=3)return;var c=customers[iv.customerId]||{};items.push({label:'Offene Rechnung',title:'Rechnung '+(iv.no||''),meta:(c.name||'Kunde')+' · '+money(iv.gross)+' · '+(iv.status||'Offen'),action:'Rechnung öffnen',onclick:'SH.openInvoice('+Number(iv.id)+')'})})}
    var list=items.length?items.map(function(it){return '<article class="crm-attention-item"><div class="crm-attention-copy"><span class="crm-eyebrow">'+esc(it.label)+'</span><b>'+esc(it.title)+'</b><small>'+esc(it.meta)+'</small></div><button class="btn crm-inline-action" onclick="'+it.onclick+'">'+esc(it.action)+'</button></article>'}).join(''):'<div class="crm-empty"><b>Alles erledigt</b><span>Aktuell ist kein Vorgang offen, der sofort Aufmerksamkeit braucht.</span></div>';
    var s=session(),name=String(s&&s.user||'').toLowerCase()==='dome'?'Dome':'Annette';
    var dateText=new Date().toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'});
    dash.classList.add('crm-start-slim-v12');dash.dataset.slimV12=BUILD;
    dash.innerHTML='<div class="crm-dash-head"><div><span class="crm-overline">'+esc(name)+' · '+esc(dateText)+'</span><h1>Start</h1><p>Nur das, was als Nächstes wichtig ist. Kunden, Aufträge, Rapporte und Rechnungen erreichst du direkt über die Tabs.</p></div><div class="crm-head-actions"><button class="btn primary" onclick="SH.go(\'customers\')">+ Auftrag</button><button class="btn" onclick="SH.go(\'customers\')">+ Kunde</button></div></div><section class="crm-slim-list"><div class="crm-slim-list-head"><div><span class="crm-overline">Heute im Blick</span><h2>Offene Vorgänge</h2></div><span>max. 3</span></div>'+list+'</section>';
    document.documentElement.dataset.shSlimStartBuild=BUILD;
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;render()})}
  new MutationObserver(schedule).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  window.SHP_SLIM_START={build:BUILD,render:render};schedule();
})();
