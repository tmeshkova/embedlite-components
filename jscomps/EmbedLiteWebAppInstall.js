/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

function EmbedLiteWebAppInstall()
{
}

EmbedLiteWebAppInstall.prototype = {
  classID: Components.ID("{62dea3ae-c36f-11e2-aa1d-b337e66c7a94}"),
  _initialized: false,

  observe: function (aSubject, aTopic, aData) {
    switch(aTopic) {
      // Engine DownloadManager notifications
      case "app-startup": {
        Services.obs.addObserver(this, "embedliteviewcreated", true);
        break;
      }
      case "embedliteviewcreated": {
        if (!this._initialized) {
          Services.obs.removeObserver(this, "embedliteviewcreated", true);
          this._initialized = true;
          WebappsUI.init();
        }
        break;
      }
    }
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference])
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([EmbedLiteWebAppInstall]);

var WebappsUI = {
  init: function init() {
    Cu.import("resource://gre/modules/Webapps.jsm");
    Cu.import("resource://gre/modules/AppsUtils.jsm");
    DOMApplicationRegistry.allAppsLaunchable = true;

    Services.obs.addObserver(this, "webapps-ask-install", false);
    Services.obs.addObserver(this, "webapps-launch", false);
    Services.obs.addObserver(this, "webapps-sync-install", false);
    Services.obs.addObserver(this, "webapps-sync-uninstall", false);
    Services.obs.addObserver(this, "webapps-install-error", false);
  },

  uninit: function unint() {
    Services.obs.removeObserver(this, "webapps-ask-install");
    Services.obs.removeObserver(this, "webapps-launch");
    Services.obs.removeObserver(this, "webapps-sync-install");
    Services.obs.removeObserver(this, "webapps-sync-uninstall");
    Services.obs.removeObserver(this, "webapps-install-error");
  },

  DEFAULT_PREFS_FILENAME: "default-prefs.js",

  observe: function observe(aSubject, aTopic, aData) {
    let data = {};
    try {
      data = JSON.parse(aData);
      data.mm = aSubject;
    } catch(ex) { }
    switch (aTopic) {
      case "webapps-install-error":
        let msg = "";
        switch (aData) {
          case "INVALID_MANIFEST":
          case "MANIFEST_PARSE_ERROR":
            msg = Strings.browser.GetStringFromName("webapps.manifestInstallError");
            break;
          case "NETWORK_ERROR":
          case "MANIFEST_URL_ERROR":
            msg = Strings.browser.GetStringFromName("webapps.networkInstallError");
            break;
          default:
            msg = Strings.browser.GetStringFromName("webapps.installError");
        }
        NativeWindow.toast.show(msg, "short");
        dump("Error installing app: " + aData + "\n");
        break;
      case "webapps-ask-install":
        this.doInstall(data);
        break;
      case "webapps-launch":
        this.openURL(data.manifestURL, data.origin);
        break;
      case "webapps-sync-install":
        // Create a system notification allowing the user to launch the app
        DOMApplicationRegistry.getManifestFor(data.origin, (function(aManifest) {
          if (!aManifest)
            return;
          let manifest = new ManifestHelper(aManifest, data.origin);

          let observer = {
            observe: function (aSubject, aTopic) {
              if (aTopic == "alertclickcallback") {
                WebappsUI.openURL(data.manifestURL, data.origin);
              }
            }
          };

          let message = Strings.browser.GetStringFromName("webapps.alertSuccess");
          let alerts = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
          alerts.showAlertNotification("drawable://alert_app", manifest.name, message, true, "", observer, "webapp");
        }).bind(this));
        break;
      case "webapps-sync-uninstall":
        let winid = Services.embedlite.getIDByWindow(Services.ww.activeWindow);
        Services.embedlite.sendAsyncMessage(winid, "WebApps:Uninstall", JSON.stringify({
          origin: data.origin
        }));
        break;
    }
  },

  getBiggestIcon: function getBiggestIcon(aIcons, aOrigin) {
    const DEFAULT_ICON = "chrome://browser/skin/images/default-app-icon.png";
    if (!aIcons)
      return DEFAULT_ICON;

    let iconSizes = Object.keys(aIcons);
    if (iconSizes.length == 0)
      return DEFAULT_ICON;
    iconSizes.sort(function(a, b) a - b);

    let biggestIcon = aIcons[iconSizes.pop()];
    let iconURI = null;
    try {
      iconURI = Services.io.newURI(biggestIcon, null, null);
      if (iconURI.scheme == "data") {
        return iconURI.spec;
      }
    } catch (ex) {
      // we don't have a biggestIcon or its not a valid url
    }

    // if we have an origin, try to resolve biggestIcon as a relative url
    if (!iconURI && aOrigin) {
      try {
        iconURI = Services.io.newURI(aOrigin.resolve(biggestIcon), null, null);
      } catch (ex) {
        dump("Could not resolve url: " + aOrigin.spec + " " + biggestIcon + " - " + ex + "\n");
      }
    }

    return iconURI ? iconURI.spec : DEFAULT_ICON;
  },

  doInstall: function doInstall(aData) {
    let jsonManifest = aData.isPackage ? aData.app.updateManifest : aData.app.manifest;
    let manifest = new ManifestHelper(jsonManifest, aData.app.origin);
    let name = manifest.name ? manifest.name : manifest.fullLaunchPath();
    let showPrompt = true;

//    if (!showPrompt || Services.prompt.confirm(null, "Install Web App", name + "\n" + aData.app.origin)) {
    if (!showPrompt || Services.ww.activeWindow.confirm(name + "\n" + aData.app.origin)) {
      // Get a profile for the app to be installed in. We'll download everything before creating the icons.
      let winid = Services.embedlite.getIDByWindow(Services.ww.activeWindow);
      let message = JSON.stringify({
          name: manifest.name,
          manifestURL: aData.app.manifestURL,
          origin: aData.app.origin
      });
      let response = Services.embedlite.sendSyncMessage(winid, "WebApps:PreInstall", message);
      profilePath = JSON.parse(response).path;
      let file = null;
      if (profilePath) {
        file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
        file.initWithPath(profilePath);

        // build any app specific default prefs
        let prefs = [];
        if (manifest.orientation) {
          prefs.push({name:"app.orientation.default", value: manifest.orientation});
        }

        // write them into the app profile
        let defaultPrefsFile = file.clone();
        defaultPrefsFile.append(this.DEFAULT_PREFS_FILENAME);
        this.writeDefaultPrefs(defaultPrefsFile, prefs);

        let self = this;
        DOMApplicationRegistry.confirmInstall(aData, false, file, null,
          function (manifest) {
            // the manifest argument is the manifest from within the zip file,
            // TODO so now would be a good time to ask about permissions.
            self.makeBase64Icon(self.getBiggestIcon(manifest.icons, Services.io.newURI(aData.app.origin, null, null)),
              function(scaledIcon, fullsizeIcon) {
                // if java returned a profile path to us, try to use it to pre-populate the app cache
                // also save the icon so that it can be used in the splash screen
                try {
                  let iconFile = file.clone();
                  iconFile.append("logo.png");
                  let persist = Cc["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].createInstance(Ci.nsIWebBrowserPersist);
                  persist.persistFlags = Ci.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES;
                  persist.persistFlags |= Ci.nsIWebBrowserPersist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;

                  let source = Services.io.newURI(fullsizeIcon, "UTF8", null);
                  persist.saveURI(source, null, null, null, null, iconFile, null);

                  Services.embedlite.sendAsyncMessage(winid, "WebApps:PostInstall", JSON.stringify({
                    name: manifest.name,
                    manifestURL: aData.app.manifestURL,
                    origin: aData.app.origin,
                    iconURL: fullsizeIcon
                  }));
                  if (!!aData.isPackage) {
                    // For packaged apps, put a notification in the notification bar.
                    let message = Strings.browser.GetStringFromName("webapps.alertSuccess");
                    let alerts = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
                    alerts.showAlertNotification("drawable://alert_app", manifest.name, message, true, "", {
                      observe: function () {
                        self.openURL(aData.app.manifestURL, aData.app.origin);
                      }
                    }, "webapp");
                  }
                } catch(ex) {
                  dump(ex + "\n");
                }
              }
            );
          }
        );
      }
    } else {
      DOMApplicationRegistry.denyInstall(aData);
    }
  },

  writeDefaultPrefs: function webapps_writeDefaultPrefs(aFile, aPrefs) {
    if (aPrefs.length > 0) {
      let data = JSON.stringify(aPrefs);

      let ostream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
      ostream.init(aFile, -1, -1, 0);

      let istream = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
      istream.setData(data, data.length);

      NetUtil.asyncCopy(istream, ostream, function(aResult) {
        if (!Components.isSuccessCode(aResult)) {
          dump("Error writing default prefs: " + aResult + "\n");
        }
      });
    }
  },

  openURL: function openURL(aManifestURL, aOrigin) {
    let winid = Services.embedlite.getIDByWindow(Services.ww.activeWindow);
    Services.embedlite.sendAsyncMessage(winid, "WebApps:Open", JSON.stringify({
      manifestURL: aManifestURL,
      origin: aOrigin
    }));
  },

  get iconSize() {
    let iconSize = 64;
    delete this.iconSize;
    return this.iconSize = iconSize;
  },

  makeBase64Icon: function loadAndMakeBase64Icon(aIconURL, aCallbackFunction) {
    let size = this.iconSize;

    let canvas = Services.ww.activeWindow.document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
    canvas.width = canvas.height = size;
    let ctx = canvas.getContext("2d");
    let favicon = Services.ww.activeWindow.document.createElementNS("http://www.w3.org/1999/xhtml", "image");
    favicon.onload = function() {
      ctx.drawImage(favicon, 0, 0, size, size);
      let scaledIcon = canvas.toDataURL("image/png", "");

      canvas.width = favicon.width;
      canvas.height = favicon.height;
      ctx.drawImage(favicon, 0, 0, favicon.width, favicon.height);
      let fullsizeIcon = canvas.toDataURL("image/png", "");

      canvas = null;
      aCallbackFunction.call(null, scaledIcon, fullsizeIcon);
    };
    favicon.onerror = function() {
      Cu.reportError("CreateShortcut: favicon image load error");

      // if the image failed to load, and it was not our default icon, attempt to
      // use our default as a fallback
      let uri = Services.io.newURI(favicon.src, null, null);
      if (!/^chrome$/.test(uri.scheme)) {
        favicon.src = WebappsUI.getBiggestIcon(null);
      }
    };

    favicon.src = aIconURL;
  },

  createShortcut: function createShortcut(aTitle, aURL, aIconURL, aType) {
    this.makeBase64Icon(aIconURL, function _createShortcut(icon) {
      try {
        let shell = Cc["@mozilla.org/browser/shell-service;1"].createInstance(Ci.nsIShellService);
        shell.createShortcut(aTitle, aURL, icon, aType);
      } catch(e) {
        Cu.reportError(e);
      }
    });
  }
}
