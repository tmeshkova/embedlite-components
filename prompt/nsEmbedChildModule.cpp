/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsServiceManagerUtils.h"
#include "nsICategoryManager.h"
#include "mozilla/ModuleUtils.h"
#include "nsIAppStartupNotifier.h"
#include "EmbedPromptRegister.h"
#include "nsNetCID.h"
#include <iostream>

// XPCOMGlueStartup
#include "nsXPCOMGlue.h"

/* ===== XPCOM registration stuff ======== */

NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(EmbedPromptRegister, Init)

NS_DEFINE_NAMED_CID(NS_EMBED_PROMPT_SERVICE_CID);

static const mozilla::Module::CIDEntry kEMBEDPROMPTCIDs[] = {
    { &kNS_EMBED_PROMPT_SERVICE_CID, false, NULL, EmbedPromptRegisterConstructor },
    { NULL }
};

static const mozilla::Module::ContractIDEntry kEMBEDPROMPTContracts[] = {
    { NS_EMBED_PROMPT_CONTRACTID, &kNS_EMBED_PROMPT_SERVICE_CID },
    { NULL }
};

static const mozilla::Module::CategoryEntry kEMBEDPROMPTCategories[] = {
    { APPSTARTUP_CATEGORY, NS_EMBED_PROMPT_SERVICE_CLASSNAME, NS_EMBED_PROMPT_CONTRACTID },
    { NULL }
};

static nsresult
EmbedPrompt_Initialize()
{
#ifdef XPCOM_GLUE
    XPCOMGlueStartup(getenv("XRE_LIBXPCOM_PATH"));
#endif
    return NS_OK;
}

static void
EmbedPrompt_Shutdown()
{
}

static const mozilla::Module kEMBEDPROMPTModule = {
    mozilla::Module::kVersion,
    kEMBEDPROMPTCIDs,
    kEMBEDPROMPTContracts,
    kEMBEDPROMPTCategories,
    NULL,
    EmbedPrompt_Initialize,
    EmbedPrompt_Shutdown
};

NSMODULE_DEFN(nsEmbedPromptModule) = &kEMBEDPROMPTModule;
