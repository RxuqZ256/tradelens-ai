(function(){
  "use strict";

  var version="20260621a";
  var frame=document.getElementById("app");
  var resizeBound=false;

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

  function textLeaves(root){
    var nodes=root.querySelectorAll("*");
    var leaves=[];
    for(var i=0;i<nodes.length;i++){
      if(nodes[i].children.length===0&&normalize(nodes[i].textContent))leaves.push(nodes[i]);
    }
    return leaves;
  }

  function findSentimentCard(doc){
    var leaves=textLeaves(doc);
    var title=null;
    for(var i=0;i<leaves.length;i++){
      if(normalize(leaves[i].textContent)==="MARKT SENTIMENT"){
        title=leaves[i];
        break;
      }
    }
    if(!title)return null;

    var node=title.parentElement;
    while(node&&node!==doc.body){
      var text=normalize(node.textContent);
      var rect=node.getBoundingClientRect();
      if(text.indexOf("MARKT SENTIMENT")>=0&&text.indexOf("TOP MOVERS")<0&&rect.width>180&&rect.height>180)return node;
      node=node.parentElement;
    }
    return null;
  }

  function findTotal(card){
    var leaves=textLeaves(card);
    for(var i=0;i<leaves.length;i++){
      if(normalize(leaves[i].textContent)==="/100")return leaves[i];
    }
    return null;
  }

  function clearLegacyOverlays(doc){
    var legacy=doc.querySelectorAll(".tl-center-v2,.tl-sentiment-overlay-v3");
    for(var i=0;i<legacy.length;i++)legacy[i].remove();
  }

  function setImportant(node,name,value){
    node.style.setProperty(name,value,"important");
  }

  function layoutSentiment(){
    try{
      var doc=frame&&(frame.contentDocument||frame.contentWindow.document);
      if(!doc||!doc.body)return false;

      clearLegacyOverlays(doc);

      var card=findSentimentCard(doc);
      if(!card)return false;

      var score=card.querySelector(".tl-live-sentiment-score");
      var label=card.querySelector(".tl-live-sentiment-label");
      var svg=card.querySelector(".tl-live-sentiment-svg");
      var total=findTotal(card);
      if(!score||!label||!svg||!total)return false;

      var anchor=score.closest(".tl-live-sentiment-gauge-anchor")||
        total.closest(".tl-live-sentiment-gauge-anchor")||
        svg.parentElement;
      if(!anchor)return false;

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

      setImportant(score,"visibility","visible");
      setImportant(total,"visibility","visible");
      setImportant(label,"visibility","visible");

      setImportant(anchor,"position","relative");
      setImportant(anchor,"isolation","isolate");

      setImportant(stack,"position","absolute");
      setImportant(stack,"inset","0");
      setImportant(stack,"width","100%");
      setImportant(stack,"height","100%");
      setImportant(stack,"box-sizing","border-box");
      setImportant(stack,"padding-top","4px");
      setImportant(stack,"display","flex");
      setImportant(stack,"flex-direction","column");
      setImportant(stack,"align-items","center");
      setImportant(stack,"justify-content","center");
      setImportant(stack,"z-index","8");
      setImportant(stack,"pointer-events","none");
      setImportant(stack,"transform","none");
      setImportant(stack,"will-change","auto");

      setImportant(row,"display","flex");
      setImportant(row,"align-items","baseline");
      setImportant(row,"justify-content","center");
      setImportant(row,"gap","9px");
      setImportant(row,"white-space","nowrap");
      setImportant(row,"margin-left","-7px");
      setImportant(row,"transform","none");

      setImportant(score,"position","static");
      setImportant(score,"display","inline-block");
      setImportant(score,"font-size","34px");
      setImportant(score,"line-height","0.88");
      setImportant(score,"font-weight","500");
      setImportant(score,"letter-spacing","-0.2px");
      setImportant(score,"margin","0");
      setImportant(score,"transform","none");

      setImportant(total,"position","static");
      setImportant(total,"display","inline-block");
      setImportant(total,"font-size","12px");
      setImportant(total,"line-height","1");
      setImportant(total,"color","#6f7890");
      setImportant(total,"margin","0 0 2px 0");
      setImportant(total,"transform","none");

      setImportant(label,"position","static");
      setImportant(label,"display","block");
      setImportant(label,"font-size","10px");
      setImportant(label,"line-height","1");
      setImportant(label,"font-weight","800");
      setImportant(label,"letter-spacing","0.7px");
      setImportant(label,"margin","7px 0 0 0");
      setImportant(label,"text-align","center");
      setImportant(label,"transform","none");

      if(!resizeBound&&frame.contentWindow){
        resizeBound=true;
        frame.contentWindow.addEventListener("resize",function(){setTimeout(layoutSentiment,50);});
      }

      return true;
    }catch(error){
      return false;
    }
  }

  function startLayout(){
    var attempts=0;
    function retry(){
      attempts++;
      if(layoutSentiment()||attempts>=20)return;
      setTimeout(retry,400);
    }
    retry();
  }

  addScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js","tl-supabase-umd",function(){
    addScript("tradelens-live-daily-v1.js?v="+version,"tl-live-daily");
  });
  addScript("tradelens-wrapper-loader-v6.js?v="+version,"tl-wrapper-loader",function(){
    setTimeout(startLayout,150);
  });

  if(frame){
    frame.addEventListener("load",function(){setTimeout(startLayout,350);});
    setTimeout(startLayout,900);
  }
})();
