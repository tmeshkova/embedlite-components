/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * SmsProtocolHandle.js
 */

"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("chrome://embedlite/content/TelURIParser.jsm")

function SmsProtocolHandler() {
}

SmsProtocolHandler.prototype = {

  scheme: "sms",
  defaultPort: -1,
  protocolFlags: Ci.nsIProtocolHandler.URI_NORELATIVE |
                 Ci.nsIProtocolHandler.URI_NOAUTH |
                 Ci.nsIProtocolHandler.URI_LOADABLE_BY_ANYONE |
                 Ci.nsIProtocolHandler.URI_DOES_NOT_RETURN_DATA,
  allowPort: function() false,

  newURI: function Proto_newURI(aSpec, aOriginCharset) {
    let uri = Cc["@mozilla.org/network/simple-uri;1"].createInstance(Ci.nsIURI);
    uri.spec = aSpec;
    return uri;
  },

  newChannel: function Proto_newChannel(aURI) {
    let number = TelURIParser.parseURI('sms', aURI.spec);
    let body = "";
    let query = aURI.spec.split("?")[1];

    if (query) {
      let params = query.split("&");
      params.forEach(function(aParam) {
        let [name, value] = aParam.split("=");
        if (name === "body") {
          body = decodeURIComponent(value);
        }
      })
    }

    if (number || body) {
        let process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
        process.init(new FileUtils.File("/usr/bin/xdg-open"));
        process.run(false, [aURI.spec], 1);

        throw Components.results.NS_ERROR_ILLEGAL_VALUE;
    }
  },

  classID: Components.ID("{06827058-5807-4a23-a9fe-b21b9775702e}"),
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIProtocolHandler])
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([SmsProtocolHandler]);
