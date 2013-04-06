/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "EmbedTouchListener.h"

#include "nsServiceManagerUtils.h"
#include "nsIObserverService.h"
#include "mozilla/embedlite/EmbedLog.h"

#include "nsStringGlue.h"
#include "nsIInterfaceRequestorUtils.h"
#include "nsIDOMWindow.h"
#include "nsIDOMEventTarget.h"
#include "nsIDOMEvent.h"
#include "nsPIDOMWindow.h"
#include "nsIEmbedLiteJSON.h"
#include "nsComponentManagerUtils.h"
#include "nsIVariant.h"
#include "nsHashPropertyBag.h"
#include "nsIDOMWindowUtils.h"
#include "nsIDOMHTMLLinkElement.h"
#include "nsIDOMPopupBlockedEvent.h"
#include "nsIDOMPageTransitionEvent.h"
#include "nsIFocusManager.h"
#include "nsIDocShellTreeItem.h"
#include "nsIWebNavigation.h"
#include "nsIDOMHTMLIFrameElement.h"
#include "nsIDOMHTMLFrameElement.h"
#include "nsIDOMClientRect.h"
#include "nsIDOMHTMLLIElement.h"
#include "nsIDOMCSSStyleDeclaration.h"
#include "nsIWidget.h"
#include "nsIBaseWindow.h"
#include "nsIDOMHTMLTextAreaElement.h"
#include "nsIDOMHTMLBodyElement.h"
#include "nsIDOMHTMLInputElement.h"
#include "nsIDOMHTMLAnchorElement.h"
#include "nsIDOMHTMLAreaElement.h"
#include "nsIDOMHTMLImageElement.h"

using namespace mozilla;

EmbedTouchListener::EmbedTouchListener(nsIDOMWindow* aWin)
  : DOMWindow(aWin)
  , mGotViewPortUpdate(false)
  , mHadResizeSinceLastFrameUpdate(false)
{
    if (!mService) {
        mService = do_GetService("@mozilla.org/embedlite-app-service;1");
    }
    mService->GetIDByWindow(aWin, &mTopWinid);
}

EmbedTouchListener::~EmbedTouchListener()
{
}

NS_IMPL_ISUPPORTS1(EmbedTouchListener, nsIDOMEventListener)

void EmbedTouchListener::HandleSingleTap(const nsIntPoint& aPoint)
{
    LOGT("pt[%i,%i]", aPoint.x, aPoint.y);
}

void EmbedTouchListener::HandleLongTap(const nsIntPoint& aPoint)
{
    LOGT("pt[%i,%i]", aPoint.x, aPoint.y);
}

void EmbedTouchListener::SendAsyncScrollDOMEvent(const mozilla::gfx::Rect& aRect,
                                                 const mozilla::gfx::Size& aSize)
{
    // LOGT("r[%g,%g,%g,%g], size[%g,%g]", aRect.x, aRect.y, aRect.width, aRect.height, aSize.width, aSize.height);
    if (mContentRect.width != aRect.width || mContentRect.height != aRect.height)
        mHadResizeSinceLastFrameUpdate = true;
    mContentRect = aRect;
    mScrollSize = aSize;
}

NS_IMETHODIMP
EmbedTouchListener::HandleEvent(nsIDOMEvent* aEvent)
{
    nsString type;
    if (aEvent) {
        aEvent->GetType(type);
    }
    LOGT("Event:'%s'", NS_ConvertUTF16toUTF8(type).get());

    return NS_OK;
}

