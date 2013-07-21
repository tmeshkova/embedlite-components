/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

let { classes: Cc, interfaces: Ci, results: Cr, utils: Cu }  = Components;
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Geometry.jsm");

dump("###################################### SelectHelper.js loaded\n");

var globalObject = null;

let HTMLOptionElement = Ci.nsIDOMHTMLOptionElement;
let useAsync = true;

function debug(msg) {
//  dump("SelectHelper.js - " + msg + "\n");
}

function SelectHelper() {
  this.lastTouchedAt = Date.now();
  this.contentDocumentIsDisplayed = true;
  this._windowIDDict = {};
  try {
    useAsync = Services.prefs.getBoolPref("embedlite.select.list.async");
  } catch (e) {}
  this._init();
}

SelectHelper.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver,
                                         Ci.nsISupportsWeakReference]),
  _uiBusy: false,
  _init: function()
  {
    addEventListener("click", this, false);
    Services.obs.addObserver(this, "domwindowclosed", true);
  },

  observe: function(aSubject, aTopic, data) {
    // Ignore notifications not about our document.
    switch(aTopic) {
      case "domwindowclosed": {
        let utils = aSubject.QueryInterface(Ci.nsIInterfaceRequestor)
                   .getInterface(Ci.nsIDOMWindowUtils);
        let outerID = utils.outerWindowID;
        debug("observeOuterWindowDestroyed " + outerID );
        if (!this._windowIDDict[outerID]) {
          debug("recvStopWaiting: No record of outer window ID " + outerID);
          return;
        }
        let win = this._windowIDDict[outerID].get();
        delete this._windowIDDict[outerID];
        if (!win) {
          return;
        }
        debug("recvStopWaiting " + win);
        win.modalAborted = true;
        win.modalDepth--;
        break;
      }
    }
  },

  receiveMessage: function receiveMessage(aMessage) {
    dump("Child Script: Message: name:" + aMessage.name + ", json:" + JSON.stringify(aMessage.json) + "\n");
    this._recvStopWaiting(aMessage);
  },

  handleEvent: function(aEvent) {
    switch (aEvent.type) {
      case 'click':
        this._handleClick(aEvent.target);
        break;
    }
  },

  _handleClick: function(aTarget) {
    // if we're busy looking at a select we want to eat any clicks that
    // come to us, but not to process them
    if (this._uiBusy || !this._isMenu(aTarget) || aTarget.disabled)
        return;
    dump("Click handled by SelectHelper\n")
    this._uiBusy = true;
    this.show(aTarget);
    this._uiBusy = false;
  },

  _tryGetInnerWindowID: function(win) {
    let utils = win.QueryInterface(Ci.nsIInterfaceRequestor)
                   .getInterface(Ci.nsIDOMWindowUtils);
    try {
      return utils.currentInnerWindowID;
    }
    catch(e) {
      return null;
    }
  },

  /**
   * Spin in a nested event loop until we receive a unblock-modal-prompt message for
   * this window.
   */
  _waitForResult: function(win) {
    debug("_waitForResult(" + win + ")");
    let utils = win.QueryInterface(Ci.nsIInterfaceRequestor)
                   .getInterface(Ci.nsIDOMWindowUtils);

    let outerWindowID = utils.outerWindowID;
    let innerWindowID = this._tryGetInnerWindowID(win);
    if (innerWindowID === null) {
      // I have no idea what waiting for a result means when there's no inner
      // window, so let's just bail.
      debug("_waitForResult: No inner window. Bailing.");
      return;
    }

    this._windowIDDict[outerWindowID] = Cu.getWeakReference(win);

    debug("Entering modal state (outerWindowID=" + outerWindowID + ", " +
                                "innerWindowID=" + innerWindowID + ")");

    // In theory, we're supposed to pass |modalStateWin| back to
    // leaveModalStateWithWindow.  But in practice, the window is always null,
    // because it's the window associated with this script context, which
    // doesn't have a window.  But we'll play along anyway in case this
    // changes.
    var modalStateWin = utils.enterModalStateWithWindow();

    // We'll decrement win.modalDepth when we receive a unblock-modal-prompt message
    // for the window.
    if (!win.modalDepth) {
      win.modalDepth = 0;
    }
    win.modalDepth++;
    let origModalDepth = win.modalDepth;

    let thread = Services.tm.currentThread;
    debug("Nested event loop - begin");
    while (win.modalDepth == origModalDepth && !this._shuttingDown) {
      // Bail out of the loop if the inner window changed; that means the
      // window navigated.  Bail out when we're shutting down because otherwise
      // we'll leak our window.
      if (this._tryGetInnerWindowID(win) !== innerWindowID) {
        debug("_waitForResult: Inner window ID changed " +
              "while in nested event loop.");
        break;
      }

      thread.processNextEvent(/* mayWait = */ true);
    }
    debug("Nested event loop - finish");

    // If we exited the loop because the inner window changed, then bail on the
    // modal prompt.
    if (innerWindowID !== this._tryGetInnerWindowID(win)) {
      throw Components.Exception("Modal state aborted by navigation",
                                 Cr.NS_ERROR_NOT_AVAILABLE);
    }
    if (win.modalAborted) {
       delete win.modalAborted;
       return -1;
    }

    let returnValue = win.modalReturnValue;
    delete win.modalReturnValue;

    if (!this._shuttingDown) {
      utils.leaveModalStateWithWindow(modalStateWin);
    }

    debug("Leaving modal state (outerID=" + outerWindowID + ", " +
                               "innerID=" + innerWindowID + ")");
    return returnValue;
  },

  _recvStopWaiting: function(msg) {
    let outerID = msg.json.windowID.outer;
    let innerID = msg.json.windowID.inner;
    let returnValue = msg.json.returnValue;
    debug("recvStopWaiting(outer=" + outerID + ", inner=" + innerID +
          ", returnValue=" + returnValue + ")");

    if (!this._windowIDDict[outerID]) {
      debug("recvStopWaiting: No record of outer window ID " + outerID);
      return;
    }

    let win = this._windowIDDict[outerID].get();
    delete this._windowIDDict[outerID];

    if (!win) {
      debug("recvStopWaiting, but window is gone\n");
      return;
    }

    if (innerID !== this._tryGetInnerWindowID(win)) {
      debug("recvStopWaiting, but inner ID has changed\n");
      return;
    }

    debug("recvStopWaiting " + win);
    win.modalReturnValue = returnValue;
    win.modalDepth--;
  },

  show: function(aElement) {
    let list = this.getListForElement(aElement);
    let data = {};
    if (!useAsync) {
      data = sendSyncMessage("embed:select", list)[0];
    } else {
      let utils = content.window.QueryInterface(Ci.nsIInterfaceRequestor)
                                .getInterface(Ci.nsIDOMWindowUtils);
      let args = { list: list };
      args.windowID = { outer: utils.outerWindowID,
                        inner: this._tryGetInnerWindowID(content.window) };
      addMessageListener("embedui:selectresponse", this);
      sendAsyncMessage("embed:selectasync", args);
      data.button = this._waitForResult(content.window);
      if (data.button == -1)
        return;
      removeMessageListener("embedui:selectresponse", this);
    }
    let selected = data.button;
    if (selected == -1)
        return;
    var changed = false;
    if (aElement instanceof Ci.nsIDOMXULMenuListElement) {
      aElement.selectedIndex = selected;
    } else if (aElement instanceof Ci.nsIDOMHTMLSelectElement) {
      if (!(selected instanceof Array)) {
        let temp = [];
        for (let i = 0; i < list.listitems.length; i++) {
          temp[i] = (i == selected);
        }
        selected = temp;
      }
      let i = 0;
      this.forOptions(aElement, function(aNode) {
        if (aNode.selected != selected[i])
          changed = true;
        aNode.selected = selected[i++];
      });
    }

    if (changed)
      this.fireOnChange(aElement);
  },

  _isMenu: function(aElement) {
    return (aElement instanceof Ci.nsIDOMHTMLSelectElement ||
            aElement instanceof Ci.nsIDOMXULMenuListElement);
  },

  getListForElement: function(aElement) {
    let result = {
      type: "Prompt:Show",
      multiple: aElement.multiple,
      selected: [],
      listitems: []
    };

    let index = 0;
    this.forOptions(aElement, function(aNode, aOptions) {
      let item = {
        label: aNode.text || aNode.label,
        isGroup: aOptions.isGroup,
        inGroup: aOptions.inGroup,
        disabled: aNode.disabled,
        id: index
      }
      if (aOptions.inGroup)
        item.disabled = item.disabled || aNode.parentNode.disabled;

      result.listitems[index] = item;
      result.selected[index] = aNode.selected;
      index++;
    });
    return result;
  },

  forOptions: function(aElement, aFunction) {
    let parent = aElement;
    if (aElement instanceof Ci.nsIDOMXULMenuListElement)
      parent = aElement.menupopup;
    let children = parent.children;
    let numChildren = children.length;

    // if there are no children in this select, we add a dummy row so that at least something appears
    if (numChildren == 0)
      aFunction.call(this, { label: "" }, { isGroup: false, inGroup: false });

    for (let i = 0; i < numChildren; i++) {
      let child = children[i];
      if (child instanceof Ci.nsIDOMHTMLOptionElement ||
          child instanceof Ci.nsIDOMXULSelectControlItemElement) {
        // This is a regular choice under no group.
        aFunction.call(this, child, {
          isGroup: false, inGroup: false
        });
      } else if (child instanceof Ci.nsIDOMHTMLOptGroupElement) {
        aFunction.call(this, child, {
          isGroup: true, inGroup: false
        });

        let subchildren = child.children;
        let numSubchildren = subchildren.length;
        for (let j = 0; j < numSubchildren; j++) {
          let subchild = subchildren[j];
          aFunction.call(this, subchild, {
            isGroup: false, inGroup: true
          });
        }
      }
    }
  },

  fireOnChange: function(aElement) {
    let evt = aElement.ownerDocument.createEvent("Events");
    evt.initEvent("change", true, true, aElement.defaultView, 0,
                  false, false,
                  false, false, null);
    content.window.setTimeout(function() {
      aElement.dispatchEvent(evt);
    }, 0);
  }
};

globalObject = new SelectHelper();

