(function(){
  'use strict';
  var STORE='shp_db';
  var BUILD='20260821-v8';
  var installed=false;

  function readDb(){try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch(e){return null}}
  function writeDb(db){localStorage.setItem(STORE,JSON.stringify(db))}
  function norm(v){return String(v==null?'':v).trim().toLowerCase()}
  function isMaterialCatalogItem(item){
    var name=norm(item&&item.name).replace(/\s+/g,' ');
    return String(item&&item.id||'')==='svc10'||name==='verbrauchsmaterialien'||name.indexOf('verbrauchsmaterial')===0;
  }
  function currentOrderNo(){
    var h=document.querySelector('main h2');
    var text=(h&&h.textContent||'').trim();
    return text.indexOf('Rapport ')===0?text.slice(8).trim():'';
  }
  function reportForOrderNo(db,no){
    if(!db||!no)return null;
    var order=(db.orders||[]).find(function(o){return String(o.no)===String(no)});
    if(!order)return null;
    return (db.reports||[]).find(function(r){return String(r.orderId)===String(order.id)})||null;
  }
  function showToast(text,kind){
    var old=document.querySelector('.ux-v8-toast');if(old)old.remove();
    var el=document.createElement('div');el.className='ux-v8-toast '+(kind||'ok');
    el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.textContent=text;
    el.style.cssText='position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:120;background:#102333;color:#fff;padding:11px 15px;border-radius:12px;box-shadow:0 8px 28px #0004;font-weight:750;max-width:min(92vw,560px);text-align:center';
    if(kind==='error')el.style.background='#8e2525';
    document.body.appendChild(el);clearTimeout(showToast.timer);showToast.timer=setTimeout(function(){if(el.parentNode)el.remove()},3200);
  }
  function highlightLines(){
    setTimeout(function(){
      var card=document.querySelector('.report-lines-card');if(!card)return;
      card.style.transition='box-shadow .2s ease, border-color .2s ease';
      card.style.borderColor='#1769cf';card.style.boxShadow='0 0 0 3px rgba(23,105,207,.14),0 8px 24px rgba(11,31,51,.08)';
      try{card.scrollIntoView({behavior:'smooth',block:'center'})}catch(e){card.scrollIntoView()}
      setTimeout(function(){card.style.borderColor='';card.style.boxShadow=''},1500);
    },40);
  }
  function sanitizeCatalog(){
    var db=readDb();if(!db||!db.settings||!Array.isArray(db.settings.catalog))return false;
    var before=db.settings.catalog.length;
    db.settings.catalog=db.settings.catalog.filter(function(item){return !isMaterialCatalogItem(item)});
    if(db.settings.catalog.length===before)return false;
    (db.customers||[]).forEach(function(c){
      if(!c.priceOverrides)return;
      delete c.priceOverrides.svc10;
    });
    db.settings.rapportModelVersion=8;
    writeDb(db);return true;
  }
  function cleanReportUi(){
    var heading=[].slice.call(document.querySelectorAll('.card h3')).find(function(h){return (h.textContent||'').trim()==='Material / Messwerte'});
    if(heading){
      heading.textContent='Material';
      var card=heading.closest('.card');
      if(card){
        card.querySelectorAll('button[onclick*="addMeasurement"]').forEach(function(b){b.remove()});
        card.querySelectorAll('button[onclick*="removeMeasurement"]').forEach(function(b){var p=b.closest('p');if(p)p.remove();else b.remove()});
      }
    }
    var select=document.getElementById('rsvc');
    if(select){
      [].slice.call(select.options).forEach(function(o){if(norm(o.textContent).indexOf('verbrauchsmaterial')>=0)o.remove()});
    }
  }
  function consolidateCurrentService(orderNo,catalogId){
    var db=readDb(),r=reportForOrderNo(db,orderNo);if(!r||!Array.isArray(r.lines))return false;
    var first=-1,total=0,matchCount=0,price=null,unit=null;
    r.lines.forEach(function(line,idx){
      if(String(line.catalogId||'')!==String(catalogId||''))return;
      if(first<0){first=idx;price=+line.price||0;unit=line.unit||''}
      if((+line.price||0)!==price||String(line.unit||'')!==String(unit))return;
      total+=+line.qty||0;matchCount++;
    });
    if(matchCount<=1)return false;
    var kept=false;
    r.lines=r.lines.filter(function(line){
      if(String(line.catalogId||'')!==String(catalogId||''))return true;
      if((+line.price||0)!==price||String(line.unit||'')!==String(unit))return true;
      if(!kept){line.qty=total;kept=true;return true}
      return false;
    });
    writeDb(db);return true;
  }
  function verifyMutation(orderNo,beforeCount,expectedCount,label){
    var db=readDb(),r=reportForOrderNo(db,orderNo),count=r&&Array.isArray(r.lines)?r.lines.length:null;
    if(count===expectedCount)return true;
    console.error('[ServiceHub V8] Persistenzprüfung fehlgeschlagen',label,{before:beforeCount,expected:expectedCount,actual:count});
    showToast('Änderung konnte nicht sicher gespeichert werden. Bitte nicht weiterarbeiten und Seite neu laden.','error');
    return false;
  }
  function wrapActions(){
    if(installed||!window.SH)return;installed=true;
    var add=window.SH.addReportLine;
    if(typeof add==='function')window.SH.addReportLine=function(){
      var orderNo=currentOrderNo();
      var select=document.getElementById('rsvc'),qtyEl=document.getElementById('rqty');
      var id=select&&select.value,name=select&&select.options[select.selectedIndex]&&select.options[select.selectedIndex].textContent;
      var db0=readDb(),r0=reportForOrderNo(db0,orderNo),before=r0&&r0.lines?r0.lines.length:0;
      var result=add.apply(window.SH,arguments);
      var merged=consolidateCurrentService(orderNo,id);
      var db1=readDb(),r1=reportForOrderNo(db1,orderNo),after=r1&&r1.lines?r1.lines.length:0;
      if(after<before||after>before+1){verifyMutation(orderNo,before,merged?before:before+1,'Leistung hinzufügen')}
      if(merged&&window.SH.openReport){
        var order=(db1.orders||[]).find(function(o){return String(o.no)===String(orderNo)});if(order)setTimeout(function(){window.SH.openReport(order.id)},0);
      }
      showToast((name?name.split(' · ')[0]+': ':'')+'Leistung gespeichert'+(merged?' · Menge zusammengeführt':''));
      highlightLines();
      if(qtyEl)qtyEl.value='1';
      return result;
    };

    var remove=window.SH.removeReportLine;
    if(typeof remove==='function')window.SH.removeReportLine=function(index){
      var orderNo=currentOrderNo(),db0=readDb(),r0=reportForOrderNo(db0,orderNo),before=r0&&r0.lines?r0.lines.length:0;
      var target=r0&&r0.lines&&r0.lines[index]?r0.lines[index].name:'';
      var result=remove.apply(window.SH,arguments);
      var db1=readDb(),r1=reportForOrderNo(db1,orderNo),after=r1&&r1.lines?r1.lines.length:before;
      if(after===before-1){verifyMutation(orderNo,before,before-1,'Leistung löschen');showToast((target?target+': ':'')+'Leistung dauerhaft entfernt')}
      return result;
    };

    var addMaterial=window.SH.addMaterial;
    if(typeof addMaterial==='function')window.SH.addMaterial=function(){var result=addMaterial.apply(window.SH,arguments);showToast('Material gespeichert');return result};
    var removeMaterial=window.SH.removeMaterial;
    if(typeof removeMaterial==='function')window.SH.removeMaterial=function(){var result=removeMaterial.apply(window.SH,arguments);showToast('Material dauerhaft entfernt');return result};
  }
  function buildMarker(){document.documentElement.dataset.shBuild=BUILD}
  function enhance(){sanitizeCatalog();wrapActions();cleanReportUi();buildMarker()}
  var scheduled=false;function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;enhance()})}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  enhance();
  window.SHP_V8_RAPPORT={sanitizeCatalog:sanitizeCatalog,enhance:enhance,build:BUILD};
})();
