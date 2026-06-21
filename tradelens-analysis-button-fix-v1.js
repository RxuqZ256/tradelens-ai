(function(){
  "use strict";

  var frame=document.getElementById("app");
  var VERSION="20260622a";

  function getContext(){
    try{
      if(!frame)return null;
      var win=frame.contentWindow;
      var doc=frame.contentDocument||(win&&win.document);
      if(!win||!doc||!doc.body)return null;
      return{win:win,doc:doc};
    }catch(_error){return null;}
  }

  function install(){
    var ctx=getContext();
    if(!ctx)return false;
    var win=ctx.win,doc=ctx.doc;

    function uploadComplete(){
      try{
        if(win.UP&&win.UP.current&&win.UP.current.id&&win.UP.current.storage_path)return true;
      }catch(_error){}
      var page=doc.getElementById("page-analyse")||doc.body;
      var text=String(page.textContent||"").toUpperCase();
      return text.indexOf("UPLOAD ABGESCHLOSSEN")>=0&&text.indexOf("100%")>=0;
    }

    function syncButton(){
      var button=doc.getElementById("btn-weiter");
      if(!button)return false;
      button.style.position="relative";
      button.style.zIndex="80";
      button.style.touchAction="manipulation";
      if(uploadComplete()){
        button.disabled=false;
        button.removeAttribute("disabled");
        button.setAttribute("aria-disabled","false");
        button.style.opacity="1";
        button.style.pointerEvents="auto";
      }
      return true;
    }

    function showBridgeError(){
      try{
        if(typeof win.showUploadError==="function"){
          win.showUploadError("Der Analyse-Button konnte nicht gestartet werden. Bitte lade die Seite neu.");
          return;
        }
      }catch(_error){}
      var button=doc.getElementById("btn-weiter");
      if(!button)return;
      var error=doc.getElementById("tl-analysis-button-fix-error");
      if(!error){
        error=doc.createElement("div");
        error.id="tl-analysis-button-fix-error";
        error.style.cssText="margin-top:10px;padding:12px 14px;border:1px solid rgba(255,77,109,.65);border-radius:12px;background:rgba(70,8,24,.82);color:#ffd7df;font:600 12px/1.45 sans-serif;text-align:center";
        button.insertAdjacentElement("afterend",error);
      }
      error.textContent="Der Analyse-Button konnte nicht gestartet werden. Bitte lade die Seite neu. (TL-B01)";
    }

    var lastStart=0;
    function startAnalysis(event){
      var target=event&&event.target;
      var button=target&&target.closest?target.closest("#btn-weiter"):doc.getElementById("btn-weiter");
      if(!button)return;

      syncButton();
      if(button.disabled||button.getAttribute("aria-disabled")==="true")return;

      var now=Date.now();
      if(now-lastStart<700)return;
      lastStart=now;

      if(event){
        if(event.preventDefault)event.preventDefault();
        if(event.stopImmediatePropagation)event.stopImmediatePropagation();
        else if(event.stopPropagation)event.stopPropagation();
      }

      try{
        if(typeof win.weiterZurAnalyse==="function"){
          win.weiterZurAnalyse(event||null);
          return;
        }
      }catch(error){
        try{console.error("[TradeLens] analysis bridge failed",error);}catch(_error){}
      }
      showBridgeError();
    }

    if(doc.documentElement.getAttribute("data-tl-analysis-button-fix")!==VERSION){
      doc.documentElement.setAttribute("data-tl-analysis-button-fix",VERSION);
      doc.addEventListener("click",startAnalysis,true);
      doc.addEventListener("pointerup",startAnalysis,true);
      doc.addEventListener("touchend",startAnalysis,{capture:true,passive:false});

      try{
        var observer=new win.MutationObserver(function(){syncButton();});
        observer.observe(doc.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["disabled","style","class"]});
        win.__tlAnalysisButtonObserver=observer;
      }catch(_error){}

      win.__tlAnalysisButtonSyncTimer=win.setInterval(syncButton,500);
    }

    syncButton();
    try{if(typeof win.wireAnalysisButton==="function")win.wireAnalysisButton();}catch(_error){}
    return true;
  }

  function boot(){
    var attempts=0;
    var timer=setInterval(function(){
      attempts++;
      if(install()||attempts>=80)clearInterval(timer);
    },250);
  }

  if(frame){
    frame.addEventListener("load",function(){setTimeout(boot,100);});
    setTimeout(boot,350);
  }
})();
