/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

function DownloadProgressListener() {
}

DownloadProgressListener.prototype = {
  onDownloadStateChange: function dPL_onDownloadStateChange(aState, aDownload) {
    let state = aDownload.state;
    switch (state) {
      case Ci.nsIDownloadManager.DOWNLOAD_QUEUED:
      case Ci.nsIDownloadManager.DOWNLOAD_BLOCKED_POLICY:
        // addDownload(aDownload);
        dump("Download item queued:" + state + "\n");
        break;
      case Ci.nsIDownloadManager.DOWNLOAD_FAILED:
      case Ci.nsIDownloadManager.DOWNLOAD_CANCELED:
      case Ci.nsIDownloadManager.DOWNLOAD_BLOCKED_PARENTAL:
      case Ci.nsIDownloadManager.DOWNLOAD_DIRTY:
      case Ci.nsIDownloadManager.DOWNLOAD_FINISHED:
        dump("Download Failed: " + state + "\n");
        break;
    }
  },

  onProgressChange: function dPL_onProgressChange(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress, aDownload) {
    dump("Download Progress changed: cur:" + aCurTotalProgress + ", total:" + aMaxTotalProgress + "\n");
  },

  onStateChange: function(aWebProgress, aRequest, aState, aStatus, aDownload)
  {
    dump("Download State change: " + aState + ", status:" + aStatus + " \n");
  },
  onSecurityChange: function(aWebProgress, aRequest, aState, aDownload)
  {
    dump("Download Security change\n");
  },

  //////////////////////////////////////////////////////////////////////////////
  //// nsISupports
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIDownloadProgressListener])
};

// -----------------------------------------------------------------------
// Download Manager UI
// -----------------------------------------------------------------------

function DownloadManagerUI() { }

DownloadManagerUI.prototype = {
  classID: Components.ID("{93db15b1-b408-453e-9a2b-6619e168324a}"),
  _progress: null,

  get manager() {
    return Cc["@mozilla.org/download-manager;1"]
             .getService(Ci.nsIDownloadManager);
  },

  show: function show(aWindowContext, aDownload, aReason, aUsePrivateUI) {
    dump("DownloadManagerUI show: ctx:" + aWindowContext + ", download:" + aDownload + ", reason:" + aReason + ", usePrivUI:" + aUsePrivateUI + "\n");
    if (!aReason)
      aReason = Ci.nsIDownloadManagerUI.REASON_USER_INTERACTED;
    this._progress = new DownloadProgressListener();
    this.manager.addListener(this._progress);

    return;
  },

  get visible() {
    dump("DownloadManagerUI get visible\n");
    return false;
  },

  getAttention: function getAttention() {
    dump("DownloadManagerUI getAttention\n");
    return;
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIDownloadManagerUI])
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([DownloadManagerUI]);
