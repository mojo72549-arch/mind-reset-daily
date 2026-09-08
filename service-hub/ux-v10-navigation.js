(function(){
  'use strict';
  var BUILD='20260908-v10-nav-role-guard3';
  var SESSION='shp_session';
  var scheduled=false,guarded=false;

  function session(){try{return JSON.parse(sessionStorage.getItem(SESSION)||'null')}catch(e){return null}}
  function loggedIn(){return !!session()}
  function user(){var s=session();return String(s&&s.user||'').toLowerCase()}
  function sharedRole(){var u=user();return u==='dome'||u==='annette'}
  function isTech(){var s=session(),u=user();return u==='dome'||String(s&&s.role||'').toLowerCase()==='tech'}

  function desiredMobile(){
    var invoice=isTech()?'':'\
      <button type="button" data-tab="invoices" onclick="SH.go(\'invoices\')"><span aria-hidden="true">€</span><b>Rechnung</b></button>';
    return '\
      <button type="button" data-tab="home" onclick="SH.go(\'home\')"><span aria-hidden="true">⌂</span><b>Start</b></button>\
      <button type="button" data-tab="customers" onclick="SH.go(\'customers\')"><span aria-hidden="true">♙</span><b>Kunde</b></button>\
      <button type="button" data-tab="orders" onclick="SH.go(\'orders\')"><span aria-hidden="true">▣</span><b>Auftrag</b></button>\
      <button type="button" data-tab="reports" onclick="SH.go(\'reports\')"><span aria-hidden="true">✓</span><b>Rapport</b></button>'+invoice+'\
      <button type="button" data-tab="logout" onclick="SH.logout()"><span aria-hidden="true">↪</span><b>Logout</b></button>';
  }

  function desiredDesktop(){
    var invoice=isTech()?'':'\
      <button class="navbtn" data-tab="invoices" onclick="SH.go(\'invoices\')">Rechnung</button>';
    return '\
      <button class="navbtn" data-tab="home" onclick="SH.go(\'home\')">Start</button>\
      <button class="navbtn" data-tab="customers" onclick="SH.go(\'customers\')">Kunde</button>\
      <button class="navbtn" data-tab="orders" onclick="SH.go(\'orders\')">Auftrag</button>\
      <button class="navbtn" data-tab="reports" onclick="SH.go(\'reports\')">Rapport</button>'+invoice+'\
      <button class="navbtn logout" data-tab="logout" onclick="SH.logout()">Logout</button>';
  }

  function denyFinancialAccess(){
    if(guarded||!window.SH)return;
    guarded=true;
    if(typeof window.SH.go==='function'){
      var go=window.SH.go;
      window.SH.go=function(tab){
        var target=String(tab||'').toLowerCase();
        if(isTech()&&(target==='invoices'||target==='invoice'||target==='admin'))return go.call(window.SH,'home');
        return go.apply(window.SH,arguments);
      };
    }
    if(typeof window.SH.openInvoice==='function'){
      var openInvoice=window.SH.openInvoice;
      window.SH.openInvoice=function(){if(isTech())return window.SH.go('home');return openInvoice.apply(window.SH,arguments)};
    }
    ['invoiceFromReport','sendInvoicePreferred','sendInvoice','saveInvoiceStatus','printInvoice'].forEach(function(name){
      if(typeof window.SH[name]!=='function')return;
      var fn=window.SH[name];
      window.SH[name]=function(){if(isTech())return false;return fn.apply(window.SH,arguments)};
    });
  }

  function detectTab(){
    var main=document.querySelector('main.shell');
    if(!main)return 'home';
    var text=((main.querySelector('h1')||main.querySelector('h2')||{}).textContent||'').trim();
    if(/^Start$/i.test(text)||main.querySelector('.crm-start-slim-v12'))return 'home';
    if(/Rechnung/i.test(text))return 'invoices';
    if(/Rapport/i.test(text))return 'reports';
    if(/Auftr[aä]g/i.test(text))return 'orders';
    if(/Kunden?/i.test(text))return 'customers';
    if(main.querySelector('.crm-customer-detail,.customer-detail,[data-customer-id]'))return 'customers';
    return 'home';
  }

  function markActive(nav){
    var active=detectTab();
    nav.querySelectorAll('button[data-tab]').forEach(function(btn){
      var on=btn.getAttribute('data-tab')===active;
      btn.classList.toggle('ux-active',on);
      if(on)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current');
    });
  }

  function removeForbiddenFinancialUi(){
    if(!isTech())return;
    document.querySelectorAll('button[data-tab="invoices"],button[onclick*="invoices"],button[onclick*="openInvoice"],button[onclick*="invoiceFromReport"]').forEach(function(btn){btn.remove()});
  }

  function renderNav(){
    if(!loggedIn()||!window.SH)return;
    denyFinancialAccess();
    var mobile=document.querySelector('nav.mobile');
    if(mobile){
      if(mobile.dataset.shNavBuild!==BUILD){mobile.innerHTML=desiredMobile();mobile.dataset.shNavBuild=BUILD;mobile.classList.add('shp-six-tab-nav')}
      markActive(mobile);
    }
    if(sharedRole()){
      var desktop=document.querySelector('.nav.desktop');
      if(desktop){
        if(desktop.dataset.shNavBuild!==BUILD){desktop.innerHTML=desiredDesktop();desktop.dataset.shNavBuild=BUILD}
        markActive(desktop);
      }
    }
    removeForbiddenFinancialUi();
    document.documentElement.setAttribute('data-sh-mobile-nav',BUILD);
  }

  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;renderNav()})}
  new MutationObserver(schedule).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  window.SHP_MOBILE_NAV={build:BUILD,render:renderNav,isTech:isTech};
  renderNav();
})();