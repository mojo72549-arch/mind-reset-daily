(function(){
  'use strict';
  var BUILD='20260907-v18-report-native-pdf1';
  var STORE='shp_db',SESSION='shp_session';
  var LOCAL_LOGO='./assets/rokatech-winser-logo.webp';
  var NAVY=[11,42,73],TEXT=[35,52,68],MUTED=[75,93,110],LIGHT=[244,247,250],LINE=[210,220,228];

  function readDb(){try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch(e){return null}}
  function writeDb(db){try{localStorage.setItem(STORE,JSON.stringify(db));return true}catch(e){return false}}
  function session(){try{return JSON.parse(sessionStorage.getItem(SESSION)||'null')}catch(e){return null}}
  function money(v){return(+v||0).toFixed(2).replace('.',',')+' €'}
  function timeOnly(v){var s=String(v||'').trim(),m=s.match(/(?:^|\D)(\d{1,2}):(\d{2})(?::\d{2})?/);return m?('0'+m[1]).slice(-2)+':'+m[2]:s}
  function ctx(){
    var db=readDb(),r=null,b=window.SHP_REPORT_BRIDGE,o=null,c=null;
    if(window.SHP_REPORT_TIME&&typeof window.SHP_REPORT_TIME.save==='function')try{window.SHP_REPORT_TIME.save()}catch(e){}
    if(b&&typeof b.read==='function')try{r=b.read()}catch(e){}
    if(!db||!r)return null;
    o=(db.orders||[]).find(function(x){return x.id==r.orderId});if(!o)return null;
    c=(db.customers||[]).find(function(x){return x.id==o.customerId});if(!c)return null;
    var def={companyName:'Rohr- & Kanaltechnik Winser',street:'Taläckerstraße 49',zipCity:'70437 Stuttgart',phone:'0152 23401628',email:'info@rokatech-winser.de',website:'www.rokatech-winser.de',logoUrl:LOCAL_LOGO,bankName:'Volksbank Zuffenhausen eG',iban:'DE78 6009 0300 0424 6090 02',bic:'GENODES1ZUF',vatId:'DE456265762',invoiceFooter:'Vielen Dank für Ihren Auftrag und Ihr Vertrauen.'};
    return{db:db,r:r,o:o,c:c,co:Object.assign(def,(db.settings&&db.settings.company)||{})};
  }
  function totals(x){var net=0;(x.r.lines||[]).forEach(function(l){net+=(+l.qty||0)*(+l.price||0)});(x.r.materials||[]).forEach(function(l){net+=(+l.qty||0)*(+l.price||0)});var rate=+(x.db.settings&&x.db.settings.vat||19);return{net:net,vat:net*rate/100,gross:net*(1+rate/100),rate:rate}}
  function items(x){return(x.r.lines||[]).concat((x.r.materials||[]).map(function(m){return{name:m.name,qty:m.qty,unit:m.unit||'Stk.',price:m.price}}))}
  function clean(s){return String(s==null?'':s).replace(/\r/g,'').replace(/[\u2013\u2014]/g,'-').replace(/\u00a0/g,' ')}
  function winChar(ch){var map={'€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159};if(map[ch]!=null)return map[ch];var n=ch.charCodeAt(0);return n<256?n:63}
  function bytes(s){s=String(s||'');var a=new Uint8Array(s.length);for(var i=0;i<s.length;i++)a[i]=winChar(s[i]);return a}
  function ascii(s){var a=new Uint8Array(String(s).length);for(var i=0;i<a.length;i++)a[i]=String(s).charCodeAt(i)&255;return a}
  function cat(parts){var n=0;parts.forEach(function(p){n+=p.length});var out=new Uint8Array(n),o=0;parts.forEach(function(p){out.set(p,o);o+=p.length});return out}
  function lit(s){return clean(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/\n/g,' ')}
  function width(s,size){return clean(s).length*size*.49}
  function wrap(s,max,size){var words=clean(s||'–').split(/\s+/),rows=[],line='';words.forEach(function(w){var t=line?line+' '+w:w;if(width(t,size)>max&&line){rows.push(line);line=w}else line=t});if(line)rows.push(line);return rows.length?rows:['–']}
  function rgb(c){return(c[0]/255).toFixed(3)+' '+(c[1]/255).toFixed(3)+' '+(c[2]/255).toFixed(3)}

  function page(){return{ops:[],images:{}}}
  function text(p,x,y,s,size,bold,color,align){s=clean(s);if(align==='right')x-=width(s,size);p.ops.push('BT /'+(bold?'F2':'F1')+' '+size+' Tf '+rgb(color||TEXT)+' rg 1 0 0 1 '+x.toFixed(2)+' '+(842-y).toFixed(2)+' Tm ('+lit(s)+') Tj ET\n')}
  function rect(p,x,y,w,h,fill,stroke){if(fill)p.ops.push(rgb(fill)+' rg ');if(stroke)p.ops.push(rgb(stroke)+' RG 0.6 w ');p.ops.push(x.toFixed(2)+' '+(842-y-h).toFixed(2)+' '+w.toFixed(2)+' '+h.toFixed(2)+' re '+(fill&&stroke?'B':fill?'f':'S')+'\n')}
  function line(p,x1,y1,x2,y2,color,w){p.ops.push(rgb(color||LINE)+' RG '+(w||.6)+' w '+x1+' '+(842-y1)+' m '+x2+' '+(842-y2)+' l S\n')}
  function wrapped(p,x,y,s,max,size,lh,bold,color){var rs=wrap(s,max,size);rs.forEach(function(r,i){text(p,x,y+i*lh,r,size,bold,color)});return y+rs.length*lh}
  function img(p,key,x,y,w,h){p.images[key]=true;p.ops.push('q '+w.toFixed(2)+' 0 0 '+h.toFixed(2)+' '+x.toFixed(2)+' '+(842-y-h).toFixed(2)+' cm /'+key+' Do Q\n')}

  function imageFromSource(src,quality){return new Promise(function(resolve){if(!src){resolve(null);return}var im=new Image();im.crossOrigin='anonymous';im.onload=function(){try{var max=700,scale=Math.min(1,max/Math.max(im.naturalWidth||1,im.naturalHeight||1)),w=Math.max(1,Math.round((im.naturalWidth||1)*scale)),h=Math.max(1,Math.round((im.naturalHeight||1)*scale)),c=document.createElement('canvas');c.width=w;c.height=h;var g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,w,h);g.drawImage(im,0,0,w,h);var data=c.toDataURL('image/jpeg',quality||.88),b=atob(data.split(',')[1]),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);resolve({bytes:u,width:w,height:h})}catch(e){resolve(null)}};im.onerror=function(){resolve(null)};im.src=src})}

  async function build(){
    var x=ctx();if(!x)throw new Error('Rapportdaten konnten nicht gelesen werden');
    var t=totals(x),ls=items(x),pages=[page()],p=pages[0],y=28;
    var logo=await imageFromSource(x.co.logoUrl||LOCAL_LOGO,.9),sigT=await imageFromSource(x.r.sigT,.9),sigC=await imageFromSource(x.r.sigC,.9);
    rect(p,0,0,595,7,NAVY);if(logo)img(p,'ImLogo',42,27,82,82);
    text(p,140,43,x.co.companyName,14,true,NAVY);text(p,140,61,x.co.street,8.5,false,MUTED);text(p,140,74,x.co.zipCity,8.5,false,MUTED);text(p,140,87,x.co.phone+' · '+x.co.email,8.5,false,MUTED);text(p,140,100,x.co.website,8.5,false,MUTED);
    text(p,553,43,'RAPPORT',24,true,NAVY,'right');text(p,553,62,'Leistungsnachweis',9,true,NAVY,'right');text(p,553,79,'Auftrag: '+x.o.no,8.5,false,MUTED,'right');text(p,553,92,'Datum: '+(x.o.date||'–'),8.5,false,MUTED,'right');text(p,553,105,'Beginn: '+(timeOnly(x.r.start)||'–')+' · Ende: '+(timeOnly(x.r.end)||'–'),8.5,false,MUTED,'right');
    y=137;rect(p,42,y,4,73,NAVY);text(p,57,y+12,'AUFTRAGGEBER / EINSATZORT',7.5,true,MUTED);text(p,57,y+30,x.c.name||'–',11,true,TEXT);text(p,57,y+45,x.c.contact||'',8.5,false,TEXT);text(p,57,y+58,x.c.address||'',8.5,false,TEXT);text(p,57,y+71,(x.c.phone||'')+(x.c.email?' · '+x.c.email:''),8.5,false,TEXT);
    y=228;text(p,42,y,'Leistungen im Rapport',12,true,NAVY);y+=13;
    var cols=[42,65,334,385,430,493,553],heads=['Pos.','Bezeichnung','Menge','Einheit','Einzelpreis','Gesamt'];rect(p,42,y,511,24,NAVY);heads.forEach(function(h,i){text(p,cols[i]+5,y+15,h,7.5,true,[255,255,255],i>3?'right':null)});y+=24;
    if(!ls.length)ls=[{name:'Keine Leistungen erfasst',qty:'',unit:'',price:0}];
    ls.forEach(function(l,i){var desc=wrap(l.name||'',250,8.3),rh=Math.max(26,12+desc.length*11);if(y+rh>485){p=page();pages.push(p);rect(p,0,0,595,7,NAVY);y=28;text(p,42,y,'Rapport '+x.o.no+' · Leistungen',12,true,NAVY);y+=16;rect(p,42,y,511,24,NAVY);heads.forEach(function(h,j){text(p,cols[j]+5,y+15,h,7.5,true,[255,255,255],j>3?'right':null)});y+=24}rect(p,42,y,511,rh,null,LINE);text(p,47,y+16,String(i+1),8.3,false,TEXT);desc.forEach(function(r,j){text(p,70,y+16+j*11,r,8.3,false,TEXT)});text(p,379,y+16,String(l.qty==null?'':l.qty),8.3,false,TEXT,'right');text(p,425,y+16,String(l.unit||''),8.3,false,TEXT,'right');text(p,488,y+16,money(l.price),8.3,false,TEXT,'right');text(p,548,y+16,money((+l.qty||0)*(+l.price||0)),8.3,false,TEXT,'right');y+=rh});
    function need(h,title){if(y+h<735)return;p=page();pages.push(p);rect(p,0,0,595,7,NAVY);y=30;if(title){text(p,42,y,title,12,true,NAVY);y+=16}}
    y+=18;need(90,'Ausgeführte Arbeiten');text(p,42,y,'Ausgeführte Arbeiten',12,true,NAVY);y+=17;y=wrapped(p,42,y,x.r.work||'–',511,9,13,false,TEXT)+12;need(75,'Ergebnis / weitere Arbeiten');text(p,42,y,'Ergebnis / weitere Arbeiten',10,true,NAVY);y+=15;y=wrapped(p,42,y,x.r.result||'–',511,9,13,false,TEXT)+16;
    need(95,'Abrechnung');var bx=320,bw=233;rect(p,bx,y,bw,25,LIGHT,LINE);text(p,bx+12,y+16,'Nettobetrag',8.5,false,TEXT);text(p,bx+bw-12,y+16,money(t.net),8.5,false,TEXT,'right');y+=25;rect(p,bx,y,bw,25,LIGHT,LINE);text(p,bx+12,y+16,'+'+t.rate+'% MwSt.',8.5,false,TEXT);text(p,bx+bw-12,y+16,money(t.vat),8.5,false,TEXT,'right');y+=25;rect(p,bx,y,bw,27,NAVY);text(p,bx+12,y+17,'Bruttobetrag',9.5,true,[255,255,255]);text(p,bx+bw-12,y+17,money(t.gross),9.5,true,[255,255,255],'right');y+=39;
    need(115,'Bestätigung');rect(p,42,y,511,34,[246,248,250],LINE);text(p,54,y+21,x.r.payment||'Rechnung wird verschickt',9,false,TEXT);y+=48;y=wrapped(p,42,y,'Hiermit bestätige ich die Richtigkeit der oben genannten Arbeiten. Die AGB habe ich gelesen, verstanden und akzeptiere diese.',511,7.8,11,false,MUTED)+18;need(100,'Unterschriften');text(p,42,y,'Unterschrift Facharbeiter',8.5,true,NAVY);text(p,313,y,'Unterschrift Kunde',8.5,true,NAVY);if(sigT)img(p,'ImSigT',48,y+8,120,46);if(sigC)img(p,'ImSigC',319,y+8,120,46);line(p,42,y+62,260,y+62,LINE,.7);line(p,313,y+62,553,y+62,LINE,.7);
    pages.forEach(function(pg){line(pg,42,795,553,795,LINE,.6);text(pg,42,811,x.co.companyName+' · '+x.co.bankName+' · IBAN '+x.co.iban,7,false,MUTED);text(pg,553,824,'USt-IdNr. '+x.co.vatId+' · '+x.co.website,7,false,MUTED,'right')});
    var blob=makePdf(pages,{ImLogo:logo,ImSigT:sigT,ImSigC:sigC});return{blob:blob,name:'Rapport-'+x.o.no+'.pdf',ctx:x};
  }

  function makePdf(pages,images){
    var objects={},next=5,imageIds={};objects[1]=ascii('<< /Type /Catalog /Pages 2 0 R >>');objects[3]=ascii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');objects[4]=ascii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    Object.keys(images).forEach(function(k){var im=images[k];if(!im)return;var id=next++;imageIds[k]=id;objects[id]=cat([ascii('<< /Type /XObject /Subtype /Image /Width '+im.width+' /Height '+im.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+im.bytes.length+' >>\nstream\n'),im.bytes,ascii('\nendstream')])});
    var pageIds=[];pages.forEach(function(pg){var contentId=next++,pageId=next++;pageIds.push(pageId);var content=bytes(pg.ops.join('')),xo=Object.keys(pg.images).filter(function(k){return imageIds[k]}).map(function(k){return'/'+k+' '+imageIds[k]+' 0 R'}).join(' ');objects[contentId]=cat([ascii('<< /Length '+content.length+' >>\nstream\n'),content,ascii('\nendstream')]);objects[pageId]=ascii('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>'+(xo?' /XObject << '+xo+' >>':'')+' >> /Contents '+contentId+' 0 R >>')});objects[2]=ascii('<< /Type /Pages /Kids ['+pageIds.map(function(id){return id+' 0 R'}).join(' ')+'] /Count '+pageIds.length+' >>');
    var max=next-1,parts=[ascii('%PDF-1.4\n%âãÏÓ\n')],offset=[0],pos=parts[0].length;for(var id=1;id<=max;id++){var body=objects[id]||ascii('<<>>'),head=ascii(id+' 0 obj\n'),tail=ascii('\nendobj\n');offset[id]=pos;parts.push(head,body,tail);pos+=head.length+body.length+tail.length}var xref=pos,s='xref\n0 '+(max+1)+'\n0000000000 65535 f \n';for(id=1;id<=max;id++)s+=String(offset[id]).padStart(10,'0')+' 00000 n \n';s+='trailer\n<< /Size '+(max+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';parts.push(ascii(s));return new Blob(parts,{type:'application/pdf'})
  }
  function download(blob,name){var u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},15000)}
  function notice(t){var old=document.querySelector('.report-share-notice-v17');if(old)old.remove();var n=document.createElement('div');n.className='report-share-notice-v17';n.textContent=t;document.body.appendChild(n);setTimeout(function(){if(n.parentNode)n.remove()},6000)}
  function phone(p){return String(p||'').replace(/[^0-9]/g,'').replace(/^0/,'49')}
  function record(x,ch){var db=readDb(),r=(db.reports||[]).find(function(z){return z.id==x.r.id})||(db.reports||[]).find(function(z){return z.orderId==x.o.id});if(!r)return;r.sentHistory=r.sentHistory||[];var s=session();r.sentHistory.push({at:new Date().toLocaleString('de-DE'),by:s?s.user:'System',channel:ch});writeDb(db)}
  async function share(){try{var b=await build(),f=new File([b.blob],b.name,{type:'application/pdf'}),msg='Guten Tag '+(b.ctx.c.contact||b.ctx.c.name)+', hier erhalten Sie den Rapport zu Auftrag '+b.ctx.o.no+'.';if(navigator.share&&navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({title:'Rapport '+b.ctx.o.no,text:msg,files:[f]});record(b.ctx,'PDF geteilt');notice('Rapport-PDF wurde zum Teilen übergeben.');return true}download(b.blob,b.name);record(b.ctx,'PDF heruntergeladen / WhatsApp');window.open('https://wa.me/'+phone(b.ctx.c.phone)+'?text='+encodeURIComponent(msg+' Die PDF wurde soeben heruntergeladen und kann hier angehängt werden.'),'_blank');notice('PDF heruntergeladen. WhatsApp wurde geöffnet.');return true}catch(e){console.error(e);notice('PDF konnte nicht erstellt werden: '+(e&&e.message?e.message:e));return false}}
  async function downloadPdf(){try{var b=await build();download(b.blob,b.name);notice('Rapport-PDF wurde erstellt.');return true}catch(e){console.error(e);notice('PDF konnte nicht erstellt werden: '+(e&&e.message?e.message:e));return false}}
  function enhance(){var main=document.querySelector('main.shell');if(!main||!main.querySelector('#rw'))return;var send=document.querySelector('button[onclick*="sendReportPreferred"],button[data-report-pdf-v17]');if(send&&!send.dataset.reportNativeV18){send.dataset.reportNativeV18='1';send.textContent='PDF über WhatsApp teilen';send.onclick=function(e){e.preventDefault();share()}}document.documentElement.dataset.shReportNativePdf=BUILD}
  var queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;enhance()})}new MutationObserver(schedule).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  window.SHP_REPORT_NATIVE_PDF={build:BUILD,buildPdf:build,sharePdf:share,downloadPdf:downloadPdf};
  if(window.SHP_REPORT_DOCUMENT){window.SHP_REPORT_DOCUMENT.buildPdf=build;window.SHP_REPORT_DOCUMENT.sharePdf=share;window.SHP_REPORT_DOCUMENT.downloadPdf=downloadPdf}
  if(window.SH){window.SH.shareReportPdf=share;window.SH.downloadReportPdf=downloadPdf}
  enhance();
})();