/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/PrivateBrowsingUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "NetUtil",
                                  "resource://gre/modules/NetUtil.jsm");
XPCOMUtils.defineLazyServiceGetter(Services, "embedlite",
                                   "@mozilla.org/embedlite-app-service;1",
                                   "nsIEmbedAppService");

// Common helper service

function EmbedLiteErrorPageHandler()
{
}

function EventLinkListener(aWindow)
{
  this._winID = Services.embedlite.getIDByWindow(aWindow);
  this._targetWindow = Services.embedlite.getContentWindowByID(this._winID);
}

EventLinkListener.prototype = {
  _winID: -1,
  _targetWindow: null,
  handleEvent: function Input_handleEvent(aEvent) {
    switch (aEvent.type) {
      case "DOMContentLoaded": {
        let target = aEvent.originalTarget;
        // Attach a listener to watch for "click" events bubbling up from error
        // pages and other similar page. This lets us fix bugs like 401575 which
        // require error page UI to do privileged things, without letting error
        // pages have any privilege themselves.
        if (/^about:/.test(target.documentURI)) {
          ErrorPageEventHandler._targetWindow = this._targetWindow;
          Services.embedlite.chromeEventHandler(this._targetWindow).addEventListener("click", ErrorPageEventHandler, true);
          let listener = function() {
            Services.embedlite.chromeEventHandler(this._targetWindow).removeEventListener("click", ErrorPageEventHandler, true);
            Services.embedlite.chromeEventHandler(this._targetWindow).removeEventListener("pagehide", listener, true);
            ErrorPageEventHandler._targetWindow = null;
          }.bind(this);

          Services.embedlite.chromeEventHandler(this._targetWindow).addEventListener("pagehide", listener, true);
        }

        break;
      }
    }
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIDOMEventListener])
};

EmbedLiteErrorPageHandler.prototype = {
  classID: Components.ID("{ad8b729c-b000-11e2-8ed2-bfd39531b0a6}"),
  _linkListeners: {},

  observe: function (aSubject, aTopic, aData) {
    let self = this;
    switch(aTopic) {
      case "app-startup": {
        // Name of alternate about: page for certificate errors (when undefined, defaults to about:neterror)
        Services.obs.addObserver(this, "embedliteviewcreated", true);
        Services.obs.addObserver(this, "domwindowclosed", true);
        Services.obs.addObserver(this, "xpcom-shutdown", true);
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
      case "xpcom-shutdown": {
        Services.obs.removeObserver(this, "embedliteviewcreated", true);
        Services.obs.removeObserver(this, "domwindowclosed", true);
        Services.obs.removeObserver(this, "xpcom-shutdown", true);
      }
    }
  },

  onWindowOpen: function ss_onWindowOpen(aWindow) {
    // Return if window has already been initialized
    this._linkListeners[aWindow] = new EventLinkListener(aWindow);
    try {
      Services.embedlite.chromeEventHandler(aWindow).addEventListener("DOMContentLoaded", this._linkListeners[aWindow], false);
    } catch (e) {}
  },

  onWindowClose: function ss_onWindowClose(aWindow) {
    // Ignore windows not tracked by SessionStore
    try {
      Services.embedlite.chromeEventHandler(aWindow).removeEventListener("DOMContentLoaded", this._linkListeners[aWindow], false);
    } catch (e) {}
    delete this._linkListeners[aWindow];
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference])
};

var ErrorPageEventHandler = {
  _targetWindow: null,
  handleEvent: function(aEvent) {
    switch (aEvent.type) {
      case "click": {
        // Don't trust synthetic events
        if (!aEvent.isTrusted)
          return;

        let target = aEvent.originalTarget;
        let errorDoc = target.ownerDocument;

        // If the event came from an ssl error page, it is probably either the "Add
        // Exception…" or "Get me out of here!" button
        if (/^about:certerror\?e=nssBadCert/.test(errorDoc.documentURI)) {
          let perm = errorDoc.getElementById("permanentExceptionButton");
          let temp = errorDoc.getElementById("temporaryExceptionButton");
          if (target == temp || target == perm) {
            // Handle setting an cert exception and reloading the page
            try {
              // Add a new SSL exception for this URL
              let uri = Services.io.newURI(errorDoc.location.href, null, null);
              let sslExceptions = new SSLExceptions();

              if (target == perm) {
                sslExceptions.addPermanentException(uri, errorDoc.defaultView, this._targetWindow);
              }
              else {
                sslExceptions.addTemporaryException(uri, errorDoc.defaultView, this._targetWindow);
              }
            } catch (e) {
              dump("Failed to set cert exception: " + e + "\n");
            }
            errorDoc.location.reload();
          } else if (target == errorDoc.getElementById("getMeOutOfHereButton")) {
            errorDoc.location = "about:home";
          }
        }
        break;
      }
    }
  }
};

