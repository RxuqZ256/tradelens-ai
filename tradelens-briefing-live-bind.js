(function(){
  "use strict";

  var timer=null;
  var PREF_KEY="tradelens_daily_briefing_market_v2";
  var MOVERS=["XAUUSD","NAS100","EURUSD","BTCUSD"];
  var ZONES=["WIDERSTAND 2","WIDERSTAND 1","AKTUELLER PREIS","UNTERSTÜTZUNG 1","UNTERSTÜTZUNG 2"];

  function norm(v){
    var s=String(v||"").toUpperCase();
    try{s=s.normalize("NFD").replace(/[\u0300-\u036f]/g,"");}catch(e){}
    return s.replace(/[–—]/g,"-").replace(/\s+/g," ").trim();
  }

  function parse(v){
    var s=String(v||"").replace(/%/g,"").replace(/\s/g,"").replace(/[^0-9,+\-.]/g,"");
    if(!s||s==="-"||s==="—")return null;
    if(s.indexOf(",")>=0)s=s.replace(/\./g,"").replace(",",".");
    var n=Number(s);
    return Number.isFinite(n)?n:null;
  }

  function fmtPct(v){return(v>0?"+":"")+v.toFixed(2).replace(".",",")+"%";}
  function fmtPrice(v){return new Intl.NumberFormat("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2}).format(v);}

  function leaf(label){
    var wanted=norm(label),nodes=document.querySelectorAll("*");
    for(var i=0;i<nodes.length;i++){
      if(nodes[i].children.length===0&&norm(nodes[i].textContent)===wanted)return nodes[i];
    }
    return null;
  }

  function row(label,peers){
    var start=leaf(label);
    if(!start)return null;
    var node=start.parentElement;
    while(node&&node!==document.body){
      var text=norm(node.textContent),other=0;
      for(var i=0;i<peers.length;i++){
        if(norm(peers[i])!==norm(label)&&text.indexOf(norm(peers[i]))>=0)other++;
      }
      if(other===0&&text.indexOf(norm(label))>=0)return node;
      node=node.parentElement;
    }
    return start.parentElement;
  }

  function value(label,peers){
    var r=row(label,peers);
    if(!r)return null;
    var nodes=r.querySelectorAll("*");
    for(var i=nodes.length-1;i>=0;i--){
      if(nodes[i].children.length!==0)continue;
      if(norm(nodes[i].textContent)===norm(label))continue;
      var n=parse(nodes[i].textContent);
      if(n!==null)return n;
    }
    return null;
  }

  function moverData(){
    var out={};
    for(var i=0;i<MOVERS.length;i++){
      var n=value(MOVERS[i],MOVERS);
      if(n!==null)out[MOVERS[i]]=n;
    }
    return out;
  }

  function zoneData(){
    var out={};
    for(var i=0;i<ZONES.length;i++){
      var n=value(ZONES[i],ZONES);
      if(n!==null)out[norm(ZONES[i])]=n;
    }
    return out;
  }

  function selectedMarket(){
    try{return localStorage.getItem(PREF_KEY)||"XAUUSD";}catch(e){return"XAUUSD";}
  }

  function cls(el,name){
    if(!el)return;
    el.classList.remove("pos","neg");
    if(name)el.classList.add(name);
  }

  function update(){
    var box=document.querySelector(".tl-native-briefing");
    if(!box)return;

    var market=selectedMarket();
    var names={XAUUSD:"GOLD",NAS100:"NASDAQ 100",EURUSD:"EURUSD",BTCUSD:"BITCOIN",MARKET:"GESAMTMARKT"};
    var movers=moverData(),zones=zoneData();
    var title=box.querySelector(".tl-native-title");
    var status=box.querySelector(".tl-native-status");
    var summary=box.querySelector(".tl-native-summary");
    var cards=box.querySelectorAll(".tl-native-card");
    var focus=box.querySelector(".tl-native-focus");
    if(!title||!status||!summary||cards.length<3||!focus)return;

    var l1=cards[0].querySelector("small"),v1=cards[0].querySelector("strong");
    var l2=cards[1].querySelector("small"),v2=cards[1].querySelector("strong");
    var l3=cards[2].querySelector("small"),v3=cards[2].querySelector("strong");
    title.textContent="AI DAILY BRIEFING · "+names[market];

    if(market==="XAUUSD"){
      var change=movers.XAUUSD;
      var current=zones["AKTUELLER PREIS"],r1=zones["WIDERSTAND 1"],r2=zones["WIDERSTAND 2"],s1=zones["UNTERSTUTZUNG 1"],s2=zones["UNTERSTUTZUNG 2"];
      if(change===undefined&&current===undefined)return;

      status.textContent="GOLD · M15 LIVE";
      status.classList.toggle("wait",!(change!==undefined&&current!==undefined&&r1!==undefined&&r2!==undefined&&s1!==undefined&&s2!==undefined));
      summary.textContent="Gold"+(current!==undefined?" steht aktuell bei "+fmtPrice(current):"")+(change!==undefined?" und bewegt sich im M15 um "+fmtPct(change):"")+".";
      l1.textContent="Gold-Bias";l2.textContent="Momentum";l3.textContent="Nächstes Level";

      var bias=change>0.01?"Bullisch":change<-0.01?"Bärisch":"Neutral";
      var color=change>0.01?"pos":change<-0.01?"neg":"";
      v1.textContent=bias;cls(v1,color);
      v2.textContent=change===undefined?"Wird geladen":Math.abs(change)>=0.15?"Stark":Math.abs(change)>=0.05?"Moderat":"Ruhig";cls(v2,color);
      v3.textContent="—";
      focus.textContent="Die technischen Gold-Zonen werden geladen.";

      if(current!==undefined&&r1!==undefined&&r2!==undefined&&s1!==undefined&&s2!==undefined){
        if(current>r1){v1.textContent="Bullisch";cls(v1,"pos");v3.textContent=fmtPrice(r2);focus.textContent="Gold notiert über Widerstand 1. Der nächste technische Zielbereich liegt bei "+fmtPrice(r2)+".";}
        else if(current<s1){v1.textContent="Bärisch";cls(v1,"neg");v3.textContent=fmtPrice(s2);focus.textContent="Gold handelt unter Unterstützung 1. Die nächste technische Zielzone liegt bei "+fmtPrice(s2)+".";}
        else if(change!==undefined&&change>=0){v3.textContent=fmtPrice(r1);focus.textContent="Gold handelt innerhalb der Range. Widerstand 1 bei "+fmtPrice(r1)+" ist das nächste wichtige Level.";}
        else{v3.textContent=fmtPrice(s1);focus.textContent="Gold handelt innerhalb der Range. Unterstützung 1 bei "+fmtPrice(s1)+" ist das nächste wichtige Level.";}
      }
      return;
    }

    if(market==="MARKET"){
      var keys=Object.keys(movers);
      if(!keys.length)return;
      var positive=keys.filter(function(k){return movers[k]>0;}).length;
      var strongest=keys[0];
      for(var i=1;i<keys.length;i++)if(Math.abs(movers[keys[i]])>Math.abs(movers[strongest]))strongest=keys[i];
      var avg=keys.reduce(function(sum,k){return sum+movers[k];},0)/keys.length;
      var c=avg>0.01?"pos":avg<-0.01?"neg":"";
      status.textContent=keys.length===4?"GESAMTMARKT · LIVE":"GESAMTMARKT · "+keys.length+"/4";
      status.classList.toggle("wait",keys.length!==4);
      summary.textContent=positive+" von "+keys.length+" geladenen Märkten handeln positiv. "+strongest+" bewegt sich mit "+fmtPct(movers[strongest])+" am stärksten.";
      l1.textContent="Markt-Bias";v1.textContent=avg>0.01?"Bullisch":avg<-0.01?"Bärisch":"Neutral";cls(v1,c);
      l2.textContent="Stärkster Markt";v2.textContent=strongest;cls(v2,movers[strongest]>=0?"pos":"neg");
      l3.textContent="Geladen";v3.textContent=keys.length+"/4";
      focus.textContent="Der Gesamtmarkt-Modus vergleicht Gold, NAS100, EURUSD und Bitcoin anhand ihrer M15-Bewegung.";
      return;
    }

    var move=movers[market];
    if(move===undefined)return;
    var moveClass=move>0.01?"pos":move<-0.01?"neg":"";
    status.textContent=names[market]+" · M15 LIVE";status.classList.remove("wait");
    summary.textContent=names[market]+" bewegt sich im M15 um "+fmtPct(move)+".";
    l1.textContent="Bias";v1.textContent=move>0.01?"Bullisch":move<-0.01?"Bärisch":"Neutral";cls(v1,moveClass);
    l2.textContent="Momentum";v2.textContent=Math.abs(move)>=0.15?"Stark":Math.abs(move)>=0.05?"Moderat":"Ruhig";cls(v2,moveClass);
    l3.textContent="M15 Änderung";v3.textContent=fmtPct(move);cls(v3,moveClass);
    focus.textContent="Das Briefing bewertet die kurzfristige M15-Bewegung von "+names[market]+".";
  }

  function start(){
    update();
    clearInterval(timer);
    timer=setInterval(update,1000);
    setTimeout(function(){clearInterval(timer);timer=setInterval(update,5000);},30000);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();
