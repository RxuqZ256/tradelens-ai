(function(){
  "use strict";
  var frame=document.getElementById("app");

  function mountBriefing(){
    try{
      var doc=frame.contentDocument||frame.contentWindow.document;
      if(!doc||!doc.head){setTimeout(mountBriefing,500);return;}

      var files=[
        {id:"tl-native-briefing-script",src:"tradelens-briefing-native.js?v=20260619c"},
        {id:"tl-briefing-live-bind-script",src:"tradelens-briefing-live-bind.js?v=20260619c"}
      ];

      files.forEach(function(file){
        if(doc.getElementById(file.id))return;
        var script=doc.createElement("script");
        script.id=file.id;
        script.src=file.src;
        doc.head.appendChild(script);
      });

      if(!doc.getElementById("tl-daily-briefing-ui-style")){
        var style=doc.createElement("style");
        style.id="tl-daily-briefing-ui-style";
        style.textContent=".tl-native-status{display:none!important}";
        doc.head.appendChild(style);
      }
    }catch(error){
      setTimeout(mountBriefing,500);
    }
  }

  if(!frame)return;
  frame.addEventListener("load",function(){setTimeout(mountBriefing,50);});
  setTimeout(mountBriefing,400);
})();
