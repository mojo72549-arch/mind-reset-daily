(function(){
  'use strict';

  var BUILD='20260909-v23-approval-signature-guard1';
  var wrapped={};

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
    return{at:now(),by:user(),reason:reason,status:r.status||'',sigC:r.sigC||'',sigT:r.sigT||'',state:editableState(r),sentHistory:clone(r.sentHistory||[])};
  }
  function save(){var b=dataBridge();if(b&&typeof b.save==='function')try{return !!b.save()}catch(e){}return false}
  function invalidate(r,snapshot){
    if(!r||!snapshot||!approved(r))return false;
    if(!Array.isArray(r.revisions))r.revisions=[];
    r.revisions.push(snapshot);if(r.revisions.length>20)r.revisions.splice(0,r.revisions.length-20);
    r.sigC='';r.sigT='';r.status='Entwurf';
    var d=dataBridge(),o=d&&typeof d.currentOrder==='function'?d.currentOrder():null;if(o)o.status='In Bearbeitung';
    var b=reportBridge();if(b&&typeof b.saveDraft==='function')try{b.saveDraft({sigC:'',sigT:''})}catch(e){}
    save();
    return true;
  }
  function finishAsyncMutation(before,snapshot){
    setTimeout(function(){
      var r=currentReport();if(!r||!snapshot)return;
      if(fingerprint(r)===before)return;
      invalidate(r,snapshot);
    },0);
  }
  function watchModal(before,snapshot){
    var modal=document.getElementById('shp-app-modal');if(!modal||!snapshot)return false;
    var form=modal.querySelector('form'),done=false;
    function finalize(){if(done)return;done=true;finishAsyncMutation(before,snapshot)}
    if(form)form.addEventListener('submit',finalize,{once:true});
    modal.querySelectorAll('.shp-modal-cancel,.shp-modal-close').forEach(function(btn){btn.addEventListener('click',finalize,{once:true})});
    return true;
  }
  function wrapMutation(name){
    if(!window.SH||typeof window.SH[name]!=='function')return;
    var fn=window.SH[name];if(fn.__shpApprovalV23)return;
    var wrappedFn=function(){
      var r=currentReport(),snapshot=capture(r,'Änderung nach Abschluss: '+name),before=r?fingerprint(r):'';
      var result=fn.apply(this,arguments);
      if(!snapshot)return result;
      if(watchModal(before,snapshot))return result;
      var after=currentReport();
      if(after&&fingerprint(after)!==before&&approved(after))invalidate(after,snapshot);
      return result;
    };
    wrappedFn.__shpApprovalV23=true;wrappedFn.__shpApprovalOriginal=fn;window.SH[name]=wrappedFn;wrapped[name]=true;
  }

  function wireSignatureCanvas(canvas){
    if(!canvas||canvas.__shpPointerSignatureV23)return;
    canvas.__shpPointerSignatureV23=true;
    var drawing=false,last=null,moved=0,pointerId=null;
    function point(e){var rect=canvas.getBoundingClientRect();return[e.clientX-rect.left,e.clientY-rect.top]}
    function down(e){
      if(e.button!=null&&e.button!==0)return;
      drawing=true;last=point(e);moved=0;pointerId=e.pointerId;
      try{canvas.setPointerCapture&&canvas.setPointerCapture(pointerId)}catch(ignore){}
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
    canvas.addEventListener('pointerdown',down,{passive:false});
    canvas.addEventListener('pointermove',move,{passive:false});
    canvas.addEventListener('pointerup',up,{passive:false});
    canvas.addEventListener('pointercancel',up,{passive:false});
    canvas.addEventListener('pointerleave',function(e){if(drawing&&e.buttons===0)up(e)},{passive:false});
  }
  function wireSignatures(){wireSignatureCanvas(document.getElementById('sigC'));wireSignatureCanvas(document.getElementById('sigT'))}
  function enhance(){
    ['saveReportText','addReportLine','removeReportLine','addMaterial','removeMaterial','addMeasurement','removeMeasurement','endReport'].forEach(wrapMutation);
    wireSignatures();
    document.documentElement.dataset.shApprovalSignatureGuard=BUILD;
  }

  enhance();
  setTimeout(wireSignatures,90);
  if(window.SHP_STABILITY)window.SHP_STABILITY.register('ux-v23-approval-signature-guard',enhance,{initial:false});
  window.SHP_APPROVAL_SIGNATURE_GUARD={build:BUILD,enhance:enhance,wireSignatures:wireSignatures};
})();
