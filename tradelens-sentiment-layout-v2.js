(function(){
  "use strict";
  var frame=document.getElementById("app");
  function norm(v){return String(v||"").toUpperCase().replace(/\s+/g," ").trim();}
  function leaves(root){var n=root.querySelectorAll("*"),a=[];for(var i=0;i<n.length;i++)if(n[i].children.length===0&&norm(n[i].textContent))a.push(n[i]);return a;}
  function apply(){
    try{
      var doc=frame&&(frame.contentDocument||frame.contentWindow.document);if(!doc||!doc.body)return;
      var all=leaves(doc),total=null,label=null,score=null;
      for(var i=0;i<all.length;i++){
        var t=norm(all[i].textContent);
        if(t==="/100")total=all[i];
        if(t==="NEUTRAL"||t==="BÄRISCH"||t==="BULLISCH")label=all[i];
      }
      if(!total||!label)return;
      var card=label.parentElement;
      while(card&&card!==doc.body){var tx=norm(card.textContent),r=card.getBoundingClientRect();if(tx.indexOf("MARKT SENTIMENT")>=0&&tx.indexOf("TOP MOVERS")<0&&r.width>180&&r.height>180)break;card=card.parentElement;}
      if(!card)return;
      var cand=leaves(card),best=-1;
      for(var j=0;j<cand.length;j++){
        var v=String(cand[j].textContent||"").trim();if(!/^\d{1,3}$/.test(v))continue;
        var s=parseFloat(getComputedStyle(cand[j]).fontSize)||0;if(s>best){best=s;score=cand[j];}
      }
      if(!score)return;
      var svg=card.querySelector(".tl-live-sentiment-svg"),anchor=svg&&svg.parentElement;
      if(!anchor)return;
      anchor.style.setProperty("position","relative","important");
      var box=anchor.querySelector(".tl-center-v2");
      if(!box){box=doc.createElement("div");box.className="tl-center-v2";box.innerHTML='<div class="tl-center-v2-row"><span class="tl-center-v2-score"></span><span class="tl-center-v2-total">/100</span></div><div class="tl-center-v2-label"></div>';anchor.appendChild(box);}
      var outScore=box.querySelector(".tl-center-v2-score"),outTotal=box.querySelector(".tl-center-v2-total"),outLabel=box.querySelector(".tl-center-v2-label");
      outScore.textContent=String(score.textContent||"").trim();outLabel.textContent=String(label.textContent||"").trim();outLabel.style.color=getComputedStyle(label).color;
      score.style.setProperty("visibility","hidden","important");total.style.setProperty("visibility","hidden","important");label.style.setProperty("visibility","hidden","important");
      box.style.cssText="position:absolute;left:50%;top:52%;transform:translate(-54%,-50%);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:8;pointer-events:none;";
      box.querySelector(".tl-center-v2-row").style.cssText="display:flex;align-items:baseline;justify-content:center;gap:10px;white-space:nowrap;transform:translateX(-3px);";
      outScore.style.cssText="font-size:34px;line-height:.88;font-weight:500;color:#fff;letter-spacing:-.3px;";
      outTotal.style.cssText="font-size:12px;line-height:1;color:#6f7890;margin-bottom:2px;";
      outLabel.style.cssText+=";font-size:10px;line-height:1;font-weight:800;letter-spacing:.7px;margin-top:7px;text-align:center;";
    }catch(e){}
  }
  function start(){apply();setInterval(apply,700);}
  if(frame){frame.addEventListener("load",function(){setTimeout(start,600);});setTimeout(start,1000);}
})();