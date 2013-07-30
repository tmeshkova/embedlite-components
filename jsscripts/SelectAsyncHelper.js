/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

let { classes: Cc, interfaces: Ci, results: Cr, utils: Cu }  = Components;
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Geometry.jsm");

dump("###################################### SelectAsyncHelper.js loaded\n");

var globalObject = null;

function debug(msg) {
  // dump("SelectAsyncHelper.js - " + msg + "\n");
}

function isMenu(aElement) {
  return (aElement instanceof Ci.nsIDOMHTMLSelectElement ||
          aElement instanceof Ci.nsIDOMXULMenuListElement);
}

/*
 * Returns list of options of a menu element 'aElement'.
 * 'aProps' is a dictionary of predefined properties of every option.
 * 'aIndexFunction' is a function applied to every leaf option element and
 * it must return element's index.
 */
function getOptionList(aElement, aProps, aIndexFunction) {
  let parent = aElement;
  if (aElement instanceof Ci.nsIDOMXULMenuListElement) {
    parent = aElement.menupopup;
  }
  let children = parent.children;
  let list = [];

  for (let i = 0; i < children.length; i++) {
    let child = children[i];
    let item = {
      "label": child.text || child.label,
      "disabled": aProps.disabled || child.disabled,
      "selected": child.selected,
      "group": aProps.group || ""
    };

    if (child instanceof Ci.nsIDOMHTMLOptionElement ||
        child instanceof Ci.nsIDOMXULSelectControlItemElement) {
      if (aIndexFunction) {
        item["index"] = aIndexFunction(child);
      }
      list.push(item);
    } else if (child instanceof Ci.nsIDOMHTMLOptGroupElement) {
      let props = {
        "group": item["label"],
        "disabled": item["disabled"]
      };
      getOptionList(child, props, aIndexFunction).forEach(function (subnode) {
          list.push(subnode);
      });
    }
  }
  return list;
}

function Dialog(aMultiple, aOptionList) {
  this._init({
      "multiple": aMultiple,
      "options": aOptionList
  });
}

// Proxy object for sub window with OPTION elements
Dialog.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver,
                                         Ci.nsISupportsWeakReference]),

  _init: function(aData) {
    addMessageListener("embedui:selectresponse", this);
    sendAsyncMessage("embed:selectasync", aData);
  },

  receiveMessage: function(aMessage) {
    removeMessageListener("embedui:selectresponse", this);
    this.onDone(aMessage.json.result);
  },

  onDone: function(aResult) {},

  abort: function() {
    sendAsyncMessage("embed:selectabort");
  }
};

function SelectHelper() {
  this._init();
}

SelectHelper.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver,
                                         Ci.nsISupportsWeakReference]),

  _selectElement: null,
  _dialog: null, // a proxy for modal subwindow
  _nodeMap: {},

  _init: function() {
    addEventListener("click", this, false);
  },

  handleEvent: function(aEvent) {
    switch (aEvent.type) {
      case "click":
      this.onClicked(aEvent);
      break;
    }
  },

  reset: function() {
    this._selectElement = null;
    this._dialog = null;
    this._nodeMap = {};
  },

  onClicked: function(aEvent) {
    let target = aEvent.target;
    // don't use 'this' inside lambdas for the sake of clarity
    let that = this;

    if (this._selectElement === null && isMenu(target)) {
      debug("menu element clicked");
      this._selectElement = target;
      let index = 0;
      let optionList = getOptionList(target, {}, function (aNode) {
          that._nodeMap[index] = aNode;
          return index++;
      });

      if (index === 0) {
        // don't open dialog for empty option lists
        return;
      }

      this._dialog = new Dialog(target.multiple, optionList);

      this._dialog.onDone = function (result) {

        if (result == -1) {
          debug("Empty result");
          that.reset()
          return;
        }

        that.onResultsReceived(target, result);
        that.reset()
      }
    } else if (this._selectElement && this._selectElement !== target) {
      // in case user clicked outside of subwindow
      debug("User manage to click outside of subwindow");
      this._dialog.abort();
      this.reset();
    }
  },

  onResultsReceived: function (aElement, aOptions) {
    if (aElement instanceof Ci.nsIDOMXULMenuListElement) {
      for (let i = 0; i < aOptions.length; i++) {
        if (aOptions[i].selected) {
          aElement.selectedIndex = aOptions[i].index;
          break;
        }
      }
    } else if (aElement instanceof Ci.nsIDOMHTMLSelectElement) {
      let that = this;
      aOptions.forEach(function (option) {
          that._nodeMap[option.index].selected = option.selected;
      });
      this.fireOnChange(aElement);
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
