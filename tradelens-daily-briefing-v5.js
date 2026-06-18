(function(){
  "use strict";
  var frame=document.getElementById("app");
  var key="tradelens_daily_briefing_market";
  var timer=null;
  var last="";

  function appDoc(){try{return frame&&(frame.contentDocument||frame.contentWindow.document);}catch(e){return null;}}
  function normalize(v){var s=String(v||"").toUpperCase();try{s=s.normalize("NFD").replace(/[\u0300-\u036f]/g,"");}catch(e){}return s.replace(/[–—]/g,"-").replace(/\s+/g," ").trim();}
  function parse(v){var s=String(v||"").replace(/%/g,"").replace(/\s/g,"").replace(/[^0-9,+\-.]/g,"");if(!s||s==="-"||s==="—")return null;if(s.indexOf(",")>=0)s=s.replace(/\./g,"").replace(",", ".");var n=Number(s);return Number.isFinite(n)?n:null;}
  function selected(){try{return localStorage.getItem(key)||"XAUUSD";}catch(e){return "XAUUSD";}}
  function label(value){return value==="XAUUSD"?"GOLD":value;}
  function pct(v){return(v>0?"+":"")+v.toFixed(2).replace(".",",")+"%";}
  function price(v){return new Intl.NumberFormat("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2}).format(v);}
  function dateText(){return new Intl.DateTimeFormat("de-DE",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(new Date());}

  function movers(doc){var out={};var rows=doc.querySelectorAll(".mover");for(var i=0;i<rows.length;i++){var s=rows[i].querySelector(".sym"),v=rows[i].querySelector(".pct");if(!s||!v)continue;var n=parse(v.textContent);if(n!==null)out[normalize(s.textContent)]=n;}return out;}
  function zones(doc){var out={};var rows=doc.querySelectorAll(".zr");for(var i=0;i<rows.length;i++){var l=rows[i].querySelector(".lbl"),v=rows[i].querySelector(".val");if(!l||!v)continue;var n=parse(v.textContent);if(n!==null)out[normalize(l.textContent)]=n;}return out;}

  function styles(doc){
    if(doc.getElementById("tl-daily-v5-css"))return;
    var s=doc.createElement("style");
    s.id="tl-daily-v5-css";
    s.textContent=".tl-d5{display:flex;flex-direction:column;gap:11px}.tl-d5-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.tl-d5-title{font-family:var(--f-disp);font-size:15px;font-weight:700;letter-spacing:1.7px;color:#f8fafc}.tl-d5-date{font-size:11.5px;color:var(--txt-2);margin-top:3px}.tl-d5-live{font-size:9px;font-weight:700;color:var(--green);border:1px solid rgba(34,197,94,.34);background:rgba(34,197,94,.08);border-radius:999px;padding:5px 8px;white-space:nowrap}.tl-d5-summary{font-size:13px;line-height:1.5;color:#dbeafe}.tl-d5-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.tl-d5-card{border:1px solid rgba(96,165,250,.16);background:rgba(8,15,34,.68);border-radius:11px;padding:8px;min-width:0}.tl-d5-card small{display:block;font-size:8px;color:var(--txt-3);text-transform:uppercase;white-space:nowrap}.tl-d5-card strong{display:block;font-size:12px;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tl-d5-card strong.pos{color:var(--green-2)}.tl-d5-card strong.neg{color:var(--red)}.tl-d5-focus{border-left:2px solid var(--cyan);background:linear-gradient(90deg,rgba(0,229,255,.08),transparent);padding:8px 9px;font-size:12px;line-height:1.43;color:var(--txt-2)}.tl-d5-button{display:flex;justify-content:space-between;border:0;background:transparent;color:var(--cyan);font-size:11px;font-weight:700;padding:2px 0;cursor:pointer}";
    doc.head.appendChild(s);
  }

  function openAnalysis(doc){var items=doc.querySelectorAll("button,a,[role='button'],.nav-item,.tab");for(var i=0;i<items.length;i++){if(normalize(items[i].textContent)==="ANALYSE"){items[i].click();return;}}}

  function render(){
    var doc=appDoc();if(!doc||!doc.body||!doc.head)return;
    var box=doc.querySelector(".briefing");if(!box)return;
    styles(doc);
    var market=selected();
    var all=movers(doc);
    var move=all[market];
    var z=zones(doc);
    var sig=JSON.stringify({market:market,move:move,z:z});
    if(sig===last&&box.getAttribute("data-daily-v5")==="ready")return;
    last=sig;

    var title="AI DAILY BRIEFING · "+label(market);
    var status=move==null?"WIRD GELADEN":"LIVE VERBUNDEN";
    var bias="Neutral";
    var biasClass="";
    var momentum=move==null?"—":pct(move);
    var momentumClass=move==null?"":(move>=0?"pos":"neg");
    var focus="Die M15-Marktdaten für "+label(market)+" werden geladen.";
    var summary="Dein Daily Briefing konzentriert sich auf "+label(market)+".";
    var levelLabel="M15 Fokus";
    var levelValue="Wird geladen";

    if(move!=null){
      if(move>0.03){bias="Bullisch";biasClass="pos";}
      else if(move<-0.03){bias="Bärisch";biasClass="neg";}
      summary=label(market)+" zeigt aktuell ein M15-Momentum von "+pct(move)+".";
      focus=move>0.03?"Das kurzfristige Momentum ist positiv. Neue Long-Ideen erst nach Bestätigung im Analyse-Tab prüfen.":move<-0.03?"Das kurzfristige Momentum ist negativ. Short-Ideen nur mit bestätigter Marktstruktur prüfen.":"Das Momentum ist aktuell schwach. Ein klarer Ausbruch oder Strukturwechsel ist abzuwarten.";
      levelValue=bias;
    }

    if(market==="XAUUSD"){
      var current=z["AKTUELLER PREIS"],r1=z["WIDERSTAND 1"],r2=z["WIDERSTAND 2"],s1=z["UNTERSTUTZUNG 1"],s2=z["UNTERSTUTZUNG 2"];
      if(current!=null&&r1!=null&&r2!=null&&s1!=null&&s2!=null){
        levelLabel="Gold M15";
        if(current>r1){bias="Bullisch";biasClass="pos";levelValue="Über R1";focus="Gold notiert bei "+price(current)+" über Widerstand 1. Der nächste technische Bereich liegt bei "+price(r2)+".";}
        else if(current<s1){bias="Bärisch";biasClass="neg";levelValue="Unter S1";focus="Gold notiert bei "+price(current)+" unter Unterstützung 1. Die nächste technische Zone liegt bei "+price(s2)+".";}
        else{bias="Neutral";biasClass="";levelValue="In der Range";focus="Gold steht bei "+price(current)+" zwischen Unterstützung 1 bei "+price(s1)+" und Widerstand 1 bei "+price(r1)+".";}
        summary="Gold steht aktuell bei "+price(current)+" und zeigt ein M15-Momentum von "+(move==null?"—":pct(move))+".";
      }
    }

    box.setAttribute("data-daily-v5","ready");
    box.innerHTML="<div class='tl-d5'><div class='tl-d5-head'><div><div class='tl-d5-title'>"+title+"</div><div class='tl-d5-date'>"+dateText()+"</div></div><span class='tl-d5-live'>"+status+"</span></div><div class='tl-d5-summary'>"+summary+"</div><div class='tl-d5-grid'><div class='tl-d5-card'><small>Bias</small><strong class='"+biasClass+"'>"+bias+"</strong></div><div class='tl-d5-card'><small>Momentum</small><strong class='"+momentumClass+"'>"+momentum+"</strong></div><div class='tl-d5-card'><small>"+levelLabel+"</small><strong class='"+biasClass+"'>"+levelValue+"</strong></div></div><div class='tl-d5-focus'>"+focus+"</div><button class='tl-d5-button' type='button'><span>Analyse starten</span><span>›</span></button></div>";
    var button=box.querySelector(".tl-d5-button");if(button)button.addEventListener("click",function(){openAnalysis(doc);});
  }

  function boot(){render();clearInterval(timer);timer=setInterval(render,2000);}
  window.addEventListener("tradelens-briefing-change",function(){last="";render();});
  if(!frame)return;
  var doc=appDoc();
  if(doc&&doc.readyState!=="loading")boot();
  else frame.addEventListener("load",boot,{once:true});
})();
