(function(){
  'use strict';
  var STORE='shp_db',SESSION='shp_session',PENDING='shp_pending_delivery_v12';
  var installed=false,recentOrders={};

  function readDb(){try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch(e){return null}}
  function bridge(){return window.SHP_INTERNAL||null}
  function sess(){try{return JSON.parse(sessionStorage.getItem(SESSION)||'null')}catch(e){return null}}
  function role(){var s=sess();return s&&s.user||''}
  function norm(v){return String(v==null?'':v).trim().toLowerCase()}
  function money(v){return(+v||0).toFixed(2).replace('.',',')+' €'}
  function toast(text,kind){
    document.querySelectorAll('.ux-v12-toast').forEach(function(x){x.remove()});
    var el=document.createElement('div');el.className='toast ux-v12-toast '+(kind||'');el.setAttribute('role','status');el.textContent=text;document.body.appendChild(el);
    setTimeout(function(){if(el.parentNode)el.remove()},2600);
  }
  function setDb(next,rerender){
    var b=bridge();
    if(b&&typeof b.setDb==='function'){b.setDb(next);if(rerender&&typeof b.render==='function')b.render();return}
    localStorage.setItem(STORE,JSON.stringify(next));
  }
  function currentOrder(db){
    var h=document.querySelector('main h2'),m=((h&&h.textContent)||'').match(/^Rapport\s+(.+)$/);if(!m)return null;
    return (db.orders||[]).find(function(o){return String(o.no)===m[1].trim()})||null;
  }
  function currentReport(db){var o=currentOrder(db);return o&&(db.reports||[]).find(function(r){return String(r.orderId)===String(o.id)})||null}
  function currentInvoice(db){
    var h=document.querySelector('main h2'),m=((h&&h.textContent)||'').match(/^Rechnung\s+(\S+)/);if(!m)return null;
    return (db.invoices||[]).find(function(iv){return String(iv.no)===m[1]})||null;
  }
  function customerForInvoice(db,iv){return iv&&(db.customers||[]).find(function(c){return String(c.id)===String(iv.customerId)})||null}
  function validEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim())}
  function validChannel(v){return ['WhatsApp','E-Mail','Post'].indexOf(String(v||'').trim())>=0}
  function validateCustomer(db,data,excludeId){
    if(!data.name.trim())return'Kundenname fehlt.';
    if(!data.address.trim())return'Adresse fehlt.';
    var dup=(db.customers||[]).some(function(c){return String(c.id)!==String(excludeId||'')&&norm(c.name)===norm(data.name)&&norm(c.address)===norm(data.address)});
    if(dup)return'Kunde mit gleichem Namen und gleicher Adresse existiert bereits.';
    if(!validChannel(data.channel))return'Bevorzugter Kanal muss WhatsApp, E-Mail oder Post sein.';
    if(data.channel==='WhatsApp'&&!String(data.phone||'').trim())return'Für WhatsApp ist eine Telefonnummer erforderlich.';
    if(data.channel==='E-Mail'&&!validEmail(data.email))return'Für E-Mail ist eine gültige E-Mail-Adresse erforderlich.';
    if(!isFinite(data.rate)||data.rate<0)return'Stundensatz muss 0 oder größer sein.';
    return'';
  }
  function withPrompts(values,fn){var p=window.prompt,q=values.slice();window.prompt=function(){return q.shift()};try{return fn()}finally{window.prompt=p}}
  function askCustomer(initial){
    initial=initial||{};
    var name=prompt('Kundenname',initial.name||'');if(name===null||!String(name).trim())return null;
    var address=prompt('Adresse',initial.address||'');if(address===null||!String(address).trim())return null;
    var contact=prompt('Ansprechpartner',initial.contact||'');if(contact===null)return null;
    var phone=prompt('Telefon',initial.phone||'');if(phone===null)return null;
    var email=prompt('E-Mail',initial.email||'');if(email===null)return null;
    var rateRaw=prompt('Stundensatz für diesen Kunden',String(initial.hourlyRate==null?70:initial.hourlyRate));if(rateRaw===null)return null;
    var channel=prompt('Bevorzugter Kanal: WhatsApp / E-Mail / Post',initial.preferredChannel||'E-Mail');if(channel===null)return null;
    return{name:String(name).trim(),address:String(address).trim(),contact:String(contact||'').trim(),phone:String(phone||'').trim(),email:String(email||'').trim(),rate:parseFloat(rateRaw),channel:String(channel||'').trim()}
  }
  function hasInk(canvas){
    if(!canvas)return false;
    try{var ctx=canvas.getContext('2d'),d=ctx.getImageData(0,0,canvas.width,canvas.height).data;for(var i=3;i<d.length;i+=4)if(d[i]>0)return true}catch(e){}
    return false;
  }
  function normalPhone(p){var n=String(p||'').replace(/[^0-9]/g,'');return n.replace(/^0/,'49')}
  function deliveryUrl(channel,c,iv,o){
    var msg='Guten Tag '+(c.contact||c.name)+', hier erhalten Sie Rechnung '+iv.no+' zu Auftrag '+(o&&o.no||'')+'. Bitte fügen Sie das erzeugte Rechnungs-PDF beim Versand bei.';
    if(channel==='WhatsApp')return'https://wa.me/'+normalPhone(c.phone)+'?text='+encodeURIComponent(msg);
    if(channel==='E-Mail')return'mailto:'+encodeURIComponent(c.email||'')+'?subject='+encodeURIComponent('Rechnung '+iv.no+' - Rohr- & Kanaltechnik Winser')+'&body='+encodeURIComponent(msg);
    return'print://invoice/'+encodeURIComponent(iv.no);
  }

  function install(){
    if(installed||!window.SH)return;installed=true;
    var old={
      newCustomer:SH.newCustomer,editCustomer:SH.editCustomer,newOrder:SH.newOrder,
      addReportLine:SH.addReportLine,addMaterial:SH.addMaterial,finishReport:SH.finishReport,
      invoiceFromReport:SH.invoiceFromReport,sendInvoice:SH.sendInvoice,sendInvoicePreferred:SH.sendInvoicePreferred
    };

    if(typeof old.newCustomer==='function')SH.newCustomer=function(){
      var db=readDb();if(!db)return old.newCustomer.apply(SH,arguments);
      var d=askCustomer({hourlyRate:db.settings&&db.settings.defaultHourlyRate||70,preferredChannel:'E-Mail'});if(!d)return;
      var err=validateCustomer(db,d,null);if(err)return toast(err,'error');
      return withPrompts([d.name,d.address,d.contact,d.phone,d.email,String(d.rate),d.channel],function(){return old.newCustomer.apply(SH,arguments)}.bind(null));
    };

    if(typeof old.editCustomer==='function')SH.editCustomer=function(id){
      var db=readDb(),c=db&&(db.customers||[]).find(function(x){return String(x.id)===String(id)});if(!c)return old.editCustomer.apply(SH,arguments);
      var name=prompt('Kundenname',c.name);if(name===null)return;
      var contact=prompt('Ansprechpartner',c.contact||'');if(contact===null)return;
      var phone=prompt('Telefon',c.phone||'');if(phone===null)return;
      var email=prompt('E-Mail',c.email||'');if(email===null)return;
      var address=prompt('Adresse',c.address||'');if(address===null)return;
      var channel=prompt('Bevorzugter Kanal: WhatsApp / E-Mail / Post',c.preferredChannel||'E-Mail');if(channel===null)return;
      var interval=prompt('Serviceintervall, z.B. 12 Monate',c.serviceInterval||'');if(interval===null)return;
      var next=prompt('Nächster Service YYYY-MM-DD',c.nextService||'');if(next===null)return;
      var d={name:String(name).trim(),contact:String(contact||'').trim(),phone:String(phone||'').trim(),email:String(email||'').trim(),address:String(address||'').trim(),channel:String(channel||'').trim(),rate:+c.hourlyRate||0};
      var err=validateCustomer(db,d,id);if(err)return toast(err,'error');
      return withPrompts([d.name,d.contact,d.phone,d.email,d.address,d.channel,String(interval),String(next)],function(){return old.editCustomer.call(SH,id)});
    };

    if(typeof old.newOrder==='function')SH.newOrder=function(cid){
      var db=readDb();if(!db||!(db.customers||[]).length)return old.newOrder.apply(SH,arguments);
      var c=cid?(db.customers||[]).find(function(x){return String(x.id)===String(cid)}):db.customers[0];if(!c)return toast('Kunde nicht gefunden.','error');
      var title=prompt('Auftrag für '+c.name);if(title===null||!String(title).trim())return;
      var type=prompt('Art','Wartung');if(type===null)return;type=String(type||'').trim()||'Wartung';title=String(title).trim();
      var key=String(c.id)+'|'+norm(title),now=Date.now();if(recentOrders[key]&&now-recentOrders[key]<1800)return toast('Doppeltes Absenden verhindert. Auftrag wurde nur einmal angelegt.','error');
      recentOrders[key]=now;
      return withPrompts([title,type],function(){return old.newOrder.call(SH,cid)});
    };

    if(typeof old.addReportLine==='function')SH.addReportLine=function(){
      var el=document.getElementById('rqty'),qty=parseFloat(el&&el.value);if(!isFinite(qty)||qty<=0)return toast('Menge muss größer als 0 sein.','error');
      return old.addReportLine.apply(SH,arguments);
    };

    if(typeof old.addMaterial==='function')SH.addMaterial=function(){
      var name=prompt('Material');if(name===null||!String(name).trim())return;
      var qtyRaw=prompt('Menge','1');if(qtyRaw===null)return;var priceRaw=prompt('Einzelpreis','0');if(priceRaw===null)return;
      var qty=parseFloat(qtyRaw),price=parseFloat(priceRaw);if(!isFinite(qty)||qty<=0)return toast('Materialmenge muss größer als 0 sein.','error');if(!isFinite(price)||price<0)return toast('Materialpreis darf nicht negativ sein.','error');
      return withPrompts([String(name).trim(),String(qty),String(price)],function(){return old.addMaterial.apply(SH,arguments)}.bind(null));
    };

    if(typeof old.finishReport==='function')SH.finishReport=function(){
      var db=readDb(),r=db&&currentReport(db);if(!r||!r.start||!String((document.getElementById('rw')||{}).value||r.work||'').trim()||!String((document.getElementById('rcname')||{}).value||r.customerName||'').trim())return old.finishReport.apply(SH,arguments);
      var c=document.getElementById('sigC'),t=document.getElementById('sigT');
      if(!(r.sigC||hasInk(c)))return toast('Kundenunterschrift fehlt. Rapport bleibt offen.','error');
      if(!(r.sigT||hasInk(t)))return toast('Technikerunterschrift fehlt. Rapport bleibt offen.','error');
      return old.finishReport.apply(SH,arguments);
    };

    if(typeof old.invoiceFromReport==='function')SH.invoiceFromReport=function(){
      var db=readDb(),r=db&&currentReport(db);if(!r)return;
      if(r.status!=='Abgeschlossen')return toast('Rechnung erst nach abgeschlossenem Rapport möglich.','error');
      var existing=(db.invoices||[]).find(function(iv){return String(iv.reportId)===String(r.id)});if(existing){if(typeof SH.openInvoice==='function')SH.openInvoice(existing.id);return toast('Für diesen Rapport existiert bereits Rechnung '+existing.no+'.','error')}
      var result=old.invoiceFromReport.apply(SH,arguments);
      var b=bridge();db=b&&b.getDb?b.getDb():readDb();var newest=(db.invoices||[]).slice().sort(function(a,z){return(+z.id||0)-(+a.id||0)})[0];
      if(newest&&String(newest.reportId)===String(r.id)){
        newest.status='Entwurf';newest.history=newest.history||[];newest.history.push({at:new Date().toLocaleString('de-DE'),by:role()||'System',text:'Rechnungsentwurf aus abgeschlossenem Rapport erstellt'});
        setDb(db,false);if(b){b.setSelectedInvoice(newest.id);b.setTab('invoice');b.render()}
      }
      return result;
    };

    SH.sendInvoice=function(channel){return prepareDelivery(channel)};
    SH.sendInvoicePreferred=function(){var db=readDb(),iv=db&&currentInvoice(db),c=customerForInvoice(db,iv);return prepareDelivery(c&&c.preferredChannel||'E-Mail')};
  }

  function releaseInvoice(){
    var b=bridge(),db=b&&b.getDb?b.getDb():readDb(),iv=db&&currentInvoice(db);if(!iv)return;
    if(role()==='dome')return toast('Rechnungsfreigabe ist Büro / Administration vorbehalten.','error');
    if(iv.status!=='Entwurf')return;
    iv.status='Offen';iv.history=iv.history||[];iv.history.push({at:new Date().toLocaleString('de-DE'),by:role()||'System',text:'Rechnung geprüft und freigegeben'});setDb(db,false);if(b)b.render();toast('Rechnung freigegeben.');
  }
  function prepareDelivery(channel){
    var db=readDb(),iv=db&&currentInvoice(db),c=customerForInvoice(db,iv);if(!iv||!c)return;
    if(role()==='dome')return toast('Versand ist Büro / Administration vorbehalten.','error');
    if(iv.status==='Entwurf')return toast('Versand ist im Entwurf gesperrt. Rechnung zuerst freigeben.','error');
    if(channel==='WhatsApp'&&!String(c.phone||'').trim())return toast('WhatsApp-Versand nicht möglich: Telefonnummer fehlt.','error');
    if(channel==='E-Mail'&&!validEmail(c.email))return toast('E-Mail-Versand nicht möglich: gültige E-Mail-Adresse fehlt.','error');
    if(channel==='Post'&&!String(c.address||'').trim())return toast('Postversand nicht möglich: Adresse fehlt.','error');
    var o=(db.orders||[]).find(function(x){return String(x.id)===String(iv.orderId)}),pending={id:'d'+Date.now(),invoiceId:iv.id,invoiceNo:iv.no,channel:channel,url:deliveryUrl(channel,c,iv,o),createdAt:Date.now()};
    sessionStorage.setItem(PENDING,JSON.stringify(pending));enhanceInvoice();toast('Versand vorbereitet. Erst nach tatsächlichem Versand bestätigen.');
    window.SHP_LAST_DELIVERY=pending;
    if(!window.__SHP_TEST_MODE__){if(channel==='Post'){if(typeof SH.printInvoice==='function')SH.printInvoice()}else window.open(pending.url,'_blank','noopener')}
    return pending;
  }
  function pending(){try{return JSON.parse(sessionStorage.getItem(PENDING)||'null')}catch(e){return null}}
  function confirmDelivery(){
    var p=pending();if(!p)return;var b=bridge(),db=b&&b.getDb?b.getDb():readDb(),iv=(db.invoices||[]).find(function(x){return String(x.id)===String(p.invoiceId)});if(!iv)return;
    iv.sentHistory=iv.sentHistory||[];if(!iv.sentHistory.some(function(h){return h.deliveryId===p.id}))iv.sentHistory.push({at:new Date().toLocaleString('de-DE'),by:role()||'System',channel:p.channel,state:'Bestätigt',deliveryId:p.id});
    if(iv.status!=='Bezahlt'&&iv.status!=='Storniert')iv.status='Versendet';iv.history=iv.history||[];iv.history.push({at:new Date().toLocaleString('de-DE'),by:role()||'System',text:'Versand über '+p.channel+' bestätigt'});
    sessionStorage.removeItem(PENDING);setDb(db,false);if(b)b.render();toast('Versand als durchgeführt bestätigt.');
  }
  function cancelDelivery(){sessionStorage.removeItem(PENDING);enhanceInvoice();toast('Versandvorbereitung verworfen.');}
  function enhanceInvoice(){
    var db=readDb(),iv=db&&currentInvoice(db);if(!iv)return;
    var statusCard=[].slice.call(document.querySelectorAll('.card')).find(function(c){var h=c.querySelector('h3');return h&&(h.textContent||'').trim()==='Status & Bearbeitung'});
    if(statusCard){var old=statusCard.querySelector('.ux-v12-release');if(old)old.remove();if(iv.status==='Entwurf'&&role()!=='dome'){var btn=document.createElement('button');btn.type='button';btn.className='btn green ux-v12-release';btn.textContent='Rechnung freigeben';btn.onclick=releaseInvoice;statusCard.appendChild(btn)}}
    var sendCard=[].slice.call(document.querySelectorAll('.card')).find(function(c){var h=c.querySelector('h3');return h&&(h.textContent||'').trim()==='Versand'});if(!sendCard)return;
    sendCard.querySelectorAll('button').forEach(function(btn){btn.disabled=iv.status==='Entwurf'});
    var p=pending(),panel=sendCard.querySelector('.ux-v12-pending');if(panel)panel.remove();if(p&&String(p.invoiceId)===String(iv.id)){
      panel=document.createElement('div');panel.className='ux-v12-pending';panel.innerHTML='<b>Versand vorbereitet: '+String(p.channel)+'</b><span>Öffnen der App gilt noch nicht als Versand. PDF bei WhatsApp/E-Mail manuell beifügen.</span><div><button type="button" class="btn green" data-confirm>Versand bestätigen</button><button type="button" class="btn" data-cancel>Abbrechen</button></div>';
      panel.querySelector('[data-confirm]').onclick=confirmDelivery;panel.querySelector('[data-cancel]').onclick=cancelDelivery;sendCard.appendChild(panel)
    }
  }
  function addDeliverySettings(){
    if(role()!=='admin')return;var main=document.querySelector('main.shell'),h=main&&main.querySelector('.ux-admin-title h2');if(!h||(h.textContent||'').trim()!=='Administration'||main.querySelector('.ux-v12-delivery-settings'))return;
    var db=readDb();db.settings=db.settings||{};var d=db.settings.delivery||{whatsappNumber:'0152 23401628',emailReplyTo:'info@rokatech-winser.de',postSender:'Rohr- & Kanaltechnik Winser · Taläckerstraße 49 · 70437 Stuttgart'};
    var card=document.createElement('section');card.className='ux-admin-card ux-v12-delivery-settings';card.innerHTML='<div class="ux-admin-card-head"><div><span class="ux-admin-kicker">Kommunikation</span><h3>Versand & Absender</h3><p>Geräte-App statt kostenpflichtiger Pflicht-API. Öffnen ist nicht gleich Versand.</p></div></div><div class="ux-admin-fields"><label>WhatsApp-Geschäftsnummer<input id="adm-waNumber" value="'+String(d.whatsappNumber||'').replace(/"/g,'&quot;')+'"></label><label>Antwort-E-Mail<input id="adm-emailReplyTo" value="'+String(d.emailReplyTo||'').replace(/"/g,'&quot;')+'"></label><label class="ux-span-2">Post-Absender<input id="adm-postSender" value="'+String(d.postSender||'').replace(/"/g,'&quot;')+'"></label></div><button type="button" class="btn primary" data-save>Kommunikation speichern</button>';
    card.querySelector('[data-save]').onclick=function(){var x=readDb();x.settings=x.settings||{};x.settings.delivery={whatsappNumber:(document.getElementById('adm-waNumber').value||'').trim(),emailReplyTo:(document.getElementById('adm-emailReplyTo').value||'').trim(),postSender:(document.getElementById('adm-postSender').value||'').trim()};setDb(x,false);toast('Kommunikationseinstellungen gespeichert.')};
    var grid=main.querySelector('.ux-admin-grid');if(grid)grid.appendChild(card);else main.appendChild(card)
  }
  function enhance(){install();enhanceInvoice();addDeliverySettings();document.documentElement.setAttribute('data-sh-quality','v12-160')}
  var queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;enhance()})}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});enhance();
  window.SHP_V12={releaseInvoice:releaseInvoice,prepareDelivery:prepareDelivery,confirmDelivery:confirmDelivery,cancelDelivery:cancelDelivery,pending:pending,enhance:enhance};
})();
