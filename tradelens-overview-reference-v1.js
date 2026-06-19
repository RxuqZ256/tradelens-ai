(function(){
  "use strict";

  var timer=null;
  var moverLabels=["XAUUSD","NAS100","EURUSD","BTCUSD"];

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

  function leafByText(text,startsWith){
    var wanted=norm(text);
    var nodes=document.querySelectorAll("*");
    for(var i=0;i<nodes.length;i++){
      if(nodes[i].children.length!==0)continue;
      var current=norm(nodes[i].textContent);
      if((startsWith&&current.indexOf(wanted)===0)||(!startsWith&&current===wanted))return nodes[i];
    }
    return null;
  }

  function cardFromHeading(text,startsWith){
    var leaf=leafByText(text,startsWith);
    if(!leaf)return null;
    var direct=leaf.closest&&leaf.closest(".gf,.card,.briefing");
    if(direct)return direct;
    var node=leaf.parentElement;
    while(node&&node!==document.body){
      var rect=node.getBoundingClientRect();
      if(rect.width>220&&rect.height>110&&rect.height<700)return node;
      node=node.parentElement;
    }
    return leaf.parentElement;
  }

  function ensureStyles(){
    if(document.getElementById("tl-reference-overview-style"))return;
    var style=document.createElement("style");
    style.id="tl-reference-overview-style";
    style.textContent=[
      ".tl-ref-briefing,.tl-ref-sentiment-card,.tl-ref-movers-card,.tl-ref-zones-card{background:linear-gradient(180deg,rgba(7,16,35,.96),rgba(3,9,22,.98))!important;border:1px solid rgba(72,146,255,.52)!important;box-shadow:inset 0 0 30px rgba(34,211,238,.035),0 0 18px rgba(37,99,235,.05)!important}",
      ".tl-ref-market-grid{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:10px!important;align-items:stretch!important}",
      ".tl-ref-sentiment-card,.tl-ref-movers-card{min-height:272px!important;padding:13px!important;overflow:hidden!important}",
      ".tl-ref-zones-card{padding:13px!important;margin-top:10px!important}",
      ".tl-ref-card-title{font-family:var(--f-disp)!important;font-size:12px!important;letter-spacing:1.35px!important;color:#dff7ff!important;text-transform:uppercase!important;margin-bottom:10px!important}",
      ".tl-ref-sentiment-wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:225px}",
      ".tl-ref-gauge{--tl-score-angle:135deg;--tl-sentiment:#22d3ee;position:relative;width:152px;height:152px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:conic-gradient(from 225deg,var(--tl-sentiment) 0 var(--tl-score-angle),rgba(30,64,175,.30) var(--tl-score-angle) 270deg,transparent 270deg 360deg);filter:drop-shadow(0 0 12px rgba(34,211,238,.18))}",
      ".tl-ref-gauge:before{content:'';position:absolute;inset:10px;border-radius:50%;background:#071023;border:1px solid rgba(96,165,250,.18);box-shadow:inset 0 0 18px rgba(34,211,238,.05)}",
      ".tl-ref-gauge:after{content:'';position:absolute;inset:2px;border-radius:50%;background:repeating-conic-gradient(from 225deg,rgba(255,255,255,.18) 0 2deg,transparent 2deg 34deg);-webkit-mask:radial-gradient(circle,transparent 67%,#000 69%);mask:radial-gradient(circle,transparent 67%,#000 69%);opacity:.48}",
      ".tl-ref-gauge-center{position:relative;z-index:2;text-align:center;line-height:1}",
      ".tl-ref-gauge-bias{display:block;font-size:10px;font-weight:800;letter-spacing:.7px;color:var(--tl-sentiment);margin-bottom:5px}",
      ".tl-ref-gauge-score{display:block;font-size:38px;font-weight:700;color:#fff;text-shadow:0 0 13px rgba(255,255,255,.18)}",
      ".tl-ref-gauge-max{display:block;font-size:12px;color:#7f8ba8;margin-top:4px}",
      ".tl-ref-sentiment-caption{font-size:10px;color:#8290ad;margin-top:4px;text-align:center}",
      ".tl-ref-spark{width:100%;height:30px;margin-top:7px;overflow:visible}",
      ".tl-ref-spark path{fill:none;stroke:var(--tl-sentiment);stroke-width:1.7;filter:drop-shadow(0 0 4px rgba(34,211,238,.35))}",
      ".tl-ref-movers-card .mover{display:grid!important;grid-template-columns:minmax(0,1fr) auto 16px!important;align-items:center!important;gap:6px!important;border:1px solid rgba(80,123,194,.18)!important;border-radius:9px!important;background:rgba(7,14,31,.66)!important;padding:10px 9px!important;margin:0 0 7px!important;min-height:42px!important}",
      ".tl-ref-movers-card .sym{font-size:11px!important;font-weight:800!important;color:#f4f8ff!important}",
      ".tl-ref-movers-card .pct{font-size:11px!important;font-weight:800!important;white-space:nowrap!important}",
      ".tl-ref-movers-card .pct.pos{color:#4adea4!important}.tl-ref-movers-card .pct.neg{color:#ff5f75!important}",
      ".tl-ref-arrow{font-size:15px;line-height:1;font-weight:800}.tl-ref-arrow.pos{color:#4adea4}.tl-ref-arrow.neg{color:#ff5f75}.tl-ref-arrow.flat{color:#75819c}",
      ".tl-ref-movers-card .tl-ref-movers-footer{font-size:7.5px!important;letter-spacing:.7px!important;color:#53607a!important;text-align:center!important;margin-top:5px!important}",
      ".tl-ref-movers-spark{width:100%;height:24px;margin-top:4px}.tl-ref-movers-spark path{fill:none;stroke:#2563eb;stroke-width:1.2;opacity:.8}",
      ".tl-ref-zones-card .zr{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:center!important;min-height:38px!important;padding:0 11px!important;border:1px solid rgba(80,123,194,.11)!important;border-radius:8px!important;background:rgba(5,12,28,.56)!important;margin-bottom:5px!important}",
      ".tl-ref-zones-card .zr .lbl{font-size:10px!important;letter-spacing:.45px!important}.tl-ref-zones-card .zr .val{font-size:11px!important;font-weight:700!important}",
      ".tl-ref-zones-card .tl-ref-current-row{border-color:#51a8ff!important;background:linear-gradient(90deg,rgba(0,106,255,.34),rgba(58,62,255,.20))!important;box-shadow:0 0 12px rgba(37,99,235,.28),inset 0 0 15px rgba(34,211,238,.08)!important}",
      ".tl-ref-zones-card .tl-ref-current-row .lbl,.tl-ref-zones-card .tl-ref-current-row .val{color:#6edcff!important}",
      ".tl-ref-zones-card .tl-ref-support .lbl,.tl-ref-zones-card .tl-ref-support .val{color:#ff5a69!important}",
      ".tl-ref-briefing .tl-native-settings{display:none!important}",
      ".tl-ref-briefing .tl-native-actions{justify-content:flex-start!important}",
      ".tl-ref-briefing .tl-option-b-orb{cursor:pointer!important}",
      ".tl-ref-briefing .tl-native-title{font-size:14px!important;letter-spacing:1.8px!important}",
      ".tl-ref-briefing .tl-native-summary{font-size:11.5px!important;line-height:1.45!important}",
      ".tl-ref-briefing .tl-native-focus{font-size:10px!important;line-height:1.42!important}",
      "@media(max-width:360px){.tl-ref-sentiment-card,.tl-ref-movers-card{padding:11px!important}.tl-ref-gauge{width:136px;height:136px}.tl-ref-movers-card .mover{padding:9px 8px!important}.tl-ref-zones-card .zr{min-height:35px!important}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function readMovers(){
    var out={};
    var rows=document.querySelectorAll(".mover");
    for(var i=0;i<rows.length;i++){
      var symbol=rows[i].querySelector(".sym");
      var value=rows[i].querySelector(".pct");
      if(!symbol||!value)continue;
      var parsed=parseNumber(value.textContent);
      if(parsed!==null)out[norm(symbol.textContent)]=parsed;
    }
    return out;
  }

  function sentimentScore(movers){
    var gold=movers.XAUUSD;
    if(gold!==undefined)return Math.max(0,Math.min(100,Math.round(50+35*Math.tanh(gold/1.25))));
    var keys=Object.keys(movers);
    if(!keys.length)return 50;
    var avg=keys.reduce(function(sum,key){return sum+movers[key];},0)/keys.length;
    return Math.max(0,Math.min(100,Math.round(50+30*Math.tanh(avg/1.4))));
  }

  function biasView(score){
    if(score<=24)return{label:"STARK BÄRISCH",caption:"Stark bärisches Umfeld",color:"#ff5a69"};
    if(score<40)return{label:"BÄRISCH",caption:"Bärisches Umfeld",color:"#ff6b7d"};
    if(score<60)return{label:"NEUTRAL",caption:"Ausgeglichenes Umfeld",color:"#22d3ee"};
    if(score<76)return{label:"BULLISCH",caption:"Bullisches Umfeld",color:"#48e0aa"};
    return{label:"STARK BULLISCH",caption:"Stark bullisches Umfeld",color:"#4adea4"};
  }

  function sparkPath(values,width,height){
    if(!values.length)values=[0,0,0,0];
    var points=[];
    var expanded=[];
    for(var i=0;i<values.length;i++){
      expanded.push(values[i]);
      if(i<values.length-1){
        expanded.push((values[i]*2+values[i+1])/3);
        expanded.push((values[i]+values[i+1]*2)/3);
      }
    }
    var min=Math.min.apply(null,expanded),max=Math.max.apply(null,expanded);
    if(max===min){max=min+1;}
    for(var j=0;j<expanded.length;j++){
      var x=(j/(expanded.length-1))*width;
      var y=height-4-((expanded[j]-min)/(max-min))*(height-8);
      points.push((j===0?"M":"L")+x.toFixed(1)+" "+y.toFixed(1));
    }
    return points.join(" ");
  }

  function ensureSentiment(card){
    if(!card)return;
    card.classList.add("tl-ref-sentiment-card");
    if(!card.querySelector(".tl-ref-sentiment-wrap")){
      card.innerHTML="<div class='tl-ref-card-title'>MARKT SENTIMENT</div><div class='tl-ref-sentiment-wrap'><div class='tl-ref-gauge'><div class='tl-ref-gauge-center'><span class='tl-ref-gauge-bias'>NEUTRAL</span><strong class='tl-ref-gauge-score'>50</strong><span class='tl-ref-gauge-max'>/100</span></div></div><div class='tl-ref-sentiment-caption'>Ausgeglichenes Umfeld</div><svg class='tl-ref-spark' viewBox='0 0 220 30' preserveAspectRatio='none'><path d='M0 15 L220 15'></path></svg></div>";
    }
  }

  function updateSentiment(card,movers){
    ensureSentiment(card);
    if(!card)return;
    var score=sentimentScore(movers);
    var view=biasView(score);
    var gauge=card.querySelector(".tl-ref-gauge");
    var bias=card.querySelector(".tl-ref-gauge-bias");
    var number=card.querySelector(".tl-ref-gauge-score");
    var caption=card.querySelector(".tl-ref-sentiment-caption");
    var path=card.querySelector(".tl-ref-spark path");
    if(gauge){gauge.style.setProperty("--tl-score-angle",(score*2.7)+"deg");gauge.style.setProperty("--tl-sentiment",view.color);}
    card.style.setProperty("--tl-sentiment",view.color);
    if(bias)bias.textContent=view.label;
    if(number)number.textContent=score;
    if(caption)caption.textContent=view.caption;
    if(path)path.setAttribute("d",sparkPath(moverLabels.map(function(label){return movers[label]===undefined?0:movers[label];}),220,30));
  }

  function decorateMovers(card,movers){
    if(!card)return;
    card.classList.add("tl-ref-movers-card");
    var rows=card.querySelectorAll(".mover");
    for(var i=0;i<rows.length;i++){
      var symbol=rows[i].querySelector(".sym");
      var value=rows[i].querySelector(".pct");
      if(!symbol||!value)continue;
      var parsed=parseNumber(value.textContent);
      var arrow=rows[i].querySelector(".tl-ref-arrow");
      if(!arrow){arrow=document.createElement("span");arrow.className="tl-ref-arrow";rows[i].appendChild(arrow);}
      arrow.className="tl-ref-arrow "+(parsed>0?"pos":parsed<0?"neg":"flat");
      arrow.textContent=parsed>0?"↗":parsed<0?"↘":"→";
    }
    var leaves=card.querySelectorAll("*");
    for(var j=0;j<leaves.length;j++){
      if(leaves[j].children.length===0&&norm(leaves[j].textContent).indexOf("TAGESVERANDERUNG")===0)leaves[j].classList.add("tl-ref-movers-footer");
    }
    if(!card.querySelector(".tl-ref-movers-spark")){
      var svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
      svg.setAttribute("class","tl-ref-movers-spark");svg.setAttribute("viewBox","0 0 220 24");svg.setAttribute("preserveAspectRatio","none");
      var path=document.createElementNS("http://www.w3.org/2000/svg","path");svg.appendChild(path);card.appendChild(svg);
    }
    var moverPath=card.querySelector(".tl-ref-movers-spark path");
    if(moverPath)moverPath.setAttribute("d",sparkPath(moverLabels.map(function(label){return movers[label]===undefined?0:movers[label];}),220,24));
  }

  function decorateZones(card){
    if(!card)return;
    card.classList.add("tl-ref-zones-card");
    var title=leafByText("WICHTIGE ZONEN",true);
    if(title&&card.contains(title))title.textContent="WICHTIGE ZONEN – XAUUSD";
    var rows=card.querySelectorAll(".zr");
    for(var i=0;i<rows.length;i++){
      rows[i].classList.remove("tl-ref-current-row","tl-ref-support");
      var label=rows[i].querySelector(".lbl");
      var text=label?norm(label.textContent):norm(rows[i].textContent);
      if(text.indexOf("AKTUELLER PREIS")>=0)rows[i].classList.add("tl-ref-current-row");
      if(text.indexOf("UNTERSTUTZUNG")>=0)rows[i].classList.add("tl-ref-support");
    }
  }

  function decorateBriefing(card){
    if(!card)return;
    card.classList.add("tl-ref-briefing");
    var gear=card.querySelector(".tl-native-settings");
    var orb=card.querySelector(".tl-option-b-orb");
    if(gear&&orb&&!orb.getAttribute("data-settings-bound")){
      orb.setAttribute("data-settings-bound","true");
      orb.setAttribute("role","button");
      orb.setAttribute("aria-label","Daily Briefing Einstellungen");
      orb.addEventListener("click",function(){gear.click();});
    }
  }

  function run(){
    ensureStyles();
    var briefing=document.querySelector(".briefing")||cardFromHeading("AI DAILY BRIEFING",false);
    var sentiment=cardFromHeading("MARKT SENTIMENT",false);
    var moversCard=cardFromHeading("TOP MOVERS",false);
    var zones=cardFromHeading("WICHTIGE ZONEN",true);
    var movers=readMovers();

    decorateBriefing(briefing);
    updateSentiment(sentiment,movers);
    decorateMovers(moversCard,movers);
    decorateZones(zones);

    if(sentiment&&moversCard&&sentiment.parentElement===moversCard.parentElement)sentiment.parentElement.classList.add("tl-ref-market-grid");
  }

  function start(){
    run();
    clearInterval(timer);
    timer=setInterval(run,900);
    setTimeout(function(){clearInterval(timer);timer=setInterval(run,4000);},30000);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();
