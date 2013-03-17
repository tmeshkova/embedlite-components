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
#include "nsIDOMWindowUtils.h"
#include "nsCOMPtr.h"
#include <map>
#include <string>

class EmbedFilePickerResponse
{
public:
    EmbedFilePickerResponse()
      : accepted(false)
    {}
    virtual ~EmbedFilePickerResponse() {}

    bool accepted;
    nsString filePath;
};

class nsEmbedFilePicker : public nsIFilePicker, public nsIEmbedMessageListener
{
public:
    nsEmbedFilePicker();

    NS_DECL_ISUPPORTS
    NS_DECL_NSIFILEPICKER
    NS_DECL_NSIEMBEDMESSAGELISTENER

private:
    ~nsEmbedFilePicker();
    nsresult DoSendPrompt();
    EmbedFilePickerResponse GetResponse();
    int mModalDepth;
    int mMode;
    nsCOMPtr<nsIEmbedAppService> mService;
    nsCOMPtr<nsIDOMWindow> mWin;
    nsString mTitle;
    nsString mDefaultName;
    nsCOMPtr<nsIFilePickerShownCallback> mCallback;
    std::map<uint32_t, EmbedFilePickerResponse> mResponseMap;
};

#define NS_EMBED_FILEPICKER_SERVICE_CID \
{ 0xeb16e75a, \
  0x8156, \
  0x11e2, \
  { 0xac, 0x82, 0x5f, 0xc3, 0xa0, 0x10, 0xd6 }}


#endif // NS_EMBED_FILEPICKER_H
