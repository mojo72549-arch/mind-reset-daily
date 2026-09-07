(function(){
  'use strict';
  var BUILD='20260907-v17-retired-native-compat1';

  function api(){return window.SHP_REPORT_NATIVE_PDF||null}
  function forward(name){return function(){var a=api();if(!a||typeof a[name]!=='function')return Promise.reject(new Error('Lokaler PDF-Generator wird geladen'));return a[name].apply(a,arguments)}}

  document.querySelectorAll('.report-share-notice-v17').forEach(function(n){
    if(/PDF-Bibliothek konnte nicht geladen werden/i.test(n.textContent||''))n.remove();
  });

  window.SHP_REPORT_DOCUMENT={
    build:BUILD,
    retired:true,
    buildPdf:forward('buildPdf'),
    sharePdf:forward('sharePdf'),
    downloadPdf:forward('downloadPdf')
  };
  document.documentElement.dataset.shReportDocumentCompat=BUILD;
})();