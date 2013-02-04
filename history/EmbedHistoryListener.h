/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef EmbedHistoryListener_H_
#define EmbedHistoryListener_H_

#include "mozilla/IHistory.h"
#include "nsDataHashtable.h"
#include "nsTPriorityQueue.h"
#include "nsThreadUtils.h"
#include "nsIEmbedAppService.h"
#include "nsServiceManagerUtils.h"

#define NS_EMBEDLITEHISTORY_CID \
    {0xCCAA4780, 0x15DD, 0x40A7, {0xA1, 0x4F, 0x21, 0x56, 0xBC, 0x88, 0x2A, 0x0B}}

class EmbedHistoryListener : public mozilla::IHistory, public nsIRunnable
{
public:
    NS_DECL_ISUPPORTS
    NS_DECL_IHISTORY
    NS_DECL_NSIRUNNABLE

    nsresult Init() { return NS_OK; }

    /**
     * Obtains a pointer that has had AddRef called on it.  Used by the service
     * manager only.
     */
    static EmbedHistoryListener* GetSingleton();

    EmbedHistoryListener();

private:
    nsIEmbedAppService* GetService();

    static EmbedHistoryListener* sHistory;

    nsDataHashtable<nsStringHashKey, nsTArray<mozilla::dom::Link *> *> mListeners;
    nsTPriorityQueue<nsString> mPendingURIs;
    nsCOMPtr<nsIEmbedAppService> mService;
};


#define NS_EMBED_HISTORY_CONTRACTID "@mozilla.org/embed-history-component;1"
#define NS_EMBED_HISTORY_SERVICE_CLASSNAME "Embed History Listener Component"
#define NS_EMBED_HISTORY_SERVICE_CID NS_EMBEDLITEHISTORY_CID

#endif /*EmbedHistoryListener_H_*/
