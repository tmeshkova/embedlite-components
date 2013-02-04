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
    virtual ~EmbedPromptRegister();

    NS_DECL_ISUPPORTS
    NS_DECL_NSIOBSERVER

    nsresult Init();
};

#define NS_EMBED_PROMPT_CONTRACTID "@mozilla.org/embed-prompt-component;1"
#define NS_EMBED_PROMPT_SERVICE_CLASSNAME "Embed Prompt Component"
#define NS_EMBED_PROMPT_SERVICE_CID \
{ 0x195eb924, \
  0x3ab1, \
  0x11e2, \
  { 0xa5, 0x9f, 0x4f, 0xbc, 0xae, 0x3e, 0x4e, 0xc3 }}

#endif /*EmbedPromptRegister_H_*/
