(function(){
  'use strict';
  var BUILD='20260906-v14-state-safety1';
  var ADMIN_DRAFT='shp_admin_form_draft';
  var MEMORY_DRAFT='shp_dome_memory_drafts';
  var scheduled=false,wrapped=false;

  function session(){try{return JSON.parse(sessionStorage.getItem('shp_session')||'null')}catch(e){return null}}
  function isAdmin(){var s=session();return !!(s&&String(s.user||'').toLowerCase()==='admin')}
  function read(storage,key,fallback){try{return JSON.parse(storage.getItem(key)||'null')||fallback}catch(e){return fallback}}
  function write(storage,key,value){try{storage.setItem(key,JSON.stringify(value))}catch(e){}}

  function captureAdmin(){
    if(!isAdmin())return;
    var fields=[].slice.call(document.querySelectorAll('[id^="adm-"]'));
    if(!fields.length)return;
    var draft={};fields.forEach(function(el){draft[el.id]=el.type==='checkbox'?!!el.checked:el.value});
    write(sessionStorage,ADMIN_DRAFT,draft);
  }
  function restoreAdmin(){
    if(!isAdmin())return;
    var draft=read(sessionStorage,ADMIN_DRAFT,null);if(!draft)return;
    Object.keys(draft).forEach(function(id){
      var el=document.getElementById(id);if(!el||el.dataset.stateSafetyRestored===BUILD)return;
      if(el.type==='checkbox')el.checked=!!draft[id];else el.value=draft[id];
      el.dataset.stateSafetyRestored=BUILD;
    });
  }
  function clearAdmin(){try{sessionStorage.removeItem(ADMIN_DRAFT)}catch(e){}}

  function memoryKey(root){return root&&String(root.getAttribute('data-order-id')||'')}
  function captureMemory(input){
    var root=input&&input.closest('.dome-order-memory-v12'),key=memoryKey(root);if(!key)return;
    var drafts=read(localStorage,MEMORY_DRAFT,{});drafts[key]=input.value;write(localStorage,MEMORY_DRAFT,drafts);
  }
  function clearMemory(root){
    var key=memoryKey(root);if(!key)return;
    var drafts=read(localStorage,MEMORY_DRAFT,{});delete drafts[key];write(localStorage,MEMORY_DRAFT,drafts);
  }
  function restoreMemory(){
    var drafts=read(localStorage,MEMORY_DRAFT,{});
    document.querySelectorAll('.dome-order-memory-v12').forEach(function(root){
      var input=root.querySelector('.dome-order-memory-input'),key=memoryKey(root);if(!input||!key||input.dataset.stateSafetyRestored===BUILD)return;
      input.dataset.stateSafetyRestored=BUILD;
      if(Object.prototype.hasOwnProperty.call(drafts,key)&&!input.value){input.value=drafts[key];input.dispatchEvent(new Event('input',{bubbles:true}))}
    });
  }

  function wrapApi(){
    if(wrapped)return;
    if(window.SHP_V6){
      if(typeof window.SHP_V6.saveAdminSettings==='function'&&!window.SHP_V6.saveAdminSettings.__stateSafety){
        var save=window.SHP_V6.saveAdminSettings;window.SHP_V6.saveAdminSettings=function(){var out=save.apply(window.SHP_V6,arguments);clearAdmin();return out};window.SHP_V6.saveAdminSettings.__stateSafety=true;
      }
      if(typeof window.SHP_V6.resetDocumentDefaults==='function'&&!window.SHP_V6.resetDocumentDefaults.__stateSafety){
        var reset=window.SHP_V6.resetDocumentDefaults;window.SHP_V6.resetDocumentDefaults=function(){clearAdmin();return reset.apply(window.SHP_V6,arguments)};window.SHP_V6.resetDocumentDefaults.__stateSafety=true;
      }
    }
    if(window.SH&&typeof window.SH.logout==='function'&&!window.SH.logout.__stateSafety){
      var logout=window.SH.logout;window.SH.logout=function(){if(isAdmin())clearAdmin();return logout.apply(window.SH,arguments)};window.SH.logout.__stateSafety=true;
    }
    wrapped=!!(window.SH&&window.SHP_V6);
  }

  document.addEventListener('input',function(e){
    var t=e.target;if(!t)return;
    if(t.id&&t.id.indexOf('adm-')===0)captureAdmin();
    if(t.classList&&t.classList.contains('dome-order-memory-input'))captureMemory(t);
  },true);
  document.addEventListener('change',function(e){var t=e.target;if(t&&t.id&&t.id.indexOf('adm-')===0)captureAdmin()},true);
  document.addEventListener('click',function(e){
    var btn=e.target&&e.target.closest&&e.target.closest('.dome-order-memory-save');
    if(!btn)return;
    var root=btn.closest('.dome-order-memory-v12');setTimeout(function(){var input=root&&root.querySelector('.dome-order-memory-input');if(input&&!input.value)clearMemory(root)},0);
  },true);

  function enhance(){wrapApi();restoreAdmin();restoreMemory();document.documentElement.dataset.shStateSafety=BUILD}
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;enhance()})}
  new MutationObserver(schedule).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  window.SHP_STATE_SAFETY={build:BUILD,captureAdmin:captureAdmin,restoreAdmin:restoreAdmin};enhance();
})();