void EmbedTouchListener::RequestContentRepaint(const mozilla::layers::FrameMetrics& aMetrics)
{
//    LOGT("Metr off[%g,%g], vp[%g,%g,%g,%g], scrRe[%g,%g,%g,%g], res[%g,%g]",
//         aMetrics.mScrollOffset.x, aMetrics.mScrollOffset.y,
//         aMetrics.mViewport.x, aMetrics.mViewport.y, aMetrics.mViewport.width, aMetrics.mViewport.height,
//         aMetrics.mScrollableRect.x, aMetrics.mScrollableRect.y, aMetrics.mScrollableRect.width, aMetrics.mScrollableRect.height,
//         aMetrics.mResolution.width, aMetrics.mResolution.height);
    mGotViewPortUpdate = true;
    mViewport = gfx::Rect(aMetrics.mScrollOffset.x, aMetrics.mScrollOffset.y,
                          aMetrics.mViewport.width, aMetrics.mViewport.height);
    mCssCompositedRect = gfx::Rect(aMetrics.mScrollOffset.x, aMetrics.mScrollOffset.y,
                                   0, 0);
    float x, y;
    mService->GetCompositedRectInCSS(aMetrics, &x, &y, &mCssCompositedRect.width, &mCssCompositedRect.height);

    mCssPageRect = gfx::Rect(aMetrics.mScrollableRect.x, aMetrics.mScrollableRect.y,
                             aMetrics.mScrollableRect.width, aMetrics.mScrollableRect.height);

    nsCOMPtr<nsIBaseWindow> parentWindow;
    nsCOMPtr<nsIWebBrowser> br;
    mService->GetBrowserByID(mTopWinid, getter_AddRefs(br));
    parentWindow = do_QueryInterface(br);
    nsCOMPtr<nsIWidget> widget;
    if (parentWindow)
        parentWindow->GetMainWidget(getter_AddRefs(widget));

    const widget::InputContext& ctx = widget->GetInputContext();
    if (ctx.mIMEState.mEnabled && mHadResizeSinceLastFrameUpdate) {
        ScrollToFocusedInput(false);
    }
    mHadResizeSinceLastFrameUpdate = false;
}

void EmbedTouchListener::HandleDoubleTap(const nsIntPoint& aPoint)
{
    LOGT("pt[%i,%i]", aPoint.x, aPoint.y);
    // We haven't received a metrics update yet; don't do anything.
    if (!mGotViewPortUpdate) {
        return;
    }

    nsCOMPtr<nsIDOMElement> element;
    gfxRect retRect(0,0,0,0);
    AnyElementFromPoint(DOMWindow, aPoint.x, aPoint.y, getter_AddRefs(element));
    if (!element) {
        mService->ZoomToRect(mTopWinid, 0, 0, 0, 0);
        return;
    }

    nsCOMPtr<nsIDOMNode> node = do_QueryInterface(element);
    NS_ENSURE_TRUE(node, );
    nsCOMPtr<nsIDOMElement> elementtest = element;
    while (elementtest && !ShouldZoomToElement(elementtest)) {
        node->GetParentNode(getter_AddRefs(node));
        elementtest = do_QueryInterface(node);
        if (elementtest) {
            element = elementtest;
        }
    }
        
    if (!element) {
        mService->ZoomToRect(mTopWinid, 0, 0, 0, 0);
    } else {
        ZoomToElement(element, aPoint.y, true, true);
    }
}

void
EmbedTouchListener::AnyElementFromPoint(nsIDOMWindow* aWindow, double aX, double aY, nsIDOMElement* *aElem)
{
    nsCOMPtr<nsIDOMWindowUtils> utils = do_GetInterface(aWindow);
    nsCOMPtr<nsIDOMElement> elem;
    NS_ENSURE_SUCCESS(utils->ElementFromPoint(aX, aY, true, true, getter_AddRefs(elem)), );

    nsCOMPtr<nsIDOMHTMLIFrameElement> elAsIFrame = do_QueryInterface(elem);
    nsCOMPtr<nsIDOMHTMLFrameElement> elAsFrame = do_QueryInterface(elem);
    while (elem && (elAsIFrame || elAsFrame)) {
        nsCOMPtr<nsIDOMClientRect> rect;
        elem->GetBoundingClientRect(getter_AddRefs(rect));
        float left, top;
        rect->GetLeft(&left);
        rect->GetTop(&top);
        aX -= left;
        aY -= top;
        nsCOMPtr<nsIDOMDocument> contentDocument;
        if (!elAsIFrame || NS_FAILED(elAsIFrame->GetContentDocument(getter_AddRefs(contentDocument)))) {
            if (!elAsFrame || NS_FAILED(elAsFrame->GetContentDocument(getter_AddRefs(contentDocument)))) {
                break;
            }
        }
        nsCOMPtr<nsIDOMWindow> newWin;
        contentDocument->GetDefaultView(getter_AddRefs(newWin));
        utils = do_GetInterface(newWin);
        if (NS_FAILED(utils->ElementFromPoint(aX, aY, true, true, getter_AddRefs(elem)))) {
            elem = nullptr;
        } else {
            elAsIFrame = do_QueryInterface(elem);
            elAsFrame = do_QueryInterface(elem);
        }
    }
    if (elem) {
        NS_ADDREF(*aElem = elem);
    }

    return;
}

