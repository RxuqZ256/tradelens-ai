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

      function clearForcedLoading(){
        var loading=doc.getElementById("page-analysis-loading");
        if(!loading)return;
        loading.style.removeProperty("display");
        loading.style.removeProperty("visibility");
        loading.style.removeProperty("opacity");
        loading.style.removeProperty("transform");
        loading.style.removeProperty("pointer-events");
        loading.style.removeProperty("z-index");
        loading.style.removeProperty("position");
        loading.style.removeProperty("inset");
        loading.removeAttribute("data-tl-force-visible");
      }

      function forceLoadingVisible(){
        var loading=doc.getElementById("page-analysis-loading");
        if(!loading)return false;

        var pages=doc.querySelectorAll(".page");
        for(var i=0;i<pages.length;i++){
          if(pages[i]!==loading)pages[i].classList.remove("active");
        }

        loading.hidden=false;
        loading.removeAttribute("hidden");
        loading.classList.add("active");
        loading.setAttribute("data-tl-force-visible","1");
        loading.style.setProperty("display","block","important");
        loading.style.setProperty("visibility","visible","important");
        loading.style.setProperty("opacity","1","important");
        loading.style.setProperty("transform","none","important");
        loading.style.setProperty("pointer-events","auto","important");
        loading.style.setProperty("z-index","900","important");
        loading.style.setProperty("position","absolute","important");
        loading.style.setProperty("inset","0","important");
        loading.scrollTop=0;
        doc.body.classList.add("analysis-loading-active");
        return true;
      }

      function showError(message){
        doc.body.classList.remove("analysis-loading-active");
        var analyse=doc.getElementById("page-analyse");
        if(analyse)analyse.classList.add("active");
        clearForcedLoading();
        var box=doc.getElementById("tl-analysis-button-error");
        if(!box){
          box=doc.createElement("div");
          box.id="tl-analysis-button-error";
          box.style.cssText="margin-top:10px;padding:12px;border:1px solid #ff4d6d;border-radius:12px;background:#2b0712;color:#ffd7df;text-align:center;font-size:12px";
          button.insertAdjacentElement("afterend",box);
        }
        box.textContent=(message||"Die Analyse konnte nicht gestartet werden. Bitte lade die Seite neu.")+" (TL-B03)";
      }

      function watchTransition(){
        var checks=0;
        var timer=win.setInterval(function(){
          checks++;
          var loading=doc.getElementById("page-analysis-loading");
          var result=doc.getElementById("page-ergebnis");
          var analyse=doc.getElementById("page-analyse");

          if(result&&result.classList.contains("active")){
            clearForcedLoading();
            win.clearInterval(timer);
            return;
          }

          if(analyse&&analyse.classList.contains("active")&&loading&&!loading.classList.contains("active")){
            clearForcedLoading();
            win.clearInterval(timer);
            return;
          }

          if(loading&&loading.classList.contains("active")&&checks<120){
            forceLoadingVisible();
          }

          if(checks>=120){
            clearForcedLoading();
            win.clearInterval(timer);
          }
        },250);
      }

      var running=false;
      function start(event){
        if(event){
          if(event.preventDefault)event.preventDefault();
          if(event.stopPropagation)event.stopPropagation();
        }
        enableButton();
        if(button.disabled||running)return false;
        running=true;
        win.setTimeout(function(){running=false;},1500);

        if(!forceLoadingVisible()){
          showError("Der Ladescreen fehlt im aktuellen App-Dokument.");
          return false;
        }

        watchTransition();

        win.requestAnimationFrame(function(){
          win.requestAnimationFrame(function(){
            try{
              if(win.AN){win.AN.busy=false;win.AN.verifying=false;win.AN.cancelled=false;}
              if(typeof win.weiterZurAnalyse==="function"){
                win.weiterZurAnalyse(null);
                win.setTimeout(forceLoadingVisible,50);
                win.setTimeout(forceLoadingVisible,250);
                return;
              }
              showError("Das Analyse-Modul wurde nicht geladen.");
            }catch(_error){
              showError("Beim Start der Analyse ist ein Fehler aufgetreten.");
            }
          });
        });
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
