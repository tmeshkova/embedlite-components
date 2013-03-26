/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;
const Cc = Components.classes;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

const kEntities = { "geolocation": "geolocation",
                    "desktop-notification": "desktopNotification" };

function ContentPermissionPrompt() {}

ContentPermissionPrompt.prototype = {
  classID: Components.ID("{C6E8C44D-9F39-4AF7-BCC0-76E38A8310F5}"),

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIContentPermissionPrompt]),

  handleExistingPermission: function handleExistingPermission(request) {
    let result = Services.perms.testExactPermissionFromPrincipal(request.principal, request.type);
    if (result == Ci.nsIPermissionManager.ALLOW_ACTION) {
      request.allow();
      return true;
    }
    if (result == Ci.nsIPermissionManager.DENY_ACTION) {
      request.cancel();
      return true;
    }
    return false;
  },

  prompt: function(request) {
    // Returns true if the request was handled
    if (this.handleExistingPermission(request))
       return;

    let entityName = kEntities[request.type];
    dump("label:" + entityName + ".allow\n");
    dump("message = " + entityName + ".ask" + request.principal.URI.host + "\n");
    // Send Request
    let checkedDontAsk = false;
    let msg = "allow";
    if (msg == "allow") {
      // If the user checked "Don't ask again", make a permanent exception
      if (checkedDontAsk) {
        Services.perms.addFromPrincipal(request.principal, request.type, Ci.nsIPermissionManager.ALLOW_ACTION);
      } else if (entityName == "desktopNotification") {
        // For notifications, it doesn't make sense to grant permission once. So when the user clicks allow,
        // we let the requestor create notifications for the session.
        Services.perms.addFromPrincipal(request.principal, request.type, Ci.nsIPermissionManager.ALLOW_ACTION,
                                        Ci.nsIPermissionManager.EXPIRE_SESSION);
      }
      request.allow();
    } else if (msg == "dontAllow") {
        // If the user checked "Don't ask again", make a permanent exception
        if (checkedDontAsk)
          Services.perms.addFromPrincipal(request.principal, request.type, Ci.nsIPermissionManager.DENY_ACTION);
        request.cancel();
    }
  }
};

//module initialization
this.NSGetFactory = XPCOMUtils.generateNSGetFactory([ContentPermissionPrompt]);
