/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");


function EmbedLiteSyncServiceImpotUtils()
{
    Cu.import("resource://services-common/log4moz.js");
    Cu.import("resource://services-sync/main.js");
    Cu.import("resource://services-sync/constants.js");
    Cu.import("resource://services-sync/service.js");
    Cu.import("resource://services-sync/policies.js");
    Cu.import("resource://services-sync/util.js");
    Cu.import("resource://services-sync/engines.js");
    Cu.import("resource://services-sync/record.js");
    Cu.import("resource://services-sync/engines/history.js");
    Cu.import("resource://services-sync/engines/apps.js");
    Cu.import("resource://services-sync/engines/forms.js");
    Cu.import("resource://services-sync/engines/passwords.js");
    Cu.import("resource://services-sync/engines/prefs.js");
    Cu.import("resource://services-sync/engines/tabs.js");
    Cu.import("chrome://embedlite/content/sync/bookmarks.js");
}

// Common helper service

function EmbedLiteSyncService()
{
}


EmbedLiteSyncService.prototype = {
  classID: Components.ID("{36896ad0-9b49-11e2-ae7c-6f7993904c41}"),

  observe: function (aSubject, aTopic, aData) {
    switch(aTopic) {
      // Engine DownloadManager notifications
      case "app-startup": {
        dump("EmbedLiteSyncService app-startup\n");
        Services.prefs.setCharPref("services.sync.registerEngines", "Tab,Bookmarks,Form,History,Password,Prefs");
        Services.obs.addObserver(this, "embedui:initsync", true);
        break;
      }
      case "embedui:initsync": {
        dump("EmbedLiteSyncService embedui:initsync\n");
        var data = JSON.parse(aData);
        EmbedLiteSyncServiceImpotUtils();
        Service.login(data.username, data.password, data.key);
        //this.embedLiteSyncServiceFetchBookmarks();
        //this.embedLiteSyncServiceFetchHistory();
        //this.embedLiteSyncServiceFetchTabs();
        //this.embedLiteSyncServiceFetchForms();
        //this.embedLiteSyncServiceFetchPassword();
        //this.embedLiteSyncServiceFetchPrefs();
        break;
      }
    }
  },

  _embedLiteSyncServiceFetch: function (collection, Type, callback) {
    let key = Service.collectionKeys.keyForCollection(collection);
    let coll = new Collection(Service.storageURL + collection, Type, Service);
    coll.full = true;
    coll.recordHandler = function(item) {
      item.collection = collection;
      item.decrypt(key);
      callback(item.cleartext);
    };
    coll.get();
  },

  embedLiteSyncServiceFetchBookmarks: function () {
    this._embedLiteSyncServiceFetch("bookmarks", PlacesItem, function(item) {
      if (item.type == "bookmark") {
        dump("Title: " + item.title + ", Uri: " + item.bmkUri + "\n");
      }
    });
  },

  embedLiteSyncServiceFetchHistory: function () {
    this._embedLiteSyncServiceFetch("history", HistoryRec, function(item) {
      dump("Title: " +  item.title + ", Uri:" +  item.histUri + "\n");
    });
  },

  embedLiteSyncServiceFetchTabs: function () {
    this._embedLiteSyncServiceFetch("tabs", TabSetRecord, function(item) {
      dump('Tab:' + JSON.stringify(item) + "\n");
    });
  },
  embedLiteSyncServiceFetchForms: function () {
    this._embedLiteSyncServiceFetch("forms", FormRec, function(item) {
      dump('Forms:' + JSON.stringify(item) + "\n");
    });
  },
  embedLiteSyncServiceFetchPassword: function () {
    this._embedLiteSyncServiceFetch("passwords", LoginRec, function(item) {
      dump('Login:' + JSON.stringify(item) + "\n");
    });
  },
  embedLiteSyncServiceFetchPrefs: function () {
    this._embedLiteSyncServiceFetch("prefs", PrefRec, function(item) {
      dump('Pref:' + JSON.stringify(item) + "\n");
    });
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference])
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([EmbedLiteSyncService]);
