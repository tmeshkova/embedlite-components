/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

// -----------------------------------------------------------------------
// Download Manager UI
// -----------------------------------------------------------------------

function EmbedPrefService()
{
  dump("PREFS SERVICE INITAILIZED\n");
}

EmbedPrefService.prototype = {
  classID: Components.ID("{4c5563a0-94eb-11e2-a5f4-7f3c5758e2ae}"),

  _getPrefs: function AC_getPrefs() {
    let list = Services.prefs.getChildList("", {}).filter(function(element) {
      // Avoid displaying "private" preferences
      return !(/^capability\./.test(element));
    });

    let prefs = list.sort().map(this._getPref, this);
    return prefs;
  },

  _getPref: function AC_getPref(aPrefName) {
    let pref = {
      name: aPrefName,
      value:  "",
      modified: Services.prefs.prefHasUserValue(aPrefName),
      lock: Services.prefs.prefIsLocked(aPrefName),
      type: Services.prefs.getPrefType(aPrefName)
    };

    try {
      switch (pref.type) {
        case Ci.nsIPrefBranch.PREF_BOOL:
          pref.value = Services.prefs.getBoolPref(aPrefName).toString();
          break;
        case Ci.nsIPrefBranch.PREF_INT:
          pref.value = Services.prefs.getIntPref(aPrefName).toString();
          break;
        default:
        case Ci.nsIPrefBranch.PREF_STRING:
          pref.value = Services.prefs.getComplexValue(aPrefName, Ci.nsISupportsString).data;
          // Try in case it's a localized string (will throw an exception if not)
          if (pref.default && /^chrome:\/\/.+\/locale\/.+\.properties/.test(pref.value))
            pref.value = Services.prefs.getComplexValue(aPrefName, Ci.nsIPrefLocalizedString).data;
          break;
      }
    } catch (e) {}

    return pref;
  },

  observe: function (aSubject, aTopic, aData) {
    switch(aTopic) {
      // Engine DownloadManager notifications
      case "app-startup": {
        dump("EmbedPrefService app-startup\n");
        Services.obs.addObserver(this, "embedui:prefs", true);
        Services.obs.addObserver(this, "embedui:saveprefs", true);
        Services.obs.addObserver(this, "embedui:allprefs", true);
        break;
      }
      case "embedui:prefs": {
        var data = JSON.parse(aData);
        dump("UI Wants some prefs back: " + data.msg + "\n");
        let retPrefs = [];
        for (let pref of data.prefs) {
            dump("pref: " + pref + "\n");
            switch (Services.prefs.getPrefType(pref)) {
                case Services.prefs.PREF_BOOL:
                    retPrefs.push({ name: pref, value: Services.prefs.getBoolPref(pref)});
                    break;
                case Services.prefs.PREF_INT:
                    retPrefs.push({ name: pref, value: Services.prefs.getIntPref(pref)});
                    break;
                case Services.prefs.PREF_STRING:
                    retPrefs.push({ name: pref, value: Services.prefs.getCharPref(pref)});
                    break;
                case Services.prefs.PREF_INVALID:
                    continue;
            }
        }
        Services.obs.notifyObservers(null, "embed:prefs", JSON.stringify(retPrefs));
        break;
      }
      case "embedui:saveprefs": {
        Services.prefs.savePrefFile(null);
        break;
      }
      case "embedui:allprefs": {
        let prefs = this._getPrefs()
        Services.obs.notifyObservers(null, "embed:allprefs", JSON.stringify(prefs));
      }
    }
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference])
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([EmbedPrefService]);
