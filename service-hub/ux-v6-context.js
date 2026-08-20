(function(){
  'use strict';
  var wired=false;
  function getSession(){try{return JSON.parse(sessionStorage.getItem('shp_session')||'null')}catch(e){return null}}
  function isAdmin(){var s=getSession();return !!(s&&s.user==='admin')}
  function wireCustomerPricing(){
    if(wired||!window.SH)return;
    wired=true;
    window.SH.goAdminCustomer=function(id){
      if(window.SHP_UX_TEST_API&&window.SHP_UX_TEST_API.allowed&&!window.SHP_UX_TEST_API.allowed('managePricing'))return window.alert('Diese Funktion ist für Büro / Administration vorgesehen.');
      if(typeof window.SH.editCustomerPricing==='function')return window.SH.editCustomerPricing(id);
    };
  }
  function relabelCustomerButtons(){
    document.querySelectorAll('button').forEach(function(btn){
      if((btn.textContent||'').trim()==='In Administration bearbeiten')btn.textContent='Konditionen bearbeiten';
    });
  }
  function mobileAdminAccess(){
    if(!isAdmin())return;var top=document.querySelector('.top');if(!top||top.querySelector('.ux-admin-mobile-link'))return;
    var b=document.createElement('button');b.type='button';b.className='ux-admin-mobile-link';b.textContent='⚙ Einstellungen';b.onclick=function(){SH.go('admin')};top.appendChild(b);
  }
  function enhance(){wireCustomerPricing();relabelCustomerButtons();mobileAdminAccess()}
  var queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;enhance()})}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});enhance();
})();
