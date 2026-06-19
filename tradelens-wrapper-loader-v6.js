(function(){
  "use strict";
  var frame=document.getElementById("app");

  function mountBriefing(){
    try{
      var doc=frame.contentDocument||frame.contentWindow.document;
      if(!doc||!doc.head){setTimeout(mountBriefing,500);return;}

      var files=[
        {id:"tl-native-briefing-script",src:"tradelens-briefing-native.js?v=20260619h"},
        {id:"tl-briefing-live-bind-script",src:"tradelens-briefing-live-bind.js?v=20260619h"},
        {id:"tl-live-sentiment-script",src:"tradelens-sentiment-live-v1.js?v=20260619h"}
      ];

      files.forEach(function(file){
        if(doc.getElementById(file.id))return;
        var script=doc.createElement("script");
        script.id=file.id;
        script.src=file.src;
        doc.head.appendChild(script);
      });
    }catch(error){
      setTimeout(mountBriefing,500);
    }
  }

  if(!frame)return;
  frame.addEventListener("load",function(){setTimeout(mountBriefing,50);});
  setTimeout(mountBriefing,400);
})();
