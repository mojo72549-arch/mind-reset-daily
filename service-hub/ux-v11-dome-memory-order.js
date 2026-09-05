(function(){
  'use strict';
  var BUILD='20260905-v11-memory-order2';
  var STORE='shp_db',SESSION='shp_session';
  var scheduled=false,recognition=null;

  function readJson(storage,key,fallback){try{return JSON.parse(storage.getItem(key)||'null')||fallback}catch(e){return fallback}}
  function readDb(){return readJson(localStorage,STORE,{customers:[],orders:[],reports:[],invoices:[]})}
  function saveDb(db){localStorage.setItem(STORE,JSON.stringify(db))}
  function current(){return readJson(sessionStorage,SESSION,null)}
  function isDome(){var s=current();return !!(s&&(String(s.user||'').toLowerCase()==='dome'||String(s.role||'').toLowerCase()==='tech'))}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(ch){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}

  function bullets(text){
    var cleaned=String(text||'').replace(/\b(?:ähm?|also|halt|quasi|sozusagen)\b/gi,' ').replace(/\s+/g,' ').trim();
    if(!cleaned)return[];
    var parts=cleaned.split(/(?:[.!?;\n]+|\b(?:danach|anschließend|anschliessend|außerdem|ausserdem|zusätzlich|und dann)\b)/i).map(function(x){return x.replace(/^\s*[,\-–]+|[,\-–]+\s*$/g,'').trim()}).filter(Boolean);
    if(parts.length===1&&cleaned.length>90)parts=cleaned.split(/,|\bund\b/i).map(function(x){return x.trim()}).filter(function(x){return x.length>2});
    return parts.slice(0,10).map(function(x){x=x.replace(/[.,;:]+$/,'').trim();return x.charAt(0).toUpperCase()+x.slice(1)});
  }

  function allNotes(db,order){
    var list=(order.domeNotes||[]).slice();
    var customer=(db.customers||[]).find(function(c){return String(c.id)===String(order.customerId)});
    (customer&&customer.domeNotes||[]).forEach(function(n){
      if(String(n.orderId||'')===String(order.id)&&!list.some(function(x){return String(x.id)===String(n.id)}))list.push(n);
    });
    return list.sort(function(a,b){return Number(b.id||0)-Number(a.id||0)});
  }

  function latestHtml(db,order){
    var note=allNotes(db,order)[0];
    if(!note)return '<span>Noch keine Gedächtnisstütze für diesen Auftrag.</span>';
    var items=note.bullets&&note.bullets.length?note.bullets:bullets(note.transcript||'');
    return items.length?'<ul>'+items.map(function(x){return '<li>'+esc(x)+'</li>'}).join('')+'</ul>':'<span>Noch keine Stichpunkte hinterlegt.</span>';
  }

  function historyHtml(db,order){
    var notes=allNotes(db,order);
    if(!notes.length)return '<div class="dome-order-memory-empty">Noch keine Notiz für diesen Auftrag.</div>';
    return notes.map(function(n){
      var items=n.bullets&&n.bullets.length?n.bullets:bullets(n.transcript||'');
      return '<article class="dome-order-memory-entry"><div class="dome-order-memory-meta"><b>'+esc(n.date||'')+'</b></div><ul>'+items.map(function(x){return '<li>'+esc(x)+'</li>'}).join('')+'</ul>'+(n.transcript?'<details><summary>Gesprochenen Originaltext anzeigen</summary><p>'+esc(n.transcript)+'</p></details>':'')+'</article>';
    }).join('');
  }

  function updatePreview(root){
    var input=root.querySelector('.dome-order-memory-input'),preview=root.querySelector('.dome-order-memory-preview');
    if(!input||!preview)return;
    var items=bullets(input.value);
    preview.innerHTML=items.length?'<b>Stichpunkte</b><ul>'+items.map(function(x){return '<li>'+esc(x)+'</li>'}).join('')+'</ul>':'<span>Die gesprochenen Inhalte werden hier als kurze Stichpunkte vorbereitet.</span>';
  }

  function setRecording(root,on){
    var btn=root.querySelector('.dome-order-memory-mic'),status=root.querySelector('.dome-order-memory-status');
    if(btn){btn.classList.toggle('recording',on);btn.innerHTML=on?'■ Aufnahme stoppen':'🎙️ Reinsprechen'}
    if(status)status.textContent=on?'Ich höre zu …':'Bereit';
  }

  function startSpeech(root){
    var API=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!API){root.querySelector('.dome-order-memory-status').textContent='Spracheingabe wird in diesem Browser nicht unterstützt. Du kannst die Notiz eintippen.';root.querySelector('.dome-order-memory-input').focus();return}
    if(recognition){try{recognition.stop()}catch(e){}recognition=null;setRecording(root,false);return}
    recognition=new API();recognition.lang='de-DE';recognition.interimResults=true;recognition.continuous=false;
    var input=root.querySelector('.dome-order-memory-input'),base=input.value.trim();
    recognition.onstart=function(){setRecording(root,true)};
    recognition.onresult=function(event){
      var finalText='',interim='';
      for(var i=event.resultIndex;i<event.results.length;i++){var t=event.results[i][0].transcript;if(event.results[i].isFinal)finalText+=t+' ';else interim+=t}
      input.value=(base+(base?' ':'')+finalText+interim).trim();updatePreview(root);
    };
    recognition.onerror=function(event){root.querySelector('.dome-order-memory-status').textContent=event.error==='not-allowed'?'Mikrofonzugriff wurde nicht erlaubt.':'Spracheingabe konnte nicht abgeschlossen werden.'};
    recognition.onend=function(){recognition=null;setRecording(root,false);updatePreview(root)};
    try{recognition.start()}catch(e){recognition=null;setRecording(root,false)}
  }

  function saveNote(root,orderId){
    var input=root.querySelector('.dome-order-memory-input'),status=root.querySelector('.dome-order-memory-status');
    var text=(input&&input.value||'').trim(),items=bullets(text);
    if(!text||!items.length){if(status)status.textContent='Bitte zuerst etwas einsprechen oder eintippen.';return}
    var db=readDb(),order=(db.orders||[]).find(function(o){return String(o.id)===String(orderId)});if(!order)return;
    order.domeNotes=order.domeNotes||[];
    order.domeNotes.push({id:Date.now(),date:new Date().toLocaleString('de-DE'),author:'dome',orderId:order.id,orderNo:order.no||'',transcript:text,bullets:items});
    saveDb(db);
    input.value='';updatePreview(root);if(status)status.textContent='Gedächtnisstütze im Auftrag gespeichert.';
    var latest=root.querySelector('.dome-order-memory-latest'),history=root.querySelector('.dome-order-memory-history');
    if(latest)latest.innerHTML=latestHtml(db,order);if(history)history.innerHTML=historyHtml(db,order);
  }

  function isOrdersPage(main){
    var h=(main.querySelector('h1')||main.querySelector('h2'));
    return !!(h&&/^Aufträge$/i.test((h.textContent||'').trim()));
  }

  function mountOrderMemories(){
    var main=document.querySelector('main.shell');if(!main)return;
    main.querySelectorAll('.dome-memory-v11:not(.dome-order-memory-v12)').forEach(function(el){el.remove()});
    if(!isDome()||!isOrdersPage(main))return;
    var db=readDb();
    (db.orders||[]).forEach(function(order){
      var card=[].slice.call(main.querySelectorAll('.card')).find(function(el){return (el.textContent||'').indexOf(order.no||'__none__')>=0});
      if(!card||card.querySelector('.dome-order-memory-v12[data-order-id="'+String(order.id)+'"]'))return;
      var customer=(db.customers||[]).find(function(c){return String(c.id)===String(order.customerId)})||{};
      var root=document.createElement('section');
      root.className='dome-memory-v11 dome-order-memory-v12';root.dataset.orderId=order.id;
      root.innerHTML='<div class="dome-memory-head"><div><span class="dome-memory-kicker">Nur für Dome · im Auftrag</span><h4>Gedächtnisstütze</h4><p>'+esc(customer.name||'Kunde')+'</p></div><span class="dome-order-memory-order-no">'+esc(order.no||'Auftrag')+'</span></div><div class="dome-order-memory-latest">'+latestHtml(db,order)+'</div><details class="dome-order-memory-details"><summary>Notiz einsprechen / bearbeiten</summary><div class="dome-order-memory-compose"><button type="button" class="btn primary dome-order-memory-mic">🎙️ Reinsprechen</button><span class="dome-order-memory-status">Bereit</span><textarea class="dome-order-memory-input" placeholder="Zum Beispiel: Küche geprüft, Verstopfung im Fallrohr gelöst, Leitung gespült, Kamera bis Schacht gefahren …"></textarea><div class="dome-order-memory-preview"><span>Die gesprochenen Inhalte werden hier als kurze Stichpunkte vorbereitet.</span></div><button type="button" class="btn green dome-order-memory-save">Notiz im Auftrag speichern</button></div><div class="dome-order-memory-history-title"><b>Frühere Notizen</b><span>'+esc(order.no||'')+'</span></div><div class="dome-order-memory-history">'+historyHtml(db,order)+'</div></details>';
      root.querySelector('.dome-order-memory-input').addEventListener('input',function(){updatePreview(root)});
      root.querySelector('.dome-order-memory-mic').addEventListener('click',function(){startSpeech(root)});
      root.querySelector('.dome-order-memory-save').addEventListener('click',function(){saveNote(root,order.id)});
      card.appendChild(root);
    });
    document.documentElement.dataset.shDomeOrderMemoryBuild=BUILD;
  }

  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;mountOrderMemories()})}
  new MutationObserver(schedule).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  window.SHP_DOME_ORDER_MEMORY={build:BUILD,mount:mountOrderMemories,bullets:bullets};
  mountOrderMemories();
})();
