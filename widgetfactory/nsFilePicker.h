/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef NS_EMBED_FILEPICKER_H
#define NS_EMBED_FILEPICKER_H

#include "nsCOMArray.h"
#include "nsStringGlue.h"
#include "nsIFilePicker.h"
#include "nsIEmbedAppService.h"
#include <map>
#include <string>

class nsEmbedFilePicker : public nsIFilePicker, public nsIEmbedMessageListener
{
public:
    nsEmbedFilePicker();

    NS_DECL_ISUPPORTS
    NS_DECL_NSIFILEPICKER
    NS_DECL_NSIEMBEDMESSAGELISTENER

private:
    ~nsEmbedFilePicker();
    nsresult DoSendAsyncPrompt(int mode);
    nsCString mFile;
    int mModalDepth;
    nsCOMPtr<nsIEmbedAppService> mService;
    nsCOMPtr<nsIDOMWindow> mWin;
    nsAString mTitle;
};

#define NS_EMBED_FILEPICKER_SERVICE_CID \
{ 0xeb16e75a, \
  0x8156, \
  0x11e2, \
  { 0xac, 0x82, 0x5f, 0xc3, 0xa0, 0x10, 0xd6 }}


#endif // NS_EMBED_FILEPICKER_H
