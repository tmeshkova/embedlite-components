/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#define LOG_COMPONENT "EmbedTouchManager"
#include "mozilla/embedlite/EmbedLog.h"

#include "EmbedTouchManager.h"
#include "EmbedTouchListener.h"

#include "nsServiceManagerUtils.h"
#include "nsIObserverService.h"

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
#include "nsIFocusManager.h"
#include "nsIDocShellTreeItem.h"
#include "nsIWebNavigation.h"

EmbedTouchManager::EmbedTouchManager()
  : mWindowCounter(0)
{
}

EmbedTouchManager::~EmbedTouchManager()
{
}

NS_IMPL_ISUPPORTS(EmbedTouchManager, nsIObserver, nsISupportsWeakReference)

nsresult
EmbedTouchManager::Init()
{
    nsresult rv;
    nsCOMPtr<nsIObserverService> observerService =
        do_GetService(NS_OBSERVERSERVICE_CONTRACTID);

    if (observerService) {
        rv = observerService->AddObserver(this,
                                          "domwindowopened",
                                          true);
        NS_ENSURE_SUCCESS(rv, rv);
        rv = observerService->AddObserver(this,
                                          "embedliteviewcreated",
                                          true);
        NS_ENSURE_SUCCESS(rv, rv);
        rv = observerService->AddObserver(this,
                                          "domwindowclosed",
                                          true);
        NS_ENSURE_SUCCESS(rv, rv);
        rv = observerService->AddObserver(this, NS_XPCOM_SHUTDOWN_OBSERVER_ID,
                                          false);
        NS_ENSURE_SUCCESS(rv, rv);
    }

    return rv;
}

NS_IMETHODIMP
EmbedTouchManager::Observe(nsISupports *aSubject,
                             const char *aTopic,
                             const char16_t *aData)
{
    nsresult rv;
    if (!strcmp(aTopic, "embedliteviewcreated")) {
        nsCOMPtr<nsIDOMWindow> win = do_QueryInterface(aSubject, &rv);
        NS_ENSURE_SUCCESS(rv, NS_OK);
        WindowCreated(win);
    } else if (!strcmp(aTopic, "domwindowclosed")) {
        nsCOMPtr<nsIDOMWindow> win = do_QueryInterface(aSubject, &rv);
        NS_ENSURE_SUCCESS(rv, NS_OK);
        WindowDestroyed(win);
    } else {
        LOGT("obj:%p, top:%s", aSubject, aTopic);
    }

    return NS_OK;
}

void
EmbedTouchManager::WindowCreated(nsIDOMWindow* aWin)
{
    LOGT("WindowOpened: %p", aWin);
    nsCOMPtr<nsPIDOMWindow> pidomWindow = do_GetInterface(aWin);
    NS_ENSURE_TRUE(pidomWindow, );
    nsCOMPtr<nsIDOMEventTarget> target = do_QueryInterface(pidomWindow->GetChromeEventHandler());
    NS_ENSURE_TRUE(target, );
    nsCOMPtr<EmbedTouchListener> listener = new EmbedTouchListener(aWin);
    mArray.AppendObject(listener);
    mWindowCounter++;
    if (!mService) {
        mService = do_GetService("@mozilla.org/embedlite-app-service;1");
    }
    uint32_t id = 0;
    mService->GetIDByWindow(aWin, &id);
    LOGT("id for window: %u", id);
    mService->AddContentListener(id, listener);
}

void
EmbedTouchManager::WindowDestroyed(nsIDOMWindow* aWin)
{
    LOGT("WindowClosed: %p", aWin);
    nsCOMPtr<nsPIDOMWindow> pidomWindow = do_GetInterface(aWin);
    NS_ENSURE_TRUE(pidomWindow, );
    nsCOMPtr<nsIDOMEventTarget> target = do_QueryInterface(pidomWindow->GetChromeEventHandler());
    NS_ENSURE_TRUE(target, );
    nsCOMPtr<EmbedTouchListener> listener;
    int i = 0;
    for (i = 0; i < mArray.Count(); ++i) {
        if (mArray[i]->DOMWindow.get() == aWin) {
            listener = mArray[i];
            break;
        }
    }
    mArray.RemoveObjectAt(i);
    mWindowCounter--;
    uint32_t id = 0;
    mService->GetIDByWindow(aWin, &id);
    mService->RemoveContentListener(id, listener);
    if (!mWindowCounter) {
        mService = nullptr;
    }
}

