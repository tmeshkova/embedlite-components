/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "EmbedChromeListener.h"

#include "nsServiceManagerUtils.h"
#include "nsIObserverService.h"
#include "mozilla/embedlite/EmbedLog.h"

#include "nsStringGlue.h"
#include "nsIInterfaceRequestorUtils.h"
#include "nsIDOMWindow.h"
#include "nsIDOMEventTarget.h"
#include "nsIDOMEvent.h"
#include "nsIURI.h"
#include "nsIDOMDocument.h"
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

EmbedChromeListener::EmbedChromeListener(nsIDOMWindow* aWin)
  :  DOMWindow(aWin)
  ,  mWindowCounter(0)
{
    if (!mService) {
        mService = do_GetService("@mozilla.org/embedlite-app-service;1");
    }
}

EmbedChromeListener::~EmbedChromeListener()
{
}

NS_IMPL_ISUPPORTS(EmbedChromeListener, nsIDOMEventListener)

nsresult
GetDOMWindowByNode(nsIDOMNode *aNode, nsIDOMWindow **aDOMWindow)
{
    nsresult rv;
    nsCOMPtr<nsIDOMDocument> ctDoc = do_QueryInterface(aNode, &rv);
    NS_ENSURE_SUCCESS(rv , rv);
    nsCOMPtr<nsIDOMWindow> targetWin;
    rv = ctDoc->GetDefaultView(getter_AddRefs(targetWin));
    NS_ENSURE_SUCCESS(rv , rv);
    *aDOMWindow = targetWin.forget().take();
    return rv;
}

NS_IMETHODIMP
GetTopWindow(nsIDOMWindow* aWin, nsIDOMWindow **aDOMWindow)
{
    nsCOMPtr<nsIDOMWindow> window;
    nsCOMPtr<nsIWebNavigation> navNav(do_GetInterface(aWin));
    nsCOMPtr<nsIDocShellTreeItem> navItem(do_QueryInterface(navNav));
    NS_ENSURE_TRUE(navItem, NS_ERROR_FAILURE);
    nsCOMPtr<nsIDocShellTreeItem> rootItem;
    navItem->GetRootTreeItem(getter_AddRefs(rootItem));
    nsCOMPtr<nsIDOMWindow> rootWin(do_GetInterface(rootItem));
    NS_ENSURE_TRUE(rootWin, NS_ERROR_FAILURE);
    rootWin->GetTop(getter_AddRefs(window));
    *aDOMWindow = window.forget().take();
    return NS_OK;
}


