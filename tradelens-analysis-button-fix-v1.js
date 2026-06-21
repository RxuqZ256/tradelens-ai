(function(){
  "use strict";
  var frame=document.getElementById("app");

  function install(){
    try{
      var win=frame&&frame.contentWindow;
      var doc=frame&&(frame.contentDocument||(win&&win.document));
      if(!win||!doc||!doc.body)return false;

      var button=doc.getElementById("btn-weiter");
      if(!button)return false;

      function uploadIsReady(){
        try{
          if(win.UP&&win.UP.current&&win.UP.current.id&&win.UP.current.storage_path)return true;
        }catch(_error){}
        var page=doc.getElementById("page-analyse")||doc.body;
        var text=String(page.textContent||"").toUpperCase();
        return text.indexOf("UPLOAD ABGESCHLOSSEN")>=0&&text.indexOf("100%")>=0;
      }

      function enableButton(){
        if(!uploadIsReady())return;
        button.disabled=false;
        button.removeAttribute("disabled");
        button.setAttribute("aria-disabled","false");
        button.style.opacity="1";
        button.style.pointerEvents="auto";
        button.style.position="relative";
        button.style.zIndex="100";
        button.style.touchAction="manipulation";
      }

      function showError(){
        var box=doc.getElementById("tl-analysis-button-error");
        if(!box){
          box=doc.createElement("div");
          box.id="tl-analysis-button-error";
          box.style.cssText="margin-top:10px;padding:12px;border:1px solid #ff4d6d;border-radius:12px;background:#2b0712;color:#ffd7df;text-align:center;font-size:12px";
          button.insertAdjacentElement("afterend",box);
        }
        box.textContent="Die Analyse konnte nicht gestartet werden. Bitte lade die Seite neu. (TL-B02)";
      }

      var running=false;
      function start(event){
        if(event){event.preventDefault();event.stopPropagation();}
        enableButton();
        if(button.disabled||running)return false;
        running=true;
        setTimeout(function(){running=false;},1200);
        try{
          if(win.AN&&!doc.getElementById("page-analysis-loading").classList.contains("active")){
            win.AN.busy=false;
            win.AN.verifying=false;
          }
          if(typeof win.weiterZurAnalyse==="function"){
            win.weiterZurAnalyse(event||null);
            return false;
          }
        }catch(_error){}
        showError();
        return false;
      }

      enableButton();
      button.onclick=start;
      button.ontouchend=start;
      button.onpointerup=start;

      if(!win.__tlButtonEnableTimer){
        win.__tlButtonEnableTimer=win.setInterval(enableButton,700);
      }
      return true;
    }catch(_error){return false;}
  }

  function boot(){
    var tries=0;
    var timer=setInterval(function(){
      tries++;
      if(install()||tries>80)clearInterval(timer);
    },250);
  }

  if(frame){
    frame.addEventListener("load",function(){setTimeout(boot,100);});
    setTimeout(boot,350);
  }
})();
