(function(){
  "use strict";
  var version="20260620e";
  var frame=document.getElementById("app");

  function addScript(src,id,onload){
    if(document.getElementById(id)){if(onload)onload();return;}
    var script=document.createElement("script");
    script.id=id;
    script.src=src;
    if(onload)script.onload=onload;
    document.head.appendChild(script);
  }

  function resizeSentimentScore(){
    try{
      var doc=frame&&(frame.contentDocument||frame.contentWindow.document);
      if(!doc||!doc.head){setTimeout(resizeSentimentScore,300);return;}
      var style=doc.getElementById("tl-score-size-fix");
      if(!style){
        style=doc.createElement("style");
        style.id="tl-score-size-fix";
        doc.head.appendChild(style);
      }
      style.textContent=".tl-live-sentiment-score{font-size:34px!important;line-height:.88!important;letter-spacing:-.3px!important;margin-right:6px!important;display:inline-block!important;transform:scale(.74)!important;transform-origin:center center!important}";
      var score=doc.querySelector(".tl-live-sentiment-score");
      if(score){
        score.style.setProperty("font-size","34px","important");
        score.style.setProperty("line-height",".88","important");
        score.style.setProperty("letter-spacing","-.3px","important");
        score.style.setProperty("margin-right","6px","important");
        score.style.setProperty("display","inline-block","important");
        score.style.setProperty("transform","scale(.74)","important");
        score.style.setProperty("transform-origin","center center","important");
      }else{
        setTimeout(resizeSentimentScore,350);
      }
    }catch(error){
      setTimeout(resizeSentimentScore,350);
    }
  }

  addScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js","tl-supabase-umd",function(){
    addScript("tradelens-live-daily-v1.js?v="+version,"tl-live-daily");
  });
  addScript("tradelens-wrapper-loader-v6.js?v="+version,"tl-wrapper-loader");

  if(frame){
    frame.addEventListener("load",function(){setTimeout(resizeSentimentScore,500);});
    setTimeout(resizeSentimentScore,900);
    setInterval(resizeSentimentScore,1500);
  }
})();
