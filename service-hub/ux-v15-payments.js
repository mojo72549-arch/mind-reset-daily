(function(){
  'use strict';
  var BUILD='20260906-v15-payments1';
  var DB_STORE='shp_db',META_STORE='shp_invoice_payment_meta',SESSION='shp_session';
  var scheduled=false;
  var STAGES=['Keine','Zahlungserinnerung','1. Mahnung','2. Mahnung','Letzte Mahnung / Klärung'];

  function read(storage,key,fallback){try{var v=JSON.parse(storage.getItem(key)||'null');return v==null?fallback:v}catch(e){return fallback}}
  function write(storage,key,value){try{storage.setItem(key,JSON.stringify(value));return true}catch(e){return false}}
  function db(){return read(localStorage,DB_STORE,{customers:[],invoices:[]})}
  function meta(){return read(localStorage,META_STORE,{})}
  function session(){return read(sessionStorage,SESSION,null)}
  function isOffice(){var s=session();return !!(s&&String(s.user||'').toLowerCase()==='annette')}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(ch){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}
  function money(v){return(+v||0).toFixed(2).replace('.',',')+' €'}
  function customerMap(data){var out={};(data.customers||[]).forEach(function(c){out[c.id]=c});return out}
  function parseDate(v){
    var s=String(v||'').trim(),m,d;
    m=s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);if(m){d=new Date(+m[3],+m[2]-1,+m[1]);return isNaN(d.getTime())?null:d}
    m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(m){d=new Date(+m[1],+m[2]-1,+m[3]);return isNaN(d.getTime())?null:d}
    d=new Date(s);return isNaN(d.getTime())?null:d;
  }
  function startOfDay(d){var x=new Date(d);x.setHours(0,0,0,0);return x}
  function paymentState(iv){
    var s=String(iv&&iv.status||'');
    if(/storniert/i.test(s))return{key:'cancelled',label:'Storniert',className:'is-muted'};
    if(/bezahlt/i.test(s)&&!/teilbezahlt/i.test(s))return{key:'paid',label:'Bezahlt',className:'is-paid'};
    if(/teilbezahlt/i.test(s))return{key:'partial',label:'Teilbezahlt',className:'is-partial'};
    var due=parseDate(iv&&iv.due),today=startOfDay(new Date());
    if(/überfällig/i.test(s)||(due&&startOfDay(due)<today))return{key:'overdue',label:'Überfällig',className:'is-overdue'};
    if(/versendet/i.test(s))return{key:'sent',label:'Versendet / offen',className:'is-open'};
    return{key:'open',label:'Offen',className:'is-open'};
  }
  function daysLate(iv){var due=parseDate(iv&&iv.due);if(!due)return 0;var diff=startOfDay(new Date()).getTime()-startOfDay(due).getTime();return diff>0?Math.floor(diff/86400000):0}
  function invoiceMeta(id){var m=meta();return m[String(id)]||{stage:'Keine',history:[]}}
  function stage(iv){var m=invoiceMeta(iv.id);return STAGES.indexOf(m.stage)>=0?m.stage:'Keine'}
  function invoiceByNo(data,no){return(data.invoices||[]).find(function(iv){return String(iv.no||'')===String(no||'')})||null}
  function currentInvoice(data){
    var main=document.querySelector('main.shell'),h=main&&main.querySelector('h2');if(!h)return null;
    var m=String(h.textContent||'').match(/Rechnung\s+(\d+)/i);return m?invoiceByNo(data,m[1]):null;
  }
  function currentUser(){var s=session();return s&&s.user?s.user:'System'}
  function saveStage(id){
    if(!isOffice())return false;
    var select=document.getElementById('crm-payment-stage-'+id);if(!select)return false;
    var value=select.value;if(STAGES.indexOf(value)<0)value='Keine';
    var all=meta(),key=String(id),old=all[key]||{stage:'Keine',history:[]};
    if(!Array.isArray(old.history))old.history=[];
    if(old.stage!==value){old.history.push({at:new Date().toLocaleString('de-DE'),by:currentUser(),text:'Eskalation '+(old.stage||'Keine')+' → '+value});}
    old.stage=value;old.updatedAt=new Date().toLocaleString('de-DE');old.updatedBy=currentUser();all[key]=old;
    write(localStorage,META_STORE,all);enhance(true);return true;
  }
  function stats(data){
    var out={paid:0,open:0,overdue:0,reminders:0,openAmount:0,overdueAmount:0};
    (data.invoices||[]).forEach(function(iv){var p=paymentState(iv),st=stage(iv);if(p.key==='paid')out.paid++;else if(p.key!=='cancelled'){out.open++;out.openAmount+=(+iv.gross||0)}if(p.key==='overdue'){out.overdue++;out.overdueAmount+=(+iv.gross||0)}if(st!=='Keine'&&p.key!=='paid'&&p.key!=='cancelled')out.reminders++});
    return out;
  }
  function metric(label,value,hint,cls){return'<div class="crm-payment-metric '+(cls||'')+'"><span>'+esc(label)+'</span><b>'+esc(value)+'</b><small>'+esc(hint)+'</small></div>'}
  function overdueRows(data,limit){
    var customers=customerMap(data);
    return(data.invoices||[]).filter(function(iv){return paymentState(iv).key==='overdue'}).sort(function(a,b){return daysLate(b)-daysLate(a)}).slice(0,limit||3).map(function(iv){var c=customers[iv.customerId]||{},st=stage(iv),late=daysLate(iv);return'<button type="button" class="crm-payment-row" onclick="SH.openInvoice('+Number(iv.id)+')"><span><b>Rechnung '+esc(iv.no)+'</b><small>'+esc(c.name||'Kunde')+' · fällig '+esc(iv.due||'–')+(late?' · '+late+' Tage':'')+'</small></span><span><b>'+money(iv.gross)+'</b><small>'+esc(st==='Keine'?'Noch keine Mahnstufe':st)+'</small></span><span class="crm-payment-chevron">›</span></button>'}).join('')
  }
  function renderHome(data){
    if(!isOffice())return;
    var root=document.querySelector('.crm-start-slim-v12');if(!root)return;
    var old=root.querySelector('.crm-payment-monitor-v15');if(old)old.remove();
    var grid=root.querySelector('.crm-start-status-grid');if(!grid)return;
    var s=stats(data),rows=overdueRows(data,3);
    var box=document.createElement('section');box.className='crm-payment-monitor-v15';box.dataset.build=BUILD;
    box.innerHTML='<div class="crm-payment-head"><div><span>Zahlungsmonitor</span><h2>Zahlungen & Eskalation</h2></div><button type="button" onclick="SH.go(\'invoices\')">Alle Rechnungen</button></div><div class="crm-payment-metrics">'+metric('Bezahlt',s.paid,'erledigt','is-paid')+metric('Offen',s.open,money(s.openAmount),'is-open')+metric('Überfällig',s.overdue,money(s.overdueAmount),'is-overdue')+metric('Mahnung aktiv',s.reminders,'in Bearbeitung','is-reminder')+'</div>'+(rows?'<div class="crm-payment-list"><h3>Handlungsbedarf</h3>'+rows+'</div>':'<div class="crm-payment-empty">Keine überfälligen Rechnungen.</div>');
    grid.insertAdjacentElement('afterend',box);
  }
  function renderInvoices(data){
    if(!isOffice())return;
    var main=document.querySelector('main.shell'),h=main&&main.querySelector('h2');if(!main||!h||String(h.textContent||'').trim()!=='Rechnungen')return;
    var old=main.querySelector('.crm-payment-summary-v15');if(old)old.remove();
    var s=stats(data),table=main.querySelector('.table.card');if(!table)return;
    var box=document.createElement('section');box.className='crm-payment-summary-v15';box.dataset.build=BUILD;
    box.innerHTML='<div><span>Zahlungsübersicht</span><b>'+s.paid+' bezahlt</b></div><div><span>Offen</span><b>'+s.open+' · '+money(s.openAmount)+'</b></div><div class="is-overdue"><span>Überfällig</span><b>'+s.overdue+' · '+money(s.overdueAmount)+'</b></div><div><span>Mahnung aktiv</span><b>'+s.reminders+'</b></div>';
    table.insertAdjacentElement('beforebegin',box);
  }
  function renderInvoice(data){
    if(!isOffice())return;
    var main=document.querySelector('main.shell');if(!main)return;
    var iv=currentInvoice(data);if(!iv)return;
    var old=main.querySelector('.crm-payment-escalation-v15');if(old)old.remove();
    var state=paymentState(iv),m=invoiceMeta(iv.id),st=stage(iv),late=daysLate(iv);
    var options=STAGES.map(function(x){return'<option'+(x===st?' selected':'')+'>'+esc(x)+'</option>'}).join('');
    var history=(m.history||[]).slice(-3).reverse().map(function(x){return'<div><b>'+esc(x.at)+'</b> · '+esc(x.by)+'<br>'+esc(x.text)+'</div>'}).join('');
    var box=document.createElement('section');box.className='card crm-payment-escalation-v15';box.dataset.build=BUILD;
    box.innerHTML='<div class="crm-payment-detail-head"><div><span>Zahlungsüberwachung</span><h3>Zahlung & Eskalation</h3></div><span class="crm-payment-state '+state.className+'">'+esc(state.label)+'</span></div><div class="crm-payment-detail-grid"><div><small>Fällig</small><b>'+esc(iv.due||'–')+'</b><em>'+(late?late+' Tage überfällig':'im Zahlungsziel / erledigt')+'</em></div><div class="crm-payment-stage-field"><label for="crm-payment-stage-'+iv.id+'">Eskalationsstufe</label><select id="crm-payment-stage-'+iv.id+'">'+options+'</select><button type="button" class="btn primary" onclick="SHP_PAYMENTS.saveStage('+Number(iv.id)+')">Eskalation speichern</button></div></div><p class="crm-payment-note">Ob bezahlt, teilbezahlt, offen oder überfällig wird weiterhin über den bestehenden Rechnungsstatus oben gepflegt. Diese Erweiterung ergänzt nur die Mahn-/Eskalationsstufe.</p>'+(history?'<div class="crm-payment-history">'+history+'</div>':'');
    var topGrid=main.querySelector('.grid.g2');if(topGrid)topGrid.insertAdjacentElement('afterend',box);else main.appendChild(box);
  }
  function enhance(force){
    if(!isOffice())return;
    var data=db();
    renderHome(data);renderInvoices(data);renderInvoice(data);
    document.documentElement.dataset.shPaymentsBuild=BUILD;
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;enhance(false)})}
  new MutationObserver(schedule).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  window.SHP_PAYMENTS={build:BUILD,saveStage:saveStage,paymentState:paymentState,stats:stats,enhance:enhance};
  schedule();
})();
