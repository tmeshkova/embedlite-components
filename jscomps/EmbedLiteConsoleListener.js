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
  this._cacheLogs = true;
}

SPConsoleListener.prototype = {
  _cacheLogs: true,
  _startupCachedLogs: [],
  _dumpToStdOut: false,
  observe: function(msg) {
    if (this._dumpToStdOut) {
      dump("CONSOLE: " + JSON.stringify(msg) + "\n");
    } else {
      if (this._cacheLogs) {
        this._startupCachedLogs.push(msg);
      } else {
        Services.obs.notifyObservers(null, "embed:logger", JSON.stringify({ multiple: false, log: msg }));
      }
    }
  },
  clearCache: function() {
      this._cacheLogs = false;
      this._startupCachedLogs = null;
  },

  flushCache: function() {
    if (this._cacheLogs) {
      this._cacheLogs = false;
      Services.obs.notifyObservers(null, "embed:logger", JSON.stringify({ multiple: true, log: this._startupCachedLogs }));
      this._startupCachedLogs = null;
    }
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIConsoleListener])
};

function EmbedLiteConsoleListener()
{
}

EmbedLiteConsoleListener.prototype = {
  classID: Components.ID("{6b21b5a8-9816-11e2-86f8-fb54170a814d}"),
  _enabled: false,
  _listener: null,

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
          this._listener = new SPConsoleListener(dumpToStdOut);
          Services.console.registerListener(this._listener);
          this._enabled = true;
          Services.obs.addObserver(this, "embedui:logger", true);
        }
        break;
      }
      case "embedui:logger": {
        var data = JSON.parse(aData);
        if (data.enabled) {
          if (this._enabled) {
            this._listener.flushCache();
          } else {
            Services.console.registerListener(this._listener);
          }
        } else if (!data.enabled && this._enabled) {
          Services.console.unregisterListener(this._listener);
          this._listener.clearCache();
        }
        break;
      }
    }
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference])
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([EmbedLiteConsoleListener]);
