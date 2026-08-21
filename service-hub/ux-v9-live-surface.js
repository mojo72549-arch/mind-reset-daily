(function(){
  'use strict';
  var STORE='shp_db';
  var BUILD='20260821-v9';
  var installed=false;
  var revision=0;

  function readDb(){try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch(e){return null}}
  function norm(v){return String(v==null?'':v).trim().toLowerCase()}
  function currentOrderNo(){
    var h=document.querySelector('main h2');
    var text=(h&&h.textContent||'').trim();
    return text.indexOf('Rapport ')===0?text.slice(8).trim():'';
  }
  function orderForNo(db,no){
    if(!db||!no)return null;
    return (db.orders||[]).find(function(o){return String(o.no)===String(no)})||null;
  }
  function reportForOrderNo(db,no){
    var order=orderForNo(db,no);if(!order)return null;
    return (db.reports||[]).find(function(r){return String(r.orderId)===String(order.id)})||null;
  }
  function isMaterialCatalogItem(item){
    var name=norm(item&&item.name).replace(/\s+/g,' ');
    return String(item&&item.id||'')==='svc10'||name==='verbrauchsmaterialien'||name.indexOf('verbrauchsmaterial')===0;
  }
  function showToast(text,kind){
    var old=document.querySelector('.ux-v9-toast');if(old)old.remove();
    var el=document.createElement('div');el.className='ux-v9-toast '+(kind||'ok');
    el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.textContent=text;
    el.style.cssText='position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:125;background:#102333;color:#fff;padding:11px 15px;border-radius:12px;box-shadow:0 8px 28px #0004;font-weight:750;max-width:min(92vw,560px);text-align:center';
    if(kind==='error')el.style.background='#8e2525';
    document.body.appendChild(el);clearTimeout(showToast.timer);showToast.timer=setTimeout(function(){if(el.parentNode)el.remove()},3000);
  }
  function cardByHeading(text){
    var h=[].slice.call(document.querySelectorAll('.card h3')).find(function(x){return (x.textContent||'').trim()===text});
    return h?h.closest('.card'):null;
  }
  function cleanReportUi(){
    var materialHeading=[].slice.call(document.querySelectorAll('.card h3')).find(function(h){var t=(h.textContent||'').trim();return t==='Material / Messwerte'||t==='Material'});
    if(materialHeading){
      materialHeading.textContent='Material';
      var card=materialHeading.closest('.card');
      if(card){
        card.querySelectorAll('button[onclick*="addMeasurement"]').forEach(function(b){b.remove()});
        card.querySelectorAll('button[onclick*="removeMeasurement"]').forEach(function(b){var p=b.closest('p');if(p)p.remove();else b.remove()});
      }
    }
    var select=document.getElementById('rsvc');
    if(select){[].slice.call(select.options).forEach(function(o){if(norm(o.textContent).indexOf('verbrauchsmaterial')>=0)o.remove()})}
  }
  function sanitizeCatalog(){
    var db=readDb();if(!db||!db.settings||!Array.isArray(db.settings.catalog))return false;
    var before=db.settings.catalog.length;
    db.settings.catalog=db.settings.catalog.filter(function(item){return !isMaterialCatalogItem(item)});
    (db.customers||[]).forEach(function(c){if(c.priceOverrides)delete c.priceOverrides.svc10});
    db.settings.rapportModelVersion=9;
    if(db.settings.catalog.length!==before)localStorage.setItem(STORE,JSON.stringify(db));
    return db.settings.catalog.length!==before;
  }
  function domLineCount(){
    var card=cardByHeading('Leistungen im Rapport');if(!card)return null;
    var rows=card.querySelectorAll('table tr');return Math.max(0,rows.length-1);
  }
  function domMaterialCount(){
    var card=cardByHeading('Material');if(!card)return null;
    return card.querySelectorAll('button[onclick*="removeMaterial"]').length;
  }
  function markSurface(reason){
    revision+=1;
    document.documentElement.dataset.shBuild=BUILD;
    document.documentElement.dataset.shSurfaceRevision=String(revision);
    document.documentElement.dataset.shSurfaceReason=reason||'render';
  }
  function verifySurface(orderNo){
    var db=readDb(),r=reportForOrderNo(db,orderNo);if(!r)return false;
    var lineCount=domLineCount(),materialCount=domMaterialCount();
    var linesOk=lineCount===null||lineCount===(r.lines||[]).length;
    var materialsOk=materialCount===null||materialCount===(r.materials||[]).length;
    if(linesOk&&materialsOk)return true;
    console.error('[ServiceHub V9] UI/Persistenz nicht synchron',{orderNo:orderNo,storedLines:(r.lines||[]).length,domLines:lineCount,storedMaterials:(r.materials||[]).length,domMaterials:materialCount});
    return false;
  }
  function reconcileCurrentReport(orderNo,reason){
    var db=readDb(),order=orderForNo(db,orderNo);if(!order||!window.SH||typeof window.SH.openReport!=='function')return false;
    var scrollY=window.scrollY||0;
    window.SH.openReport(order.id);
    cleanReportUi();
    markSurface(reason);
    if(!verifySurface(orderNo)){
      window.SH.openReport(order.id);
      cleanReportUi();
      markSurface(reason+'-retry');
    }
    var ok=verifySurface(orderNo);
    requestAnimationFrame(function(){try{window.scrollTo({top:scrollY,left:0,behavior:'auto'})}catch(e){window.scrollTo(0,scrollY)}});
    if(!ok)showToast('Ansicht konnte nicht sicher synchronisiert werden.','error');
    return ok;
  }
  function highlightLines(){
    requestAnimationFrame(function(){
      var card=cardByHeading('Leistungen im Rapport');if(!card)return;
      card.style.transition='box-shadow .2s ease,border-color .2s ease';
      card.style.borderColor='#1769cf';card.style.boxShadow='0 0 0 3px rgba(23,105,207,.14),0 8px 24px rgba(11,31,51,.08)';
      try{card.scrollIntoView({behavior:'smooth',block:'center'})}catch(e){card.scrollIntoView()}
      setTimeout(function(){card.style.borderColor='';card.style.boxShadow=''},1200);
    });
  }
  function wrapActions(){
    if(installed||!window.SH)return;installed=true;

    var add=window.SH.addReportLine;
    if(typeof add==='function')window.SH.addReportLine=function(){
      var orderNo=currentOrderNo(),select=document.getElementById('rsvc');
      var name=select&&select.options[select.selectedIndex]&&select.options[select.selectedIndex].textContent;
      var before=reportForOrderNo(readDb(),orderNo),beforeCount=before&&before.lines?before.lines.length:0;
      var result=add.apply(window.SH,arguments);
      var after=reportForOrderNo(readDb(),orderNo),afterCount=after&&after.lines?after.lines.length:0;
      if(afterCount===beforeCount+1&&reconcileCurrentReport(orderNo,'service-add')){
        showToast((name?name.split(' · ')[0]+': ':'')+'Leistung sofort gespeichert und angezeigt');
        highlightLines();
      }
      return result;
    };

    var remove=window.SH.removeReportLine;
    if(typeof remove==='function')window.SH.removeReportLine=function(index){
      var orderNo=currentOrderNo(),before=reportForOrderNo(readDb(),orderNo),beforeCount=before&&before.lines?before.lines.length:0;
      var target=before&&before.lines&&before.lines[index]?before.lines[index].name:'';
      var result=remove.apply(window.SH,arguments);
      var after=reportForOrderNo(readDb(),orderNo),afterCount=after&&after.lines?after.lines.length:beforeCount;
      if(afterCount===beforeCount-1&&reconcileCurrentReport(orderNo,'service-remove'))showToast((target?target+': ':'')+'Leistung sofort entfernt');
      return result;
    };

    var addMaterial=window.SH.addMaterial;
    if(typeof addMaterial==='function')window.SH.addMaterial=function(){
      var orderNo=currentOrderNo(),before=reportForOrderNo(readDb(),orderNo),beforeCount=before&&before.materials?before.materials.length:0;
      var result=addMaterial.apply(window.SH,arguments);
      var after=reportForOrderNo(readDb(),orderNo),afterCount=after&&after.materials?after.materials.length:beforeCount;
      if(afterCount===beforeCount+1&&reconcileCurrentReport(orderNo,'material-add'))showToast('Material sofort gespeichert und angezeigt');
      return result;
    };

    var removeMaterial=window.SH.removeMaterial;
    if(typeof removeMaterial==='function')window.SH.removeMaterial=function(index){
      var orderNo=currentOrderNo(),before=reportForOrderNo(readDb(),orderNo),beforeCount=before&&before.materials?before.materials.length:0;
      var result=removeMaterial.apply(window.SH,arguments);
      var after=reportForOrderNo(readDb(),orderNo),afterCount=after&&after.materials?after.materials.length:beforeCount;
      if(afterCount===beforeCount-1&&reconcileCurrentReport(orderNo,'material-remove'))showToast('Material sofort entfernt');
      return result;
    };
  }
  function enhance(){sanitizeCatalog();wrapActions();cleanReportUi();if(!document.documentElement.dataset.shBuild)markSurface('boot');else document.documentElement.dataset.shBuild=BUILD}
  var scheduled=false;function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;enhance()})}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  enhance();
  window.SHP_V9_LIVE_SURFACE={build:BUILD,reconcileCurrentReport:reconcileCurrentReport,verifySurface:verifySurface,enhance:enhance};
})();
