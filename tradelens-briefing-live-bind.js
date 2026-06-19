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

  function biasFor(market,move){
    var thresholds={XAUUSD:.10,NAS100:.15,EURUSD:.05,BTCUSD:.25,MARKET:.10};
    var threshold=thresholds[market]||.10;
    if(move>threshold)return{label:"Bullisch",className:"pos"};
    if(move<-threshold)return{label:"Bärisch",className:"neg"};
    return{label:"Neutral",className:""};
  }

  function momentumFor(market,move){
    var absolute=Math.abs(move);
    var limits={
      XAUUSD:{moderate:.30,strong:1.00},
      NAS100:{moderate:.50,strong:1.50},
      EURUSD:{moderate:.25,strong:.75},
      BTCUSD:{moderate:1.00,strong:3.00},
      MARKET:{moderate:.30,strong:1.00}
    };
    var selected=limits[market]||limits.XAUUSD;
    if(absolute>=selected.strong)return"Stark";
    if(absolute>=selected.moderate)return"Moderat";
    return"Ruhig";
  }

  function update(){
    var box=document.querySelector(".tl-native-briefing");
    if(!box)return;

    var market=selectedMarket();
    var names={XAUUSD:"GOLD",NAS100:"NASDAQ 100",EURUSD:"EURUSD",BTCUSD:"BITCOIN",MARKET:"GESAMTMARKT"};
    var movers=moverData(),zones=zoneData();
    var status=box.querySelector(".tl-native-status");
    var summary=box.querySelector(".tl-native-summary");
    var focus=box.querySelector(".tl-native-focus");
    var bias=box.querySelector(".tl-native-bias");
    var momentum=box.querySelector(".tl-native-momentum");
    var levelLabel=box.querySelector(".tl-native-level-label");
    var levelValue=box.querySelector(".tl-native-level-value");
    if(!summary||!focus||!bias||!momentum||!levelLabel||!levelValue)return;

    if(status)status.style.display="none";

    if(market==="XAUUSD"){
      var change=movers.XAUUSD;
      var current=zones["AKTUELLER PREIS"],r1=zones["WIDERSTAND 1"],r2=zones["WIDERSTAND 2"],s1=zones["UNTERSTUTZUNG 1"],s2=zones["UNTERSTUTZUNG 2"];
      if(change===undefined&&current===undefined)return;

      summary.textContent="Gold"+(current!==undefined?" steht aktuell bei "+fmtPrice(current):"")+(change!==undefined?" und liegt heute bei "+fmtPct(change):"")+".";

      var goldBias=change===undefined?{label:"Wird geladen",className:""}:biasFor("XAUUSD",change);
      bias.textContent=goldBias.label;
      momentum.textContent=change===undefined?"Daily":momentumFor("XAUUSD",change);
      cls(bias,goldBias.className);cls(momentum,goldBias.className);
      levelLabel.textContent="Intraday-Level";
      levelValue.textContent="—";
      focus.textContent="Die technischen Intraday-Zonen für Gold werden geladen.";

      if(current!==undefined&&r1!==undefined&&r2!==undefined&&s1!==undefined&&s2!==undefined){
        if(current>r1){levelValue.textContent=fmtPrice(r2);focus.textContent="Der Tagesbias ist "+goldBias.label.toLowerCase()+". Intraday liegt der nächste Zielbereich bei "+fmtPrice(r2)+".";}
        else if(current<s1){levelValue.textContent=fmtPrice(s2);focus.textContent="Der Tagesbias ist "+goldBias.label.toLowerCase()+". Intraday liegt die nächste Zielzone bei "+fmtPrice(s2)+".";}
        else if(change!==undefined&&change>=0){levelValue.textContent=fmtPrice(r1);focus.textContent="Der Tagesbias ist "+goldBias.label.toLowerCase()+". Intraday bleibt Widerstand 1 bei "+fmtPrice(r1)+" entscheidend.";}
        else{levelValue.textContent=fmtPrice(s1);focus.textContent="Der Tagesbias ist "+goldBias.label.toLowerCase()+". Intraday bleibt Unterstützung 1 bei "+fmtPrice(s1)+" entscheidend.";}
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
      var marketBias=biasFor("MARKET",avg);
      summary.textContent=positive+" von "+keys.length+" Märkten handeln heute positiv. "+strongest+" zeigt mit "+fmtPct(movers[strongest])+" die stärkste Tagesbewegung.";
      bias.textContent=marketBias.label;cls(bias,marketBias.className);
      momentum.textContent=strongest;cls(momentum,movers[strongest]>=0?"pos":"neg");
      levelLabel.textContent="Geladen";levelValue.textContent=keys.length+"/4";
      focus.textContent="Verglichen werden Gold, NAS100, EURUSD und Bitcoin anhand ihrer heutigen Veränderung.";
      return;
    }

    var move=movers[market];
    if(move===undefined)return;
    var selectedBias=biasFor(market,move);
    summary.textContent=names[market]+" liegt heute bei "+fmtPct(move)+".";
    bias.textContent=selectedBias.label;cls(bias,selectedBias.className);
    momentum.textContent=momentumFor(market,move);cls(momentum,selectedBias.className);
    levelLabel.textContent="Tagesänderung";levelValue.textContent=fmtPct(move);cls(levelValue,selectedBias.className);
    focus.textContent="Das Briefing bewertet die aktuelle Tagesbewegung von "+names[market]+".";
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