bool
EmbedTouchListener::ShouldZoomToElement(nsIDOMElement* aElement)
{
    nsCOMPtr<nsIDOMNode> node = do_QueryInterface(aElement);
    NS_ENSURE_TRUE(node, false);

    nsCOMPtr<nsIDOMDocument> document;
    NS_ENSURE_SUCCESS(node->GetOwnerDocument(getter_AddRefs(document)), false);

    nsCOMPtr<nsIDOMWindow> win;
    NS_ENSURE_SUCCESS(document->GetDefaultView(getter_AddRefs(win)), false);

    nsCOMPtr<nsIDOMCSSStyleDeclaration> bW;
    NS_ENSURE_SUCCESS(win->GetComputedStyle(aElement, nsString(), getter_AddRefs(bW)), false);

    nsString display;
    if (NS_SUCCEEDED(bW->GetPropertyValue(NS_LITERAL_STRING("display"), display))) {
        if (display.EqualsLiteral("inline")) {
            return false;
        }
    }
    nsCOMPtr<nsIDOMHTMLLIElement> liel = do_QueryInterface(aElement);
    nsCOMPtr<nsIDOMHTMLLIElement> qoteel = do_QueryInterface(aElement);
    if (liel || qoteel)
        return false;

    return true;
}

/* Zoom to an element, optionally keeping a particular part of it
 * in view if it is really tall.
 */
void
EmbedTouchListener::ZoomToElement(nsIDOMElement* aElement, int aClickY, bool aCanZoomOut, bool aCanZoomIn)
{
    const int margin = 15;
    gfx::Rect clrect = GetBoundingContentRect(aElement);
    gfxRect rect(clrect.x, clrect.y, clrect.width, clrect.height);

    gfx::Rect bRect = gfx::Rect(aCanZoomIn ? std::max(mCssPageRect.x, clrect.x - margin) : mCssPageRect.x,
                                clrect.y,
                                aCanZoomIn ? clrect.width + 2 * margin : mCssPageRect.width,
                                clrect.height);

    // constrict the rect to the screen's right edge
    bRect.width = std::min(bRect.width, (mCssPageRect.x + mCssPageRect.width) - bRect.x);

    // if the rect is already taking up most of the visible area and is stretching the
    // width of the page, then we want to zoom out instead.
    if (IsRectZoomedIn(bRect, mCssCompositedRect)) {
        if (aCanZoomOut) {
            mService->ZoomToRect(mTopWinid, 0, 0, 0, 0);
        }
        return;
    }

    rect.x = round(bRect.x);
    rect.y = round(bRect.y);
    rect.width = round(bRect.width);
    rect.height = round(bRect.height);

    // if the block we're zooming to is really tall, and the user double-tapped
    // more than a screenful of height from the top of it, then adjust the y-coordinate
    // so that we center the actual point the user double-tapped upon. this prevents
    // flying to the top of a page when double-tapping to zoom in (bug 761721).
    // the 1.2 multiplier is just a little fuzz to compensate for bRect including horizontal
    // margins but not vertical ones.
    float cssTapY = mViewport.y + aClickY;
    if ((bRect.height > rect.height) && (cssTapY > rect.y + (rect.height * 1.2))) {
        rect.y = cssTapY - (rect.height / 2);
    }

    // rect.height by default equals to element height, and will cause zoomIn
    if (!aCanZoomIn) {
        // set rect height to current page height and adjust rect.y in order to cover possible CSS page size
        rect.height = mCssCompositedRect.height;
        if (rect.YMost() > mCssPageRect.YMost()) {
            rect.y -= rect.YMost() - mCssPageRect.YMost();
        }
    }

    mService->ZoomToRect(mTopWinid, rect.x, rect.y, rect.width, rect.height);
}

