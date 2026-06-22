(function(){
  "use strict";
  var frame=document.getElementById("app");

  function apply(){
    try{
      var win=frame&&frame.contentWindow;
      var doc=frame&&(frame.contentDocument||(win&&win.document));
      if(!win||!doc||!doc.head)return false;

      if(!doc.getElementById("tl-analysis-loader-size-v1")){
        var style=doc.createElement("style");
        style.id="tl-analysis-loader-size-v1";
        style.textContent=[
          "#page-analysis-loading{",
          "height:100%!important;min-height:100%!important;max-height:none!important;",
          "width:100%!important;box-sizing:border-box!important;",
          "top:0!important;right:0!important;bottom:0!important;left:0!important;",
          "padding:4px 18px 150px!important;overflow-y:auto!important;overflow-x:hidden!important;",
          "}",
          "#page-analysis-loading #al-main{",
          "display:block!important;min-height:780px!important;height:auto!important;",
          "overflow:visible!important;padding-bottom:42px!important;",
          "}",
          "#page-analysis-loading .al-orb-wrap{",
          "min-height:360px!important;height:auto!important;",
          "margin:16px 0 26px!important;overflow:visible!important;",
          "}",
          "#page-analysis-loading .al-orb{width:240px!important;height:240px!important;}",
          "#page-analysis-loading .al-status{margin-top:18px!important;}",
          "#page-analysis-loading .al-info{margin-top:18px!important;}",
          "#page-analysis-loading .al-foot{margin-top:18px!important;margin-bottom:30px!important;}",
          "#page-analysis-loading .appbar,#page-analysis-loading .steps,#page-analysis-loading #al-main{",
          "position:relative!important;z-index:2!important;overflow:visible!important;",
          "}",
          "#page-analysis-loading[data-tl-force-visible='1']{",
          "height:100%!important;min-height:100%!important;max-height:none!important;",
          "}",
          "@media(max-width:469px){",
          "#page-analysis-loading{padding-left:14px!important;padding-right:14px!important;padding-bottom:140px!important;}",
          "#page-analysis-loading #al-main{min-height:760px!important;}",
          "#page-analysis-loading .al-orb-wrap{min-height:340px!important;}",
          "#page-analysis-loading .al-orb{width:226px!important;height:226px!important;}",
          "}"
        ].join("");
        doc.head.appendChild(style);
      }

      var page=doc.getElementById("page-analysis-loading");
      if(page){
        page.style.setProperty("height","100%","important");
        page.style.setProperty("min-height","100%","important");
        page.style.setProperty("max-height","none","important");
        page.style.setProperty("overflow-y","auto","important");
      }
      return true;
    }catch(_error){return false;}
  }

  function boot(){
    var tries=0;
    var timer=setInterval(function(){
      tries++;
      if(apply()||tries>=60)clearInterval(timer);
    },250);
  }

  if(frame){
    frame.addEventListener("load",function(){setTimeout(boot,150);});
    setTimeout(boot,500);
  }
})();
