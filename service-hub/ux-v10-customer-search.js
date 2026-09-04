(function(){
  'use strict';

  var BUILD='20260904-v10';
  var STORE='shp_db';
  var SESSION='shp_session';
  var mountedFor=null;
  var scheduled=false;

  function readJson(storage,key,fallback){
    try{return JSON.parse(storage.getItem(key)||'null')||fallback}catch(e){return fallback}
  }
  function readDb(){return readJson(localStorage,STORE,{customers:[],orders:[]})}
  function session(){return readJson(sessionStorage,SESSION,null)}
  function esc(value){
    return String(value==null?'':value).replace(/[&<>"']/g,function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
    });
  }
  function normalize(value){
    return String(value==null?'':value)
      .toLocaleLowerCase('de-DE')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9]+/g,' ')
      .trim();
  }
  function isClosed(status){return /abgeschlossen|erledigt|storniert|bezahlt/i.test(String(status||''))}
  function plural(count,singular,pluralWord){return count+' '+(count===1?singular:pluralWord)}

  function nextCustomerNo(customers){
    var year=new Date().getFullYear(),max=0;
    (customers||[]).forEach(function(customer){
      var match=String(customer.customerNo||'').match(/^K-(\d{4})-(\d+)$/i);
      if(match&&Number(match[1])===year)max=Math.max(max,Number(match[2])||0);
    });
    return 'K-'+year+'-'+String(max+1).padStart(4,'0');
  }

  function ensureCustomerNumbers(){
    var db=readDb(),customers=db.customers||[],changed=false,used={};
    customers.forEach(function(customer){
      var value=String(customer.customerNo||'').trim().toUpperCase();
      if(value&&!used[value]){customer.customerNo=value;used[value]=true;return}
      var number=nextCustomerNo(customers);
      while(used[number]){
        var match=number.match(/^(.*-)(\d+)$/);
        number=match?match[1]+String(Number(match[2])+1).padStart(4,'0'):number+'-1';
      }
      customer.customerNo=number;used[number]=true;changed=true;
    });
    if(changed)localStorage.setItem(STORE,JSON.stringify(db));
    return db;
  }

  function statsFor(db,customerId){
    var orders=(db.orders||[]).filter(function(order){return String(order.customerId)===String(customerId)});
    var open=orders.filter(function(order){return !isClosed(order.status)}).length;
    var latest=orders.slice().sort(function(a,b){return Number(b.id||0)-Number(a.id||0)})[0]||null;
    return {total:orders.length,open:open,latest:latest};
  }

  function rank(customer,query){
    var q=normalize(query),number=normalize(customer.customerNo),name=normalize(customer.name),contact=normalize(customer.contact);
    if(number===q)return 0;
    if(name===q||contact===q)return 1;
    if(number.indexOf(q)===0)return 2;
    if(name.indexOf(q)===0||contact.indexOf(q)===0)return 3;
    return 4;
  }

  function searchCustomers(db,query){
    var customers=(db.customers||[]).slice(),q=normalize(query);
    if(!q)return customers.reverse().slice(0,4);
    var tokens=q.split(/\s+/).filter(Boolean);
    return customers.filter(function(customer){
      var fields=[customer.customerNo,customer.name,customer.contact,customer.email,customer.phone,customer.address].map(normalize);
      return tokens.every(function(token){return fields.some(function(field){return field.indexOf(token)>=0})});
    }).sort(function(a,b){
      var delta=rank(a,q)-rank(b,q);
      return delta||String(a.name||'').localeCompare(String(b.name||''),'de');
    }).slice(0,8);
  }

  function contactLine(customer){
    var parts=[];
    if(customer.contact)parts.push(customer.contact);
    if(customer.phone)parts.push(customer.phone);
    if(customer.email)parts.push(customer.email);
    return parts.join(' · ')||customer.address||'Keine Kontaktdaten hinterlegt';
  }

  function resultHtml(db,customer,allowOrder){
    var stats=statsFor(db,customer.id),latest=stats.latest;
    var last=latest
      ? 'Letzter Auftrag: '+esc(latest.no||'ohne Nummer')+' · '+esc(latest.title||'')+' · '+esc(latest.status||'')
      : 'Für diesen Kunden wurde noch kein Auftrag angelegt.';
    return '<article class="crm-customer-result-v10" data-customer-id="'+esc(customer.id)+'">'+
      '<div class="crm-customer-result-main">'+
        '<div class="crm-customer-result-top"><span class="crm-customer-number">'+esc(customer.customerNo||'Kunde')+'</span><h4>'+esc(customer.name||'Unbenannter Kunde')+'</h4></div>'+
        '<p class="crm-customer-result-contact">'+esc(contactLine(customer))+'</p>'+
        '<div class="crm-customer-result-stats"><span>'+plural(stats.total,'Auftrag','Aufträge')+'</span><span class="crm-open-orders">'+stats.open+' offen</span></div>'+
        '<div class="crm-customer-result-last">'+last+'</div>'+
      '</div>'+
      '<div class="crm-customer-result-actions">'+
        '<button type="button" class="crm-customer-open" data-customer-action="open">Kunde öffnen</button>'+
        (allowOrder?'<button type="button" class="crm-customer-order" data-customer-action="order">+ Auftrag anlegen</button>':'')+
      '</div>'+
    '</article>';
  }

  function canCreateOrder(){
    var current=session(),role=current&&String(current.user||current.role||'').toLowerCase();
    return role==='dome'||role==='tech'||role==='annette'||role==='office'||role==='admin';
  }

  function renderResults(root,query){
    var db=ensureCustomerNumbers(),items=searchCustomers(db,query),results=root.querySelector('.crm-customer-search-results');
    if(!results)return;
    if(!items.length){
      var current=session(),mayCreate=current&&current.user!=='dome';
      results.innerHTML='<div class="crm-customer-search-empty"><b>Kein Kunde gefunden</b><span>'+(mayCreate?'Bitte Schreibweise prüfen oder einen neuen Kunden anlegen.':'Bitte Schreibweise oder Kundennummer prüfen.')+'</span></div>';
      return;
    }
    var summary=query.trim()
      ? plural(items.length,'Treffer','Treffer')+' für „'+esc(query.trim())+'“'
      : 'Direkter Zugriff auf die zuletzt angelegten Kunden';
    results.innerHTML='<div class="crm-customer-search-summary">'+summary+'</div>'+items.map(function(customer){return resultHtml(db,customer,canCreateOrder())}).join('');
  }

  function createFinder(context){
    var root=document.createElement('section'),id='crm-customer-search-'+context;
    root.className='crm-customer-finder-v10';
    root.dataset.context=context;
    root.setAttribute('aria-label','Kundensuche und Auftragserstellung');
    root.innerHTML='<div class="crm-customer-finder-head">'+
      '<div class="crm-customer-finder-title"><span class="crm-customer-finder-icon" aria-hidden="true">⌕</span><div><h3>Kunde finden & Auftrag starten</h3><p>Nach Vorname, Nachname, Firma, Kundennummer, Telefon oder E-Mail suchen.</p></div></div>'+
      '<span class="crm-customer-finder-hint">Dome & Annette</span>'+
      '</div>'+
      '<div class="crm-customer-search-box"><label for="'+id+'">Kundensuche</label><span class="crm-customer-search-symbol" aria-hidden="true">⌕</span><input class="crm-customer-search-input" id="'+id+'" type="search" inputmode="search" autocomplete="off" placeholder="z. B. Thomas Berger oder K-2026-0001"><button type="button" class="crm-customer-search-clear" aria-label="Suche leeren" hidden>×</button></div>'+
      '<div class="crm-customer-search-results" aria-live="polite"></div>';

    var input=root.querySelector('.crm-customer-search-input'),clear=root.querySelector('.crm-customer-search-clear');
    input.addEventListener('input',function(){clear.hidden=!input.value;renderResults(root,input.value)});
    input.addEventListener('keydown',function(event){
      if(event.key!=='Enter')return;
      var first=root.querySelector('[data-customer-action="open"]');
      if(first){event.preventDefault();first.click()}
    });
    clear.addEventListener('click',function(){input.value='';clear.hidden=true;renderResults(root,'');input.focus()});
    root.addEventListener('click',function(event){
      var button=event.target.closest('[data-customer-action]');if(!button)return;
      var card=button.closest('[data-customer-id]'),id=card&&card.getAttribute('data-customer-id');if(!id||!window.SH)return;
      if(button.dataset.customerAction==='open'&&typeof window.SH.openCustomer==='function')window.SH.openCustomer(id);
      if(button.dataset.customerAction==='order'&&typeof window.SH.newOrder==='function')window.SH.newOrder(id);
    });
    renderResults(root,'');
    return root;
  }

  function surface(main){
    if(main.querySelector('.crm-dashboard-v94'))return 'office-dashboard';
    var h2=main.querySelector('h2'),title=(h2&&h2.textContent||'').trim();
    if(title==='Dome Arbeitsbereich'||(session()&&session().user==='dome'&&main.querySelector('.ux-dome-modules')))return 'dome-home';
    if(title==='Kunden')return 'customers';
    return '';
  }

  function mountFinder(main,context){
    if(!context)return;
    var existing=main.querySelector('.crm-customer-finder-v10');
    if(existing){mountedFor=context;return}
    var finder=createFinder(context);
    if(context==='office-dashboard'){
      var dashboard=main.querySelector('.crm-dashboard-v94'),head=dashboard&&dashboard.querySelector('.crm-dash-head');
      if(head)head.insertAdjacentElement('afterend',finder);
    }else if(context==='dome-home'){
      var modules=main.querySelector('.ux-dome-modules'),row=main.querySelector('.row.between');
      (modules||row||main).insertAdjacentElement('afterend',finder);
    }else{
      var h2=main.querySelector('h2'),header=h2&&h2.closest('.row');
      (header||h2||main).insertAdjacentElement('afterend',finder);
    }
    mountedFor=context;
  }

  function addCustomerNumberToDetail(main,db){
    var title=main.querySelector('h2');if(!title)return;
    var customer=(db.customers||[]).find(function(item){return String(item.name||'')===(title.textContent||'').trim()});
    if(!customer||main.querySelector('.crm-customer-id-v10'))return;
    var badge=document.createElement('span');badge.className='crm-customer-id-v10 crm-customer-number';badge.textContent=customer.customerNo;
    title.insertAdjacentElement('afterend',badge);
  }

  function removeObsoleteElements(main){
    main.querySelectorAll('button[onclick*="addMeasurement"],button[onclick*="removeMeasurement"]').forEach(function(button){
      var row=button.closest('p');if(row&&button.getAttribute('onclick').indexOf('removeMeasurement')>=0)row.remove();else button.remove();
    });
    [].slice.call(main.querySelectorAll('h3')).forEach(function(heading){
      if((heading.textContent||'').trim()==='Material / Messwerte')heading.textContent='Material';
    });
  }

  function enhance(){
    var db=ensureCustomerNumbers(),main=document.querySelector('main.shell');
    document.documentElement.dataset.shCrmSearchBuild=BUILD;
    if(!main)return;
    removeObsoleteElements(main);
    var context=surface(main);
    if(context!==mountedFor)mountedFor=null;
    mountFinder(main,context);
    addCustomerNumberToDetail(main,db);
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(function(){scheduled=false;enhance()});
  }

  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  enhance();
  window.SHP_CRM_SEARCH={
    build:BUILD,
    search:function(query){var db=ensureCustomerNumbers();return searchCustomers(db,query)},
    nextCustomerNo:nextCustomerNo,
    enhance:enhance
  };
})();
