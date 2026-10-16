// Plain script, loaded before the app: if the app cannot start, show why instead of a blank page.
(function(){
  function show(text){var m=document.getElementById('main');if(m)m.innerHTML='<div class="card"><h2>Recap Reader could not start</h2><p></p><p class="meta">Please send a screenshot of this message. Updating Chrome from the Play Store often fixes it.</p></div>',m.querySelector('p').textContent=text;}
  window.addEventListener('error',function(e){show(String(e.message||e.error||'Unknown error')+(e.filename?' ('+e.filename.split('/').pop()+':'+e.lineno+')':''));});
  window.addEventListener('unhandledrejection',function(e){show(String(e.reason&&e.reason.message||e.reason));});
  setTimeout(function(){if(document.getElementById('loading'))show('The app did not finish loading. Check the internet connection the first time you open it, then reload.');},8000);
})();
