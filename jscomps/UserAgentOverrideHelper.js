/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "UserAgentOverrides",
                                  "resource://gre/modules/UserAgentOverrides.jsm");

// Common helper service

function UserAgentOverrideHelper()
{
}

UserAgentOverrideHelper.prototype = {
  classID: Components.ID("{69d68654-b5a0-11e2-bb91-2b8ad5eb98ac}"),

  observe: function (aSubject, aTopic, aData) {
    switch(aTopic) {
      // Engine DownloadManager notifications
      case "app-startup": {
        dump("UserAgentOverrideHelper app-startup\n");
        Services.obs.addObserver(this, "embedliteviewcreated", true);
        Services.obs.addObserver(this, "xpcom-shutdown", false);
        Services.prefs.addObserver("general.useragent.override", this, false);
        break;
      }
      case "nsPref:changed": {
        if (aData == "general.useragent.override") {
          UserAgent.init();
        }
        break;
      }
      case "embedliteviewcreated": {
        UserAgent.init();
        break;
      }

      case "xpcom-shutdown": {
        dump("UserAgentOverrideHelper xpcom-shutdown\n");
        Services.obs.removeObserver(this, "xpcom-shutdown", false);
        UserAgent.uninit();
        break;
      }
    }
  },

  getUserAgentForURIAndWindow: function ssua_getUserAgentForURIAndWindow(aURI, aWindow) {
    return UserAgent.getUserAgentForWindow(aURI, aWindow)
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsISiteSpecificUserAgent, Ci.nsIObserver,
                                         Ci.nsISupportsWeakReference, Ci.nsIFormSubmitObserver])
};

var UserAgent = {
  _desktopMode: false,
  _customUA: null,
  overrideMap: new Map,
  initilized: false,
  DESKTOP_UA: null,
  GOOGLE_DOMAIN: /(^|\.)google\.com$/,
  GOOGLE_MAPS_DOMAIN: /(^|\.)maps\.google\.com$/,
  YOUTUBE_DOMAIN: /(^|\.)youtube\.com$/,
  NOKIA_HERE_DOMAIN: /(^|\.)here\.com$/,

  init: function ua_init() {
    if (this.initilized) {
      return
    }

    Services.obs.addObserver(this, "DesktopMode:Change", false);
    Services.prefs.addObserver("general.useragent.override", this, false);
    this._customUA = this.getCustomUserAgent();
    UserAgentOverrides.init();
    UserAgentOverrides.addComplexOverride(this.onRequest.bind(this));
    // See https://developer.mozilla.org/en/Gecko_user_agent_string_reference
    this.DESKTOP_UA = Cc["@mozilla.org/network/protocol;1?name=http"]
                        .getService(Ci.nsIHttpProtocolHandler).userAgent
                        .replace(/Android; [a-zA-Z]+/, "X11; Linux x86_64")
                        .replace(/Gecko\/[0-9\.]+/, "Gecko/20100101");
    this.initilized = true;
  },

  getCustomUserAgent: function() {
    if (Services.prefs.prefHasUserValue("general.useragent.override")) {
      let ua = Services.prefs.getCharPref("general.useragent.override");
      return ua;
    } else {
      return null;
    }
  },

  getDefaultUserAgent : function ua_getDefaultUserAgent() {
    // Send desktop UA if "Request Desktop Site" is enabled.
    if (this._desktopMode)
      return this.DESKTOP_UA;

    return this._customUA ? this._customUA : defaultUA;
  },

  getUserAgentForUriAndTab: function ua_getUserAgentForUriAndTab(aUri) {
    let ua = this.getDefaultUserAgent();
    // Not all schemes have a host member.
    if (aUri.schemeIs("http") || aUri.schemeIs("https")) {
      if (this.GOOGLE_DOMAIN.test(aUri.host)) {
        if (this.GOOGLE_MAPS_DOMAIN.test(aUri.host)) {
            return ua.replace("X11", "Android").replace("Linux", "Android");
        }

        // Send the phone UA to google
        if (!ua.contains("Mobile")) {
          return ua.replace("X11", "Android").replace("Unix", "Android").replace("Linux", "Mobile");
        }
      } else if (this.YOUTUBE_DOMAIN.test(aUri.host)) {
        // Send the phone UA to google
        if (!ua.contains("Safari")) {
          ua = ua + " like Safari/538.1";
        }
        if (!ua.contains("Android")) {
          // Nexus 7 Android chrome has best capabilities
          if (ua.contains("Mobile")) {
            return ua.replace("Linux", "Android 4.4.2").replace("Unix", "Android 4.4.2").replace("Mobile", "").replace("Maemo", "");
          } else {
            return ua.replace("Linux", "Android 4.4.2").replace("Unix", "Android 4.4.2");
          }
        }
      } else if (this.NOKIA_HERE_DOMAIN.test(aUri.host)) {
        // Send the phone UA to here
        if (!ua.contains("Mobile")) {
          return ua.replace("X11", "Android").replace("Unix", "Android").replace("Linux", "Mobile");
        }
      }
    }

    return "";
  },

  uninit: function ua_uninit() {
    Services.obs.removeObserver(this, "DesktopMode:Change");
    Services.prefs.removeObserver("general.useragent.override", this);
    UserAgentOverrides.uninit();
  },

  // Complex override calls this first.
  onRequest: function(channel, defaultUA) {
    let channelWindow = this._getWindowForRequest(channel);
    let ua = "";
    let host = channel.URI.asciiHost
    let windowHost = channelWindow && channelWindow.location.hostname || "";

    if (!channelWindow) {
      ua = this.getDefaultUserAgent()
    } else if (this.overrideMap.has(host)) {
      ua = this.overrideMap.get(host);
    } else if (this.overrideMap.has(windowHost)) {
      ua = this.overrideMap.get(windowHost);
    } else {
      ua = this.getUserAgentForWindow(channel.URI, channelWindow);
    }
    return ua
  },

  // Called if onRequest returns empty user-agent.
  getUserAgentForWindow: function ua_getUserAgentForWindow(aUri, aWindow) {
    // Try to pick 'general.useragent.override.*'
    let ua = UserAgentOverrides.getOverrideForURI(aUri)
    if (!ua) {
      ua = this.getUserAgentForUriAndTab(aUri);
    }

    if (ua) {
      this.overrideMap.set(aUri.asciiHost, ua)
      return ua
    }

    return this.getDefaultUserAgent();
  },

  _getRequestLoadContext: function ua_getRequestLoadContext(aRequest) {
    if (aRequest && aRequest.notificationCallbacks) {
      try {
        return aRequest.notificationCallbacks.getInterface(Ci.nsILoadContext);
      } catch (ex) { }
    }

    if (aRequest && aRequest.loadGroup && aRequest.loadGroup.notificationCallbacks) {
      try {
        return aRequest.loadGroup.notificationCallbacks.getInterface(Ci.nsILoadContext);
      } catch (ex) { }
    }

    return null;
  },

  _getWindowForRequest: function ua_getWindowForRequest(aRequest) {
    let loadContext = this._getRequestLoadContext(aRequest);
    if (loadContext)
      return loadContext.associatedWindow;
    return null;
  },

  observe: function ua_observe(aSubject, aTopic, aData) {
    switch (aTopic) {
      case "DesktopMode:Change": {
        //let args = JSON.parse(aData);
        //dump("UserAgentOverrideHelper observe:" + aTopic + "\n");
        break;
      }
      case "nsPref:changed": {
        if (aData == "general.useragent.override") {
          this._customUA = this.getCustomUserAgent();
        }
        break;
      }
    }
  }
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([UserAgentOverrideHelper]);
