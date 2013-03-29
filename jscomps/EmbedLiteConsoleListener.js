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

function SPConsoleListener() {
}

SPConsoleListener.prototype = {
  observe: function(msg) {
    dump("CONSOLE: " + JSON.stringify(msg) + "\n");
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
        var runConsoleEnv = false;
        try {
          runConsoleEnv = Services.env.get('EMBED_CONSOLE');
        } catch (e) {}
        var runConsolePref = false;
        try {
          runConsolePref = Services.prefs.getBoolPref("embedlite.console_log.enabled");
        } catch (e) {/*pref is missing*/ }
        if (runConsolePref || runConsoleEnv) {
          let listener = new SPConsoleListener();
          Services.console.registerListener(listener);
        }
        break;
      }
    }
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference])
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([EmbedLiteConsoleListener]);
