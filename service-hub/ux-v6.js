(function(){
  'use strict';
  var STORE='shp_db', UNDO='shp_undo_stack';
  var LOGO_URL='https://www.rokatech-winser.de/wp-content/uploads/go-x/u/e15217ec-0726-4ba7-973f-a03bedee5f55/image-911x911.png';

  var COMPANY_DEFAULTS={
    companyName:'Rohr- & Kanaltechnik Winser',
    street:'Taläckerstraße 49',
    zipCity:'70437 Stuttgart',
    phone:'0152 23401628',
    email:'info@rokatech-winser.de',
    website:'www.rokatech-winser.de',
    logoUrl:LOGO_URL,
    bankName:'Volksbank Zuffenhausen eG',
    iban:'DE78 6009 0300 0424 6090 02',
    bic:'GENODES1ZUF',
    vatId:'DE456265762',
    invoiceIntro:'Für die ausgeführten Arbeiten berechnen wir Ihnen gemäß Rapport / Auftrag folgende Leistungen:',
    paymentText:'Zahlbar bis zum angegebenen Fälligkeitsdatum ohne Abzug.',
    invoiceFooter:'Vielen Dank für Ihren Auftrag und Ihr Vertrauen.'
  };

  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(ch){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}
  function readDb(){try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch(e){return null}}
  function writeDb(db){localStorage.setItem(STORE,JSON.stringify(db))}
  function session(){try{return JSON.parse(sessionStorage.getItem('shp_session')||'null')}catch(e){return null}}
  function isAdmin(){var s=session();return !!(s&&s.user==='admin')}
  function company(db){var c=(db&&db.settings&&db.settings.company)||{};return Object.assign({},COMPANY_DEFAULTS,c)}
  function numberValue(id,fallback){var el=document.getElementById(id),n=parseFloat(el&&el.value);return isNaN(n)?fallback:n}
  function remember(before,label){
    var stack=[];try{stack=JSON.parse(sessionStorage.getItem(UNDO)||'[]')}catch(e){}
    stack.push({snapshot:before,label:label||'Administrative Einstellungen',at:Date.now()});
    sessionStorage.setItem(UNDO,JSON.stringify(stack.slice(-10)));
  }
  function showSaved(){
    var old=document.querySelector('.ux-admin-saved');if(old)old.remove();
    var el=document.createElement('div');el.className='ux-admin-saved';el.innerHTML='<b>Einstellungen gespeichert</b><span>Rechnung und Dokumente verwenden ab jetzt diese Konfiguration.</span><button type="button">Rückgängig</button>';
    el.querySelector('button').onclick=function(){if(window.SHP_UX_TEST_API&&window.SHP_UX_TEST_API.undoLast)window.SHP_UX_TEST_API.undoLast()};
    document.body.appendChild(el);setTimeout(function(){if(el.parentNode)el.remove()},7000);
  }

  function saveAdminSettings(){
    if(!isAdmin())return window.alert('Nur Administration darf Systemeinstellungen ändern.');
    var db=readDb();if(!db)return;
    var before=localStorage.getItem(STORE);db.settings=db.settings||{};
    db.settings.company={
      companyName:(document.getElementById('adm-companyName').value||'').trim()||COMPANY_DEFAULTS.companyName,
      street:(document.getElementById('adm-street').value||'').trim(),
      zipCity:(document.getElementById('adm-zipCity').value||'').trim(),
      phone:(document.getElementById('adm-phone').value||'').trim(),
      email:(document.getElementById('adm-email').value||'').trim(),
      website:(document.getElementById('adm-website').value||'').trim(),
      logoUrl:(document.getElementById('adm-logoUrl').value||'').trim()||COMPANY_DEFAULTS.logoUrl,
      bankName:(document.getElementById('adm-bankName').value||'').trim(),
      iban:(document.getElementById('adm-iban').value||'').trim(),
      bic:(document.getElementById('adm-bic').value||'').trim(),
      vatId:(document.getElementById('adm-vatId').value||'').trim(),
      invoiceIntro:(document.getElementById('adm-invoiceIntro').value||'').trim(),
      paymentText:(document.getElementById('adm-paymentText').value||'').trim(),
      invoiceFooter:(document.getElementById('adm-invoiceFooter').value||'').trim()
    };
    db.settings.vat=numberValue('adm-vat',db.settings.vat||19);
    db.settings.paymentDays=numberValue('adm-paymentDays',db.settings.paymentDays||30);
    db.settings.defaultHourlyRate=numberValue('adm-defaultRate',db.settings.defaultHourlyRate||70);
    writeDb(db);remember(before,'Administrative Einstellungen geändert');showSaved();renderAdminSettings(true);
  }

  function resetDocumentDefaults(){
    if(!isAdmin())return;
    if(!window.confirm('Firmen- und Dokumenteinstellungen auf die Winser-Standardwerte zurücksetzen?'))return;
    var db=readDb(),before=localStorage.getItem(STORE);if(!db)return;db.settings=db.settings||{};db.settings.company=Object.assign({},COMPANY_DEFAULTS);writeDb(db);remember(before,'Dokumenteinstellungen zurückgesetzt');showSaved();renderAdminSettings(true);
  }

  function catalogHtml(db){
    var cat=(db.settings&&db.settings.catalog)||[];
    return '<section class="ux-admin-card ux-admin-wide"><div class="ux-admin-card-head"><div><span class="ux-admin-kicker">Leistungen & Preise</span><h3>Leistungskatalog</h3><p>Globale Leistungen und Standardpreise. Kundenspezifische Abweichungen gehören in den jeweiligen Kundenkontext, nicht auf diese Systemseite.</p></div><button class="btn primary" onclick="SH.addCatalogItem()">+ Leistung</button></div>'+
      '<div class="ux-admin-catalog">'+cat.map(function(it){return '<div class="ux-admin-catalog-row"><span class="ux-admin-dot '+(it.active!==false?'on':'off')+'"></span><div><b>'+esc(it.name)+'</b><small>'+esc(it.unit)+' · '+((+it.price||0).toFixed(2).replace('.',','))+' € Standard</small></div><button class="btn" onclick="SH.editCatalogItem(\''+esc(it.id)+'\')">Bearbeiten</button></div>'}).join('')+'</div></section>';
  }

  function renderAdminSettings(force){
    if(!isAdmin())return;
    var main=document.querySelector('main.shell');if(!main)return;
    var h=main.querySelector('h2');
    if(!force&&(!h||(h.textContent||'').trim()!=='Administration'))return;
    if(main.dataset.adminV6==='1'&&!force)return;
    var db=readDb();if(!db)return;db.settings=db.settings||{};var c=company(db);
    main.dataset.adminV6='1';
    main.innerHTML='<div class="ux-admin-title"><div><span class="ux-admin-kicker">Systemkonfiguration</span><h2>Administration</h2><p>Hier werden ausschließlich globale Einstellungen des Service Hub verwaltet – keine Kunden- oder Rechnungsbearbeitung.</p></div><div class="ux-admin-status"><span></span>Konfiguration aktiv</div></div>'+
      '<div class="ux-admin-grid">'+
        '<section class="ux-admin-card"><div class="ux-admin-card-head"><div><span class="ux-admin-kicker">Unternehmen</span><h3>Branding & Kontaktdaten</h3></div><img class="ux-admin-logo-preview" src="'+esc(c.logoUrl)+'" alt="Winser Logo" onerror="this.style.display=\'none\'"></div>'+
          '<div class="ux-admin-fields"><label>Firmenname<input id="adm-companyName" value="'+esc(c.companyName)+'"></label><label>Straße<input id="adm-street" value="'+esc(c.street)+'"></label><label>PLZ / Ort<input id="adm-zipCity" value="'+esc(c.zipCity)+'"></label><label>Telefon<input id="adm-phone" value="'+esc(c.phone)+'"></label><label>E-Mail<input id="adm-email" type="email" value="'+esc(c.email)+'"></label><label>Webseite<input id="adm-website" value="'+esc(c.website)+'"></label><label class="ux-span-2">Logo-URL<input id="adm-logoUrl" value="'+esc(c.logoUrl)+'"></label></div></section>'+
        '<section class="ux-admin-card"><div class="ux-admin-card-head"><div><span class="ux-admin-kicker">Abrechnung</span><h3>Steuer & Standardwerte</h3><p>Globale Grundlagen für neue Vorgänge und Dokumente.</p></div></div>'+
          '<div class="ux-admin-fields"><label>Mehrwertsteuer %<input id="adm-vat" type="number" step="0.1" value="'+esc(db.settings.vat||19)+'"></label><label>Zahlungsziel Tage<input id="adm-paymentDays" type="number" min="0" value="'+esc(db.settings.paymentDays||30)+'"></label><label>Standard-Stundensatz €/h<input id="adm-defaultRate" type="number" step="0.01" value="'+esc(db.settings.defaultHourlyRate||70)+'"></label><label>Rechnungsnummern<input disabled value="Fortlaufend in +5-Schritten"></label></div><div class="ux-admin-note">Änderungen an Standardwerten wirken auf neu erzeugte Vorgänge; bestehende Rechnungen bleiben historisch unverändert.</div></section>'+
        '<section class="ux-admin-card"><div class="ux-admin-card-head"><div><span class="ux-admin-kicker">Zahlungsdaten</span><h3>Bank & Rechtliches</h3></div></div>'+
          '<div class="ux-admin-fields"><label class="ux-span-2">Bank<input id="adm-bankName" value="'+esc(c.bankName)+'"></label><label class="ux-span-2">IBAN<input id="adm-iban" value="'+esc(c.iban)+'"></label><label>BIC<input id="adm-bic" value="'+esc(c.bic)+'"></label><label>USt-IdNr.<input id="adm-vatId" value="'+esc(c.vatId)+'"></label></div></section>'+
        '<section class="ux-admin-card"><div class="ux-admin-card-head"><div><span class="ux-admin-kicker">Dokumente</span><h3>Rechnungstexte</h3><p>Diese Texte werden direkt in der Rechnung verwendet.</p></div></div>'+
          '<div class="ux-admin-fields ux-admin-texts"><label class="ux-span-2">Einleitung<textarea id="adm-invoiceIntro">'+esc(c.invoiceIntro)+'</textarea></label><label class="ux-span-2">Zahlungshinweis<textarea id="adm-paymentText">'+esc(c.paymentText)+'</textarea></label><label class="ux-span-2">Abschlusstext<textarea id="adm-invoiceFooter">'+esc(c.invoiceFooter)+'</textarea></label></div></section>'+
        '<section class="ux-admin-card ux-admin-wide"><div class="ux-admin-card-head"><div><span class="ux-admin-kicker">Berechtigungen</span><h3>Rollenmodell</h3><p>Globale Rechteübersicht. Operative Kunden- und Rechnungsdaten werden hier bewusst nicht angezeigt.</p></div></div><div class="ux-role-grid"><div><b>Dome · Techniker</b><span>Kunden/Aufträge/Rechnungen sehen</span><span>Rapporte bearbeiten & abschließen</span><em>Keine Preise, Administration oder Rechnungsbearbeitung</em></div><div><b>Annette · Büro</b><span>Kunden & Aufträge verwalten</span><span>Rechnungen, Versand und Status bearbeiten</span><em>Keine globale Systemadministration</em></div><div><b>Admin</b><span>Globale Einstellungen & Katalog</span><span>Dokument-/Preisgrundlagen konfigurieren</span><em>Systemweite Konfiguration</em></div></div></section>'+
      '</div>'+catalogHtml(db)+
      '<div class="ux-admin-actions"><button class="btn" type="button" onclick="SHP_V6.resetDocumentDefaults()">Standardwerte wiederherstellen</button><button class="btn primary" type="button" onclick="SHP_V6.saveAdminSettings()">Einstellungen speichern</button></div>';
  }

  function enhanceInvoiceDocument(){
    var doc=document.querySelector('.doc');if(!doc||doc.dataset.invoiceV6==='1')return;
    var h1=doc.querySelector('h1');if(!h1||(h1.textContent||'').trim()!=='RECHNUNG')return;
    var db=readDb();if(!db)return;var c=company(db);doc.dataset.invoiceV6='1';doc.classList.add('invoice-doc-v6');
    var head=doc.querySelector('.doc-head');if(head){
      var meta=head.querySelector('.doc-company');var metaHtml=meta?meta.innerHTML:'<h1>RECHNUNG</h1>';
      head.classList.add('invoice-head-v6');
      head.innerHTML='<div class="invoice-brand-v6"><img src="'+esc(c.logoUrl)+'" alt="'+esc(c.companyName)+' Logo" onerror="this.style.visibility=\'hidden\'"><div><b class="invoice-brand-name">'+esc(c.companyName)+'</b><span>'+esc(c.street)+'</span><span>'+esc(c.zipCity)+'</span><span>'+esc(c.phone)+' · '+esc(c.email)+'</span><span>'+esc(c.website)+'</span></div></div><div class="invoice-meta-v6">'+metaHtml+'</div>';
    }
    var recipient=doc.querySelector('div[style*="margin:35px"]');if(recipient){recipient.classList.add('invoice-recipient-v6');recipient.removeAttribute('style')}
    var direct=recipient&&recipient.nextElementSibling;if(direct&&direct.tagName==='P'){direct.classList.add('invoice-intro-v6');direct.textContent=c.invoiceIntro||COMPANY_DEFAULTS.invoiceIntro}
    var tables=doc.querySelectorAll('table.doc-table');if(tables[0])tables[0].classList.add('invoice-items-v6');
    var totals=doc.querySelector('table.doc-total');if(totals)totals.classList.add('invoice-totals-v6');
    var afterTotals=totals&&totals.nextElementSibling;if(afterTotals&&afterTotals.tagName==='P'){afterTotals.classList.add('invoice-payment-v6');afterTotals.innerHTML=(c.paymentText?esc(c.paymentText)+'<br>':'')+afterTotals.innerHTML}
    var foot=doc.querySelector('p.small');if(foot){foot.classList.add('invoice-footer-v6');foot.innerHTML='<b>'+esc(c.companyName)+'</b><br>'+esc(c.bankName)+' · IBAN '+esc(c.iban)+' · BIC '+esc(c.bic)+'<br>USt-IdNr.: '+esc(c.vatId)+' · '+esc(c.email)+' · '+esc(c.website)+'<br><span>'+esc(c.invoiceFooter)+'</span>'}
    var marker=document.createElement('div');marker.className='invoice-brand-line-v6';doc.insertBefore(marker,doc.firstChild);
  }

  function enhanceAdminNav(){
    if(!isAdmin())return;var desktop=document.querySelector('.nav.desktop');if(!desktop)return;
    var adminButton=[].slice.call(desktop.querySelectorAll('button')).find(function(b){return (b.textContent||'').trim()==='Administration'});
    if(adminButton){adminButton.textContent='⚙ Administration';adminButton.title='Systemeinstellungen'}
  }

  function enhance(){enhanceAdminNav();renderAdminSettings(false);enhanceInvoiceDocument()}
  var scheduled=false;function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;enhance()})}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  window.SHP_V6={saveAdminSettings:saveAdminSettings,resetDocumentDefaults:resetDocumentDefaults,renderAdminSettings:function(){renderAdminSettings(true)},companyDefaults:COMPANY_DEFAULTS};
  enhance();
})();
