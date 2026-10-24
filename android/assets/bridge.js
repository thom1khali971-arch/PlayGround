(function () {
  if (window.__thomNativeBridgeInstalled) return;
  window.__thomNativeBridgeInstalled = true;

  if (window.Android) {
    try {
      var nativeClipboard = navigator.clipboard || {};
      var clipboard = new Proxy(nativeClipboard, {
        get: function (target, property) {
          if (property === "writeText") {
            return function (text) {
              Android.copyText(String(text == null ? "" : text));
              return Promise.resolve();
            };
          }
          var value = target[property];
          return typeof value === "function" ? value.bind(target) : value;
        }
      });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: clipboard
      });
    } catch (e) {
    }
  }

  var blobs = new Map();
  var createObjectURL = URL.createObjectURL.bind(URL);
  var revokeObjectURL = URL.revokeObjectURL.bind(URL);

  URL.createObjectURL = function (object) {
    var url = createObjectURL(object);
    blobs.set(url, object);
    return url;
  };

  URL.revokeObjectURL = function (url) {
    window.setTimeout(function () {
      blobs.delete(url);
      revokeObjectURL(url);
    }, 30000);
  };

  function send(name, blob) {
    var reader = new FileReader();
    reader.onload = function () {
      var result = String(reader.result || "");
      var comma = result.indexOf(",");
      var base64 = comma >= 0 ? result.slice(comma + 1) : "";
      Android.saveFile(name, blob.type || "application/octet-stream", base64);
    };
    reader.readAsDataURL(blob);
  }

  var nativeClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    var href = this.href || "";
    var name = this.getAttribute("download");
    if (name && (href.indexOf("blob:") === 0 || href.indexOf("data:") === 0)) {
      var blob = blobs.get(href);
      if (blob) {
        send(name, blob);
        return;
      }
      if (href.indexOf("data:") === 0) {
        fetch(href)
          .then(function (response) { return response.blob(); })
          .then(function (result) { send(name, result); })
          .catch(function () {});
        return;
      }
    }
    return nativeClick.apply(this, arguments);
  };
})();
