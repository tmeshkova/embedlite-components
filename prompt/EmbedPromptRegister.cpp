/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "EmbedPromptRegister.h"

#include "nsServiceManagerUtils.h"
#include "nsIObserverService.h"
#include "EmbedPromptService.h"
#include "nsIComponentRegistrar.h"
#include "nsIComponentManager.h"
#include "GenericFactory.h"
#include "mozilla/ModuleUtils.h"
#include "nsComponentManagerUtils.h"

#include "nsILoginManager.h"
#include "nsIFormHistory.h"

using namespace mozilla::embedlite;

NS_GENERIC_FACTORY_CONSTRUCTOR(EmbedPromptFactory)

EmbedPromptRegister::EmbedPromptRegister()
{
}

EmbedPromptRegister::~EmbedPromptRegister()
{
}

NS_IMPL_ISUPPORTS2(EmbedPromptRegister, nsIObserver, nsSupportsWeakReference)

nsresult
EmbedPromptRegister::Init()
{
    nsCOMPtr<nsIComponentRegistrar> cr;
    nsresult rv = NS_GetComponentRegistrar(getter_AddRefs(cr));
    NS_ENSURE_SUCCESS(rv, NS_ERROR_FAILURE);

    nsCOMPtr<nsIComponentManager> cm;
    rv = NS_GetComponentManager (getter_AddRefs (cm));
    NS_ENSURE_SUCCESS(rv, NS_ERROR_FAILURE);

    nsCOMPtr<nsIFactory> f = new mozilla::embedlite::GenericFactory(EmbedPromptFactoryConstructor);
    if (!f) {
        NS_WARNING("Unable to create factory for component");
        return NS_ERROR_FAILURE;
    }

    nsCOMPtr<nsIFactory> oldFactory = do_GetClassObject("@mozilla.org/prompter;1");
    if (oldFactory) {
        nsCID* cid = NULL;
        rv = cr->ContractIDToCID("@mozilla.org/prompter;1", &cid);
        if (!NS_FAILED(rv)) {
            rv = cr->UnregisterFactory(*cid, oldFactory.get());
            NS_Free(cid);
            if (NS_FAILED(rv)) {
                return NS_ERROR_FAILURE;
            }
        }
    }

    nsCID promptCID = EMBED_LITE_PROMPT_SERVICE_CID;
    rv = cr->RegisterFactory(promptCID, "EmbedLite Prompt",
                             "@mozilla.org/prompter;1", f);

    nsCOMPtr<nsIObserverService> observerService =
        do_GetService(NS_OBSERVERSERVICE_CONTRACTID);

    if (observerService) {
        observerService->AddObserver(this,
                                     "outer-window-destroyed",
                                     true);
    }

    // Init LoginManager
    nsCOMPtr<nsILoginManager> pwdmgr = do_GetService("@mozilla.org/login-manager;1");
    // Init FormHistory
    nsCOMPtr<nsIFormHistory2> formHistory = do_GetService("@mozilla.org/satchel/form-history");

    return NS_OK;
}

NS_IMETHODIMP
EmbedPromptRegister::Observe(nsISupports *aSubject,
                            const char *aTopic,
                            const PRUnichar *aData)
{
    return NS_OK;
}
