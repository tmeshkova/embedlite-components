/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#define LOG_COMPONENT "EmbedChromeManager"
#include "mozilla/embedlite/EmbedLog.h"

#include "EmbedChromeManager.h"
#include "EmbedChromeListener.h"

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
#include "nsIDOMPopupBlockedEvent.h"
#include "nsIDOMPageTransitionEvent.h"
#include "nsIFocusManager.h"
#include "nsIDocShellTreeItem.h"
#include "nsIWebNavigation.h"

EmbedChromeManager::EmbedChromeManager()
  : mWindowCounter(0)
{
}

EmbedChromeManager::~EmbedChromeManager()
{
}

NS_IMPL_ISUPPORTS2(EmbedChromeManager, nsIObserver, nsSupportsWeakReference)

nsresult
EmbedChromeManager::Init()
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
EmbedChromeManager::Observe(nsISupports *aSubject,
                             const char *aTopic,
                             const PRUnichar *aData)
{
    nsresult rv;
    if (!strcmp(aTopic, "domwindowopened")) {
        nsCOMPtr<nsIDOMWindow> win = do_QueryInterface(aSubject, &rv);
        NS_ENSURE_SUCCESS(rv, NS_OK);
        WindowCreated(win);
    } else if (!strcmp(aTopic, "domwindclosed")) {
        nsCOMPtr<nsIDOMWindow> win = do_QueryInterface(aSubject, &rv);
        NS_ENSURE_SUCCESS(rv, NS_OK);
        WindowDestroyed(win);
    } else {
        LOGT("obj:%p, top:%s", aSubject, aTopic);
    }

    return NS_OK;
}

void
EmbedChromeManager::WindowCreated(nsIDOMWindow* aWin)
{
    LOGT("WindowOpened: %p", aWin);
    nsCOMPtr<nsPIDOMWindow> pidomWindow = do_GetInterface(aWin);
    NS_ENSURE_TRUE(pidomWindow, );
    nsCOMPtr<nsIDOMEventTarget> target = do_QueryInterface(pidomWindow->GetChromeEventHandler());
    NS_ENSURE_TRUE(target, );
    nsCOMPtr<EmbedChromeListener> listener = new EmbedChromeListener(aWin);
    target->AddEventListener(NS_LITERAL_STRING(MOZ_DOMTitleChanged), listener,  PR_FALSE);
    target->AddEventListener(NS_LITERAL_STRING(MOZ_DOMContentLoaded), listener,  PR_FALSE);
    target->AddEventListener(NS_LITERAL_STRING(MOZ_DOMLinkAdded), listener,  PR_FALSE);
    target->AddEventListener(NS_LITERAL_STRING(MOZ_DOMWillOpenModalDialog), listener,  PR_FALSE);
    target->AddEventListener(NS_LITERAL_STRING(MOZ_DOMModalDialogClosed), listener,  PR_FALSE);
    target->AddEventListener(NS_LITERAL_STRING(MOZ_DOMWindowClose), listener,  PR_FALSE);
    target->AddEventListener(NS_LITERAL_STRING(MOZ_DOMPopupBlocked), listener,  PR_FALSE);
    target->AddEventListener(NS_LITERAL_STRING(MOZ_pageshow), listener,  PR_FALSE);
    target->AddEventListener(NS_LITERAL_STRING(MOZ_pagehide), listener,  PR_FALSE);
    target->AddEventListener(NS_LITERAL_STRING(MOZ_DOMMetaAdded), listener,  PR_FALSE);
    mArray.AppendObject(listener);
    mWindowCounter++;
    if (!mService) {
        mService = do_GetService("@mozilla.org/embedlite-app-service;1");
    }
}

void
EmbedChromeManager::WindowDestroyed(nsIDOMWindow* aWin)
{
    LOGT("WindowClosed: %p", aWin);
    nsCOMPtr<nsPIDOMWindow> pidomWindow = do_GetInterface(aWin);
    NS_ENSURE_TRUE(pidomWindow, );
    nsCOMPtr<nsIDOMEventTarget> target = do_QueryInterface(pidomWindow->GetChromeEventHandler());
    NS_ENSURE_TRUE(target, );
    nsCOMPtr<EmbedChromeListener> listener;
    int i = 0;
    for (i = 0; i < mArray.Count(); ++i) {
        if (mArray[i]->DOMWindow.get() == aWin) {
            listener = mArray[i];
            break;
        }
    }
    mArray.RemoveObjectAt(i);
    target->RemoveEventListener(NS_LITERAL_STRING(MOZ_DOMTitleChanged), listener,  PR_FALSE);
    target->RemoveEventListener(NS_LITERAL_STRING(MOZ_DOMContentLoaded), listener,  PR_FALSE);
    target->RemoveEventListener(NS_LITERAL_STRING(MOZ_DOMLinkAdded), listener,  PR_FALSE);
    target->RemoveEventListener(NS_LITERAL_STRING(MOZ_DOMWillOpenModalDialog), listener,  PR_FALSE);
    target->RemoveEventListener(NS_LITERAL_STRING(MOZ_DOMModalDialogClosed), listener,  PR_FALSE);
    target->RemoveEventListener(NS_LITERAL_STRING(MOZ_DOMWindowClose), listener,  PR_FALSE);
    target->RemoveEventListener(NS_LITERAL_STRING(MOZ_DOMPopupBlocked), listener,  PR_FALSE);
    target->RemoveEventListener(NS_LITERAL_STRING(MOZ_pageshow), listener,  PR_FALSE);
    target->RemoveEventListener(NS_LITERAL_STRING(MOZ_pagehide), listener,  PR_FALSE);
    target->RemoveEventListener(NS_LITERAL_STRING(MOZ_DOMMetaAdded), listener,  PR_FALSE);
    mWindowCounter--;
    if (!mWindowCounter) {
        mService = nullptr;
    }
}

