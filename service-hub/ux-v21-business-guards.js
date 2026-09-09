(function(){
  'use strict';

  var BUILD='20260909-v21-business-guards1';
  var DB_STORE='shp_db',META_STORE='shp_invoice_payment_meta',SESSION='shp_session';
  var STAGES=['Keine','Zahlungserinnerung','1. Mahnung','2. Mahnung','Letzte Mahnung / Klärung'];
  var originals={};

  function read(storage,key,fallback){try{var v=JSON.parse(storage.getItem(key)||'null');return v==null?fallback:v}catch(e){return fallback}}
  function write(storage,key,value){try{storage.setItem(key,JSON.stringify(value));return true}catch(e){return false}}
  function clone(v){try{return JSON.parse(JSON.stringify(v))}catch(e){return null}}
  function now(){return new Date().toLocaleString('de-DE')}
  function session(){return read(sessionStorage,SESSION,null)}
  function user(){var s=session();return s&&s.user?s.user:'System'}
  function dataBridge(){return window.SHP_DATA_BRIDGE||null}
  function reportBridge(){return window.SHP_REPORT_BRIDGE||null}
  function readDb(){var b=dataBridge();if(b&&typeof b.readDb==='function'){try{return b.readDb()}catch(e){}}return read(localStorage,DB_STORE,{customers:[],orders:[],reports:[],invoices:[]})}
  function saveDb(){var b=dataBridge();if(b&&typeof b.save==='function'){try{return !!b.save()}catch(e){}}var d=readDb();return write(localStorage,DB_STORE,d)}
  function notice(message){
    var old=document.querySelector&&document.querySelector('.shp-business-guard-notice');
    if(old&&old.parentNode)old.parentNode.removeChild(old);
    var n=document.createElement('div');n.className='toast shp-business-guard-notice';n.textContent=message;
    (document.body||document.documentElement).appendChild(n);
    setTimeout(function(){if(n&&n.parentNode)n.parentNode.removeChild(n)},2800);
  }
  function validEmail(value){var s=String(value||'').trim();return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)}
  function normalizeChannel(value){var s=String(value||'').trim().toLowerCase();if(/whats/.test(s))return'WhatsApp';if(/mail/.test(s))return'E-Mail';if(/post|druck/.test(s))return'Post';return value||'E-Mail'}
  function normalizePhone(value){
    var raw=String(value||'').trim();if(!raw)return'';
    var plus=/^\s*\+/.test(raw),digits=raw.replace(/\D/g,'');
    if(!digits)return'';
    if(/^00/.test(digits))digits=digits.slice(2);
    else if(plus){}else if(/^0/.test(digits))digits='49'+digits.replace(/^0+/,'');
    if(!/^\d{8,15}$/.test(digits))return'';
    return digits;
  }
  function money(v){return(+v||0).toFixed(2).replace('.',',')+' €'}

  function currentReport(){var b=reportBridge();if(!b||typeof b.read!=='function')return null;try{return b.read()}catch(e){return null}}
  function currentReportContext(){
    var r=currentReport(),db=readDb();if(!r||!db)return null;
    var o=(db.orders||[]).find(function(x){return x.id==r.orderId});if(!o)return null;
    var c=(db.customers||[]).find(function(x){return x.id==o.customerId});if(!c)return null;
    return{db:db,r:r,o:o,c:c};
  }
  function currentInvoice(){
    var b=dataBridge();if(b&&typeof b.currentInvoice==='function'){try{var iv=b.currentInvoice();if(iv)return iv}catch(e){}}
    var db=readDb(),main=document.querySelector&&document.querySelector('main.shell'),h=main&&main.querySelector('h2'),m=h&&String(h.textContent||'').match(/Rechnung\s+(\d+)/i);
    return m?(db.invoices||[]).find(function(iv){return String(iv.no||'')===m[1]})||null:null;
  }
  function invoiceContext(){var iv=currentInvoice(),db=readDb();if(!iv)return null;var c=(db.customers||[]).find(function(x){return x.id==iv.customerId}),o=(db.orders||[]).find(function(x){return x.id==iv.orderId});return{db:db,iv:iv,c:c||{},o:o||null}}

  function editableState(r){return{start:r.start||'',end:r.end||'',work:r.work||'',result:r.result||'',payment:r.payment||'',customerName:r.customerName||'',lines:clone(r.lines||[]),materials:clone(r.materials||[]),measurements:clone(r.measurements||[]),photos:clone(r.photos||[])}}
  function fingerprint(r){return JSON.stringify(editableState(r))}
  function approvalCapture(r,reason){
    if(!r||!(r.status==='Abgeschlossen'||r.sigC||r.sigT))return null;
    return{at:now(),by:user(),reason:reason,status:r.status||'',sigC:r.sigC||'',sigT:r.sigT||'',state:editableState(r),sentHistory:clone(r.sentHistory||[])};
  }
  function invalidateApproval(r,capture){
    if(!r||!capture)return false;
    if(!Array.isArray(r.revisions))r.revisions=[];
    r.revisions.push(capture);if(r.revisions.length>20)r.revisions.splice(0,r.revisions.length-20);
    r.sigC='';r.sigT='';r.status='Entwurf';
    var b=reportBridge();if(b&&typeof b.saveDraft==='function')try{b.saveDraft({sigC:'',sigT:''})}catch(e){}
    saveDb();return true;
  }
  function syncOrderInProgress(){if(typeof originals.startReport==='function')try{originals.startReport()}catch(e){}}
  function clearCanvas(id){var c=document.getElementById&&document.getElementById(id);if(c&&c.getContext){try{c.getContext('2d').clearRect(0,0,c.width,c.height)}catch(e){}}}
  function canvasHasInk(canvas){
    if(!canvas||typeof canvas.getContext!=='function')return false;
    try{
      var ctx=canvas.getContext('2d'),img=ctx.getImageData(0,0,canvas.width,canvas.height).data,ink=0;
      for(var i=3;i<img.length;i+=4){if(img[i]>12&&!(img[i-3]>245&&img[i-2]>245&&img[i-1]>245)){ink++;if(ink>8)return true}}
      return false;
    }catch(e){return !!(canvas.dataset&&canvas.dataset.hasInk==='1')}
  }
  function domReportState(r){
    var x=editableState(r),el;
    el=document.getElementById&&document.getElementById('rw');if(el)x.work=el.value;
    el=document.getElementById&&document.getElementById('rr');if(el)x.result=el.value;
    el=document.getElementById&&document.getElementById('rpay');if(el)x.payment=el.value;
    el=document.getElementById&&document.getElementById('rcname');if(el)x.customerName=el.value;
    return x;
  }
  function wrapReportMutation(name,reason){
    var orig=window.SH&&window.SH[name];if(typeof orig!=='function')return;originals[name]=orig;
    window.SH[name]=function(){
      var r=currentReport(),cap=approvalCapture(r,reason),before=r?fingerprint(r):'';
      var result=orig.apply(this,arguments),afterReport=currentReport(),after=afterReport?fingerprint(afterReport):'';
      if(cap&&before!==after){invalidateApproval(afterReport,cap);syncOrderInProgress()}
      return result;
    };
  }
  function installReportGuards(){
    if(!window.SH)return;
    originals.startReport=window.SH.startReport;
    ['saveReportText','addReportLine','removeReportLine','addMaterial','removeMaterial','addMeasurement','removeMeasurement','endReport'].forEach(function(name){wrapReportMutation(name,'Änderung nach Abschluss: '+name)});
    if(typeof window.SH.clearSig==='function'){
      originals.clearSig=window.SH.clearSig;
      window.SH.clearSig=function(id){var r=currentReport(),cap=approvalCapture(r,'Unterschrift nach Abschluss gelöscht'),result=originals.clearSig.apply(this,arguments);if(cap){invalidateApproval(r,cap);syncOrderInProgress()}return result};
    }
    if(typeof window.SH.finishReport==='function'){
      originals.finishReport=window.SH.finishReport;
      window.SH.finishReport=function(){
        var r=currentReport(),cap=approvalCapture(r,'Textänderung beim erneuten Abschluss');
        if(r&&cap&&JSON.stringify(domReportState(r))!==JSON.stringify(editableState(r))){
          if(typeof originals.saveReportText==='function')originals.saveReportText();
          r=currentReport();invalidateApproval(r,cap);clearCanvas('sigC');clearCanvas('sigT');syncOrderInProgress();notice('Änderungen gespeichert. Kunde und Techniker müssen erneut unterschreiben.');return false;
        }
        var c1=document.getElementById&&document.getElementById('sigC'),c2=document.getElementById&&document.getElementById('sigT');
        if(!canvasHasInk(c1)||!canvasHasInk(c2)){notice('Rapport kann erst abgeschlossen werden, wenn Kunde und Techniker tatsächlich unterschrieben haben.');return false}
        return originals.finishReport.apply(this,arguments);
      };
    }
  }

  function meta(){return read(localStorage,META_STORE,{})}
  function invoiceMeta(id){var all=meta(),m=all[String(id)]||{stage:'Keine',history:[]};if(!Array.isArray(m.history))m.history=[];return m}
  function paidAmount(iv){var gross=Math.max(0,+iv.gross||0),m=invoiceMeta(iv.id),n=Number(m.paidAmount);if(/bezahlt/i.test(String(iv.status||''))&&!/teilbezahlt/i.test(String(iv.status||'')))return gross;if(Number.isFinite(n))return Math.min(gross,Math.max(0,n));return 0}
  function outstandingAmount(iv){return Math.max(0,(+iv.gross||0)-paidAmount(iv))}
  function parseDate(v){var s=String(v||'').trim(),m,d;m=s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);if(m){d=new Date(+m[3],+m[2]-1,+m[1]);return isNaN(d.getTime())?null:d}m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(m){d=new Date(+m[1],+m[2]-1,+m[3]);return isNaN(d.getTime())?null:d}d=new Date(s);return isNaN(d.getTime())?null:d}
  function startOfDay(d){var x=new Date(d);x.setHours(0,0,0,0);return x}
  function paymentState(iv){
    var s=String(iv&&iv.status||''),open=outstandingAmount(iv),due=parseDate(iv&&iv.due),late=due&&startOfDay(due)<startOfDay(new Date());
    if(/storniert/i.test(s))return{key:'cancelled',label:'Storniert',className:'is-muted',openAmount:0};
    if(open<=0||(/bezahlt/i.test(s)&&!/teilbezahlt/i.test(s)))return{key:'paid',label:'Bezahlt',className:'is-paid',openAmount:0};
    if(/überfällig/i.test(s)||late)return{key:'overdue',label:/teilbezahlt/i.test(s)?'Teilbezahlt / überfällig':'Überfällig',className:'is-overdue',openAmount:open};
    if(/teilbezahlt/i.test(s)||paidAmount(iv)>0)return{key:'partial',label:'Teilbezahlt',className:'is-partial',openAmount:open};
    if(/versendet/i.test(s))return{key:'sent',label:'Versendet / offen',className:'is-open',openAmount:open};
    return{key:'open',label:'Offen',className:'is-open',openAmount:open};
  }
  function stage(iv){var s=invoiceMeta(iv.id).stage;return STAGES.indexOf(s)>=0?s:'Keine'}
  function stats(data){var out={paid:0,open:0,overdue:0,reminders:0,openAmount:0,overdueAmount:0};(data.invoices||[]).forEach(function(iv){var p=paymentState(iv),st=stage(iv);if(p.key==='paid')out.paid++;else if(p.key!=='cancelled'){out.open++;out.openAmount+=p.openAmount}if(p.key==='overdue'){out.overdue++;out.overdueAmount+=p.openAmount}if(st!=='Keine'&&p.key!=='paid'&&p.key!=='cancelled')out.reminders++});return out}
  function saveStage(id){
    var db=readDb(),iv=(db.invoices||[]).find(function(x){return x.id==id});if(!iv)return false;
    var state=paymentState(iv);if(state.key==='paid'||state.key==='cancelled'){notice('Für bezahlte oder stornierte Rechnungen kann keine neue Mahnstufe gesetzt werden.');patchPayments();return false}
    var select=document.getElementById&&document.getElementById('crm-payment-stage-'+id);if(!select)return false;
    var value=select.value;if(STAGES.indexOf(value)<0)value='Keine';
    var all=meta(),key=String(id),old=all[key]||{stage:'Keine',history:[]};if(!Array.isArray(old.history))old.history=[];
    if(old.stage!==value)old.history.push({at:now(),by:user(),text:'Eskalation '+(old.stage||'Keine')+' → '+value});
    old.stage=value;old.updatedAt=now();old.updatedBy=user();all[key]=old;write(localStorage,META_STORE,all);patchPayments();return true;
  }
  function savePaidAmount(id){
    var db=readDb(),iv=(db.invoices||[]).find(function(x){return x.id==id});if(!iv)return false;
    var input=document.getElementById&&document.getElementById('crm-paid-amount-'+id);if(!input)return false;
    var value=Number(String(input.value||'').replace(',','.')),gross=Math.max(0,+iv.gross||0);if(!Number.isFinite(value)||value<0||value>gross){notice('Bitte einen bereits erhaltenen Betrag zwischen 0 und '+money(gross)+' eingeben.');return false}
    var all=meta(),key=String(id),m=all[key]||{stage:'Keine',history:[]};if(!Array.isArray(m.history))m.history=[];
    var old=Number(m.paidAmount)||0;m.paidAmount=Math.round(value*100)/100;m.history.push({at:now(),by:user(),text:'Zahlungseingang '+money(old)+' → '+money(m.paidAmount)});all[key]=m;write(localStorage,META_STORE,all);
    var bridge=dataBridge(),live=bridge&&typeof bridge.readDb==='function'?bridge.readDb():null,liveIv=live&&(live.invoices||[]).find(function(x){return x.id==id});
    if(liveIv&&!/storniert/i.test(String(liveIv.status||''))){var target=value>=gross&&gross>0?'Bezahlt':value>0?'Teilbezahlt':liveIv.status;if(target!==liveIv.status){liveIv.history=liveIv.history||[];liveIv.history.push({at:now(),by:user(),text:'Status '+liveIv.status+' → '+target+' (Zahlungseingang)'});liveIv.status=target}if(bridge&&typeof bridge.save==='function')bridge.save()}
    patchPayments();notice('Zahlungseingang gespeichert. Offener Betrag: '+money(Math.max(0,gross-value)));return true;
  }
  function setText(node,value){if(node&&String(node.textContent)!==String(value))node.textContent=value}
  function patchPayments(){
    if(!document.querySelector)return;
    var db=readDb(),s=stats(db),monitor=document.querySelector('.crm-payment-monitor-v15');
    if(monitor){var ms=monitor.querySelectorAll('.crm-payment-metric');if(ms&&ms.length>=4){setText(ms[0].querySelector('b'),s.paid);setText(ms[1].querySelector('b'),s.open);setText(ms[1].querySelector('small'),money(s.openAmount));setText(ms[2].querySelector('b'),s.overdue);setText(ms[2].querySelector('small'),money(s.overdueAmount));setText(ms[3].querySelector('b'),s.reminders)}}
    var iv=currentInvoice(),box=document.querySelector('.crm-payment-escalation-v15');if(!iv||!box)return;
    var st=paymentState(iv),state=box.querySelector('.crm-payment-state');if(state){setText(state,st.label);state.className='crm-payment-state '+st.className}
    var select=document.getElementById('crm-payment-stage-'+iv.id),button=select&&select.parentNode?select.parentNode.querySelector('button'):null,blocked=st.key==='paid'||st.key==='cancelled';if(select)select.disabled=blocked;if(button)button.disabled=blocked;
    var payment=box.querySelector('.crm-payment-received-v21');if(!payment){payment=document.createElement('div');payment.className='crm-payment-received-v21 field';payment.innerHTML='<label for="crm-paid-amount-'+iv.id+'">Bereits erhalten</label><div class="row"><input id="crm-paid-amount-'+iv.id+'" type="number" min="0" step="0.01" value="'+paidAmount(iv).toFixed(2)+'"><button type="button" class="btn" onclick="SHP_BUSINESS_GUARDS.savePaidAmount('+Number(iv.id)+')">Zahlung speichern</button></div><p class="small muted crm-payment-open-v21"></p>';box.appendChild(payment)}
    var open=payment.querySelector('.crm-payment-open-v21');setText(open,'Offener Restbetrag: '+money(outstandingAmount(iv))+(blocked?' · keine neue Mahnstufe möglich':''));
  }

  function recordHandoff(kind,channel,note){
    var bridge=dataBridge(),db=bridge&&typeof bridge.readDb==='function'?bridge.readDb():readDb(),target=null;
    if(kind==='report'){var r=currentReport();target=r}else target=currentInvoice();if(!target)return false;
    target.sentHistory=target.sentHistory||[];target.sentHistory.push({at:now(),by:user(),channel:channel,status:'Übergabe',note:note||''});
    if(bridge&&typeof bridge.save==='function')bridge.save();else write(localStorage,DB_STORE,db);return true;
  }
  function validateRecipient(channel,c){if(channel==='E-Mail'&&!validEmail(c&&c.email)){notice('Keine gültige E-Mail-Adresse hinterlegt. Es wurde nichts als Versand protokolliert.');return false}if(channel==='WhatsApp'&&!normalizePhone(c&&c.phone)){notice('Keine gültige Telefonnummer hinterlegt. Es wurde nichts als Versand protokolliert.');return false}return true}
  function invoiceMessage(ctx){return'Guten Tag '+(ctx.c.contact||ctx.c.name||'')+', hier erhalten Sie Rechnung '+ctx.iv.no+' zu Auftrag '+(ctx.o?ctx.o.no:'')+'. Bitte beachten Sie das Dokument/PDF.'}
  function sendInvoice(channel){
    var ctx=invoiceContext();if(!ctx)return false;channel=normalizeChannel(channel);if(!validateRecipient(channel,ctx.c))return false;
    if(channel==='Post'&&typeof originals.sendInvoice==='function')return originals.sendInvoice.call(window.SH,'Post');
    var msg=invoiceMessage(ctx),subject='Rechnung '+ctx.iv.no+' - Rohr- & Kanaltechnik Winser';
    if(channel==='WhatsApp'){recordHandoff('invoice','WhatsApp','WhatsApp-Übergabe geöffnet');location.href='https://wa.me/'+normalizePhone(ctx.c.phone)+'?text='+encodeURIComponent(msg);return true}
    if(channel==='E-Mail'){recordHandoff('invoice','E-Mail','E-Mail-Entwurf geöffnet; Dokument muss bereitgestellt/angehängt werden');location.href='mailto:'+encodeURIComponent(String(ctx.c.email).trim())+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(msg);return true}
    return false;
  }
  function sendInvoicePreferred(){var ctx=invoiceContext();return ctx?sendInvoice(normalizeChannel(ctx.c.preferredChannel)):false}
  function isShareAbort(error){var name=String(error&&error.name||''),msg=String(error&&error.message||'');return /AbortError/i.test(name)||/cancel|abgebroch|abort/i.test(msg)}
  function supportsFileShare(){try{return !!(navigator.share&&navigator.canShare&&navigator.canShare({files:[new File(['x'],'x.txt',{type:'text/plain'})]}))}catch(e){return false}}
  function downloadBlob(blob,name){var url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;(document.body||document.documentElement).appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},2000)}
  async function shareReportPreferred(){
    var ctx=currentReportContext(),api=window.SHP_REPORT_NATIVE_PDF;if(!ctx||!api||typeof api.buildPdf!=='function')return false;
    var channel=normalizeChannel(ctx.c.preferredChannel);if(!validateRecipient(channel,ctx.c))return false;
    var fileShare=channel==='WhatsApp'&&supportsFileShare(),popup=null;
    if(channel==='WhatsApp'&&!fileShare&&typeof window.open==='function')popup=window.open('about:blank','_blank');
    try{
      var built=await api.buildPdf(),msg='Guten Tag '+(ctx.c.contact||ctx.c.name)+', hier erhalten Sie den Rapport zu Auftrag '+ctx.o.no+'.';
      if(channel==='WhatsApp'&&fileShare){
        var f=new File([built.blob],built.name,{type:'application/pdf'});
        try{await navigator.share({title:'Rapport '+ctx.o.no,text:msg,files:[f]})}catch(e){if(isShareAbort(e)){notice('Teilen abgebrochen. Es wurde kein Versand vermerkt.');return false}throw e}
        recordHandoff('report','Teilen-Dialog','PDF erfolgreich an den System-Teilen-Dialog übergeben');notice('Rapport-PDF wurde zum Teilen übergeben.');return true;
      }
      if(channel==='WhatsApp'){
        downloadBlob(built.blob,built.name);var url='https://wa.me/'+normalizePhone(ctx.c.phone)+'?text='+encodeURIComponent(msg+' Die PDF wurde heruntergeladen und kann hier angehängt werden.');
        if(popup){popup.location.href=url}else{notice('WhatsApp konnte nicht automatisch geöffnet werden. Die PDF wurde heruntergeladen; bitte WhatsApp manuell öffnen.');return false}
        recordHandoff('report','WhatsApp','PDF heruntergeladen; WhatsApp-Übergabe geöffnet, Anhang bleibt manuell');notice('PDF heruntergeladen. WhatsApp wurde geöffnet; bitte PDF anhängen.');return true;
      }
      if(channel==='E-Mail'){
        downloadBlob(built.blob,built.name);location.href='mailto:'+encodeURIComponent(String(ctx.c.email).trim())+'?subject='+encodeURIComponent('Rapport '+ctx.o.no+' - Rohr- & Kanaltechnik Winser')+'&body='+encodeURIComponent(msg+' Die PDF wurde heruntergeladen und muss dem E-Mail-Entwurf noch angehängt werden.');
        recordHandoff('report','E-Mail','PDF heruntergeladen; E-Mail-Entwurf geöffnet, Anhang bleibt manuell');notice('PDF heruntergeladen. E-Mail-Entwurf geöffnet; bitte PDF anhängen.');return true;
      }
      downloadBlob(built.blob,built.name);recordHandoff('report','Post / Druck','PDF für Druck/Post bereitgestellt');notice('Rapport-PDF wurde für Druck/Post erstellt.');return true;
    }catch(e){try{if(popup&&!popup.closed)popup.close()}catch(ignore){}if(isShareAbort(e)){notice('Teilen abgebrochen. Es wurde kein Versand vermerkt.');return false}console.error(e);notice('Rapport-PDF konnte nicht erstellt oder übergeben werden: '+String(e&&e.message||e));return false}
  }
  function installDispatchGuards(){
    if(window.SH){originals.sendInvoice=window.SH.sendInvoice;originals.sendInvoicePreferred=window.SH.sendInvoicePreferred;originals.sendReportPreferred=window.SH.sendReportPreferred;window.SH.sendInvoice=sendInvoice;window.SH.sendInvoicePreferred=sendInvoicePreferred;window.SH.sendReportPreferred=shareReportPreferred}
    if(window.SHP_REPORT_NATIVE_PDF)window.SHP_REPORT_NATIVE_PDF.sharePdf=shareReportPreferred;
  }
  function installPaymentGuards(){if(window.SHP_PAYMENTS){window.SHP_PAYMENTS.paymentState=paymentState;window.SHP_PAYMENTS.stats=stats;window.SHP_PAYMENTS.saveStage=saveStage}}
  function enhance(){installDispatchGuards();installPaymentGuards();patchPayments();document.documentElement.dataset.shBusinessGuards=BUILD}

  installReportGuards();installDispatchGuards();installPaymentGuards();
  if(window.SHP_STABILITY)window.SHP_STABILITY.register('ux-v21-business-guards',enhance,{initial:false});
  window.SHP_BUSINESS_GUARDS={build:BUILD,validEmail:validEmail,normalizePhone:normalizePhone,canvasHasInk:canvasHasInk,paymentState:paymentState,outstandingAmount:outstandingAmount,stats:stats,saveStage:saveStage,savePaidAmount:savePaidAmount,isShareAbort:isShareAbort,shareReportPreferred:shareReportPreferred,enhance:enhance};
  enhance();
})();
