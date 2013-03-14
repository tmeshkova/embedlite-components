/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "EmbedWidgetFactoryRegister.h"

#include "nsServiceManagerUtils.h"
#include "nsIObserverService.h"
#include "nsIComponentRegistrar.h"
#include "nsIComponentManager.h"
#include "GenericFactory.h"
#include "mozilla/ModuleUtils.h"
#include "nsComponentManagerUtils.h"

#include "nsILoginManager.h"
#include "nsIFormHistory.h"
#include "nsWidgetsCID.h"
#include "nsFilePicker.h"

using namespace mozilla::embedlite;

NS_GENERIC_FACTORY_CONSTRUCTOR(nsEmbedFilePicker)

EmbedWidgetFactoryRegister::EmbedWidgetFactoryRegister()
{
}

EmbedWidgetFactoryRegister::~EmbedWidgetFactoryRegister()
{
}

NS_IMPL_ISUPPORTS1(EmbedWidgetFactoryRegister, nsSupportsWeakReference)

nsresult
EmbedWidgetFactoryRegister::Init()
{
    nsCOMPtr<nsIComponentRegistrar> cr;
    nsresult rv = NS_GetComponentRegistrar(getter_AddRefs(cr));
    NS_ENSURE_SUCCESS(rv, NS_ERROR_FAILURE);

    nsCOMPtr<nsIComponentManager> cm;
    rv = NS_GetComponentManager (getter_AddRefs (cm));
    NS_ENSURE_SUCCESS(rv, NS_ERROR_FAILURE);

    nsCOMPtr<nsIFactory> fp = new mozilla::embedlite::GenericFactory(nsEmbedFilePickerConstructor);
    if (!fp) {
        NS_WARNING("Unable to create factory for component");
        return NS_ERROR_FAILURE;
    }
    nsCOMPtr<nsIFactory> oldFactory = do_GetClassObject("@mozilla.org/filepicker;1");
    if (oldFactory) {
        nsCID* cid = NULL;
        rv = cr->ContractIDToCID("@mozilla.org/filepicker;1", &cid);
        if (!NS_FAILED(rv)) {
            rv = cr->UnregisterFactory(*cid, oldFactory.get());
            NS_Free(cid);
            if (NS_FAILED(rv)) {
                return NS_ERROR_FAILURE;
            }
        }
    }

    nsCID fpickerCID = NS_EMBED_FILEPICKER_SERVICE_CID;
    rv = cr->RegisterFactory(fpickerCID, "EmbedLite FilePicker",
                             "@mozilla.org/filepicker;1", fp);

    return NS_OK;
}
