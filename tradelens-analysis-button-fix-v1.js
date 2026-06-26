(function(){
  "use strict";
  var frame=document.getElementById("app");

  function install(){
    try{
      var win=frame&&frame.contentWindow;
      var doc=frame&&(frame.contentDocument||(win&&win.document));
      if(!win||!doc||!doc.body)return false;

      var button=doc.getElementById("btn-weiter");
      var loading=doc.getElementById("page-analysis-loading");
      if(!button||!loading)return false;

      if(!doc.getElementById("tl-native-analysis-flow-fix")){
        var style=doc.createElement("style");
        style.id="tl-native-analysis-flow-fix";
        style.textContent=[
          "#page-analysis-loading.active{",
          "display:block!important;visibility:visible!important;opacity:1!important;",
          "transform:none!important;pointer-events:auto!important;z-index:9999!important;",
          "position:absolute!important;inset:0!important;overflow-y:auto!important;overflow-x:hidden!important;",
          "background:radial-gradient(360px 260px at 80% 5%,rgba(0,229,255,.10),transparent 72%),",
          "radial-gradient(420px 320px at 8% 94%,rgba(124,58,237,.14),transparent 72%),",
          "linear-gradient(180deg,#020713 0%,#01040d 58%,#010208 100%)!important;",
          "}",
          "body.tl-native-analysis-running .bottomnav,body.tl-native-analysis-running .home-ind{display:none!important}"
        ].join("");
        doc.head.appendChild(style);
      }

      function uploadReady(){
        try{
          if(win.UP&&win.UP.current&&win.UP.current.id&&win.UP.current.storage_path)return true;
        }catch(_error){}
        var page=doc.getElementById("page-analyse")||doc.body;
        var text=String(page.textContent||"").toUpperCase();
        return text.indexOf("UPLOAD ABGESCHLOSSEN")>=0&&text.indexOf("100%")>=0;
      }

      function syncButton(){
        if(!uploadReady())return;
        button.disabled=false;
        button.removeAttribute("disabled");
        button.setAttribute("aria-disabled","false");
        button.style.opacity="1";
        button.style.pointerEvents="auto";
        button.style.touchAction="manipulation";
      }

      function syncLoadingState(){
        if(loading.classList.contains("active")){
          loading.hidden=false;
          loading.removeAttribute("hidden");
          doc.body.classList.add("tl-native-analysis-running");
        }else{
          doc.body.classList.remove("tl-native-analysis-running");
        }
      }

      function nativeStarted(){
        try{
          if(loading.classList.contains("active"))return true;
          if(win.AN&&(win.AN.busy||win.AN.verifying))return true;
        }catch(_error){}
        return false;
      }

      function fallbackAfterNativeClick(){
        syncButton();
        win.setTimeout(function(){
          try{
            if(nativeStarted())return;
            if(typeof win.weiterZurAnalyse==="function")win.weiterZurAnalyse(null);
          }catch(_error){}
        },700);
      }

      /* Remove only the extra property handler from older repair versions.
         The app's original addEventListener-based handler remains intact. */
      if(button.getAttribute("data-tl-native-flow-bound")==="1"){
        button.onclick=null;
        button.removeAttribute("data-tl-native-flow-bound");
      }

      if(button.getAttribute("data-tl-fallback-bound")!=="1"){
        button.setAttribute("data-tl-fallback-bound","1");
        button.addEventListener("click",fallbackAfterNativeClick,false);
      }

      try{
        if(typeof win.wireAnalysisButton==="function"&&button.getAttribute("data-tl-wire-requested")!=="1"){
          button.setAttribute("data-tl-wire-requested","1");
          win.wireAnalysisButton();
        }
      }catch(_error){}

      syncButton();
      syncLoadingState();

      try{
        if(win.__tlNativeLoadingObserver)win.__tlNativeLoadingObserver.disconnect();
        var observer=new win.MutationObserver(syncLoadingState);
        observer.observe(loading,{attributes:true,attributeFilter:["class","hidden"]});
        win.__tlNativeLoadingObserver=observer;
      }catch(_error){}

      if(!win.__tlNativeButtonTimer)win.__tlNativeButtonTimer=win.setInterval(syncButton,700);
      return true;
    }catch(_error){return false;}
  }

  function boot(){
    var tries=0;
    var timer=setInterval(function(){
      tries++;
      if(install()||tries>=80)clearInterval(timer);
    },250);
  }

  if(frame){
    frame.addEventListener("load",function(){setTimeout(boot,100);});
    setTimeout(boot,350);
  }
})();
