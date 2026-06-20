(function(){
  "use strict";
  var version="20260620f";
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
      if(!doc||!doc.body)return;
      var nodes=doc.querySelectorAll("*");
      var total=null;
      for(var i=0;i<nodes.length;i++){
        if(nodes[i].children.length===0&&String(nodes[i].textContent||"").trim()==="/100"){
          total=nodes[i];
          break;
        }
      }
      if(!total)return;
      var score=total.previousElementSibling;
      if(!score&&total.parentElement)score=total.parentElement.firstElementChild;
      if(!score)return;
      score.style.setProperty("font-size","32px","important");
      score.style.setProperty("line-height","0.88","important");
      score.style.setProperty("display","inline-block","important");
      score.style.setProperty("transform","scale(0.78)","important");
      score.style.setProperty("transform-origin","center center","important");
      total.style.setProperty("font-size","12px","important");
      total.style.setProperty("margin-left","5px","important");
    }catch(error){}
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
