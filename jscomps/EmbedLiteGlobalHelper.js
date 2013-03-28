/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

// Common helper service

function EmbedLiteGlobalHelper()
{
}

EmbedLiteGlobalHelper.prototype = {
  classID: Components.ID("{6322b72e-9764-11e2-8566-cbaca05819ea}"),

  observe: function (aSubject, aTopic, aData) {
    switch(aTopic) {
      // Engine DownloadManager notifications
      case "app-startup": {
        dump("EmbedLiteGlobalHelper app-startup\n");
        // Init LoginManager
        Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);
        break;
      }
    }
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference])
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([EmbedLiteGlobalHelper]);
