(function(){
  'use strict';

  if(window.SHP_STABILITY)return;

  var BUILD='20260908-v20-global-stability1';
  var MAX_SELF_MUTATING_RUNS=5;
  var MAX_MUTATION_DRIVEN_FLUSHES=8;
  var MAX_ERROR_RUNS=3;
  var MAX_SLOW_RUNS=3;
  var SLOW_CALLBACK_MS=100;
  var LOOP_WINDOW_MS=350;
  var RECENT_MUTATION_WINDOW_MS=1000;
  var QUARANTINE_MS=5000;
  var GLOBAL_COOLDOWN_MS=1200;
  var root=document.getElementById('app')||document.body;
  var entries=[];
  var observer=null;
  var observerConnected=false;
  var pending=false;
  var running=false;
  var pendingReasons=[];
  var rafId=0;
  var resumeTimer=0;
  var suspendedUntil=0;
  var lastActivityAt=clock();
  var lastMutationFlushAt=0;
  var consecutiveMutationFlushes=0;
  var diagnostics={
    flushes:0,
    mutationBatches:0,
    mutationRecords:0,
    callbackMutationRecords:0,
    callbackErrors:0,
    slowCallbacks:0,
    circuitTrips:0,
    quarantines:0,
    maxConsecutiveFlushes:0,
    maxFlushMs:0,
    lastCircuitReason:'',
    lastError:''
  };

  function clock(){return window.performance&&typeof window.performance.now==='function'?window.performance.now():Date.now()}

  function observe(){
    if(!observer||!root||clock()<suspendedUntil)return;
    observer.observe(root,{childList:true,subtree:true});
    observerConnected=true;
  }

  function noteActivity(){lastActivityAt=clock()}

  function nativeMutations(records){
    diagnostics.mutationBatches+=1;
    diagnostics.mutationRecords+=records.length;
    noteActivity();
    request('mutation');
  }

  function scheduleResume(delay){
    if(resumeTimer)clearTimeout(resumeTimer);
    resumeTimer=setTimeout(function(){
      resumeTimer=0;
      if(clock()<suspendedUntil){scheduleResume(suspendedUntil-clock()+20);return}
      suspendedUntil=0;
      observe();
      request('recovery');
    },Math.max(20,delay));
  }

  function markCircuit(reason){
    diagnostics.circuitTrips+=1;
    diagnostics.lastCircuitReason=reason;
    document.documentElement.dataset.shStabilityCircuit='tripped';
    document.documentElement.dataset.shStabilityCircuitReason=reason;
  }

  function quarantine(entry,reason,duration){
    var until=clock()+(duration||QUARANTINE_MS);
    if(entry.disabledUntil>=until-20)return;
    entry.disabledUntil=until;
    entry.mutatingStreak=0;
    entry.errorStreak=0;
    entry.slowStreak=0;
    entry.quarantines+=1;
    diagnostics.quarantines+=1;
    markCircuit(entry.name+': '+reason);
    try{console.error('[Service Hub Stabilität] Erweiterung vorübergehend angehalten: '+entry.name+' ('+reason+').')}catch(ignore){}
    setTimeout(function(){
      if(clock()+5<entry.disabledUntil)return;
      entry.disabledUntil=0;
      entry.recentMutationTimes=[];
      request('quarantine-recovery');
    },(duration||QUARANTINE_MS)+20);
  }

  function globalCircuit(reason){
    var now=clock();
    var suspects=entries.filter(function(entry){
      entry.recentMutationTimes=entry.recentMutationTimes.filter(function(at){return now-at<=RECENT_MUTATION_WINDOW_MS});
      return entry.recentMutationTimes.length>=2&&entry.disabledUntil<=now;
    });
    suspects.forEach(function(entry){quarantine(entry,'wiederholte DOM-Änderungen',QUARANTINE_MS)});
    if(!suspects.length)markCircuit(reason);
    suspendedUntil=now+GLOBAL_COOLDOWN_MS;
    consecutiveMutationFlushes=0;
    if(observer)observer.disconnect();
    observerConnected=false;
    scheduleResume(GLOBAL_COOLDOWN_MS+20);
    try{console.error('[Service Hub Stabilität] DOM-Schleife begrenzt: '+reason+'.')}catch(ignore){}
  }

  function request(reason){
    reason=reason||'manual';
    if(pendingReasons.indexOf(reason)<0)pendingReasons.push(reason);
    noteActivity();
    if(clock()<suspendedUntil)return;
    if(pending||running)return;
    pending=true;
    rafId=requestAnimationFrame(flush);
  }

  function recordMutation(entry,count,at){
    diagnostics.callbackMutationRecords+=count;
    entry.mutationRecords+=count;
    entry.mutatingStreak+=1;
    entry.recentMutationTimes.push(at);
    entry.recentMutationTimes=entry.recentMutationTimes.filter(function(time){return at-time<=RECENT_MUTATION_WINDOW_MS});
    noteActivity();
    if(entry.mutatingStreak>=MAX_SELF_MUTATING_RUNS)quarantine(entry,'selbst auslösende DOM-Schleife',QUARANTINE_MS);
  }

  function runEntry(entry){
    var now=clock();
    if(entry.disabledUntil>now)return 0;
    if(entry.disabledUntil){entry.disabledUntil=0;entry.recentMutationTimes=[]}
    var started=clock();
    var failed=false;
    try{
      entry.callback();
      entry.errorStreak=0;
    }catch(error){
      failed=true;
      entry.errors+=1;
      entry.errorStreak+=1;
      diagnostics.callbackErrors+=1;
      diagnostics.lastError=entry.name+': '+String(error&&error.message||error);
      try{console.error('[Service Hub Stabilität] Fehler in '+entry.name+':',error)}catch(ignore){}
      if(entry.errorStreak>=MAX_ERROR_RUNS)quarantine(entry,'wiederholte Laufzeitfehler',QUARANTINE_MS);
    }
    var elapsed=clock()-started;
    entry.runs+=1;
    entry.maxMs=Math.max(entry.maxMs,elapsed);
    if(elapsed>SLOW_CALLBACK_MS){
      entry.slowRuns+=1;
      entry.slowStreak+=1;
      diagnostics.slowCallbacks+=1;
      if(entry.slowStreak>=MAX_SLOW_RUNS)quarantine(entry,'wiederholt langsame Verarbeitung',QUARANTINE_MS);
    }else entry.slowStreak=0;
    var records=observer?observer.takeRecords():[];
    if(records.length)recordMutation(entry,records.length,clock());
    else if(!failed)entry.mutatingStreak=0;
    return records.length;
  }

  function flush(timestamp){
    pending=false;
    rafId=0;
    if(clock()<suspendedUntil)return;
    var reasons=pendingReasons.splice(0,pendingReasons.length);
    var externalMutation=reasons.indexOf('mutation')>=0;
    var callbackDriven=!externalMutation&&reasons.indexOf('callback-mutation')>=0;
    if(callbackDriven){
      if(timestamp-lastMutationFlushAt<=LOOP_WINDOW_MS)consecutiveMutationFlushes+=1;
      else consecutiveMutationFlushes=1;
      lastMutationFlushAt=timestamp;
      diagnostics.maxConsecutiveFlushes=Math.max(diagnostics.maxConsecutiveFlushes,consecutiveMutationFlushes);
      if(consecutiveMutationFlushes>MAX_MUTATION_DRIVEN_FLUSHES){globalCircuit('zu viele aufeinanderfolgende DOM-Durchläufe');return}
    }else consecutiveMutationFlushes=0;

    running=true;
    var started=clock();
    var produced=0;
    entries.slice().forEach(function(entry){produced+=runEntry(entry)});
    diagnostics.flushes+=1;
    diagnostics.maxFlushMs=Math.max(diagnostics.maxFlushMs,clock()-started);
    running=false;
    if(produced)request('callback-mutation');
    else if(pendingReasons.length)request(pendingReasons[0]);
  }

  function register(name,callback,options){
    if(typeof name!=='string'||!name)throw new TypeError('Stabilitäts-Registrierung braucht einen Namen.');
    if(typeof callback!=='function')throw new TypeError('Stabilitäts-Registrierung braucht eine Funktion.');
    var existing=entries.find(function(entry){return entry.name===name});
    if(existing){
      existing.callback=callback;
      if(!options||options.initial!==false)request('register');
      return function(){unregister(name)};
    }
    entries.push({name:name,callback:callback,runs:0,errors:0,errorStreak:0,slowRuns:0,slowStreak:0,maxMs:0,mutationRecords:0,mutatingStreak:0,recentMutationTimes:[],disabledUntil:0,quarantines:0});
    if(!options||options.initial!==false)request('register');
    return function(){unregister(name)};
  }

  function unregister(name){
    entries=entries.filter(function(entry){return entry.name!==name});
  }

  function snapshot(){
    var now=clock();
    return{
      build:BUILD,
      root:root&&root.id?'#'+root.id:(root&&root.tagName||'').toLowerCase(),
      observerCount:observerConnected?1:0,
      registrationCount:entries.length,
      pending:pending,
      running:running,
      suspended:now<suspendedUntil,
      idleForMs:Math.max(0,now-lastActivityAt),
      diagnostics:Object.assign({},diagnostics),
      registrations:entries.map(function(entry){return{name:entry.name,runs:entry.runs,errors:entry.errors,slowRuns:entry.slowRuns,maxMs:Math.round(entry.maxMs*10)/10,mutationRecords:entry.mutationRecords,quarantines:entry.quarantines,quarantined:entry.disabledUntil>now}})
    };
  }

  function whenIdle(options){
    options=options||{};
    var quietMs=Math.max(50,Number(options.quietMs)||250);
    var timeoutMs=Math.max(quietMs,Number(options.timeoutMs)||5000);
    var started=clock();
    return new Promise(function(resolve){
      function check(){
        var now=clock();
        var idle=!pending&&!running&&now>=suspendedUntil&&now-lastActivityAt>=quietMs;
        if(idle||now-started>=timeoutMs){
          var result=snapshot();
          result.idle=idle;
          result.timedOut=!idle;
          resolve(result);
          return;
        }
        setTimeout(check,Math.min(50,Math.max(16,quietMs-(now-lastActivityAt))));
      }
      check();
    });
  }

  observer=new MutationObserver(nativeMutations);
  observe();
  document.documentElement.dataset.shStabilityBuild=BUILD;
  window.SHP_STABILITY={
    build:BUILD,
    register:register,
    unregister:unregister,
    request:request,
    snapshot:snapshot,
    whenIdle:whenIdle
  };
})();
