(function(){
  'use strict';
  var BUILD='20260905-v12-admin-only2';
  var SESSION='shp_session';
  var wired=false,redirecting=false,scheduled=false,renderQueued=false;

  function current(){try{return JSON.parse(sessionStorage.getItem(SESSION)||'null')}catch(e){return null}}
  function isAdmin(){var s=current();return !!(s&&String(s.user||'').toLowerCase()==='admin')}
  function main(){return document.querySelector('main.shell')}
  function settingsVisible(){var m=main();return !!(m&&m.querySelector('.ux-admin-title'))}

  function navIsCorrect(nav,mobile){
    if(!nav)return true;
    var buttons=nav.querySelectorAll('button');
    if(buttons.length!==2)return false;
    var text=(nav.textContent||'').replace(/\s+/g,' ').trim();
    if(text.indexOf('Einstellungen')<0)return false;
    return mobile?text.indexOf('Logout')>=0:text.indexOf('Abmelden')>=0;
  }

  function lockNavigation(){
    if(!isAdmin()||!window.SH)return;
    var desktop=document.querySelector('.nav.desktop');
    if(desktop&&!navIsCorrect(desktop,false)){
      desktop.innerHTML='<button class="btn primary" type="button" onclick="SH.go(\'admin\')">⚙ Einstellungen</button><button class="btn" type="button" onclick="SH.logout()">Abmelden</button>';
    }
    if(desktop)desktop.dataset.adminOnly=BUILD;

    var mobile=document.querySelector('nav.mobile');
    if(mobile&&!navIsCorrect(mobile,true)){
      mobile.innerHTML='<button type="button" onclick="SH.go(\'admin\')">⚙<br>Einstellungen</button><button type="button" onclick="SH.logout()">↪<br>Logout</button>';
    }
    if(mobile){
      mobile.dataset.adminOnly=BUILD;
      if(mobile.classList.contains('shp-six-tab-nav'))mobile.classList.remove('shp-six-tab-nav');
    }
    if(document.documentElement.dataset.shAdminAccess!==BUILD)document.documentElement.dataset.shAdminAccess=BUILD;
  }

  function renderSettingsIfNeeded(){
    if(!isAdmin()||settingsVisible()||renderQueued)return;
    renderQueued=true;
    window.setTimeout(function(){
      renderQueued=false;
      if(!isAdmin())return;
      if(!settingsVisible()&&window.SHP_V6&&typeof window.SHP_V6.renderAdminSettings==='function'){
        window.SHP_V6.renderAdminSettings();
      }
      lockNavigation();
    },0);
  }

  function forceSettings(){
    if(!isAdmin()||!window.SH||redirecting)return;
    if(settingsVisible()){
      lockNavigation();
      return;
    }
    if(window.__SHP_ADMIN_ORIGINAL_GO){
      redirecting=true;
      try{window.__SHP_ADMIN_ORIGINAL_GO.call(window.SH,'admin')}finally{redirecting=false}
    }
    renderSettingsIfNeeded();
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
          if(settingsVisible()){
            lockNavigation();
            return false;
          }
          var result=previousGo.call(window.SH,tab);
          renderSettingsIfNeeded();
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
    requestAnimationFrame(function(){scheduled=false;wire();if(isAdmin())lockNavigation()});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule);else schedule();
  var target=document.getElementById('app')||document.body;
  new MutationObserver(schedule).observe(target,{childList:true,subtree:true});
})();
