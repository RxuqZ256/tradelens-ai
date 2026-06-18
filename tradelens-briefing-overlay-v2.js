(function(){
  "use strict";

  var frame=document.getElementById("app");
  var timer=null;
  var target=null;
  var PREF_KEY="tradelens_daily_briefing_market_v1";
  var OPTIONS=[
    {value:"XAUUSD",label:"Gold"},
    {value:"NAS100",label:"NAS100"},
    {value:"EURUSD",label:"EURUSD"},
    {value:"BTCUSD",label:"Bitcoin"},
    {value:"MARKET",label:"Gesamtmarkt"}
  ];

  function doc(){
    try{return frame&&(frame.contentDocument||frame.contentWindow.document);}catch(e){return null;}
  }

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

  function dateText(){
    return new Intl.DateTimeFormat("de-DE",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(new Date());
  }

  function currentMarket(){
    try{
      var value=frame.contentWindow.localStorage.getItem(PREF_KEY)||"XAUUSD";
      return OPTIONS.some(function(item){return item.value===value;})?value:"XAUUSD";
    }catch(e){return"XAUUSD";}
  }

  function saveMarket(value){
    try{frame.contentWindow.localStorage.setItem(PREF_KEY,value);}catch(e){}
    render();
  }

  function findTarget(d){
    if(target&&d.body.contains(target))return target;
    var existing=d.querySelector("[data-tl-briefing-target='true']");
    if(existing){target=existing;return target;}

    var nodes=d.querySelectorAll("h1,h2,h3,div,span,p,a,button");
    for(var i=0;i<nodes.length;i++){
      if(nodes[i].children.length!==0)continue;
      var text=norm(nodes[i].textContent);
      if(text==="AI DAILY BRIEFING"||text==="NICHT VERBUNDEN"||text==="MARKTUBERBLICK"){
        var card=nodes[i].closest?nodes[i].closest(".gf,.card"):null;
        if(card){
          target=card.querySelector(".in")||card;
          target.setAttribute("data-tl-briefing-target","true");
          return target;
        }
      }
    }
    return null;
  }

  function readMovers(d){
    var result={};
    var rows=d.querySelectorAll(".mover");
    for(var i=0;i<rows.length;i++){
      var symbol=rows[i].querySelector(".sym");
      var value=rows[i].querySelector(".pct");
      if(!symbol||!value)continue;
      var parsed=parse(value.textContent);
      if(parsed!==null)result[norm(symbol.textContent)]=parsed;
    }
    return result;
  }

  function readZones(d){
    var result={};
    var rows=d.querySelectorAll(".zr");
    for(var i=0;i<rows.length;i++){
      var label=rows[i].querySelector(".lbl");
      var value=rows[i].querySelector(".val");
      if(!label||!value)continue;
      var parsed=parse(value.textContent);
      if(parsed!==null)result[norm(label.textContent)]=parsed;
    }
    return result;
  }

  function ensureStyles(d){
    if(d.getElementById("tl-briefing-overlay-v2-style"))return;
    var style=d.createElement("style");
    style.id="tl-briefing-overlay-v2-style";
    style.textContent=[
      ".tl-bo{display:flex;flex-direction:column;gap:11px}",
      ".tl-bo-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}",
      ".tl-bo-title{font-family:var(--f-disp);font-size:15px;font-weight:700;letter-spacing:1.7px;color:#f8fafc}",
      ".tl-bo-date{font-size:11.5px;color:var(--txt-2);margin-top:3px}",
      ".tl-bo-status{font-size:9px;font-weight:700;color:var(--green);border:1px solid rgba(34,197,94,.34);background:rgba(34,197,94,.08);border-radius:999px;padding:5px 8px;white-space:nowrap}",
      ".tl-bo-status.wait{color:var(--gold);border-color:rgba(255,200,87,.34);background:rgba(255,200,87,.08)}",
      ".tl-bo-summary{font-size:13px;line-height:1.5;color:#dbeafe}",
      ".tl-bo-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}",
      ".tl-bo-card{min-width:0;border:1px solid rgba(96,165,250,.16);background:rgba(8,15,34,.68);border-radius:11px;padding:8px}",
      ".tl-bo-card small{display:block;font-size:8px;color:var(--txt-3);text-transform:uppercase;white-space:nowrap}",
      ".tl-bo-card strong{display:block;font-size:12px;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".tl-bo-card strong.pos{color:var(--green-2)}",
      ".tl-bo-card strong.neg{color:var(--red)}",
      ".tl-bo-focus{border-left:2px solid var(--cyan);background:linear-gradient(90deg,rgba(0,229,255,.08),transparent);padding:8px 9px;font-size:12px;line-height:1.43;color:var(--txt-2)}",
      ".tl-bo-actions{display:flex;align-items:center;justify-content:space-between;gap:8px}",
      ".tl-bo-analyse,.tl-bo-settings{border:0;background:transparent;color:var(--cyan);font-size:11px;font-weight:700;padding:3px 0;cursor:pointer}",
      ".tl-bo-settings{width:32px;height:32px;border:1px solid rgba(96,165,250,.24);border-radius:9px;background:rgba(8,15,34,.72);font-size:16px}",
      ".tl-bo-overlay{position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.82);display:flex;align-items:flex-end;padding:16px}",
      ".tl-bo-sheet{width:100%;background:#071020;border:1px solid rgba(96,165,250,.28);border-radius:18px;padding:18px}",
      ".tl-bo-options{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:14px}",
      ".tl-bo-option{padding:12px;border-radius:12px;border:1px solid rgba(96,165,250,.18);background:rgba(8,15,34,.78);color:#dbeafe;font-weight:700}",
      ".tl-bo-option.active{border-color:var(--cyan);color:var(--cyan)}",
      ".tl-bo-close{width:100%;margin-top:12px;padding:11px;border:0;border-radius:11px;background:rgba(0,229,255,.12);color:var(--cyan);font-weight:700}"
    ].join("\n");
    d.head.appendChild(style);
  }

  function openAnalysis(d){
    var items=d.querySelectorAll("button,a,[role='button'],.nav-item,.tab");
    for(var i=0;i<items.length;i++){
      if(norm(items[i].textContent)==="ANALYSE"){items[i].click();return;}
    }
  }

  function openSettings(d){
    var old=d.querySelector(".tl-bo-overlay");if(old)old.remove();
    var overlay=d.createElement("div");overlay.className="tl-bo-overlay";
    var selected=currentMarket();
    overlay.innerHTML="<div class='tl-bo-sheet'><div class='tl-bo-title'>Daily Briefing Einstellungen</div><div class='tl-bo-date'>Wähle den Markt für dein tägliches Briefing. Standard ist Gold.</div><div class='tl-bo-options'>"+OPTIONS.map(function(item){return"<button class='tl-bo-option"+(item.value===selected?" active":"")+"' data-value='"+item.value+"'>"+item.label+"</button>";}).join("")+"</div><button class='tl-bo-close'>Fertig</button></div>";
    d.body.appendChild(overlay);
    overlay.addEventListener("click",function(event){
      var option=event.target.closest&&event.target.closest(".tl-bo-option");
      if(option){saveMarket(option.getAttribute("data-value"));overlay.remove();return;}
      if(event.target===overlay||event.target.classList.contains("tl-bo-close"))overlay.remove();
    });
  }

  function render(){
    var d=doc();if(!d||!d.body||!d.head)return;
    var box=findTarget(d);if(!box)return;
    ensureStyles(d);

    var market=currentMarket();
    var labels={XAUUSD:"GOLD",NAS100:"NASDAQ 100",EURUSD:"EURUSD",BTCUSD:"BITCOIN",MARKET:"GESAMTMARKT"};
    var movers=readMovers(d);
    var zones=readZones(d);
    var view={ready:false,status:labels[market]+" · WIRD GELADEN",summary:"Die Live-Daten für dein ausgewähltes Daily Briefing werden geladen.",bias:"Wird geladen",biasClass:"",momentum:"Wird geladen",momentumClass:"",levelLabel:"Zeitrahmen",levelValue:"M15",focus:"Sobald die Marktdaten verfügbar sind, wird das Briefing automatisch aktualisiert."};

    if(market==="XAUUSD"){
      var change=movers.XAUUSD;
      var current=zones["AKTUELLER PREIS"],r1=zones["WIDERSTAND 1"],r2=zones["WIDERSTAND 2"],s1=zones["UNTERSTUTZUNG 1"],s2=zones["UNTERSTUTZUNG 2"];
      if(change!==undefined||current!==undefined){
        view.status="GOLD · M15 LIVE";
        view.ready=change!==undefined&&current!==undefined&&r1!==undefined&&r2!==undefined&&s1!==undefined&&s2!==undefined;
        if(change!==undefined){
          view.bias=change>0.01?"Bullisch":change<-0.01?"Bärisch":"Neutral";
          view.biasClass=change>0.01?"pos":change<-0.01?"neg":"";
          view.momentum=Math.abs(change)>=0.15?"Stark":Math.abs(change)>=0.05?"Moderat":"Ruhig";
          view.momentumClass=view.biasClass;
        }
        view.levelLabel="Nächstes Level";
        view.levelValue="—";
        view.summary="Gold"+(current!==undefined?" steht aktuell bei "+formatPrice(current):"")+(change!==undefined?" und bewegt sich im M15 um "+formatPercent(change):"")+".";
        if(current!==undefined&&r1!==undefined&&r2!==undefined&&s1!==undefined&&s2!==undefined){
          if(current>r1){view.bias="Bullisch";view.biasClass="pos";view.levelValue=formatPrice(r2);view.focus="Gold notiert über Widerstand 1. Der nächste technische Zielbereich liegt bei "+formatPrice(r2)+".";}
          else if(current<s1){view.bias="Bärisch";view.biasClass="neg";view.levelValue=formatPrice(s2);view.focus="Gold handelt unter Unterstützung 1. Die nächste technische Zielzone liegt bei "+formatPrice(s2)+".";}
          else if(change!==undefined&&change>=0){view.levelValue=formatPrice(r1);view.focus="Gold handelt innerhalb der Range. Bei positivem Momentum ist Widerstand 1 bei "+formatPrice(r1)+" entscheidend.";}
          else{view.levelValue=formatPrice(s1);view.focus="Gold handelt innerhalb der Range. Bei negativem Momentum ist Unterstützung 1 bei "+formatPrice(s1)+" entscheidend.";}
        }
      }
    }else if(market==="MARKET"){
      var keys=Object.keys(movers);
      if(keys.length){
        var positives=keys.filter(function(key){return movers[key]>0;}).length;
        var strongest=keys[0];
        for(var i=1;i<keys.length;i++)if(Math.abs(movers[keys[i]])>Math.abs(movers[strongest]))strongest=keys[i];
        var average=keys.reduce(function(sum,key){return sum+movers[key];},0)/keys.length;
        view.ready=keys.length===4;view.status=view.ready?"GESAMTMARKT · LIVE":"GESAMTMARKT · "+keys.length+"/4";view.summary=positives+" von "+keys.length+" geladenen Märkten handeln positiv. "+strongest+" zeigt mit "+formatPercent(movers[strongest])+" die stärkste M15-Bewegung.";view.bias=average>0.01?"Bullisch":average<-0.01?"Bärisch":"Neutral";view.biasClass=average>0.01?"pos":average<-0.01?"neg":"";view.momentum=strongest;view.momentumClass=movers[strongest]>=0?"pos":"neg";view.levelLabel="Geladen";view.levelValue=keys.length+"/4";view.focus="Der Gesamtmarkt-Modus vergleicht Gold, NAS100, EURUSD und Bitcoin anhand ihrer aktuellen M15-Bewegung.";
      }
    }else{
      var selected=movers[market];
      if(selected!==undefined){
        view.ready=true;view.status=labels[market]+" · M15 LIVE";view.summary=labels[market]+" bewegt sich im aktuellen M15-Vergleich um "+formatPercent(selected)+".";view.bias=selected>0.01?"Bullisch":selected<-0.01?"Bärisch":"Neutral";view.biasClass=selected>0.01?"pos":selected<-0.01?"neg":"";view.momentum=Math.abs(selected)>=0.15?"Stark":Math.abs(selected)>=0.05?"Moderat":"Ruhig";view.momentumClass=view.biasClass;view.levelLabel="M15 Änderung";view.levelValue=formatPercent(selected);view.focus="Das Briefing bewertet die kurzfristige M15-Bewegung von "+labels[market]+". Weitere Preiszonen werden später ergänzt.";
      }
    }

    box.innerHTML="<div class='tl-bo'><div class='tl-bo-head'><div><div class='tl-bo-title'>AI DAILY BRIEFING · "+labels[market]+"</div><div class='tl-bo-date'>"+dateText()+"</div></div><span class='tl-bo-status "+(view.ready?"":"wait")+"'>"+view.status+"</span></div><div class='tl-bo-summary'>"+view.summary+"</div><div class='tl-bo-grid'><div class='tl-bo-card'><small>Bias</small><strong class='"+view.biasClass+"'>"+view.bias+"</strong></div><div class='tl-bo-card'><small>Momentum</small><strong class='"+view.momentumClass+"'>"+view.momentum+"</strong></div><div class='tl-bo-card'><small>"+view.levelLabel+"</small><strong>"+view.levelValue+"</strong></div></div><div class='tl-bo-focus'>"+view.focus+"</div><div class='tl-bo-actions'><button class='tl-bo-analyse' type='button'>Analyse starten ›</button><button class='tl-bo-settings' type='button' aria-label='Daily Briefing Einstellungen'>⚙</button></div></div>";
    var analyse=box.querySelector(".tl-bo-analyse");if(analyse)analyse.addEventListener("click",function(){openAnalysis(d);});
    var settings=box.querySelector(".tl-bo-settings");if(settings)settings.addEventListener("click",function(){openSettings(d);});
  }

  function start(){
    render();
    clearInterval(timer);
    timer=setInterval(render,1000);
    setTimeout(function(){clearInterval(timer);timer=setInterval(render,5000);},30000);
  }

  if(!frame)return;
  try{
    var d=doc();
    if(d&&d.readyState!=="loading")setTimeout(start,100);
    else frame.addEventListener("load",function(){setTimeout(start,100);},{once:true});
  }catch(e){frame.addEventListener("load",function(){setTimeout(start,100);},{once:true});}
})();
