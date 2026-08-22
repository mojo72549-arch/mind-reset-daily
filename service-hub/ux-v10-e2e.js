(function(){
  'use strict';
  var STORE='shp_db', PENDING='shp_pending_delivery_v10', BUILD='20260822-v10';
  var wrapped=false, adminSaveWrapped=false, clearWrapped=false;
  var DELIVERY_DEFAULTS={
    whatsappNumber:'0152 23401628',
    whatsappLabel:'Rohr- & Kanaltechnik Winser',
    whatsappMode:'Geräte-App (kostenfrei)',
    emailSenderName:'Rohr- & Kanaltechnik Winser',
    emailReplyTo:'info@rokatech-winser.de',
    emailMode:'Standard-Mail-App (kostenfrei)',
    postSender:'Rohr- & Kanaltechnik Winser · Taläckerstraße 49 · 70437 Stuttgart'
  };

  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(ch){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}
  function readDb(){try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch(e){return null}}
  function setDb(db){
    if(window.SHP_INTERNAL&&typeof window.SHP_INTERNAL.setDb==='function')window.SHP_INTERNAL.setDb(db);
    else localStorage.setItem(STORE,JSON.stringify(db));
  }
  function rerender(){if(window.SHP_INTERNAL&&typeof window.SHP_INTERNAL.render==='function')window.SHP_INTERNAL.render()}
  function selectedOrder(){return window.SHP_INTERNAL&&window.SHP_INTERNAL.getSelectedOrder?window.SHP_INTERNAL.getSelectedOrder():null}
  function selectedInvoice(){return window.SHP_INTERNAL&&window.SHP_INTERNAL.getSelectedInvoice?window.SHP_INTERNAL.getSelectedInvoice():null}
  function session(){try{return JSON.parse(sessionStorage.getItem('shp_session')||'null')}catch(e){return null}}
  function user(){var s=session();return s&&s.user||'System'}
  function isOffice(){var s=session();return !!(s&&(s.user==='annette'||s.user==='admin'))}
  function delivery(db){return Object.assign({},DELIVERY_DEFAULTS,db&&db.settings&&db.settings.delivery||{})}
  function now(){return new Date().toLocaleString('de-DE')}
  function normalPhone(p){return String(p||'').replace(/[^0-9]/g,'').replace(/^0/,'49')}
  function showToast(text,kind){
    var old=document.querySelector('.ux-v10-toast');if(old)old.remove();
    var el=document.createElement('div');el.className='ux-v10-toast '+(kind||'ok');el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.textContent=text;
    el.style.cssText='position:fixed;left:50%;bottom:88px;transform:translateX(-50%);z-index:140;max-width:min(92vw,620px);padding:12px 16px;border-radius:12px;background:'+(kind==='error'?'#8f2525':'#102b41')+';color:#fff;font-weight:750;box-shadow:0 10px 32px #0005;text-align:center';
    document.body.appendChild(el);setTimeout(function(){if(el.parentNode)el.remove()},3600);
  }
  function hasInk(canvas){
    if(!canvas||!canvas.getContext)return false;
    if(canvas.dataset&&canvas.dataset.signed==='1')return true;
    try{var d=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;for(var i=3;i<d.length;i+=4)if(d[i]>0)return true}catch(e){}
    return false;
  }
  function findReport(db,orderId){return (db&&db.reports||[]).find(function(r){return String(r.orderId)===String(orderId)})||null}
  function findInvoice(db,id){return (db&&db.invoices||[]).find(function(iv){return String(iv.id)===String(id)})||null}
  function customerForInvoice(db,iv){return (db&&db.customers||[]).find(function(c){return String(c.id)===String(iv&&iv.customerId)})||null}
  function orderForInvoice(db,iv){return (db&&db.orders||[]).find(function(o){return String(o.id)===String(iv&&iv.orderId)})||null}

  function markSignature(canvas){
    if(!canvas)return;canvas.dataset.signed='1';
    var wrap=canvas.parentElement;if(!wrap)return;
    var state=wrap.querySelector('.ux-v10-signature-state');
    if(!state){state=document.createElement('div');state.className='ux-v10-signature-state';canvas.insertAdjacentElement('afterend',state)}
    state.textContent='✓ Unterschrift erfasst';state.dataset.state='signed';
  }
  function clearSignatureState(canvas){
    if(!canvas)return;canvas.dataset.signed='0';
    var wrap=canvas.parentElement,state=wrap&&wrap.querySelector('.ux-v10-signature-state');
    if(state){state.textContent='Unterschrift noch nicht erfasst';state.dataset.state='empty'}
  }
  function wireSignatureState(){
    var db=readDb(),r=findReport(db,selectedOrder());
    ['sigC','sigT'].forEach(function(id){
      var canvas=document.getElementById(id);if(!canvas)return;
      if(!canvas.dataset.v10SignatureWired){
        canvas.dataset.v10SignatureWired='1';
        ['pointerdown','mousedown','touchstart'].forEach(function(evt){canvas.addEventListener(evt,function(){markSignature(canvas)},{passive:true})});
      }
      if((id==='sigC'&&r&&r.sigC)||(id==='sigT'&&r&&r.sigT))canvas.dataset.signed='1';
      var wrap=canvas.parentElement,state=wrap&&wrap.querySelector('.ux-v10-signature-state');
      if(!state){state=document.createElement('div');state.className='ux-v10-signature-state';canvas.insertAdjacentElement('afterend',state)}
      if(canvas.dataset.signed==='1'){state.textContent='✓ Unterschrift erfasst';state.dataset.state='signed'}
      else{state.textContent='Unterschrift noch nicht erfasst';state.dataset.state='empty'}
    });
  }

  function addDeliverySettings(){
    var main=document.querySelector('main.shell'),title=main&&main.querySelector('.ux-admin-title h2');
    if(!main||!title||(title.textContent||'').trim()!=='Administration')return;
    var intro=main.querySelector('.ux-admin-title p');if(intro&&intro.dataset.v10Copy!=='1'){intro.dataset.v10Copy='1';intro.textContent='Ausschließlich Systemeinstellungen. Kunden, Aufträge, Rapporte und Rechnungen werden hier nicht bearbeitet.'}
    [].slice.call(main.querySelectorAll('h3')).forEach(function(h){if((h.textContent||'').trim()==='Rechnungstexte')h.textContent='Dokumentvorlagen'});
    if(main.querySelector('.ux-v10-delivery-settings'))return;
    var grid=main.querySelector('.ux-admin-grid');if(!grid)return;
    var db=readDb();if(!db)return;var d=delivery(db);
    var section=document.createElement('section');section.className='ux-admin-card ux-admin-wide ux-v10-delivery-settings';
    section.innerHTML='<div class="ux-admin-card-head"><div><span class="ux-admin-kicker">Kommunikation & Versand</span><h3>WhatsApp, E-Mail & Post</h3><p>Für einzelne Sendungen werden die Apps auf dem Gerät geöffnet. Keine Twilio-/WhatsApp-Business-API ist erforderlich und es entstehen dadurch keine API-Versandkosten.</p></div></div>'+
      '<div class="ux-admin-fields">'+
      '<label>WhatsApp-Geschäftsnummer<input id="adm-waNumber" value="'+esc(d.whatsappNumber)+'"></label>'+
      '<label>WhatsApp-Absendername<input id="adm-waLabel" value="'+esc(d.whatsappLabel)+'"></label>'+
      '<label>WhatsApp-Modus<input id="adm-waMode" disabled value="'+esc(DELIVERY_DEFAULTS.whatsappMode)+'"></label>'+
      '<label>E-Mail-Absendername<input id="adm-emailSender" value="'+esc(d.emailSenderName)+'"></label>'+
      '<label>E-Mail / Antwortadresse<input id="adm-emailReplyTo" type="email" value="'+esc(d.emailReplyTo)+'"></label>'+
      '<label>E-Mail-Modus<input id="adm-emailMode" disabled value="'+esc(DELIVERY_DEFAULTS.emailMode)+'"></label>'+
      '<label class="ux-span-2">Absenderzeile Post<input id="adm-postSender" value="'+esc(d.postSender)+'"></label>'+
      '</div><div class="ux-admin-note"><b>Kostenmodell:</b> Der Einzelversand öffnet WhatsApp bzw. die Mail-App auf dem Gerät; es wird kein kostenpflichtiger API-Dienst wie Twilio benötigt.</div>'+
      '<div class="ux-admin-note"><b>WhatsApp:</b> Der tatsächlich sendende Account ist der auf dem jeweiligen Smartphone angemeldete WhatsApp-Account. Die hinterlegte Nummer ist der Firmenkontakt für Dokumente und Nachrichtentexte.</div>';
    var roleCard=[].slice.call(grid.children).find(function(el){var h=el.querySelector('h3');return h&&(h.textContent||'').trim()==='Rollenmodell'});
    if(roleCard)grid.insertBefore(section,roleCard);else grid.appendChild(section);
  }

  function wrapAdminSave(){
    if(adminSaveWrapped||!window.SHP_V6||typeof window.SHP_V6.saveAdminSettings!=='function')return;adminSaveWrapped=true;
    var original=window.SHP_V6.saveAdminSettings;
    window.SHP_V6.saveAdminSettings=function(){
      var vals={
        whatsappNumber:(document.getElementById('adm-waNumber')||{}).value,
        whatsappLabel:(document.getElementById('adm-waLabel')||{}).value,
        emailSenderName:(document.getElementById('adm-emailSender')||{}).value,
        emailReplyTo:(document.getElementById('adm-emailReplyTo')||{}).value,
        postSender:(document.getElementById('adm-postSender')||{}).value
      };
      var result=original.apply(window.SHP_V6,arguments),db=readDb();if(!db)return result;db.settings=db.settings||{};
      db.settings.delivery=Object.assign({},DELIVERY_DEFAULTS,{
        whatsappNumber:String(vals.whatsappNumber||'').trim(),whatsappLabel:String(vals.whatsappLabel||'').trim(),whatsappMode:DELIVERY_DEFAULTS.whatsappMode,
        emailSenderName:String(vals.emailSenderName||'').trim(),emailReplyTo:String(vals.emailReplyTo||'').trim(),emailMode:DELIVERY_DEFAULTS.emailMode,
        postSender:String(vals.postSender||'').trim()
      });
      setDb(db);showToast('Kommunikations- und Systemeinstellungen gespeichert');setTimeout(addDeliverySettings,0);return result;
    };
  }

  function releaseInvoice(){
    if(!isOffice())return alert('Nur Büro / Administration darf Rechnungen freigeben.');
    var db=readDb(),id=selectedInvoice(),iv=findInvoice(db,id);if(!iv)return;
    if(iv.status!=='Entwurf')return showToast('Rechnung ist bereits freigegeben.');
    iv.status='Offen';iv.history=iv.history||[];iv.history.push({at:now(),by:user(),text:'Rechnung geprüft und freigegeben'});setDb(db);rerender();showToast('Rechnung freigegeben – Versand ist jetzt möglich');
  }

  function deliveryMessage(db,iv,c,o,channel){
    var d=delivery(db),hello='Guten Tag '+(c.contact||c.name)+', ',doc='Rechnung '+iv.no+' zu Auftrag '+(o?o.no:'');
    var suffix='\n\n'+d.whatsappLabel+'\n'+d.whatsappNumber+'\n'+d.emailReplyTo;
    return hello+'hier erhalten Sie '+doc+'. Bitte fügen Sie das erzeugte Rechnungs-PDF beim Versand bei.'+(channel==='WhatsApp'?suffix:'');
  }
  function prepareDelivery(channel){
    if(!isOffice())return alert('Nur Büro / Administration darf Rechnungen versenden.');
    var db=readDb(),id=selectedInvoice(),iv=findInvoice(db,id);if(!iv)return;
    if(iv.status==='Entwurf')return alert('Rechnung zuerst prüfen und freigeben.');
    var c=customerForInvoice(db,iv),o=orderForInvoice(db,iv),d=delivery(db),url='';if(!c)return;
    var msg=deliveryMessage(db,iv,c,o,channel),subject='Rechnung '+iv.no+' - '+d.whatsappLabel;
    if(channel==='WhatsApp'){
      var phone=normalPhone(c.phone);if(!phone)return alert('Beim Kunden fehlt eine Mobil-/Telefonnummer.');
      url='https://wa.me/'+phone+'?text='+encodeURIComponent(msg);
    }else if(channel==='E-Mail'){
      if(!c.email)return alert('Beim Kunden fehlt eine E-Mail-Adresse.');
      url='mailto:'+encodeURIComponent(c.email)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(msg+'\n\nAntwortadresse: '+d.emailReplyTo);
    }else if(channel==='Post'){
      if(!c.address)return alert('Beim Kunden fehlt eine Postanschrift.');url='print://invoice/'+iv.no;
    }else return;
    iv.sentHistory=iv.sentHistory||[];iv.sentHistory.push({at:now(),by:user(),channel:channel,state:'Vorbereitet'});
    iv.history=iv.history||[];iv.history.push({at:now(),by:user(),text:'Versand über '+channel+' vorbereitet'});
    setDb(db);sessionStorage.setItem(PENDING,JSON.stringify({invoiceId:iv.id,channel:channel,url:url,at:Date.now()}));
    window.SHP_LAST_DELIVERY={channel:channel,url:url,invoiceId:iv.id};rerender();showToast(channel+' vorbereitet – nach dem tatsächlichen Versand bitte bestätigen');
    if(window.__SHP_TEST_MODE__)return;
    setTimeout(function(){if(channel==='Post'){if(window.SH&&window.SH.printInvoice)window.SH.printInvoice()}else window.open(url,'_blank','noopener')},80);
  }
  function confirmDelivery(){
    var p=null;try{p=JSON.parse(sessionStorage.getItem(PENDING)||'null')}catch(e){}if(!p)return;
    var db=readDb(),iv=findInvoice(db,p.invoiceId);if(!iv)return;
    iv.status='Versendet';iv.sentHistory=iv.sentHistory||[];iv.sentHistory.push({at:now(),by:user(),channel:p.channel,state:'Bestätigt'});
    iv.history=iv.history||[];iv.history.push({at:now(),by:user(),text:'Versand über '+p.channel+' bestätigt'});setDb(db);sessionStorage.removeItem(PENDING);rerender();showToast('Versand bestätigt – Rechnung steht auf Versendet');
  }
  function cancelDelivery(){sessionStorage.removeItem(PENDING);rerender();showToast('Versandvorbereitung verworfen');}

  function enhanceInvoice(){
    var main=document.querySelector('main.shell'),h=main&&main.querySelector('h2');if(!main||!h||!/^Rechnung\s/.test((h.textContent||'').trim()))return;
    var db=readDb(),iv=findInvoice(db,selectedInvoice());if(!iv)return;
    var statusCard=[].slice.call(main.querySelectorAll('.card')).find(function(c){var hh=c.querySelector('h3');return hh&&(hh.textContent||'').trim()==='Status & Bearbeitung'});
    if(statusCard){
      var release=statusCard.querySelector('.ux-v10-release');
      if(iv.status==='Entwurf'&&!release){release=document.createElement('button');release.type='button';release.className='btn green ux-v10-release';release.textContent='Rechnung freigeben';release.onclick=releaseInvoice;statusCard.appendChild(release)}
      if(iv.status!=='Entwurf'&&release)release.remove();
    }
    var sendCard=[].slice.call(main.querySelectorAll('.card')).find(function(c){var hh=c.querySelector('h3');return hh&&(hh.textContent||'').trim()==='Versand'});
    if(!sendCard)return;
    if(!sendCard.querySelector('.ux-v10-delivery-info')){
      var info=document.createElement('div');info.className='ux-v10-delivery-info';
      info.innerHTML='<p class="muted small"><b>Kostenfreier Einzelversand:</b> WhatsApp über die Geräte-App, E-Mail über die Standard-Mail-App, Post über PDF/Druck. Keine Twilio-/Meta-API erforderlich.</p><p class="muted small"><b>Dokument:</b> Das Rechnungs-PDF wird vor dem tatsächlichen Versand erzeugt und beim jeweiligen Kanal beigefügt bzw. ausgedruckt.</p>';
      var hh=sendCard.querySelector('h3');if(hh)hh.insertAdjacentElement('afterend',info);else sendCard.insertBefore(info,sendCard.firstChild);
    }
    sendCard.querySelectorAll('button').forEach(function(btn){var t=(btn.textContent||'').trim();
      if(t==='WhatsApp')btn.onclick=function(){prepareDelivery('WhatsApp')};
      else if(t==='E-Mail')btn.onclick=function(){prepareDelivery('E-Mail')};
      else if(t==='Post / Druck')btn.onclick=function(){prepareDelivery('Post')};
      else if(t==='Bevorzugten Kanal verwenden')btn.onclick=function(){var db1=readDb(),iv1=findInvoice(db1,selectedInvoice()),c=customerForInvoice(db1,iv1);prepareDelivery(c&&c.preferredChannel||'E-Mail')};
      if(t==='WhatsApp'||t==='E-Mail'||t==='Post / Druck'||t==='Bevorzugten Kanal verwenden')btn.disabled=iv.status==='Entwurf';
    });
    var sticky=main.querySelector('.sticky');if(sticky)sticky.querySelectorAll('button').forEach(function(btn){if((btn.textContent||'').indexOf('Senden über')===0){btn.disabled=iv.status==='Entwurf';btn.onclick=function(){var db2=readDb(),iv2=findInvoice(db2,selectedInvoice()),c=customerForInvoice(db2,iv2);prepareDelivery(c&&c.preferredChannel||'E-Mail')}}});
    var panels=[].slice.call(sendCard.querySelectorAll('.ux-v10-pending'));if(panels.length>1)panels.slice(1).forEach(function(x){x.remove()});
    var pending=null;try{pending=JSON.parse(sessionStorage.getItem(PENDING)||'null')}catch(e){}
    var panel=sendCard.querySelector('.ux-v10-pending');
    if(pending&&String(pending.invoiceId)===String(iv.id)){
      if(!panel){
        panel=document.createElement('div');panel.className='ux-v10-pending';panel.innerHTML='<b></b><span>Nach dem tatsächlichen Versand zurückkehren und bestätigen.</span><div><button class="btn green" type="button">Versand bestätigen</button><button class="btn" type="button">Verwerfen</button></div>';
        panel.querySelector('.green').onclick=confirmDelivery;panel.querySelectorAll('button')[1].onclick=cancelDelivery;sendCard.appendChild(panel);
      }
      panel.querySelector('b').textContent=pending.channel+' vorbereitet';
    }else if(panel)panel.remove();
  }

  function wrapFlow(){
    if(wrapped||!window.SH)return;wrapped=true;
    var clear=window.SH.clearSig;
    if(typeof clear==='function'&&!clearWrapped){clearWrapped=true;window.SH.clearSig=function(id){var result=clear.apply(window.SH,arguments);clearSignatureState(document.getElementById(id));return result}}
    var finish=window.SH.finishReport;
    if(typeof finish==='function')window.SH.finishReport=function(){
      var c=document.getElementById('sigC'),t=document.getElementById('sigT');
      if(!hasInk(c))return alert('Kundenunterschrift fehlt. Der Rapport kann noch nicht abgeschlossen werden.');
      if(!hasInk(t))return alert('Technikerunterschrift fehlt. Der Rapport kann noch nicht abgeschlossen werden.');
      return finish.apply(window.SH,arguments);
    };
    var invoiceFromReport=window.SH.invoiceFromReport;
    if(typeof invoiceFromReport==='function')window.SH.invoiceFromReport=function(){
      if(!isOffice())return alert('Nur Büro / Administration darf Rechnungen erzeugen.');
      var db=readDb(),oid=selectedOrder(),r=findReport(db,oid);if(!r)return;
      if(r.status!=='Abgeschlossen')return alert('Rechnung erst nach abgeschlossenem Rapport erzeugen.');
      var existing=(db.invoices||[]).find(function(iv){return String(iv.reportId)===String(r.id)});
      if(existing){if(window.SH.openInvoice)window.SH.openInvoice(existing.id);return showToast('Zu diesem Rapport existiert bereits eine Rechnung.');}
      var beforeIds=(db.invoices||[]).map(function(iv){return String(iv.id)}),result=invoiceFromReport.apply(window.SH,arguments),db2=readDb();
      var created=(db2.invoices||[]).find(function(iv){return beforeIds.indexOf(String(iv.id))<0})||(db2.invoices||[]).find(function(iv){return String(iv.reportId)===String(r.id)});if(!created)return result;
      created.status='Entwurf';created.history=created.history||[];created.history.push({at:now(),by:user(),text:'Rechnungsentwurf aus abgeschlossenem Rapport erstellt'});setDb(db2);
      if(window.SHP_INTERNAL){window.SHP_INTERNAL.setSelectedInvoice(created.id);window.SHP_INTERNAL.setTab('invoice');window.SHP_INTERNAL.render()}
      showToast('Rechnungsentwurf erstellt – bitte prüfen und freigeben');return result;
    };
    window.SH.sendInvoice=function(channel){prepareDelivery(channel)};
    window.SH.sendInvoicePreferred=function(){var db3=readDb(),iv=findInvoice(db3,selectedInvoice()),c=customerForInvoice(db3,iv);prepareDelivery(c&&c.preferredChannel||'E-Mail')};
  }

  function enhance(){document.documentElement.dataset.shBuild=BUILD;wrapAdminSave();addDeliverySettings();wrapFlow();wireSignatureState();enhanceInvoice()}
  var scheduled=false;function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;enhance()})}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});enhance();
  window.SHP_V10={build:BUILD,enhance:enhance,prepareDelivery:prepareDelivery,confirmDelivery:confirmDelivery,releaseInvoice:releaseInvoice,deliveryDefaults:DELIVERY_DEFAULTS};
})();
