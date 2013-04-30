/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

// Common helper service
function EmbedLiteSearchEngine()
{
}

EmbedLiteSearchEngine.prototype = {
  classID: Components.ID("{924fe7ba-afa1-11e2-9d4f-533572064b73}"),

  observe: function (aSubject, aTopic, aData) {
    switch(aTopic) {
      // Engine DownloadManager notifications
      case "app-startup": {
        Services.obs.addObserver(this, "xpcom-shutdown", true);
        Services.obs.addObserver(this, "embedui:search", true);
        Services.obs.addObserver(this, "embedliteInitialized", true);
        break;
      }
      case "embedliteInitialized": {
        Services.obs.removeObserver(this, "embedliteInitialized");
        Services.search.init(function addEngine_cb(rv) {
            Services.obs.notifyObservers(null, "embed:search", JSON.stringify({ msg: "init", defaultEngine: Services.search.defaultEngine ? Services.search.defaultEngine.name : null }));
        });
        break;
      }
      case "embedui:search": {
        var data = JSON.parse(aData);
        switch (data.msg) {
          case "loadxml": {
            Services.search.addEngine(data.uri, Ci.nsISearchEngine.DATA_XML, null, data.confirm);
            break;
          }
          case "loadtext": {
            Services.search.addEngine(data.uri, Ci.nsISearchEngine.DATA_TEXT, null, data.confirm);
            break;
          }
          case "getlist": {
            let engines = Services.search.getEngines({});
            if (engines) {
              var json = [];
              for (var i = 0; i < engines.length; i++) {
                let engine = engines[i];
                let serEn = { name: engine.name,
                              isDefault: Services.search.defaultEngine === engine,
                              isCurrent: Services.search.currentEngine === engine }
                json.push(serEn);
              }
              Services.obs.notifyObservers(null, "embed:search", JSON.stringify({ msg: "pluginslist", list: json}));
            }
            break;
          }
        }
        break;
      }
      case "xpcom-shutdown": {
        Services.obs.removeObserver(this, "embedui:search");
        Services.obs.removeObserver(this, "xpcom-shutdown");
        break;
      }
      default:
        break;
    }
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference])
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([EmbedLiteSearchEngine]);
