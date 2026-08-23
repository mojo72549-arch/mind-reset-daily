(function(){
  'use strict';
  var STORE='shp_db',wrapped=false;
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function show(label){
    var old=document.querySelector('.ux-undo-toast');if(old)old.remove();
    var el=document.createElement('div');el.className='ux-undo-toast';el.innerHTML='<span>'+esc(label)+'</span><button type="button">Rückgängig</button>';
    el.querySelector('button').onclick=function(){if(window.SHP_UX_TEST_API&&window.SHP_UX_TEST_API.undoLast)window.SHP_UX_TEST_API.undoLast()};document.body.appendChild(el);
    setTimeout(function(){if(el.parentNode)el.remove()},6500);
  }
  function wrap(){
    if(wrapped||!window.SH)return;wrapped=true;
    [['newCustomer','Kunde angelegt'],['editCustomer','Kundendaten geändert'],['newOrder','Auftrag angelegt']].forEach(function(pair){
      var name=pair[0],label=pair[1],original=window.SH[name];if(typeof original!=='function')return;
      window.SH[name]=function(){var before=localStorage.getItem(STORE),r=original.apply(window.SH,arguments),after=localStorage.getItem(STORE);if(before!==after)show(label);return r};
    });
  }
  wrap();
})();
