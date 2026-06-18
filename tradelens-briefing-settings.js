(function(){
  "use strict";
  var frame=document.getElementById("app");
  var key="tradelens_daily_briefing_market";
  var markets=["XAUUSD","NAS100","EURUSD","BTCUSD"];

  function appDoc(){
    try{return frame&&(frame.contentDocument||frame.contentWindow.document);}catch(e){return null;}
  }

  function getValue(){
    try{return localStorage.getItem(key)||"XAUUSD";}catch(e){return "XAUUSD";}
  }

  function setValue(value){
    try{localStorage.setItem(key,value);}catch(e){}
    window.dispatchEvent(new Event("tradelens-briefing-change"));
  }

  function addStyles(doc){
    if(doc.getElementById("tl-briefing-settings-css"))return;
    var style=doc.createElement("style");
    style.id="tl-briefing-settings-css";
    style.textContent=".tl-briefing-settings-button{position:absolute;right:14px;top:14px;width:34px;height:34px;border-radius:10px;border:1px solid rgba(96,165,250,.28);background:rgba(8,15,34,.82);color:var(--cyan);font-size:15px}.tl-briefing-settings-panel{position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.8);display:flex;align-items:flex-end;padding:16px}.tl-briefing-settings-sheet{width:100%;background:#071020;border:1px solid rgba(96,165,250,.28);border-radius:18px;padding:18px}.tl-briefing-settings-title{font-family:var(--f-disp);font-size:15px;font-weight:700;color:#f8fafc}.tl-briefing-settings-options{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:14px}.tl-briefing-settings-option{padding:12px;border-radius:12px;border:1px solid rgba(96,165,250,.18);background:rgba(8,15,34,.78);color:#dbeafe;font-weight:700}.tl-briefing-settings-option.active{border-color:var(--cyan);color:var(--cyan)}.tl-briefing-settings-close{width:100%;margin-top:12px;padding:11px;border:0;border-radius:11px;background:rgba(0,229,255,.12);color:var(--cyan);font-weight:700}";
    doc.head.appendChild(style);
  }

  function openPanel(doc){
    var old=doc.querySelector(".tl-briefing-settings-panel");
    if(old)old.remove();
    var panel=doc.createElement("div");
    panel.className="tl-briefing-settings-panel";
    var sheet=doc.createElement("div");
    sheet.className="tl-briefing-settings-sheet";
    var title=doc.createElement("div");
    title.className="tl-briefing-settings-title";
    title.textContent="Daily Briefing Einstellungen";
    var options=doc.createElement("div");
    options.className="tl-briefing-settings-options";
    markets.forEach(function(market){
      var button=doc.createElement("button");
      button.className="tl-briefing-settings-option"+(market===getValue()?" active":"");
      button.textContent=market==="XAUUSD"?"Gold":market;
      button.addEventListener("click",function(){setValue(market);panel.remove();});
      options.appendChild(button);
    });
    var close=doc.createElement("button");
    close.className="tl-briefing-settings-close";
    close.textContent="Fertig";
    close.addEventListener("click",function(){panel.remove();});
    sheet.appendChild(title);
    sheet.appendChild(options);
    sheet.appendChild(close);
    panel.appendChild(sheet);
    doc.body.appendChild(panel);
  }

  function mount(){
    var doc=appDoc();
    if(!doc||!doc.body||!doc.head)return;
    addStyles(doc);
    var briefing=doc.querySelector(".briefing");
    if(!briefing||briefing.querySelector(".tl-briefing-settings-button"))return;
    var host=briefing.closest?briefing.closest(".gf,.card"):briefing;
    if(!host)return;
    if(getComputedStyle(host).position==="static")host.style.position="relative";
    var button=doc.createElement("button");
    button.className="tl-briefing-settings-button";
    button.type="button";
    button.textContent="⋯";
    button.addEventListener("click",function(){openPanel(doc);});
    host.appendChild(button);
  }

  function boot(){mount();setInterval(mount,2000);}
  if(!frame)return;
  var doc=appDoc();
  if(doc&&doc.readyState!=="loading")boot();
  else frame.addEventListener("load",boot,{once:true});
})();
