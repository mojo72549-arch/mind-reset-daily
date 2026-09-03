(function(){
  'use strict';
  var BUILD='20260903-v9-4';
  var STORE='shp_db', SESSION='shp_session';
  var scheduled=false;

  function esc(v){
    return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function money(v){
    return (+v||0).toLocaleString('de-DE',{style:'currency',currency:'EUR'});
  }
  function readJson(key){
    try{return JSON.parse((key===SESSION?sessionStorage:localStorage).getItem(key)||'null')}catch(e){return null}
  }
  function parseGermanDate(value){
    var m=String(value||'').match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if(!m)return null;
    var d=new Date(+m[3],+m[2]-1,+m[1]);
    d.setHours(0,0,0,0);
    return d;
  }
  function today(){var d=new Date();d.setHours(0,0,0,0);return d}
  function isClosed(status){return /abgeschlossen|erledigt|storniert|bezahlt/i.test(String(status||''))}
  function customerMap(db){
    var map={};
    (db.customers||[]).forEach(function(c){map[c.id]=c});
    return map;
  }
  function orderMap(db){
    var map={};
    (db.orders||[]).forEach(function(o){map[o.id]=o});
    return map;
  }
  function reportsByOrder(db){
    var map={};
    (db.reports||[]).forEach(function(r){map[r.orderId]=r});
    return map;
  }
  function officeSession(){
    var s=readJson(SESSION);
    return s&&s.role==='office'?s:null;
  }
  function canEnhance(){
    if(!officeSession())return false;
    var main=document.querySelector('main.shell');
    if(!main)return false;
    if(main.querySelector('.crm-dashboard-v94'))return false;
    var hero=main.querySelector('.hero');
    return !!(hero&&/Büro-Dashboard/i.test(hero.textContent||''));
  }
  function priorityItems(db){
    var customers=customerMap(db), orders=orderMap(db), items=[];
    var outstanding=(db.invoices||[]).filter(function(iv){return !/bezahlt|storniert/i.test(String(iv.status||''))});
    outstanding.filter(function(iv){var due=parseGermanDate(iv.due);return due&&due<today()}).slice(0,2).forEach(function(iv){
      var c=customers[iv.customerId]||{};
      items.push({kind:'overdue',label:'Überfällige Rechnung',title:'Rechnung '+(iv.no||''),meta:(c.name||'Kunde')+' · '+money(iv.gross)+' · fällig '+(iv.due||'–'),action:'Rechnung öffnen',onclick:'SHP_V9_DASHBOARD.openInvoice('+Number(iv.id)+')'});
    });
    (db.reports||[]).filter(function(r){return !/abgeschlossen/i.test(String(r.status||''))}).slice(0,2).forEach(function(r){
      if(items.length>=4)return;
      var o=orders[r.orderId]||{}, c=customers[o.customerId]||{};
      items.push({kind:'report',label:'Rapport offen',title:(o.no||'Auftrag')+' · '+(o.title||'Rapport'),meta:(c.name||'Kunde')+' · '+(r.status||'Entwurf'),action:'Rapport öffnen',onclick:'SHP_V9_DASHBOARD.openReport('+Number(r.orderId)+')'});
    });
    (db.orders||[]).filter(function(o){return !isClosed(o.status)}).slice(0,3).forEach(function(o){
      if(items.length>=4)return;
      var already=items.some(function(x){return x.onclick==='SHP_V9_DASHBOARD.openReport('+Number(o.id)+')'});
      if(already)return;
      var c=customers[o.customerId]||{};
      items.push({kind:'order',label:'Offener Auftrag',title:(o.no||'Auftrag')+' · '+(o.title||''),meta:(c.name||'Kunde')+' · '+(o.date||'Termin offen')+' · '+(o.status||'Offen'),action:'Vorgang öffnen',onclick:'SHP_V9_DASHBOARD.openReport('+Number(o.id)+')'});
    });
    if(items.length<4){
      outstanding.filter(function(iv){return !items.some(function(x){return x.title==='Rechnung '+(iv.no||'')})}).slice(0,4-items.length).forEach(function(iv){
        var c=customers[iv.customerId]||{};
        items.push({kind:'invoice',label:'Offene Rechnung',title:'Rechnung '+(iv.no||''),meta:(c.name||'Kunde')+' · '+money(iv.gross)+' · '+(iv.status||'Offen'),action:'Rechnung öffnen',onclick:'SHP_V9_DASHBOARD.openInvoice('+Number(iv.id)+')'});
      });
    }
    return items.slice(0,4);
  }
  function upcomingOrders(db){
    var customers=customerMap(db);
    return (db.orders||[]).filter(function(o){return !isClosed(o.status)}).slice().sort(function(a,b){
      return String(a.date||'99.99.9999').localeCompare(String(b.date||'99.99.9999'));
    }).slice(0,3).map(function(o){
      var c=customers[o.customerId]||{};
      return '<button class="crm-next-row" onclick="SHP_V9_DASHBOARD.openReport('+Number(o.id)+')"><span class="crm-next-date">'+esc(o.date||'–')+'</span><span><b>'+esc(o.no||'Auftrag')+'</b><small>'+esc(c.name||'Kunde')+' · '+esc(o.title||'')+'</small></span><span aria-hidden="true">›</span></button>';
    }).join('');
  }
  function render(){
    if(!canEnhance())return;
    var db=readJson(STORE)||{};
    var main=document.querySelector('main.shell');
    if(!main)return;
    var activeOrders=(db.orders||[]).filter(function(o){return !isClosed(o.status)}).length;
    var openReports=(db.reports||[]).filter(function(r){return !/abgeschlossen/i.test(String(r.status||''))}).length;
    var outstanding=(db.invoices||[]).filter(function(iv){return !/bezahlt|storniert/i.test(String(iv.status||''))});
    var openAmount=outstanding.reduce(function(sum,iv){return sum+(+iv.gross||0)},0);
    var items=priorityItems(db);
    var attention=items.length?items.map(function(it){
      return '<article class="crm-attention-item crm-'+it.kind+'"><div class="crm-attention-copy"><span class="crm-eyebrow">'+esc(it.label)+'</span><b>'+esc(it.title)+'</b><small>'+esc(it.meta)+'</small></div><button class="btn crm-inline-action" onclick="'+it.onclick+'">'+esc(it.action)+'</button></article>';
    }).join(''):'<div class="crm-empty"><b>Alles im grünen Bereich</b><span>Aktuell gibt es keine offenen Punkte, die sofortige Aufmerksamkeit brauchen.</span></div>';
    var upcoming=upcomingOrders(db)||'<div class="crm-empty compact"><span>Keine offenen Aufträge vorhanden.</span></div>';
    var dateText=new Date().toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'});

    main.innerHTML='\
      <section class="crm-dashboard-v94" data-build="'+BUILD+'">\
        <div class="crm-dash-head">\
          <div><span class="crm-overline">Büro · '+esc(dateText)+'</span><h1>Was heute wichtig ist</h1><p>Auf einen Blick sehen, wo ein nächster Schritt nötig ist – ohne Statistik-Wand.</p></div>\
          <div class="crm-head-actions"><button class="btn primary" onclick="SHP_V9_DASHBOARD.newOrder()">+ Neuer Auftrag</button><button class="btn" onclick="SHP_V9_DASHBOARD.newCustomer()">+ Kunde</button></div>\
        </div>\
        <div class="crm-kpi-strip" aria-label="Arbeitsstatus">\
          <div class="crm-kpi"><span>Offene Aufträge</span><b>'+activeOrders+'</b></div>\
          <div class="crm-kpi"><span>Rapporte in Bearbeitung</span><b>'+openReports+'</b></div>\
          <div class="crm-kpi"><span>Offener Rechnungsbetrag</span><b>'+esc(money(openAmount))+'</b></div>\
        </div>\
        <div class="crm-dash-grid">\
          <section class="crm-panel crm-attention"><div class="crm-panel-head"><div><span class="crm-overline">Arbeitsliste</span><h2>Heute im Blick</h2></div><button class="crm-text-link" onclick="SHP_V9_DASHBOARD.go(\'invoices\')">Alle Rechnungen</button></div>'+attention+'</section>\
          <aside class="crm-side">\
            <section class="crm-panel crm-quick"><span class="crm-overline">Schnellzugriff</span><h2>Direkt weiterarbeiten</h2><div class="crm-quick-grid"><button onclick="SHP_V9_DASHBOARD.go(\'customers\')"><b>Kunden</b><small>Stammdaten & 360°-Sicht</small></button><button onclick="SHP_V9_DASHBOARD.go(\'orders\')"><b>Aufträge</b><small>Planung & Status</small></button><button onclick="SHP_V9_DASHBOARD.go(\'reports\')"><b>Rapporte</b><small>Dokumentation prüfen</small></button><button onclick="SHP_V9_DASHBOARD.go(\'invoices\')"><b>Rechnungen</b><small>Offen, fällig, bezahlt</small></button></div></section>\
            <section class="crm-panel crm-next"><div class="crm-panel-head"><div><span class="crm-overline">Vorgänge</span><h2>Nächste Aufträge</h2></div></div>'+upcoming+'</section>\
          </aside>\
        </div>\
      </section>';
    document.documentElement.setAttribute('data-sh-dashboard-build',BUILD);
  }
  function schedule(){
    if(scheduled)return;
    scheduled=true;
    setTimeout(function(){scheduled=false;render()},0);
  }
  function wrap(name){
    if(!window.SH||typeof window.SH[name]!=='function')return;
    var original=window.SH[name];
    window.SH[name]=function(){var out=original.apply(this,arguments);schedule();return out};
  }

  window.SHP_V9_DASHBOARD={
    build:BUILD,
    render:render,
    go:function(tab){if(window.SH)window.SH.go(tab)},
    openInvoice:function(id){if(window.SH)window.SH.openInvoice(id)},
    openReport:function(id){if(window.SH)window.SH.openReport(id)},
    newCustomer:function(){if(window.SH)window.SH.newCustomer()},
    newOrder:function(){if(window.SH)window.SH.newOrder()}
  };
  ['login','go','newCustomer','newOrder','saveInvoiceStatus'].forEach(wrap);
  var observer=new MutationObserver(schedule);
  observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  schedule();
})();
