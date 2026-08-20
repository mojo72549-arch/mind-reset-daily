(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SHP_CORE=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var ROLE_RIGHTS={
    dome:{
      viewCustomers:true,viewOrders:true,viewReports:true,editReports:true,viewInvoices:true,
      manageCustomers:false,manageOrders:false,manageInvoices:false,managePricing:false,manageAdmin:false
    },
    annette:{
      viewCustomers:true,viewOrders:true,viewReports:true,editReports:true,viewInvoices:true,
      manageCustomers:true,manageOrders:true,manageInvoices:true,managePricing:true,manageAdmin:false
    },
    admin:{
      viewCustomers:true,viewOrders:true,viewReports:true,editReports:true,viewInvoices:true,
      manageCustomers:true,manageOrders:true,manageInvoices:true,managePricing:true,manageAdmin:true
    }
  };
  var SAFE_UNDO_ACTIONS=[
    'newCustomer','editCustomer','newOrder','saveReportText','startReport','endReport',
    'addReportLine','removeReportLine','addMaterial','removeMaterial','addMeasurement','removeMeasurement',
    'finishReport','invoiceFromReport','saveInvoiceStatus','saveAdminGlobal','addCatalogItem','editCatalogItem','editCustomerPricing'
  ];
  var EXTERNAL_SIDE_EFFECT_ACTIONS=['sendReportPreferred','sendInvoicePreferred','sendInvoice','printReport','printInvoice'];
  function normalizeRole(value){
    value=String(value||'').toLowerCase();
    if(value==='tech'||value==='technician'||value==='dome')return'dome';
    if(value==='office'||value==='billing'||value==='annette')return'annette';
    if(value==='administrator'||value==='admin')return'admin';
    return'';
  }
  function rights(value){return ROLE_RIGHTS[normalizeRole(value)]||{};}
  function can(value,capability){return rights(value)[capability]===true;}
  function isUndoableAction(name){return SAFE_UNDO_ACTIONS.indexOf(String(name||''))>=0;}
  function hasExternalSideEffect(name){return EXTERNAL_SIDE_EFFECT_ACTIONS.indexOf(String(name||''))>=0;}
  function nextInvoiceNo(invoices){
    var max=26170;
    (invoices||[]).forEach(function(item){var n=parseInt(item&&item.no,10);if(!isNaN(n)&&n>max)max=n;});
    return String(max+5);
  }
  function safeJson(text,fallback){try{return JSON.parse(text)}catch(e){return fallback;}}
  function snapshot(storage,key){return storage&&typeof storage.getItem==='function'?storage.getItem(key):null;}
  function changed(before,after){return String(before==null?'':before)!==String(after==null?'':after);}
  return{
    ROLE_RIGHTS:ROLE_RIGHTS,
    SAFE_UNDO_ACTIONS:SAFE_UNDO_ACTIONS.slice(),
    EXTERNAL_SIDE_EFFECT_ACTIONS:EXTERNAL_SIDE_EFFECT_ACTIONS.slice(),
    normalizeRole:normalizeRole,rights:rights,can:can,isUndoableAction:isUndoableAction,
    hasExternalSideEffect:hasExternalSideEffect,nextInvoiceNo:nextInvoiceNo,safeJson:safeJson,snapshot:snapshot,changed:changed
  };
});
