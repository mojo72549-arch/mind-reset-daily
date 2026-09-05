(function(){
  'use strict';
  var BUILD='20260905-v12-admin-only1';
  var SESSION='shp_session';
  var wired=false,redirecting=false,scheduled=false;

  function current(){try{return JSON.parse(sessionStorage.getItem(SESSION)||'null')}catch(e){return null}}
  function isAdmin(){var s=current();return !!(s&&String(s.user||'').toLowerCase()==='admin')}

  function renderSettings(){
    if(!isAdmin())return;
    window.setTimeout(function(){
      if(window.SHP_V6&&typeof window.SHP_V6.renderAdminSettings==='function'){
        window.SHP_V6.renderAdminSettings();
      }
      lockNavigation();
    },0);
  }

  function lockNavigation(){
    if(!isAdmin()||!window.SH)return;
    var desktop=document.querySelector('.nav.desktop');
    if(desktop){
      desktop.innerHTML='<button class="btn primary" type="button" onclick="SH.go(\'admin\')">⚙ Einstellungen</button><button class="btn" type="button" onclick="SH.logout()">Abmelden</button>';
      desktop.dataset.adminOnly=BUILD;
    }
    var mobile=document.querySelector('nav.mobile');
    if(mobile){
      mobile.innerHTML='<button type="button" onclick="SH.go(\'admin\')">⚙<br>Einstellungen</button><button type="button" onclick="SH.logout()">↪<br>Logout</button>';
      mobile.dataset.adminOnly=BUILD;
      mobile.classList.remove('shp-six-tab-nav');
    }
    document.documentElement.dataset.shAdminAccess=BUILD;
  }

  function forceSettings(){
    if(!isAdmin()||!window.SH||redirecting)return;
    var main=document.querySelector('main.shell');
    var heading=main&&(main.querySelector('h2')||main.querySelector('h1'));
    var title=(heading&&heading.textContent||'').trim();
    var isSettings=title==='Administration'||main&&main.querySelector('.ux-admin-title');
    if(!isSettings&&window.__SHP_ADMIN_ORIGINAL_GO){
      redirecting=true;
      try{window.__SHP_ADMIN_ORIGINAL_GO.call(window.SH,'admin')}finally{redirecting=false}
      renderSettings();
    }else{
      renderSettings();
    }
  }

  function blockOperationalApi(){
    if(!window.SH)return;
    var blocked=[
      'newCustomer','openCustomer','editCustomer','newOrder','openReport','saveReportText','startReport','endReport',
      'addReportLine','removeReportLine','addMaterial','removeMaterial','addMeasurement','removeMeasurement','clearSig',
      'finishReport','printReport','invoiceFromReport','openInvoice','saveInvoiceStatus','printInvoice',
      'sendReportPreferred','sendInvoicePreferred','sendInvoice','backApp'
    ];
    blocked.forEach(function(name){
      if(typeof window.SH[name]!=='function'||window.SH[name].__adminGuarded)return;
      var original=window.SH[name];
      var guarded=function(){
        if(isAdmin()){
          forceSettings();
          return false;
        }
        return original.apply(window.SH,arguments);
      };
      guarded.__adminGuarded=true;
      window.SH[name]=guarded;
    });
  }

  function wire(){
    if(!window.SH||typeof window.SH.go!=='function')return;
    if(!wired){
      wired=true;
      var previousGo=window.SH.go;
      window.__SHP_ADMIN_ORIGINAL_GO=previousGo;
      window.SH.go=function(tab){
        if(isAdmin()){
          if(tab!=='admin')tab='admin';
          var result=previousGo.call(window.SH,tab);
          renderSettings();
          return result;
        }
        return previousGo.apply(window.SH,arguments);
      };
    }
    blockOperationalApi();
    if(isAdmin())forceSettings();
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(function(){scheduled=false;wire();lockNavigation()});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule);else schedule();
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();
