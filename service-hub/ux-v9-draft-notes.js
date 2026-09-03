(function(){
  'use strict';
  if(!window.SH)return;

  var DB_STORE='shp_db';
  var NOTE_STORE='shp_tech_notes_v9_6';
  var SESSION='shp_session';
  var BUILD='20260903-v9-6';
  var REPORT_FIELDS={rw:true,rr:true,rpay:true,rcname:true};
  var draftTimer=null,noteTimer=null,wrapped=false,recognition=null;

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(ch){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}
  function readJson(key,fallback){try{var v=JSON.parse(localStorage.getItem(key)||'null');return v==null?fallback:v}catch(e){return fallback}}
  function writeJson(key,value){localStorage.setItem(key,JSON.stringify(value))}
  function readDb(){return readJson(DB_STORE,null)}
  function getSession(){try{return JSON.parse(sessionStorage.getItem(SESSION)||'null')}catch(e){return null}}
  function isDome(){var s=getSession();return !!(s&&String(s.user).toLowerCase()==='dome')}
  function reportTitle(){var h=document.querySelector('main h2'),t=(h&&h.textContent||'').trim();return t.indexOf('Rapport ')===0?t:''}
  function reportActive(){return !!reportTitle()}
  function currentOrder(){
    var title=reportTitle();if(!title)return null;
    var no=title.slice(8).trim(),db=readDb();
    return db&&(db.orders||[]).find(function(o){return String(o.no)===String(no)})||null;
  }
  function currentCustomer(order){var db=readDb();return order&&db&&(db.customers||[]).find(function(c){return String(c.id)===String(order.customerId)})||null}

  function stateEl(){return document.getElementById('shp-rapport-autosave')}
  function setState(kind,text){var el=stateEl();if(!el)return;el.className='shp-rapport-autosave '+kind;el.textContent=text}
  function removeLegacySaveToast(){
    [].slice.call(document.querySelectorAll('.toast')).forEach(function(el){if((el.textContent||'').indexOf('Rapport gespeichert')>=0)el.remove()});
  }
  function silentSave(){
    clearTimeout(draftTimer);draftTimer=null;
    if(!reportActive()||typeof window.SH.saveReportText!=='function')return false;
    try{
      window.SH.saveReportText(true);
      removeLegacySaveToast();
      setState('saved','Automatisch gespeichert');
      return true;
    }catch(err){console.error('[ServiceHub V9.6] Rapport-Autosave fehlgeschlagen',err);setState('error','Speichern fehlgeschlagen');return false}
  }
  function scheduleDraftSave(){
    if(!reportActive())return;
    setState('saving','Wird gespeichert …');
    clearTimeout(draftTimer);draftTimer=setTimeout(silentSave,320);
  }

  function noteData(){var d=readJson(NOTE_STORE,{version:1,entries:[]});if(!d||!Array.isArray(d.entries))d={version:1,entries:[]};return d}
  function currentEntry(order){return noteData().entries.find(function(x){return String(x.orderId)===String(order&&order.id)})||null}
  function noteStatus(text,kind){var el=document.getElementById('shp-tech-note-status');if(!el)return;el.className='shp-tech-note-status '+(kind||'');el.textContent=text||''}
  function saveTechNote(){
    clearTimeout(noteTimer);noteTimer=null;
    var area=document.getElementById('shp-tech-note'),order=currentOrder();if(!area||!order)return false;
    var text=area.value.trim(),customer=currentCustomer(order),d=noteData();
    d.entries=d.entries.filter(function(x){return String(x.orderId)!==String(order.id)});
    if(text)d.entries.push({customerId:order.customerId,orderId:order.id,orderNo:order.no,orderTitle:order.title||'',orderDate:order.date||'',text:text,updatedAt:new Date().toISOString()});
    writeJson(NOTE_STORE,d);noteStatus(text?'Interne Notiz gespeichert':'Interne Notiz gelöscht','saved');renderNoteHistory(order);return true;
  }
  function scheduleNoteSave(){noteStatus('Wird gespeichert …','saving');clearTimeout(noteTimer);noteTimer=setTimeout(saveTechNote,320)}
  function previousNotes(order){
    if(!order)return[];
    return noteData().entries.filter(function(x){return String(x.customerId)===String(order.customerId)&&String(x.orderId)!==String(order.id)&&String(x.text||'').trim()}).sort(function(a,b){return String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))}).slice(0,6);
  }
  function renderNoteHistory(order){
    var host=document.getElementById('shp-tech-note-history');if(!host||!order)return;
    var entries=previousNotes(order);
    if(!entries.length){host.innerHTML='<div class="shp-tech-note-empty">Noch keine früheren internen Dome-Notizen bei diesem Kunden.</div>';return}
    host.innerHTML='<div class="shp-tech-note-history-title">Frühere Besuche bei diesem Kunden</div>'+entries.map(function(x){
      var date=x.orderDate||'';
      return '<details><summary><b>'+esc(x.orderNo||'Auftrag')+'</b> · '+esc(x.orderTitle||'')+(date?' · '+esc(date):'')+'</summary><p>'+esc(x.text).replace(/\n/g,'<br>')+'</p></details>';
    }).join('');
  }

  function recognitionCtor(){return window.SpeechRecognition||window.webkitSpeechRecognition||null}
  function resetMic(){var b=document.getElementById('shp-tech-note-voice');if(b){b.classList.remove('listening');b.textContent='🎤 Reinsprechen';b.setAttribute('aria-pressed','false')}}
  function stopRecognition(){if(recognition){try{recognition.stop()}catch(e){}recognition=null}resetMic()}
  function startRecognition(){
    var area=document.getElementById('shp-tech-note'),button=document.getElementById('shp-tech-note-voice');if(!area||!button)return;
    if(recognition){stopRecognition();noteStatus('Aufnahme beendet – Notiz gespeichert','saved');saveTechNote();return}
    var Ctor=recognitionCtor();
    if(!Ctor){noteStatus('Browser-Spracheingabe nicht verfügbar – bitte das Mikrofon der Smartphone-Tastatur nutzen.','info');area.focus();return}
    var rec=new Ctor(),base=area.value.trim(),finalText='';recognition=rec;
    rec.lang='de-DE';rec.interimResults=true;rec.continuous=true;
    rec.onstart=function(){button.classList.add('listening');button.textContent='■ Aufnahme stoppen';button.setAttribute('aria-pressed','true');noteStatus('Ich höre zu …','listening')};
    rec.onresult=function(event){
      var interim='';
      for(var i=event.resultIndex||0;i<event.results.length;i++){
        var transcript=(event.results[i][0]&&event.results[i][0].transcript||'').trim();
        if(event.results[i].isFinal)finalText+=(finalText?' ':'')+transcript;else interim+=(interim?' ':'')+transcript;
      }
      area.value=[base,finalText,interim].filter(function(x){return String(x||'').trim()}).join(base?' ':'').trim();
      scheduleNoteSave();
    };
    rec.onerror=function(event){noteStatus('Spracheingabe: '+(event&&event.error?event.error:'Fehler')+'. Text bleibt erhalten.','error')};
    rec.onend=function(){recognition=null;resetMic();saveTechNote();if((document.getElementById('shp-tech-note')||{}).value)noteStatus('Spracheingabe übernommen und gespeichert','saved')};
    try{rec.start()}catch(err){recognition=null;resetMic();noteStatus('Spracheingabe konnte nicht gestartet werden.','error')}
  }

  function addAutosaveUi(){
    if(!reportActive())return;
    var rw=document.getElementById('rw');if(!rw)return;
    var card=rw.closest('.card');if(!card||document.getElementById('shp-rapport-autosave'))return;
    var saveButton=[].slice.call(card.querySelectorAll('button')).find(function(b){return (b.textContent||'').trim()==='Zwischenspeichern'});
    var state=document.createElement('div');state.id='shp-rapport-autosave';state.className='shp-rapport-autosave saved';state.textContent='Automatisch gespeichert';
    if(saveButton)saveButton.insertAdjacentElement('afterend',state);else card.appendChild(state);
  }
  function addTechNoteUi(){
    if(!isDome()||!reportActive()){var old=document.querySelector('.shp-tech-note-card');if(old)old.remove();return}
    if(document.querySelector('.shp-tech-note-card'))return;
    var order=currentOrder();if(!order)return;
    var signatureHeading=[].slice.call(document.querySelectorAll('.card h3')).find(function(h){return (h.textContent||'').trim()==='Unterschrift Kunde'});
    var anchor=signatureHeading&&signatureHeading.closest('.grid');if(!anchor)return;
    var entry=currentEntry(order),section=document.createElement('section');section.className='card shp-tech-note-card';
    section.innerHTML='<div class="shp-tech-note-head"><div><span class="shp-tech-note-kicker">Nur für Dome</span><h3>Interne Notiz für den nächsten Besuch</h3><p>Kurze Gedächtnisstütze zum Einsatz. Diese Notiz gehört nicht zum Kundenrapport.</p></div><span class="shp-tech-note-private">Nicht im PDF / Versand</span></div><div class="field"><label for="shp-tech-note">Persönliche Einsatznotiz</label><textarea id="shp-tech-note" placeholder="z. B. Ursache, Besonderheiten vor Ort, was beim nächsten Termin sofort beachtet werden soll">'+esc(entry&&entry.text||'')+'</textarea></div><div class="shp-tech-note-actions"><button type="button" class="btn primary" id="shp-tech-note-voice" aria-pressed="false">🎤 Reinsprechen</button><button type="button" class="btn" id="shp-tech-note-clear">Notiz löschen</button><span id="shp-tech-note-status" class="shp-tech-note-status saved">'+(entry&&entry.text?'Interne Notiz gespeichert':'Noch keine interne Notiz')+'</span></div><div id="shp-tech-note-history" class="shp-tech-note-history"></div>';
    anchor.insertAdjacentElement('beforebegin',section);renderNoteHistory(order);
    section.querySelector('#shp-tech-note-voice').onclick=startRecognition;
    section.querySelector('#shp-tech-note-clear').onclick=function(){var a=document.getElementById('shp-tech-note');if(a)a.value='';saveTechNote()};
  }

  function wrapAction(name){
    var original=window.SH[name];if(typeof original!=='function'||original.__shpDraftV96)return;
    var wrappedFn=function(){if(reportActive())silentSave();return original.apply(window.SH,arguments)};
    wrappedFn.__shpDraftV96=true;window.SH[name]=wrappedFn;
  }
  function wrapTransitions(){
    if(wrapped)return;wrapped=true;
    ['startReport','endReport','addReportLine','removeReportLine','addMaterial','removeMaterial','addMeasurement','removeMeasurement','printReport','sendReportPreferred','finishReport','invoiceFromReport'].forEach(wrapAction);
    ['go','openReport','logout'].forEach(wrapAction);
  }

  document.addEventListener('input',function(event){
    var id=event.target&&event.target.id;if(REPORT_FIELDS[id])scheduleDraftSave();
    if(id==='shp-tech-note')scheduleNoteSave();
  },true);
  document.addEventListener('change',function(event){var id=event.target&&event.target.id;if(REPORT_FIELDS[id])scheduleDraftSave()},true);
  document.addEventListener('click',function(event){var b=event.target&&event.target.closest&&event.target.closest('button');if(b&&(b.textContent||'').trim()==='Zwischenspeichern')setTimeout(function(){setState('saved','Gespeichert')},0)},true);
  window.addEventListener('beforeunload',function(){if(reportActive())silentSave();saveTechNote()});
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden'){if(reportActive())silentSave();saveTechNote()}});

  function enhance(){document.documentElement.dataset.shDraftBuild=BUILD;wrapTransitions();addAutosaveUi();addTechNoteUi()}
  var scheduled=false;function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;enhance()})}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  enhance();
  window.SHP_DRAFT_NOTES={build:BUILD,flush:silentSave,saveTechNote:saveTechNote,previousNotes:previousNotes,enhance:enhance,stopRecognition:stopRecognition};
})();
