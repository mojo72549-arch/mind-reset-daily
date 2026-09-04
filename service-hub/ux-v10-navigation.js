(function(){
  'use strict';
  var BUILD='20260904-v10-nav1';
  var SESSION='shp_session';
  var scheduled=false;

  function loggedIn(){
    try{return !!JSON.parse(sessionStorage.getItem(SESSION)||'null')}catch(e){return false}
  }

  function renderNav(){
    if(!loggedIn()||!window.SH)return;
    var nav=document.querySelector('nav.mobile');
    if(!nav)return;
    var desired='\
      <button type="button" data-tab="home" onclick="SH.go(\'home\')"><span aria-hidden="true">⌂</span><b>Start</b></button>\
      <button type="button" data-tab="customers" onclick="SH.go(\'customers\')"><span aria-hidden="true">♙</span><b>Kunde</b></button>\
      <button type="button" data-tab="orders" onclick="SH.go(\'orders\')"><span aria-hidden="true">▣</span><b>Auftrag</b></button>\
      <button type="button" data-tab="reports" onclick="SH.go(\'reports\')"><span aria-hidden="true">✓</span><b>Rapport</b></button>\
      <button type="button" data-tab="invoices" onclick="SH.go(\'invoices\')"><span aria-hidden="true">€</span><b>Rechnung</b></button>\
      <button type="button" data-tab="logout" onclick="SH.logout()"><span aria-hidden="true">↪</span><b>Logout</b></button>';
    if(nav.dataset.shNavBuild!==BUILD){
      nav.innerHTML=desired;
      nav.dataset.shNavBuild=BUILD;
      nav.classList.add('shp-six-tab-nav');
    }
    markActive(nav);
    document.documentElement.setAttribute('data-sh-mobile-nav',BUILD);
  }

  function detectTab(){
    var main=document.querySelector('main.shell');
    if(!main)return 'home';
    var text=((main.querySelector('h1')||main.querySelector('h2')||{}).textContent||'').trim();
    if(/Rechnung/i.test(text))return 'invoices';
    if(/Rapport/i.test(text))return 'reports';
    if(/Auftr[aä]g/i.test(text))return 'orders';
    if(/Kunden/i.test(text))return 'customers';
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

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(function(){scheduled=false;renderNav()});
  }

  new MutationObserver(schedule).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  window.SHP_MOBILE_NAV={build:BUILD,render:renderNav};
  renderNav();
})();
