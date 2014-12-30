(function (global) {

  var document = global.document;

  var HEAD = document.getElementsByTagName("head")[0];

  // load scripts
  function load_script (src, content) {
    var script = document.createElement("script");
    script.type = "text/javascript";

    if (src) {
      script.src = src;
    }

    if (content) {
      script.innerHTML = content;
    }

    HEAD.appendChild(script);
  }

  // load stylesheet
  function load_stylesheet (src) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = src;

    HEAD.appendChild(link);
  }

  // inject pr0cast URL script
  var base = chrome.extension.getURL("");
  load_script(null, "var pr0castURL = function (url) { " +
    "return \"" + base + "\" + url; " + "}"
    );

  load_script( "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js" );
  load_script( global.chrome.extension.getURL("src/pr0cast.js") );
  load_stylesheet( global.chrome.extension.getURL("src/pr0cast.css") );

})(this);
