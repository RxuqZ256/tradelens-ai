(function(){
  "use strict";
  var frame=document.getElementById("app");

  function apply(){
    try{
      var doc=frame&&(frame.contentDocument||frame.contentWindow.document);
      if(!doc||!doc.head)return false;
      if(!doc.getElementById("tl-final-tune-v12")){
        var link=doc.createElement("link");
        link.id="tl-final-tune-v12";
        link.rel="stylesheet";
        link.href="tradelens-final-tune-v12.css?v=20260621af";
        doc.head.appendChild(link);
      }
      return true;
    }catch(_error){return false;}
  }

  function start(){
    var tries=0;
    var timer=setInterval(function(){
      tries++;
      if(apply()||tries>=30)clearInterval(timer);
    },250);
  }

  if(frame){
    frame.addEventListener("load",function(){setTimeout(start,250);});
    setTimeout(start,700);
  }
})();
