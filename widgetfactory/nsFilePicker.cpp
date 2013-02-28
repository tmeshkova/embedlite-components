/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsFilePicker.h"
#include "nsNetUtil.h"
#include "nsIWidget.h"
#include "nsDirectoryServiceDefs.h"

//-----------------------------

/* Implementation file */

NS_IMPL_ISUPPORTS1(nsEmbedFilePicker, nsIFilePicker)

nsEmbedFilePicker::nsEmbedFilePicker()
{
  /* member initializers and constructor code */
}

nsEmbedFilePicker::~nsEmbedFilePicker()
{
  /* destructor code */
}

NS_IMETHODIMP nsEmbedFilePicker::Init(nsIDOMWindow* parent, const nsAString& title, int16_t mode)
{
  printf("nsEmbedFilePicker::Init NOT IMPLEMENTED: win:%p, title:%s, mode:%i", parent, NS_ConvertUTF16toUTF8(title).get(), mode);
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::AppendFilters(int32_t filterMask)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::AppendFilter(const nsAString& title, const nsAString& filter)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::GetDefaultString(nsAString& aDefaultString)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::SetDefaultString(const nsAString& aDefaultString)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::GetDefaultExtension(nsAString& aDefaultExtension)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::SetDefaultExtension(const nsAString& aDefaultExtension)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::GetFilterIndex(int32_t* aFilterIndex)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::SetFilterIndex(int32_t aFilterIndex)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::GetDisplayDirectory(nsIFile* *aDisplayDirectory)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::SetDisplayDirectory(nsIFile* aDisplayDirectory)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::GetFile(nsIFile* *aFile)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::GetFileURL(nsIURI* *aFileURL)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::GetFiles(nsISimpleEnumerator* *aFiles)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::GetAddToRecentDocs(bool* aAddToRecentDocs)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::SetAddToRecentDocs(bool aAddToRecentDocs)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::Show(int16_t* _retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::Open(nsIFilePickerShownCallback* aFilePickerShownCallback)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}
