/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
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
  this.lastTouchedAt = Date.now();
  this.contentDocumentIsDisplayed = true;
  this.reflowPref = false;
  // Reasonable default. Will be read from preferences.
  this.inputItemSize = 38;
  this.zoomMargin = 14;
  this.previousInputY = -1;
  this.returnToBoundsRequested = false;
  this._init();
}

EmbedHelper.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver,
                                         Ci.nsISupportsWeakReference]),

  _fastFind: null,
  _init: function()
  {
    dump("Init Called:" + this + "\n");
    addEventListener("touchstart", this, false);
    addEventListener("touchmove", this, false);
    addEventListener("touchend", this, false);
    addEventListener("DOMContentLoaded", this, true);
    addEventListener("DOMFormHasPassword", this, true);
    addEventListener("DOMAutoComplete", this, true);
    addEventListener("blur", this, true);
    addMessageListener("AZPC:ScrollDOMEvent", this);
    addMessageListener("Viewport:Change", this);
    addMessageListener("Gesture:DoubleTap", this);
    addMessageListener("Gesture:SingleTap", this);
    addMessageListener("Gesture:LongTap", this);
    addMessageListener("embedui:find", this);
    addMessageListener("Gesture:ContextMenuSynth", this);
    addMessageListener("embed:ContextMenuCreate", this);
    Services.obs.addObserver(this, "embedlite-before-first-paint", true);
    Services.prefs.addObserver("browser.zoom.reflowOnZoom", this, false);
    Services.prefs.addObserver("embedlite.inputItemSize", this, false);
    Services.prefs.addObserver("embedlite.zoomMargin", this, false);
    this.updateReflowPref();
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

    if (focused instanceof HTMLInputElement && focused.mozIsTextField(false))
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


  scrollToFocusedInput: function(aBrowser, aAllowZoom = true) {
    let { inputElement: inputElement, isTextField: isTextField } = this.getFocusedInput(aBrowser);
    if (inputElement) {
      // _zoomToInput will handle not sending any message if this input is already mostly filling the screen
      this._zoomToInput(inputElement, aAllowZoom, isTextField);
      this.previousInputY = inputElement.y;
    } else {
      this.previousInputY = -1;
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
          if (data == "browser.zoom.reflowOnZoom") {
            this.updateReflowPref();
          } else if (data == "embedlite.inputItemSize") {
            this.updateInputItemSizePref();
          } else if (data == "embedlite.zoomMargin") {
            this.updateZoomMarginPref();
          }

          break;
    }
  },

  _viewportLastResolution: 0,
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

  updateReflowPref: function() {
    this.reflowPref = Services.prefs.getBoolPref("browser.zoom.reflowOnZoom");
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

  performReflow: function performReflow() {
    if (!this._viewportData) {
      return;
    }
    let reflowMobile = false;
    try {
      reflowMobile = Services.prefs.getBoolPref("browser.zoom.reflowMobilePages");
    } catch (e) {}
    let isMobileView = this._viewportData.viewport.width == this._viewportData.cssPageRect.width;
    if (this._viewportReadyToChange &&
        this._viewportLastResolution != this._viewportData.resolution.width) {
      if (isMobileView && !reflowMobile)
        return; //dont reflow if pref not allowing reflow Mobile view pages
      var reflowEnabled = false;
      try {
        reflowEnabled = Services.prefs.getBoolPref("browser.zoom.reflowOnZoom");
      } catch (e) {}
      let viewportWidth = this._viewportData.viewport.width;
      let viewportHeight = this._viewportData.viewport.height;
      let viewportWResolution = this._viewportData.resolution.width;
      let viewportHResolution = this._viewportData.resolution.height;
      let viewportY = this._viewportData.y;
      var fudge = 15 / viewportWResolution;
      let width = viewportWidth / viewportWResolution;
      if (!reflowEnabled) {
        width = viewportWidth;
      }
      let utils = content.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
      let webNav = content.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation);
      let docShell = webNav.QueryInterface(Ci.nsIDocShell);
      let docViewer = docShell.contentViewer.QueryInterface(Ci.nsIMarkupDocumentViewer);
      docViewer.changeMaxLineBoxWidth(width - 2*fudge);

      let element = this._lastTarget;
      if (reflowEnabled && element && viewportWResolution > 1) {
        let window = element.ownerDocument.defaultView;
        var winid = Services.embedlite.getIDByWindow(window);
        let rect = ElementTouchHelper.getBoundingContentRect(element);
        Services.embedlite.zoomToRect(winid,
                                      rect.x - fudge,
                                      viewportY + (rect.y - this._lastTargetY),
                                      viewportWidth / viewportWResolution,
                                      viewportHeight / viewportHResolution);
        this._lastTarget = null;
      }
      this._viewportReadyToChange = false;
      this._viewportLastResolution = this._viewportData.resolution.width;
    }
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
            if (ElementTouchHelper.isElementClickable(element)) {
              [x, y] = this._moveClickPoint(element, x, y);
            }

            this._sendMouseEvent("mousemove", element, x, y);
            this._sendMouseEvent("mousedown", element, x, y);
            this._sendMouseEvent("mouseup",   element, x, y);

            // scrollToFocusedInput does its own checks to find out if an element should be zoomed into
            let { targetWindow: targetWindow,
                  offsetX: offsetX,
                  offsetY: offsetY } = Util.translateToTopLevelWindow(element);

            this.scrollToFocusedInput(targetWindow);
          } catch(e) {
            Cu.reportError(e);
          }
          this._touchElement = null;
        } else {
          this.previousInputY = -1;
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
        if (this._viewportLastResolution == 0 && this._viewportData != null) {
          this._viewportLastResolution = this._viewportData.resolution.width;
        }

        // Floor cssCompositedRect.height and ceil cssPageRect.height that there needs to be more than 1px difference.
        // Background reason being that TabChildHelper floors viewport x and y values.
        if (!this.returnToBoundsRequested && this._viewportData.y + Math.floor(this._viewportData.cssCompositedRect.height) > Math.ceil(this._viewportData.cssPageRect.height)) {
          let y = -this._viewportData.cssCompositedRect.height + this._viewportData.cssPageRect.height
          var winid = Services.embedlite.getIDByWindow(content);
          Services.embedlite.zoomToRect(winid, this._viewportData.x, y,
                                        this._viewportData.cssCompositedRect.width, this._viewportData.cssCompositedRect.height);
          this.returnToBoundsRequested = true;
        } else {
          this.returnToBoundsRequested = false;
        }

        this.performReflow();
        break;
      }
      default: {
        dump("Child Script: Message: name:" + aMessage.name + ", json:" + JSON.stringify(aMessage.json) + "\n");
        break;
      }
    }
  },

  _rectVisibility: function(aSourceRect, aViewportRect) {
    let vRect = aViewportRect ? aViewportRect : new Rect(this._viewportData.compositionBounds.x + this._viewportData.x,
                                                         this._viewportData.compositionBounds.y + this._viewportData.y,
                                                         this._viewportData.compositionBounds.width / this._viewportData.resolution.width,
                                                         this._viewportData.compositionBounds.height / this._viewportData.resolution.width);
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

    // TODO / Missing: handle maximum zoom level and respect viewport meta tag

    let scaleFactor = aIsTextField ? this.inputItemSize / rect.h : 1.0;
    let margin = this.zoomMargin / scaleFactor;
    let allowZoom = aAllowZoom && rect.height != this.inputItemSize;

    // Width and height scaled to css coordinates
    let cssViewPort = new Rect(this._viewportData.x,
                         this._viewportData.y,
                         this._viewportData.compositionBounds.width / this._viewportData.resolution.scale,
                         this._viewportData.compositionBounds.height / this._viewportData.resolution.scale);
    let bRect = new Rect(Util.clamp(rect.x - margin, 0, this._viewportData.cssPageRect.width - rect.w),
                        Util.clamp(rect.y - margin, 0, this._viewportData.cssPageRect.height - rect.h),
                        allowZoom ? rect.w + 2 * margin : this._viewportData.viewport.width,
                        rect.h);

    // constrict the rect to the screen's right edge
    bRect.width = Math.min(bRect.width, (this._viewportData.cssPageRect.x + cssViewPort.x + this._viewportData.cssPageRect.width) - bRect.x);

    let dxLeft = rect.x - cssViewPort.x;
    let dxRight = cssViewPort.x + cssViewPort.width - (rect.x + rect.w);
    let dxTop = rect.y - cssViewPort.y;
    let dxBottom = cssViewPort.y + cssViewPort.height - (rect.y + rect.h);

    let scrollToRight = Math.abs(dxLeft) > Math.abs(dxRight);
    let scrollToBottom = Math.abs(dxTop) > Math.abs(dxBottom);

    // TODO: Allow staying on y-axis and x-axis so that actual zoom in / zoom out path would be as short as possible

    const originalInputWidth = rect.w;
    const originalInputHeight = rect.h;

    rect.w = bRect.width * scaleFactor;
    rect.h = Math.min(bRect.width * this._viewportData.viewport.height / this._viewportData.viewport.width, bRect.height);
    // rect.w is now of composition rectangle width

    let aspectRatio = this._viewportData.compositionBounds.width / this._viewportData.compositionBounds.height
    const compositionWidth = rect.w;
    // First focus needs rough compositionHeight as virtual keyboard is not yet raised.
    // Let's see do we need to handle portrait / landscape differently.
    const compositionHeight = this.previousInputY == -1 ? compositionWidth - 3 * margin : compositionWidth / aspectRatio;

    let fixedCurrentViewport = this.previousInputY != -1 ? cssViewPort : new Rect(cssViewPort.x, cssViewPort.y, cssViewPort.width, compositionHeight);

    // We want to scale input so that it will be readable. In case we move from one input field to another or refocus
    // the same field we don't want to move input if it's already visible and of correct size.
    let halfMargin = margin / 2;
    let inputRect = new Rect(rect.x - halfMargin, rect.y - halfMargin, originalInputWidth + halfMargin, originalInputHeight + halfMargin);
    let { showing: showing } = this._rectVisibility(inputRect, fixedCurrentViewport);
    if (fuzzyEquals(rect.w, cssViewPort.width) && showing > 0.99) {
      return;
    }

    // Adjust position based on new composition area size.
    if (scrollToRight && aIsTextField && originalInputWidth < compositionWidth - 2 * margin) {
      rect.x = rect.x - (compositionWidth - originalInputWidth - margin);
      rect.x = Util.clamp(rect.x, 0, this._viewportData.cssPageRect.width - originalInputWidth);
    } else {
      rect.x = bRect.x;
    }

    if (scrollToBottom && aIsTextField && originalInputHeight < compositionHeight - 2 * margin) {
      rect.y = rect.y - (compositionHeight - originalInputHeight - margin);
      rect.y = Util.clamp(rect.y, 0, this._viewportData.cssPageRect.height - originalInputHeight)
    } else {
      rect.y = bRect.y;
    }

    if (rect.w > this._viewportData.compositionBounds.width || rect.h > this._viewportData.compositionBounds.height) {
      this.resetMaxLineBoxWidth();
    }

    var winid = Services.embedlite.getIDByWindow(content);
    Services.embedlite.zoomToRect(winid, rect.x, rect.y, rect.w, rect.h);
  },

  _moveClickPoint: function(aElement, aX, aY) {
    // the element can be out of the aX/aY point because of the touch radius
    // if outside, we gracefully move the touch point to the edge of the element
    if (!(aElement instanceof Ci.nsIDOMHTMLHtmlElement)) {
      let isTouchClick = true;
      let rects = ElementTouchHelper.getContentClientRects(aElement);
      for (let i = 0; i < rects.length; i++) {
        let rect = rects[i];
        let inBounds =
          (aX > rect.left && aX < (rect.left + rect.width)) &&
          (aY > rect.top && aY < (rect.top + rect.height));
        if (inBounds) {
          isTouchClick = false;
          break;
        }
        }

      if (isTouchClick) {
        let rect = rects[0];
        // if either width or height is zero, we don't want to move the click to the edge of the element. See bug 757208
        if (rect.width != 0 && rect.height != 0) {
          aX = Math.min(Math.floor(rect.left + rect.width), Math.max(Math.ceil(rect.left), aX));
          aY = Math.min(Math.floor(rect.top + rect.height), Math.max(Math.ceil(rect.top),  aY));
        }
      }
    }
    return [aX, aY];
  },

  _sendMouseEvent: function _sendMouseEvent(aName, aElement, aX, aY) {
    let window = aElement.ownerDocument.defaultView;
    try {
      let cwu = window.top.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
      cwu.sendMouseEventToWindow(aName, aX, aY, 0, 1, 0, true);
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
    }
  },

  isBrowserContentDocumentDisplayed: function() {
    if (content.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils).isFirstPaint) {
      return false;
    }
    return this.contentDocumentIsDisplayed;
  },

  _handleTouchMove: function(aEvent) {
    this._cancelTapHighlight();
  },

  _handleTouchEnd: function(aEvent) {
    this._viewportReadyToChange = true;
    this._cancelTapHighlight();
  },

  _handleTouchStart: function(aEvent) {
    if (this._touchElement) {
      this._touchElement = null;
    }
    if (!this.isBrowserContentDocumentDisplayed() || aEvent.touches.length > 1 || aEvent.defaultPrevented)
      return;

    let closest = aEvent.target;
    this._lastTarget = aEvent.target;
    this._lastTargetY = ElementTouchHelper.getBoundingContentRect(aEvent.target).y;

    if (closest) {
      // If we've pressed a scrollable element, let Java know that we may
      // want to override the scroll behaviour (for document sub-frames)
      this._scrollableElement = this._findScrollableElement(closest, true);
      this._firstScrollEvent = true;
    }

    if (!ElementTouchHelper.isElementClickable(closest, null, false))
      closest = ElementTouchHelper.elementFromPoint(aEvent.changedTouches[0].screenX,
                                                    aEvent.changedTouches[0].screenY);
    if (!closest)
      closest = aEvent.target;

    if (closest) {
      // SelectionHandler._onSelectionAttach(aEvent.changedTouches[0].screenX, aEvent.changedTouches[0].screenY);
      let uri = this._getLinkURI(closest);
      if (uri) {
        Services.io.QueryInterface(Ci.nsISpeculativeConnect).speculativeConnect(uri, null);
      }
      this._doTapHighlight(closest);
    }
  },

  _hasScrollableOverflow: function(elem) {
    var win = elem.ownerDocument.defaultView;
    if (!win)
      return false;
    var computedStyle = win.getComputedStyle(elem);
    if (!computedStyle)
      return false;
    return computedStyle.overflowX == 'auto' || computedStyle.overflowX == 'scroll'
        || computedStyle.overflowY == 'auto' || computedStyle.overflowY == 'scroll';
  },

  _findScrollableElement: function(elem, checkElem) {
    // Walk the DOM tree until we find a scrollable element
    let scrollable = false;

    while (elem) {
      /* Element is scrollable if its scroll-size exceeds its client size, and:
       * - It has overflow 'auto' or 'scroll'
       * - It's a textarea
       * - It's an HTML/BODY node
       * - It's a select element showing multiple rows
       */
      if (checkElem) {
        if (((elem.scrollHeight > elem.clientHeight) ||
             (elem.scrollWidth > elem.clientWidth)) &&
            (this._hasScrollableOverflow(elem) ||
             elem.mozMatchesSelector("html, body, textarea")) ||
            (elem instanceof HTMLSelectElement && (elem.size > 1 || elem.multiple))) {
          scrollable = true;
          break;
        }
      } else {
        checkElem = true;
      }

      // Propagate up iFrames
      if (!elem.parentNode && elem.documentElement && elem.documentElement.ownerDocument)
        elem = elem.documentElement.ownerDocument.defaultView.frameElement;
      else
        elem = elem.parentNode;
    }

    if (!scrollable)
      return null;

    return elem;
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
};

