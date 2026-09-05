(function(){
  'use strict';
  var BUILD='20260905-v10-report-time1';
  var STORE='shp_db';
  var scheduled=false;

  function readDb(){try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch(e){return null}}
  function writeDb(db){try{localStorage.setItem(STORE,JSON.stringify(db))}catch(e){}}
  function main(){return document.querySelector('main.shell')||document.querySelector('main')}
  function currentOrder(db){
    var root=main();
    if(!root||!db||!Array.isArray(db.orders))return null;
    var m=(root.textContent||'').match(/\bA-\d{4}-\d{3,}\b/);
    if(!m)return null;
    return db.orders.find(function(o){return String(o.no||'')===m[0]})||null;
  }
  function currentReport(db){
    var o=currentOrder(db);
    if(!o||!Array.isArray(db.reports))return null;
    return db.reports.find(function(r){return r.orderId==o.id})||null;
  }
  function timeOnly(value){
    var s=String(value||'').trim();
    if(!s)return '';
    var m=s.match(/(?:^|\D)(\d{1,2}):(\d{2})(?::\d{2})?/);
    if(!m)return s;
    return ('0'+m[1]).slice(-2)+':'+m[2];
  }
  function persistDraft(){
    var db=readDb(),r=currentReport(db);
    if(!db||!r)return false;
    var work=document.getElementById('rw');
    var result=document.getElementById('rr');
    var payment=document.getElementById('rpay');
    var customer=document.getElementById('rcname');
    var start=document.getElementById('uxReportStart');
    var end=document.getElementById('uxReportEnd');
    if(work)r.work=work.value;
    if(result)r.result=result.value;
    if(payment)r.payment=payment.value;
    if(customer)r.customerName=customer.value;
    if(start)r.start=start.value.trim();
    if(end)r.end=end.value.trim();
    writeDb(db);
    return true;
  }
  function bindAutosave(el){
    if(!el||el.dataset.reportAutosave==='1')return;
    el.dataset.reportAutosave='1';
    el.addEventListener('input',persistDraft);
    el.addEventListener('change',persistDraft);
    el.addEventListener('blur',persistDraft);
  }
  function wrapActions(){
    if(!window.SH)return;
    ['saveReportText','startReport','endReport','addReportLine','removeReportLine','addMaterial','removeMaterial','addMeasurement','removeMeasurement','finishReport','printReport','invoiceFromReport'].forEach(function(name){
      var fn=window.SH[name];
      if(typeof fn!=='function'||fn.__reportDraftSafe)return;
      var original=fn;
      var wrapped=function(){persistDraft();return original.apply(window.SH,arguments)};
      wrapped.__reportDraftSafe=true;
      window.SH[name]=wrapped;
    });
  }
  function isReportView(){
    var root=main();
    if(!root)return false;
    return !!(root.querySelector('#rw')&&root.querySelector('#rr'));
  }
  function buildTimeEditor(){
    if(!isReportView())return;
    var startBtn=document.querySelector('button[onclick*="startReport"]');
    var endBtn=document.querySelector('button[onclick*="endReport"]');
    if(!startBtn&&!endBtn)return;
    var existing=document.querySelector('.ux-report-time-editor');
    if(existing){
      if(startBtn)startBtn.style.display='none';
      if(endBtn)endBtn.style.display='none';
      return;
    }
    var db=readDb(),r=currentReport(db);
    if(!r)return;
    var anchor=(startBtn&&startBtn.closest('.row'))||(endBtn&&endBtn.closest('.row'))||(startBtn&&startBtn.parentElement)||(endBtn&&endBtn.parentElement);
    if(!anchor)return;
    if(startBtn)startBtn.style.display='none';
    if(endBtn)endBtn.style.display='none';
    var box=document.createElement('div');
    box.className='ux-report-time-editor';
    box.innerHTML='<div class="field"><label for="uxReportStart">Beginn</label><input id="uxReportStart" type="text" inputmode="text" autocomplete="off" placeholder="z. B. 08:15" value="'+escapeHtml(timeOnly(r.start))+'"></div><div class="field"><label for="uxReportEnd">Ende</label><input id="uxReportEnd" type="text" inputmode="text" autocomplete="off" placeholder="z. B. 10:30" value="'+escapeHtml(timeOnly(r.end))+'"></div><p class="ux-report-time-hint">Beginn und Ende kannst du direkt eintragen oder korrigieren. Eingaben im Rapport werden automatisch gespeichert.</p>';
    anchor.insertAdjacentElement('afterend',box);
    bindAutosave(document.getElementById('uxReportStart'));
    bindAutosave(document.getElementById('uxReportEnd'));
  }
  function escapeHtml(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
  function enhance(){
    wrapActions();
    if(!isReportView())return;
    ['rw','rr','rpay','rcname'].forEach(function(id){bindAutosave(document.getElementById(id))});
    buildTimeEditor();
    document.documentElement.setAttribute('data-sh-report-time',BUILD);
  }
  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(function(){scheduled=false;enhance()});
  }
  new MutationObserver(schedule).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  window.SHP_REPORT_TIME={build:BUILD,save:persistDraft,enhance:enhance};
  enhance();
})();
