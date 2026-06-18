(function(){
  "use strict";

  var timer=null;

  function installStyles(){
    if(document.getElementById("tl-holo-orb-v1-style"))return;
    var style=document.createElement("style");
    style.id="tl-holo-orb-v1-style";
    style.textContent=[
      ".tl-reference-visual{min-height:154px!important}",
      ".tl-holo-wrap{position:relative;width:110px;height:112px;margin-top:10px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 0 12px rgba(34,247,255,.45)) drop-shadow(0 0 26px rgba(124,58,237,.22));animation:tlHoloFloat 4.5s ease-in-out infinite}",
      ".tl-holo-aura{position:absolute;inset:7px;border-radius:50%;background:radial-gradient(circle at 50% 52%,rgba(34,247,255,.20),rgba(37,99,235,.09) 42%,transparent 72%);filter:blur(10px)}",
      ".tl-holo-sphere{position:absolute;left:50%;top:45%;width:70px;height:70px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle at 35% 28%,rgba(255,255,255,.96) 0 3%,rgba(165,243,252,.90) 7%,rgba(34,211,238,.48) 18%,rgba(37,99,235,.28) 42%,rgba(15,23,42,.24) 68%,transparent 78%);box-shadow:inset 0 0 18px rgba(34,247,255,.48),inset -12px -10px 22px rgba(124,58,237,.28),0 0 20px rgba(34,247,255,.38)}",
      ".tl-holo-core-glow{position:absolute;left:50%;top:45%;width:30px;height:30px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.98),rgba(165,243,252,.75) 35%,rgba(34,211,238,.24) 64%,transparent 78%);box-shadow:0 0 14px rgba(255,255,255,.75),0 0 28px rgba(34,247,255,.68),0 0 46px rgba(37,99,235,.35)}",
      ".tl-holo-core{position:absolute;left:50%;top:45%;width:14px;height:14px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff 0 22%,#dfffff 28%,#7dd3fc 70%,#22d3ee 100%);box-shadow:0 0 8px #fff,0 0 18px rgba(34,247,255,.95),0 0 30px rgba(59,130,246,.75);z-index:5}",
      ".tl-holo-orbit{position:absolute;left:50%;top:45%;border:1px solid rgba(125,249,255,.40);border-radius:50%;transform-origin:center center;pointer-events:none;box-shadow:0 0 8px rgba(34,247,255,.18)}",
      ".tl-holo-orbit.one{width:94px;height:34px;animation:tlHoloOrbit1 8s linear infinite}",
      ".tl-holo-orbit.two{width:88px;height:28px;border-color:rgba(167,139,250,.36);animation:tlHoloOrbit2 10s linear infinite}",
      ".tl-holo-orbit.three{width:54px;height:84px;border-color:rgba(255,255,255,.18);animation:tlHoloOrbit3 12s linear infinite}",
      ".tl-holo-orbit.four{width:78px;height:20px;border-style:dashed;border-color:rgba(34,247,255,.24);animation:tlHoloOrbit4 7s linear infinite}",
      ".tl-holo-particle{position:absolute;border-radius:50%;background:#dfffff;box-shadow:0 0 7px #fff,0 0 13px rgba(34,247,255,.9);z-index:6}",
      ".tl-holo-particle.p1{width:4px;height:4px;left:16px;top:25px;animation:tlHoloParticle1 4.8s ease-in-out infinite}",
      ".tl-holo-particle.p2{width:3px;height:3px;right:18px;top:35px;animation:tlHoloParticle2 5.2s ease-in-out infinite}",
      ".tl-holo-particle.p3{width:4px;height:4px;right:28px;bottom:28px;animation:tlHoloParticle3 5.8s ease-in-out infinite}",
      ".tl-holo-base-glow{position:absolute;left:50%;bottom:6px;width:88px;height:18px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(ellipse at center,rgba(34,247,255,.46),rgba(37,99,235,.20) 52%,rgba(124,58,237,.10) 66%,transparent 80%);filter:blur(7px)}",
      ".tl-holo-base-ring{position:absolute;left:50%;bottom:9px;transform:translateX(-50%);border-radius:50%;border:1px solid rgba(34,247,255,.35);box-shadow:0 0 9px rgba(34,247,255,.22)}",
      ".tl-holo-base-ring.r1{width:76px;height:12px}",
      ".tl-holo-base-ring.r2{width:50px;height:8px;bottom:6px;border-color:rgba(167,139,250,.30)}",
      ".tl-orb-meta{margin-top:4px!important}",
      "@keyframes tlHoloFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}",
      "@keyframes tlHoloOrbit1{0%{transform:translate(-50%,-50%) rotate(12deg)}100%{transform:translate(-50%,-50%) rotate(372deg)}}",
      "@keyframes tlHoloOrbit2{0%{transform:translate(-50%,-50%) rotate(-30deg)}100%{transform:translate(-50%,-50%) rotate(-390deg)}}",
      "@keyframes tlHoloOrbit3{0%{transform:translate(-50%,-50%) rotate(72deg)}100%{transform:translate(-50%,-50%) rotate(432deg)}}",
      "@keyframes tlHoloOrbit4{0%{transform:translate(-50%,-50%) rotate(48deg)}100%{transform:translate(-50%,-50%) rotate(408deg)}}",
      "@keyframes tlHoloParticle1{0%,100%{transform:translate(0,0);opacity:.5}50%{transform:translate(9px,-11px);opacity:1}}",
      "@keyframes tlHoloParticle2{0%,100%{transform:translate(0,0);opacity:.45}50%{transform:translate(-8px,8px);opacity:1}}",
      "@keyframes tlHoloParticle3{0%,100%{transform:translate(0,0);opacity:.55}50%{transform:translate(-9px,-6px);opacity:1}}",
      "@media(max-width:360px){.tl-holo-wrap{width:100px;height:104px}.tl-holo-sphere{width:64px;height:64px}.tl-holo-orbit.one{width:86px}.tl-holo-orbit.two{width:80px}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function upgrade(){
    var old=document.querySelector(".tl-ai-orb");
    if(!old)return false;
    if(old.getAttribute("data-holo-upgraded")==="true")return true;

    installStyles();
    old.setAttribute("data-holo-upgraded","true");
    old.className="tl-holo-wrap";
    old.innerHTML="<span class='tl-holo-aura'></span><span class='tl-holo-sphere'></span><span class='tl-holo-core-glow'></span><span class='tl-holo-core'></span><span class='tl-holo-orbit one'></span><span class='tl-holo-orbit two'></span><span class='tl-holo-orbit three'></span><span class='tl-holo-orbit four'></span><span class='tl-holo-particle p1'></span><span class='tl-holo-particle p2'></span><span class='tl-holo-particle p3'></span><span class='tl-holo-base-glow'></span><span class='tl-holo-base-ring r1'></span><span class='tl-holo-base-ring r2'></span>";
    return true;
  }

  function start(){
    if(upgrade())return;
    clearInterval(timer);
    timer=setInterval(function(){
      if(upgrade())clearInterval(timer);
    },300);
    setTimeout(function(){clearInterval(timer);},30000);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();
