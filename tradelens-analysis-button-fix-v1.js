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

      function ensureLoaderStyle(){
        if(doc.getElementById("tl-loader-visibility-fix"))return;
        var style=doc.createElement("style");
        style.id="tl-loader-visibility-fix";
        style.textContent=[
          "#page-analysis-loading[data-tl-force-visible='1']{",
          "display:block!important;visibility:visible!important;opacity:1!important;",
          "transform:none!important;pointer-events:auto!important;z-index:9999!important;",
          "position:absolute!important;inset:0!important;overflow-y:auto!important;",
          "background:radial-gradient(360px 260px at 80% 5%,rgba(0,229,255,.10),transparent 72%),radial-gradient(420px 320px at 8% 94%,rgba(124,58,237,.14),transparent 72%),linear-gradient(180deg,#020713 0%,#01040d 58%,#010208 100%)!important;",
          "}",
          "body.analysis-loading-active .bottomnav,body.analysis-loading-active .home-ind{display:none!important}",
          ".page[data-tl-hidden-by-loader='1']{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}"
        ].join("");
        doc.head.appendChild(style);
      }

      function restorePages(){
        var hidden=doc.querySelectorAll(".page[data-tl-hidden-by-loader='1']");
        for(var i=0;i<hidden.length;i++)hidden[i].removeAttribute("data-tl-hidden-by-loader");
      }

      function clearForcedLoading(removeActive){
        var loading=doc.getElementById("page-analysis-loading");
        restorePages();
        doc.body.classList.remove("analysis-loading-active");
        if(!loading)return;
        if(removeActive)loading.classList.remove("active");
        loading.style.removeProperty("display");
        loading.style.removeProperty("visibility");
        loading.style.removeProperty("opacity");
        loading.style.removeProperty("transform");
        loading.style.removeProperty("pointer-events");
        loading.style.removeProperty("z-index");
        loading.style.removeProperty("position");
        loading.style.removeProperty("inset");
        loading.style.removeProperty("background");
        loading.removeAttribute("data-tl-force-visible");
      }

      function forceLoadingVisible(){
        var loading=doc.getElementById("page-analysis-loading");
        if(!loading)return false;
        ensureLoaderStyle();

        var pages=doc.querySelectorAll(".page");
        for(var i=0;i<pages.length;i++){
          if(pages[i]!==loading){
            pages[i].classList.remove("active");
            pages[i].setAttribute("data-tl-hidden-by-loader","1");
          }
        }

        loading.hidden=false;
        loading.removeAttribute("hidden");
        loading.classList.add("active");
        loading.setAttribute("data-tl-force-visible","1");
        loading.scrollTop=0;
        doc.body.classList.add("analysis-loading-active");
        return true;
      }

      function revealResult(){
        var result=doc.getElementById("page-ergebnis");
        var loading=doc.getElementById("page-analysis-loading");
        clearForcedLoading(true);
        var pages=doc.querySelectorAll(".page");
        for(var i=0;i<pages.length;i++)pages[i].classList.remove("active");
        if(result){
          result.hidden=false;
          result.removeAttribute("hidden");
          result.classList.add("active");
          result.style.removeProperty("display");
          result.style.removeProperty("visibility");
          result.style.removeProperty("opacity");
          result.style.removeProperty("transform");
          result.scrollTop=0;
        }
        if(loading)loading.classList.remove("active");
      }

      function showError(message){
        clearForcedLoading(true);
        var analyse=doc.getElementById("page-analyse");
        if(analyse)analyse.classList.add("active");
        var box=doc.getElementById("tl-analysis-button-error");
        if(!box){
          box=doc.createElement("div");
          box.id="tl-analysis-button-error";
          box.style.cssText="margin-top:10px;padding:12px;border:1px solid #ff4d6d;border-radius:12px;background:#2b0712;color:#ffd7df;text-align:center;font-size:12px";
          button.insertAdjacentElement("afterend",box);
        }
        box.textContent=(message||"Die Analyse konnte nicht gestartet werden. Bitte lade die Seite neu.")+" (TL-B04)";
      }

      function percentValue(){
        var pct=doc.getElementById("al-pct");
        if(!pct)return 0;
        var value=parseInt(String(pct.textContent||"0").replace(/[^0-9]/g,""),10);
        return isFinite(value)?value:0;
      }

      function watchTransition(){
        var checks=0;
        var completedAt=0;
        var timer=win.setInterval(function(){
          checks++;
          var loading=doc.getElementById("page-analysis-loading");
          var result=doc.getElementById("page-ergebnis");
          var analyse=doc.getElementById("page-analyse");

          if(result&&result.classList.contains("active")){
            revealResult();
            win.clearInterval(timer);
            return;
          }

          var pct=percentValue();
          if(pct>=100){
            if(!completedAt)completedAt=Date.now();
            if(Date.now()-completedAt>900){
              revealResult();
              win.clearInterval(timer);
              return;
            }
          }

          if(analyse&&analyse.classList.contains("active")&&loading&&!loading.classList.contains("active")){
            clearForcedLoading(false);
            win.clearInterval(timer);
            return;
          }

          if(loading&&loading.classList.contains("active"))forceLoadingVisible();

          if(checks>=720){
            showError("Die Analyse hat zu lange gedauert.");
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

      if(!win.__tlButtonEnableTimer)win.__tlButtonEnableTimer=win.setInterval(enableButton,700);
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
