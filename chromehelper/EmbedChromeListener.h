/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef EmbedChromeListener_H_
#define EmbedChromeListener_H_

#include "nsWeakReference.h"
#include "nsIObserver.h"
#include "nsIDOMEventListener.h"
#include "nsIEmbedAppService.h"
#include "nsIDOMWindow.h"

#define MOZ_DOMContentLoaded "DOMContentLoaded"
#define MOZ_DOMLinkAdded "DOMLinkAdded"
#define MOZ_DOMWillOpenModalDialog "DOMWillOpenModalDialog"
#define MOZ_DOMModalDialogClosed "DOMModalDialogClosed"
#define MOZ_DOMWindowClose "DOMWindowClose"
#define MOZ_DOMMetaAdded "DOMMetaAdded"

class EmbedChromeListener : public nsIDOMEventListener
{
public:
    EmbedChromeListener(nsIDOMWindow* aWin);

    NS_DECL_ISUPPORTS
    NS_DECL_NSIDOMEVENTLISTENER

    nsCOMPtr<nsIDOMWindow> DOMWindow;
private:
    virtual ~EmbedChromeListener();

    nsCOMPtr<nsIEmbedAppService> mService;
    int mWindowCounter;
};

#endif /*EmbedChromeListener_H_*/
