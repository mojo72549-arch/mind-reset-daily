(function(){
  'use strict';
  var wrapped=false;
  function getSession(){try{return JSON.parse(sessionStorage.getItem('shp_session')||'null')}catch(e){return null}}
  function isDome(){var s=getSession();return !!(s&&s.user==='dome')}
  function denyOffice(){window.alert('Diese Funktion ist für Büro / Administration vorgesehen. Dome kann die Daten sehen, aber hier nicht verändern.');}
  function wrapDeletes(){
    if(wrapped||!window.SH)return;
    wrapped=true;
    ['removeReportLine','removeMaterial','removeMeasurement'].forEach(function(name){
      var original=window.SH[name];
      if(typeof original!=='function')return;
      window.SH[name]=function(index){
        var label=name==='removeReportLine'?'Leistung':name==='removeMaterial'?'Material':'Messwert';
        if(!window.confirm(label+' wirklich löschen?'))return;
        return original(index);
      };
    });
    var originalGo=window.SH.go;
    if(typeof originalGo==='function')window.SH.go=function(tab){if(isDome()&&tab==='admin')return denyOffice();return originalGo(tab)};
    ['newCustomer','editCustomer','newOrder','saveInvoiceStatus','sendInvoicePreferred','sendInvoice','saveAdminGlobal','addCatalogItem','editCatalogItem','editCustomerPricing','goAdminCustomer','invoiceFromReport'].forEach(function(name){
      var original=window.SH[name];
      if(typeof original!=='function')return;
      window.SH[name]=function(){if(isDome())return denyOffice();return original.apply(window.SH,arguments)};
    });
  }
  function enhanceReportLines(){
    var headings=[].slice.call(document.querySelectorAll('.card h3'));
    headings.forEach(function(h){
      if((h.textContent||'').trim()!=='Leistungen im Rapport')return;
      var card=h.closest('.card');
      if(!card)return;
      card.classList.add('report-lines-card');
      var rows=card.querySelectorAll('table tr');
      var dataRows=Math.max(0,rows.length-1);
      card.querySelectorAll('button.red').forEach(function(btn){
        btn.textContent='Löschen';
        btn.classList.add('ux-danger-confirm');
        btn.setAttribute('aria-label','Leistung aus Rapport löschen');
        btn.setAttribute('title','Leistung löschen');
      });
      var empty=card.querySelector('.ux-empty');
      if(dataRows===0&&!empty){empty=document.createElement('div');empty.className='ux-empty';empty.textContent='Noch keine Leistung hinzugefügt.';card.appendChild(empty)}
      else if(dataRows>0&&empty){empty.remove()}
    });
  }
  function enhanceActions(){
    document.querySelectorAll('.sticky').forEach(function(el){
      if(el.querySelector('button[onclick*="finishReport"]'))el.classList.add('ux-report-actions');
    });
  }
  function simplifyLabels(){
    document.querySelectorAll('button').forEach(function(btn){if((btn.textContent||'').trim()==='360° öffnen')btn.textContent='Kunde öffnen'});
  }
  function domeNav(){
    if(!isDome())return;
    var desktop=document.querySelector('.nav.desktop');
    if(desktop&&!desktop.dataset.domeNav){
      desktop.dataset.domeNav='1';
      desktop.innerHTML='<button class="btn" onclick="SH.go(\'home\')">Start</button><button class="btn" onclick="SH.go(\'customers\')">Kunden</button><button class="btn" onclick="SH.go(\'orders\')">Aufträge</button><button class="btn" onclick="SH.go(\'reports\')">Rapporte</button><button class="btn" onclick="SH.go(\'invoices\')">Rechnungen</button><button class="btn" onclick="SH.logout()">Abmelden</button>';
    }
    var mobile=document.querySelector('.mobile');
    if(mobile&&!mobile.dataset.domeNav){
      mobile.dataset.domeNav='1';
      mobile.innerHTML='<button onclick="SH.go(\'home\')">⌂<br>Start</button><button onclick="SH.go(\'orders\')">▣<br>Aufträge</button><button onclick="SH.go(\'customers\')">♙<br>Kunden</button><button onclick="SH.go(\'reports\')">✓<br>Rapporte</button><button onclick="SH.go(\'invoices\')">€<br>Rechnung</button>';
    }
    var top=document.querySelector('.top');
    if(top&&!top.querySelector('.ux-mobile-logout')){
      var logout=document.createElement('button');logout.className='ux-mobile-logout';logout.type='button';logout.textContent='Abmelden';logout.onclick=function(){SH.logout()};top.appendChild(logout);
    }
  }
  function domeHome(){
    if(!isDome())return;
    var h=document.querySelector('main h2');
    if(!h||(h.textContent||'').trim()!=='Meine Einsätze')return;
    h.textContent='Dome Arbeitsbereich';
    var intro=h.parentElement&&h.parentElement.querySelector('.muted');
    if(intro)intro.textContent='Kunden · Aufträge · Rapporte · Rechnungen';
    var row=h.closest('.row');
    if(!row||document.querySelector('.ux-dome-modules'))return;
    var modules=document.createElement('div');
    modules.className='ux-dome-modules';
    modules.innerHTML='<button onclick="SH.go(\'customers\')"><b>Kunden</b><span>Kontaktdaten und Historie</span></button><button onclick="SH.go(\'orders\')"><b>Aufträge</b><span>Einsätze und Status</span></button><button onclick="SH.go(\'reports\')"><b>Rapporte</b><span>Bearbeiten und abschließen</span></button><button onclick="SH.go(\'invoices\')"><b>Rechnungen</b><span>Status und Dokumente ansehen</span></button>';
    row.insertAdjacentElement('afterend',modules);
    var title=document.createElement('h3');title.className='ux-section-title';title.textContent='Meine Einsätze';modules.insertAdjacentElement('afterend',title);
  }
  function protectDomeViews(){
    if(!isDome())return;
    var main=document.querySelector('main');if(!main)return;
    var title=((main.querySelector('h2')||{}).textContent||'').trim();
    if(title==='Kunden')main.querySelectorAll('button[onclick*="newCustomer"]').forEach(function(b){b.remove()});
    if(title==='Aufträge')main.querySelectorAll('button[onclick*="newOrder"]').forEach(function(b){b.remove()});
    if(title&&title!=='Kunden'&&title!=='Aufträge'&&title!=='Rapporte'&&title!=='Dome Arbeitsbereich'&&title.indexOf('Rapport')!==0&&title.indexOf('Rechnung')!==0){
      main.querySelectorAll('button[onclick*="editCustomer"],button[onclick*="newOrder"],button[onclick*="goAdminCustomer"]').forEach(function(b){b.remove()});
      [].slice.call(main.querySelectorAll('.card h3')).forEach(function(h){if((h.textContent||'').trim()==='Konditionen'){var c=h.closest('.card');if(c){c.innerHTML='<h3>Konditionen</h3><p class="muted">Preis- und Konditionspflege erfolgt durch Büro / Administration.</p>'}}});
    }
    if(title.indexOf('Rechnung ')===0){
      var status=main.querySelector('#ivstatus');
      if(status){status.disabled=true;var card=status.closest('.card');if(card&&!card.querySelector('.ux-readonly')){var n=document.createElement('div');n.className='ux-readonly';n.textContent='Nur Ansicht für Dome · Status und Versand werden im Büro bearbeitet.';card.insertBefore(n,card.firstChild)}}
      main.querySelectorAll('button[onclick*="saveInvoiceStatus"],button[onclick*="sendInvoice("] ,button[onclick*="sendInvoicePreferred"]').forEach(function(b){b.remove()});
    }
  }
  function activeNav(){
    var title=(document.querySelector('main h2')||{}).textContent||'';
    document.querySelectorAll('.mobile button').forEach(function(b){b.classList.remove('ux-active')});
    var match=title.indexOf('Rapport')===0?'Rapporte':title.indexOf('Rechnung')===0?'Rechnung':title.indexOf('Kunden')===0?'Kunden':title.indexOf('Aufträge')===0?'Aufträge':'Start';
    document.querySelectorAll('.mobile button').forEach(function(b){if((b.textContent||'').indexOf(match)>=0)b.classList.add('ux-active')});
  }
  function enhance(){wrapDeletes();enhanceReportLines();enhanceActions();simplifyLabels();domeNav();domeHome();protectDomeViews();activeNav()}
  var scheduled=false;
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;enhance()})}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  enhance();
})();