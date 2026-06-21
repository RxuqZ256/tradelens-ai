(function(){
  "use strict";
  var frame=document.getElementById("app");

  function apply(){
    try{
      var doc=frame&&(frame.contentDocument||frame.contentWindow.document);
      if(!doc)return false;
      var row=doc.querySelector(".tl-sentiment-value-row");
      var label=doc.querySelector(".tl-sentiment-center-stack .tl-live-sentiment-label");
      if(!row||!label)return false;
      row.style.setProperty("gap","6px","important");
      row.style.setProperty("margin-left","-4px","important");
      label.style.setProperty("margin","10px 0 0 0","important");
      return true;
    }catch(error){return false;}
  }

  function start(){
    var tries=0;
    var timer=setInterval(function(){
      tries++;
      if(apply()||tries>=25)clearInterval(timer);
    },300);
  }

  if(frame){
    frame.addEventListener("load",function(){setTimeout(start,500);});
    setTimeout(start,1000);
  }
})();