gfx::Rect
EmbedTouchListener::GetBoundingContentRect(nsIDOMElement* aElement)
{
    gfx::Rect retRect(0, 0, 0, 0);
    if (!aElement)
      return retRect;

    nsCOMPtr<nsIDOMNode> node = do_QueryInterface(aElement);
    NS_ENSURE_TRUE(node, retRect);
    
    nsCOMPtr<nsIDOMDocument> document;
    NS_ENSURE_SUCCESS(node->GetOwnerDocument(getter_AddRefs(document)), retRect);
    nsCOMPtr<nsIDOMWindow> newWin;
    NS_ENSURE_SUCCESS(document->GetDefaultView(getter_AddRefs(newWin)), retRect);
    nsCOMPtr<nsIDOMElement> element;
    newWin->GetFrameElement(getter_AddRefs(element));
    while (element) {
        if (NS_FAILED(node->GetOwnerDocument(getter_AddRefs(document))) ||
            NS_FAILED(document->GetDefaultView(getter_AddRefs(newWin))) ||
            NS_FAILED(newWin->GetFrameElement(getter_AddRefs(element)))) {
            element = nullptr;
            break;
        }
    }

    nsCOMPtr<nsIDOMWindowUtils> utils = do_GetInterface(newWin);
    int32_t scrollX = 0, scrollY = 0;
    NS_ENSURE_SUCCESS(utils->GetScrollXY(false, &scrollX, &scrollY), retRect);
    nsCOMPtr<nsIDOMClientRect> r;
    aElement->GetBoundingClientRect(getter_AddRefs(r));

    // step out of iframes and frames, offsetting scroll values
    nsCOMPtr<nsIDOMWindow> itWin;
    NS_ENSURE_SUCCESS(node->GetOwnerDocument(getter_AddRefs(document)), retRect);
    NS_ENSURE_SUCCESS(document->GetDefaultView(getter_AddRefs(itWin)), retRect);
    itWin->GetFrameElement(getter_AddRefs(element));
    while (element && itWin != DOMWindow) {
        // adjust client coordinates' origin to be top left of iframe viewport
        nsCOMPtr<nsIDOMClientRect> gr;
        element->GetBoundingClientRect(getter_AddRefs(gr));
        float grleft, grtop;
        gr->GetLeft(&grleft);
        gr->GetTop(&grtop);

        nsCOMPtr<nsIDOMCSSStyleDeclaration> bW;
        itWin->GetComputedStyle(element, NS_LITERAL_STRING(""), getter_AddRefs(bW));
        nsString blw, btw;
        bW->GetPropertyValue(NS_LITERAL_STRING("border-left-width"), blw);
        bW->GetPropertyValue(NS_LITERAL_STRING("border-top-width"), btw);
        scrollX += grleft + atoi(NS_ConvertUTF16toUTF8(blw).get());
        scrollY += grtop + atoi(NS_ConvertUTF16toUTF8(btw).get());
        itWin->GetParent(getter_AddRefs(itWin));
        itWin->GetFrameElement(getter_AddRefs(element));
    }

    float rleft = 0, rtop = 0, rwidth = 0, rheight = 0;
    r->GetLeft(&rleft);
    r->GetTop(&rtop);
    r->GetWidth(&rwidth);
    r->GetHeight(&rheight);

    return gfx::Rect(rleft + scrollX,
                     rtop + scrollY,
                     rwidth, rheight);
}

