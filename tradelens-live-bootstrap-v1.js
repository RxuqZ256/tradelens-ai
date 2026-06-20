(function(){
  "use strict";
  var version="20260620g";
  var frame=document.getElementById("app");

  function addScript(src,id,onload){
    if(document.getElementById(id)){if(onload)onload();return;}
    var script=document.createElement("script");
    script.id=id;
    script.src=src;
    if(onload)script.onload=onload;
    document.head.appendChild(script);
  }

  function alignSentimentScore(){
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

      var row=total.parentElement;
      if(row){
        row.style.setProperty("display","flex","important");
        row.style.setProperty("align-items","baseline","important");
        row.style.setProperty("justify-content","center","important");
        row.style.setProperty("gap","10px","important");
        row.style.setProperty("width","100%","important");
        row.style.setProperty("transform","translateX(-3px)","important");
      }

      score.style.setProperty("font-size","34px","important");
      score.style.setProperty("line-height","0.88","important");
      score.style.setProperty("display","inline-block","important");
      score.style.setProperty("transform","none","important");
      score.style.setProperty("margin","0","important");

      total.style.setProperty("font-size","12px","important");
      total.style.setProperty("line-height","1","important");
      total.style.setProperty("margin","0 0 2px 0","important");
    }catch(error){}
  }

  addScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js","tl-supabase-umd",function(){
    addScript("tradelens-live-daily-v1.js?v="+version,"tl-live-daily");
  });
  addScript("tradelens-wrapper-loader-v6.js?v="+version,"tl-wrapper-loader");

  if(frame){
    frame.addEventListener("load",function(){setTimeout(alignSentimentScore,500);});
    setTimeout(alignSentimentScore,900);
    setInterval(alignSentimentScore,1500);
  }
})();
