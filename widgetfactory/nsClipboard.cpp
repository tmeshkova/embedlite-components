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

using namespace mozilla;

NS_IMPL_ISUPPORTS1(nsEmbedClipboard, nsIClipboard)

nsEmbedClipboard::nsEmbedClipboard() : nsIClipboard()
{
}

nsEmbedClipboard::~nsEmbedClipboard()
{
}

NS_IMETHODIMP
nsEmbedClipboard::SetData(nsITransferable* aTransferable, nsIClipboardOwner* anOwner, int32_t aWhichClipboard)
{
  printf("nsEmbedClipboard::SetData NONIMPL\n");
  return NS_OK;
}

NS_IMETHODIMP
nsEmbedClipboard::GetData(nsITransferable* aTransferable, int32_t aWhichClipboard)
{
  printf("nsEmbedClipboard::GetData NONIMPL\n");
  return NS_OK;
}

NS_IMETHODIMP
nsEmbedClipboard::EmptyClipboard(int32_t aWhichClipboard)
{
  printf("nsEmbedClipboard::EmptyClipboard NONIMPL\n");
  return NS_OK;
}

NS_IMETHODIMP
nsEmbedClipboard::HasDataMatchingFlavors(const char* *aFlavorList, uint32_t aLength, int32_t aWhichClipboard, bool* _retval)
{
  NS_ENSURE_ARG_POINTER(_retval);
  printf("nsEmbedClipboard::HasDataMatchingFlavors NONIMPL\n");
  *_retval = false;
  return NS_OK;
}

NS_IMETHODIMP
nsEmbedClipboard::SupportsSelectionClipboard(bool* _retval)
{

  printf("nsEmbedClipboard::SupportsSelectionClipboard NONIMPL\n");
  *_retval = false;
  return NS_OK;
}
