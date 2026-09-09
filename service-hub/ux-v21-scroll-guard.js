(function(){
  'use strict';

  var scheduled=false;
  var root=document.documentElement;

  function modalVisible(){
    var modal=document.getElementById('shp-app-modal');
    if(!modal||!modal.isConnected)return false;
    var style=window.getComputedStyle(modal);
    return style.display!=='none'&&style.visibility!=='hidden'&&modal.getClientRects().length>0;
  }

  function clearInlineLock(el){
    if(!el)return;
    var style=el.style;
    if(style.overflow==='hidden')style.removeProperty('overflow');
    if(style.overflowY==='hidden')style.removeProperty('overflow-y');
    if(style.position==='fixed'&&el===document.body)style.removeProperty('position');
    if(style.height==='100vh'||style.height==='100%')style.removeProperty('height');
  }

  function ensureScrollable(){
    scheduled=false;
    var body=document.body;
    if(!body||modalVisible())return;

    if(root.classList.contains('shp-modal-open'))root.classList.remove('shp-modal-open');
    clearInlineLock(root);
    clearInlineLock(body);

    var rootStyle=window.getComputedStyle(root);
    var bodyStyle=window.getComputedStyle(body);
    if(rootStyle.overflowY==='hidden')root.style.setProperty('overflow-y','auto','important');
    if(bodyStyle.overflowY==='hidden')body.style.setProperty('overflow-y','auto','important');

    body.style.setProperty('touch-action','pan-y pinch-zoom');
    body.style.setProperty('-webkit-overflow-scrolling','touch');
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(ensureScrollable);
  }

  function installStyle(){
    if(document.getElementById('shp-scroll-guard-style'))return;
    var style=document.createElement('style');
    style.id='shp-scroll-guard-style';
    style.textContent='html:not(.shp-modal-open),html:not(.shp-modal-open) body{overflow-y:auto!important;max-height:none!important}body{touch-action:pan-y pinch-zoom;-webkit-overflow-scrolling:touch}';
    document.head.appendChild(style);
  }

  installStyle();
  ensureScrollable();

  ['pageshow','resize','orientationchange','hashchange','popstate'].forEach(function(name){
    window.addEventListener(name,schedule,{passive:true});
  });
  document.addEventListener('click',function(){setTimeout(schedule,0)},true);
  document.addEventListener('touchend',function(){setTimeout(schedule,0)},{passive:true,capture:true});

  var observer=new MutationObserver(function(records){
    for(var i=0;i<records.length;i++){
      var target=records[i].target;
      if(target===root||target===document.body||records[i].type==='childList'){
        schedule();
        break;
      }
    }
  });
  observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
})();