bool
EmbedTouchListener::IsRectZoomedIn(gfx::Rect aRect, gfx::Rect aViewport)
{
    // This function checks to see if the area of the rect visible in the
    // viewport (i.e. the "overlapArea" variable below) is approximately 
    // the max area of the rect we can show.
    gfx::Rect vRect(aViewport);
    gfx::Rect overlap = vRect.Intersect(aRect);
    float overlapArea = overlap.width * overlap.height;
    float availHeight = std::min(aRect.width * vRect.height / vRect.width, aRect.height);
    float showing = overlapArea / (aRect.width * availHeight);
    float ratioW = (aRect.width / vRect.width);
    float ratioH = (aRect.height / vRect.height);

    return (showing > 0.9 && (ratioW > 0.9 || ratioH > 0.9)); 
}

void EmbedTouchListener::ScrollToFocusedInput(bool aAllowZoom)
{
    nsCOMPtr<nsIDOMElement> focused;
    GetFocusedInput(getter_AddRefs(focused));
    if (focused) {
        // _zoomToElement will handle not sending any message if this input is already mostly filling the screen
        ZoomToElement(focused, -1, false, aAllowZoom);
    }
}

nsresult
EmbedTouchListener::GetFocusedInput(nsIDOMElement* *aElement,
                                    bool aOnlyInputElements)
{
    nsresult rv;
    nsCOMPtr<nsIDOMDocument> doc;
    rv = DOMWindow->GetDocument(getter_AddRefs(doc));
    NS_ENSURE_TRUE(doc, rv);

    nsCOMPtr<nsIDOMElement> focused;
    doc->GetActiveElement(getter_AddRefs(focused));

    nsCOMPtr<nsIDOMHTMLIFrameElement> elAsIFrame = do_QueryInterface(focused);
    nsCOMPtr<nsIDOMHTMLFrameElement> elAsFrame = do_QueryInterface(focused);
    while (elAsIFrame || elAsFrame) {
        if (!elAsIFrame || NS_FAILED(elAsIFrame->GetContentDocument(getter_AddRefs(doc)))) {
            if (!elAsFrame || NS_FAILED(elAsFrame->GetContentDocument(getter_AddRefs(doc)))) {
                NS_ERROR("This should not happen");
            }
        }
        doc->GetActiveElement(getter_AddRefs(focused));
        elAsIFrame = do_QueryInterface(focused);
        elAsFrame = do_QueryInterface(focused);
    }
    nsCOMPtr<nsIDOMHTMLInputElement> input = do_QueryInterface(focused);
    if (input) {
        bool isText = false;
        if (NS_SUCCEEDED(input->MozIsTextField(false, &isText)) && isText) {
            NS_ADDREF(*aElement = input);
            return NS_OK;
        }
    }

    if (aOnlyInputElements) {
        return NS_ERROR_FAILURE;
    }

    nsCOMPtr<nsIDOMHTMLTextAreaElement> textarea = do_QueryInterface(focused);
    bool IsContentEditable = false;
    if (!textarea) {
        nsCOMPtr<nsIDOMHTMLElement> editDiv = do_QueryInterface(focused);
        if (editDiv) {
            editDiv->GetIsContentEditable(&IsContentEditable);
        }
    }
    if (textarea || IsContentEditable) {
        nsCOMPtr<nsIDOMHTMLBodyElement> body = do_QueryInterface(focused);
        if (body) {
            // we are putting focus into a contentEditable frame. scroll the frame into
            // view instead of the contentEditable document contained within, because that
            // results in a better user experience
            nsCOMPtr<nsIDOMNode> node = do_QueryInterface(focused);
            if (node) {
                node->GetOwnerDocument(getter_AddRefs(doc));
                if (doc) {
                    nsCOMPtr<nsIDOMWindow> newWin;
                    doc->GetDefaultView(getter_AddRefs(newWin));
                    if (newWin) {
                        newWin->GetFrameElement(getter_AddRefs(focused));
                    }
                }
            }
        }
        NS_ADDREF(*aElement = focused);
        return NS_OK;
    }
    return NS_ERROR_FAILURE;
}

void EmbedTouchListener::ScrollUpdate(const mozilla::gfx::Point&, float)
{
}
