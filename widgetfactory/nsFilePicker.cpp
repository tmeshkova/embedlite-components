/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsFilePicker.h"
#include "nsNetUtil.h"
#include "nsIWidget.h"
#include "nsDirectoryServiceDefs.h"
#include "nsIEmbedLiteJSON.h"
#include "nsNetUtil.h"
#include "nsIURI.h"

//-----------------------------

/* Implementation file */

NS_IMPL_ISUPPORTS1(nsEmbedFilePicker, nsIFilePicker)

nsEmbedFilePicker::nsEmbedFilePicker()
{
  mService = do_GetService("@mozilla.org/embedlite-app-service;1");
  /* member initializers and constructor code */
}

nsEmbedFilePicker::~nsEmbedFilePicker()
{
  /* destructor code */
}

NS_IMETHODIMP nsEmbedFilePicker::Init(nsIDOMWindow* parent, const nsAString& title, int16_t mode)
{
  mWin = parent;
  mModalDepth = 0;
  mTitle.Assign(title);
  printf("nsEmbedFilePicker::Init IMPLEMENTED: win:%p, title:%s, mode:%i\n", parent, NS_ConvertUTF16toUTF8(title).get(), mode);
//  return NS_ERROR_NOT_IMPLEMENTED;
  return NS_OK;
}

