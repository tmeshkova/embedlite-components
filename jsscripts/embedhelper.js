/* -*- Mode: JavaScript; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

let { classes: Cc, interfaces: Ci, results: Cr, utils: Cu }  = Components;
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Geometry.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");

let HTMLSelectElement = Ci.nsIDOMHTMLSelectElement;
let HTMLLabelElement = Ci.nsIDOMHTMLLabelElement;
let HTMLIFrameElement = Ci.nsIDOMHTMLIFrameElement;
let HTMLFrameElement = Ci.nsIDOMHTMLFrameElement;
let HTMLTextAreaElement = Ci.nsIDOMHTMLTextAreaElement;
let HTMLInputElement = Ci.nsIDOMHTMLInputElement;

XPCOMUtils.defineLazyServiceGetter(this, "DOMUtils",
  "@mozilla.org/inspector/dom-utils;1", "inIDOMUtils");

XPCOMUtils.defineLazyModuleGetter(this, "LoginManagerContent",
                                  "resource://gre/modules/LoginManagerContent.jsm");

XPCOMUtils.defineLazyServiceGetter(Services, "embedlite",
                                    "@mozilla.org/embedlite-app-service;1",
                                    "nsIEmbedAppService");

dump("###################################### embedhelper.js loaded\n");

var globalObject = null;

const kEmbedStateActive = 0x00000001; // :active pseudoclass for elements

function fuzzyEquals(a, b) {
  return (Math.abs(a - b) < 0.01);
}

function EmbedHelper() {
  this.contentDocumentIsDisplayed = true;
  // Reasonable default. Will be read from preferences.
  this.inputItemSize = 38;
  this.zoomMargin = 14;
  this.vkbOpenCompositionMetrics = null;
  this.inFullScreen = false;
  this.viewportChangesSinceVkbUpdate = 0;
  this._init();
}

EmbedHelper.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver,
                                         Ci.nsISupportsWeakReference]),

  _fastFind: null,
  _init: function()
  {
    dump("Init Called:" + this + "\n");
    addEventListener("touchstart", this, true);
    addEventListener("touchmove", this, true);
    addEventListener("touchend", this, true);
    addEventListener("DOMContentLoaded", this, true);
    addEventListener("DOMFormHasPassword", this, true);
    addEventListener("DOMAutoComplete", this, true);
    addEventListener("blur", this, true);
    addEventListener("mozfullscreenchange", this, false);
    addMessageListener("Viewport:Change", this);
    addMessageListener("Gesture:DoubleTap", this);
    addMessageListener("Gesture:SingleTap", this);
    addMessageListener("Gesture:LongTap", this);
    addMessageListener("embedui:find", this);
    addMessageListener("embedui:zoomToRect", this);
    addMessageListener("embedui:scrollTo", this);
    // Metrics used when virtual keyboard is open/opening.
    addMessageListener("embedui:vkbOpenCompositionMetrics", this);
    addMessageListener("embedui:addhistory", this);
    addMessageListener("Memory:Dump", this);
    addMessageListener("Gesture:ContextMenuSynth", this);
    addMessageListener("embed:ContextMenuCreate", this);
    Services.obs.addObserver(this, "embedlite-before-first-paint", true);
    Services.prefs.addObserver("embedlite.inputItemSize", this, false);
    Services.prefs.addObserver("embedlite.zoomMargin", this, false);
    this.updateInputItemSizePref();
    this.updateZoomMarginPref();
  },

  getFocusedInput: function(aBrowser, aOnlyInputElements = false) {
    if (!aBrowser)
      return null;

    let doc = aBrowser.document;

    if (!doc)
      return null;

    let focused = doc.activeElement;

    while (focused instanceof HTMLFrameElement || focused instanceof HTMLIFrameElement) {
      doc = focused.contentDocument;
      focused = doc.activeElement;
    }

    if (focused instanceof HTMLInputElement && (focused.mozIsTextField && focused.mozIsTextField(false) || focused.type === "number"))
      return { inputElement: focused, isTextField: true };

    if (aOnlyInputElements)
      return null;

    if (focused && (focused instanceof HTMLTextAreaElement || focused.isContentEditable)) {
      return { inputElement: focused, isTextField: false };
    }
    return { inputElement: null, isTextField: false };
  },

//  // observe this
//  case "ScrollTo:FocusedInput":
//  // these messages come from a change in the viewable area and not user interaction
//  // we allow scrolling to the selected input, but not zooming the page
//  this.scrollToFocusedInput(browser, false);


  scrollToFocusedInput: function(aAllowZoom = true) {
    let { inputElement: inputElement, isTextField: isTextField } = this.getFocusedInput(content);
    if (inputElement) {
      // _zoomToInput will handle not sending any message if this input is already mostly filling the screen
      this._zoomToInput(inputElement, aAllowZoom, isTextField);
    }
  },

  observe: function(aSubject, aTopic, data) {
    // Ignore notifications not about our document.
    dump("observe topic:" + aTopic + "\n");
    switch (aTopic) {
        case "embedlite-before-first-paint":
          // Is it on the top level?
          this.contentDocumentIsDisplayed = true;
          break;
        case "nsPref:changed":
          if (data == "embedlite.inputItemSize") {
            this.updateInputItemSizePref();
          } else if (data == "embedlite.zoomMargin") {
            this.updateZoomMarginPref();
          }

          break;
    }
  },

  _viewportData: null,
  _viewportReadyToChange: false,
  _lastTarget: null,
  _lastTargetY: 0,

  resetMaxLineBoxWidth: function() {
    let webNav = content.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation);
    let docShell = webNav.QueryInterface(Ci.nsIDocShell);
    let docViewer = docShell.contentViewer.QueryInterface(Ci.nsIMarkupDocumentViewer);
    docViewer.changeMaxLineBoxWidth(0);
  },

  updateInputItemSizePref: function() {
    try {
      let tmpSize = Services.prefs.getIntPref("embedlite.inputItemSize");
      if (tmpSize) {
        this.inputItemSize = tmpSize;
      }
    } catch (e) {} /*pref is missing*/
  },

  updateZoomMarginPref: function() {
    try {
      let tmpMargin = Services.prefs.getIntPref("embedlite.zoomMargin");
      if (tmpMargin) {
        this.zoomMargin = tmpMargin;
      }
    } catch (e) {} /*pref is missing*/
  },

  _touchElement: null,

  receiveMessage: function receiveMessage(aMessage) {
    switch (aMessage.name) {
      case "Gesture:ContextMenuSynth": {
        let [x, y] = [aMessage.json.x, aMessage.json.y];
        let element = this._touchElement;
        this._sendContextMenuEvent(element, x, y);
        break;
      }
      case "Gesture:SingleTap": {

        if (SelectionHandler.isActive) {
            SelectionHandler._onSelectionCopy({xPos: aMessage.json.x, yPos: aMessage.json.y});
        }

        let element = this._touchElement;
        if (element) {
          try {
            let [x, y] = [aMessage.json.x, aMessage.json.y];

            this._sendMouseEvent("mousemove", element, x, y);
            this._sendMouseEvent("mousedown", element, x, y);
            this._sendMouseEvent("mouseup",   element, x, y);

            // scrollToFocusedInput does its own checks to find out if an element should be zoomed into
            if (this.vkbOpenCompositionMetrics.imOpen) {
              this.scrollToFocusedInput();
            }
          } catch(e) {
            Cu.reportError(e);
          }
          this._touchElement = null;
        }
        break;
      }
      case "Gesture:DoubleTap": {
        this._cancelTapHighlight();
        break;
      }
      case "Gesture:LongTap": {
        let element = this._touchElement;
        if (element) {
          let [x, y] = [aMessage.json.x, aMessage.json.y];
          ContextMenuHandler._processPopupNode(element, x, y, Ci.nsIDOMMouseEvent.MOZ_SOURCE_UNKNOWN);
        }
        this._touchElement = null;
        break;
      }
      case "embedui:find": {
        let searchText = aMessage.json.text;
        let searchAgain = aMessage.json.again;
        let searchBackwards = aMessage.json.backwards;
        let result = Ci.nsITypeAheadFind.FIND_NOTFOUND;
        if (!this._fastFind) {
          this._fastFind = Cc["@mozilla.org/typeaheadfind;1"].createInstance(Ci.nsITypeAheadFind);
          this._fastFind.init(docShell);
          result = this._fastFind.find(searchText, false);
        }
        else {
          if (!searchAgain) {
            result = this._fastFind.find(searchText, false);
          }
          else {
            result = this._fastFind.findAgain(searchBackwards, false);
          }
        }
        sendAsyncMessage("embed:find", { r: result });
        break;
      }
      case "Viewport:Change": {
        this._viewportData = aMessage.data;

        let epsilon = 0.999;
        // Facebook generates two Viewport:Change's after an input field is tapped. And only
        // the second one is valid because Facebook's JS makes the page longer after the tap.
        let maxViewportChanges = 2;
        if (this.vkbOpenCompositionMetrics && this.vkbOpenCompositionMetrics.imOpen &&
            (this.viewportChangesSinceVkbUpdate <= maxViewportChanges) &&
            Math.abs((this._viewportData.cssCompositedRect.height * this.vkbOpenCompositionMetrics.resolution) - this.vkbOpenCompositionMetrics.compositionHeight) < epsilon) {
              this.scrollToFocusedInput();
              this.viewportChangesSinceVkbUpdate = this.viewportChangesSinceVkbUpdate + 1;
        }
        break;
      }
      case "embedui:zoomToRect": {
        if (aMessage.data) {
          let winid = Services.embedlite.getIDByWindow(content);
          // This is a hackish way as zoomToRect does not work if x-value has not changed or viewport has not been scaled (zoom animation).
          // Thus, we're missing animation when viewport has not been scaled.
          let scroll = this._viewportData && this._viewportData.cssCompositedRect.width === aMessage.data.width;

          if (scroll) {
            content.scrollTo(aMessage.data.x, aMessage.data.y);
          } else {
            Services.embedlite.zoomToRect(winid, aMessage.data.x, aMessage.data.y, aMessage.data.width, aMessage.data.height);
          }
        }
        break;
      }
      case "embedui:scrollTo": {
        if (aMessage.data) {
            content.scrollTo(aMessage.data.x, aMessage.data.y);
        }
        break;
      }
      case "embedui:vkbOpenCompositionMetrics": {
        if (aMessage.data) {
          this.vkbOpenCompositionMetrics = aMessage.data;
          this.viewportChangesSinceVkbUpdate = 0;
        }
        break;
      }
      case "embedui:addhistory": {
        // aMessage.data contains: 1) list of 'links' loaded from DB, 2) current 'index'.

        let webNav = content.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation);
        let docShell = webNav.QueryInterface(Ci.nsIDocShell);
        let shist = webNav.sessionHistory.QueryInterface(Ci.nsISHistoryInternal);
        let ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);

        try {
          // Initially we load the current URL and that creates an unneeded entry in History -> purge it.
          webNav.sessionHistory.PurgeHistory(1);
        } catch (e) {
            dump("Warning: couldn't PurgeHistory. Was it a file download?\n");
        }

        aMessage.data.links.forEach(function(link) {
            let uri;
            try {
                uri = ioService.newURI(link, null, null);
            } catch (e) {
                dump("Warning: no protocol provided for uri '" + link + "'. Assuming http...\n");
                uri = ioService.newURI("http://" + link, null, null);
            }
            let historyEntry = Cc["@mozilla.org/browser/session-history-entry;1"].createInstance(Ci.nsISHEntry);
            historyEntry.setURI(uri);
            shist.addEntry(historyEntry, true);
        });
        let index = aMessage.data.index;
        if (index < 0) {
            dump("Warning: session history entry index out of bounds: " + index + ". Returning index 0.\n");
            webNav.sessionHistory.getEntryAtIndex(0, true);
            index = 0;
        } else if (index >= webNav.sessionHistory.count) {
            let lastIndex = webNav.sessionHistory.count - 1;
            dump("Warning: session history entry index out of bound: " + index + ". There are " + webNav.sessionHistory.count +
                 " item(s) in the session history. Returning index " + lastIndex + ".\n");
            webNav.sessionHistory.getEntryAtIndex(lastIndex, true);
            index = lastIndex;
        } else {
            webNav.sessionHistory.getEntryAtIndex(index, true);
        }

        shist.updateIndex();

        let initialURI;
        try {
            initialURI = ioService.newURI(aMessage.data.links[index], null, null);
        } catch (e) {
            dump("Warning: couldn't construct initial URI. Assuming a http:// URI is provided\n");
            initialURI = ioService.newURI("http://" + aMessage.data.links[index], null, null);
        }
        docShell.setCurrentURI(initialURI);
        break;
      }
      case "Memory:Dump": {
        if (aMessage.data && aMessage.data.fileName) {
            let memDumper = Cc["@mozilla.org/memory-info-dumper;1"].getService(Ci.nsIMemoryInfoDumper);
            memDumper.dumpMemoryReportsToNamedFile(aMessage.data.fileName, null, null);
        }
        break;
      }
      default: {
        dump("Child Script: Message: name:" + aMessage.name + ", json:" + JSON.stringify(aMessage.json) + "\n");
        break;
      }
    }
  },

  _rectVisibility: function(aSourceRect, aViewportRect) {
    let vRect = aViewportRect ? aViewportRect : new Rect(this._viewportData.x,
                                                         this._viewportData.y,
                                                         this._viewportData.cssCompositedRect.width,
                                                         this._viewportData.cssCompositedRect.height);
    let overlap = vRect.intersect(aSourceRect);
    let overlapArea = overlap.width * overlap.height;
    let availHeight = Math.min(aSourceRect.width * vRect.height / vRect.width, aSourceRect.height);
    let showing = overlapArea / (aSourceRect.width * availHeight);
    return { vRect: vRect, overlap: overlap, overlapArea: overlapArea, availHeight: availHeight, showing: showing }
  },

  _zoomToInput: function(aElement, aAllowZoom = true, aIsTextField = true) {
    // For possible error cases
    if (!this._viewportData)
      return;

    // Combination of browser.js _zoomToElement and special zoom logic
    let rect = ElementTouchHelper.getBoundingContentRect(aElement);

    // Rough cssCompositionHeight as virtual keyboard is not yet raised (upper half).
    let cssCompositionHeight = this._viewportData.cssCompositedRect.height / 2;
    let maxCssCompositionWidth = this._viewportData.cssCompositedRect.width;
    let maxCssCompositionHeight = cssCompositionHeight;

    if (this.vkbOpenCompositionMetrics && this.vkbOpenCompositionMetrics.imOpen) {
        maxCssCompositionWidth = this.vkbOpenCompositionMetrics.maxCssCompositionWidth;
        maxCssCompositionHeight = this.vkbOpenCompositionMetrics.maxCssCompositionHeight;
        let currentCssCompositedHeight = this._viewportData.cssCompositedRect.height
        // Are equal if vkb is already open and content is not pinched after vkb opening. It does not
        // matter if currentCssCompositedHeight happens to match target before vkb has been opened.
        if (maxCssCompositionHeight != currentCssCompositedHeight) {
          cssCompositionHeight = this.vkbOpenCompositionMetrics.compositionHeight / this._viewportData.resolution.width;
        } else {
          cssCompositionHeight = currentCssCompositedHeight;
        }
    }
    // TODO / Missing: handle maximum zoom level and respect viewport meta tag
    let scaleFactor = aIsTextField ? (this.inputItemSize / this.vkbOpenCompositionMetrics.compositionHeight) / (rect.h / cssCompositionHeight) : 1.0;

    let margin = this.zoomMargin / scaleFactor;
    let allowZoom = aAllowZoom && rect.h != this.inputItemSize;

    // Calculate new css composition bounds that will be the bounds after zooming. Top-left corner is not yet moved.
    let cssCompositedRect = new Rect(this._viewportData.x,
                                    this._viewportData.y,
                                    this._viewportData.cssCompositedRect.width,
                                    cssCompositionHeight);
    let bRect = new Rect(Util.clamp(rect.x - margin, 0, this._viewportData.cssPageRect.width - rect.w),
                        Util.clamp(rect.y - margin, 0, this._viewportData.cssPageRect.height - rect.h),
                        allowZoom ? rect.w + 2 * margin : this._viewportData.viewport.width,
                        rect.h);

    // constrict the rect to the screen's right edge
    bRect.width = Math.min(bRect.width, (this._viewportData.cssPageRect.x + cssCompositedRect.x + this._viewportData.cssPageRect.width) - bRect.x);

    let dxLeft = rect.x - cssCompositedRect.x;
    let dxRight = cssCompositedRect.x + cssCompositedRect.width - (rect.x + rect.w);
    let dxTop = rect.y - cssCompositedRect.y;
    let dxBottom = cssCompositedRect.y + cssCompositedRect.height - (rect.y + rect.h);

    let scrollToRight = Math.abs(dxLeft) > Math.abs(dxRight);
    let scrollToBottom = Math.abs(dxTop) > Math.abs(dxBottom);

    let fixedCurrentViewport = new Rect(cssCompositedRect.x,
                                        cssCompositedRect.y,
                                        Util.clamp(cssCompositedRect.width / scaleFactor, 0, maxCssCompositionWidth),
                                        Util.clamp(cssCompositedRect.height / scaleFactor, 0, maxCssCompositionHeight));

    // We want to scale input so that it will be readable. In case we move from one input field to another or refocus
    // the same field we don't want to move input if it's already visible and of correct size.
    let halfMargin = margin / 2;
    let inputRect = new Rect(Math.abs(rect.x - halfMargin) > halfMargin ? rect.x - halfMargin : rect.x,
                             rect.y - halfMargin,
                             rect.w + halfMargin,
                             rect.h + halfMargin);

    let { showing: showing } = this._rectVisibility(inputRect, fixedCurrentViewport);

    // Adjust position based on new composition area size.
    let needXAxisMoving = this._testXMovement(inputRect, fixedCurrentViewport);
    let needYAxisMoving = this._testYMovement(inputRect, fixedCurrentViewport);

    let xUpdated = false

    // More content will be visible
    if (scaleFactor < 1.0) {
      let moveToZero = new Rect(0, fixedCurrentViewport.y, fixedCurrentViewport.width, fixedCurrentViewport.height);
      let zeroNeedsMoving = this._testXMovement(inputRect, moveToZero);
      if (!zeroNeedsMoving) {
        if (cssCompositedRect.x === 0) {
          rect.x = 1;
        } else {
          rect.x = 0;
        }
        xUpdated = true;
        needXAxisMoving = false;
      }
    }

    if (needXAxisMoving && aIsTextField) {
      if (scrollToRight) {
        rect.x = inputRect.x + inputRect.width - fixedCurrentViewport.width;
      } else {
        let tmpX = bRect.x;
        if (rect.x > 0) {
          let moveToZero = new Rect(0, cssCompositedRect.y, cssCompositedRect.width, cssCompositedRect.height);
          needXAxisMoving = this._testXMovement(inputRect, moveToZero);
          if (!needXAxisMoving) {
            tmpX = 0;
          }
        }
        rect.x = tmpX;
      }
    } else if (!xUpdated) {
      // Visible css viewport is properly scaled
      rect.x = cssCompositedRect.x;
    }

    if (needYAxisMoving) {
      if (scrollToBottom) {
        rect.y = inputRect.y + inputRect.height - fixedCurrentViewport.height + margin;
      }
      else {
        rect.y = bRect.y;
      }
    } else {
      // Visible css viewport is properly scaled
      rect.y = cssCompositedRect.y;
    }

    rect.w = fixedCurrentViewport.width;
    rect.h = fixedCurrentViewport.height;

    var winid = Services.embedlite.getIDByWindow(content);
    Services.embedlite.zoomToRect(winid, rect.x, rect.y, rect.w, rect.h);
  },

  // Move y-axis to viewport area and test if element is visible.
  _testXMovement: function(aElement, aViewport) {
    let tmpRect = new Rect(aElement.x, aViewport.y, aElement.width, aElement.height);
    let { showing: showing } = this._rectVisibility(tmpRect, aViewport);
    return showing < 0.99;
  },

  // Move x-axis to viewport area and test if element is visible.
  _testYMovement: function(aElement, aViewport) {
    let tmpRect = new Rect(aViewport.x, aElement.y, aElement.width, aElement.height);
    let { showing: showing } = this._rectVisibility(tmpRect, aViewport);
    return showing < 0.99;
  },

  _sendMouseEvent: function _sendMouseEvent(aName, aElement, aX, aY) {
    let window = aElement.ownerDocument.defaultView;
    try {
      let cwu = window.top.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
      cwu.sendMouseEventToWindow(aName, aX, aY, 0, 1, 0, true, 0, Ci.nsIDOMMouseEvent.MOZ_SOURCE_TOUCH);
    } catch(e) {
      Cu.reportError(e);
    }
  },

  _sendContextMenuEvent: function _sendContextMenuEvent(aElement, aX, aY) {
    let window = aElement.ownerDocument.defaultView;
    try {
      let cwu = window.top.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
      cwu.sendMouseEventToWindow("contextmenu", aX, aY, 2, 1, 0, false);
    } catch(e) {
      Cu.reportError(e);
    }
  },

  handleEvent: function(aEvent) {
    switch (aEvent.type) {
      case "DOMContentLoaded": {
        if (LoginManagerContent.onContentLoaded) {
          LoginManagerContent.onContentLoaded(aEvent);
        }
        this._handleDomContentLoaded(aEvent);
        break;
      }
      case "DOMFormHasPassword": {
        if (LoginManagerContent.onFormPassword) {
          LoginManagerContent.onFormPassword(aEvent);
        }
        break;
      }
      case "DOMAutoComplete":
      case "blur": {
        LoginManagerContent.onUsernameInput(aEvent);
        break;
      }
      case 'touchstart':
        this._handleTouchStart(aEvent);
        break;
      case 'touchmove':
        this._handleTouchMove(aEvent);
        break;
      case 'touchend':
        this._handleTouchEnd(aEvent);
        break;
      case "mozfullscreenchange":
        this._handleFullScreenChanged(aEvent);
        break;
    }
  },

  isBrowserContentDocumentDisplayed: function() {
    if (content.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils).isFirstPaint) {
      return false;
    }
    return this.contentDocumentIsDisplayed;
  },

  _handleDomContentLoaded: function(aEvent) {
    let window = aEvent.target.defaultView;
    if (window) {
      let winid = Services.embedlite.getIDByWindow(window);
      Services.embedlite.sendAsyncMessage(winid, "embed:domcontentloaded", JSON.stringify({ "rootFrame": window.parent === window }));
    }
  },

  _handleFullScreenChanged: function(aEvent) {
        let window = aEvent.target.defaultView;
        let winid = Services.embedlite.getIDByWindow(window);
        this.inFullScreen = aEvent.target.mozFullScreen;
        Services.embedlite.sendAsyncMessage(winid, "embed:fullscreenchanged",
                                            JSON.stringify({
                                                    "fullscreen": aEvent.target.mozFullScreen
                                            }));
  },

  _handleTouchMove: function(aEvent) {
    this._cancelTapHighlight();
  },

  _handleTouchEnd: function(aEvent) {
    this._viewportReadyToChange = true;
    this._cancelTapHighlight();
  },

  _handleTouchStart: function(aEvent) {
    if (this._touchElement) { // TODO: check if _highlightelement is enough and this can be dropped
      this._touchElement = null;
    }
    if (!this.isBrowserContentDocumentDisplayed() || aEvent.touches.length > 1 || aEvent.defaultPrevented)
      return;

    let target = aEvent.target;
    if (!target) {
      return;
    }

    let uri = this._getLinkURI(target);
    if (uri) {
      try {
        Services.io.QueryInterface(Ci.nsISpeculativeConnect).speculativeConnect(uri, null);
      } catch (e) {}
    }
    this._doTapHighlight(target);
  },

  _getLinkURI: function(aElement) {
    if (aElement.nodeType == Ci.nsIDOMNode.ELEMENT_NODE &&
        ((aElement instanceof Ci.nsIDOMHTMLAnchorElement && aElement.href) ||
        (aElement instanceof Ci.nsIDOMHTMLAreaElement && aElement.href))) {
      try {
        return Services.io.newURI(aElement.href, null, null);
      } catch (e) {}
    }
    return null;
  },

  _doTapHighlight: function _doTapHighlight(aElement) {
    DOMUtils.setContentState(aElement, kEmbedStateActive);
    this._highlightElement = aElement;
    this._touchElement = aElement;
  },

  _cancelTapHighlight: function _cancelTapHighlight() {
    if (!this._highlightElement)
      return;

    // If the active element is in a sub-frame, we need to make that frame's document
    // active to remove the element's active state.
    if (this._highlightElement.ownerDocument != content.document)
      DOMUtils.setContentState(this._highlightElement.ownerDocument.documentElement, kEmbedStateActive);

    DOMUtils.setContentState(content.document.documentElement, kEmbedStateActive);
    this._highlightElement = null;
  },

  _dumpViewport: function() {
    if (this._viewportData != null) {
      dump("--------------- Viewport data ----------------------- \n")
      for (var i in this._viewportData) {
        if (typeof(this._viewportData[i]) == "object") {
          for (var j in this._viewportData[i]) {
            dump("   " + i + " " + j + ": " + this._viewportData[i][j] + "\n")
          }
        } else {
          dump("viewport data object: " + i + ": " + this._viewportData[i] + "\n")
        }
      }
      dump("--------------- Viewport data dumpped --------------- \n")
    } else {
      dump("Nothing to dump\n")
    }
  },
};

