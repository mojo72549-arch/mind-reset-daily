(function(){
  'use strict';
  var BUILD='20260907-v14-report-persistence2';
  var STORE='shp_db',UI_DRAFT='shp_report_ui_draft';
  var scheduled=false,autosaveTimer=null;

  function readDb(){try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch(e){return null}}
  function writeDb(db){try{localStorage.setItem(STORE,JSON.stringify(db))}catch(e){}}
  function main(){return document.querySelector('main.shell')||document.querySelector('main')}
  function bridge(){return window.SHP_REPORT_BRIDGE||null}
  function currentOrder(db){
    var root=main();
    if(!root||!db||!Array.isArray(db.orders))return null;
    var m=(root.textContent||'').match(/\bA-\d{4}-\d{3,}\b/);
    if(!m)return null;
    return db.orders.find(function(o){return String(o.no||'')===m[0]})||null;
  }
  function currentReportFallback(db){
    var o=currentOrder(db);
    if(!o||!Array.isArray(db.reports))return null;
    return db.reports.find(function(r){return r.orderId==o.id})||null;
  }
  function currentReport(){
    var b=bridge();
    if(b&&typeof b.read==='function'){
      try{return b.read()}catch(e){}
    }
    return currentReportFallback(readDb());
  }
  function timeOnly(value){
    var s=String(value||'').trim();
    if(!s)return '';
    var m=s.match(/(?:^|\D)(\d{1,2}):(\d{2})(?::\d{2})?/);
    if(!m)return s;
    return ('0'+m[1]).slice(-2)+':'+m[2];
  }
  function canvasDraft(id){
    var c=document.getElementById(id);
    if(!c||c.dataset.signatureDirty!=='1')return undefined;
    try{return c.toDataURL()}catch(e){return undefined}
  }
  function values(){
    var work=document.getElementById('rw');
    var result=document.getElementById('rr');
    var payment=document.getElementById('rpay');
    var customer=document.getElementById('rcname');
    var start=document.getElementById('uxReportStart');
    var end=document.getElementById('uxReportEnd');
    var out={};
    if(work)out.work=work.value;
    if(result)out.result=result.value;
    if(payment)out.payment=payment.value;
    if(customer)out.customerName=customer.value;
    if(start)out.start=start.value.trim();
    if(end)out.end=end.value.trim();
    var sigC=canvasDraft('sigC'),sigT=canvasDraft('sigT');
    if(sigC!==undefined)out.sigC=sigC;
    if(sigT!==undefined)out.sigT=sigT;
    return out;
  }
  function readUiDrafts(){var all={};try{all=JSON.parse(sessionStorage.getItem(UI_DRAFT)||'{}')||{}}catch(e){}return all}
  function writeUiDrafts(all){try{sessionStorage.setItem(UI_DRAFT,JSON.stringify(all||{}))}catch(e){}}
  function saveUiDraft(){
    var r=currentReport(),svc=document.getElementById('rsvc'),qty=document.getElementById('rqty');
    if(!r||(!svc&&!qty))return;
    var all=readUiDrafts();
    all[String(r.orderId)]={svc:svc?svc.value:'',qty:qty?qty.value:''};
    writeUiDrafts(all);
  }
  function clearUiDraft(orderId){
    var key=String(orderId==null?(currentReport()||{}).orderId:orderId||'');if(!key)return;
    var all=readUiDrafts();delete all[key];writeUiDrafts(all);
  }
  function restoreUiDraft(){
    var r=currentReport();if(!r)return;
    var all=readUiDrafts(),d=all[String(r.orderId)];if(!d)return;
    var svc=document.getElementById('rsvc'),qty=document.getElementById('rqty');
    if(svc&&svc.dataset.reportUiDraftRestored!==BUILD){
      svc.dataset.reportUiDraftRestored=BUILD;
      if(d.svc&&[].slice.call(svc.options).some(function(o){return o.value===d.svc}))svc.value=d.svc;
    }
    if(qty&&qty.dataset.reportUiDraftRestored!==BUILD){
      qty.dataset.reportUiDraftRestored=BUILD;
      if(d.qty!=='')qty.value=d.qty;
    }
  }
  function persistDraft(){
    if(!isReportView())return false;
    if(autosaveTimer){clearTimeout(autosaveTimer);autosaveTimer=null}
    var data=values(),b=bridge();
    if(b&&typeof b.saveDraft==='function'){
      try{b.saveDraft(data);return true}catch(e){console.error(e)}
    }
    var db=readDb(),r=currentReportFallback(db);
    if(!db||!r)return false;
    Object.keys(data).forEach(function(k){r[k]=data[k]});
    writeDb(db);return true;
  }
  function queuePersist(){
    if(autosaveTimer)clearTimeout(autosaveTimer);
    autosaveTimer=setTimeout(function(){autosaveTimer=null;persistDraft()},120);
  }
  function bindAutosave(el){
    if(!el||el.dataset.reportAutosave==='1')return;
    el.dataset.reportAutosave='1';
    el.addEventListener('input',queuePersist);
    el.addEventListener('change',persistDraft);
    el.addEventListener('blur',persistDraft);
  }
  function bindUiDraft(el){
    if(!el||el.dataset.reportUiDraft==='1')return;
    el.dataset.reportUiDraft='1';
    el.addEventListener('input',saveUiDraft);
    el.addEventListener('change',saveUiDraft);
    el.addEventListener('blur',saveUiDraft);
  }
  function bindSignature(canvas){
    if(!canvas||canvas.dataset.reportSignatureSafe==='1')return;
    canvas.dataset.reportSignatureSafe='1';
    function dirty(){canvas.dataset.signatureDirty='1'}
    function saved(){if(canvas.dataset.signatureDirty==='1')setTimeout(persistDraft,0)}
    canvas.addEventListener('mousedown',dirty);canvas.addEventListener('touchstart',dirty,{passive:true});canvas.addEventListener('pointerdown',dirty);
    canvas.addEventListener('mouseup',saved);canvas.addEventListener('touchend',saved);canvas.addEventListener('pointerup',saved);canvas.addEventListener('pointercancel',saved);
  }
  function wrapAction(name){
    var fn=window.SH&&window.SH[name];
    if(typeof fn!=='function'||fn.__reportDraftSafe)return;
    var wrapped=function(){
      var report=isReportView(),r=report?currentReport():null,svcValue=null,qtyValue=null;
      if(report&&name==='addReportLine'){
        var svc=document.getElementById('rsvc'),qty=document.getElementById('rqty');
        svcValue=svc?svc.value:null;qtyValue=qty?qty.value:null;
        saveUiDraft();persistDraft();
        svc=document.getElementById('rsvc');qty=document.getElementById('rqty');
        if(svc&&svcValue!=null)svc.value=svcValue;
        if(qty&&qtyValue!=null)qty.value=qtyValue;
      }else if(report){persistDraft()}
      var out=fn.apply(window.SH,arguments);
      if(report&&name==='addReportLine'&&r)clearUiDraft(r.orderId);
      return out;
    };
    wrapped.__reportDraftSafe=true;window.SH[name]=wrapped;
  }
  function wrapActions(){
    if(!window.SH)return;
    ['saveReportText','startReport','endReport','addReportLine','removeReportLine','addMaterial','removeMaterial','addMeasurement','removeMeasurement','finishReport','printReport','invoiceFromReport','sendReportPreferred'].forEach(wrapAction);
    if(typeof window.SH.go==='function'&&!window.SH.go.__reportDraftSafe){
      var go=window.SH.go;var goWrapped=function(){if(isReportView()){saveUiDraft();persistDraft()}return go.apply(window.SH,arguments)};goWrapped.__reportDraftSafe=true;window.SH.go=goWrapped;
    }
    if(typeof window.SH.logout==='function'&&!window.SH.logout.__reportDraftSafe){
      var logout=window.SH.logout;var logoutWrapped=function(){if(isReportView()){saveUiDraft();persistDraft()}return logout.apply(window.SH,arguments)};logoutWrapped.__reportDraftSafe=true;window.SH.logout=logoutWrapped;
    }
    if(typeof window.SH.clearSig==='function'&&!window.SH.clearSig.__reportDraftSafe){
      var clear=window.SH.clearSig;
      var clearWrapped=function(id){var out=clear.apply(window.SH,arguments),b=bridge(),patch={};if(id==='sigC')patch.sigC='';if(id==='sigT')patch.sigT='';var c=document.getElementById(id);if(c)c.dataset.signatureDirty='0';if(b&&typeof b.saveDraft==='function'&&Object.keys(patch).length)b.saveDraft(patch);return out};
      clearWrapped.__reportDraftSafe=true;window.SH.clearSig=clearWrapped;
    }
  }
  function isReportView(){
    var root=main();
    return !!(root&&root.querySelector('#rw')&&root.querySelector('#rr'));
  }
  function buildTimeEditor(){
    if(!isReportView())return;
    var startBtn=document.querySelector('button[onclick*="startReport"]');
    var endBtn=document.querySelector('button[onclick*="endReport"]');
    if(!startBtn&&!endBtn)return;
    var existing=document.querySelector('.ux-report-time-editor');
    if(existing){if(startBtn)startBtn.style.display='none';if(endBtn)endBtn.style.display='none';return}
    var r=currentReport();if(!r)return;
    var anchor=(startBtn&&startBtn.closest('.row'))||(endBtn&&endBtn.closest('.row'))||(startBtn&&startBtn.parentElement)||(endBtn&&endBtn.parentElement);
    if(!anchor)return;
    if(startBtn)startBtn.style.display='none';if(endBtn)endBtn.style.display='none';
    var box=document.createElement('div');box.className='ux-report-time-editor';
    box.innerHTML='<div class="field"><label for="uxReportStart">Beginn</label><input id="uxReportStart" type="text" inputmode="numeric" autocomplete="off" placeholder="z. B. 08:15" value="'+escapeHtml(timeOnly(r.start))+'"></div><div class="field"><label for="uxReportEnd">Ende</label><input id="uxReportEnd" type="text" inputmode="numeric" autocomplete="off" placeholder="z. B. 10:30" value="'+escapeHtml(timeOnly(r.end))+'"></div><p class="ux-report-time-hint">Beginn und Ende kannst du direkt eintragen oder korrigieren. Alle Rapportfelder werden vor jeder Aktion gesichert.</p>';
    anchor.insertAdjacentElement('afterend',box);
    bindAutosave(document.getElementById('uxReportStart'));bindAutosave(document.getElementById('uxReportEnd'));
  }
  function escapeHtml(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
  function enhance(){
    wrapActions();if(!isReportView())return;
    ['rw','rr','rpay','rcname'].forEach(function(id){bindAutosave(document.getElementById(id))});
    ['rsvc','rqty'].forEach(function(id){bindUiDraft(document.getElementById(id))});
    bindSignature(document.getElementById('sigC'));bindSignature(document.getElementById('sigT'));
    buildTimeEditor();restoreUiDraft();document.documentElement.setAttribute('data-sh-report-time',BUILD);
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;enhance()})}
  new MutationObserver(schedule).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  window.SHP_REPORT_TIME={build:BUILD,save:persistDraft,enhance:enhance};enhance();
})();
