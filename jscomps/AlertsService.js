/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

// -----------------------------------------------------------------------
// Alerts Service
// -----------------------------------------------------------------------

function AlertsService() { }

AlertsService.prototype = {
  classID: Components.ID("{b98ab6b8-6c88-11e2-99bc-6745f7369235}"),
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIAlertsService]),

  showAlertNotification: function(aImageUrl, aTitle, aText, aTextClickable, aCookie, aAlertListener, aName) {
    dump("showAlertNotification: imgUrl:" + aImageUrl + ", title:" + aTitle + ", txt:" + aText + ", clickable:" + aTextClickable + ", cookie:" +  aCookie + ", listener:" + aAlertListener + ", Name:" + aName + "\n");
  }
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([AlertsService]);
