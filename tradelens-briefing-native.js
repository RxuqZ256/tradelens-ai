(function(){
  "use strict";

  var target=null;
  var originalOrbSrc="";
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

  function captureOriginalOrb(box){
    if(originalOrbSrc||!box)return;

    var images=box.querySelectorAll("img");
    var best=null;
    var bestScore=0;
    for(var i=0;i<images.length;i++){
      var rect=images[i].getBoundingClientRect();
      var score=Math.max(rect.width*rect.height,(images[i].naturalWidth||0)*(images[i].naturalHeight||0));
      if(images[i].src&&score>bestScore){best=images[i];bestScore=score;}
    }
    if(best&&best.src){originalOrbSrc=best.src;return;}

    var nodes=box.querySelectorAll("*");
    for(var j=0;j<nodes.length;j++){
      var bg="";
      try{bg=getComputedStyle(nodes[j]).backgroundImage||"";}catch(e){}
      var match=bg.match(/^url\(["']?(.*?)["']?\)$/);
      if(match&&match[1]&&match[1]!=="none"){
        originalOrbSrc=match[1];
        return;
      }
    }
  }

  function escapeAttr(value){
    return String(value||"").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  function ensureStyles(){
    var old=document.getElementById("tl-native-briefing-style");
    if(old)old.remove();

    var style=document.createElement("style");
    style.id="tl-native-briefing-style";
    style.textContent=[
      ".tl-native-briefing{position:relative;overflow:hidden}",
      ".tl-reference-main{display:grid;grid-template-columns:minmax(0,1fr) 122px;gap:12px;align-items:center;min-height:166px}",
      ".tl-reference-copy{min-width:0;position:relative;z-index:2}",
      ".tl-native-title{font-family:var(--f-disp);font-size:15px;font-weight:800;letter-spacing:2px;color:#f8fafc;line-height:1.2}",
      ".tl-native-date{font-size:10.5px;color:var(--txt-3);margin-top:5px}",
      ".tl-native-kicker{display:flex;align-items:center;gap:7px;margin-top:15px;font-size:9px;font-weight:800;letter-spacing:1.35px;color:var(--cyan);text-transform:uppercase}",
      ".tl-native-kicker:before{content:'';width:14px;height:1px;background:linear-gradient(90deg,var(--cyan),rgba(34,247,255,0));box-shadow:0 0 7px rgba(34,247,255,.85)}",
      ".tl-native-summary{margin-top:7px;font-size:12.5px;line-height:1.5;color:#dbeafe;max-width:100%}",
      ".tl-native-focus{margin-top:7px;font-size:10.5px;line-height:1.45;color:var(--txt-2);max-width:100%}",
      ".tl-reference-visual{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:160px;z-index:1;overflow:visible}",
      ".tl-reference-visual:before{content:'';position:absolute;inset:8px -10px 0;background:radial-gradient(circle at 50% 47%,rgba(34,247,255,.14),rgba(37,99,235,.07) 38%,transparent 72%);filter:blur(10px)}",
      ".tl-native-status{position:absolute;top:0;right:0;font-size:7.5px;font-weight:800;letter-spacing:.7px;color:var(--green-2);border:1px solid rgba(34,197,94,.26);background:rgba(5,18,28,.78);border-radius:999px;padding:4px 6px;white-space:nowrap;backdrop-filter:blur(8px);z-index:9}",
      ".tl-native-status.wait{color:var(--gold);border-color:rgba(255,200,87,.28)}",

      ".tl-option-b-orb{position:relative;width:116px;height:118px;margin-top:8px;display:flex;align-items:center;justify-content:center;animation:tlOptionBFloat 5.8s ease-in-out infinite;isolation:isolate}",
      ".tl-option-b-glow{position:absolute;inset:16px;border-radius:50%;background:radial-gradient(circle,rgba(34,247,255,.30),rgba(59,130,246,.13) 52%,transparent 75%);filter:blur(15px);animation:tlOptionBGlow 4s ease-in-out infinite;z-index:0}",
      ".tl-option-b-core{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:3;filter:drop-shadow(0 0 8px rgba(34,247,255,.35)) drop-shadow(0 0 18px rgba(99,102,241,.18));transform:none!important;animation:none!important}",
      ".tl-option-b-fallback{position:absolute;left:50%;top:45%;width:72px;height:72px;transform:translate(-50%,-50%);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--f-disp);font-size:24px;font-weight:800;color:#fff;background:radial-gradient(circle at 35% 30%,#dfffff 0 4%,#22d3ee 8%,#1d4ed8 36%,#081229 72%);box-shadow:inset 0 0 20px rgba(34,247,255,.55),0 0 20px rgba(34,247,255,.36);z-index:2}",
      ".tl-option-b-orbits{position:absolute;inset:0;z-index:6;pointer-events:none}",
      ".tl-option-b-group{position:absolute;inset:0;transform-origin:50% 47%}",
      ".tl-option-b-group.g1{animation:tlOptionBSpin1 18s linear infinite}",
      ".tl-option-b-group.g2{animation:tlOptionBSpin2 25s linear infinite reverse}",
      ".tl-option-b-group.g3{animation:tlOptionBSpin3 14s linear infinite}",
      ".tl-option-b-ring{position:absolute;left:50%;top:47%;border-radius:50%;border:1px solid rgba(140,240,255,.42);box-shadow:0 0 8px rgba(34,247,255,.14);transform:translate(-50%,-50%)}",
      ".tl-option-b-ring.r1{width:103px;height:34px;transform:translate(-50%,-50%) rotate(12deg)}",
      ".tl-option-b-ring.r2{width:88px;height:26px;transform:translate(-50%,-50%) rotate(62deg);border-color:rgba(167,139,250,.38)}",
      ".tl-option-b-ring.r3{width:58px;height:94px;transform:translate(-50%,-50%) rotate(24deg);border-color:rgba(255,255,255,.18)}",
      ".tl-option-b-ring.r4{width:108px;height:22px;transform:translate(-50%,-50%) rotate(-18deg);border-style:dashed;border-color:rgba(34,247,255,.24)}",
      ".tl-option-b-ring.r5{width:78px;height:20px;transform:translate(-50%,-50%) rotate(110deg);border-color:rgba(201,255,255,.24)}",
      ".tl-option-b-ring.r6{width:96px;height:18px;transform:translate(-50%,-50%) rotate(148deg);border-color:rgba(34,211,238,.20)}",
      ".tl-option-b-dot{position:absolute;width:4px;height:4px;border-radius:50%;background:#efffff;box-shadow:0 0 7px #fff,0 0 13px rgba(34,247,255,.9)}",
      ".tl-option-b-dot.d1{left:13px;top:39px}",
      ".tl-option-b-dot.d2{right:14px;top:31px;width:3px;height:3px}",
      ".tl-option-b-dot.d3{left:31px;bottom:24px;width:3px;height:3px}",
      ".tl-option-b-dot.d4{right:29px;bottom:21px}",
      ".tl-option-b-dot.d5{left:55px;top:14px;width:3px;height:3px}",
      ".tl-option-b-base-glow{position:absolute;left:50%;bottom:5px;width:88px;height:15px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(ellipse at center,rgba(34,247,255,.40),rgba(37,99,235,.18) 54%,transparent 78%);filter:blur(6px);z-index:1}",

      ".tl-orb-meta{position:relative;z-index:7;display:flex;align-items:center;justify-content:center;gap:4px;margin-top:1px;font-size:8px;color:var(--txt-3);text-align:center;white-space:nowrap}",
      ".tl-orb-meta .pos{color:var(--green-2)}",
      ".tl-orb-meta .neg{color:var(--red)}",
      ".tl-level-line{position:relative;z-index:7;margin-top:3px;text-align:center;line-height:1.15}",
      ".tl-native-level-label{display:block;font-size:7px;letter-spacing:.8px;text-transform:uppercase;color:var(--txt-3)}",
      ".tl-native-level-value{display:block;margin-top:2px;font-size:10px;color:#f8fafc}",
      ".tl-native-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:9px;position:relative;z-index:8}",
      ".tl-native-analyse,.tl-native-settings{border:0;background:transparent;color:var(--cyan);font-size:11px;font-weight:800;padding:3px 0;cursor:pointer}",
      ".tl-native-settings{width:28px;height:28px;border:1px solid rgba(96,165,250,.22);border-radius:8px;background:rgba(8,15,34,.72);font-size:14px;color:#cbd5e1}",
      ".tl-native-overlay{position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.84);display:flex;align-items:flex-end;padding:16px}",
      ".tl-native-sheet{width:100%;background:#071020;border:1px solid rgba(96,165,250,.28);border-radius:18px;padding:18px;box-shadow:0 -20px 60px rgba(2,6,23,.55)}",
      ".tl-native-options{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:14px}",
      ".tl-native-option{padding:12px;border-radius:12px;border:1px solid rgba(96,165,250,.18);background:rgba(8,15,34,.78);color:#dbeafe;font-weight:700}",
      ".tl-native-option.active{border-color:var(--cyan);color:var(--cyan);box-shadow:0 0 16px rgba(34,247,255,.08)}",
      ".tl-native-close{width:100%;margin-top:12px;padding:11px;border:0;border-radius:11px;background:rgba(0,229,255,.12);color:var(--cyan);font-weight:700}",

      "@keyframes tlOptionBFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}",
      "@keyframes tlOptionBGlow{0%,100%{opacity:.66;transform:scale(.96)}50%{opacity:1;transform:scale(1.06)}}",
      "@keyframes tlOptionBSpin1{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}",
      "@keyframes tlOptionBSpin2{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}",
      "@keyframes tlOptionBSpin3{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}",
      "@media(prefers-reduced-motion:reduce){.tl-option-b-orb,.tl-option-b-glow,.tl-option-b-group{animation:none!important}}",
      "@media(max-width:360px){.tl-reference-main{grid-template-columns:minmax(0,1fr) 108px;gap:8px}.tl-option-b-orb{width:102px;height:106px}.tl-option-b-ring.r1{width:91px}.tl-option-b-ring.r4{width:96px}.tl-native-title{font-size:14px;letter-spacing:1.6px}.tl-native-summary{font-size:12px}}"
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
    captureOriginalOrb(box);
    ensureStyles();

    var selected=getMarket();
    var names={XAUUSD:"GOLD",NAS100:"NASDAQ 100",EURUSD:"EURUSD",BTCUSD:"BITCOIN",MARKET:"GESAMTMARKT"};
    var imageMarkup=originalOrbSrc?"<img class='tl-option-b-core' src=\""+escapeAttr(originalOrbSrc)+"\" alt='AI Orb'>":"<div class='tl-option-b-fallback'>AI</div>";

    box.innerHTML="<div class='tl-native-briefing'><div class='tl-reference-main'><div class='tl-reference-copy'><div class='tl-native-title'>AI DAILY BRIEFING</div><div class='tl-native-date'>"+dateText()+"</div><div class='tl-native-kicker'>Marktüberblick</div><div class='tl-native-summary'>Die Live-Daten für dein ausgewähltes Briefing werden geladen.</div><div class='tl-native-focus'>Sobald die Marktdaten verfügbar sind, wird der Marktüberblick automatisch aktualisiert.</div></div><div class='tl-reference-visual'><div class='tl-native-status wait'>"+names[selected]+" · WIRD GELADEN</div><div class='tl-option-b-orb'><span class='tl-option-b-glow'></span><span class='tl-option-b-base-glow'></span>"+imageMarkup+"<div class='tl-option-b-orbits'><div class='tl-option-b-group g1'><span class='tl-option-b-ring r1'></span><span class='tl-option-b-ring r3'></span><span class='tl-option-b-dot d1'></span><span class='tl-option-b-dot d3'></span></div><div class='tl-option-b-group g2'><span class='tl-option-b-ring r2'></span><span class='tl-option-b-ring r5'></span><span class='tl-option-b-dot d2'></span><span class='tl-option-b-dot d5'></span></div><div class='tl-option-b-group g3'><span class='tl-option-b-ring r4'></span><span class='tl-option-b-ring r6'></span><span class='tl-option-b-dot d4'></span></div></div></div><div class='tl-orb-meta'><span class='tl-native-bias'>Wird geladen</span><span>•</span><span class='tl-native-momentum'>M15</span></div><div class='tl-level-line'><span class='tl-native-level-label'>Nächstes Level</span><strong class='tl-native-level-value'>—</strong></div></div></div><div class='tl-native-actions'><button class='tl-native-analyse' type='button'>Analyse starten ›</button><button class='tl-native-settings' type='button' aria-label='Daily Briefing Einstellungen'>⚙</button></div></div>";

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
