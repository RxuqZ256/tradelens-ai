(function(){
  "use strict";

  var timer=null;
  var SEGMENTS=15;
  var START_ANGLE=135;
  var TOTAL_SWEEP=270;
  var GAP_ANGLE=4;

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
      ".tl-live-sentiment-score{position:relative!important;z-index:4!important;color:#fff!important;text-shadow:0 0 12px rgba(255,255,255,.16)!important}",
      ".tl-live-sentiment-caption{position:relative!important;z-index:4!important}",
      ".tl-live-sentiment-gauge-anchor{position:relative!important;overflow:visible!important}",
      ".tl-live-sentiment-svg{position:absolute;inset:0;width:100%;height:100%;z-index:3;pointer-events:none;overflow:visible}",
      ".tl-live-sentiment-svg .tl-segment-track{fill:none;stroke:#18365f;stroke-width:4.2;stroke-linecap:round;opacity:.48}",
      ".tl-live-sentiment-svg .tl-segment-active{fill:none;stroke-width:5.2;stroke-linecap:round;filter:url(#tlSentimentGlow);transition:stroke .3s ease,opacity .3s ease}",
      ".tl-live-sentiment-svg .tl-segment-active.tl-leading{stroke-width:5.8}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function refineCenterLayout(){
    try{
      var stack=document.querySelector(".tl-sentiment-center-stack");
      var row=document.querySelector(".tl-sentiment-value-row");
      var label=document.querySelector(".tl-sentiment-center-stack .tl-live-sentiment-label");
      if(stack)stack.style.setProperty("transform","translateX(3px)","important");
      if(row){
        row.style.setProperty("gap","6px","important");
        row.style.setProperty("margin-left","-2px","important");
      }
      if(label)label.style.setProperty("margin","15px 0 0 0","important");
    }catch(e){}
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
      if(current.classList&&current.classList.contains("tl-live-sentiment-svg"))continue;
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

  function polar(cx,cy,r,angle){
    var radians=(angle-90)*Math.PI/180;
    return{x:cx+r*Math.cos(radians),y:cy+r*Math.sin(radians)};
  }

  function arcPath(cx,cy,r,startAngle,endAngle){
    var start=polar(cx,cy,r,endAngle);
    var end=polar(cx,cy,r,startAngle);
    var largeArc=endAngle-startAngle<=180?0:1;
    return"M "+start.x.toFixed(3)+" "+start.y.toFixed(3)+" A "+r+" "+r+" 0 "+largeArc+" 0 "+end.x.toFixed(3)+" "+end.y.toFixed(3);
  }

  function ensureSegmentedSvg(anchor){
    var svg=anchor.querySelector(".tl-live-sentiment-svg");
    if(svg)return svg;

    svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
    svg.setAttribute("class","tl-live-sentiment-svg");
    svg.setAttribute("viewBox","0 0 120 120");
    svg.setAttribute("preserveAspectRatio","xMidYMid meet");

    var defs=document.createElementNS("http://www.w3.org/2000/svg","defs");
    var filter=document.createElementNS("http://www.w3.org/2000/svg","filter");
    filter.setAttribute("id","tlSentimentGlow");
    filter.setAttribute("x","-60%");
    filter.setAttribute("y","-60%");
    filter.setAttribute("width","220%");
    filter.setAttribute("height","220%");

    var blur=document.createElementNS("http://www.w3.org/2000/svg","feGaussianBlur");
    blur.setAttribute("stdDeviation","2.2");
    blur.setAttribute("result","blur");
    filter.appendChild(blur);

    var merge=document.createElementNS("http://www.w3.org/2000/svg","feMerge");
    var mergeBlur=document.createElementNS("http://www.w3.org/2000/svg","feMergeNode");
    mergeBlur.setAttribute("in","blur");
    var mergeSource=document.createElementNS("http://www.w3.org/2000/svg","feMergeNode");
    mergeSource.setAttribute("in","SourceGraphic");
    merge.appendChild(mergeBlur);
    merge.appendChild(mergeSource);
    filter.appendChild(merge);
    defs.appendChild(filter);
    svg.appendChild(defs);

    var track=document.createElementNS("http://www.w3.org/2000/svg","g");
    track.setAttribute("class","tl-segment-track-group");
    var active=document.createElementNS("http://www.w3.org/2000/svg","g");
    active.setAttribute("class","tl-segment-active-group");

    var segmentSweep=(TOTAL_SWEEP-(SEGMENTS-1)*GAP_ANGLE)/SEGMENTS;
    for(var i=0;i<SEGMENTS;i++){
      var start=START_ANGLE+i*(segmentSweep+GAP_ANGLE);
      var end=start+segmentSweep;
      var d=arcPath(60,60,46,start,end);

      var trackPath=document.createElementNS("http://www.w3.org/2000/svg","path");
      trackPath.setAttribute("class","tl-segment-track");
      trackPath.setAttribute("d",d);
      track.appendChild(trackPath);

      var activePath=document.createElementNS("http://www.w3.org/2000/svg","path");
      activePath.setAttribute("class","tl-segment-active");
      activePath.setAttribute("d",d);
      activePath.setAttribute("data-index",String(i));
      activePath.style.opacity="0";
      active.appendChild(activePath);
    }

    svg.appendChild(track);
    svg.appendChild(active);
    anchor.appendChild(svg);
    return svg;
  }

  function renderSegments(svg,view){
    var activePaths=svg.querySelectorAll(".tl-segment-active");
    var exact=(view.score/100)*SEGMENTS;
    var full=Math.floor(exact);
    var partial=exact-full;

    for(var i=0;i<activePaths.length;i++){
      var path=activePaths[i];
      path.classList.remove("tl-leading");
      path.setAttribute("stroke",view.color);
      if(i<full){
        path.style.opacity=String(.76+.24*((i+1)/Math.max(1,full)));
      }else if(i===full&&partial>.08){
        path.style.opacity=String(Math.max(.24,partial*.88));
        path.classList.add("tl-leading");
      }else{
        path.style.opacity="0";
      }
    }
  }

  function update(){
    var change=readGoldChange();
    var card=findSentimentCard();
    if(change===null||!card){refineCenterLayout();return;}

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
      label.style.zIndex="4";
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
      if(paths[p].closest&&paths[p].closest(".tl-live-sentiment-svg"))continue;
      paths[p].style.stroke=view.color;
      paths[p].style.filter="drop-shadow(0 0 4px "+view.color+")";
    }

    if(score){
      var anchor=findGaugeAnchor(card,score,maxLabel);
      anchor.classList.add("tl-live-sentiment-gauge-anchor");

      var oldArc=card.querySelector(".tl-live-sentiment-arc");
      if(oldArc)oldArc.remove();

      var svg=ensureSegmentedSvg(anchor);
      renderSegments(svg,view);
    }

    refineCenterLayout();
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
