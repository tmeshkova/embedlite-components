/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

let DownloadListener = {
  init: function () {
    Services.obs.addObserver(this, "dl-start", true);
    Services.obs.addObserver(this, "dl-done", true);
    Services.obs.addObserver(this, "dl-cancel", true);
    Services.obs.addObserver(this, "dl-fail", true);
  },

  observe: function (aSubject, aTopic, aData) {
    let dl = aSubject.QueryInterface(Ci.nsIDownload);
    switch(aTopic) {
      // Engine DownloadManager notifications
      case "dl-start":
        Services.obs.notifyObservers(null, "embed:download", JSON.stringify({msg: "dl-start", id: dl.id}));
        break;
      case "dl-cancel":
        Services.obs.notifyObservers(null, "embed:download", JSON.stringify({msg: "dl-cancel", id: dl.id}));
        break;
      case "dl-fail":
        Services.obs.notifyObservers(null, "embed:download", JSON.stringify({msg: "dl-fail", id: dl.id}));
        break;
      case "dl-done":
        Services.obs.notifyObservers(null, "embed:download", JSON.stringify({msg: "dl-done", id: dl.id}));
        break;
    }
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver,
                                         Ci.nsISupportsWeakReference])
}

let DownloadUIListener = {
  init: function () {
    Services.obs.addObserver(this, "embedui:download", true);
  },

  observe: function (aSubject, aTopic, aData) {
    switch(aTopic) {
      // Engine DownloadManager notifications
      case "embedui:download": {
        var data = JSON.parse(aData);
        if (data.msg == "requestDownloadsList") {
          let downloads = Services.downloads.activeDownloads;
          if (downloads && downloads.hasMoreElements()) {
            dump("DownloadManagerUI: message from EmbedUI: " + data.msg + ", downloads:" + downloads + "\n");
            var downloadsData = [];
            while (downloads.hasMoreElements()) {
              let dl = downloads.getNext().QueryInterface(Ci.nsIDownload);
              downloadsData.push({ id: dl.id, from: dl.source.spec, to: dl.target.spec });
            }
            Services.obs.notifyObservers(null, "embed:download", JSON.stringify({msg: "dl-list", list: downloadsData}));
          }
        }
      }
    }
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver,
                                         Ci.nsISupportsWeakReference])
}

function DownloadProgressListener()
{
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
    Services.obs.notifyObservers(null, "embed:download", JSON.stringify({msg: "dl-progress", id: aDownload.id, cur: aCurTotalProgress, max: aMaxTotalProgress}));
  },
  onStateChange: function(aWebProgress, aRequest, aState, aStatus, aDownload)
  {
    Services.obs.notifyObservers(null, "embed:download", JSON.stringify({msg: "dl-state", id: aDownload.id, state: aState}));
  },
  onSecurityChange: function(aWebProgress, aRequest, aState, aDownload)
  {
    Services.obs.notifyObservers(null, "embed:download", JSON.stringify({msg: "dl-security", id: aDownload.id, state: aState}));
  },

  //////////////////////////////////////////////////////////////////////////////
  //// nsISupports
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIDownloadProgressListener])
};

// -----------------------------------------------------------------------
// Download Manager UI
// -----------------------------------------------------------------------

function DownloadManagerUI()
{
  dump("DM  UI INITAILIZED\n");
}

DownloadManagerUI.prototype = {
  classID: Components.ID("{2137921e-910e-11e2-b344-2bda2844afe1}"),
  _progress: null,

  get manager() {
    return Cc["@mozilla.org/download-manager;1"]
             .getService(Ci.nsIDownloadManager);
  },

  get embedservice() {
    return Cc["@mozilla.org/embedlite-app-service;1"]
             .getService(Ci.nsIEmbedAppService);
  },

  show: function show(aWindowContext, aDownload, aReason, aUsePrivateUI) {
    dump("DownloadManagerUI show: ctx:" + aWindowContext + ", download:" + aDownload + ", reason:" + aReason + ", usePrivUI:" + aUsePrivateUI + "\n");
    if (!aReason)
      aReason = Ci.nsIDownloadManagerUI.REASON_USER_INTERACTED;

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

  initDownloadManager: function initDownloadManager() {
    dump("DownloadManagerUI initDownloadManager\n");
    if (!this._progress) {
      this._progress = new DownloadProgressListener();
    }
    DownloadListener.init();
    DownloadUIListener.init();
    this.manager.addListener(this._progress);
    return;
  },

  observe: function (aSubject, aTopic, aData) {
    switch(aTopic) {
      // Engine DownloadManager notifications
      case "app-startup": {
        dump("DownloadManagerUI app-startup\n");
        Services.obs.addObserver(this, "download-manager-initialized", true);
        Services.tm.mainThread.dispatch(function() {    
            this.initDownloadManager();
        }.bind(this), Ci.nsIThread.DISPATCH_NORMAL);
        break;
      }
      case "download-manager-initialized": {
        dump("DownloadManagerUI download-manager-initialized\n");
        break;
      }
      case "quit-application": {
        dump("DownloadManagerUI quit-application\n");
      }
    }
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIDownloadManagerUI, Ci.nsIObserver, Ci.nsISupportsWeakReference])
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([DownloadManagerUI]);
