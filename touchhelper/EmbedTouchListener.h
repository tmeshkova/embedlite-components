/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef EmbedTouchListener_H_
#define EmbedTouchListener_H_

#include "nsWeakReference.h"
#include "nsIObserver.h"
#include "nsIDOMEventListener.h"
#include "nsIEmbedAppService.h"
#include "nsIDOMWindow.h"
#include "gfxRect.h"

#define MOZ_DOMTitleChanged "DOMTitleChanged"
#define MOZ_DOMContentLoaded "DOMContentLoaded"
#define MOZ_DOMLinkAdded "DOMLinkAdded"
#define MOZ_DOMWillOpenModalDialog "DOMWillOpenModalDialog"
#define MOZ_DOMModalDialogClosed "DOMModalDialogClosed"
#define MOZ_DOMWindowClose "DOMWindowClose"
#define MOZ_DOMPopupBlocked "DOMPopupBlocked"
#define MOZ_pageshow "pageshow"
#define MOZ_pagehide "pagehide"
#define MOZ_DOMMetaAdded "DOMMetaAdded"

class EmbedTouchListener : public nsIDOMEventListener,
                           public mozilla::layers::GeckoContentController
{
public:
    EmbedTouchListener(nsIDOMWindow* aWin);
    virtual ~EmbedTouchListener();

    NS_DECL_ISUPPORTS
    NS_DECL_NSIDOMEVENTLISTENER

    virtual void RequestContentRepaint(const mozilla::layers::FrameMetrics&);
    virtual void HandleDoubleTap(const mozilla::CSSIntPoint&);
    virtual void HandleSingleTap(const mozilla::CSSIntPoint&);
    virtual void HandleLongTap(const mozilla::CSSIntPoint&);
    virtual void SendAsyncScrollDOMEvent(mozilla::layers::FrameMetrics::ViewID, const mozilla::CSSRect&, const mozilla::CSSSize&);
    virtual void ScrollUpdate(const mozilla::CSSPoint&, float);
    virtual void PostDelayedTask(Task*, int) {}

    nsCOMPtr<nsIDOMWindow> DOMWindow;
private:
    void AnyElementFromPoint(nsIDOMWindow* aWindow, double aX, double aY, nsIDOMElement* *aElem);
    bool ShouldZoomToElement(nsIDOMElement* aElement);
    void ZoomToElement(nsIDOMElement* aElement,
                       int aClickY = -1,
                       bool aCanZoomOut = true,
                       bool aCanZoomIn = true);
    mozilla::gfx::Rect GetBoundingContentRect(nsIDOMElement* aElement);
    bool IsRectZoomedIn(mozilla::gfx::Rect aRect, mozilla::gfx::Rect aViewport);

    nsCOMPtr<nsIEmbedAppService> mService;
    bool mGotViewPortUpdate;
    mozilla::gfx::Rect mViewport;
    mozilla::gfx::Rect mCssCompositedRect;
    mozilla::gfx::Rect mCssPageRect;
    uint32_t mTopWinid;
};

#endif /*EmbedTouchListener_H_*/
