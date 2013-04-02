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
    Cu.import("resource://services-sync/constants.js");
    Cu.import("resource://services-sync/service.js");
    Cu.import("resource://services-sync/policies.js");
    Cu.import("resource://services-sync/util.js");
    Cu.import("resource://services-sync/engines.js");
    Cu.import("resource://services-sync/engines/tabs.js")
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
        Services.obs.addObserver(this, "embedui:initsync", true);
        break;
      }
      case "embedui:initsync": {
        dump("EmbedLiteSyncService embedui:initsync\n");
        var data = JSON.parse(aData);
        EmbedLiteSyncServiceImpotUtils();
        Service.login(data.username, data.password, data.key);
        Utils.jsonSave("foo", {}, ["v1", "v2"], function(error) {
          Utils.jsonLoad("foo", {}, function(val) {
            let foo = val;
            dump("Load foo:" + foo + "\n");
          });
        });
        break;
      }
    }
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference])
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([EmbedLiteSyncService]);
