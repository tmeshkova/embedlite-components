/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef EmbedPromptRegister_H_
#define EmbedPromptRegister_H_

#include "nsWeakReference.h"
#include "nsIObserver.h"

class EmbedPromptRegister : public nsIObserver,
                            public nsSupportsWeakReference
{
public:
    EmbedPromptRegister();

    NS_DECL_ISUPPORTS
    NS_DECL_NSIOBSERVER

    nsresult Init();

private:
    virtual ~EmbedPromptRegister();
};

#define NS_EMBED_PROMPT_CONTRACTID "@mozilla.org/embed-prompt-component;1"
#define NS_EMBED_PROMPT_SERVICE_CLASSNAME "Embed Prompt Component"
#define NS_EMBED_PROMPT_SERVICE_CID \
{ 0xd64e5366, \
  0x6e88, \
  0x11e2, \
  { 0xae, 0x17, 0x5b, 0xbd, 0xc0, 0x83, 0xa0 }}

#endif /*EmbedPromptRegister_H_*/
