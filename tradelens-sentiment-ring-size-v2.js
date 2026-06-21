(function(){
  "use strict";
  var frame=document.getElementById("app");

  function apply(){
    try{
      var doc=frame&&(frame.contentDocument||frame.contentWindow.document);
      if(!doc)return false;
      var anchor=doc.querySelector(".tl-live-sentiment-gauge-anchor");
      if(!anchor)return false;
      var visuals=anchor.querySelectorAll("svg");
      if(!visuals.length)return false;
      for(var i=0;i<visuals.length;i++){
        visuals[i].style.setProperty("transform","scale(1.10)","important");
        visuals[i].style.setProperty("transform-origin","50% 50%","important");
        visuals[i].style.setProperty("overflow","visible","important");
      }
      return true;
    }catch(error){return false;}
  }

  function start(){
    var attempts=0;
    var timer=setInterval(function(){
      attempts++;
      apply();
      if(attempts>=30)clearInterval(timer);
    },300);
  }

  if(frame){
    frame.addEventListener("load",function(){setTimeout(start,450);});
    setTimeout(start,900);
  }
})();
