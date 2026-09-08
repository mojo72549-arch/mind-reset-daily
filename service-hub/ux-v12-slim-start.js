(function(){
  'use strict';
  var BUILD='20260908-v14-start-role3',STORE='shp_db',SESSION='shp_session',scheduled=false;
  function read(storage,key,fallback){try{return JSON.parse(storage.getItem(key)||'null')||fallback}catch(e){return fallback}}
  function db(){return read(localStorage,STORE,{customers:[],orders:[],reports:[],invoices:[]})}
  function session(){return read(sessionStorage,SESSION,null)}
  function user(){var s=session();return String(s&&s.user||'').toLowerCase()}
  function shared(){var u=user();return u==='dome'||u==='annette'}
  function tech(){var s=session();return user()==='dome'||String(s&&s.role||'').toLowerCase()==='tech'}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(ch){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[ch]})}
  function closed(v){return /abgeschlossen|erledigt|storniert|bezahlt/i.test(String(v||''))}
  function reportClosed(v){return /abgeschlossen/i.test(String(v||''))}
  function invoiceClosed(v){return /bezahlt|storniert/i.test(String(v||''))}

  function isHome(main){
    if(main.querySelector('.crm-start-slim-v12'))return true;
    if(main.querySelector('.crm-dashboard-v94'))return true;
    var text=((main.querySelector('h1')||main.querySelector('h2')||{}).textContent||'').trim();
    if(/^(Start|Dome Arbeitsbereich|Meine Einsätze)$/i.test(text))return true;
    return !!main.querySelector('.hero')&&/Büro-Dashboard|Service Hub|Heute/i.test(main.textContent||'');
  }
  function statusTile(tab,label,value,hint,icon){
    return '<button type="button" class="crm-start-status-tile" onclick="SH.go(\''+tab+'\')"><span class="crm-start-status-icon">'+icon+'</span><span><small>'+esc(label)+'</small><b>'+esc(value)+'</b><em>'+esc(hint)+'</em></span><span class="crm-start-chevron">›</span></button>';
  }
  function render(){
    if(!shared()||!window.SH)return;
    var main=document.querySelector('main.shell');if(!main||!isHome(main))return;
    if(main.querySelector('.crm-start-slim-v12[data-build="'+BUILD+'"]'))return;
    var data=db(),customers={},isTech=tech();
    (data.customers||[]).forEach(function(c){customers[c.id]=c});
    var allOpenOrders=(data.orders||[]).filter(function(o){return !closed(o.status)&&(!isTech||String(o.assignedTo||'').toLowerCase()==='dome')});
    var allowedOrderIds={};allOpenOrders.forEach(function(o){allowedOrderIds[String(o.id)]=true});
    var openOrders=allOpenOrders.slice(0,3);
    var openReports=(data.reports||[]).filter(function(r){return !reportClosed(r.status)&&(!isTech||allowedOrderIds[String(r.orderId)])}).length;
    var openInvoices=isTech?0:(data.invoices||[]).filter(function(i){return !invoiceClosed(i.status)}).length;
    var list=openOrders.length?openOrders.map(function(o){
      var c=customers[o.customerId]||{};
      return '<article class="crm-slim-order"><div class="crm-slim-order-main"><span class="crm-eyebrow">'+esc(o.date||'Termin offen')+'</span><b>'+esc(o.no||'Auftrag')+' · '+esc(o.title||'')+'</b><small>'+esc(c.name||'Kunde')+' · '+esc(o.status||'Offen')+'</small></div><button class="btn crm-inline-action" onclick="SH.openReport('+Number(o.id)+')">Öffnen</button></article>';
    }).join(''):'<div class="crm-empty"><b>Keine offenen Aufträge</b><span>Aktuell ist nichts offen.</span></div>';
    var now=new Date();
    var today=now.toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'});
    var welcome=now.getHours()<12?'Guten Morgen':now.getHours()<18?'Guten Tag':'Guten Abend';
    var summary=isTech
      ?(allOpenOrders.length===0&&openReports===0?'Alle zugewiesenen Vorgänge sind erledigt.':'Deine zugewiesenen Aufträge und Rapporte auf einen Blick.')
      :(allOpenOrders.length===0&&openReports===0&&openInvoices===0?'Alles erledigt – aktuell ist nichts offen.':'Die wichtigsten offenen Vorgänge auf einen Blick.');
    var invoiceTile=isTech?'':statusTile('invoices','Offene Rechnungen',String(openInvoices),'Status & Zahlung','€');
    var hint=isTech?'Kunde, Auftrag und Rapport erreichst du jederzeit über die Navigation.':'Kunde, Auftrag, Rapport und Rechnung erreichst du jederzeit über die Navigation.';
    main.innerHTML='<section class="crm-start-slim-v12" data-build="'+BUILD+'">'+
      '<section class="crm-start-hero-v14"><div><span class="crm-start-brand">Service Hub Pro</span><h1>'+esc(welcome)+'</h1><p>'+esc(summary)+'</p></div><div class="crm-start-date"><span>Heute</span><b>'+esc(today)+'</b></div></section>'+
      '<section class="crm-start-status-grid" aria-label="Aktueller Arbeitsstand">'+
        statusTile('orders','Offene Aufträge',String(allOpenOrders.length),'Planung & Einsatz','▣')+
        statusTile('reports','Offene Rapporte',String(openReports),'Dokumentation','✓')+
        invoiceTile+
      '</section>'+
      '<section class="crm-slim-list"><div class="crm-slim-list-head"><div><span class="crm-overline">Heute im Blick</span><h2>Nächste Aufträge</h2></div><button type="button" class="crm-start-text-link" onclick="SH.go(\'orders\')">Alle Aufträge</button></div>'+list+'</section>'+
      '<div class="crm-start-hint">'+esc(hint)+'</div>'+
    '</section>';
    document.documentElement.dataset.shSlimStartBuild=BUILD;
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;render()})}
  new MutationObserver(schedule).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  window.SHP_SLIM_START={build:BUILD,render:render};schedule();
})();