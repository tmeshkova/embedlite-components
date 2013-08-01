/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

function debug(aMsg) {
  dump("PrivateDataManager.js: " + aMsg + "\n");
}

function PrivateDataManager() {}

PrivateDataManager.prototype = {
  classID: Components.ID("{6a7dd2ef-b7c8-4ab5-8c35-c0e5d7557ccf}"),
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference]),

  get loginManager() {
    return Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);
  },

  get cookieManager() {
    return Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager);
  },

  get cacheService() {
    return Cc["@mozilla.org/network/cache-service;1"].getService(Ci.nsICacheService);
  },

  clearPrivateData: function (aData) {
    switch (aData) {
      case "passwords": {
        this.loginManager.removeAllLogins();
        debug("Passwords removed");
        break;
      }
      case "cookies": {
        this.cookieManager.removeAll();
        debug("Cookies removed");
        break;
      }
      case "cache": {
        try {
          this.cacheService.evictEntries(Ci.nsICache.STORE_ANYWHERE);
        } catch (ex) {debug(ex)}
        debug("Cache cleaned");
        break;
      }
    }
  },

  observe: function (aSubject, aTopic, aData) {
    switch (aTopic) {
      case "app-startup": {
        Services.obs.addObserver(this, "clear-private-data", true);
        break;
      }
      case "clear-private-data": {
        this.clearPrivateData(aData);
        break;
      }
    }
  }
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([PrivateDataManager]);