const ElementTouchHelper = {
  getBoundingContentRect: function(aElement) {
    if (!aElement)
      return {x: 0, y: 0, w: 0, h: 0};

    let document = aElement.ownerDocument;
    while (document.defaultView.frameElement)
      document = document.defaultView.frameElement.ownerDocument;

    let cwu = document.defaultView.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
    let scrollX = {}, scrollY = {};
    cwu.getScrollXY(false, scrollX, scrollY);

    let r = aElement.getBoundingClientRect();

    // step out of iframes and frames, offsetting scroll values
    for (let frame = aElement.ownerDocument.defaultView; frame.frameElement && frame != content; frame = frame.parent) {
      // adjust client coordinates' origin to be top left of iframe viewport
      let rect = frame.frameElement.getBoundingClientRect();
      let left = frame.getComputedStyle(frame.frameElement, "").borderLeftWidth;
      let top = frame.getComputedStyle(frame.frameElement, "").borderTopWidth;
      scrollX.value += rect.left + parseInt(left);
      scrollY.value += rect.top + parseInt(top);
    }

    return {x: r.left + scrollX.value,
            y: r.top + scrollY.value,
            w: r.width,
            h: r.height };
  }
};

Services.scriptloader.loadSubScript("chrome://embedlite/content/Util.js");
Services.scriptloader.loadSubScript("chrome://embedlite/content/ContextMenuHandler.js");
Services.scriptloader.loadSubScript("chrome://embedlite/content/SelectionHandler.js");

globalObject = new EmbedHelper();

