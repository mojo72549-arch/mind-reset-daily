(function(){
  'use strict';
  var VERSION='20260903-v9-3';
  var wrapped=false;

  function logoImage(){return document.querySelector('.invoice-brand-v6 img')}

  function fallback(img){
    if(!img)return;
    img.style.display='none';
    var brand=img.closest('.invoice-brand-v6');
    if(!brand||brand.querySelector('.invoice-logo-fallback-v6'))return;
    var el=document.createElement('div');
    el.className='invoice-logo-fallback-v6';
    el.setAttribute('role','img');
    el.setAttribute('aria-label','Rohr- & Kanaltechnik Winser');
    el.innerHTML='<b>ROHR- &amp;<br>KANALTECHNIK</b><span>WINSER</span>';
    el.style.cssText='width:112px;height:112px;flex:0 0 112px;border:2px solid #0b2a49;border-radius:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#0b2a49;background:#fff;font-size:10px;line-height:1.1;font-weight:900;letter-spacing:.03em';
    var span=el.querySelector('span');if(span)span.style.cssText='font-size:9px;margin-top:5px;letter-spacing:.14em';
    brand.insertBefore(el,img);
  }

  function prepareLogo(){
    var img=logoImage();if(!img)return null;
    img.setAttribute('referrerpolicy','no-referrer');
    img.setAttribute('fetchpriority','high');
    img.setAttribute('decoding','async');
    if(img.dataset.shLogoGuard!=='1'){
      img.dataset.shLogoGuard='1';
      img.addEventListener('error',function(){fallback(img)},{once:true});
    }
    if(img.complete&&img.naturalWidth===0)fallback(img);
    return img;
  }

  function waitForLogo(timeout){
    timeout=timeout||7000;
    return new Promise(function(resolve){
      var img=prepareLogo();
      if(!img){resolve(false);return}
      if(img.complete&&img.naturalWidth>0){
        if(typeof img.decode==='function')img.decode().then(function(){resolve(true)}).catch(function(){resolve(true)});
        else resolve(true);
        return;
      }
      if(img.complete&&img.naturalWidth===0){fallback(img);resolve(false);return}
      var done=false,timer;
      function finish(ok){if(done)return;done=true;clearTimeout(timer);img.removeEventListener('load',onload);img.removeEventListener('error',onerror);if(!ok)fallback(img);resolve(ok)}
      function onload(){
        if(typeof img.decode==='function')img.decode().then(function(){finish(img.naturalWidth>0)}).catch(function(){finish(img.naturalWidth>0)});
        else finish(img.naturalWidth>0);
      }
      function onerror(){finish(false)}
      img.addEventListener('load',onload,{once:true});
      img.addEventListener('error',onerror,{once:true});
      timer=setTimeout(function(){finish(img.complete&&img.naturalWidth>0)},timeout);
    });
  }

  function wrapInvoicePrint(){
    if(wrapped||!window.SH||typeof window.SH.printInvoice!=='function')return;
    wrapped=true;
    var original=window.SH.printInvoice;
    window.SH.printInvoice=function(){
      var actualPrint=window.print;
      var intercepted=false;
      window.print=function(){
        if(intercepted)return;
        intercepted=true;
        waitForLogo(7000).then(function(){
          window.print=actualPrint;
          requestAnimationFrame(function(){requestAnimationFrame(function(){actualPrint.call(window)})});
        });
      };
      try{return original.apply(window.SH,arguments)}
      finally{setTimeout(function(){if(!intercepted&&window.print!==actualPrint)window.print=actualPrint},8000)}
    };
  }

  function enhance(){prepareLogo();wrapInvoicePrint();document.documentElement.dataset.shInvoiceLogo=VERSION}
  var queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;enhance()})}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  enhance();
  window.SHP_INVOICE_LOGO={version:VERSION,prepareLogo:prepareLogo,waitForLogo:waitForLogo};
})();
