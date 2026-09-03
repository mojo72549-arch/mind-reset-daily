(function(){
  'use strict';
  var STORE='shp_db',SESSION='shp_session',UNDO='shp_undo_stack',NOTICE='shp_undo_notice';
  var wrapped=false;
  var actionLabels={
    newCustomer:'Kunde angelegt',editCustomer:'Kundendaten geändert',newOrder:'Auftrag angelegt',
    saveReportText:'Rapport gespeichert',startReport:'Einsatz gestartet',endReport:'Einsatz beendet',
    addReportLine:'Leistung hinzugefügt',removeReportLine:'Leistung entfernt',addMaterial:'Material hinzugefügt',removeMaterial:'Material entfernt',
    addMeasurement:'Messwert hinzugefügt',removeMeasurement:'Messwert entfernt',finishReport:'Rapport abgeschlossen',
    invoiceFromReport:'Rechnung erzeugt',saveInvoiceStatus:'Rechnungsstatus geändert',saveAdminGlobal:'Einstellungen geändert',
    addCatalogItem:'Leistung angelegt',editCatalogItem:'Leistung geändert',editCustomerPricing:'Kundenkonditionen geändert'
  };
  function core(){return window.SHP_CORE||null;}
  function getSession(){try{return JSON.parse(sessionStorage.getItem(SESSION)||'null')}catch(e){return null}}
  function userRole(){var s=getSession();return core()?core().normalizeRole(s&&s.user):((s&&s.user)||'');}
  function isDome(){return userRole()==='dome';}
  function allowed(cap){var c=core();return c?c.can(userRole(),cap):true;}
  function denyOffice(){window.alert('Diese Funktion ist für Büro / Administration vorgesehen. Dome kann die Daten sehen, aber hier nicht verändern.');}
  function readUndo(){try{return JSON.parse(sessionStorage.getItem(UNDO)||'[]')}catch(e){return[]}}
  function writeUndo(stack){sessionStorage.setItem(UNDO,JSON.stringify(stack.slice(-10)));}
  function remember(before,label){
    var stack=readUndo();stack.push({snapshot:before,label:label||'Änderung',at:Date.now()});writeUndo(stack);showUndo(label||'Änderung gespeichert');
  }
  function undoLast(){
    var stack=readUndo(),item=stack.pop();if(!item)return;
    writeUndo(stack);
    if(item.snapshot==null)localStorage.removeItem(STORE);else localStorage.setItem(STORE,item.snapshot);
    sessionStorage.setItem(NOTICE,(item.label||'Änderung')+' wurde rückgängig gemacht.');
    location.reload();
  }
  function showUndo(label){
    var old=document.querySelector('.ux-undo-toast');if(old)old.remove();
    var el=document.createElement('div');el.className='ux-undo-toast';
    el.innerHTML='<span>'+escapeText(label||'Änderung gespeichert')+'</span><button type="button">Rückgängig</button>';
    el.querySelector('button').onclick=undoLast;document.body.appendChild(el);
    window.clearTimeout(showUndo.timer);showUndo.timer=window.setTimeout(function(){if(el.parentNode)el.remove()},6500);
  }
  function showNotice(){var n=sessionStorage.getItem(NOTICE);if(!n)return;sessionStorage.removeItem(NOTICE);setTimeout(function(){var el=document.createElement('div');el.className='ux-success-toast';el.textContent=n;document.body.appendChild(el);setTimeout(function(){if(el.parentNode)el.remove()},2800)},100)}
  function escapeText(s){return String(s==null?'':s).replace(/[&<>"']/g,function(ch){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[ch]});}
  function guardFor(name){
    if(name==='newCustomer'||name==='editCustomer')return'manageCustomers';
    if(name==='newOrder')return'manageOrders';
    if(name==='invoiceFromReport'||name==='saveInvoiceStatus')return'manageInvoices';
    if(name==='saveAdminGlobal'||name==='addCatalogItem'||name==='editCatalogItem'||name==='editCustomerPricing'||name==='goAdminCustomer')return'managePricing';
    if(name.indexOf('Report')>=0||name.indexOf('Material')>=0||name.indexOf('Measurement')>=0)return'editReports';
    return'';
  }
  function wrapActions(){
    if(wrapped||!window.SH)return;wrapped=true;
    var c=core();var names=(c&&c.SAFE_UNDO_ACTIONS)||Object.keys(actionLabels);
    names.forEach(function(name){
      var original=window.SH[name];if(typeof original!=='function')return;
      window.SH[name]=function(){
        var cap=guardFor(name);if(cap&&!allowed(cap))return denyOffice();
        if(name==='saveReportText'&&arguments[0]===true)return original.apply(window.SH,arguments);
        if(name==='removeReportLine'&&!window.confirm('Leistung wirklich aus dem Rapport entfernen?'))return;
        if(name==='removeMaterial'&&!window.confirm('Material wirklich entfernen?'))return;
        if(name==='removeMeasurement'&&!window.confirm('Messwert wirklich entfernen?'))return;
        var before=localStorage.getItem(STORE),result=original.apply(window.SH,arguments),after=localStorage.getItem(STORE);
        var changed=c?c.changed(before,after):before!==after;
        if(changed)remember(before,actionLabels[name]||'Änderung gespeichert');
        return result;
      };
    });
    var originalGo=window.SH.go;
    if(typeof originalGo==='function')window.SH.go=function(tab){if(tab==='admin'&&!allowed('manageAdmin'))return denyOffice();return originalGo(tab)};
    ['sendInvoicePreferred','sendInvoice'].forEach(function(name){var original=window.SH[name];if(typeof original==='function')window.SH[name]=function(){if(!allowed('manageInvoices'))return denyOffice();return original.apply(window.SH,arguments)}});
    ['saveAdminGlobal','addCatalogItem','editCatalogItem','editCustomerPricing','goAdminCustomer'].forEach(function(name){var original=window.SH[name];if(typeof original==='function'&&!original.__uxGuard){var guarded=original;window.SH[name]=function(){if(!allowed('managePricing'))return denyOffice();return guarded.apply(window.SH,arguments)};window.SH[name].__uxGuard=true}});
  }
  function enhanceReportLines(){
    [].slice.call(document.querySelectorAll('.card h3')).forEach(function(h){
      if((h.textContent||'').trim()!=='Leistungen im Rapport')return;
      var card=h.closest('.card');if(!card)return;card.classList.add('report-lines-card');
      var rows=card.querySelectorAll('table tr'),dataRows=Math.max(0,rows.length-1);
      card.querySelectorAll('button.red').forEach(function(btn){btn.textContent='Löschen';btn.classList.add('ux-danger-confirm');btn.setAttribute('aria-label','Leistung aus Rapport löschen');btn.setAttribute('title','Leistung löschen')});
      var empty=card.querySelector('.ux-empty');
      if(dataRows===0&&!empty){empty=document.createElement('div');empty.className='ux-empty';empty.textContent='Noch keine Leistung hinzugefügt.';card.appendChild(empty)}
      else if(dataRows>0&&empty)empty.remove();
    });
    [].slice.call(document.querySelectorAll('.card')).forEach(function(card){
      var h=card.querySelector('h3');if(!h||(h.textContent||'').trim()!=='Leistung hinzufügen')return;
      card.querySelectorAll('button.red').forEach(function(btn){btn.textContent='Löschen';btn.classList.add('ux-danger-confirm')});
    });
  }
  function enhanceActions(){document.querySelectorAll('.sticky').forEach(function(el){if(el.querySelector('button[onclick*="finishReport"]'))el.classList.add('ux-report-actions')})}
  function simplifyLabels(){document.querySelectorAll('button').forEach(function(btn){if((btn.textContent||'').trim()==='360° öffnen')btn.textContent='Kunde öffnen'})}
  function domeNav(){
    if(!isDome())return;
    var desktop=document.querySelector('.nav.desktop');
    if(desktop&&!desktop.dataset.domeNav){desktop.dataset.domeNav='1';desktop.innerHTML='<button class="btn" onclick="SH.go(\'home\')">Start</button><button class="btn" onclick="SH.go(\'customers\')">Kunden</button><button class="btn" onclick="SH.go(\'orders\')">Aufträge</button><button class="btn" onclick="SH.go(\'reports\')">Rapporte</button><button class="btn" onclick="SH.go(\'invoices\')">Rechnungen</button><button class="btn" onclick="SH.logout()">Abmelden</button>'}
    var mobile=document.querySelector('.mobile');
    if(mobile&&!mobile.dataset.domeNav){mobile.dataset.domeNav='1';mobile.innerHTML='<button onclick="SH.go(\'home\')">⌂<br>Start</button><button onclick="SH.go(\'orders\')">▣<br>Aufträge</button><button onclick="SH.go(\'customers\')">♙<br>Kunden</button><button onclick="SH.go(\'reports\')">✓<br>Rapporte</button><button onclick="SH.go(\'invoices\')">€<br>Rechnung</button>'}
    var top=document.querySelector('.top');
    if(top&&!top.querySelector('.ux-mobile-logout')){var logout=document.createElement('button');logout.className='ux-mobile-logout';logout.type='button';logout.textContent='Abmelden';logout.onclick=function(){SH.logout()};top.appendChild(logout)}
  }
  function domeHome(){
    if(!isDome())return;var h=document.querySelector('main h2');if(!h||(h.textContent||'').trim()!=='Meine Einsätze')return;
    h.textContent='Dome Arbeitsbereich';var intro=h.parentElement&&h.parentElement.querySelector('.muted');if(intro)intro.textContent='Kunden · Aufträge · Rapporte · Rechnungen';
    var row=h.closest('.row');if(!row||document.querySelector('.ux-dome-modules'))return;
    var modules=document.createElement('div');modules.className='ux-dome-modules';modules.innerHTML='<button onclick="SH.go(\'customers\')"><b>Kunden</b><span>Kontaktdaten und Historie</span></button><button onclick="SH.go(\'orders\')"><b>Aufträge</b><span>Einsätze und Status</span></button><button onclick="SH.go(\'reports\')"><b>Rapporte</b><span>Bearbeiten und abschließen</span></button><button onclick="SH.go(\'invoices\')"><b>Rechnungen</b><span>Status und Dokumente ansehen</span></button>';row.insertAdjacentElement('afterend',modules);
    var title=document.createElement('h3');title.className='ux-section-title';title.textContent='Meine Einsätze';modules.insertAdjacentElement('afterend',title)
  }
  function protectDomeViews(){
    if(!isDome())return;var main=document.querySelector('main');if(!main)return;var title=((main.querySelector('h2')||{}).textContent||'').trim();
    main.querySelectorAll('button[onclick*="newCustomer"],button[onclick*="newOrder"],button[onclick*="editCustomer"],button[onclick*="goAdminCustomer"]').forEach(function(b){b.remove()});
    [].slice.call(main.querySelectorAll('.card h3')).forEach(function(h){if((h.textContent||'').trim()==='Konditionen'){var card=h.closest('.card');if(card)card.innerHTML='<h3>Konditionen</h3><p class="muted">Preis- und Konditionspflege erfolgt durch Büro / Administration.</p>'}});
    if(title.indexOf('Rechnung ')===0){var status=main.querySelector('#ivstatus');if(status){status.disabled=true;var card=status.closest('.card');if(card&&!card.querySelector('.ux-readonly')){var n=document.createElement('div');n.className='ux-readonly';n.textContent='Nur Ansicht für Dome · Status und Versand werden im Büro bearbeitet.';card.insertBefore(n,card.firstChild)}}main.querySelectorAll('button[onclick*="saveInvoiceStatus"],button[onclick*="sendInvoice("],button[onclick*="sendInvoicePreferred"]').forEach(function(b){b.remove()})}
  }
  function activeNav(){
    var title=(document.querySelector('main h2')||{}).textContent||'';document.querySelectorAll('.mobile button').forEach(function(b){b.classList.remove('ux-active')});
    var match=title.indexOf('Rapport')===0?'Rapporte':title.indexOf('Rechnung')===0?'Rechnung':title.indexOf('Kunden')===0?'Kunden':title.indexOf('Aufträge')===0?'Aufträge':'Start';
    document.querySelectorAll('.mobile button').forEach(function(b){if((b.textContent||'').indexOf(match)>=0)b.classList.add('ux-active')})
  }
  function enhance(){wrapActions();enhanceReportLines();enhanceActions();simplifyLabels();domeNav();domeHome();protectDomeViews();activeNav()}
  var scheduled=false;function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;enhance()})}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});showNotice();enhance();
  window.SHP_UX_TEST_API={undoLast:undoLast,userRole:userRole,allowed:allowed,enhance:enhance};
})();
