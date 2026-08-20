(function(){
  'use strict';
  var wired=false;
  function wire(){
    if(wired||!window.SH||!window.SHP_V6||typeof window.SH.go!=='function')return;
    wired=true;
    var previousGo=window.SH.go;
    window.SH.go=function(tab){
      var result=previousGo.apply(window.SH,arguments);
      if(tab==='admin'){
        window.setTimeout(function(){
          if(window.SHP_V6&&typeof window.SHP_V6.renderAdminSettings==='function')window.SHP_V6.renderAdminSettings();
        },0);
      }
      return result;
    };
    var s=null;try{s=JSON.parse(sessionStorage.getItem('shp_session')||'null')}catch(e){}
    if(s&&s.user==='admin'){
      var h=document.querySelector('main.shell h2');
      if(h&&(h.textContent||'').trim()==='Administration')window.SHP_V6.renderAdminSettings();
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
  new MutationObserver(wire).observe(document.documentElement,{childList:true,subtree:true});
})();
