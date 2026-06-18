(function(){
  "use strict";

  var target=null;
  var PREF_KEY="tradelens_daily_briefing_market_v2";
  var OPTIONS=[
    {value:"XAUUSD",label:"Gold"},
    {value:"NAS100",label:"NAS100"},
    {value:"EURUSD",label:"EURUSD"},
    {value:"BTCUSD",label:"Bitcoin"},
    {value:"MARKET",label:"Gesamtmarkt"}
  ];

  function norm(value){
    var text=String(value||"").toUpperCase();
    try{text=text.normalize("NFD").replace(/[\u0300-\u036f]/g,"");}catch(e){}
    return text.replace(/[–—]/g,"-").replace(/\s+/g," ").trim();
  }

  function dateText(){
    return new Intl.DateTimeFormat("de-DE",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(new Date());
  }

  function getMarket(){
    try{
      var value=localStorage.getItem(PREF_KEY)||"XAUUSD";
      return OPTIONS.some(function(item){return item.value===value;})?value:"XAUUSD";
    }catch(e){return"XAUUSD";}
  }

  function setMarket(value){
    try{localStorage.setItem(PREF_KEY,value);}catch(e){}
    render();
  }

  function findTarget(){
    if(target&&document.body.contains(target))return target;

    var direct=document.querySelector(".briefing");
    if(direct){
      var directText=norm(direct.textContent);
      if(directText.indexOf("AI DAILY BRIEFING")>=0||directText.indexOf("NICHT VERBUNDEN")>=0||directText.indexOf("MARKTUBERBLICK")>=0){
        target=direct;
        return target;
      }
    }

    var nodes=document.querySelectorAll("h1,h2,h3,div,span,p,a,button");
    for(var i=0;i<nodes.length;i++){
      if(nodes[i].children.length!==0)continue;
      var text=norm(nodes[i].textContent);
      if(text!=="AI DAILY BRIEFING"&&text!=="NICHT VERBUNDEN"&&text!=="MARKTUBERBLICK")continue;

      var node=nodes[i].parentElement;
      while(node&&node!==document.body){
        var allText=norm(node.textContent);
        if(allText.indexOf("AI DAILY BRIEFING")>=0&&allText.indexOf("ANALYSE STARTEN")>=0&&allText.indexOf("TOP MOVERS")<0){
          target=node;
          return target;
        }
        node=node.parentElement;
      }
    }
    return null;
  }

  function ensureStyles(){
    if(document.getElementById("tl-native-briefing-style"))return;
    var style=document.createElement("style");
    style.id="tl-native-briefing-style";
    style.textContent=[
      ".tl-native-briefing{position:relative;overflow:hidden}",
      ".tl-reference-main{display:grid;grid-template-columns:minmax(0,1fr) 116px;gap:13px;align-items:center;min-height:154px}",
      ".tl-reference-copy{min-width:0;position:relative;z-index:2}",
      ".tl-native-title{font-family:var(--f-disp);font-size:15px;font-weight:800;letter-spacing:2px;color:#f8fafc;line-height:1.2}",
      ".tl-native-date{font-size:10.5px;color:var(--txt-3);margin-top:5px}",
      ".tl-native-kicker{display:flex;align-items:center;gap:7px;margin-top:15px;font-size:9px;font-weight:800;letter-spacing:1.35px;color:var(--cyan);text-transform:uppercase}",
      ".tl-native-kicker:before{content:'';width:14px;height:1px;background:linear-gradient(90deg,var(--cyan),rgba(34,247,255,0));box-shadow:0 0 7px rgba(34,247,255,.85)}",
      ".tl-native-summary{margin-top:7px;font-size:12.5px;line-height:1.5;color:#dbeafe;max-width:100%}",
      ".tl-native-focus{margin-top:7px;font-size:10.5px;line-height:1.45;color:var(--txt-2);max-width:100%}",
      ".tl-reference-visual{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:146px;z-index:1}",
      ".tl-reference-visual:before{content:'';position:absolute;inset:12px -8px 4px;background:radial-gradient(circle at 50% 48%,rgba(34,247,255,.16),rgba(37,99,235,.08) 38%,transparent 70%);filter:blur(4px)}",
      ".tl-native-status{position:absolute;top:0;right:0;font-size:7.5px;font-weight:800;letter-spacing:.7px;color:var(--green-2);border:1px solid rgba(34,197,94,.26);background:rgba(5,18,28,.76);border-radius:999px;padding:4px 6px;white-space:nowrap;backdrop-filter:blur(8px)}",
      ".tl-native-status.wait{color:var(--gold);border-color:rgba(255,200,87,.28)}",
      ".tl-ai-orb{position:relative;width:96px;height:96px;border-radius:50%;margin-top:7px;filter:drop-shadow(0 0 11px rgba(34,247,255,.42)) drop-shadow(0 0 24px rgba(139,92,246,.22));animation:tlOrbFloat 4.2s ease-in-out infinite}",
      ".tl-ai-orb:before{content:'';position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 40deg,rgba(34,247,255,.02),rgba(34,247,255,.92),rgba(37,99,235,.2),rgba(139,92,246,.82),rgba(34,247,255,.04));-webkit-mask:radial-gradient(circle,transparent 57%,#000 59%);mask:radial-gradient(circle,transparent 57%,#000 59%);animation:tlOrbSpin 8s linear infinite}",
      ".tl-ai-orb:after{content:'';position:absolute;inset:13px;border-radius:50%;background:radial-gradient(circle at 38% 32%,rgba(255,255,255,.95) 0 2%,rgba(34,247,255,.88) 5%,rgba(13,148,136,.32) 17%,rgba(30,64,175,.34) 38%,rgba(6,10,28,.96) 70%);box-shadow:inset 0 0 18px rgba(34,247,255,.55),inset -10px -8px 22px rgba(139,92,246,.45),0 0 18px rgba(34,247,255,.48)}",
      ".tl-orb-ring,.tl-orb-ring:before,.tl-orb-ring:after{position:absolute;content:'';border-radius:50%;border:1px solid rgba(34,247,255,.32)}",
      ".tl-orb-ring{inset:5px;transform:rotateX(65deg);box-shadow:0 0 8px rgba(34,247,255,.28)}",
      ".tl-orb-ring:before{inset:9px;transform:rotateY(63deg);border-color:rgba(139,92,246,.38)}",
      ".tl-orb-ring:after{inset:18px;border-color:rgba(255,255,255,.22)}",
      ".tl-orb-core{position:absolute;left:50%;top:50%;width:12px;height:12px;transform:translate(-50%,-50%);border-radius:50%;background:#dfffff;box-shadow:0 0 8px #fff,0 0 17px var(--cyan),0 0 30px #2563eb;z-index:3}",
      ".tl-orb-meta{position:relative;z-index:2;display:flex;align-items:center;justify-content:center;gap:4px;margin-top:6px;font-size:8px;color:var(--txt-3);text-align:center;white-space:nowrap}",
      ".tl-orb-meta .pos{color:var(--green-2)}",
      ".tl-orb-meta .neg{color:var(--red)}",
      ".tl-level-line{position:relative;z-index:2;margin-top:3px;text-align:center;line-height:1.15}",
      ".tl-native-level-label{display:block;font-size:7px;letter-spacing:.8px;text-transform:uppercase;color:var(--txt-3)}",
      ".tl-native-level-value{display:block;margin-top:2px;font-size:10px;color:#f8fafc}",
      ".tl-native-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:9px;position:relative;z-index:3}",
      ".tl-native-analyse,.tl-native-settings{border:0;background:transparent;color:var(--cyan);font-size:11px;font-weight:800;padding:3px 0;cursor:pointer}",
      ".tl-native-settings{width:28px;height:28px;border:1px solid rgba(96,165,250,.22);border-radius:8px;background:rgba(8,15,34,.72);font-size:14px;color:#cbd5e1}",
      ".tl-native-overlay{position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.84);display:flex;align-items:flex-end;padding:16px}",
      ".tl-native-sheet{width:100%;background:#071020;border:1px solid rgba(96,165,250,.28);border-radius:18px;padding:18px;box-shadow:0 -20px 60px rgba(2,6,23,.55)}",
      ".tl-native-options{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:14px}",
      ".tl-native-option{padding:12px;border-radius:12px;border:1px solid rgba(96,165,250,.18);background:rgba(8,15,34,.78);color:#dbeafe;font-weight:700}",
      ".tl-native-option.active{border-color:var(--cyan);color:var(--cyan);box-shadow:0 0 16px rgba(34,247,255,.08)}",
      ".tl-native-close{width:100%;margin-top:12px;padding:11px;border:0;border-radius:11px;background:rgba(0,229,255,.12);color:var(--cyan);font-weight:700}",
      "@keyframes tlOrbSpin{to{transform:rotate(360deg)}}",
      "@keyframes tlOrbFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}",
      "@media(max-width:360px){.tl-reference-main{grid-template-columns:minmax(0,1fr) 104px;gap:9px}.tl-ai-orb{width:86px;height:86px}.tl-native-title{font-size:14px;letter-spacing:1.6px}.tl-native-summary{font-size:12px}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function openAnalysis(){
    var items=document.querySelectorAll("button,a,[role='button'],.nav-item,.tab");
    for(var i=0;i<items.length;i++){
      if(norm(items[i].textContent)==="ANALYSE"){items[i].click();return;}
    }
  }

  function openSettings(){
    var old=document.querySelector(".tl-native-overlay");
    if(old)old.remove();
    var overlay=document.createElement("div");
    overlay.className="tl-native-overlay";
    var selected=getMarket();
    overlay.innerHTML="<div class='tl-native-sheet'><div class='tl-native-title'>Daily Briefing Einstellungen</div><div class='tl-native-date'>Wähle den Markt für dein tägliches Briefing. Standard ist Gold.</div><div class='tl-native-options'>"+OPTIONS.map(function(item){return"<button class='tl-native-option"+(item.value===selected?" active":"")+"' data-value='"+item.value+"'>"+item.label+"</button>";}).join("")+"</div><button class='tl-native-close'>Fertig</button></div>";
    document.body.appendChild(overlay);
    overlay.addEventListener("click",function(event){
      var option=event.target.closest&&event.target.closest(".tl-native-option");
      if(option){setMarket(option.getAttribute("data-value"));overlay.remove();return;}
      if(event.target===overlay||event.target.classList.contains("tl-native-close"))overlay.remove();
    });
  }

  function render(){
    var box=findTarget();
    if(!box)return;
    ensureStyles();

    var selected=getMarket();
    var names={XAUUSD:"GOLD",NAS100:"NASDAQ 100",EURUSD:"EURUSD",BTCUSD:"BITCOIN",MARKET:"GESAMTMARKT"};

    box.innerHTML="<div class='tl-native-briefing'><div class='tl-reference-main'><div class='tl-reference-copy'><div class='tl-native-title'>AI DAILY BRIEFING</div><div class='tl-native-date'>"+dateText()+"</div><div class='tl-native-kicker'>Marktüberblick</div><div class='tl-native-summary'>Die Live-Daten für dein ausgewähltes Briefing werden geladen.</div><div class='tl-native-focus'>Sobald die Marktdaten verfügbar sind, wird der Marktüberblick automatisch aktualisiert.</div></div><div class='tl-reference-visual'><div class='tl-native-status wait'>"+names[selected]+" · WIRD GELADEN</div><div class='tl-ai-orb'><span class='tl-orb-ring'></span><span class='tl-orb-core'></span></div><div class='tl-orb-meta'><span class='tl-native-bias'>Wird geladen</span><span>•</span><span class='tl-native-momentum'>M15</span></div><div class='tl-level-line'><span class='tl-native-level-label'>Nächstes Level</span><strong class='tl-native-level-value'>—</strong></div></div></div><div class='tl-native-actions'><button class='tl-native-analyse' type='button'>Analyse starten ›</button><button class='tl-native-settings' type='button' aria-label='Daily Briefing Einstellungen'>⚙</button></div></div>";

    var analyse=box.querySelector(".tl-native-analyse");
    if(analyse)analyse.addEventListener("click",openAnalysis);
    var settings=box.querySelector(".tl-native-settings");
    if(settings)settings.addEventListener("click",openSettings);
  }

  function start(){
    render();
    setTimeout(render,450);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();