NS_IMETHODIMP nsEmbedFilePicker::AppendFilters(int32_t filterMask)
{
  printf("nsEmbedFilePicker::AppendFilters NOT IMPLEMENTED: filterMask:%i\n", filterMask);
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::AppendFilter(const nsAString& title, const nsAString& filter)
{
  printf("nsEmbedFilePicker::AppendFilter NOT IMPLEMENTED: title:%s, filter:%s\n", NS_ConvertUTF16toUTF8(title).get(), NS_ConvertUTF16toUTF8(filter).get());
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::GetDefaultString(nsAString& aDefaultString)
{
  printf("nsEmbedFilePicker::GetDefaultString NOT IMPLEMENTED: aDefaultString:%s\n", NS_ConvertUTF16toUTF8(aDefaultString).get());
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::SetDefaultString(const nsAString& aDefaultString)
{
  printf("nsEmbedFilePicker::SetDefaultString NOT IMPLEMENTED: aDefaultString:%s\n", NS_ConvertUTF16toUTF8(aDefaultString).get());
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::GetDefaultExtension(nsAString& aDefaultExtension)
{
  printf("nsEmbedFilePicker::GetDefaultExtension NOT IMPLEMENTED: aDefaultExtension:%s\n", NS_ConvertUTF16toUTF8(aDefaultExtension).get());
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::SetDefaultExtension(const nsAString& aDefaultExtension)
{
  printf("nsEmbedFilePicker::SetDefaultExtension NOT IMPLEMENTED: aDefaultExtension:%s\n", NS_ConvertUTF16toUTF8(aDefaultExtension).get());
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::GetFilterIndex(int32_t* aFilterIndex)
{
  printf("nsEmbedFilePicker::GetFilterIndex NOT IMPLEMENTED: aFilterIndex:%i\n", aFilterIndex);
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::SetFilterIndex(int32_t aFilterIndex)
{
  printf("nsEmbedFilePicker::SetFilterIndex NOT IMPLEMENTED: aFilterIndex:%i\n", aFilterIndex);
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::GetDisplayDirectory(nsIFile* *aDisplayDirectory)
{
  printf("nsEmbedFilePicker::GetDisplayDirectory USELESS\n");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::SetDisplayDirectory(nsIFile* aDisplayDirectory)
{
  printf("nsEmbedFilePicker::SetDisplayDirectory USELESS\n");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::GetFile(nsIFile* *aFile)
{
  printf("nsEmbedFilePicker::GetFile IMPLEMENTED\n");

  EmbedFilePickerResponse response = DoSendAsyncPrompt(0);
  if (response.accepted) {
    NS_ENSURE_ARG_POINTER(aFile);

    *aFile = nullptr;

    nsCOMPtr<nsIFile> file(do_CreateInstance("@mozilla.org/file/local;1"));
    NS_ENSURE_TRUE(file, NS_ERROR_FAILURE);
    file->InitWithNativePath(NS_ConvertUTF16toUTF8(response.filePath));

    NS_ADDREF(*aFile = file);

    return NS_OK;
  }
  else {
    return NS_ERROR_ABORT;
  }
}

NS_IMETHODIMP nsEmbedFilePicker::GetFileURL(nsIURI* *aFileURL)
{
  printf("nsEmbedFilePicker::GetFileURL NOT IMPLEMENTED\n");

  *aFileURL = nullptr;
  EmbedFilePickerResponse response = DoSendAsyncPrompt(0);
  if (response.accepted) {
    return NS_NewURI(aFileURL, NS_ConvertUTF16toUTF8(response.filePath));
  }
  else {
    return NS_ERROR_ABORT;
  }
}

NS_IMETHODIMP nsEmbedFilePicker::GetFiles(nsISimpleEnumerator* *aFiles)
{
  printf("nsEmbedFilePicker::GetFileURL NOT IMPLEMENTED\n");
  return NS_ERROR_NOT_IMPLEMENTED;
  NS_ENSURE_ARG_POINTER(aFiles);
  EmbedFilePickerResponse response = DoSendAsyncPrompt(2);
  if (response.accepted) {
    nsCOMArray<nsIFile> mFiles;
    return NS_OK;
  }
  else {
    return NS_ERROR_ABORT;
  }
}

NS_IMETHODIMP nsEmbedFilePicker::GetAddToRecentDocs(bool* aAddToRecentDocs)
{
  printf("nsEmbedFilePicker::GetAddToRecentDocs NOT IMPLEMENTED\n");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::SetAddToRecentDocs(bool aAddToRecentDocs)
{
  printf("nsEmbedFilePicker::SetAddToRecentDocs NOT IMPLEMENTED\n");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::Show(int16_t* _retval)
{
  printf("nsEmbedFilePicker::Show NOT IMPLEMENTED\n");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::Open(nsIFilePickerShownCallback* aFilePickerShownCallback)
{
  printf("nsEmbedFilePicker::Open IMPLEMENTED\n");
  aFilePickerShownCallback->Done(nsIFilePicker::returnOK);
  return NS_OK;
}

EmbedFilePickerResponse
nsEmbedFilePicker::DoSendAsyncPrompt(int mode)
{
  uint32_t winid;
  mService->GetIDByWindow(mWin, &winid);

  nsString sendString;
  // Just simple property bag support still
  nsCOMPtr<nsIEmbedLiteJSON> json = do_GetService("@mozilla.org/embedlite-json;1");
  nsCOMPtr<nsIWritablePropertyBag2> root;
  json->CreateObject(getter_AddRefs(root));
  root->SetPropertyAsUint32(NS_LITERAL_STRING("winid"), winid);
  root->SetPropertyAsUint32(NS_LITERAL_STRING("mode"), mode);
  root->SetPropertyAsAString(NS_LITERAL_STRING("title"), mTitle);
  json->CreateJSON(root, sendString);

  mResponseMap[winid] = EmbedFilePickerResponse();

  mService->SendAsyncMessage(winid, NS_LITERAL_STRING("embed:filepicker").get(), sendString.get());
  mService->AddMessageListener("filepickerresponse", this);

  nsresult rv(NS_OK);

  mService->EnterSecureJSContext();

  EmbedFilePickerResponse response;

  nsCOMPtr<nsIDOMWindowUtils> utils = do_GetInterface(mWin);
  NS_ENSURE_TRUE(utils, response);

  nsCOMPtr<nsIDOMWindow> modalStateWin;
  rv = utils->EnterModalStateWithWindow(getter_AddRefs(modalStateWin));

  mModalDepth++;
  int origModalDepth = mModalDepth;
  nsCOMPtr<nsIThread> thread;
  NS_GetCurrentThread(getter_AddRefs(thread));
  while (mModalDepth == origModalDepth && NS_SUCCEEDED(rv)) {
      bool processedEvent;
      rv = thread->ProcessNextEvent(true, &processedEvent);
      if (NS_SUCCEEDED(rv) && !processedEvent) {
          rv = NS_ERROR_UNEXPECTED;
      }
  }
  mService->RemoveMessageListener("promptresponse", this);

  std::map<uint32_t, EmbedFilePickerResponse>::iterator it = mResponseMap.find(winid);
  if (it == mResponseMap.end()) {
      return response;
  }

  rv = utils->LeaveModalStateWithWindow(modalStateWin);
  mService->LeaveSecureJSContext();
  response = it->second;
  mResponseMap.erase(it);
  return response;
}

NS_IMETHODIMP
nsEmbedFilePicker::OnMessageReceived(const char* messageName, const PRUnichar* message)
{
  nsCOMPtr<nsIEmbedLiteJSON> json = do_GetService("@mozilla.org/embedlite-json;1");
  nsCOMPtr<nsIPropertyBag2> root;
  NS_ENSURE_SUCCESS(json->ParseJSON(nsDependentString(message), getter_AddRefs(root)), NS_ERROR_FAILURE);

  uint32_t winid = 0;
  root->GetPropertyAsUint32(NS_LITERAL_STRING("winid"), &winid);

  std::map<uint32_t, EmbedFilePickerResponse>::iterator it = mResponseMap.find(winid);
  if (it == mResponseMap.end()) {
    mModalDepth--;
    return NS_ERROR_FAILURE;
  }
  EmbedFilePickerResponse& response = it->second;

  root->GetPropertyAsBool(NS_LITERAL_STRING("accepted"), &response.accepted);
  root->GetPropertyAsAString(NS_LITERAL_STRING("items"), response.filePath);

  mModalDepth--;

  return NS_OK;
}
