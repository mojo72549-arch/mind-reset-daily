(function(){
  'use strict';
  var BUILD='20260908-v19-report-native-actions2';
  var queued=false;

  function nativeApi(){return window.SHP_REPORT_NATIVE_PDF||null}
  function isReport(){var m=document.querySelector('main.shell');return !!(m&&m.querySelector('#rw')&&m.querySelector('#rr'))}

  function cleanOldNotices(){
    document.querySelectorAll('.report-share-notice-v17').forEach(function(n){
      if(/PDF-Bibliothek konnte nicht geladen werden/i.test(n.textContent||''))n.remove();
    });
  }

  function keepSingleShareButton(){
    var buttons=[].slice.call(document.querySelectorAll('button')).filter(function(b){
      var oc=b.getAttribute('onclick')||'';
      var tx=String(b.textContent||'').trim();
      return /sendReportPreferred/.test(oc)||/PDF über WhatsApp teilen/i.test(tx)||b.hasAttribute('data-report-pdf-v17')||b.hasAttribute('data-report-native-v18')||b.hasAttribute('data-report-native-v19');
    });
    if(!buttons.length)return;
    var keep=buttons[0];
    buttons.slice(1).forEach(function(b){if(b!==keep)b.remove()});
    keep.removeAttribute('onclick');
    keep.removeAttribute('data-report-pdf-v17');
    keep.dataset.reportNativeV19='1';
    if(String(keep.textContent||'').trim()!=='PDF über WhatsApp teilen')keep.textContent='PDF über WhatsApp teilen';
    if(!keep.__shpNativeShareV19){
      keep.__shpNativeShareV19=true;
      keep.onclick=function(e){
        e.preventDefault();
        var api=nativeApi();
        if(api&&typeof api.sharePdf==='function')api.sharePdf();
      };
    }
  }

  function wirePrintButton(){
    var btn=document.querySelector('button[onclick*="printReport"],button[data-report-print-v19]');
    if(!btn)return;
    btn.removeAttribute('onclick');
    btn.dataset.reportPrintV19='1';
    if(String(btn.textContent||'').trim()!=='PDF erstellen / Drucken')btn.textContent='PDF erstellen / Drucken';
    if(!btn.__shpNativePrintV19){
      btn.__shpNativePrintV19=true;
      btn.onclick=function(e){
        e.preventDefault();
        var api=nativeApi();
        if(api&&typeof api.downloadPdf==='function')api.downloadPdf();
      };
    }
  }

  function enhance(){
    cleanOldNotices();
    if(!isReport())return;
    keepSingleShareButton();
    wirePrintButton();
    document.documentElement.dataset.shReportNativeActions=BUILD;
  }

  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(function(){queued=false;enhance()});
  }

  new MutationObserver(schedule).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  enhance();
  window.SHP_REPORT_NATIVE_ACTIONS={build:BUILD,enhance:enhance};
})();