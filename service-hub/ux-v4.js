(function(){
  'use strict';
  var wrapped=false;
  function wrapDeletes(){
    if(wrapped||!window.SH)return;
    wrapped=true;
    ['removeReportLine','removeMaterial','removeMeasurement'].forEach(function(name){
      var original=window.SH[name];
      if(typeof original!=='function')return;
      window.SH[name]=function(index){
        var label=name==='removeReportLine'?'Leistung':name==='removeMaterial'?'Material':'Messwert';
        if(!window.confirm(label+' wirklich löschen?'))return;
        return original(index);
      };
    });
  }
  function enhanceReportLines(){
    var headings=[].slice.call(document.querySelectorAll('.card h3'));
    headings.forEach(function(h){
      if((h.textContent||'').trim()!=='Leistungen im Rapport')return;
      var card=h.closest('.card');
      if(!card)return;
      card.classList.add('report-lines-card');
      var rows=card.querySelectorAll('table tr');
      var dataRows=Math.max(0,rows.length-1);
      card.querySelectorAll('button.red').forEach(function(btn){
        btn.textContent='Löschen';
        btn.classList.add('ux-danger-confirm');
        btn.setAttribute('aria-label','Leistung aus Rapport löschen');
        btn.setAttribute('title','Leistung löschen');
      });
      var empty=card.querySelector('.ux-empty');
      if(dataRows===0&&!empty){
        empty=document.createElement('div');empty.className='ux-empty';empty.textContent='Noch keine Leistung hinzugefügt.';card.appendChild(empty);
      }else if(dataRows>0&&empty){empty.remove();}
    });
  }
  function enhanceActions(){
    document.querySelectorAll('.sticky').forEach(function(el){
      if(el.querySelector('button[onclick*="finishReport"]'))el.classList.add('ux-report-actions');
    });
  }
  function simplifyLabels(){
    document.querySelectorAll('button').forEach(function(btn){
      var t=(btn.textContent||'').trim();
      if(t==='360° öffnen')btn.textContent='Kunde öffnen';
    });
  }
  function activeNav(){
    var title=(document.querySelector('main h2')||{}).textContent||'';
    document.querySelectorAll('.mobile button').forEach(function(b){b.classList.remove('ux-active')});
    var match=title.indexOf('Rapport')===0?'Rapporte':title.indexOf('Rechnung')===0?'Rechnung':title.indexOf('Kunden')===0?'Kunden':'Start';
    document.querySelectorAll('.mobile button').forEach(function(b){if((b.textContent||'').indexOf(match)>=0)b.classList.add('ux-active')});
  }
  function enhance(){wrapDeletes();enhanceReportLines();enhanceActions();simplifyLabels();activeNav();}
  var scheduled=false;
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;enhance()})}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  enhance();
})();