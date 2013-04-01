/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

// Common helper service

function InitializeXulAppInfo()
{
  let XULAppInfo = {
    vendor: "Mozilla",
    name: "EmbedLiteBrowser",
    ID: "embedliteBrowser@embed.mozilla.org",
    version: "1",
    appBuildID: "20100621",
    platformVersion: "",
    platformBuildID: "20100621",
    inSafeMode: false,
    logConsoleErrors: true,
    OS: "XPCShell",
    XPCOMABI: "noarch-spidermonkey",
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIXULAppInfo, Ci.nsIXULRuntime]),
    invalidateCachesOnRestart: function invalidateCachesOnRestart() { }
  };

  let XULAppInfoFactory = {
    createInstance: function (outer, iid) {
      if (outer != null)
        throw Cr.NS_ERROR_NO_AGGREGATION;
      return XULAppInfo.QueryInterface(iid);
    }
  };

  let registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
  registrar.registerFactory(Components.ID("{0aba3008-9ad4-11e2-a327-cb2a226fec9f}"),
                            "XULAppInfo", "@mozilla.org/xre/app-info;1",
                            XULAppInfoFactory);
}

function EmbedLiteGlobalHelper()
{
}

EmbedLiteGlobalHelper.prototype = {
  classID: Components.ID("{6322b72e-9764-11e2-8566-cbaca05819ea}"),

  observe: function (aSubject, aTopic, aData) {
    switch(aTopic) {
      // Engine DownloadManager notifications
      case "app-startup": {
        InitializeXulAppInfo();
        dump("EmbedLiteGlobalHelper app-startup\n");
        Services.obs.addObserver(this, "invalidformsubmit", false);
        Services.obs.addObserver(this, "xpcom-shutdown", false);
        // Init LoginManager
        Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);
        break;
      }
      case "invalidformsubmit": {
        dump("EmbedLiteGlobalHelper invalidformsubmit\n");
        break;
      }
      case "xpcom-shutdown": {
        dump("EmbedLiteGlobalHelper xpcom-shutdown\n");
        Services.obs.removeObserver(this, "invalidformsubmit", false);
        break;
      }
    }
  },

  notifyInvalidSubmit: function notifyInvalidSubmit(aFormElement, aInvalidElements) {
    dump("NOT IMPLEMENTED Invalid Form Submit, need to do something about it\n");
    if (!aInvalidElements.length)
      return;
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference, Ci.nsIFormSubmitObserver])
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([EmbedLiteGlobalHelper]);
