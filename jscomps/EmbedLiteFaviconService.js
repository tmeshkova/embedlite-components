/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "NetUtil",
                                  "resource://gre/modules/NetUtil.jsm");
XPCOMUtils.defineLazyServiceGetter(Services, "embedlite",
                                   "@mozilla.org/embedlite-app-service;1",
                                   "nsIEmbedAppService");

// Common helper service

function EmbedLiteFaviconService()
{
}

function resolveGeckoURI(aURI) {
  if (aURI.indexOf("chrome://") == 0) {
    let registry = Cc['@mozilla.org/chrome/chrome-registry;1'].getService(Ci["nsIChromeRegistry"]);
    return registry.convertChromeURL(Services.io.newURI(aURI, null, null)).spec;
  } else if (aURI.indexOf("resource://") == 0) {
    let handler = Services.io.getProtocolHandler("resource").QueryInterface(Ci.nsIResProtocolHandler);
    return handler.resolveURI(Services.io.newURI(aURI, null, null));
  }
  return aURI;
}

var gProgressListener = {
  _shouldLoadFavicon: function(aURI) {
    return (aURI && ("schemeIs" in aURI) && (aURI.schemeIs("http") || aURI.schemeIs("https")));
  },

  onStateChange: function() {},

  onLocationChange: function(aWebProgress, aRequest, aLocation, aFlags) {
    var domDoc = aWebProgress.DOMWindow.document;
    if (!this._shouldLoadFavicon(domDoc.documentURIObject)) {
      return;
    }
    let iconPath = domDoc.documentURIObject.prePath + "/favicon.ico";
    let winid = Services.embedlite.getIDByWindow(aWebProgress.DOMWindow);
    NetUtil.asyncFetch(iconPath, function(aInputStream, aStatusCode, aRequest) {
      if (!Components.isSuccessCode(aStatusCode) || aRequest.contentType == "text/html") {
        return;
      }
      Services.embedlite.sendAsyncMessage(winid, "embed:faviconURL", JSON.stringify({url: resolveGeckoURI(iconPath)}));
    });
  },
  onSecurityChange: function() { },
  onProgressChange: function() { },
  onStatusChange: function() { },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIWebProgressListener,
                                         Ci.nsISupportsWeakReference]),
}

function EventLinkListener(aWindow)
{
  this._winID = Services.embedlite.getIDByWindow(aWindow);
  let browser = Services.embedlite.getBrowserByID(this._winID);
  this._targetWindow = browser.contentDOMWindow;
}

EventLinkListener.prototype = {
  _winID: -1,
  _targetWindow: null,
  handleEvent: function Input_handleEvent(aEvent) {
    switch (aEvent.type) {
      case "DOMLinkAdded":
        let target = aEvent.originalTarget;
        if (!target.href || target.disabled)
          return;

        // ignore on frames and other documents
        if (target.ownerDocument != this._targetWindow.document)
          return;

        // sanitize the rel string
        let list = [];
        if (target.rel) {
          list = target.rel.toLowerCase().split(/\s+/);
          let hash = {};
          list.forEach(function(value) { hash[value] = true; });
          list = [];
          for (let rel in hash)
            list.push("[" + rel + "]");
        }

        // We only care about icon links
        if (list.indexOf("[icon]") == -1)
          return;

        Services.embedlite.sendAsyncMessage(this._winID, "embed:faviconURL", JSON.stringify({url: resolveGeckoURI(target.href)}));
        break;
    }
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIDOMEventListener])
};

EmbedLiteFaviconService.prototype = {
  classID: Components.ID("{c48047b0-9e6d-11e2-a162-bb9036ce396c}"),
  _linkListeners: {},
  _enabled: false,

  _enableListener: function() {
    if (!this._enabled) {
      this._enabled = true;
      Services.obs.addObserver(this, "embedliteviewcreated", true);
      Services.obs.addObserver(this, "domwindowclosed", true);
    }
  },

  observe: function (aSubject, aTopic, aData) {
    let self = this;
    switch(aTopic) {
      case "app-startup": {
        try {
          if (Services.prefs.getBoolPref("embed.favicons.listener.enabled"))
            this._enableListener();
        } catch (e) {}
        if (!this._enabled)
          Services.obs.addObserver(this, "embedui:faviconlistener", true);
        break;
      }
      case "embedui:faviconlistener": {
        var data = JSON.parse(aData);
        if (data.enabled) {
            this._enableListener();
        }
        break;
      }
      case "embedliteviewcreated": {
        self.onWindowOpen(aSubject);
        break;
      }
      case "domwindowclosed": {
        self.onWindowClose(aSubject);
        break;
      }
    }
  },
  
  _getProgress: function(aWindow) {
    return aWindow.QueryInterface(Ci.nsIInterfaceRequestor)
                  .getInterface(Ci.nsIWebNavigation)
                  .QueryInterface(Ci.nsIDocShell)
                  .QueryInterface(Ci.nsIInterfaceRequestor)
                  .getInterface(Ci.nsIWebProgress);
  },

  onWindowOpen: function ss_onWindowOpen(aWindow) {
    // Return if window has already been initialized
    this._linkListeners[aWindow] = new EventLinkListener(aWindow);
    Services.embedlite.chromeEventHandler(aWindow).addEventListener("DOMLinkAdded", this._linkListeners[aWindow], false);
    this._getProgress(aWindow).addProgressListener(gProgressListener, Ci.nsIWebProgress.NOTIFY_LOCATION);
  },

  onWindowClose: function ss_onWindowClose(aWindow) {
    // Ignore windows not tracked by SessionStore
    Services.embedlite.chromeEventHandler(aWindow).removeEventListener("DOMLinkAdded", this._linkListeners[aWindow], false);
    delete this._linkListeners[aWindow];
    this._getProgress(aWindow).removeProgressListener(gProgressListener, Ci.nsIWebProgress.NOTIFY_LOCATION);
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference])
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([EmbedLiteFaviconService]);
