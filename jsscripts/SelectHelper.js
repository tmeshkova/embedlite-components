/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

let { classes: Cc, interfaces: Ci, results: Cr, utils: Cu }  = Components;
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Geometry.jsm");

XPCOMUtils.defineLazyServiceGetter(this, "ppmm",
   "@mozilla.org/parentprocessmessagemanager;1", "nsIMessageBroadcaster");
XPCOMUtils.defineLazyServiceGetter(this, "gpmm",
   "@mozilla.org/globalmessagemanager;1", "nsIMessageBroadcaster");

dump("###################################### SelectHelper.js loaded\n");

var globalObject = null;

let HTMLOptionElement = Ci.nsIDOMHTMLOptionElement;

function SelectHelper() {
  this.lastTouchedAt = Date.now();
  this.contentDocumentIsDisplayed = true;
  this._init();
}

SelectHelper.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver,
                                         Ci.nsISupportsWeakReference]),
  _uiBusy: false,
  _init: function()
  {
    addEventListener("click", this, false);
  },

  observe: function(aSubject, aTopic, data) {
    // Ignore notifications not about our document.
    dump("observe topic:" + aTopic + "\n");
  },

  receiveMessage: function receiveMessage(aMessage) {
    dump("Child Script: Message: name:" + aMessage.name + ", json:" + JSON.stringify(aMessage.json) + "\n");
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

  show: function(aElement) {
    let list = this.getListForElement(aElement);
    let data = sendSyncMessage("embed:select", list)[0];
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

