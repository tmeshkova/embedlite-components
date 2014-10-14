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
#include "nsIObserver.h"

#define NS_EMBEDLITEHISTORY_CID \
{ 0xec7cf1e2, \
  0x6e88, \
  0x11e2, \
  { 0xa7, 0x9a, 0xfb, 0x19, 0xfe, 0x29, 0x97 }}

class EmbedHistoryListener : public mozilla::IHistory
                           , public nsIRunnable
                           , public nsIObserver
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_IHISTORY
  NS_DECL_NSIRUNNABLE
  NS_DECL_NSIOBSERVER

  nsresult Init() { return NS_OK; }

  /**
   * Obtains a pointer that has had AddRef called on it.  Used by the service
   * manager only.
   */
  static EmbedHistoryListener* GetSingleton();

  EmbedHistoryListener();

private:
  virtual ~EmbedHistoryListener() {}
  nsIEmbedAppService* GetService();

  static EmbedHistoryListener* sHistory;

  nsDataHashtable<nsCStringHashKey, nsTArray<mozilla::dom::Link*> *> mListeners;
  nsTPriorityQueue<nsCString> mPendingURIs;
  nsCOMPtr<nsIEmbedAppService> mService;
};

#define NS_EMBED_HISTORY_CONTRACTID "@mozilla.org/embed-history-component;1"
#define NS_EMBED_HISTORY_SERVICE_CLASSNAME "Embed History Listener Component"
#define NS_EMBED_HISTORY_SERVICE_CID NS_EMBEDLITEHISTORY_CID

#endif /*EmbedHistoryListener_H_*/
