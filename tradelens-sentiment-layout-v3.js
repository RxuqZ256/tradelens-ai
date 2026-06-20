(function(){
  "use strict";
  var frame=document.getElementById("app");

  function norm(v){return String(v||"").toUpperCase().replace(/\s+/g," ").trim();}
  function leaves(root){var n=root.querySelectorAll("*"),a=[];for(var i=0;i<n.length;i++)if(n[i].children.length===0&&norm(n[i].textContent))a.push(n[i]);return a;}

  function apply(){
    try{
      var doc=frame&&(frame.contentDocument||frame.contentWindow.document);
      if(!doc||!doc.body)return;

      var title=null,all=leaves(doc);
      for(var i=0;i<all.length;i++)if(norm(all[i].textContent)==="MARKT SENTIMENT"){title=all[i];break;}
      if(!title)return;

      var card=title.parentElement;
      while(card&&card!==doc.body){var t=norm(card.textContent),r=card.getBoundingClientRect();if(t.indexOf("MARKT SENTIMENT")>=0&&t.indexOf("TOP MOVERS")<0&&r.width>180&&r.height>180)break;card=card.parentElement;}
      if(!card)return;

      var old=card.querySelector(".tl-center-v2");if(old)old.remove();
      var score=card.querySelector(".tl-live-sentiment-score");
      var label=card.querySelector(".tl-live-sentiment-label");
      var svg=card.querySelector(".tl-live-sentiment-svg");
      if(!score||!label||!svg)return;

      var total=null,inside=leaves(card);
      for(var j=0;j<inside.length;j++)if(norm(inside[j].textContent)==="/100"&&!inside[j].closest(".tl-sentiment-overlay-v3")){total=inside[j];break;}
      if(!total)return;

      score.style.setProperty("visibility","hidden","important");
      total.style.setProperty("visibility","hidden","important");
      label.style.setProperty("visibility","hidden","important");

      var overlay=card.querySelector(".tl-sentiment-overlay-v3");
      if(!overlay){
        overlay=doc.createElement("div");
        overlay.className="tl-sentiment-overlay-v3";
        overlay.innerHTML='<div class="tl-v3-row"><span class="tl-v3-score"></span><span class="tl-v3-total">/100</span></div><div class="tl-v3-label"></div>';
        card.appendChild(overlay);
      }

      overlay.querySelector(".tl-v3-score").textContent=String(score.textContent||"").trim();
      overlay.querySelector(".tl-v3-label").textContent=String(label.textContent||"").trim();
      overlay.querySelector(".tl-v3-label").style.color=getComputedStyle(label).color;

      card.style.setProperty("position","relative","important");
      var cr=card.getBoundingClientRect(),sr=svg.getBoundingClientRect();
      var cx=sr.left-cr.left+sr.width/2;
      var cy=sr.top-cr.top+sr.height/2;

      overlay.style.cssText="position:absolute;left:"+cx+"px;top:"+cy+"px;transform:translate(-53%,-43%);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:20;pointer-events:none;";
      overlay.querySelector(".tl-v3-row").style.cssText="display:flex;align-items:baseline;justify-content:center;gap:9px;white-space:nowrap;transform:translateX(-4px);";
      overlay.querySelector(".tl-v3-score").style.cssText="font-size:34px;line-height:.88;font-weight:500;color:#fff;letter-spacing:-.2px;";
      overlay.querySelector(".tl-v3-total").style.cssText="font-size:12px;line-height:1;color:#6f7890;margin-bottom:2px;";
      overlay.querySelector(".tl-v3-label").style.cssText+=";font-size:10px;line-height:1;font-weight:800;letter-spacing:.7px;margin-top:7px;text-align:center;";
    }catch(e){}
  }

  function start(){apply();setInterval(apply,700);}
  if(frame){frame.addEventListener("load",function(){setTimeout(start,700);});setTimeout(start,1100);}
})();