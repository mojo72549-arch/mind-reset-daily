(function(){
  'use strict';
  var installed=false;
  function keepLatestToast(){
    var list=[].slice.call(document.querySelectorAll('.toast'));
    if(list.length<=1)return;
    list.slice(0,-1).forEach(function(el){if(el&&el.parentNode)el.parentNode.removeChild(el)});
  }
  function install(){
    if(installed||!window.SH||typeof window.SH.finishReport!=='function')return;
    installed=true;
    var original=window.SH.finishReport;
    window.SH.finishReport=function(){
      var result=original.apply(window.SH,arguments);
      keepLatestToast();
      return result;
    };
  }
  function enhance(){install();keepLatestToast()}
  var observer=new MutationObserver(function(){queueMicrotask(enhance)});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  enhance();
  window.SHP_V11_QUALITY_FIXES={keepLatestToast:keepLatestToast,enhance:enhance};
})();
