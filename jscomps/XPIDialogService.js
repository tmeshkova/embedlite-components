/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

// -----------------------------------------------------------------------
// Web Install Prompt service
// -----------------------------------------------------------------------

function WebInstallPrompt() { }

WebInstallPrompt.prototype = {
  classID: Components.ID("{ce2d8764-c366-11e2-8e71-1bb058e7ef52}"),
  QueryInterface: XPCOMUtils.generateQI([Ci.amIWebInstallPrompt]),

  confirm: function(aWindow, aURL, aInstalls) {

    let prompt = Services.prompt;
    let flags = prompt.BUTTON_POS_0 * prompt.BUTTON_TITLE_IS_STRING + prompt.BUTTON_POS_1 * prompt.BUTTON_TITLE_CANCEL;

    aInstalls.forEach(function(install) {
      // ConfirmEx not implemented yet
    let title = "Install Extension " + install.name;

//      let result = (prompt.confirm(aWindow, title, install.name, flags, "test.bt", null, null, null, {value: false}) == 0);
      let result = aWindow.confirm(title);
      if (result) {
        install.install();
      }
      else {
        install.cancel();
      }
    });
  }
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([WebInstallPrompt]);
