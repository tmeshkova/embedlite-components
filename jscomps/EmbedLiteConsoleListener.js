/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyServiceGetter(Services, 'env',
                                  '@mozilla.org/process/environment;1',
                                  'nsIEnvironment');
// Common helper service

function SPConsoleListener(dumpStdOut) {
  this._dumpToStdOut = dumpStdOut;
}

SPConsoleListener.prototype = {
  _dumpToStdOut: false,
  observe: function(msg) {
    if (this._dumpToStdOut) {
      dump("CONSOLE: " + JSON.stringify(msg) + "\n");
    } else {
      Services.obs.notifyObservers(null, "embed:logger", JSON.stringify(msg));
    }
    return;
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIConsoleListener])
};

function EmbedLiteConsoleListener()
{
}

EmbedLiteConsoleListener.prototype = {
  classID: Components.ID("{6b21b5a8-9816-11e2-86f8-fb54170a814d}"),

  observe: function (aSubject, aTopic, aData) {
    switch(aTopic) {
      // Engine DownloadManager notifications
      case "app-startup": {
        let dumpToStdOut = false;
        var runConsoleEnv = 0;
        try {
          runConsoleEnv = Services.env.get('EMBED_CONSOLE');
          dumpToStdOut = runConsoleEnv == 1;
        } catch (e) {}
        var runConsolePref = 0;
        try {
          runConsolePref = Services.prefs.getIntPref("embedlite.console_log.enabled");
          dumpToStdOut = runConsolePref == 1;
        } catch (e) {/*pref is missing*/ }
        if (runConsolePref > 0 || runConsoleEnv > 0) {
          let listener = new SPConsoleListener(dumpToStdOut);
          Services.console.registerListener(listener);
        }
        break;
      }
    }
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference])
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([EmbedLiteConsoleListener]);