const kReferenceDpi = 240; // standard "pixel" size used in some preferences

const ElementTouchHelper = {
  /* Return the element at the given coordinates, starting from the given window and
     drilling down through frames. If no window is provided, the top-level window of
     the currently selected tab is used. The coordinates provided should be CSS pixels
     relative to the window's scroll position. */
  anyElementFromPoint: function(aX, aY, aWindow) {
    let win = (aWindow ? aWindow : content);
    let cwu = win.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
    let elem = cwu.elementFromPoint(aX, aY, false, true);

    while (elem && (elem instanceof HTMLIFrameElement || elem instanceof HTMLFrameElement)) {
      let rect = elem.getBoundingClientRect();
      aX -= rect.left;
      aY -= rect.top;
      cwu = elem.contentDocument.defaultView.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
      elem = cwu.elementFromPoint(aX, aY, false, true);
    }

    return elem;
  },

  /* Return the most appropriate clickable element (if any), starting from the given window
     and drilling down through iframes as necessary. If no window is provided, the top-level
     window of the currently selected tab is used. The coordinates provided should be CSS
     pixels relative to the window's scroll position. The element returned may not actually
     contain the coordinates passed in because of touch radius and clickability heuristics. */
  elementFromPoint: function(aX, aY, aWindow) {
    // browser's elementFromPoint expect browser-relative client coordinates.
    // subtract browser's scroll values to adjust
    let win = (aWindow ? aWindow : content);
    let cwu = win.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
    let elem = this.getClosest(cwu, aX, aY);

    // step through layers of IFRAMEs and FRAMES to find innermost element
    while (elem && (elem instanceof HTMLIFrameElement || elem instanceof HTMLFrameElement)) {
      // adjust client coordinates' origin to be top left of iframe viewport
      let rect = elem.getBoundingClientRect();
      aX -= rect.left;
      aY -= rect.top;
      cwu = elem.contentDocument.defaultView.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
      elem = this.getClosest(cwu, aX, aY);
    }

    return elem;
  },

  /* Returns the touch radius in content px. */
  getTouchRadius: function getTouchRadius(aWindowUtils) {
    let dpiRatio = 1.0; // TODO: check if it's needed as "resX = zoom.scale/dpiRatio" already
    let zoom = 1.0;
    let resX = {value: 1};
    let resY = {value: 1};
    aWindowUtils.getResolution(resX, resY);
    if (resX.value) {
      zoom = resX.value;
    }

    return {
      top: this.radius.top * dpiRatio / zoom,
      right: this.radius.right * dpiRatio / zoom,
      bottom: this.radius.bottom * dpiRatio / zoom,
      left: this.radius.left * dpiRatio / zoom
    };
  },

  /* Returns the touch radius in reference pixels. */
  get radius() {
    let prefs = Services.prefs;
    delete this.radius;
    return this.radius = { "top": prefs.getIntPref("browser.ui.touch.top"),
                           "right": prefs.getIntPref("browser.ui.touch.right"),
                           "bottom": prefs.getIntPref("browser.ui.touch.bottom"),
                           "left": prefs.getIntPref("browser.ui.touch.left")
                         };
  },

  get weight() {
    delete this.weight;
    return this.weight = { "visited": Services.prefs.getIntPref("browser.ui.touch.weight.visited") };
  },

  /* Retrieve the closest element to a point by looking at borders position */
  getClosest: function getClosest(aWindowUtils, aX, aY) {
    let target = aWindowUtils.elementFromPoint(aX, aY,
                                               true,   /* ignore root scroll frame*/
                                               false); /* don't flush layout */

    // if this element is clickable we return quickly. also, if it isn't,
    // use a cache to speed up future calls to isElementClickable in the
    // loop below.
    let unclickableCache = new Array();
    if (this.isElementClickable(target, unclickableCache, false))
      return target;

    target = null;
    let radius = this.getTouchRadius(aWindowUtils);
    let nodes = aWindowUtils.nodesFromRect(aX, aY, radius.top, radius.right, radius.bottom, radius.left, true, false);

    let threshold = Number.POSITIVE_INFINITY;
    for (let i = 0; i < nodes.length; i++) {
      let current = nodes[i];
      if (!current.mozMatchesSelector || !this.isElementClickable(current, unclickableCache, true))
        continue;

      let rect = current.getBoundingClientRect();
      let distance = this._computeDistanceFromRect(aX, aY, rect);

      // increase a little bit the weight for already visited items
      if (current && current.mozMatchesSelector("*:visited"))
        distance *= (this.weight.visited / 100);

      if (distance < threshold) {
        target = current;
        threshold = distance;
      }
    }

    return target;
  },

  isElementClickable: function isElementClickable(aElement, aUnclickableCache, aAllowBodyListeners) {
    const selector = "a,:link,:visited,[role=button],button,input,select,textarea";

    let stopNode = null;
    if (!aAllowBodyListeners && aElement && aElement.ownerDocument)
      stopNode = aElement.ownerDocument.body;

    for (let elem = aElement; elem && elem != stopNode; elem = elem.parentNode) {
      if (aUnclickableCache && aUnclickableCache.indexOf(elem) != -1)
        continue;
      if (this._hasMouseListener(elem))
        return true;
      if (elem.mozMatchesSelector && elem.mozMatchesSelector(selector))
        return true;
      if (elem instanceof HTMLLabelElement && elem.control != null)
        return true;
      if (aUnclickableCache)
        aUnclickableCache.push(elem);
    }
    return false;
  },

  _computeDistanceFromRect: function _computeDistanceFromRect(aX, aY, aRect) {
    let x = 0, y = 0;
    let xmost = aRect.left + aRect.width;
    let ymost = aRect.top + aRect.height;

    // compute horizontal distance from left/right border depending if X is
    // before/inside/after the element's rectangle
    if (aRect.left < aX && aX < xmost)
      x = Math.min(xmost - aX, aX - aRect.left);
    else if (aX < aRect.left)
      x = aRect.left - aX;
    else if (aX > xmost)
      x = aX - xmost;

    // compute vertical distance from top/bottom border depending if Y is
    // above/inside/below the element's rectangle
    if (aRect.top < aY && aY < ymost)
      y = Math.min(ymost - aY, aY - aRect.top);
    else if (aY < aRect.top)
      y = aRect.top - aY;
    if (aY > ymost)
      y = aY - ymost;

    return Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
  },

  _els: Cc["@mozilla.org/eventlistenerservice;1"].getService(Ci.nsIEventListenerService),
  _clickableEvents: ["mousedown", "mouseup", "click"],
  _hasMouseListener: function _hasMouseListener(aElement) {
    let els = this._els;
    let listeners = els.getListenerInfoFor(aElement, {});
    for (let i = 0; i < listeners.length; i++) {
      if (this._clickableEvents.indexOf(listeners[i].type) != -1)
        return true;
    }
    return false;
  },

  getContentClientRects: function(aElement) {
    let offset = { x: 0, y: 0 };

    let nativeRects = aElement.getClientRects();
    // step out of iframes and frames, offsetting scroll values
    for (let frame = aElement.ownerDocument.defaultView; frame.frameElement; frame = frame.parent) {
      // adjust client coordinates' origin to be top left of iframe viewport
      let rect = frame.frameElement.getBoundingClientRect();
      let left = frame.getComputedStyle(frame.frameElement, "").borderLeftWidth;
      let top = frame.getComputedStyle(frame.frameElement, "").borderTopWidth;
      offset.x += rect.left + parseInt(left);
      offset.y += rect.top + parseInt(top);
    }

    let result = [];
    for (let i = nativeRects.length - 1; i >= 0; i--) {
      let r = nativeRects[i];
      result.push({ left: r.left + offset.x,
                    top: r.top + offset.y,
                    width: r.width,
                    height: r.height
                  });
    }
    return result;
  },

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

