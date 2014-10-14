/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsEmbedAlertsService_h__
#define nsEmbedAlertsService_h__

#include "nsIAlertsService.h"
#include "nsCOMPtr.h"

class nsEmbedAlertsService : public nsIAlertsService,
                             public nsIAlertsProgressListener
{
public:
  NS_DECL_NSIALERTSPROGRESSLISTENER
  NS_DECL_NSIALERTSSERVICE
  NS_DECL_ISUPPORTS

  nsEmbedAlertsService();

protected:
  virtual ~nsEmbedAlertsService();
  bool ShouldShowAlert();
};

#define NS_EMBED_ALERTS_SERVICE_CID \
{ 0xa6d8ca00, \
  0x896b, \
  0x11e2, \
  { 0x8f, 0x33, 0xb7, 0xe2, 0x65, 0x26, 0x98 }}


#endif /* nsEmbedAlertsService_h__ */
