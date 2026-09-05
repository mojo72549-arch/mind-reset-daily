(function(){
  'use strict';
  var BUILD='20260905-v12-slim-start2',STORE='shp_db',SESSION='shp_session',scheduled=false;
  function read(storage,key,fallback){try{return JSON.parse(storage.getItem(key)||'null')||fallback}catch(e){return fallback}}
  function db(){return read(localStorage,STORE,{customers:[],orders:[],reports:[],invoices:[]})}
  function session(){return read(sessionStorage,SESSION,null)}
  function shared(){var s=session(),u=String(s&&s.user||'').toLowerCase();return u==='dome'||u==='annette'}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(ch){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}
  function closed(v){return /abgeschlossen|erledigt|storniert|bezahlt/i.test(String(v||''))}

  function isHome(main){
    if(main.querySelector('.crm-start-slim-v12'))return true;
    if(main.querySelector('.crm-dashboard-v94'))return true;
    var text=((main.querySelector('h1')||main.querySelector('h2')||{}).textContent||'').trim();
    if(/^(Start|Dome Arbeitsbereich|Meine Einsätze)$/i.test(text))return true;
    return !!main.querySelector('.hero')&&/Büro-Dashboard|Service Hub|Heute/i.test(main.textContent||'');
  }

  function render(){
    if(!shared()||!window.SH)return;
    var main=document.querySelector('main.shell');if(!main||!isHome(main))return;
    if(main.querySelector('.crm-start-slim-v12[data-build="'+BUILD+'"]'))return;
    var data=db(),customers={};
    (data.customers||[]).forEach(function(c){customers[c.id]=c});
    var openOrders=(data.orders||[]).filter(function(o){return !closed(o.status)}).slice(0,3);
    var list=openOrders.length?openOrders.map(function(o){
      var c=customers[o.customerId]||{};
      return '<article class="crm-slim-order"><div><span class="crm-eyebrow">'+esc(o.date||'Termin offen')+'</span><b>'+esc(o.no||'Auftrag')+' · '+esc(o.title||'')+'</b><small>'+esc(c.name||'Kunde')+' · '+esc(o.status||'Offen')+'</small></div><button class="btn crm-inline-action" onclick="SH.go(\'orders\')">Auftrag</button></article>';
    }).join(''):'<div class="crm-empty"><b>Keine offenen Aufträge</b><span>Aktuell ist nichts offen.</span></div>';
    var today=new Date().toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'});
    main.innerHTML='<section class="crm-start-slim-v12" data-build="'+BUILD+'"><div class="crm-slim-start-head"><span class="crm-overline">'+esc(today)+'</span><h1>Start</h1></div><section class="crm-slim-list"><div class="crm-slim-list-head"><div><span class="crm-overline">Heute im Blick</span><h2>Nächste Aufträge</h2></div><span>max. 3</span></div>'+list+'</section></section>';
    document.documentElement.dataset.shSlimStartBuild=BUILD;
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;render()})}
  new MutationObserver(schedule).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  window.SHP_SLIM_START={build:BUILD,render:render};schedule();
})();
