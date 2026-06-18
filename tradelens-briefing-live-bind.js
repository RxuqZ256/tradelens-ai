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
    var status=box.querySelector(".tl-native-status");
    var summary=box.querySelector(".tl-native-summary");
    var focus=box.querySelector(".tl-native-focus");
    var bias=box.querySelector(".tl-native-bias");
    var momentum=box.querySelector(".tl-native-momentum");
    var levelLabel=box.querySelector(".tl-native-level-label");
    var levelValue=box.querySelector(".tl-native-level-value");
    if(!status||!summary||!focus||!bias||!momentum||!levelLabel||!levelValue)return;

    if(market==="XAUUSD"){
      var change=movers.XAUUSD;
      var current=zones["AKTUELLER PREIS"],r1=zones["WIDERSTAND 1"],r2=zones["WIDERSTAND 2"],s1=zones["UNTERSTUTZUNG 1"],s2=zones["UNTERSTUTZUNG 2"];
      if(change===undefined&&current===undefined)return;

      var ready=change!==undefined&&current!==undefined&&r1!==undefined&&r2!==undefined&&s1!==undefined&&s2!==undefined;
      status.textContent="GOLD · M15 LIVE";
      status.classList.toggle("wait",!ready);
      summary.textContent="Gold"+(current!==undefined?" steht aktuell bei "+fmtPrice(current):"")+(change!==undefined?" und bewegt sich im M15 um "+fmtPct(change):"")+".";

      var biasText=change>0.01?"Bullisch":change<-0.01?"Bärisch":"Neutral";
      var color=change>0.01?"pos":change<-0.01?"neg":"";
      bias.textContent=biasText;
      momentum.textContent=change===undefined?"M15":Math.abs(change)>=0.15?"Stark":Math.abs(change)>=0.05?"Moderat":"Ruhig";
      cls(bias,color);cls(momentum,color);
      levelLabel.textContent="Nächstes Level";
      levelValue.textContent="—";
      focus.textContent="Die technischen Gold-Zonen werden geladen.";

      if(current!==undefined&&r1!==undefined&&r2!==undefined&&s1!==undefined&&s2!==undefined){
        if(current>r1){bias.textContent="Bullisch";cls(bias,"pos");levelValue.textContent=fmtPrice(r2);focus.textContent="Gold notiert über Widerstand 1. Der nächste Zielbereich liegt bei "+fmtPrice(r2)+".";}
        else if(current<s1){bias.textContent="Bärisch";cls(bias,"neg");levelValue.textContent=fmtPrice(s2);focus.textContent="Gold handelt unter Unterstützung 1. Die nächste Zielzone liegt bei "+fmtPrice(s2)+".";}
        else if(change!==undefined&&change>=0){levelValue.textContent=fmtPrice(r1);focus.textContent="Innerhalb der Range bleibt Widerstand 1 bei "+fmtPrice(r1)+" das nächste wichtige Level.";}
        else{levelValue.textContent=fmtPrice(s1);focus.textContent="Innerhalb der Range bleibt Unterstützung 1 bei "+fmtPrice(s1)+" das nächste wichtige Level.";}
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
      bias.textContent=avg>0.01?"Bullisch":avg<-0.01?"Bärisch":"Neutral";cls(bias,c);
      momentum.textContent=strongest;cls(momentum,movers[strongest]>=0?"pos":"neg");
      levelLabel.textContent="Geladen";levelValue.textContent=keys.length+"/4";
      focus.textContent="Verglichen werden Gold, NAS100, EURUSD und Bitcoin anhand ihrer aktuellen M15-Bewegung.";
      return;
    }

    var move=movers[market];
    if(move===undefined)return;
    var moveClass=move>0.01?"pos":move<-0.01?"neg":"";
    status.textContent=names[market]+" · M15 LIVE";
    status.classList.remove("wait");
    summary.textContent=names[market]+" bewegt sich im M15 um "+fmtPct(move)+".";
    bias.textContent=move>0.01?"Bullisch":move<-0.01?"Bärisch":"Neutral";cls(bias,moveClass);
    momentum.textContent=Math.abs(move)>=0.15?"Stark":Math.abs(move)>=0.05?"Moderat":"Ruhig";cls(momentum,moveClass);
    levelLabel.textContent="M15 Änderung";levelValue.textContent=fmtPct(move);
    focus.textContent="Das Briefing bewertet die kurzfristige Bewegung von "+names[market]+".";
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
