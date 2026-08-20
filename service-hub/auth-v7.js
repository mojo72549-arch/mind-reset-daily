(function(){
  function hardenLogin(){
    var box=document.querySelector('.loginbox');
    if(!box)return;

    var user=document.getElementById('u');
    if(user){
      user.type='hidden';
      var userField=user.closest('.field');
      if(userField)userField.style.display='none';
    }

    var pass=document.getElementById('p');
    if(pass){
      pass.type='password';
      pass.setAttribute('autocomplete','current-password');
      pass.setAttribute('aria-label','Passwort');
    }

    Array.prototype.slice.call(box.querySelectorAll('.muted.small')).forEach(function(node){
      var text=(node.textContent||'').toLowerCase();
      if(text.indexOf('demo-')>=0||text.indexOf('dome /')>=0||text.indexOf('annette')>=0||text.indexOf('admin')>=0){
        node.remove();
      }
    });

    if(!box.querySelector('.login-security-note')){
      var note=document.createElement('p');
      note.className='muted small login-security-note';
      note.textContent='Zugangsdaten werden nicht öffentlich angezeigt.';
      var button=box.querySelector('button');
      if(button)button.insertAdjacentElement('afterend',note);
      else box.appendChild(note);
    }
  }

  hardenLogin();
  new MutationObserver(hardenLogin).observe(document.documentElement,{childList:true,subtree:true});
})();
