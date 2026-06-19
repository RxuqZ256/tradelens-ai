(function(){
  "use strict";
  var frame=document.getElementById("app");

  function mountBriefing(){
    try{
      var doc=frame.contentDocument||frame.contentWindow.document;
      if(!doc||!doc.head){setTimeout(mountBriefing,500);return;}

      var files=[
        {id:"tl-native-briefing-script",src:"tradelens-briefing-native.js?v=20260619k"},
        {id:"tl-briefing-live-bind-script",src:"tradelens-briefing-live-bind.js?v=20260619k"},
        {id:"tl-live-sentiment-script",src:"tradelens-sentiment-live-v1.js?v=20260619k"}
      ];

      files.forEach(function(file){
        if(doc.getElementById(file.id))return;
        var script=doc.createElement("script");
        script.id=file.id;
        script.src=file.src;
        doc.head.appendChild(script);
      });

      var polish=doc.getElementById("tl-sentiment-polish-style");
      if(polish)polish.remove();
      polish=doc.createElement("style");
      polish.id="tl-sentiment-polish-style";
      polish.textContent=".tl-live-sentiment-svg .tl-segment-active-group{transform:rotate(90deg);transform-origin:60px 60px}.tl-live-sentiment-svg .tl-segment-active{stroke-width:3.4!important}.tl-live-sentiment-svg .tl-segment-active.tl-leading{stroke-width:3.8!important}.tl-live-sentiment-svg .tl-segment-track{stroke-width:3.2!important;opacity:.34!important}.tl-live-sentiment-svg{transform:scale(.96);transform-origin:center}";
      doc.head.appendChild(polish);
    }catch(error){
      setTimeout(mountBriefing,500);
    }
  }

  if(!frame)return;
  frame.addEventListener("load",function(){setTimeout(mountBriefing,50);});
  setTimeout(mountBriefing,400);
})();
