(function(){
  'use strict';
  var BUILD='20260907-v17-report-document1';
  var STORE='shp_db',SESSION='shp_session';
  var LOCAL_LOGO='./assets/rokatech-winser-logo.webp';
  var DEFAULTS={
    companyName:'Rohr- & Kanaltechnik Winser',street:'Taläckerstraße 49',zipCity:'70437 Stuttgart',phone:'0152 23401628',email:'info@rokatech-winser.de',website:'www.rokatech-winser.de',logoUrl:LOCAL_LOGO,
    bankName:'Volksbank Zuffenhausen eG',iban:'DE78 6009 0300 0424 6090 02',bic:'GENODES1ZUF',vatId:'DE456265762',invoiceFooter:'Vielen Dank für Ihren Auftrag und Ihr Vertrauen.'
  };
  var scripts={};

  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(ch){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}
  function readDb(){try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch(e){return null}}
  function writeDb(db){try{localStorage.setItem(STORE,JSON.stringify(db));return true}catch(e){return false}}
  function session(){try{return JSON.parse(sessionStorage.getItem(SESSION)||'null')}catch(e){return null}}
  function company(db){return Object.assign({},DEFAULTS,(db&&db.settings&&db.settings.company)||{})}
  function timeOnly(v){var s=String(v||'').trim(),m=s.match(/(?:^|\D)(\d{1,2}):(\d{2})(?::\d{2})?/);return m?('0'+m[1]).slice(-2)+':'+m[2]:s}
  function money(v){return (+v||0).toFixed(2).replace('.',',')+' €'}
  function currentContext(){
    var db=readDb(),bridge=window.SHP_REPORT_BRIDGE,r=null,o=null,c=null;
    if(bridge&&typeof bridge.read==='function')try{r=bridge.read()}catch(e){}
    if(!db||!r)return null;
    if(Array.isArray(db.orders))o=db.orders.find(function(x){return x.id==r.orderId})||null;
    if(o&&Array.isArray(db.customers))c=db.customers.find(function(x){return x.id==o.customerId})||null;
    if(!o||!c)return null;
    return{db:db,r:r,o:o,c:c,co:company(db)};
  }
  function totals(ctx){
    var net=0,lines=(ctx.r.lines||[]),mats=(ctx.r.materials||[]),vat=+(ctx.db.settings&&ctx.db.settings.vat||19);
    lines.forEach(function(x){net+=(+x.qty||0)*(+x.price||0)});mats.forEach(function(x){net+=(+x.qty||0)*(+x.price||0)});
    return{net:net,vat:net*vat/100,gross:net*(1+vat/100),rate:vat};
  }
  function lines(ctx){
    return (ctx.r.lines||[]).concat((ctx.r.materials||[]).map(function(m){return{name:m.name,qty:m.qty,unit:m.unit||'Stk.',price:m.price}}));
  }

  function enhanceReportDocument(){
    var doc=document.querySelector('.doc');if(!doc||doc.dataset.reportV17==='1')return false;
    var title=[].slice.call(doc.querySelectorAll('h1,h2')).find(function(h){return /Rapport\s*\/\s*Leistungsnachweis/i.test(h.textContent||'')});
    if(!title)return false;
    var ctx=currentContext();if(!ctx)return false;
    doc.dataset.reportV17='1';doc.classList.add('invoice-doc-v6','report-doc-v17');
    var oldHead=doc.querySelector('.doc-head');
    if(oldHead){
      oldHead.classList.add('invoice-head-v6','report-head-v17');
      oldHead.innerHTML='<div class="invoice-brand-v6"><img class="shp-company-logo-v95" src="'+esc(ctx.co.logoUrl||LOCAL_LOGO)+'" alt="'+esc(ctx.co.companyName)+' – Firmenlogo"><div><b class="invoice-brand-name">'+esc(ctx.co.companyName)+'</b><span>'+esc(ctx.co.street)+'</span><span>'+esc(ctx.co.zipCity)+'</span><span>'+esc(ctx.co.phone)+' · '+esc(ctx.co.email)+'</span><span>'+esc(ctx.co.website)+'</span></div></div><div class="invoice-meta-v6 report-meta-v17"><h1>RAPPORT</h1><p><b>Leistungsnachweis</b><br><b>Auftrag:</b> '+esc(ctx.o.no)+'<br><b>Datum:</b> '+esc(ctx.o.date||'–')+'<br><b>Beginn:</b> '+esc(timeOnly(ctx.r.start)||'–')+'<br><b>Ende:</b> '+esc(timeOnly(ctx.r.end)||'–')+'</p></div>';
    }
    var marker=document.createElement('div');marker.className='invoice-brand-line-v6';doc.insertBefore(marker,doc.firstChild);
    if(title)title.remove();
    var metaParagraph=[].slice.call(doc.querySelectorAll('p')).find(function(p){return /Auftragsnr\.:/i.test(p.textContent||'')});if(metaParagraph)metaParagraph.remove();
    var tables=doc.querySelectorAll('table.doc-table');
    var party=tables[0]||null,item=tables[1]||null,total=doc.querySelector('table.doc-total');
    if(party){party.classList.add('report-party-v17');var wrap=document.createElement('div');wrap.className='invoice-recipient-v6 report-recipient-v17';wrap.innerHTML='<b>Auftraggeber / Einsatzort</b><strong>'+esc(ctx.c.name)+'</strong><span>'+esc(ctx.c.contact||'')+'</span><span>'+esc(ctx.c.address||'')+'</span><span>'+esc(ctx.c.phone||'')+(ctx.c.email?' · '+esc(ctx.c.email):'')+'</span>';party.parentNode.insertBefore(wrap,party);party.classList.add('report-party-table-v17')}
    if(item)item.classList.add('invoice-items-v6','report-items-v17');
    if(total)total.classList.add('invoice-totals-v6','report-totals-v17');
    var workHeading=[].slice.call(doc.querySelectorAll('h3')).find(function(h){return /Ausgeführte Arbeiten/i.test(h.textContent||'')});if(workHeading)workHeading.classList.add('report-section-title-v17');
    var pay=total&&total.nextElementSibling;if(pay&&pay.tagName==='P')pay.classList.add('invoice-payment-v6','report-payment-v17');
    var legal=[].slice.call(doc.querySelectorAll('p.small')).find(function(p){return /Hiermit bestätige ich/i.test(p.textContent||'')});if(legal)legal.classList.add('report-confirm-v17');
    var sigGrid=legal&&legal.nextElementSibling;if(sigGrid)sigGrid.classList.add('report-signatures-v17');
    var agb=doc.querySelector('.print-break');if(agb)agb.classList.add('report-agb-v17');
    var footer=document.createElement('p');footer.className='small invoice-footer-v6 report-footer-v17';footer.innerHTML='<b>'+esc(ctx.co.companyName)+'</b><br>'+esc(ctx.co.bankName)+' · IBAN '+esc(ctx.co.iban)+' · BIC '+esc(ctx.co.bic)+'<br>USt-IdNr.: '+esc(ctx.co.vatId)+' · '+esc(ctx.co.email)+' · '+esc(ctx.co.website)+'<br><span>'+esc(ctx.co.invoiceFooter||DEFAULTS.invoiceFooter)+'</span>';
    if(agb)doc.insertBefore(footer,agb);else doc.appendChild(footer);
    return true;
  }

  function loadScript(src){
    if(scripts[src])return scripts[src];
    scripts[src]=new Promise(function(resolve,reject){
      var s=document.createElement('script');s.src=src;s.async=true;s.onload=resolve;s.onerror=function(){reject(new Error('PDF-Bibliothek konnte nicht geladen werden'))};document.head.appendChild(s);
    });return scripts[src];
  }
  async function ensurePdf(){
    if(!(window.jspdf&&window.jspdf.jsPDF))await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js');
    if(!(window.jspdf&&window.jspdf.jsPDF&&window.jspdf.jsPDF.API&&window.jspdf.jsPDF.API.autoTable))await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.4/jspdf.plugin.autotable.min.js');
    if(!(window.jspdf&&window.jspdf.jsPDF))throw new Error('PDF-Erzeugung nicht verfügbar');
  }
  function loadImageData(url){
    return fetch(url,{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('Logo HTTP '+r.status);return r.blob()}).then(function(blob){return new Promise(function(resolve,reject){var u=URL.createObjectURL(blob),im=new Image();im.onload=function(){try{var c=document.createElement('canvas'),w=im.naturalWidth||im.width,h=im.naturalHeight||im.height;c.width=w;c.height=h;c.getContext('2d').drawImage(im,0,0,w,h);URL.revokeObjectURL(u);resolve(c.toDataURL('image/png'))}catch(e){URL.revokeObjectURL(u);reject(e)}};im.onerror=function(){URL.revokeObjectURL(u);reject(new Error('Logo konnte nicht gelesen werden'))};im.src=u})});
  }
  function drawWrapped(doc,text,x,y,maxWidth,lineHeight){var rows=doc.splitTextToSize(String(text||'–'),maxWidth);doc.text(rows,x,y);return y+rows.length*lineHeight}
  async function buildPdfBlob(){
    if(window.SHP_REPORT_TIME&&typeof window.SHP_REPORT_TIME.save==='function')window.SHP_REPORT_TIME.save();
    var ctx=currentContext();if(!ctx)throw new Error('Rapportdaten konnten nicht gelesen werden');
    await ensurePdf();
    var jsPDF=window.jspdf.jsPDF,doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true}),navy=[11,42,73],muted=[75,93,110],light=[244,247,250],t=totals(ctx),ls=lines(ctx),y=12;
    doc.setFillColor.apply(doc,navy);doc.rect(0,0,210,4,'F');
    try{var logo=await loadImageData(ctx.co.logoUrl||LOCAL_LOGO);doc.addImage(logo,'PNG',15,11,30,30,undefined,'FAST')}catch(e){}
    doc.setTextColor.apply(doc,navy);doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text(ctx.co.companyName,50,17);
    doc.setTextColor.apply(doc,muted);doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.text([ctx.co.street,ctx.co.zipCity,ctx.co.phone+' · '+ctx.co.email,ctx.co.website],50,22,{lineHeightFactor:1.4});
    doc.setTextColor.apply(doc,navy);doc.setFont('helvetica','bold');doc.setFontSize(23);doc.text('RAPPORT',195,18,{align:'right'});doc.setFontSize(9);doc.text('Leistungsnachweis',195,24,{align:'right'});
    doc.setTextColor.apply(doc,muted);doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.text(['Auftrag: '+ctx.o.no,'Datum: '+(ctx.o.date||'–'),'Beginn: '+(timeOnly(ctx.r.start)||'–'),'Ende: '+(timeOnly(ctx.r.end)||'–')],195,29,{align:'right',lineHeightFactor:1.45});
    y=49;doc.setDrawColor.apply(doc,navy);doc.setLineWidth(1.2);doc.line(15,y,15,y+23);doc.setFontSize(7.5);doc.setTextColor(111,125,137);doc.setFont('helvetica','bold');doc.text('AUFTRAGGEBER / EINSATZORT',19,y+4);doc.setTextColor(30,52,72);doc.setFontSize(10);doc.text(ctx.c.name||'–',19,y+10);doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.text([ctx.c.contact||'',ctx.c.address||'',(ctx.c.phone||'')+(ctx.c.email?' · '+ctx.c.email:'')].filter(Boolean),19,y+15,{lineHeightFactor:1.35});
    y+=31;doc.setTextColor(51,69,87);doc.setFontSize(9);doc.text('Leistungsnachweis zu den ausgeführten Arbeiten gemäß Auftrag.',15,y);y+=5;
    var body=ls.map(function(l,i){return[String(i+1),String(l.name||''),String(l.qty==null?'':l.qty),String(l.unit||''),money(l.price),money((+l.qty||0)*(+l.price||0))]});
    if(!body.length)body=[['–','Keine Leistungen erfasst','','','','']];
    doc.autoTable({startY:y,head:[['Pos.','Bezeichnung','Menge','Einheit','Einzelpreis','Gesamt']],body:body,theme:'grid',margin:{left:15,right:15},styles:{font:'helvetica',fontSize:8,cellPadding:2.5,lineColor:[220,227,233],lineWidth:.2,textColor:[35,52,68]},headStyles:{fillColor:navy,textColor:[255,255,255],fontStyle:'bold',fontSize:7.5},columnStyles:{0:{cellWidth:10},1:{cellWidth:72},2:{cellWidth:17},3:{cellWidth:17},4:{cellWidth:27,halign:'right'},5:{cellWidth:27,halign:'right'}}});
    y=doc.lastAutoTable.finalY+8;doc.setTextColor.apply(doc,navy);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text('Ausgeführte Arbeiten',15,y);y+=6;doc.setTextColor(35,52,68);doc.setFont('helvetica','normal');doc.setFontSize(9);y=drawWrapped(doc,ctx.r.work||'–',15,y,180,4.3)+3;
    doc.setFont('helvetica','bold');doc.setTextColor.apply(doc,navy);doc.text('Ergebnis / weitere Arbeiten',15,y);y+=5;doc.setFont('helvetica','normal');doc.setTextColor(35,52,68);y=drawWrapped(doc,ctx.r.result||'–',15,y,180,4.3)+4;
    if(y>225){doc.addPage();doc.setFillColor.apply(doc,navy);doc.rect(0,0,210,4,'F');y=15}
    doc.autoTable({startY:y,body:[['Nettobetrag',money(t.net)],['+'+t.rate+'% MwSt.',money(t.vat)],['Bruttobetrag',money(t.gross)]],theme:'plain',margin:{left:102,right:15},styles:{font:'helvetica',fontSize:8.5,cellPadding:2.7,fillColor:light,textColor:[35,52,68]},columnStyles:{0:{cellWidth:55},1:{cellWidth:38,halign:'right'}},didParseCell:function(d){if(d.row.index===2){d.cell.styles.fillColor=navy;d.cell.styles.textColor=[255,255,255];d.cell.styles.fontStyle='bold'}}});
    y=doc.lastAutoTable.finalY+7;doc.setFillColor(246,248,250);doc.setDrawColor(224,230,235);doc.roundedRect(15,y,180,13,2,2,'FD');doc.setTextColor(35,52,68);doc.setFontSize(8.5);doc.text(ctx.r.payment||'Rechnung wird verschickt',19,y+8);y+=20;
    doc.setFontSize(7.5);doc.setTextColor(75,93,110);y=drawWrapped(doc,'Hiermit bestätige ich die Richtigkeit der oben genannten Arbeiten. Die AGB auf der Folgeseite habe ich gelesen, verstanden und akzeptiere diese.',15,y,180,3.5)+4;
    if(y>245){doc.addPage();doc.setFillColor.apply(doc,navy);doc.rect(0,0,210,4,'F');y=15}
    doc.setTextColor.apply(doc,navy);doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.text('Unterschrift Facharbeiter',15,y);doc.text('Unterschrift Kunde',110,y);doc.setDrawColor(196,207,216);doc.line(15,y+21,92,y+21);doc.line(110,y+21,195,y+21);
    try{if(ctx.r.sigT)doc.addImage(ctx.r.sigT,'PNG',18,y+2,45,17,undefined,'FAST')}catch(e){}
    try{if(ctx.r.sigC)doc.addImage(ctx.r.sigC,'PNG',113,y+2,45,17,undefined,'FAST')}catch(e){}
    y+=29;doc.setDrawColor(204,214,222);doc.line(15,y,195,y);y+=5;doc.setTextColor(75,93,110);doc.setFont('helvetica','normal');doc.setFontSize(7.2);doc.text([ctx.co.companyName,ctx.co.bankName+' · IBAN '+ctx.co.iban+' · BIC '+ctx.co.bic,'USt-IdNr.: '+ctx.co.vatId+' · '+ctx.co.email+' · '+ctx.co.website],15,y,{lineHeightFactor:1.35});doc.setTextColor(31,52,72);doc.text(ctx.co.invoiceFooter||DEFAULTS.invoiceFooter,15,y+12);
    doc.addPage();doc.setFillColor.apply(doc,navy);doc.rect(0,0,210,4,'F');doc.setTextColor.apply(doc,navy);doc.setFont('helvetica','bold');doc.setFontSize(18);doc.text('Allgemeine Geschäftsbedingungen',15,20);doc.setFont('helvetica','normal');doc.setTextColor(51,69,87);doc.setFontSize(9);doc.text(doc.splitTextToSize('Es gelten die beim Auftrag hinterlegten AGB von Rohr- & Kanaltechnik Winser. Für die Produktivfassung wird die vollständige, freigegebene AGB-Fassung als unveränderliche zweite PDF-Seite hinterlegt.',180),15,30,{lineHeightFactor:1.45});
    return{blob:doc.output('blob'),name:'Rapport-'+ctx.o.no+'.pdf',ctx:ctx};
  }
  function download(blob,name){var a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},15000)}
  function notice(text){var old=document.querySelector('.report-share-notice-v17');if(old)old.remove();var n=document.createElement('div');n.className='report-share-notice-v17';n.textContent=text;document.body.appendChild(n);setTimeout(function(){if(n.parentNode)n.remove()},6500)}
  function recordShare(ctx,channel){var db=readDb();if(!db)return;var r=(db.reports||[]).find(function(x){return x.id==ctx.r.id})||(db.reports||[]).find(function(x){return x.orderId==ctx.o.id});if(!r)return;r.sentHistory=r.sentHistory||[];var s=session();r.sentHistory.push({at:new Date().toLocaleString('de-DE'),by:s?s.user:'System',channel:channel});db.settings=db.settings||{};db.settings.audit=db.settings.audit||[];db.settings.audit.unshift({at:new Date().toLocaleString('de-DE'),by:s?s.user:'System',text:'Rapport '+ctx.o.no+' Versand über '+channel});writeDb(db)}
  async function shareReportPdf(){
    try{
      var built=await buildPdfBlob(),file=new File([built.blob],built.name,{type:'application/pdf'}),msg='Guten Tag '+(built.ctx.c.contact||built.ctx.c.name)+', hier erhalten Sie den Rapport zu Auftrag '+built.ctx.o.no+'.';
      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
        await navigator.share({title:'Rapport '+built.ctx.o.no,text:msg,files:[file]});recordShare(built.ctx,'WhatsApp / Teilen');notice('Rapport-PDF wurde zum Teilen übergeben.');return true;
      }
      download(built.blob,built.name);var phone=String(built.ctx.c.phone||'').replace(/[^0-9]/g,'').replace(/^0/,'49');window.open('https://wa.me/'+phone+'?text='+encodeURIComponent(msg+' PDF-Datei: '+built.name),'_blank','noopener');notice('PDF wurde heruntergeladen. Dein Browser kann Dateien nicht direkt an WhatsApp anhängen – bitte die heruntergeladene PDF im geöffneten Chat hinzufügen.');return false;
    }catch(e){console.error(e);notice('PDF konnte nicht erstellt werden: '+(e&&e.message?e.message:e));return false}
  }
  async function downloadReportPdf(){try{var built=await buildPdfBlob();download(built.blob,built.name);notice('Rapport-PDF erstellt: '+built.name)}catch(e){console.error(e);notice('PDF konnte nicht erstellt werden: '+(e&&e.message?e.message:e))}}
  function wrapPrint(){
    if(!window.SH||typeof window.SH.printReport!=='function'||window.SH.printReport.__reportV17)return;
    var original=window.SH.printReport;var wrapped=function(){var actual=window.print,done=false;window.print=function(){if(done)return;done=true;requestAnimationFrame(function(){enhanceReportDocument();var img=document.querySelector('.report-doc-v17 .invoice-brand-v6 img');var finish=function(){window.print=actual;actual.call(window)};if(img&&!img.complete){var timer=setTimeout(finish,2500);img.addEventListener('load',function(){clearTimeout(timer);finish()},{once:true});img.addEventListener('error',function(){clearTimeout(timer);finish()},{once:true})}else finish()})};try{return original.apply(window.SH,arguments)}finally{setTimeout(function(){if(!done&&window.print!==actual)window.print=actual},4000)}};wrapped.__reportV17=true;window.SH.printReport=wrapped;
  }
  function enhanceReportActions(){
    var main=document.querySelector('main.shell');if(!main||!main.querySelector('#rw')||!window.SH)return;
    var send=document.querySelector('button[onclick*="sendReportPreferred"]');if(send&&!send.dataset.reportPdfV17){send.dataset.reportPdfV17='1';send.textContent='PDF über WhatsApp teilen';send.onclick=function(e){e.preventDefault();if(window.SHP_REPORT_TIME&&window.SHP_REPORT_TIME.save)window.SHP_REPORT_TIME.save();shareReportPdf()}}
    var print=document.querySelector('button[onclick*="printReport"]');if(print&&!print.dataset.reportPdfV17){print.dataset.reportPdfV17='1';print.textContent='PDF erstellen / Drucken'}
  }
  function installApi(){if(!window.SH)return;window.SH.shareReportPdf=shareReportPdf;window.SH.downloadReportPdf=downloadReportPdf;wrapPrint()}
  function enhance(){installApi();enhanceReportActions();enhanceReportDocument();document.documentElement.dataset.shReportDocument=BUILD}
  var queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;enhance()})}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});enhance();
  window.SHP_REPORT_DOCUMENT={build:BUILD,enhance:enhance,buildPdf:buildPdfBlob,sharePdf:shareReportPdf,downloadPdf:downloadReportPdf};
})();
