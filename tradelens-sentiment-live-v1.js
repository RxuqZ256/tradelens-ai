(function(){
  "use strict";

  var timer=null;

  function norm(value){
    var text=String(value||"").toUpperCase();
    try{text=text.normalize("NFD").replace(/[\u0300-\u036f]/g,"");}catch(e){}
    return text.replace(/[–—]/g,"-").replace(/\s+/g," ").trim();
  }

  function parseNumber(value){
    var text=String(value||"").replace(/%/g,"").replace(/\s/g,"").replace(/[^0-9,+\-.]/g,"");
    if(!text||text==="-"||text==="—")return null;
    if(text.indexOf(",")>=0)text=text.replace(/\./g,"").replace(",",".");
    var number=Number(text);
    return Number.isFinite(number)?number:null;
  }

  function leaves(root){
    var nodes=(root||document).querySelectorAll("*");
    var out=[];
    for(var i=0;i<nodes.length;i++){
      if(nodes[i].children.length===0&&norm(nodes[i].textContent))out.push(nodes[i]);
    }
    return out;
  }

  function findLeaf(root,text){
    var wanted=norm(text),items=leaves(root);
    for(var i=0;i<items.length;i++)if(norm(items[i].textContent)===wanted)return items[i];
    return null;
  }

  function findSentimentCard(){
    var title=findLeaf(document,"MARKT SENTIMENT");
    if(!title)return null;
    var direct=title.closest&&title.closest(".gf,.card");
    if(direct)return direct;
    var node=title.parentElement;
    while(node&&node!==document.body){
      var text=norm(node.textContent);
      var rect=node.getBoundingClientRect();
      if(text.indexOf("MARKT SENTIMENT")>=0&&text.indexOf("TOP MOVERS")<0&&rect.width>140&&rect.height>150)return node;
      node=node.parentElement;
    }
    return title.parentElement;
  }

  function readGoldChange(){
    var symbol=findLeaf(document,"XAUUSD");
    if(!symbol)return null;
    var node=symbol.parentElement;
    while(node&&node!==document.body){
      var text=norm(node.textContent);
      if(text.indexOf("XAUUSD")>=0&&text.indexOf("NAS100")<0){
        var items=leaves(node);
        for(var i=0;i<items.length;i++){
          if(String(items[i].textContent).indexOf("%")<0)continue;
          var parsed=parseNumber(items[i].textContent);
          if(parsed!==null)return parsed;
        }
      }
      node=node.parentElement;
    }
    return null;
  }

  function sentiment(change){
    var score=Math.max(0,Math.min(100,Math.round(50+(change*19))));
    if(score<=30)return{score:score,label:"BÄRISCH",caption:"Stark bärisches Umfeld",color:"#ff5f75"};
    if(score<45)return{score:score,label:"BÄRISCH",caption:"Bärisches Umfeld",color:"#ff6b7d"};
    if(score<=55)return{score:score,label:"NEUTRAL",caption:"Ausgeglichenes Umfeld",color:"#22d3ee"};
    if(score<70)return{score:score,label:"BULLISCH",caption:"Bullisches Umfeld",color:"#4adea4"};
    return{score:score,label:"BULLISCH",caption:"Stark bullisches Umfeld",color:"#4adea4"};
  }

  function ensureStyle(){
    if(document.getElementById("tl-live-sentiment-style"))return;
    var style=document.createElement("style");
    style.id="tl-live-sentiment-style";
    style.textContent=[
      ".tl-live-sentiment-card{position:relative!important;overflow:hidden!important}",
      ".tl-live-sentiment-label{font-weight:800!important;letter-spacing:.6px!important}",
      ".tl-live-sentiment-score{position:relative!important;z-index:3!important;color:#fff!important;text-shadow:0 0 12px rgba(255,255,255,.16)!important}",
      ".tl-live-sentiment-caption{position:relative!important;z-index:3!important}",
      ".tl-live-sentiment-gauge-anchor{position:relative!important;overflow:visible!important}",
      ".tl-live-sentiment-arc{position:absolute;left:50%;top:50%;z-index:1;pointer-events:none;border-radius:50%;transform:translate(-50%,-50%);filter:drop-shadow(0 0 7px currentColor);mix-blend-mode:screen;-webkit-mask:radial-gradient(circle,transparent 0 72%,#000 73% 84%,transparent 85% 100%);mask:radial-gradient(circle,transparent 0 72%,#000 73% 84%,transparent 85% 100%)}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function findGaugeAnchor(card,score,maxLabel){
    var start=(maxLabel&&maxLabel.parentElement)||(score&&score.parentElement);
    var node=start;
    while(node&&node!==card){
      var rect=node.getBoundingClientRect();
      var ratio=rect.height?rect.width/rect.height:0;
      if(rect.width>=125&&rect.height>=125&&rect.width<=280&&rect.height<=280&&ratio>=.72&&ratio<=1.28)return node;
      node=node.parentElement;
    }

    var scoreRect=score?score.getBoundingClientRect():null;
    if(!scoreRect)return card;
    var centerX=scoreRect.left+scoreRect.width/2;
    var centerY=scoreRect.top+scoreRect.height/2;
    var candidates=card.querySelectorAll("div,section,article,svg");
    var best=null,bestMetric=Infinity;
    for(var i=0;i<candidates.length;i++){
      var current=candidates[i];
      if(current.classList&&current.classList.contains("tl-live-sentiment-arc"))continue;
      var r=current.getBoundingClientRect();
      var currentRatio=r.height?r.width/r.height:0;
      if(r.width<125||r.height<125||r.width>280||r.height>280||currentRatio<.72||currentRatio>1.28)continue;
      var dx=(r.left+r.width/2)-centerX;
      var dy=(r.top+r.height/2)-centerY;
      var metric=Math.sqrt(dx*dx+dy*dy)+Math.abs(r.width-r.height)*.35;
      if(metric<bestMetric){best=current;bestMetric=metric;}
    }
    return best||card;
  }

  function update(){
    var change=readGoldChange();
    var card=findSentimentCard();
    if(change===null||!card)return;

    ensureStyle();
    card.classList.add("tl-live-sentiment-card");
    var view=sentiment(change);
    var items=leaves(card);
    var label=null,score=null,caption=null,maxLabel=null;

    for(var i=0;i<items.length;i++){
      var text=norm(items[i].textContent);
      if(text==="KEINE DATEN"||text==="NEUTRAL"||text==="BULLISCH"||text==="BÄRISCH")label=items[i];
      if(text==="ECHTE MARKTDATEN ERFORDERLICH"||text.indexOf("UMFELD")>=0)caption=items[i];
      if(text==="/100")maxLabel=items[i];
    }

    if(maxLabel){
      var parent=maxLabel.parentElement;
      var siblings=parent?parent.querySelectorAll("*"):[];
      for(var j=0;j<siblings.length;j++){
        if(siblings[j].children.length!==0||siblings[j]===maxLabel)continue;
        var value=parseNumber(siblings[j].textContent);
        if(value!==null||norm(siblings[j].textContent)==="-")score=siblings[j];
      }
    }

    if(!score){
      for(var k=0;k<items.length;k++){
        var current=norm(items[k].textContent);
        if(current==="-"||current==="—"){score=items[k];break;}
      }
    }

    if(label){
      label.textContent=view.label;
      label.style.color=view.color;
      label.classList.add("tl-live-sentiment-label");
      label.style.position="relative";
      label.style.zIndex="3";
    }
    if(score){
      score.textContent=String(view.score);
      score.classList.add("tl-live-sentiment-score");
    }
    if(caption){
      caption.textContent=view.caption;
      caption.classList.add("tl-live-sentiment-caption");
    }

    var paths=card.querySelectorAll("svg path");
    for(var p=0;p<paths.length;p++){
      paths[p].style.stroke=view.color;
      paths[p].style.filter="drop-shadow(0 0 4px "+view.color+")";
    }

    if(score){
      var anchor=findGaugeAnchor(card,score,maxLabel);
      anchor.classList.add("tl-live-sentiment-gauge-anchor");

      var oldArc=card.querySelector(".tl-live-sentiment-arc");
      if(oldArc&&oldArc.parentElement!==anchor){oldArc.remove();oldArc=null;}
      var arc=oldArc;
      if(!arc){arc=document.createElement("div");arc.className="tl-live-sentiment-arc";anchor.appendChild(arc);}

      var anchorRect=anchor.getBoundingClientRect();
      var size=Math.max(124,Math.min(214,Math.min(anchorRect.width,anchorRect.height)*.94));
      arc.style.width=size+"px";
      arc.style.height=size+"px";
      arc.style.color=view.color;
      var angle=view.score*2.7;
      arc.style.background="conic-gradient(from 225deg,"+view.color+" 0deg "+angle+"deg,transparent "+angle+"deg 360deg)";
    }
  }

  function start(){
    update();
    clearInterval(timer);
    timer=setInterval(update,900);
    setTimeout(function(){clearInterval(timer);timer=setInterval(update,4000);},30000);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();
