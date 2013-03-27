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

  observe: function (aSubject, aTopic, aData) {
    switch(aTopic) {
      // Engine DownloadManager notifications
      case "app-startup": {
        dump("EmbedPrefService app-startup\n");
        Services.obs.addObserver(this, "embedui:prefs", true);
        Services.obs.addObserver(this, "embedui:saveprefs", true);
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
    }
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference])
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([EmbedPrefService]);
