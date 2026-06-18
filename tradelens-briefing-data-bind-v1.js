(function(){
  "use strict";

  var timer=null;
  var PREF_KEY="tradelens_daily_briefing_market_v2";
  var MOVER_LABELS=["XAUUSD","NAS100","EURUSD","BTCUSD"];
  var ZONE_LABELS=["WIDERSTAND 2","WIDERSTAND 1","AKTUELLER PREIS","UNTERSTÜTZUNG 1","UNTERSTÜTZUNG 2"];

  function norm(value){
    var text=String(value||"").toUpperCase();
    try{text=text.normalize("NFD").replace(/[\u0300-\u036f]/g,"");}catch(e){}
    return text.replace(/[–—]/g,"-").replace(/\s+/g," ").trim();
  }

  function parse(value){
    var text=String(value||"").replace(/%/g,"").replace(/\s/g,"").replace(/[^0-9,+\-.]/g,"");
    if(!text||text==="-"||text==="—")return null;
    if(text.indexOf(",")>=0)text=text.replace(/\./g,"").replace(",",".");
    var number=Number(text);
    return Number.isFinite(number)?number:null;
  }

  function formatPrice(value){
    return new Intl.NumberFormat("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
  }

  function formatPercent(value){
    return(value>0?"+":"")+value.toFixed(2).replace(".",",")+"%";
  }

  function currentMarket(){
    try{return localStorage.getItem(PREF_KEY)||"XAUUSD";}catch(e){return"XAUUSD";}
  }

  function findLeaf(label){
    var wanted=norm(label);
    var nodes=document.querySelectorAll("*");
    for(var i=0;i<nodes.length;i++){
      if(nodes[i].children.length===0&&norm(nodes[i].textContent)===wanted)return nodes[i];
    }
    return null;
  }

  function findRow(label,labels){
    var leaf=findLeaf(label);
    if(!leaf)return null;
    var node=leaf.parentElement;
    while(node&&node!==document.body){
      var text=norm(node.textContent);
      var other=0;
      for(var i=0;i<labels.length;i++){
        if(norm(labels[i])!==norm(label)&&text.indexOf(norm(labels[i]))>=0)other++;
      }
      if(other===0&&text.indexOf(norm(label))>=0)return node;
      node=node.parentElement;
    }
    return leaf.parentElement;
  }

  function valueFor(label,labels){
    var row=findRow(label,labels);
    if(!row)return null;
    var candidates=row.querySelectorAll("*");
    for(var i=candidates.length-1;i>=0;i--){
      if(candidates[i].children.length!==0)continue;
      if(norm(candidates[i].textContent)===norm(label))continue;
      var parsed=parse(candidates[i].textContent);
      if(parsed!==null)return parsed;
    }
    return null;
  }

  function readMovers(){
    var result={};
    for(var i=0;i<MOVER_LABELS.length;i++){
      var value=valueFor(MOVER_LABELS[i],MOVER_LABELS);
      if(value!==null)result[MOVER_LABELS[i]]=value;
    }
    return result;
  }

  function readZones(){
    var result={};
    for(var i=0;i<ZONE_LABELS.length;i++){
      var value=valueFor(ZONE_LABELS[i],ZONE_LABELS);
      if(value!==null)result[norm(ZONE_LABELS[i])]=value;
    }
    return result;
  }

  function setClass(element,className){
    if(!element)return;
    element.classList.remove("pos","neg");
    if(className)element.classList.add(className);
  }

  function update(){
    var box=document.querySelector(".tl-native-briefing");
    if(!box)return;

    var market=currentMarket();
    var labels={XAUUSD:"GOLD",NAS100:"NASDAQ 100",EURUSD:"EURUSD",BTCUSD:"BITCOIN",MARKET:"GESAMTMARKT"};
    var movers=readMovers();
    var zones=readZones();

    var title=box.querySelector(".tl-native-title");
    var status=box.querySelector(".tl-native-status");
    var summary=box.querySelector(".tl-native-summary");
    var cards=box.querySelectorAll(".tl-native-card");
    var focus=box.querySelector(".tl-native-focus");
    if(!title||!status||!summary||cards.length<3||!focus)return;

    title.textContent="AI DAILY BRIEFING · "+labels[market];

    var stat1Label=cards[0].querySelector("small");
    var stat1Value=cards[0].querySelector("strong");
    var stat2Label=cards[1].querySelector("small");
    var stat2Value=cards[1].querySelector("strong");
    var stat3Label=cards[2].querySelector("small");
    var stat3Value=cards[2].querySelector("strong");

    if(market==="XAUUSD"){
      var change=movers.XAUUSD;
      var current=zones["AKTUELLER PREIS"];
      var r1=zones["WIDERSTAND 1"];
      var r2=zones["WIDERSTAND 2"];
      var s1=zones["UNTERSTUTZUNG 1"];
      var s2=zones["UNTERSTUTZUNG 2"];

      if(change===undefined&&current===undefined)return;

      status.textContent="GOLD · M15 LIVE";
      status.classList.toggle("wait",!(change!==undefined&&current!==undefined&&r1!==undefined&&r2!==undefined&&s1!==undefined&&s2!==undefined));
      summary.textContent="Gold"+(current!==undefined?" steht aktuell bei "+formatPrice(current):"")+(change!==undefined?" und bewegt sich im M15 um "+formatPercent(change):"")+".";

      stat1Label.textContent="Gold-Bias";
      stat2Label.textContent="Momentum";
      stat3Label.textContent="Nächstes Level";

      var bias="Neutral";
      var biasClass="";
      if(change!==undefined){
        bias=change>0.01?"Bullisch":change<-0.01?"Bärisch":"Neutral";
        biasClass=change>0.01?"pos":change<-0.01?"neg":"";
        stat2Value.textContent=Math.abs(change)>=0.15?"Stark":Math.abs(change)>=0.05?"Moderat":"Ruhig";
      }

      stat3Value.textContent="—";
      focus.textContent="Die technischen Gold-Zonen werden geladen.";

      if(current!==undefined&&r1!==undefined&&r2!==undefined&&s1!==undefined&&s2!==undefined){
        if(current>r1){bias="Bullisch";biasClass="pos";stat3Value.textContent=formatPrice(r2);focus.textContent="Gold notiert über Widerstand 1. Der nächste technische Zielbereich liegt bei "+formatPrice(r2)+".";}
        else if(current<s1){bias="Bärisch";biasClass="neg";stat3Value.textContent=formatPrice(s2);focus.textContent="Gold handelt unter Unterstützung 1. Die nächste technische Zielzone liegt bei "+formatPrice(s2)+".";}
        else if(change!==undefined&&change>=0){stat3Value.textContent=formatPrice(r1);focus.textContent="Gold handelt innerhalb der Range. Bei positivem Momentum ist Widerstand 1 bei "+formatPrice(r1)+" entscheidend.";}
        else{stat3Value.textContent=formatPrice(s1);focus.textContent="Gold handelt innerhalb der Range. Bei negativem Momentum ist Unterstützung 1 bei "+formatPrice(s1)+" entscheidend.";}
      }

      stat1Value.textContent=bias;
      setClass(stat1Value,biasClass);
      setClass(stat2Value,biasClass);
      return;
    }

    if(market==="MARKET"){
      var keys=Object.keys(movers);
      if(!keys.length)return;
      var positives=keys.filter(function(key){return movers[key]>0;}).length;
      var strongest=keys[0];
      for(var k=1;k<keys.length;k++)if(Math.abs(movers[keys[k]])>Math.abs(movers[strongest]))strongest=keys[k];
      var average=keys.reduce(function(sum,key){return sum+movers[key];},0)/keys.length;
      var marketClass=average>0.01?"pos":average<-0.01?"neg":"";
      status.textContent=keys.length===4?"GESAMTMARKT · LIVE":"GESAMTMARKT · "+keys.length+"/4";
      status.classList.toggle("wait",keys.length!==4);
      summary.textContent=positives+" von "+keys.length+" geladenen Märkten handeln positiv. "+strongest+" zeigt mit "+formatPercent(movers[strongest])+" die stärkste M15-Bewegung.";
      stat1Label.textContent="Markt-Bias";stat1Value.textContent=average>0.01?"Bullisch":average<-0.01?"Bärisch":"Neutral";setClass(stat1Value,marketClass);
      stat2Label.textContent="Stärkster Markt";stat2Value.textContent=strongest;setClass(stat2Value,movers[strongest]>=0?"pos":"neg");
      stat3Label.textContent="Geladen";stat3Value.textContent=keys.length+"/4";
      focus.textContent="Der Gesamtmarkt-Modus vergleicht Gold, NAS100, EURUSD und Bitcoin anhand ihrer aktuellen M15-Bewegung.";
      return;
    }

    var selected=movers[market];
    if(selected===undefined)return;
    var selectedClass=selected>0.01?"pos":selected<-0.01?"neg":"";
    status.textContent=labels[market]+" · M15 LIVE";
    status.classList.remove("wait");
    summary.textContent=labels[market]+" bewegt sich im aktuellen M15-Vergleich um "+formatPercent(selected)+".";
    stat1Label.textContent="Bias";stat1Value.textContent=selected>0.01?"Bullisch":selected<-0.01?"Bärisch":"Neutral";setClass(stat1Value,selectedClass);
    stat2Label.textContent="Momentum";stat2Value.textContent=Math.abs(selected)>=0.15?"Stark":Math.abs(selected)>=0.05?"Moderat":"Ruhig";setClass(stat2Value,selectedClass);
    stat3Label.textContent="M15 Änderung";stat3Value.textContent=formatPercent(selected);setClass(stat3Value,selectedClass);
    focus.textContent="Das Briefing bewertet die kurzfristige M15-Bewegung von "+labels[market]+". Weitere Preiszonen werden später ergänzt.";
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
