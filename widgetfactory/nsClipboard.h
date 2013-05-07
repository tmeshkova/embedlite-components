/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef nsEmbedClipboard_h__
#define nsEmbedClipboard_h__

#include "nsIClipboard.h"
#include "nsIClipboardOwner.h"
#include "nsAutoPtr.h"
#include "nsCOMPtr.h"

/* Native Qt Clipboard wrapper */
class nsEmbedClipboard : public nsIClipboard
{
public:
    nsEmbedClipboard();
    virtual ~nsEmbedClipboard();

    //nsISupports
    NS_DECL_ISUPPORTS

    // nsIClipboard
    NS_DECL_NSICLIPBOARD
};

#define NS_EMBED_CLIPBOARD_SERVICE_CID \
{ 0xb27ca13c, \
  0xb6d5, \
  0x11e2, \
  { 0xb8, 0xc8, 0x1b, 0x7d, 0x85, 0x77, 0x09 }}

#endif // nsEmbedClipboard_h__
