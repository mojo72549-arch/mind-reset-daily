(function(){
  'use strict';
  var BUILD='20260905-v11-memory1';
  var STORE='shp_db',SESSION='shp_session';
  var scheduled=false,recognition=null,activeCustomerId=null;

  function readJson(storage,key,fallback){try{return JSON.parse(storage.getItem(key)||'null')||fallback}catch(e){return fallback}}
  function readDb(){return readJson(localStorage,STORE,{customers:[],orders:[],reports:[],invoices:[]})}
  function saveDb(db){localStorage.setItem(STORE,JSON.stringify(db))}
  function current(){return readJson(sessionStorage,SESSION,null)}
  function isDome(){var s=current();return !!(s&&(String(s.user||'').toLowerCase()==='dome'||String(s.role||'').toLowerCase()==='tech'))}
  function isSharedRole(){var s=current(),u=String(s&&s.user||'').toLowerCase();return u==='dome'||u==='annette'}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(ch){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}
  function money(v){return(+v||0).toLocaleString('de-DE',{style:'currency',currency:'EUR'})}
  function closed(s){return /abgeschlossen|erledigt|storniert|bezahlt/i.test(String(s||''))}

  function sharedDesktopNav(){
    if(!isSharedRole()||!window.SH)return;
    var nav=document.querySelector('.nav.desktop');if(!nav)return;
    if(nav.dataset.sharedV11===BUILD)return;
    nav.dataset.sharedV11=BUILD;
    nav.innerHTML='<button class="btn" onclick="SH.go(\'home\')">Start</button><button class="btn" onclick="SH.go(\'customers\')">Kunde</button><button class="btn" onclick="SH.go(\'orders\')">Auftrag</button><button class="btn" onclick="SH.go(\'reports\')">Rapport</button><button class="btn" onclick="SH.go(\'invoices\')">Rechnung</button><button class="btn" onclick="SH.logout()">Logout</button>';
  }

  function renderDomeDashboard(){
    if(!isDome())return;
    var main=document.querySelector('main.shell');if(!main||main.querySelector('.crm-dashboard-v94'))return;
    var title=((main.querySelector('h1')||main.querySelector('h2')||{}).textContent||'').trim();
    if(title!=='Dome Arbeitsbereich'&&title!=='Meine Einsätze'&&!main.querySelector('.ux-dome-modules'))return;
    var db=readDb(),customers={},orders={};
    (db.customers||[]).forEach(function(c){customers[c.id]=c});
    (db.orders||[]).forEach(function(o){orders[o.id]=o});
    var activeOrders=(db.orders||[]).filter(function(o){return !closed(o.status)}).length;
    var openReports=(db.reports||[]).filter(function(r){return !/abgeschlossen/i.test(String(r.status||''))}).length;
    var outstanding=(db.invoices||[]).filter(function(iv){return !/bezahlt|storniert/i.test(String(iv.status||''))});
    var openAmount=outstanding.reduce(function(sum,iv){return sum+(+iv.gross||0)},0);
    var items=[];
    (db.reports||[]).filter(function(r){return !/abgeschlossen/i.test(String(r.status||''))}).slice(0,2).forEach(function(r){var o=orders[r.orderId]||{},c=customers[o.customerId]||{};items.push({label:'Rapport offen',title:(o.no||'Auftrag')+' · '+(o.title||'Rapport'),meta:(c.name||'Kunde')+' · '+(r.status||'Entwurf'),action:'Rapport öffnen',onclick:'SH.openReport('+Number(r.orderId)+')'})});
    (db.orders||[]).filter(function(o){return !closed(o.status)}).slice(0,4).forEach(function(o){if(items.length>=4)return;var c=customers[o.customerId]||{};items.push({label:'Offener Auftrag',title:(o.no||'Auftrag')+' · '+(o.title||''),meta:(c.name||'Kunde')+' · '+(o.date||'Termin offen')+' · '+(o.status||'Offen'),action:'Vorgang öffnen',onclick:'SH.openReport('+Number(o.id)+')'})});
    var attention=items.length?items.map(function(it){return '<article class="crm-attention-item crm-order"><div class="crm-attention-copy"><span class="crm-eyebrow">'+esc(it.label)+'</span><b>'+esc(it.title)+'</b><small>'+esc(it.meta)+'</small></div><button class="btn crm-inline-action" onclick="'+it.onclick+'">'+esc(it.action)+'</button></article>'}).join(''):'<div class="crm-empty"><b>Alles im grünen Bereich</b><span>Aktuell gibt es keine offenen Punkte, die sofortige Aufmerksamkeit brauchen.</span></div>';
    var upcoming=(db.orders||[]).filter(function(o){return !closed(o.status)}).slice(0,3).map(function(o){var c=customers[o.customerId]||{};return '<button class="crm-next-row" onclick="SH.openReport('+Number(o.id)+')"><span class="crm-next-date">'+esc(o.date||'–')+'</span><span><b>'+esc(o.no||'Auftrag')+'</b><small>'+esc(c.name||'Kunde')+' · '+esc(o.title||'')+'</small></span><span aria-hidden="true">›</span></button>'}).join('')||'<div class="crm-empty compact"><span>Keine offenen Aufträge vorhanden.</span></div>';
    var dateText=new Date().toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'});
    main.innerHTML='<section class="crm-dashboard-v94 dome-shared-dashboard-v11" data-build="'+BUILD+'"><div class="crm-dash-head"><div><span class="crm-overline">Dome · '+esc(dateText)+'</span><h1>Was heute wichtig ist</h1><p>Auf einen Blick sehen, wo ein nächster Schritt nötig ist – ohne Statistik-Wand.</p></div><div class="crm-head-actions"><button class="btn primary" onclick="SH.go(\'customers\')">+ Neuer Auftrag</button><button class="btn" onclick="SH.go(\'customers\')">+ Kunde</button></div></div><div class="crm-kpi-strip" aria-label="Arbeitsstatus"><div class="crm-kpi"><span>Offene Aufträge</span><b>'+activeOrders+'</b></div><div class="crm-kpi"><span>Rapporte in Bearbeitung</span><b>'+openReports+'</b></div><div class="crm-kpi"><span>Offener Rechnungsbetrag</span><b>'+esc(money(openAmount))+'</b></div></div><div class="crm-dash-grid"><section class="crm-panel crm-attention"><div class="crm-panel-head"><div><span class="crm-overline">Arbeitsliste</span><h2>Heute im Blick</h2></div><button class="crm-text-link" onclick="SH.go(\'invoices\')">Alle Rechnungen</button></div>'+attention+'</section><aside class="crm-side"><section class="crm-panel crm-quick"><span class="crm-overline">Schnellzugriff</span><h2>Direkt weiterarbeiten</h2><div class="crm-quick-grid"><button onclick="SH.go(\'customers\')"><b>Kunden</b><small>Stammdaten & 360°-Sicht</small></button><button onclick="SH.go(\'orders\')"><b>Aufträge</b><small>Planung & Status</small></button><button onclick="SH.go(\'reports\')"><b>Rapporte</b><small>Dokumentation prüfen</small></button><button onclick="SH.go(\'invoices\')"><b>Rechnungen</b><small>Offen, fällig, bezahlt</small></button></div></section><section class="crm-panel crm-next"><div class="crm-panel-head"><div><span class="crm-overline">Vorgänge</span><h2>Nächste Aufträge</h2></div></div>'+upcoming+'</section></aside></div></section>';
  }

  function resolveContext(){
    var main=document.querySelector('main.shell');if(!main||main.querySelector('.doc'))return null;
    var db=readDb(),text=main.textContent||'',order=null,customer=null;
    (db.orders||[]).some(function(o){if(o.no&&text.indexOf(o.no)>=0){order=o;return true}return false});
    if(order)customer=(db.customers||[]).find(function(c){return String(c.id)===String(order.customerId)})||null;
    if(!customer){var heading=((main.querySelector('h1')||main.querySelector('h2')||{}).textContent||'').trim();customer=(db.customers||[]).find(function(c){return String(c.name||'').trim()===heading})||null}
    return customer?{main:main,db:db,customer:customer,order:order}:null;
  }

  function bullets(text){
    var cleaned=String(text||'').replace(/\b(?:ähm?|also|halt|quasi|sozusagen)\b/gi,' ').replace(/\s+/g,' ').trim();
    if(!cleaned)return[];
    var parts=cleaned.split(/(?:[.!?;\n]+|\b(?:danach|anschließend|anschliessend|außerdem|ausserdem|zusätzlich|und dann)\b)/i).map(function(x){return x.replace(/^\s*[,\-–]+|[,\-–]+\s*$/g,'').trim()}).filter(Boolean);
    if(parts.length===1&&cleaned.length>90)parts=cleaned.split(/,|\bund\b/i).map(function(x){return x.trim()}).filter(function(x){return x.length>2});
    return parts.slice(0,10).map(function(x){x=x.replace(/[.,;:]+$/,'').trim();return x.charAt(0).toUpperCase()+x.slice(1)});
  }

  function noteHistory(customer){
    var notes=(customer.domeNotes||[]).slice().sort(function(a,b){return Number(b.id||0)-Number(a.id||0)});
    if(!notes.length)return '<div class="dome-memory-empty">Noch keine Gedächtnisstütze hinterlegt.</div>';
    return notes.map(function(n){return '<article class="dome-memory-entry"><div class="dome-memory-meta"><b>'+esc(n.date||'')+'</b>'+(n.orderNo?' · '+esc(n.orderNo):'')+'</div><ul>'+((n.bullets||[]).map(function(b){return '<li>'+esc(b)+'</li>'}).join(''))+'</ul>'+(n.transcript?'<details><summary>Gesprochenen Originaltext anzeigen</summary><p>'+esc(n.transcript)+'</p></details>':'')+'</article>'}).join('');
  }

  function updatePreview(root){var text=root.querySelector('.dome-memory-input').value,items=bullets(text),preview=root.querySelector('.dome-memory-preview');preview.innerHTML=items.length?'<b>Stichpunkte</b><ul>'+items.map(function(x){return '<li>'+esc(x)+'</li>'}).join('')+'</ul>':'<span>Die gesprochenen Inhalte werden hier automatisch als Stichpunkte vorbereitet.</span>'}
  function setRecording(root,on){var btn=root.querySelector('.dome-memory-mic');btn.classList.toggle('recording',on);btn.innerHTML=on?'■ Aufnahme stoppen':'🎙️ Reinsprechen';root.querySelector('.dome-memory-status').textContent=on?'Ich höre zu …':'Bereit'}

  function startSpeech(root){
    var API=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!API){root.querySelector('.dome-memory-status').textContent='Spracheingabe wird in diesem Browser nicht unterstützt. Du kannst die Notiz eintippen.';root.querySelector('.dome-memory-input').focus();return}
    if(recognition){try{recognition.stop()}catch(e){}recognition=null;setRecording(root,false);return}
    recognition=new API();recognition.lang='de-DE';recognition.interimResults=true;recognition.continuous=false;
    var input=root.querySelector('.dome-memory-input'),base=input.value.trim();
    recognition.onstart=function(){setRecording(root,true)};
    recognition.onresult=function(event){var finalText='',interim='';for(var i=event.resultIndex;i<event.results.length;i++){var t=event.results[i][0].transcript;if(event.results[i].isFinal)finalText+=t+' ';else interim+=t}input.value=(base+(base?' ':'')+finalText+interim).trim();updatePreview(root)};
    recognition.onerror=function(event){root.querySelector('.dome-memory-status').textContent=event.error==='not-allowed'?'Mikrofonzugriff wurde nicht erlaubt.':'Spracheingabe konnte nicht abgeschlossen werden.'};
    recognition.onend=function(){recognition=null;setRecording(root,false);updatePreview(root)};
    try{recognition.start()}catch(e){recognition=null;setRecording(root,false)}
  }

  function saveNote(root,context){
    var text=root.querySelector('.dome-memory-input').value.trim(),list=bullets(text);if(!text||!list.length){root.querySelector('.dome-memory-status').textContent='Bitte zuerst etwas einsprechen oder eintippen.';return}
    var db=readDb(),customer=(db.customers||[]).find(function(c){return String(c.id)===String(context.customer.id)});if(!customer)return;
    customer.domeNotes=customer.domeNotes||[];customer.domeNotes.push({id:Date.now(),date:new Date().toLocaleString('de-DE'),author:'dome',orderId:context.order?context.order.id:null,orderNo:context.order?context.order.no:'',transcript:text,bullets:list});saveDb(db);
    root.querySelector('.dome-memory-input').value='';updatePreview(root);root.querySelector('.dome-memory-status').textContent='Notiz gespeichert.';root.querySelector('.dome-memory-history').innerHTML=noteHistory(customer);
  }

  function mountMemory(){
    if(!isDome())return;
    var context=resolveContext();if(!context){activeCustomerId=null;return}
    var existing=context.main.querySelector('.dome-memory-v11');if(existing&&String(existing.dataset.customerId)===String(context.customer.id)){activeCustomerId=context.customer.id;return}
    if(existing)existing.remove();
    var root=document.createElement('section');root.className='card dome-memory-v11';root.dataset.customerId=context.customer.id;
    root.innerHTML='<div class="dome-memory-head"><div><span class="dome-memory-kicker">Nur für Dome</span><h3>Einsatznotiz / Gedächtnisstütze</h3><p>Einsprechen, automatisch in Stichpunkte umwandeln und beim nächsten Kundenkontakt sofort wiederfinden.</p></div><span class="dome-memory-customer">'+esc(context.customer.name)+'</span></div><div class="dome-memory-compose"><button type="button" class="btn primary dome-memory-mic">🎙️ Reinsprechen</button><span class="dome-memory-status">Bereit</span><textarea class="dome-memory-input" placeholder="Zum Beispiel: Küche geprüft, Verstopfung im Fallrohr gelöst, Leitung gespült, Kamera bis Schacht gefahren …"></textarea><div class="dome-memory-preview"><span>Die gesprochenen Inhalte werden hier automatisch als Stichpunkte vorbereitet.</span></div><button type="button" class="btn green dome-memory-save">Notiz speichern</button></div><div class="dome-memory-history-title"><b>Frühere Notizen</b><span>für diesen Kunden</span></div><div class="dome-memory-history">'+noteHistory(context.customer)+'</div>';
    root.querySelector('.dome-memory-input').addEventListener('input',function(){updatePreview(root)});root.querySelector('.dome-memory-mic').addEventListener('click',function(){startSpeech(root)});root.querySelector('.dome-memory-save').addEventListener('click',function(){saveNote(root,context)});
    var anchor=context.main.querySelector('.crm-customer-id-v10')||context.main.querySelector('.steps')||context.main.querySelector('.grid.g3')||context.main.querySelector('.row.between');
    if(anchor)anchor.insertAdjacentElement('afterend',root);else context.main.insertBefore(root,context.main.firstChild);
    activeCustomerId=context.customer.id;
  }

  function enhance(){sharedDesktopNav();renderDomeDashboard();mountMemory();document.documentElement.dataset.shDomeMemoryBuild=BUILD}
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;enhance()})}
  new MutationObserver(schedule).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  window.SHP_DOME_MEMORY={build:BUILD,enhance:enhance,bullets:bullets};enhance();
})();
