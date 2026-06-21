(function(){
  "use strict";

  var frame=document.getElementById("app");
  var observer=null;
  var scheduled=false;

  function norm(value){
    var text=String(value||"").toUpperCase();
    try{text=text.normalize("NFD").replace(/[\u0300-\u036f]/g,"");}catch(_e){}
    return text.replace(/[–—]/g,"-").replace(/\s+/g," ").trim();
  }

  function leaves(root){
    var nodes=(root||document).querySelectorAll("*");
    var out=[];
    for(var i=0;i<nodes.length;i++){
      if(nodes[i].children.length===0&&norm(nodes[i].textContent))out.push(nodes[i]);
    }
    return out;
  }

  function findLeaf(doc,label){
    var wanted=norm(label),items=leaves(doc);
    for(var i=0;i<items.length;i++)if(norm(items[i].textContent)===wanted)return items[i];
    return null;
  }

  function closestCard(node){
    if(!node)return null;
    var direct=node.closest&&node.closest(".gf,.card");
    if(direct)return direct;
    var current=node.parentElement;
    while(current&&current!==node.ownerDocument.body){
      var rect=current.getBoundingClientRect();
      if(rect.width>140&&rect.height>120&&rect.width<430)return current;
      current=current.parentElement;
    }
    return null;
  }

  function commonAncestor(a,b){
    if(!a||!b)return null;
    var seen=[];
    var n=a;
    while(n){seen.push(n);n=n.parentElement;}
    n=b;
    while(n){if(seen.indexOf(n)>=0)return n;n=n.parentElement;}
    return null;
  }

  function addClass(node,name){
    if(node&&node.classList&&!node.classList.contains(name))node.classList.add(name);
  }

  function findOverviewPage(doc,briefingCard){
    if(briefingCard&&briefingCard.closest){
      var page=briefingCard.closest(".page");
      if(page)return page;
    }
    var node=briefingCard;
    while(node&&node!==doc.body){
      var text=norm(node.textContent);
      if(text.indexOf("AI DAILY BRIEFING")>=0&&text.indexOf("TOP MOVERS")>=0&&text.indexOf("WICHTIGE ZONEN")>=0)return node;
      node=node.parentElement;
    }
    return null;
  }

  function findNav(doc){
    var items=doc.querySelectorAll("nav,footer,div");
    var best=null,bestArea=Infinity;
    for(var i=0;i<items.length;i++){
      var text=norm(items[i].textContent);
      if(text.indexOf("UBERSICHT")<0||text.indexOf("ANALYSE")<0||text.indexOf("JOURNAL")<0||text.indexOf("LERNEN")<0||text.indexOf("PROFIL")<0)continue;
      var r=items[i].getBoundingClientRect();
      if(r.width<260||r.height<48||r.height>170)continue;
      var area=r.width*r.height;
      if(area<bestArea){best=items[i];bestArea=area;}
    }
    return best;
  }

  function findNavItem(nav,label){
    if(!nav)return null;
    var nodes=nav.querySelectorAll("button,a,[role='button'],div");
    var wanted=norm(label),best=null,bestArea=Infinity;
    for(var i=0;i<nodes.length;i++){
      if(norm(nodes[i].textContent)!==wanted)continue;
      var r=nodes[i].getBoundingClientRect();
      var area=r.width*r.height;
      if(area>0&&area<bestArea){best=nodes[i];bestArea=area;}
    }
    if(best&&best.parentElement&&best.parentElement!==nav){
      var pr=best.parentElement.getBoundingClientRect();
      if(pr.width<110&&pr.height<120)return best.parentElement;
    }
    return best;
  }

  function ensureInfoIcon(card){
    if(!card||card.querySelector(".tl-ref-info"))return;
    var icon=card.ownerDocument.createElement("span");
    icon.className="tl-ref-info";
    icon.textContent="i";
    icon.setAttribute("aria-hidden","true");
    var inner=card.querySelector(":scope > .in")||card;
    inner.appendChild(icon);
  }

  function prepareSentiment(card){
    if(!card)return;
    var stack=card.querySelector(".tl-sentiment-center-stack");
    var row=card.querySelector(".tl-sentiment-value-row");
    var label=card.querySelector(".tl-live-sentiment-label");
    if(stack&&row&&label){
      if(stack.firstElementChild!==label)stack.insertBefore(label,row);
      row.style.removeProperty("margin-left");
    }
    ensureInfoIcon(card);
  }

  function decorateRows(doc){
    var moverLabels=["XAUUSD","NAS100","EURUSD","BTCUSD"];
    for(var i=0;i<moverLabels.length;i++){
      var leaf=findLeaf(doc,moverLabels[i]);
      if(!leaf)continue;
      var node=leaf.parentElement;
      while(node&&node!==doc.body){
        var text=norm(node.textContent);
        var hits=0;
        for(var j=0;j<moverLabels.length;j++)if(text.indexOf(moverLabels[j])>=0)hits++;
        if(hits===1&&node.getBoundingClientRect().width>110){addClass(node,"tl-ref-mover-row");break;}
        node=node.parentElement;
      }
    }

    var zoneLabels=["WIDERSTAND 2","WIDERSTAND 1","AKTUELLER PREIS","UNTERSTUTZUNG 1","UNTERSTUTZUNG 2"];
    for(var k=0;k<zoneLabels.length;k++){
      var z=findLeaf(doc,zoneLabels[k]);
      if(!z)continue;
      var zn=z.parentElement;
      while(zn&&zn!==doc.body){
        var ztext=norm(zn.textContent),zhits=0;
        for(var q=0;q<zoneLabels.length;q++)if(ztext.indexOf(zoneLabels[q])>=0)zhits++;
        if(zhits===1&&zn.getBoundingClientRect().width>180){
          addClass(zn,"tl-ref-zone-row");
          if(zoneLabels[k]==="AKTUELLER PREIS")addClass(zn,"tl-ref-current-row");
          if(zoneLabels[k].indexOf("UNTERSTUTZUNG")===0)addClass(zn,"tl-ref-support-row");
          break;
        }
        zn=zn.parentElement;
      }
    }
  }

  function ensureStyle(doc){
    var id="tl-reference-overview-style-v1";
    var existing=doc.getElementById(id);
    if(existing)return;
    var link=doc.createElement("link");
    link.id=id;
    link.rel="stylesheet";
    link.href="tradelens-reference-overview-v1.css?v=20260621u";
    doc.head.appendChild(link);
  }

  function apply(){
    if(!frame)return;
    var doc;
    try{doc=frame.contentDocument||frame.contentWindow.document;}catch(_e){return;}
    if(!doc||!doc.body)return;

    ensureStyle(doc);

    var briefingLeaf=findLeaf(doc,"AI DAILY BRIEFING")||findLeaf(doc,"MARKTÜBERBLICK");
    var sentimentLeaf=findLeaf(doc,"MARKT SENTIMENT");
    var moversLeaf=findLeaf(doc,"TOP MOVERS");
    var zonesLeaf=null;
    var all=leaves(doc);
    for(var i=0;i<all.length;i++){
      if(norm(all[i].textContent).indexOf("WICHTIGE ZONEN")===0){zonesLeaf=all[i];break;}
    }

    var briefingCard=closestCard(briefingLeaf);
    var sentimentCard=closestCard(sentimentLeaf);
    var moversCard=closestCard(moversLeaf);
    var zonesCard=closestCard(zonesLeaf);
    var overview=findOverviewPage(doc,briefingCard);

    addClass(overview,"tl-ref-overview-page");
    addClass(briefingCard,"tl-ref-card");
    addClass(briefingCard,"tl-ref-briefing-card");
    addClass(sentimentCard,"tl-ref-card");
    addClass(sentimentCard,"tl-ref-sentiment-card");
    addClass(moversCard,"tl-ref-card");
    addClass(moversCard,"tl-ref-movers-card");
    addClass(zonesCard,"tl-ref-card");
    addClass(zonesCard,"tl-ref-zones-card");

    var dual=commonAncestor(sentimentCard,moversCard);
    if(dual&&dual!==overview){
      var rect=dual.getBoundingClientRect();
      if(rect.width>260&&rect.height>160)addClass(dual,"tl-ref-dual-grid");
    }

    prepareSentiment(sentimentCard);
    decorateRows(doc);

    var nav=findNav(doc);
    addClass(nav,"tl-ref-bottom-nav");
    var labels=["Übersicht","Analyse","Journal","Lernen","Profil"];
    for(var j=0;j<labels.length;j++)addClass(findNavItem(nav,labels[j]),"tl-ref-nav-item");
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    setTimeout(function(){scheduled=false;apply();},80);
  }

  function boot(){
    apply();
    var attempts=0;
    var timer=setInterval(function(){
      attempts++;
      apply();
      if(attempts>=30)clearInterval(timer);
    },350);

    try{
      var doc=frame.contentDocument||frame.contentWindow.document;
      if(observer)observer.disconnect();
      observer=new MutationObserver(schedule);
      observer.observe(doc.documentElement,{subtree:true,childList:true,characterData:true});
    }catch(_e){}
  }

  if(frame){
    frame.addEventListener("load",function(){setTimeout(boot,450);});
    setTimeout(boot,1000);
  }
})();