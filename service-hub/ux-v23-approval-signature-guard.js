(function(){
  'use strict';

  var BUILD='20260909-v23-approval-signature-guard5';
  var wrapped={},pending=[],activeNotice=null,noticeTimer=null;

  function clone(v){try{return JSON.parse(JSON.stringify(v))}catch(e){return null}}
  function now(){return new Date().toLocaleString('de-DE')}
  function session(){try{return JSON.parse(sessionStorage.getItem('shp_session')||'null')}catch(e){return null}}
  function user(){var s=session();return s&&s.user?s.user:'System'}
  function reportBridge(){return window.SHP_REPORT_BRIDGE||null}
  function dataBridge(){return window.SHP_DATA_BRIDGE||null}
  function currentReport(){var b=reportBridge();if(!b||typeof b.read!=='function')return null;try{return b.read()}catch(e){return null}}
  function editableState(r){return{start:r.start||'',end:r.end||'',work:r.work||'',result:r.result||'',payment:r.payment||'',customerName:r.customerName||'',lines:clone(r.lines||[]),materials:clone(r.materials||[]),measurements:clone(r.measurements||[]),photos:clone(r.photos||[])}}
  function fingerprint(r){return JSON.stringify(editableState(r))}
  function approved(r){return !!(r&&(r.status==='Abgeschlossen'||r.sigC||r.sigT))}
  function capture(r,reason){
    if(!approved(r))return null;
    return{orderId:r.orderId,at:now(),by:user(),reason:reason,status:r.status||'',sigC:r.sigC||'',sigT:r.sigT||'',state:editableState(r),sentHistory:clone(r.sentHistory||[])};
  }
  function save(){var b=dataBridge();if(b&&typeof b.save==='function')try{return !!b.save()}catch(e){}return false}
  function invalidate(r,snapshot){
    if(!r||!snapshot||!approved(r))return false;
    if(!Array.isArray(r.revisions))r.revisions=[];
    r.revisions.push(snapshot);
    r.sigC='';r.sigT='';r.status='Entwurf';
    var d=dataBridge(),db=d&&typeof d.readDb==='function'?d.readDb():null,o=db&&(db.orders||[]).find(function(item){return item.id==r.orderId});if(o)o.status='In Bearbeitung';
    save();
    return true;
  }
  function finishAsyncMutation(before,snapshot){
    if(!snapshot)return;var d=dataBridge(),db=d&&typeof d.readDb==='function'?d.readDb():null,r=db&&(db.reports||[]).find(function(item){return item.orderId==snapshot.orderId});if(!r)return;
    if(fingerprint(r)===before)return;
    invalidate(r,snapshot);
  }
  function queueModal(before,snapshot){
    var modal=document.getElementById('shp-app-modal');if(!modal||!snapshot)return false;
    pending.push({before:before,snapshot:snapshot,modal:modal,created:Date.now()});
    if(pending.length>12)pending.splice(0,pending.length-12);
    return true;
  }
  function flushPending(committed){
    if(!pending.length)return;
    var keep=[];
    pending.forEach(function(item){
      if(!committed&&item.modal&&item.modal.isConnected&&Date.now()-item.created<30000){keep.push(item);return}
      finishAsyncMutation(item.before,item.snapshot);
    });
    pending=keep;
  }
  function wrapMutation(name){
    if(!window.SH||typeof window.SH[name]!=='function')return;
    var fn=window.SH[name];if(fn.__shpApprovalV23)return;
    var wrappedFn=function(){
      var r=currentReport(),snapshot=capture(r,'Änderung nach Abschluss: '+name),before=r?fingerprint(r):'';
      var result=fn.apply(this,arguments);
      if(!snapshot)return result;
      if(queueModal(before,snapshot))return result;
      var after=currentReport();
      if(after&&fingerprint(after)!==before&&approved(after))invalidate(after,snapshot);
      return result;
    };
    wrappedFn.__shpApprovalV23=true;wrappedFn.__shpApprovalOriginal=fn;window.SH[name]=wrappedFn;wrapped[name]=true;
  }

  function canvasHasInk(canvas){
    var guards=window.SHP_BUSINESS_GUARDS;
    if(guards&&typeof guards.canvasHasInk==='function')try{return !!guards.canvasHasInk(canvas)}catch(e){}
    if(!canvas||typeof canvas.getContext!=='function')return false;
    try{
      var data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,ink=0;
      for(var i=3;i<data.length;i+=4){if(data[i]>12){ink++;if(ink>8)return true}}
    }catch(e){return !!(canvas.dataset&&canvas.dataset.hasInk==='1')}
    return false;
  }
  function ensureNotice(){
    if(!activeNotice||Date.now()>=activeNotice.expires){
      activeNotice=null;
      var stale=document.querySelector&&document.querySelector('.shp-business-guard-notice-v23');
      if(stale&&stale.parentNode)stale.parentNode.removeChild(stale);
      return;
    }
    var n=document.querySelector&&document.querySelector('.shp-business-guard-notice-v23');
    if(!n){n=document.createElement('div');n.className='toast shp-business-guard-notice shp-business-guard-notice-v23';n.setAttribute('role','alert');n.setAttribute('aria-live','assertive');(document.body||document.documentElement).appendChild(n)}
    if(n.textContent!==activeNotice.message)n.textContent=activeNotice.message;
  }
  function showNotice(message){
    activeNotice={message:String(message||''),expires:Date.now()+4200};
    ensureNotice();
    if(noticeTimer)clearTimeout(noticeTimer);
    noticeTimer=setTimeout(function(){activeNotice=null;ensureNotice();noticeTimer=null},4250);
  }
  function wrapFinishReport(){
    if(!window.SH||typeof window.SH.finishReport!=='function')return;
    var fn=window.SH.finishReport;if(fn.__shpApprovalFinishV23)return;
    var wrappedFn=function(){
      var customer=document.getElementById&&document.getElementById('sigC');
      var technician=document.getElementById&&document.getElementById('sigT');
      if(!canvasHasInk(customer)||!canvasHasInk(technician)){
        showNotice('Rapport kann erst abgeschlossen werden, wenn Kunde und Techniker tatsächlich unterschrieben haben.');
        return false;
      }
      return fn.apply(this,arguments);
    };
    wrappedFn.__shpApprovalFinishV23=true;wrappedFn.__shpApprovalOriginal=fn;window.SH.finishReport=wrappedFn;
  }

  function wireSignatureCanvas(canvas){
    if(!canvas||canvas.__shpPointerSignatureV23)return;
    canvas.__shpPointerSignatureV23=true;
    canvas.style.touchAction='none';
    var drawing=false,last=null,moved=0,pointerId=null,lastPointerAt=0;
    function point(e){var rect=canvas.getBoundingClientRect();return[e.clientX-rect.left,e.clientY-rect.top]}
    function down(e){
      if(e.button!=null&&e.button!==0)return;
      drawing=true;last=point(e);moved=0;pointerId=e.pointerId;
      try{canvas.setPointerCapture&&pointerId!=null&&canvas.setPointerCapture(pointerId)}catch(ignore){}
      if(e.preventDefault)e.preventDefault();
    }
    function move(e){
      if(!drawing||!last)return;
      var p=point(e),dx=p[0]-last[0],dy=p[1]-last[1],ctx=canvas.getContext&&canvas.getContext('2d');
      moved+=Math.sqrt(dx*dx+dy*dy);
      if(ctx){ctx.beginPath();ctx.moveTo(last[0],last[1]);ctx.lineTo(p[0],p[1]);ctx.stroke()}
      last=p;if(moved>8)canvas.dataset.hasInk='1';
      if(e.preventDefault)e.preventDefault();
    }
    function up(e){
      if(!drawing)return;drawing=false;
      if(moved>8)canvas.dataset.hasInk='1';
      try{canvas.releasePointerCapture&&pointerId!=null&&canvas.releasePointerCapture(pointerId)}catch(ignore){}
      pointerId=null;last=null;if(e&&e.preventDefault)e.preventDefault();
    }
    canvas.addEventListener('pointerdown',function(e){lastPointerAt=Date.now();down(e)},{passive:false});
    canvas.addEventListener('pointermove',function(e){lastPointerAt=Date.now();move(e)},{passive:false});
    canvas.addEventListener('pointerup',function(e){lastPointerAt=Date.now();up(e)},{passive:false});
    canvas.addEventListener('pointercancel',up,{passive:false});
    canvas.addEventListener('pointerleave',function(e){if(drawing&&e.buttons===0)up(e)},{passive:false});
    canvas.addEventListener('mousedown',function(e){if(Date.now()-lastPointerAt>80)down(e)},{passive:false});
    canvas.addEventListener('mousemove',function(e){if(Date.now()-lastPointerAt>80)move(e)},{passive:false});
    canvas.addEventListener('mouseup',function(e){if(Date.now()-lastPointerAt>80)up(e)},{passive:false});
  }
  function wireSignatures(){wireSignatureCanvas(document.getElementById('sigC'));wireSignatureCanvas(document.getElementById('sigT'))}
  function enhance(){
    flushPending();ensureNotice();
    ['saveReportText','addReportLine','removeReportLine','addMaterial','removeMaterial','addMeasurement','removeMeasurement','endReport'].forEach(wrapMutation);
    wrapFinishReport();wireSignatures();
    document.documentElement.dataset.shApprovalSignatureGuard=BUILD;
  }

  enhance();
  setTimeout(wireSignatures,90);
  if(window.SHP_STABILITY)window.SHP_STABILITY.register('ux-v23-approval-signature-guard',enhance,{initial:false});
  window.SHP_APPROVAL_SIGNATURE_GUARD={build:BUILD,enhance:enhance,wireSignatures:wireSignatures,flushPending:flushPending,showNotice:showNotice};
})();
