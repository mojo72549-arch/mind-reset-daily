(function(){
  'use strict';

  if(window.SHP_SCROLL_GUARD)return;

  var BUILD='20260909-v21-global-scroll1';
  var root=document.documentElement;

  function visibleModal(){
    var modal=document.getElementById('shp-app-modal');
    if(!modal)return null;
    var style=window.getComputedStyle?getComputedStyle(modal):null;
    if(style&&(style.display==='none'||style.visibility==='hidden'))return null;
    return modal;
  }

  function clearStaleInlineLock(el){
    if(!el||!el.style)return;
    if(el.style.overflow==='hidden')el.style.removeProperty('overflow');
    if(el.style.overflowY==='hidden')el.style.removeProperty('overflow-y');
    if(el.style.maxHeight==='100vh'||el.style.maxHeight==='100dvh')el.style.removeProperty('max-height');
  }

  function sync(){
    var modal=visibleModal();
    if(modal){
      root.dataset.shScrollState='modal';
      return;
    }

    if(root.classList.contains('shp-modal-open'))root.classList.remove('shp-modal-open');
    clearStaleInlineLock(root);
    clearStaleInlineLock(document.body);
    root.dataset.shScrollState='free';
  }

  function schedule(){
    if(window.requestAnimationFrame)requestAnimationFrame(sync);
    else setTimeout(sync,0);
  }

  if(window.SHP_STABILITY&&typeof window.SHP_STABILITY.register==='function'){
    window.SHP_STABILITY.register('global-scroll-guard',sync);
  }else{
    schedule();
  }

  window.addEventListener('pageshow',schedule,{passive:true});
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',schedule,{passive:true});
  document.addEventListener('visibilitychange',function(){if(!document.hidden)schedule()},{passive:true});

  /* Recover after closing/cancelling a dialog even if another handler throws. */
  document.addEventListener('click',function(event){
    var target=event.target&&event.target.closest?event.target.closest('.shp-modal-close,.shp-modal-cancel'):null;
    if(target)setTimeout(sync,0);
  },true);

  document.addEventListener('submit',function(event){
    if(event.target&&event.target.closest&&event.target.closest('#shp-app-modal'))setTimeout(sync,0);
  },true);

  root.dataset.shScrollBuild=BUILD;
  window.SHP_SCROLL_GUARD={build:BUILD,sync:sync,state:function(){return root.dataset.shScrollState||''}};
  schedule();
})();
