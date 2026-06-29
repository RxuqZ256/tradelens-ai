(function(){
  "use strict";
  var frame=document.getElementById("app");

  function install(){
    try{
      var win=frame&&frame.contentWindow;
      var doc=frame&&(frame.contentDocument||(win&&win.document));
      if(!win||!doc||!doc.body)return false;

      var loading=doc.getElementById("page-analysis-loading");
      var result=doc.getElementById("page-ergebnis");
      if(!loading||!result)return false;

      if(!doc.getElementById("tl-result-guard-style")){
        var style=doc.createElement("style");
        style.id="tl-result-guard-style";
        style.textContent=[
          "#page-ergebnis.tl-result-guard-active{",
          "display:block!important;visibility:visible!important;opacity:1!important;",
          "transform:none!important;pointer-events:auto!important;z-index:50!important;",
          "position:absolute!important;inset:0!important;overflow-y:auto!important;overflow-x:hidden!important;",
          "}",
          "body.tl-result-guard-open .bottomnav{display:flex!important}",
          "body.tl-result-guard-open .home-ind{display:block!important}"
        ].join("");
        doc.head.appendChild(style);
      }

      function progress(){
        var pct=doc.getElementById("al-pct");
        if(!pct)return 0;
        var n=parseInt(String(pct.textContent||"0").replace(/[^0-9]/g,""),10);
        return isFinite(n)?n:0;
      }

      function allStepsDone(){
        var steps=doc.querySelectorAll("#al-status .al-st");
        if(!steps.length)return false;
        for(var i=0;i<steps.length;i++){
          if(!steps[i].classList.contains("done"))return false;
        }
        return true;
      }

      function resultIsOpen(){
        return result.classList.contains("active")||result.classList.contains("tl-result-guard-active");
      }

      function cleanupResultStyles(){
        result.classList.remove("tl-result-guard-active");
        doc.body.classList.remove("tl-result-guard-open");
      }

      function hardOpenResult(){
        var pages=doc.querySelectorAll(".page.active");
        for(var i=0;i<pages.length;i++){
          if(pages[i]!==result)pages[i].classList.remove("active");
        }
        loading.classList.remove("active");
        loading.hidden=true;
        result.hidden=false;
        result.removeAttribute("hidden");
        result.classList.add("active","tl-result-guard-active");
        result.scrollTop=0;
        doc.body.classList.remove("tl-native-analysis-running","analysis-loading-active");
        doc.body.classList.add("tl-result-guard-open");
        try{
          if(win.location&&win.location.hash!=="#page-ergebnis"){
            win.history.replaceState(null,"","#page-ergebnis");
          }
        }catch(_error){}
      }

      function requestNativeResult(){
        if(resultIsOpen())return true;
        try{
          if(typeof win.navPage==="function"){
            win.navPage("ergebnis");
            if(resultIsOpen())return true;
          }
        }catch(_error){}
        try{
          if(typeof win.go==="function"){
            win.go("ergebnis");
            if(resultIsOpen())return true;
          }
        }catch(_error){}
        return resultIsOpen();
      }

      var completedAt=0;
      var forced=false;
      function check(){
        if(resultIsOpen()){
          loading.classList.remove("active");
          doc.body.classList.remove("tl-native-analysis-running","analysis-loading-active");
          return;
        }

        if(!loading.classList.contains("active")){
          completedAt=0;
          forced=false;
          cleanupResultStyles();
          return;
        }

        var complete=progress()>=100||allStepsDone();
        if(!complete){
          completedAt=0;
          forced=false;
          return;
        }

        if(!completedAt)completedAt=Date.now();
        var elapsed=Date.now()-completedAt;

        if(elapsed>=900&&!forced){
          forced=true;
          requestNativeResult();
        }

        if(elapsed>=1700&&!resultIsOpen()){
          hardOpenResult();
        }
      }

      if(win.__tlResultGuardTimer)win.clearInterval(win.__tlResultGuardTimer);
      win.__tlResultGuardTimer=win.setInterval(check,200);

      try{
        if(win.__tlResultGuardObserver)win.__tlResultGuardObserver.disconnect();
        var observer=new win.MutationObserver(check);
        observer.observe(loading,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["class","hidden"]});
        observer.observe(result,{attributes:true,attributeFilter:["class","hidden"]});
        win.__tlResultGuardObserver=observer;
      }catch(_error){}

      check();
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
    frame.addEventListener("load",function(){setTimeout(boot,150);});
    setTimeout(boot,500);
  }
})();