/**
  A class to add exceptions to override SSL certificate problems. The functionality
  itself is borrowed from exceptionDialog.js.
*/
function SSLExceptions() {
  this._overrideService = Cc["@mozilla.org/security/certoverride;1"]
                          .getService(Ci.nsICertOverrideService);
}


SSLExceptions.prototype = {
  _overrideService: null,
  _sslStatus: null,

  getInterface: function SSLE_getInterface(aIID) {
    return this.QueryInterface(aIID);
  },
  QueryInterface: function SSLE_QueryInterface(aIID) {
    if (aIID.equals(Ci.nsIBadCertListener2) ||
        aIID.equals(Ci.nsISupports))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  /**
    To collect the SSL status we intercept the certificate error here
    and store the status for later use.
  */
  notifyCertProblem: function SSLE_notifyCertProblem(socketInfo, sslStatus, targetHost) {
    this._sslStatus = sslStatus.QueryInterface(Ci.nsISSLStatus);
    return true; // suppress error UI
  },

  /**
    Attempt to download the certificate for the location specified to get the SSLState
    for the certificate and the errors.
   */
  _checkCert: function SSLE_checkCert(aURI, aWindow) {
    this._sslStatus = null;

    dump("Check server Cert:" + aURI.prePath + "\n");
    let req = new aWindow.XMLHttpRequest();
    try {
      if (aURI) {
        req.open("GET", aURI.prePath, false);
        req.channel.notificationCallbacks = this;
        req.send(null);
      }
    } catch (e) {
      // We *expect* exceptions if there are problems with the certificate
      // presented by the site.  Log it, just in case, but we can proceed here,
      // with appropriate sanity checks
      Components.utils.reportError("Attempted to connect to a site with a bad certificate in the add exception dialog. " +
                                   "This results in a (mostly harmless) exception being thrown. " +
                                   "Logged for information purposes only: " + e);
    }

    return this._sslStatus;
  },

  /**
    Internal method to create an override.
  */
  _addOverride: function SSLE_addOverride(aURI, aWindow, aTargetWindow, aTemporary) {
    let SSLStatus = this._checkCert(aURI, aTargetWindow);
    let certificate = SSLStatus.serverCert;

    let flags = 0;

    // in private browsing do not store exceptions permanently ever
    if (PrivateBrowsingUtils.isWindowPrivate(aWindow)) {
      aTemporary = true;
    }

    if (SSLStatus.isUntrusted)
      flags |= this._overrideService.ERROR_UNTRUSTED;
    if (SSLStatus.isDomainMismatch)
      flags |= this._overrideService.ERROR_MISMATCH;
    if (SSLStatus.isNotValidAtThisTime)
      flags |= this._overrideService.ERROR_TIME;

    this._overrideService.rememberValidityOverride(
      aURI.asciiHost,
      aURI.port,
      certificate,
      flags,
      aTemporary);
  },

  /**
    Creates a permanent exception to override all overridable errors for
    the given URL.
  */
  addPermanentException: function SSLE_addPermanentException(aURI, aWindow, aTargetWindow) {
    this._addOverride(aURI, aWindow, aTargetWindow, false);
  },

  /**
    Creates a temporary exception to override all overridable errors for
    the given URL.
  */
  addTemporaryException: function SSLE_addTemporaryException(aURI, aWindow, aTargetWindow) {
    this._addOverride(aURI, aWindow, aTargetWindow, true);
  }
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([EmbedLiteErrorPageHandler]);
