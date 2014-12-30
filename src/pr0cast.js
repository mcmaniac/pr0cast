var init_module = function (global) {

  // alias: global namespace
  var window = global.window,
      document = global.document,
      console = global.console;

  // alias: chrome
  var chrome = global.chrome;

  // alias: jquery
  var $ = global.jQuery;

  /*
   * Pr0cast class
   *
   */

  var Pr0cast = function () {
    var self = this;
    self.appId = chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID;
  };

  Pr0cast.prototype.init = function () {
    var self = this;

    // init chromecast session
    var sess_req = new chrome.cast.SessionRequest(self.appId);
    var api_conf = new chrome.cast.ApiConfig(sess_req,
        function (s) { self._sessionListener(s); },
        function (a) { self._receiverListener(a); }
        );

    chrome.cast.initialize(api_conf, console.log, console.log);
  }

  Pr0cast.prototype._sessionListener = function (session) {
    var self = this;

    self._session = session;

    // TODO: figure out if media contentId == current picture
    console.log(session);

    self._initUI();
  }

  Pr0cast.prototype._receiverListener = function (avail) {
    var self = this;

    if (avail == chrome.cast.ReceiverAvailability.AVAILABLE) {
      self._initUI();
    }
  }

  Pr0cast.prototype._initUI = function () {
    var self = this;

    self.UI.init(function () {
      self.connect();
    });
  }

  /*
   * High level API: Connect / disconnect
   *
   */

  Pr0cast.prototype.connect = function (opt_callback) {
    var self = this;

    if (self._connected) {
      return;
    }

    self.detectImageChange();

    self.load(self._findImageSrc(), function () {
      self.UI.setConnected(function () {
        self.disconnect();
      });
    });
  }

  Pr0cast.prototype.disconnect = function (opt_callback) {
    var self = this;

    self._connected = false;

    self.closeSession();
    self.UI.setDisconnected(function () {
      self.connect();
    });
  }

  /*
   * Pr0cast: pick receiver
   *
   */

  Pr0cast.prototype.requestSession = function (cb) {
    var self = this;

    if (self._connected) {
      return;
    }

    self.UI.setConnecting();

    chrome.cast.requestSession(function (s) {
      self._onRequestSessionSuccess(s);
      if (typeof cb == "function") {
        cb();
      }
    }, function (e) {
      console.log(e);
      self.disconnect();
    });
  }

  Pr0cast.prototype._onRequestSessionSuccess = function (session) {
    var self = this;

    // store
    self._session = session;
  }

  Pr0cast.prototype.closeSession = function () {
    var self = this;
    var session = self._session;

    if (!session) {
      return;
    }

    session.stop();

    self._session = null;
  }

  /*
   * Pr0cast: send media to device
   *
   */

  Pr0cast.prototype.load = function (url, opt_mime, opt_cb) {
    var self = this;

    if (!url) {
      return;
    }

    if (typeof opt_mime == "function") {
      opt_cb = opt_mime;
      opt_mime = null;
    }

    // figure out MIME type of url
    var mime = opt_mime;
    if (!mime) {

      // get url file extension
      /\.([^\.]+)$/.exec(url);
      var ext = RegExp.$1;

      // video types
      var videos = [ "webm", "mp4", "mpeg" ];

      if (videos.indexOf(ext) != -1) {
        mime = "video";
      } else {
        mime = "image"; // default value
      }
    }

    // alias
    var session = self._session;

    // select session if not available
    if (!session) {
      return self.requestSession(function () { self.load(url, mime, opt_cb); });
    }

    var media_info = new chrome.cast.media.MediaInfo(url, mime);
    var request    = new chrome.cast.media.LoadRequest(media_info);

    session.loadMedia(request,
        function (how, media) {

          self._onMediaDiscovered(how, media);
          self._connected = true;

          if (typeof opt_cb == "function") {
            opt_cb();
          }
        },
        function (e) {
          self._onMediaError(e);
        });
  };

  Pr0cast.prototype._onMediaDiscovered = function (how, media) {
    var self = this;

    self.UI.setConnected(function () {
      self.disconnect();
    });

    console.log(how);
    console.log(media);
    self._currentMedia = media;
  }

  Pr0cast.prototype._onMediaError = function (e) {
    var self = this;

    console.error(e);
    self.disconnect();
  }

  Pr0cast.prototype._findImageSrc = function (opt_context) {
    // look for fullsize link
    var fullsize = $(".item-fullsize-link", opt_context);
    if (fullsize.length > 0) {
      return fullsize.attr("href");
    } else {
      return $(".item-image", opt_context).attr("src");
    }
  }

  /*
   * Detect next image
   *
   */

  Pr0cast.prototype.detectImageChange = function () {
    var self = this;

    if (self._mutationObserver) {
      return;
    }

    console.log("detectImageChange");

    var stream = $("#stream")[0];

    var mutationObserver = self._mutationObserver
                         = new MutationObserver(function (e) { self._mutationObserverCallback(e); });

    // observe child addition/removals
    mutationObserver.observe(stream, {
      childList: true,
      subtree: true,
    });
  }

  Pr0cast.prototype._mutationObserverCallback = function (mutations) {
    var self = this;

    if (self._connected !== true) {
      return;
    }

    // find next image url

    for (var i = 0; i < mutations.length; i++) {
      var mutation_record = mutations[i];

      for (var j = 0; j < mutation_record.addedNodes.length; j++) {

        var added = mutation_record.addedNodes[j],
            cls = added.classList;

        if (cls && (cls.contains("item-container") || cls.contains("item-container-content"))) {

          // cast image/video
          self.load( self._findImageSrc(added) );

          // scroll to info part
          self._scrollToItemInfo(added);

          return; // quit
        }
      }
    }
  }

  Pr0cast.prototype._scrollToItemInfo = (function (header_height) {
    return function (opt_context) {
      $(document).scrollTop( $(".item-info").offset().top - header_height );
    };
  })($("#head").outerHeight());

  /*
   * pr0cast UI
   *
   */

  Pr0cast.prototype.UI = {
    _initialized: false,
  };

  Pr0cast.prototype.UI.init = function (onclick) {
    var self = this;

    if (self._initialized) {
      return;
    }

    var pr0cast_status = $(
          "<div id=\"pr0cast-status\">" +
          "<img src=\"\" alt=\"pr0cast status\">"
        );

    $("body").prepend(pr0cast_status);

    self.setDisconnected(onclick);

    self._initialized = true;
  }

  Pr0cast.prototype.UI._loadIcon = function (name) {
    var img = pr0castURL("img/" + name);
    $("#pr0cast-status img").attr("src", img);
  }

  Pr0cast.prototype.UI._setClick = function (onclick) {
    var pr0cast_status = $("#pr0cast-status");

    // remove all click bindings
    pr0cast_status.unbind("click");

    // set new one
    if (typeof onclick == "function") {
      pr0cast_status.click(onclick);
    }
  }

  Pr0cast.prototype.UI.setDisconnected = function (onclick) {
    var self = this;

    self._animate = null;
    self._loadIcon("ic_media_route_off_holo_dark.png");
    self._setClick(onclick);
  }

  Pr0cast.prototype.UI.setConnecting = function (onclick) {
    var self = this;

    var counter = 0;

    self._animate = function() {
      self._loadIcon("ic_media_route_on_" + counter + "_holo_dark.png");
      counter = (counter + 1) % 3;
      window.setTimeout(function () {
        if (self._animate) {
          self._animate();
        }
      }, 500);
    }

    self._animate();
    self._setClick(onclick);
  }

  Pr0cast.prototype.UI.setConnected = function (onclick) {
    var self = this;

    self._animate = null;
    self._loadIcon("ic_media_route_on_holo_dark.png");
    self._setClick(onclick);
  }

  /*
   * run
   *
   */

  var pr0cast = global.pr0cast = new Pr0cast();

  pr0cast.init();

};

window['__onGCastApiAvailable'] = function (loaded, error) {
  if (loaded) {
    init_module(this);
  } else {
    console.log(error);
  }
};
