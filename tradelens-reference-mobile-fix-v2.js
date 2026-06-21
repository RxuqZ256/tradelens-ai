(function(){
  "use strict";
  var frame=document.getElementById("app");

  function apply(){
    try{
      var doc=frame&&(frame.contentDocument||frame.contentWindow.document);
      if(!doc||!doc.head)return false;
      if(!doc.getElementById("tl-reference-mobile-fix-v2")){
        var link=doc.createElement("link");
        link.id="tl-reference-mobile-fix-v2";
        link.rel="stylesheet";
        link.href="tradelens-reference-mobile-fix-v2.css?v=20260621v";
        doc.head.appendChild(link);
      }
      return true;
    }catch(_error){return false;}
  }

  function start(){
    var attempts=0;
    var timer=setInterval(function(){
      attempts++;
      if(apply()||attempts>=30)clearInterval(timer);
    },250);
  }

  if(frame){
    frame.addEventListener("load",function(){setTimeout(start,250);});
    setTimeout(start,700);
  }
})();
