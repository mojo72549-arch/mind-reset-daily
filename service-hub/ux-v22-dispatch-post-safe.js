(function(){
  'use strict';
  var BUILD='20260909-v22-dispatch-post-safe1';
  var guardInvoiceSend=null;
  var guardInvoicePreferred=null;

  function normalizeChannel(value){
    var s=String(value||'').trim().toLowerCase();
    if(/post|druck/.test(s))return'Post';
    if(/whats/.test(s))return'WhatsApp';
    if(/mail/.test(s))return'E-Mail';
    return value||'E-Mail';
  }

  function currentInvoiceCustomer(){
    var bridge=window.SHP_DATA_BRIDGE;
    if(!bridge||typeof bridge.currentInvoice!=='function'||typeof bridge.customer!=='function')return null;
    try{
      var iv=bridge.currentInvoice();
      return iv?bridge.customer(iv.customerId):null;
    }catch(e){return null}
  }

  function printInvoiceSafely(){
    if(window.SH&&typeof window.SH.printInvoice==='function'){
      window.SH.printInvoice();
      return true;
    }
    return false;
  }

  function safeSend(channel){
    channel=normalizeChannel(channel);
    if(channel==='Post')return printInvoiceSafely();
    return typeof guardInvoiceSend==='function'?guardInvoiceSend.call(window.SH,channel):false;
  }

  function safePreferred(){
    var c=currentInvoiceCustomer();
    if(!c)return typeof guardInvoicePreferred==='function'?guardInvoicePreferred.call(window.SH):false;
    return safeSend(normalizeChannel(c.preferredChannel));
  }

  function enhance(){
    if(!window.SH)return;
    if(window.SH.sendInvoice!==safeSend){
      if(typeof window.SH.sendInvoice==='function')guardInvoiceSend=window.SH.sendInvoice;
      window.SH.sendInvoice=safeSend;
    }
    if(window.SH.sendInvoicePreferred!==safePreferred){
      if(typeof window.SH.sendInvoicePreferred==='function')guardInvoicePreferred=window.SH.sendInvoicePreferred;
      window.SH.sendInvoicePreferred=safePreferred;
    }
    document.documentElement.dataset.shDispatchPostSafe=BUILD;
  }

  if(window.SHP_STABILITY)window.SHP_STABILITY.register('ux-v22-dispatch-post-safe',enhance,{initial:false});
  window.SHP_DISPATCH_POST_SAFE={build:BUILD,enhance:enhance,safeSend:safeSend,safePreferred:safePreferred};
  enhance();
})();
