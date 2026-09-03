(function(){
  'use strict';
  if(!window.SH)return;

  var STORE='shp_db';
  var MODAL_ID='shp-app-modal';
  var originals={};
  var names=['newCustomer','editCustomer','newOrder','addMaterial','addMeasurement','removeReportLine','removeMaterial','removeMeasurement','addCatalogItem','editCatalogItem','editCustomerPricing','invoiceFromReport'];
  names.forEach(function(name){if(typeof window.SH[name]==='function')originals[name]=window.SH[name];});

  function readDb(){try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch(e){return null}}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(ch){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}
  function euro(v){return Number(v||0).toFixed(2).replace('.',',')+' €'}
  function customer(db,id){return db&&(db.customers||[]).find(function(c){return String(c.id)===String(id)})}
  function catalog(db,id){return db&&db.settings&&(db.settings.catalog||[]).find(function(x){return String(x.id)===String(id)})}
  function currentOrder(db){
    var h=document.querySelector('main h2'),t=(h&&h.textContent||'').trim();
    if(t.indexOf('Rapport ')!==0)return null;
    var no=t.slice(8).trim();return (db&&db.orders||[]).find(function(o){return String(o.no)===no})||null;
  }
  function currentReport(db){var o=currentOrder(db);return o?(db.reports||[]).find(function(r){return String(r.orderId)===String(o.id)})||null:null}

  function ensureStyle(){
    if(document.getElementById('shp-modal-style'))return;
    var style=document.createElement('style');style.id='shp-modal-style';
    style.textContent='#'+MODAL_ID+'{position:fixed;inset:0;z-index:10000;background:rgba(4,18,31,.56);display:flex;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(3px)}html.shp-modal-open,html.shp-modal-open body{overflow:hidden}.shp-modal-card{width:min(720px,100%);max-height:min(88vh,900px);overflow:auto;background:#fff;color:#13283a;border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,.35);border:1px solid #d8e2eb}.shp-modal-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:20px 22px 12px;border-bottom:1px solid #e5ebf0;position:sticky;top:0;background:#fff;z-index:2}.shp-modal-head h2{font-size:21px;margin:0 0 4px}.shp-modal-head p{margin:0;color:#657482;font-size:13px}.shp-modal-close{border:0;background:#eef3f7;color:#13283a;border-radius:10px;width:38px;height:38px;font-size:22px;line-height:1;cursor:pointer}.shp-modal-body{padding:18px 22px 8px}.shp-modal-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.shp-modal-field{margin:0 0 13px}.shp-modal-field.full{grid-column:1/-1}.shp-modal-field label{display:block;font-weight:750;font-size:13px;margin-bottom:5px}.shp-modal-field input,.shp-modal-field select,.shp-modal-field textarea{width:100%;border:1px solid #c7d4df;border-radius:10px;padding:10px 11px;background:#fff;color:#13283a;box-sizing:border-box}.shp-modal-field small{display:block;color:#657482;margin-top:5px}.shp-modal-section{font-size:15px;font-weight:800;margin:8px 0 12px;padding-top:8px;border-top:1px solid #e7edf2}.shp-modal-error{display:none;background:#fde8e8;color:#8d2222;border:1px solid #f2bebe;border-radius:10px;padding:10px 12px;margin:0 0 12px}.shp-modal-error.show{display:block}.shp-modal-actions{display:flex;justify-content:flex-end;gap:9px;padding:14px 22px 20px;position:sticky;bottom:0;background:#fff;border-top:1px solid #e5ebf0}.shp-modal-actions button{border:0;border-radius:10px;padding:10px 15px;font-weight:750;cursor:pointer}.shp-modal-cancel{background:#e9eff4;color:#173047}.shp-modal-save{background:#1769cf;color:#fff}.shp-modal-danger{background:#b83434;color:#fff}.shp-modal-check{display:flex;align-items:center;gap:9px}.shp-modal-check input{width:auto}.shp-modal-note{background:#eef6ff;border:1px solid #c8dcf5;border-radius:10px;padding:10px 12px;margin-bottom:14px;font-size:13px}@media(max-width:650px){#'+MODAL_ID+'{padding:8px;align-items:flex-end}.shp-modal-card{max-height:94vh;border-radius:18px 18px 10px 10px}.shp-modal-grid{grid-template-columns:1fr}.shp-modal-head{padding:16px 16px 10px}.shp-modal-body{padding:15px 16px 6px}.shp-modal-actions{padding:12px 16px 16px}.shp-modal-actions button{flex:1}}';
    document.head.appendChild(style);
  }

  function closeModal(){var old=document.getElementById(MODAL_ID);if(old)old.remove();document.documentElement.classList.remove('shp-modal-open')}
  function showError(box,msg){box.textContent=msg;box.classList.add('show')}

  function fieldHtml(f){
    if(f.type==='section')return '<div class="shp-modal-section shp-modal-field full">'+esc(f.label)+'</div>';
    if(f.type==='note')return '<div class="shp-modal-note shp-modal-field full">'+esc(f.label)+'</div>';
    if(f.type==='checkbox')return '<div class="shp-modal-field '+(f.full?'full':'')+'"><label class="shp-modal-check"><input type="checkbox" name="'+esc(f.name)+'" '+(f.value?'checked':'')+'> <span>'+esc(f.label)+'</span></label>'+(f.hint?'<small>'+esc(f.hint)+'</small>':'')+'</div>';
    var attrs=' name="'+esc(f.name)+'" id="shp-field-'+esc(f.name)+'"';
    if(f.type==='number')attrs+=' type="number" step="'+esc(f.step||'0.01')+'"'+(f.min!=null?' min="'+esc(f.min)+'"':'');
    else if(f.type==='date')attrs+=' type="date"';
    else if(f.type==='email')attrs+=' type="email"';
    else if(f.type==='tel')attrs+=' type="tel"';
    else attrs+=' type="text"';
    if(f.required)attrs+=' required';if(f.placeholder)attrs+=' placeholder="'+esc(f.placeholder)+'"';
    var control;
    if(f.type==='select')control='<select'+attrs+'>'+f.options.map(function(o){var val=typeof o==='string'?o:o.value,label=typeof o==='string'?o:o.label;return '<option value="'+esc(val)+'" '+(String(val)===String(f.value)?'selected':'')+'>'+esc(label)+'</option>'}).join('')+'</select>';
    else if(f.type==='textarea')control='<textarea'+attrs+'>'+esc(f.value||'')+'</textarea>';
    else control='<input'+attrs+' value="'+esc(f.value==null?'':f.value)+'">';
    return '<div class="shp-modal-field '+(f.full?'full':'')+'"><label for="shp-field-'+esc(f.name)+'">'+esc(f.label)+'</label>'+control+(f.hint?'<small>'+esc(f.hint)+'</small>':'')+'</div>';
  }

  function valuesFrom(form,fields){var out={};fields.forEach(function(f){if(!f.name)return;var el=form.elements[f.name];if(!el)return;out[f.name]=f.type==='checkbox'?!!el.checked:el.value});return out}

  function openForm(opts){
    ensureStyle();closeModal();
    var overlay=document.createElement('div');overlay.id=MODAL_ID;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label',opts.title||'Dialog');
    overlay.innerHTML='<div class="shp-modal-card"><div class="shp-modal-head"><div><h2>'+esc(opts.title||'Bearbeiten')+'</h2>'+(opts.subtitle?'<p>'+esc(opts.subtitle)+'</p>':'')+'</div><button type="button" class="shp-modal-close" aria-label="Dialog schließen">×</button></div><form><div class="shp-modal-body"><div class="shp-modal-error" role="alert"></div><div class="shp-modal-grid">'+(opts.fields||[]).map(fieldHtml).join('')+'</div></div><div class="shp-modal-actions"><button type="button" class="shp-modal-cancel">Abbrechen</button><button type="submit" class="'+(opts.danger?'shp-modal-danger':'shp-modal-save')+'">'+esc(opts.submitLabel||'Speichern')+'</button></div></form></div>';
    document.body.appendChild(overlay);document.documentElement.classList.add('shp-modal-open');
    var form=overlay.querySelector('form'),error=overlay.querySelector('.shp-modal-error');
    function cancel(){closeModal();if(typeof opts.onCancel==='function')opts.onCancel()}
    overlay.querySelector('.shp-modal-close').onclick=cancel;overlay.querySelector('.shp-modal-cancel').onclick=cancel;
    overlay.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();cancel()}});
    form.addEventListener('submit',function(e){
      e.preventDefault();error.classList.remove('show');error.textContent='';
      var vals=valuesFrom(form,opts.fields||[]),msg=opts.validate?opts.validate(vals):'';
      if(msg){showError(error,msg);return}
      try{var ok=opts.onSubmit?opts.onSubmit(vals):true;if(ok===false)return;closeModal()}catch(err){console.error(err);showError(error,'Die Änderung konnte nicht gespeichert werden. Bitte erneut versuchen.')}
    });
    requestAnimationFrame(function(){var first=overlay.querySelector('input:not([type="checkbox"]),select,textarea');if(first)first.focus()});
    return overlay;
  }

  function openConfirm(opts){return openForm({title:opts.title||'Bitte bestätigen',subtitle:opts.subtitle||'',danger:!!opts.danger,submitLabel:opts.submitLabel||'Bestätigen',fields:[{type:'note',label:opts.text||'Möchten Sie fortfahren?'}],onSubmit:function(){return opts.onConfirm?opts.onConfirm():true}})}

  function runWithResponses(fn,args,prompts,confirms){
    if(typeof fn!=='function')return;
    var oldPrompt=window.prompt,oldConfirm=window.confirm;
    var ps=(prompts||[]).slice(),cs=(confirms||[]).slice();
    window.prompt=function(){return ps.length?ps.shift():null};
    window.confirm=function(){return cs.length?!!cs.shift():false};
    try{return fn.apply(window.SH,args||[])}finally{window.prompt=oldPrompt;window.confirm=oldConfirm}
  }
  function validEmail(v){return !v||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim())}
  function digits(v){return String(v||'').replace(/\D/g,'')}
  function nonNegative(v){var n=Number(String(v).replace(',','.'));return Number.isFinite(n)&&n>=0}
  function positive(v){var n=Number(String(v).replace(',','.'));return Number.isFinite(n)&&n>0}

  if(originals.newCustomer)window.SH.newCustomer=function(){
    var db=readDb();
    openForm({title:'Kunde anlegen',subtitle:'Alle Kundendaten in einem Schritt erfassen.',submitLabel:'Kunde anlegen',fields:[
      {name:'name',label:'Kundenname',required:true,full:true},{name:'address',label:'Adresse',required:true,full:true},{name:'contact',label:'Ansprechpartner'},{name:'phone',label:'Telefon',type:'tel'},{name:'email',label:'E-Mail',type:'email'},{name:'rate',label:'Stundensatz €/h',type:'number',min:'0',value:db&&db.settings?db.settings.defaultHourlyRate:70},{name:'channel',label:'Bevorzugter Kommunikationskanal',type:'select',value:'E-Mail',options:['WhatsApp','E-Mail','Post']}
    ],validate:function(v){if(!v.name.trim())return'Bitte einen Kundennamen eingeben.';if(!v.address.trim())return'Bitte eine Adresse eingeben.';if(!validEmail(v.email))return'Bitte eine gültige E-Mail-Adresse eingeben.';if(!nonNegative(v.rate))return'Der Stundensatz muss 0 oder größer sein.';if(v.channel==='WhatsApp'&&digits(v.phone).length<7)return'Für WhatsApp wird eine gültige Telefonnummer benötigt.';if(v.channel==='E-Mail'&&!v.email.trim())return'Für E-Mail wird eine E-Mail-Adresse benötigt.';return''},onSubmit:function(v){return runWithResponses(originals.newCustomer,[],[v.name.trim(),v.address.trim(),v.contact.trim(),v.phone.trim(),v.email.trim(),String(v.rate).replace(',','.'),v.channel],[])}});
  };

  if(originals.editCustomer)window.SH.editCustomer=function(id){
    var db=readDb(),c=customer(db,id);if(!c)return;
    openForm({title:'Stammdaten bearbeiten',subtitle:c.name,submitLabel:'Stammdaten speichern',fields:[
      {name:'name',label:'Kundenname',required:true,full:true,value:c.name},{name:'contact',label:'Ansprechpartner',value:c.contact||''},{name:'phone',label:'Telefon',type:'tel',value:c.phone||''},{name:'email',label:'E-Mail',type:'email',value:c.email||''},{name:'address',label:'Adresse',required:true,full:true,value:c.address||''},{name:'channel',label:'Bevorzugter Kommunikationskanal',type:'select',value:c.preferredChannel||'E-Mail',options:['WhatsApp','E-Mail','Post']},{name:'serviceInterval',label:'Serviceintervall',value:c.serviceInterval||'',placeholder:'z. B. 12 Monate'},{name:'nextService',label:'Nächster Service',type:'date',value:c.nextService||''}
    ],validate:function(v){if(!v.name.trim())return'Bitte einen Kundennamen eingeben.';if(!v.address.trim())return'Bitte eine Adresse eingeben.';if(!validEmail(v.email))return'Bitte eine gültige E-Mail-Adresse eingeben.';if(v.channel==='WhatsApp'&&digits(v.phone).length<7)return'Für WhatsApp wird eine gültige Telefonnummer benötigt.';if(v.channel==='E-Mail'&&!v.email.trim())return'Für E-Mail wird eine E-Mail-Adresse benötigt.';return''},onSubmit:function(v){return runWithResponses(originals.editCustomer,[id],[v.name.trim(),v.contact.trim(),v.phone.trim(),v.email.trim(),v.address.trim(),v.channel,v.serviceInterval.trim(),v.nextService],[])}});
  };

  if(originals.newOrder)window.SH.newOrder=function(cid){
    var db=readDb();if(!db||!(db.customers||[]).length){return originals.newOrder.apply(window.SH,arguments)}
    var fixed=cid!=null&&customer(db,cid),defaultId=fixed?fixed.id:db.customers[0].id;
    var fields=[];
    if(fixed)fields.push({type:'note',label:'Kunde: '+fixed.name});
    else fields.push({name:'customerId',label:'Kunde',type:'select',value:String(defaultId),options:db.customers.map(function(c){return{value:String(c.id),label:c.name}})});
    fields.push({name:'title',label:'Auftragsbezeichnung',required:true,full:true},{name:'type',label:'Auftragsart',type:'select',value:'Wartung',options:['Wartung','Rohrreinigung','TV-Kanaluntersuchung','Notdienst','Sanierung','Sonstiges']});
    openForm({title:'Auftrag anlegen',subtitle:'Der zugehörige Rapport wird danach sofort geöffnet.',submitLabel:'Auftrag anlegen',fields:fields,validate:function(v){if(!v.title.trim())return'Bitte eine Auftragsbezeichnung eingeben.';if(!v.type)return'Bitte eine Auftragsart auswählen.';return''},onSubmit:function(v){var selected=fixed?fixed.id:v.customerId;return runWithResponses(originals.newOrder,[selected],[v.title.trim(),v.type],[])}});
  };

  if(originals.addMaterial)window.SH.addMaterial=function(){
    openForm({title:'Material hinzufügen',submitLabel:'Material hinzufügen',fields:[{name:'name',label:'Material / Bezeichnung',required:true,full:true},{name:'qty',label:'Menge',type:'number',min:'0.01',step:'0.01',value:'1'},{name:'price',label:'Einzelpreis €',type:'number',min:'0',step:'0.01',value:'0'}],validate:function(v){if(!v.name.trim())return'Bitte eine Materialbezeichnung eingeben.';if(!positive(v.qty))return'Die Menge muss größer als 0 sein.';if(!nonNegative(v.price))return'Der Einzelpreis darf nicht negativ sein.';return''},onSubmit:function(v){return runWithResponses(originals.addMaterial,[],[v.name.trim(),String(v.qty).replace(',','.'),String(v.price).replace(',','.')],[])}});
  };

  if(originals.addMeasurement)window.SH.addMeasurement=function(){
    openForm({title:'Messwert hinzufügen',submitLabel:'Messwert hinzufügen',fields:[{name:'name',label:'Messwert / Prüfpunkt',required:true,full:true},{name:'value',label:'Wert'},{name:'unit',label:'Einheit'},{name:'ok',label:'Messwert ist in Ordnung',type:'checkbox',value:true,full:true}],validate:function(v){return v.name.trim()?'':'Bitte einen Prüfpunkt eingeben.'},onSubmit:function(v){return runWithResponses(originals.addMeasurement,[],[v.name.trim(),v.value.trim(),v.unit.trim()],[v.ok])}});
  };

  function wrapDelete(name,title,text){if(!originals[name])return;window.SH[name]=function(){var args=[].slice.call(arguments);openConfirm({title:title,text:text,danger:true,submitLabel:'Löschen',onConfirm:function(){return runWithResponses(originals[name],args,[],[true])}})}}
  wrapDelete('removeReportLine','Leistung löschen','Soll diese Leistung wirklich aus dem Rapport entfernt werden?');
  wrapDelete('removeMaterial','Material löschen','Soll dieses Material wirklich aus dem Rapport entfernt werden?');
  wrapDelete('removeMeasurement','Messwert löschen','Soll dieser Messwert wirklich entfernt werden?');

  if(originals.addCatalogItem)window.SH.addCatalogItem=function(){
    openForm({title:'Leistung anlegen',submitLabel:'Leistung anlegen',fields:[{name:'name',label:'Bezeichnung',required:true,full:true},{name:'unit',label:'Einheit',value:'Std.'},{name:'price',label:'Standardpreis €',type:'number',min:'0',step:'0.01',value:'0'}],validate:function(v){if(!v.name.trim())return'Bitte eine Bezeichnung eingeben.';if(!v.unit.trim())return'Bitte eine Einheit eingeben.';if(!nonNegative(v.price))return'Der Preis darf nicht negativ sein.';return''},onSubmit:function(v){return runWithResponses(originals.addCatalogItem,[],[v.name.trim(),v.unit.trim(),String(v.price).replace(',','.')],[])}});
  };

  if(originals.editCatalogItem)window.SH.editCatalogItem=function(id){
    var db=readDb(),it=catalog(db,id);if(!it)return;
    openForm({title:'Leistung bearbeiten',subtitle:it.name,submitLabel:'Änderungen speichern',fields:[{name:'name',label:'Bezeichnung',required:true,full:true,value:it.name},{name:'unit',label:'Einheit',value:it.unit||''},{name:'price',label:'Standardpreis €',type:'number',min:'0',step:'0.01',value:it.price},{name:'active',label:'Leistung ist aktiv',type:'checkbox',value:it.active!==false}],validate:function(v){if(!v.name.trim())return'Bitte eine Bezeichnung eingeben.';if(!v.unit.trim())return'Bitte eine Einheit eingeben.';if(!nonNegative(v.price))return'Der Preis darf nicht negativ sein.';return''},onSubmit:function(v){return runWithResponses(originals.editCatalogItem,[id],[v.name.trim(),v.unit.trim(),String(v.price).replace(',','.')],[v.active])}});
  };

  if(originals.editCustomerPricing)window.SH.editCustomerPricing=function(id){
    var db=readDb(),c=customer(db,id);if(!c)return;
    var cat=(db.settings&&db.settings.catalog||[]).filter(function(it){return it.active!==false});
    var fields=[{type:'note',label:'Hier werden nur Preis- und Konditionsdaten gepflegt. Kommunikationsdaten bleiben unverändert.'},{name:'rate',label:'Stundensatz €/h',type:'number',min:'0',step:'0.01',value:c.hourlyRate,full:true},{type:'section',label:'Kundenspezifische Leistungspreise'}];
    cat.forEach(function(it){var val=c.priceOverrides&&c.priceOverrides[it.id]!=null?c.priceOverrides[it.id]:'';fields.push({name:'price_'+it.id,label:it.name,type:'number',min:'0',step:'0.01',value:val,full:true,placeholder:'Standard '+euro(it.price),hint:'Leer lassen = Standardpreis '+euro(it.price)});});
    openForm({title:'Konditionen bearbeiten',subtitle:c.name,submitLabel:'Konditionen speichern',fields:fields,validate:function(v){if(!nonNegative(v.rate))return'Der Stundensatz muss 0 oder größer sein.';for(var i=0;i<cat.length;i++){var x=v['price_'+cat[i].id];if(x!==''&&!nonNegative(x))return'Kundenpreise dürfen nicht negativ sein.'}return''},onSubmit:function(v){var prompts=[String(v.rate).replace(',','.'),c.preferredChannel||'E-Mail'];cat.forEach(function(it){prompts.push(v['price_'+it.id]===''?'':String(v['price_'+it.id]).replace(',','.'))});return runWithResponses(originals.editCustomerPricing,[id],prompts,[])}});
  };

  if(originals.invoiceFromReport)window.SH.invoiceFromReport=function(){
    var db=readDb(),r=currentReport(db),args=[].slice.call(arguments);
    if(r&&r.status!=='Abgeschlossen'){
      openConfirm({title:'Rechnung vor Rapportabschluss?',text:'Der Rapport ist noch nicht abgeschlossen. Möchten Sie die Rechnung trotzdem erzeugen?',submitLabel:'Trotzdem erzeugen',onConfirm:function(){return runWithResponses(originals.invoiceFromReport,args,[],[true])}});return;
    }
    return originals.invoiceFromReport.apply(window.SH,args);
  };

  window.alert=function(message){openForm({title:'Hinweis',submitLabel:'Verstanden',fields:[{type:'note',label:String(message||'')}],onSubmit:function(){return true}})};
  window.SHP_APP_DIALOGS={version:'20260903-v9-2',close:closeModal,openForm:openForm,readDb:readDb};
})();
