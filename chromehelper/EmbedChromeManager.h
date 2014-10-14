/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef EmbedChromeManager_H_
#define EmbedChromeManager_H_

#include "nsWeakReference.h"
#include "nsIObserver.h"
#include "nsIDOMEventListener.h"
#include "nsIEmbedAppService.h"
#include "EmbedChromeListener.h"
#include "nsCOMArray.h"

class EmbedChromeManager : public nsIObserver,
                           public nsSupportsWeakReference
{
public:
    EmbedChromeManager();

    NS_DECL_ISUPPORTS
    NS_DECL_NSIOBSERVER

    nsresult Init();
private:
    virtual ~EmbedChromeManager();

    void WindowCreated(nsIDOMWindow* aWin);
    void WindowDestroyed(nsIDOMWindow* aWin);
    nsCOMPtr<nsIEmbedAppService> mService;
    int mWindowCounter;
    typedef nsCOMArray<EmbedChromeListener> ObserversArray;
    ObserversArray mArray;
};

#define NS_EMBED_CHROME_CONTRACTID "@mozilla.org/embed-chrome-component;1"
#define NS_EMBED_CHROME_SERVICE_CLASSNAME "Embed Chrome Listener Component"
#define NS_EMBED_CHROME_SERVICE_CID \
{ 0xc0e99ee0, \
  0x6e88, \
  0x11e2, \
  { 0xad, 0x40, 0xaf, 0xe0, 0x02, 0x59, 0x55 }}

#endif /*EmbedChromeManager_H_*/