NS_IMETHODIMP
EmbedChromeListener::HandleEvent(nsIDOMEvent* aEvent)
{
    nsresult rv;
    nsString type;
    if (aEvent) {
        aEvent->GetType(type);
    }
    // LOGT("Event:'%s'", NS_ConvertUTF16toUTF8(type).get());

    nsString messageName;
    nsString message;
    // Just simple property bag support still
    nsCOMPtr<nsIEmbedLiteJSON> json = do_GetService("@mozilla.org/embedlite-json;1", &rv);
    if (!json) {
        LOGT("Failed to create json component");
    }
    nsCOMPtr<nsIWritablePropertyBag2> root;
    json->CreateObject(getter_AddRefs(root));

    nsCOMPtr<nsIDOMWindow> docWin = do_GetInterface(DOMWindow);
    nsCOMPtr<nsPIDOMWindow> window = do_GetInterface(DOMWindow);

    uint32_t winid;
    mService->GetIDByWindow(window, &winid);
    NS_ENSURE_TRUE(winid , NS_ERROR_FAILURE);
    mService->EnterSecureJSContext();
    nsCOMPtr<nsIDOMWindowUtils> utils = do_GetInterface(window);

    if (type.EqualsLiteral(MOZ_DOMMetaAdded)) {
        messageName.AssignLiteral("chrome:metaadded");
    } else if (type.EqualsLiteral(MOZ_DOMContentLoaded)) {
        nsCOMPtr<nsIDOMDocument> ctDoc;
        window->GetDocument(getter_AddRefs(ctDoc));
        nsString docURI;
        ctDoc->GetDocumentURI(docURI);
        if (!docURI.EqualsLiteral("about:blank")) {
            messageName.AssignLiteral("chrome:contentloaded");
            root->SetPropertyAsAString(NS_LITERAL_STRING("docuri"), docURI);
        }
        // Need send session history from here
    } else if (type.EqualsLiteral(MOZ_DOMLinkAdded)) {
        nsCOMPtr<nsIDOMEventTarget> origTarget;
        aEvent->GetOriginalTarget(getter_AddRefs(origTarget));
        nsCOMPtr<nsIDOMHTMLLinkElement> disabledIface = do_QueryInterface(origTarget);
        nsString href;
        bool disabled = true;
        disabledIface->GetMozDisabled(&disabled);
        if (!disabledIface || disabled) {
            mService->LeaveSecureJSContext();
            return NS_OK;
        }
        disabledIface->GetHref(href);
        nsCOMPtr<nsIDOMDocument> ctDoc;
        window->GetDocument(getter_AddRefs(ctDoc));
        // ignore on frames and other documents
        nsCOMPtr<nsIDOMDocument> ownDoc;
        nsCOMPtr<nsIDOMNode> node = do_QueryInterface(origTarget);
        node->GetOwnerDocument(getter_AddRefs(ownDoc));
        if (ownDoc != ctDoc) {
          mService->LeaveSecureJSContext();
          return NS_OK;
        }

        nsString charset, title, rel, type;
        ctDoc->GetCharacterSet(charset);
        ctDoc->GetTitle(title);
        disabledIface->GetRel(rel);
        disabledIface->GetType(type);
        nsString sizes;
        nsCOMPtr<nsIDOMElement> element = do_QueryInterface(origTarget);
        bool hasSizesAttr = false;
        if (NS_SUCCEEDED(element->HasAttribute(NS_LITERAL_STRING("sizes"), &hasSizesAttr)) && hasSizesAttr) {
            element->GetAttribute(NS_LITERAL_STRING("sizes"), sizes);
        }
        messageName.AssignLiteral("chrome:linkadded");
        root->SetPropertyAsAString(NS_LITERAL_STRING("href"), href);
        root->SetPropertyAsAString(NS_LITERAL_STRING("charset"), charset);
        root->SetPropertyAsAString(NS_LITERAL_STRING("title"), title);
        root->SetPropertyAsAString(NS_LITERAL_STRING("rel"), rel);
        root->SetPropertyAsAString(NS_LITERAL_STRING("sizes"), sizes);
        root->SetPropertyAsAString(NS_LITERAL_STRING("get"), type);
    } else if (type.EqualsLiteral(MOZ_DOMWillOpenModalDialog) ||
               type.EqualsLiteral(MOZ_DOMModalDialogClosed) ||
               type.EqualsLiteral(MOZ_DOMWindowClose)) {
        messageName.AssignLiteral("chrome:winopenclose");
        root->SetPropertyAsAString(NS_LITERAL_STRING("type"), type);
    } else if (type.EqualsLiteral(MOZ_DOMPopupBlocked)) {
        uint64_t outerWindowID = 0;
        utils->GetOuterWindowID(&outerWindowID);
        nsCOMPtr<nsIDOMPopupBlockedEvent> popupEvent = do_QueryInterface(aEvent);
        nsCOMPtr<nsIURI> popupUri;
        popupEvent->GetPopupWindowURI(getter_AddRefs(popupUri));
        nsString popupWinFeatures, popupWindowName;
        nsCString spec, origCharset;
        popupUri->GetSpec(spec);
        popupUri->GetOriginCharset(origCharset);
        popupEvent->GetPopupWindowFeatures(popupWinFeatures);
        popupEvent->GetPopupWindowName(popupWindowName);

        messageName.AssignLiteral("chrome:popupblocked");
        root->SetPropertyAsACString(NS_LITERAL_STRING("spec"), spec);
        root->SetPropertyAsACString(NS_LITERAL_STRING("origCharset"), origCharset);
        root->SetPropertyAsAString(NS_LITERAL_STRING("popupWinFeatures"), popupWinFeatures);
        root->SetPropertyAsAString(NS_LITERAL_STRING("popupWindowName"), popupWindowName);
    } else if (type.EqualsLiteral(MOZ_pageshow) ||
               type.EqualsLiteral(MOZ_pagehide)) {
        nsCOMPtr<nsIDOMEventTarget> target;
        aEvent->GetTarget(getter_AddRefs(target));
        nsCOMPtr<nsIDOMDocument> ctDoc = do_QueryInterface(target);
        nsCOMPtr<nsIDOMWindow> targetWin;
        ctDoc->GetDefaultView(getter_AddRefs(targetWin));
        if (targetWin != docWin) {
            mService->LeaveSecureJSContext();
            return NS_OK;
        }
        nsCOMPtr<nsIDOMWindowUtils> tutils = do_GetInterface(targetWin);
        uint64_t outerWindowID = 0, tinnerID = 0;
        tutils->GetOuterWindowID(&outerWindowID);
        tutils->GetCurrentInnerWindowID(&tinnerID);
        int32_t innerWidth, innerHeight;
        docWin->GetInnerWidth(&innerWidth);
        docWin->GetInnerHeight(&innerHeight);
        nsCOMPtr<nsIDOMPageTransitionEvent> transEvent = do_QueryInterface(aEvent);
        bool persisted = false;
        transEvent->GetPersisted(&persisted);
        messageName.AssignLiteral("chrome:");
        messageName.Append(type);
        root->SetPropertyAsBool(NS_LITERAL_STRING("persisted"), persisted);
    } else {
        mService->LeaveSecureJSContext();
        return NS_OK;
    }

    nsString outStr;
    json->CreateJSON(root, message);
    mService->SendAsyncMessage(winid, messageName.get(), message.get());
    mService->LeaveSecureJSContext();

    return NS_OK;
}
