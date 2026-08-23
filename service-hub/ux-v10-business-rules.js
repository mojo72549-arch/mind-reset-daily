(function(){
  'use strict';
  var STORE='shp_db',UNDO='shp_undo_stack';
  var wrapped=false,adminWrapped=false;

  function readDb(){try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch(e){return null}}
  function setDb(db){if(window.SHP_INTERNAL&&window.SHP_INTERNAL.setDb)window.SHP_INTERNAL.setDb(db);else localStorage.setItem(STORE,JSON.stringify(db))}
  function render(){if(window.SHP_INTERNAL&&window.SHP_INTERNAL.render)window.SHP_INTERNAL.render()}
  function session(){try{return JSON.parse(sessionStorage.getItem('shp_session')||'null')}catch(e){return null}}
  function role(){var s=session();return window.SHP_CORE?window.SHP_CORE.normalizeRole(s&&s.user):String(s&&s.user||'')}
  function allowed(cap){return !window.SHP_CORE||window.SHP_CORE.can(role(),cap)}
  function deny(){window.alert('Diese Funktion ist für Büro / Administration vorgesehen.');return false}
  function trim(v){return String(v==null?'':v).trim()}
  function norm(v){return trim(v).toLocaleLowerCase('de-DE').replace(/\s+/g,' ')}
  function normPhone(v){return trim(v).replace(/[^0-9]/g,'')}
  function validEmail(v){v=trim(v);return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(v)}
  function validPhone(v){return normPhone(v).length>=7}
  function channel(v){var x=norm(v).replace('email','e-mail');if(x==='whatsapp')return'WhatsApp';if(x==='e-mail')return'E-Mail';if(x==='post')return'Post';return''}
  function fail(message){window.alert(message);return false}
  function pushAudit(db,text){db.settings=db.settings||{};db.settings.audit=db.settings.audit||[];db.settings.audit.unshift({at:new Date().toLocaleString('de-DE'),by:(session()||{}).user||'System',text:text});if(db.settings.audit.length>100)db.settings.audit.length=100}
  function remember(before,label){try{var s=JSON.parse(sessionStorage.getItem(UNDO)||'[]');s.push({snapshot:before,label:label,at:Date.now()});sessionStorage.setItem(UNDO,JSON.stringify(s.slice(-10)))}catch(e){}}
  function validationCustomer(db,c,ignoreId){
    if(!trim(c.name))return'Kundenname ist ein Pflichtfeld.';
    if(!trim(c.address))return'Adresse ist ein Pflichtfeld.';
    var ch=channel(c.preferredChannel);if(!ch)return'Bevorzugter Versandkanal muss WhatsApp, E-Mail oder Post sein.';
    if(trim(c.email)&&!validEmail(c.email))return'Die E-Mail-Adresse ist ungültig.';
    if(ch==='E-Mail'&&!validEmail(c.email))return'Für den bevorzugten Kanal E-Mail wird eine gültige E-Mail-Adresse benötigt.';
    if(ch==='WhatsApp'&&!validPhone(c.phone))return'Für den bevorzugten Kanal WhatsApp wird eine gültige Telefonnummer benötigt.';
    var dup=(db.customers||[]).find(function(x){
      if(String(x.id)===String(ignoreId||''))return false;
      return norm(x.name)===norm(c.name)&&norm(x.address)===norm(c.address);
    });
    if(dup)return'Dieser Kunde existiert bereits ('+dup.name+'). Bitte den vorhandenen Kunden öffnen.';
    return'';
  }
  function canonicalCustomer(input){input.preferredChannel=channel(input.preferredChannel)||trim(input.preferredChannel);return input}
  function promptCustomer(base,editing){
    var name=prompt('Kundenname',editing?base.name:'');if(name===null)return null;
    var address=prompt('Adresse',editing?base.address:'');if(address===null)return null;
    var contact=prompt('Ansprechpartner',editing?base.contact:'')||'';
    var phone=prompt('Telefon',editing?base.phone:'')||'';
    var email=prompt('E-Mail',editing?base.email:'')||'';
    var rateRaw=prompt('Stundensatz für diesen Kunden',String(editing?base.hourlyRate:(base.defaultRate||70)));if(rateRaw===null)return null;
    var rate=parseFloat(String(rateRaw).replace(',','.'));if(!isFinite(rate)||rate<0){fail('Stundensatz muss eine gültige Zahl ab 0 sein.');return false}
    var preferred=prompt('Bevorzugter Kanal: WhatsApp / E-Mail / Post',editing?base.preferredChannel:'E-Mail');if(preferred===null)return null;
    return canonicalCustomer({name:trim(name),address:trim(address),contact:trim(contact),phone:trim(phone),email:trim(email),hourlyRate:rate,preferredChannel:trim(preferred)});
  }
  function newCustomer(){
    if(!allowed('manageCustomers'))return deny();var db=readDb();if(!db)return;
    var before=localStorage.getItem(STORE),input=promptCustomer({defaultRate:(db.settings||{}).defaultHourlyRate||70},false);if(input===null||input===false)return;
    var err=validationCustomer(db,input,null);if(err)return fail(err);
    var id=Date.now();while((db.customers||[]).some(function(c){return String(c.id)===String(id)}))id++;
    db.customers.push({id:id,name:input.name,contact:input.contact,phone:input.phone,email:input.email,address:input.address,hourlyRate:input.hourlyRate,preferredChannel:input.preferredChannel,priceOverrides:{},serviceInterval:'',nextService:''});
    pushAudit(db,'Kunde '+input.name+' angelegt');setDb(db);remember(before,'Kunde angelegt');
    if(window.SHP_INTERNAL){if(window.SHP_INTERNAL.setSelectedCustomer)window.SHP_INTERNAL.setSelectedCustomer(id);window.SHP_INTERNAL.setTab('customer');render()}else location.reload();
  }
  function editCustomer(id){
    if(!allowed('manageCustomers'))return deny();var db=readDb(),c=(db.customers||[]).find(function(x){return String(x.id)===String(id)});if(!c)return fail('Kunde wurde nicht gefunden.');
    var before=localStorage.getItem(STORE),input=promptCustomer(c,true);if(input===null||input===false)return;
    var candidate=Object.assign({},c,input),err=validationCustomer(db,candidate,c.id);if(err)return fail(err);
    Object.assign(c,input);pushAudit(db,'Stammdaten '+c.name+' geändert');setDb(db);remember(before,'Kundendaten geändert');render();
  }
  function chooseCustomer(db,cid){
    if(cid!=null&&cid!==''){return (db.customers||[]).find(function(c){return String(c.id)===String(cid)})||null}
    if(!(db.customers||[]).length)return null;
    var names=db.customers.map(function(c){return c.name}).join('\n');
    var answer=prompt('Kunde für Auftrag auswählen (Kundenname):\n\n'+names,db.customers[0].name);if(answer===null)return false;
    var n=norm(answer),matches=db.customers.filter(function(c){return norm(c.name)===n});return matches.length===1?matches[0]:null;
  }
  function newOrder(cid){
    if(!allowed('manageOrders'))return deny();var db=readDb();if(!db)return;
    if(!(db.customers||[]).length)return fail('Auftrag kann nicht angelegt werden: Zuerst muss ein Kunde vorhanden sein.');
    var c=chooseCustomer(db,cid);if(c===false)return;if(!c)return fail('Auftrag kann nicht angelegt werden: Der ausgewählte Kunde wurde nicht gefunden.');
    var title=prompt('Auftrag für '+c.name);if(title===null)return;title=trim(title);if(!title)return fail('Auftragsbezeichnung ist ein Pflichtfeld.');
    var type=prompt('Art','Wartung');if(type===null)return;type=trim(type);if(!type)return fail('Auftragsart ist ein Pflichtfeld.');
    var before=localStorage.getItem(STORE),id=Date.now();while((db.orders||[]).some(function(o){return String(o.id)===String(id)}))id++;
    var number='A-'+new Date().getFullYear()+'-'+String(100+(db.orders||[]).length+1);
    db.orders.push({id:id,no:number,customerId:c.id,title:title,type:type,date:new Date().toLocaleDateString('de-DE'),status:'Zugewiesen',assignedTo:'Dome'});
    pushAudit(db,'Auftrag '+title+' für '+c.name+' angelegt');setDb(db);remember(before,'Auftrag angelegt');
    if(window.SHP_INTERNAL){window.SHP_INTERNAL.setSelectedOrder(id);window.SHP_INTERNAL.setTab('report');render()}else location.reload();
  }
  function wrapAdmin(){
    if(adminWrapped||!window.SHP_V6||typeof window.SHP_V6.saveAdminSettings!=='function')return;adminWrapped=true;
    var original=window.SHP_V6.saveAdminSettings;
    window.SHP_V6.saveAdminSettings=function(){
      var wa=trim((document.getElementById('adm-waNumber')||{}).value),mail=trim((document.getElementById('adm-emailReplyTo')||{}).value);
      if(wa&&!validPhone(wa))return fail('WhatsApp-Geschäftsnummer ist ungültig.');
      if(mail&&!validEmail(mail))return fail('E-Mail / Antwortadresse ist ungültig.');
      return original.apply(window.SHP_V6,arguments);
    };
  }
  function hardenDelivery(){
    if(!window.SHP_V10||window.SHP_V10.__businessWrapped)return;window.SHP_V10.__businessWrapped=true;
    var original=window.SHP_V10.prepareDelivery;
    window.SHP_V10.prepareDelivery=function(ch){
      var db=readDb(),id=window.SHP_INTERNAL&&window.SHP_INTERNAL.getSelectedInvoice?window.SHP_INTERNAL.getSelectedInvoice():null,iv=(db&&db.invoices||[]).find(function(x){return String(x.id)===String(id)});
      if(iv&&iv.status==='Storniert')return fail('Stornierte Rechnungen können nicht versendet werden.');
      if(['WhatsApp','E-Mail','Post'].indexOf(ch)<0)return fail('Unbekannter Versandkanal.');
      return original.apply(window.SHP_V10,arguments);
    };
    if(window.SH){
      window.SH.sendInvoice=function(ch){return window.SHP_V10.prepareDelivery(ch)};
      window.SH.sendInvoicePreferred=function(){var db2=readDb(),id2=window.SHP_INTERNAL&&window.SHP_INTERNAL.getSelectedInvoice?window.SHP_INTERNAL.getSelectedInvoice():null,iv2=(db2&&db2.invoices||[]).find(function(x){return String(x.id)===String(id2)}),c=iv2&&(db2.customers||[]).find(function(x){return String(x.id)===String(iv2.customerId)});return window.SHP_V10.prepareDelivery(c&&c.preferredChannel||'E-Mail')};
    }
  }
  function wrap(){
    if(wrapped||!window.SH)return;wrapped=true;
    window.SH.newCustomer=newCustomer;window.SH.editCustomer=editCustomer;window.SH.newOrder=newOrder;
  }
  function enhance(){wrap();wrapAdmin();hardenDelivery()}
  var scheduled=false;function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;enhance()})}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});enhance();
  window.SHP_BUSINESS_RULES={validateCustomer:validationCustomer,validEmail:validEmail,validPhone:validPhone,channel:channel,enhance:enhance};
})();
