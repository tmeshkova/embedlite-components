/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;
const Cc = Components.classes;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyServiceGetter(Services, "embedlite",
                                    "@mozilla.org/embedlite-app-service;1",
                                    "nsIEmbedAppService");

const kEntities = { "geolocation": "geolocation",
                    "desktop-notification": "desktopNotification" };

function ContentPermissionPrompt() {}

ContentPermissionPrompt.prototype = {
  classID: Components.ID("{C6E8C44D-9F39-4AF7-BCC0-76E38A8310F5}"),

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIContentPermissionPrompt, Ci.nsIEmbedMessageListener]),
  _pendingRequests: {},

  _getReqKey: function(request, type) {
    return request.principal.URI.host + " " + type;
  },

  handleExistingPermission: function handleExistingPermission(request, type) {
    let result = Services.perms.testExactPermissionFromPrincipal(request.principal, type);
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

  onMessageReceived: function(messageName, message) {
    dump("ContentPermissionPrompt.js on message received: top:" + messageName + ", msg:" + message + "\n");
    var ret = JSON.parse(message);
    // Send Request
    if (!ret.id) {
        dump("request id not defined in response\n");
        return;
    }
    let cachedreqs = this._pendingRequests[ret.id];
    if (!cachedreqs || cachedreqs.length < 1) {
        dump("Wrong request id:" + ret.id + "\n");
        return;
    }
    let request = cachedreqs[0];

    let types = request.types.QueryInterface(Ci.nsIArray);
    let perm = types.queryElementAt(0, Ci.nsIContentPermissionType);

    Services.embedlite.removeMessageListener("embedui:premissions", this);
    let entityName = kEntities[perm.type];
    if (ret.allow) {
      // If the user checked "Don't ask again", make a permanent exception
      if (ret.checkedDontAsk) {
        Services.perms.addFromPrincipal(request.principal, perm.type, Ci.nsIPermissionManager.ALLOW_ACTION);
      } else if (entityName == "desktopNotification") {
        // For notifications, it doesn't make sense to grant permission once. So when the user clicks allow,
        // we let the requestor create notifications for the session.
        Services.perms.addFromPrincipal(request.principal, perm.type, Ci.nsIPermissionManager.ALLOW_ACTION,
                                        Ci.nsIPermissionManager.EXPIRE_SESSION);
      }
      cachedreqs.forEach(function(r) { r.allow(); });
    } else {
      // If the user checked "Don't ask again", make a permanent exception
      if (ret.checkedDontAsk) {
        Services.perms.addFromPrincipal(request.principal, perm.type, Ci.nsIPermissionManager.DENY_ACTION);
      }
      cachedreqs.forEach(function(r) { r.cancel(); });
    }
    delete this._pendingRequests[ret.id];
  },

  prompt: function(request) {
    // Only allow exactly one permission request here.
    let types = request.types.QueryInterface(Ci.nsIArray);
    if (types.length != 1) {
      request.cancel();
      return;
    }
    let perm = types.queryElementAt(0, Ci.nsIContentPermissionType);

    // Returns true if the request was handled
    if (this.handleExistingPermission(request, perm.type)) {
       return;
    }

    let reqkey = this._getReqKey(request, perm.type);

    let cachedreqs = this._pendingRequests[reqkey];
    if (cachedreqs && cachedreqs.length) {
      // There is already an unanswered permission request of this type and for
      // this URL -> cache this request and avoid asking the user again.
      this._pendingRequests[reqkey].push(request);
      return;
    } else {
      this._pendingRequests[reqkey] = [request];
    }

    let entityName = kEntities[perm.type];

    Services.embedlite.addMessageListener("embedui:premissions", this);
    var winid = Services.embedlite.getIDByWindow(request.window);
    Services.embedlite.sendAsyncMessage(winid, "embed:permissions",
                                        JSON.stringify({title: entityName,
                                                        host: request.principal.URI.host,
                                                        id: reqkey}));
  }
};

//module initialization
this.NSGetFactory = XPCOMUtils.generateNSGetFactory([ContentPermissionPrompt]);
