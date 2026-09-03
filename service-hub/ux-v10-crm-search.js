(function(){
  'use strict';
  var STORE='shp_db',CARD_ID='shp-crm-search',STYLE_ID='shp-crm-search-style',DRAWER_ID='shp-crm-customer-drawer';
  var lastQuery='';

  function session(){try{return JSON.parse(sessionStorage.getItem('shp_session')||'null')}catch(e){return null}}
  function user(){return String((session()||{}).user||'').toLowerCase()}
  function eligible(){var u=user();return u==='annette'||u==='dome'}
  function readDb(){try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch(e){return null}}
  function setDb(db){if(window.SHP_INTERNAL&&window.SHP_INTERNAL.setDb)window.SHP_INTERNAL.setDb(db);else localStorage.setItem(STORE,JSON.stringify(db))}
  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
  function norm(v){
    var s=String(v==null?'':v).trim().toLowerCase().replace(/ß/g,'ss');
    try{s=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'')}catch(e){}
    return s.replace(/[^a-z0-9@.+-]+/g,' ').replace(/\s+/g,' ').trim();
  }
  function ensureCustomerNumbers(){
    var db=readDb();if(!db||!Array.isArray(db.customers))return false;
    var max=0,changed=false;
    db.customers.forEach(function(c){var m=String(c.customerNo||'').match(/^K-(\d+)$/i),n=m?parseInt(m[1],10):0;if(n>max)max=n});
    db.customers.forEach(function(c){if(!/^K-\d+$/i.test(String(c.customerNo||''))){max+=1;c.customerNo='K-'+String(max).padStart(5,'0');changed=true}});
    if(changed)setDb(db);return changed;
  }
  function customerOrders(db,cid){
    return (db.orders||[]).filter(function(o){return String(o.customerId)===String(cid)}).sort(function(a,b){return (+b.id||0)-(+a.id||0)});
  }
  function searchableText(db,c){
    var orders=customerOrders(db,c.id),parts=[c.customerNo,c.name,c.contact,c.phone,c.email,c.address,c.preferredChannel];
    orders.forEach(function(o){parts.push(o.no,o.title,o.type,o.status,o.date)});
    return norm(parts.join(' '));
  }
  function matches(db,c,query){
    var q=norm(query);if(!q)return true;
    var hay=searchableText(db,c);return q.split(' ').every(function(token){return hay.indexOf(token)>=0});
  }
  function search(query){
    ensureCustomerNumbers();var db=readDb();if(!db)return[];
    return (db.customers||[]).filter(function(c){return matches(db,c,query)}).sort(function(a,b){
      var ao=customerOrders(db,a.id),bo=customerOrders(db,b.id);return bo.length-ao.length||String(a.name||'').localeCompare(String(b.name||''),'de');
    });
  }
  function badge(status){var s=String(status||'');var cls=/abgeschlossen|erledigt|bezahlt/i.test(s)?'ok':/storniert|überfällig/i.test(s)?'bad':'warn';return'<span class="badge '+cls+'">'+esc(s||'–')+'</span>'}
  function orderHistory(db,c,limit){
    var orders=customerOrders(db,c.id),shown=orders.slice(0,limit||3);
    if(!shown.length)return'<div class="shp-crm-empty-history">Noch keine Aufträge vorhanden.</div>';
    return shown.map(function(o){return'<div class="shp-crm-order"><div><b>'+esc(o.no||'')+'</b><span>'+esc(o.title||'')+'</span></div>'+badge(o.status)+'</div>'}).join('')+(orders.length>shown.length?'<div class="shp-crm-more">+'+(orders.length-shown.length)+' weitere Aufträge in der Kundenakte</div>':'');
  }
  function resultCard(db,c){
    var orders=customerOrders(db,c.id),tech=user()==='dome';
    return'<article class="shp-crm-result" data-customer-id="'+esc(c.id)+'">'+
      '<div class="shp-crm-result-head"><div><div class="shp-crm-number">'+esc(c.customerNo||'')+'</div><h3>'+esc(c.name||'')+'</h3><div class="shp-crm-contact">'+esc(c.contact||'Kein Ansprechpartner')+'</div></div><div class="shp-crm-count"><b>'+orders.length+'</b><span>'+(orders.length===1?'Auftrag':'Aufträge')+'</span></div></div>'+
      '<div class="shp-crm-meta"><span>☎ '+esc(c.phone||'–')+'</span><span>✉ '+esc(c.email||'–')+'</span><span>⌖ '+esc(c.address||'–')+'</span></div>'+
      '<div class="shp-crm-history">'+orderHistory(db,c,3)+'</div>'+
      '<div class="shp-crm-actions"><button class="btn" data-crm-open="'+esc(c.id)+'">'+(tech?'Kundenakte ansehen':'Kunde öffnen')+'</button><button class="btn primary" data-crm-order="'+esc(c.id)+'">+ Auftrag anlegen</button></div>'+
      '</article>';
  }
  function renderResults(query){
    var root=document.getElementById('shp-crm-results'),summary=document.getElementById('shp-crm-summary');if(!root)return;
    var db=readDb();if(!db)return;var found=search(query),q=String(query||'').trim();
    if(!q)found=found.slice(0,5);
    summary.textContent=q?(found.length+' '+(found.length===1?'Kunde gefunden':'Kunden gefunden')):'Schnellzugriff · '+found.length+' Kunden';
    root.innerHTML=found.length?found.map(function(c){return resultCard(db,c)}).join(''):'<div class="shp-crm-no-result"><b>Kein Kunde gefunden.</b><span>Suche mit Name, Ansprechpartner, Kundennummer, Telefon, E-Mail, Adresse oder einer früheren Auftragsnummer.</span></div>';
  }
  function openCustomer(id){
    var db=readDb(),c=db&&(db.customers||[]).find(function(x){return String(x.id)===String(id)});if(!c)return;
    if(user()==='annette'&&window.SH&&typeof window.SH.openCustomer==='function'){window.SH.openCustomer(c.id);return}
    showReadOnlyCustomer(c,db);
  }
  function showReadOnlyCustomer(c,db){
    var old=document.getElementById(DRAWER_ID);if(old)old.remove();
    var orders=customerOrders(db,c.id),wrap=document.createElement('div');wrap.id=DRAWER_ID;wrap.className='shp-crm-drawer-wrap';
    wrap.innerHTML='<section class="shp-crm-drawer" role="dialog" aria-modal="true" aria-label="Kundenakte '+esc(c.name)+'"><div class="shp-crm-drawer-head"><div><div class="shp-crm-number">'+esc(c.customerNo||'')+'</div><h2>'+esc(c.name||'')+'</h2><p>'+esc(c.contact||'')+'</p></div><button class="btn" data-crm-close>Schließen</button></div><div class="shp-crm-meta"><span>☎ '+esc(c.phone||'–')+'</span><span>✉ '+esc(c.email||'–')+'</span><span>⌖ '+esc(c.address||'–')+'</span><span>Bevorzugt: '+esc(c.preferredChannel||'–')+'</span></div><div class="shp-crm-drawer-actions"><button class="btn primary" data-crm-order="'+esc(c.id)+'">+ Auftrag für diesen Kunden</button></div><h3>Auftragshistorie · '+orders.length+'</h3><div class="shp-crm-history shp-crm-history-full">'+orderHistory(db,c,Math.max(orders.length,1))+'</div><p class="muted small">Technikeransicht: Kundenstammdaten sind schreibgeschützt.</p></section>';
    document.body.appendChild(wrap);wrap.querySelector('[data-crm-close]').focus();
  }
  function createOrder(id){
    var before=readDb(),beforeCount=before&&before.orders?before.orders.length:0;
    if(window.SH&&typeof window.SH.newOrder==='function')window.SH.newOrder(id);
    var after=readDb(),afterCount=after&&after.orders?after.orders.length:0;
    return afterCount===beforeCount+1;
  }
  function installStyle(){if(document.getElementById(STYLE_ID))return;var style=document.createElement('style');style.id=STYLE_ID;style.textContent='\
#shp-crm-search{border:1px solid #cbd9e5;background:linear-gradient(180deg,#fff,#f8fbfd);box-shadow:0 10px 30px rgba(11,31,51,.08)}\
.shp-crm-title{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}.shp-crm-title h2{margin:0 0 3px;font-size:20px}.shp-crm-title p{margin:0}.shp-crm-searchbox{position:relative}.shp-crm-searchbox input{padding:13px 42px 13px 14px;border:2px solid #bfcfdd;background:#fff;font-size:16px}.shp-crm-searchbox input:focus{outline:0;border-color:#1769cf;box-shadow:0 0 0 3px rgba(23,105,207,.12)}.shp-crm-searchbox button{position:absolute;right:5px;top:5px;border:0;background:transparent;font-size:20px;width:35px;height:35px;border-radius:9px}.shp-crm-summary{margin:10px 0;color:#657482;font-size:13px;font-weight:700}.shp-crm-results{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.shp-crm-result{border:1px solid #dbe4ec;border-radius:14px;padding:13px;background:#fff;min-width:0}.shp-crm-result-head{display:flex;justify-content:space-between;gap:10px}.shp-crm-result h3{margin:2px 0 3px;font-size:17px}.shp-crm-number{font-size:12px;font-weight:900;letter-spacing:.04em;color:#1769cf}.shp-crm-contact{font-size:13px;color:#657482}.shp-crm-count{min-width:58px;text-align:center;background:#edf5ff;border-radius:12px;padding:7px}.shp-crm-count b{display:block;font-size:20px}.shp-crm-count span{font-size:10px}.shp-crm-meta{display:flex;flex-wrap:wrap;gap:6px 12px;margin:10px 0;font-size:12px;color:#485c6d}.shp-crm-meta span{overflow-wrap:anywhere}.shp-crm-history{border-top:1px solid #e6edf2;padding-top:8px}.shp-crm-order{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:5px 0;font-size:12px}.shp-crm-order div{min-width:0}.shp-crm-order b{margin-right:6px}.shp-crm-order span{color:#536574}.shp-crm-more,.shp-crm-empty-history{font-size:11px;color:#657482;padding:5px 0}.shp-crm-actions{display:flex;gap:7px;margin-top:10px;flex-wrap:wrap}.shp-crm-actions .btn{flex:1}.shp-crm-no-result{grid-column:1/-1;text-align:center;border:1px dashed #cbd9e5;border-radius:12px;padding:20px}.shp-crm-no-result b,.shp-crm-no-result span{display:block}.shp-crm-no-result span{color:#657482;font-size:12px;margin-top:5px}.shp-crm-drawer-wrap{position:fixed;inset:0;background:rgba(3,14,24,.58);z-index:140;display:flex;justify-content:flex-end}.shp-crm-drawer{height:100%;width:min(560px,100%);overflow:auto;background:#f7fafc;padding:20px;box-shadow:-20px 0 50px rgba(0,0,0,.2)}.shp-crm-drawer-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.shp-crm-drawer h2{margin:3px 0}.shp-crm-drawer p{margin-top:4px}.shp-crm-drawer-actions{margin:14px 0}.shp-crm-history-full .shp-crm-order{background:#fff;border:1px solid #e2e9ef;border-radius:10px;margin:5px 0;padding:9px}.shp-crm-search-hint{font-size:11px;color:#657482;margin-top:7px}\
@media(max-width:850px){.shp-crm-results{grid-template-columns:1fr}.shp-crm-title{display:block}.shp-crm-title .badge{margin-top:7px}.shp-crm-result{padding:12px}.shp-crm-meta{display:grid;grid-template-columns:1fr}.shp-crm-actions{display:grid;grid-template-columns:1fr}.shp-crm-drawer{padding:15px 12px 90px}.shp-crm-order{align-items:flex-start}.shp-crm-order>div{display:grid;gap:2px}}';document.head.appendChild(style)}
  function buildCard(){
    var main=document.querySelector('main.shell');if(!main||!eligible())return;
    var h=[].slice.call(main.querySelectorAll('h2')).find(function(x){var t=(x.textContent||'').trim();return t==='Meine Einsätze'||t==='Büro-Dashboard'});if(!h)return;
    if(document.getElementById(CARD_ID))return;
    ensureCustomerNumbers();installStyle();
    var card=document.createElement('section');card.id=CARD_ID;card.className='card';card.innerHTML='<div class="shp-crm-title"><div><h2>Kunde schnell finden</h2><p class="muted">Bestandskunden und frühere Aufträge sofort finden und direkt einen neuen Auftrag anlegen.</p></div><span class="badge">CRM-Suche</span></div><div class="shp-crm-searchbox"><input id="shp-crm-query" type="search" autocomplete="off" aria-label="Kunden durchsuchen" placeholder="Name, Ansprechpartner, Kundennr., Telefon, E-Mail, Auftrag …"><button type="button" data-crm-clear aria-label="Suche leeren">×</button></div><div class="shp-crm-search-hint">Auch Auftragsnummern und frühere Auftragsbezeichnungen werden durchsucht.</div><div id="shp-crm-summary" class="shp-crm-summary"></div><div id="shp-crm-results" class="shp-crm-results"></div>';
    var hero=main.querySelector('.hero');if(hero)hero.insertAdjacentElement('afterend',card);else{var row=h.closest('.row');(row||h).insertAdjacentElement('afterend',card)}
    var input=card.querySelector('#shp-crm-query');input.value=lastQuery;input.addEventListener('input',function(){lastQuery=input.value;renderResults(lastQuery)});card.querySelector('[data-crm-clear]').addEventListener('click',function(){lastQuery='';input.value='';renderResults('');input.focus()});renderResults(lastQuery);
  }
  function delegatedClick(e){
    var open=e.target.closest&&e.target.closest('[data-crm-open]');if(open){e.preventDefault();openCustomer(open.getAttribute('data-crm-open'));return}
    var order=e.target.closest&&e.target.closest('[data-crm-order]');if(order){e.preventDefault();createOrder(order.getAttribute('data-crm-order'));return}
    if(e.target.closest&&e.target.closest('[data-crm-close]')){var drawer=document.getElementById(DRAWER_ID);if(drawer)drawer.remove()}
  }
  document.addEventListener('click',delegatedClick);
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){var drawer=document.getElementById(DRAWER_ID);if(drawer)drawer.remove()}});
  var scheduled=false;function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;buildCard()})}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  buildCard();
  window.SHP_CRM_SEARCH={search:search,ensureCustomerNumbers:ensureCustomerNumbers,renderResults:renderResults,openCustomer:openCustomer,createOrder:createOrder,normalize:norm,enhance:buildCard};
})();
