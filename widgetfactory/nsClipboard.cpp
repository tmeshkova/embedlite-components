/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/Util.h"

#include "nsClipboard.h"
#include "nsISupportsPrimitives.h"
#include "nsIInputStream.h"
#include "nsStringStream.h"
#include "nsComponentManagerUtils.h"

#include "imgIContainer.h"
#include "gfxImageSurface.h"
#include "nsWidgetsCID.h"
#include "nsServiceManagerUtils.h"
#include "nsIEmbedLiteJSON.h"
#include "nsIObserverService.h"
#include "nsIWritablePropertyBag2.h"

using namespace mozilla;

static NS_DEFINE_CID(kCClipboardCID, NS_CLIPBOARD_CID);
static const char* sClipboardTextFlavors[] = { kUnicodeMime };

NS_IMPL_ISUPPORTS1(nsEmbedClipboard, nsIClipboard)

nsEmbedClipboard::nsEmbedClipboard() : nsIClipboard()
{
  if (!mService) {
    mService = do_GetService("@mozilla.org/embedlite-app-service;1");
  }
}

nsEmbedClipboard::~nsEmbedClipboard()
{
}

NS_IMETHODIMP
nsEmbedClipboard::SetData(nsITransferable* aTransferable, nsIClipboardOwner* anOwner, int32_t aWhichClipboard)
{
  if (aWhichClipboard != kGlobalClipboard)
    return NS_ERROR_NOT_IMPLEMENTED;

  nsCOMPtr<nsISupports> tmp;
  uint32_t len;
  nsresult rv  = aTransferable->GetTransferData(kUnicodeMime, getter_AddRefs(tmp),
                                                &len);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsISupportsString> supportsString = do_QueryInterface(tmp);
  // No support for non-text data
  NS_ENSURE_TRUE(supportsString, NS_ERROR_NOT_IMPLEMENTED);
  nsAutoString buffer;
  supportsString->GetData(buffer);

  bool isPrivateData = false;
  aTransferable->GetIsPrivateData(&isPrivateData);
  nsString message;
  // Just simple property bag support still
  nsCOMPtr<nsIEmbedLiteJSON> json = do_GetService("@mozilla.org/embedlite-json;1");
  nsCOMPtr<nsIWritablePropertyBag2> root;
  json->CreateObject(getter_AddRefs(root));
  root->SetPropertyAsAString(NS_LITERAL_STRING("data"), buffer);
  root->SetPropertyAsBool(NS_LITERAL_STRING("private"), isPrivateData);

  json->CreateJSON(root, message);
  nsCOMPtr<nsIObserverService> observerService =
    do_GetService(NS_OBSERVERSERVICE_CONTRACTID);
  // Possible we can avoid json stuff for this case and send uri directly
  if (observerService) {
    observerService->NotifyObservers(nullptr, "clipboard:setdata", message.get());
  }

  return NS_OK;
}

NS_IMETHODIMP
nsEmbedClipboard::GetData(nsITransferable* aTransferable, int32_t aWhichClipboard)
{
  if (aWhichClipboard != kGlobalClipboard)
    return NS_ERROR_NOT_IMPLEMENTED;

  nsAutoString buffer;
  printf("nsEmbedClipboard::GetData: clipID:%i, buff:%s - heh we did not make request\n", aWhichClipboard, NS_ConvertUTF16toUTF8(buffer).get());
//  ContentChild::GetSingleton()->SendGetClipboardText(aWhichClipboard, &buffer);

  nsresult rv;
  nsCOMPtr<nsISupportsString> dataWrapper =
    do_CreateInstance(NS_SUPPORTS_STRING_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = dataWrapper->SetData(buffer);
  NS_ENSURE_SUCCESS(rv, rv);

  // If our data flavor has already been added, this will fail. But we don't care
  aTransferable->AddDataFlavor(kUnicodeMime);

  nsCOMPtr<nsISupports> nsisupportsDataWrapper =
    do_QueryInterface(dataWrapper);
  rv = aTransferable->SetTransferData(kUnicodeMime, nsisupportsDataWrapper,
                                      buffer.Length() * sizeof(PRUnichar));
  NS_ENSURE_SUCCESS(rv, rv);

  return NS_OK;
}

NS_IMETHODIMP
nsEmbedClipboard::HasDataMatchingFlavors(const char* *aFlavorList, uint32_t aLength, int32_t aWhichClipboard, bool* aHasText)
{
  NS_ENSURE_ARG_POINTER(aHasText);
  *aHasText = true;
  return NS_OK;
}

NS_IMETHODIMP
nsEmbedClipboard::EmptyClipboard(int32_t aWhichClipboard)
{
  if (aWhichClipboard != kGlobalClipboard)
    return NS_ERROR_NOT_IMPLEMENTED;

  nsresult rv;
  nsCOMPtr<nsIClipboard> clipboard(do_GetService(kCClipboardCID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  clipboard->EmptyClipboard(nsIClipboard::kGlobalClipboard);

  return NS_OK;
}

NS_IMETHODIMP
nsEmbedClipboard::SupportsSelectionClipboard(bool* _retval)
{
  *_retval = false;
  return NS_OK;
}
