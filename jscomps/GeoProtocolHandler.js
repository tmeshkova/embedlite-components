/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * GeoProtocolHandle.js
 */

"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import("resource://gre/modules/FileUtils.jsm");

function GeoProtocolHandler() {
}

GeoProtocolHandler.prototype = {

  scheme: "geo",
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
    let process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
    process.init(new FileUtils.File("/usr/bin/xdg-open"));
    process.run(false, [aURI.spec], 1);

    throw Components.results.NS_ERROR_ILLEGAL_VALUE;
  },

  classID: Components.ID("{0b452f2d-c6b3-4aee-9a73-dec5a812d2e3}"),
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIProtocolHandler])
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([GeoProtocolHandler]);
