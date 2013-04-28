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
        dump("EmbedLiteSearchEngine app-startup\n");
        Services.obs.addObserver(this, "browser-search-engine-modified", true);
        Services.obs.addObserver(this, "embedliteInitialized", true);
        // Init LoginManager
        break;
      }
      case "embedliteInitialized": {
        Services.search.init(function addEngine_cb(rv) {
            Services.search.addEngine("chrome://embedlite/content/google.xml", Ci.nsISearchEngine.DATA_XML, null, false);
        });
        break;
      }
      case "browser-search-engine-modified": {
        break;
      }
      default: {
        dump("EmbedLiteSearchEngine observe: top:" + aTopic + "\n");
        break;
      }
    }
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference])
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([EmbedLiteSearchEngine]);
