(function(){
  "use strict";
  var version="20260620h";
  var frame=document.getElementById("app");

  function addScript(src,id,onload){
    if(document.getElementById(id)){if(onload)onload();return;}
    var script=document.createElement("script");
    script.id=id;
    script.src=src;
    if(onload)script.onload=onload;
    document.head.appendChild(script);
  }

  function normalize(value){
    return String(value||"").toUpperCase().replace(/\s+/g," ").trim();
  }

  function findCard(total,doc){
    var node=total.parentElement;
    while(node&&node!==doc.body){
      var text=normalize(node.textContent);
      var rect=node.getBoundingClientRect();
      if(text.indexOf("MARKT SENTIMENT")>=0&&text.indexOf("TOP MOVERS")<0&&rect.width>180&&rect.height>180)return node;
      node=node.parentElement;
    }
    return null;
  }

  function layoutSentiment(){
    try{
      var doc=frame&&(frame.contentDocument||frame.contentWindow.document);
      if(!doc||!doc.body)return;

      var total=null;
      var nodes=doc.querySelectorAll("*");
      for(var i=0;i<nodes.length;i++){
        if(nodes[i].children.length===0&&String(nodes[i].textContent||"").trim()==="/100"){
          total=nodes[i];
          break;
        }
      }
      if(!total)return;

      var card=findCard(total,doc);
      if(!card)return;

      var score=card.querySelector(".tl-live-sentiment-score");
      var label=card.querySelector(".tl-live-sentiment-label");
      if(!score||!label)return;

      var anchor=score.closest(".tl-live-sentiment-gauge-anchor")||total.closest(".tl-live-sentiment-gauge-anchor");
      if(!anchor)return;

      var stack=anchor.querySelector(".tl-sentiment-center-stack");
      if(!stack){
        stack=doc.createElement("div");
        stack.className="tl-sentiment-center-stack";
        anchor.appendChild(stack);
      }

      var row=stack.querySelector(".tl-sentiment-value-row");
      if(!row){
        row=doc.createElement("div");
        row.className="tl-sentiment-value-row";
        stack.appendChild(row);
      }

      if(score.parentElement!==row)row.appendChild(score);
      if(total.parentElement!==row)row.appendChild(total);
      if(label.parentElement!==stack)stack.appendChild(label);

      anchor.style.setProperty("position","relative","important");

      stack.style.setProperty("position","absolute","important");
      stack.style.setProperty("left","50%","important");
      stack.style.setProperty("top","52%","important");
      stack.style.setProperty("transform","translate(-55%,-50%)","important");
      stack.style.setProperty("display","flex","important");
      stack.style.setProperty("flex-direction","column","important");
      stack.style.setProperty("align-items","center","important");
      stack.style.setProperty("justify-content","center","important");
      stack.style.setProperty("z-index","6","important");
      stack.style.setProperty("pointer-events","none","important");

      row.style.setProperty("display","flex","important");
      row.style.setProperty("align-items","baseline","important");
      row.style.setProperty("justify-content","center","important");
      row.style.setProperty("gap","10px","important");
      row.style.setProperty("white-space","nowrap","important");

      score.style.setProperty("font-size","34px","important");
      score.style.setProperty("line-height","0.88","important");
      score.style.setProperty("display","inline-block","important");
      score.style.setProperty("transform","none","important");
      score.style.setProperty("margin","0","important");

      total.style.setProperty("font-size","12px","important");
      total.style.setProperty("line-height","1","important");
      total.style.setProperty("margin","0 0 2px 0","important");

      label.style.setProperty("position","static","important");
      label.style.setProperty("transform","none","important");
      label.style.setProperty("margin","7px 0 0 0","important");
      label.style.setProperty("font-size","10px","important");
      label.style.setProperty("line-height","1","important");
      label.style.setProperty("text-align","center","important");
    }catch(error){}
  }

  addScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js","tl-supabase-umd",function(){
    addScript("tradelens-live-daily-v1.js?v="+version,"tl-live-daily");
  });
  addScript("tradelens-wrapper-loader-v6.js?v="+version,"tl-wrapper-loader");

  if(frame){
    frame.addEventListener("load",function(){setTimeout(layoutSentiment,700);});
    setTimeout(layoutSentiment,1100);
    setInterval(layoutSentiment,1500);
  }
})();
