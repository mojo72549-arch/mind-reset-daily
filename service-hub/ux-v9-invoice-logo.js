(function(){
  'use strict';
  var VERSION='20260903-v9-5';
  var LOCAL_LOGO='./assets/rokatech-winser-logo.webp';
  var LEGACY_LOGO='https://www.rokatech-winser.de/wp-content/uploads/go-x/u/e15217ec-0726-4ba7-973f-a03bedee5f55/image-911x911.png';
  var STORE='shp_db';
  var wrapped=false;

  function readDb(){try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch(e){return null}}
  function writeDb(db){try{localStorage.setItem(STORE,JSON.stringify(db));return true}catch(e){return false}}
  function legacySource(src){src=String(src||'').trim();return !src||src===LEGACY_LOGO||/rokatech-winser\.de\/.*image-911x911\.png/i.test(src)}

  function migrateBranding(){
    if(window.SHP_V6&&window.SHP_V6.companyDefaults)window.SHP_V6.companyDefaults.logoUrl=LOCAL_LOGO;
    var db=readDb();if(!db)return false;
    db.settings=db.settings||{};db.settings.company=db.settings.company||{};
    if(legacySource(db.settings.company.logoUrl)){
      db.settings.company.logoUrl=LOCAL_LOGO;
      writeDb(db);
      return true;
    }
    return false;
  }

  function installStyle(){
    if(document.getElementById('shp-invoice-logo-v95-style'))return;
    var style=document.createElement('style');
    style.id='shp-invoice-logo-v95-style';
    style.textContent='\
      .invoice-brand-v6 img.shp-company-logo-v95{width:132px!important;height:132px!important;object-fit:contain!important;object-position:center!important;flex:0 0 132px!important;background:#fff!important;border:0!important;border-radius:0!important;padding:0!important}\
      .invoice-logo-fallback-v95{width:132px;height:132px;flex:0 0 132px;display:flex;align-items:center;justify-content:center;text-align:center;padding:14px;border:1px solid #cbd6df;background:#fff;color:#0b2a49;font-size:13px;font-weight:900;line-height:1.25}\
      .shp-logo-local-note{display:block;margin-top:6px;color:var(--ux-muted,#657482);font-size:11px;font-weight:600;line-height:1.35}\
      @media(max-width:850px){.invoice-brand-v6 img.shp-company-logo-v95,.invoice-logo-fallback-v95{width:104px!important;height:104px!important;flex-basis:104px!important}}\
      @media print{.invoice-brand-v6 img.shp-company-logo-v95{width:32mm!important;height:32mm!important;flex-basis:32mm!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.invoice-logo-fallback-v95{width:32mm!important;height:32mm!important;flex-basis:32mm!important}}';
    document.head.appendChild(style);
  }

  function removeFallback(brand){var old=brand&&brand.querySelector('.invoice-logo-fallback-v95');if(old)old.remove()}
  function fallback(img){
    if(!img)return;
    var brand=img.closest('.invoice-brand-v6');if(!brand)return;
    img.style.display='none';
    if(brand.querySelector('.invoice-logo-fallback-v95'))return;
    var el=document.createElement('div');
    el.className='invoice-logo-fallback-v95';
    el.setAttribute('role','img');
    el.setAttribute('aria-label','Firmenlogo nicht verfügbar – Rohr- & Kanaltechnik Winser');
    el.innerHTML='<span>Rohr- &amp;<br>Kanaltechnik<br>Winser</span>';
    brand.insertBefore(el,img);
  }

  function normalizeImage(img){
    if(!img)return null;
    var src=img.getAttribute('src')||'';
    if(legacySource(src)){
      img.setAttribute('src',LOCAL_LOGO);
      src=LOCAL_LOGO;
    }
    img.classList.add('shp-company-logo-v95');
    img.setAttribute('alt','Rohr- & Kanaltechnik Winser – Firmenlogo');
    img.setAttribute('fetchpriority','high');
    img.setAttribute('decoding','async');
    img.dataset.shLogoSource=src===LOCAL_LOGO?'local':'custom';
    if(img.dataset.shLogoGuard!=='1'){
      img.dataset.shLogoGuard='1';
      img.addEventListener('load',function(){img.style.display='block';removeFallback(img.closest('.invoice-brand-v6'))});
      img.addEventListener('error',function(){fallback(img)});
    }
    return img;
  }

  function logoImage(){return normalizeImage(document.querySelector('.invoice-brand-v6 img'))}

  function enhanceAdminBranding(){
    var input=document.getElementById('adm-logoUrl');
    if(input&&legacySource(input.value))input.value=LOCAL_LOGO;
    if(input&&!input.parentNode.querySelector('.shp-logo-local-note')){
      var note=document.createElement('small');note.className='shp-logo-local-note';note.textContent='Standard: Original Winser-Logo lokal im Service Hub. Eine eigene Logo-URL kann weiterhin bewusst hinterlegt werden.';input.parentNode.appendChild(note);
    }
    var preview=document.querySelector('.ux-admin-logo-preview');
    if(preview){
      var src=preview.getAttribute('src')||'';
      if(legacySource(src))preview.setAttribute('src',LOCAL_LOGO);
      preview.setAttribute('alt','Rohr- & Kanaltechnik Winser – Firmenlogo');
      preview.style.objectFit='contain';
    }
  }

  function waitForLogo(timeout){
    timeout=timeout||5000;
    return new Promise(function(resolve){
      var img=logoImage();
      if(!img){resolve(false);return}
      if(img.complete&&img.naturalWidth>0){
        img.style.display='block';removeFallback(img.closest('.invoice-brand-v6'));
        if(typeof img.decode==='function')img.decode().then(function(){resolve(true)}).catch(function(){resolve(true)});else resolve(true);
        return;
      }
      if(img.complete&&img.naturalWidth===0){fallback(img);resolve(false);return}
      var done=false,timer;
      function finish(ok){if(done)return;done=true;clearTimeout(timer);img.removeEventListener('load',onload);img.removeEventListener('error',onerror);if(!ok)fallback(img);resolve(ok)}
      function onload(){if(typeof img.decode==='function')img.decode().then(function(){finish(img.naturalWidth>0)}).catch(function(){finish(img.naturalWidth>0)});else finish(img.naturalWidth>0)}
      function onerror(){finish(false)}
      img.addEventListener('load',onload,{once:true});img.addEventListener('error',onerror,{once:true});
      timer=setTimeout(function(){finish(img.complete&&img.naturalWidth>0)},timeout);
    });
  }

  function wrapInvoicePrint(){
    if(wrapped||!window.SH||typeof window.SH.printInvoice!=='function')return;
    wrapped=true;
    var original=window.SH.printInvoice;
    window.SH.printInvoice=function(){
      var actualPrint=window.print,intercepted=false;
      window.print=function(){
        if(intercepted)return;intercepted=true;
        waitForLogo(5000).then(function(){window.print=actualPrint;requestAnimationFrame(function(){requestAnimationFrame(function(){actualPrint.call(window)})})});
      };
      try{return original.apply(window.SH,arguments)}
      finally{setTimeout(function(){if(!intercepted&&window.print!==actualPrint)window.print=actualPrint},6000)}
    };
  }

  function enhance(){installStyle();migrateBranding();logoImage();enhanceAdminBranding();wrapInvoicePrint();document.documentElement.dataset.shInvoiceLogo=VERSION}
  var queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;enhance()})}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  enhance();
  window.SHP_INVOICE_LOGO={version:VERSION,localLogo:LOCAL_LOGO,migrateBranding:migrateBranding,waitForLogo:waitForLogo};
})();
