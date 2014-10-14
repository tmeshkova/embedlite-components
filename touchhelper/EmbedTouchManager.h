/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef EmbedTouchManager_H_
#define EmbedTouchManager_H_

#include "nsWeakReference.h"
#include "nsIObserver.h"
#include "nsIDOMEventListener.h"
#include "nsIEmbedAppService.h"
#include "EmbedTouchListener.h"
#include "nsCOMArray.h"

class EmbedTouchManager : public nsIObserver,
                          public nsSupportsWeakReference
{
public:
    EmbedTouchManager();

    NS_DECL_ISUPPORTS
    NS_DECL_NSIOBSERVER

    nsresult Init();
private:
    virtual ~EmbedTouchManager();
    void WindowCreated(nsIDOMWindow* aWin);
    void WindowDestroyed(nsIDOMWindow* aWin);
    nsCOMPtr<nsIEmbedAppService> mService;
    int mWindowCounter;
    typedef nsCOMArray<EmbedTouchListener> ObserversArray;
    ObserversArray mArray;
};

#define NS_EMBED_TOUCH_CONTRACTID "@mozilla.org/embed-touch-component;1"
#define NS_EMBED_TOUCH_SERVICE_CLASSNAME "Embed Touch Listener Component"
#define NS_EMBED_TOUCH_SERVICE_CID \
{ 0x73b10fd8, \
  0x6ea0, \
  0x11e2, \
  { 0xaa, 0x35, 0xaf, 0xbc, 0x0d, 0x69, 0x54 }}

#endif /*EmbedTouchManager_H_*/
