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
  printf("nsEmbedFilePicker::Init IMPLEMENTED: win:%p, title:%s, mode:%i\n", parent, NS_ConvertUTF16toUTF8(title).get(), mode);
  mWin = parent;
  mModalDepth = 0;
  mTitle.Assign(title);
  mDefaultName.Truncate();
  mMode = mode;
  mCallback = nullptr;
  return NS_OK;
}

NS_IMETHODIMP nsEmbedFilePicker::AppendFilters(int32_t filterMask)
{
  printf("nsEmbedFilePicker::AppendFilters NOT USED: filterMask:%i\n", filterMask);
  return NS_OK;
}

NS_IMETHODIMP nsEmbedFilePicker::AppendFilter(const nsAString& title, const nsAString& filter)
{
  printf("nsEmbedFilePicker::AppendFilter NOT USED: title:%s, filter:%s\n", NS_ConvertUTF16toUTF8(title).get(), NS_ConvertUTF16toUTF8(filter).get());
  return NS_OK;
}

NS_IMETHODIMP nsEmbedFilePicker::GetDefaultString(nsAString& aDefaultString)
{
  printf("nsEmbedFilePicker::GetDefaultString NOT IMPLEMENTED: aDefaultString:%s\n", NS_ConvertUTF16toUTF8(aDefaultString).get());
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::SetDefaultString(const nsAString& aDefaultString)
{
  printf("nsEmbedFilePicker::SetDefaultString IMPLEMENTED: aDefaultString:%s\n", NS_ConvertUTF16toUTF8(aDefaultString).get());
  mDefaultName.Assign(aDefaultString);
  return NS_OK;
}

NS_IMETHODIMP nsEmbedFilePicker::GetDefaultExtension(nsAString& aDefaultExtension)
{
  printf("nsEmbedFilePicker::GetDefaultExtension NOT IMPLEMENTED: aDefaultExtension:%s\n", NS_ConvertUTF16toUTF8(aDefaultExtension).get());
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::SetDefaultExtension(const nsAString& aDefaultExtension)
{
  printf("nsEmbedFilePicker::SetDefaultExtension NOT USED: aDefaultExtension:%s\n", NS_ConvertUTF16toUTF8(aDefaultExtension).get());
  return NS_OK;
}

NS_IMETHODIMP nsEmbedFilePicker::GetFilterIndex(int32_t* aFilterIndex)
{
  printf("nsEmbedFilePicker::GetFilterIndex NOT IMPLEMENTED: aFilterIndex:%i\n", aFilterIndex);
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::SetFilterIndex(int32_t aFilterIndex)
{
  printf("nsEmbedFilePicker::SetFilterIndex NOT USED: aFilterIndex:%i\n", aFilterIndex);
  return NS_OK;
}

NS_IMETHODIMP nsEmbedFilePicker::GetDisplayDirectory(nsIFile* *aDisplayDirectory)
{
  printf("nsEmbedFilePicker::GetDisplayDirectory USELESS\n");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::SetDisplayDirectory(nsIFile* aDisplayDirectory)
{
  printf("nsEmbedFilePicker::SetDisplayDirectory NOT USED\n");
  return NS_OK;
}

NS_IMETHODIMP nsEmbedFilePicker::GetFile(nsIFile* *aFile)
{
  printf("nsEmbedFilePicker::GetFile IMPLEMENTED\n");

  EmbedFilePickerResponse response = GetResponse();
  if (response.accepted) {
    NS_ENSURE_ARG_POINTER(aFile);

    *aFile = nullptr;

    nsCOMPtr<nsIFile> file(do_CreateInstance("@mozilla.org/file/local;1"));
    NS_ENSURE_TRUE(file, NS_ERROR_FAILURE);
    file->InitWithNativePath(NS_ConvertUTF16toUTF8(response.filePath));
//    file->InitWithNativePath(NS_ConvertUTF16toUTF8(response.items[0]));

    NS_ADDREF(*aFile = file);

    return NS_OK;
  }
  else {
    return NS_ERROR_ABORT;
  }
}

NS_IMETHODIMP nsEmbedFilePicker::GetFileURL(nsIURI* *aFileURL)
{
  printf("nsEmbedFilePicker::GetFileURL IMPLEMENTED\n");

  *aFileURL = nullptr;
  EmbedFilePickerResponse response = GetResponse();
  if (response.accepted) {
    return NS_NewURI(aFileURL, NS_ConvertUTF16toUTF8(response.filePath));
//    return NS_NewURI(aFileURL, NS_ConvertUTF16toUTF8(response.items[0]));
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
  EmbedFilePickerResponse response = GetResponse();
  if (response.accepted) {
    nsCOMArray<nsIFile> mFiles;
//    int32_t count = response.items.Count();
//    for (int32_t i=0; i<count; i++) {
//     nsCOMPtr<nsIFile> file(do_CreateInstance("@mozilla.org/file/local;1"));
//      NS_ENSURE_TRUE(file, NS_ERROR_FAILURE);
//      file->InitWithNativePath(NS_ConvertUTF16toUTF8(response.items[i]));
//      mFiles.AppendObject(file);
//    }
//    return NS_NewArrayEnumerator(aFiles, mFiles);
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
  printf("nsEmbedFilePicker::SetAddToRecentDocs NOT USED\n");
  return NS_OK;
}

NS_IMETHODIMP nsEmbedFilePicker::Show(int16_t* _retval)
{
  printf("nsEmbedFilePicker::Show IMPLEMENTED\n");
  DoSendPrompt();

  nsresult rv(NS_OK);

  mService->EnterSecureJSContext();

  nsCOMPtr<nsIDOMWindowUtils> utils = do_GetInterface(mWin);
  NS_ENSURE_TRUE(utils, NS_ERROR_FAILURE);

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

  uint32_t winid;
  mService->GetIDByWindow(mWin, &winid);

  std::map<uint32_t, EmbedFilePickerResponse>::iterator it = mResponseMap.find(winid);
  if (it == mResponseMap.end()) {
      return NS_ERROR_UNEXPECTED;
  }

  rv = utils->LeaveModalStateWithWindow(modalStateWin);
  mService->LeaveSecureJSContext();

  return rv;
}

NS_IMETHODIMP nsEmbedFilePicker::Open(nsIFilePickerShownCallback* aFilePickerShownCallback)
{
  printf("nsEmbedFilePicker::Open IMPLEMENTED\n");
  mCallback = aFilePickerShownCallback;
  DoSendPrompt();
  return NS_OK;
}

EmbedFilePickerResponse
nsEmbedFilePicker::GetResponse()
{
  uint32_t winid;
  mService->GetIDByWindow(mWin, &winid);

  EmbedFilePickerResponse response;
  std::map<uint32_t, EmbedFilePickerResponse>::iterator it = mResponseMap.find(winid);
  if (it == mResponseMap.end()) {
    return response;
  }
  response = it->second;
  mResponseMap.erase(it);
  return response;
}

nsresult
nsEmbedFilePicker::DoSendPrompt()
{
  uint32_t winid;
  mService->GetIDByWindow(mWin, &winid);

  nsString sendString;
  // Just simple property bag support still
  nsCOMPtr<nsIEmbedLiteJSON> json = do_GetService("@mozilla.org/embedlite-json;1");
  nsCOMPtr<nsIWritablePropertyBag2> root;
  json->CreateObject(getter_AddRefs(root));
  root->SetPropertyAsUint32(NS_LITERAL_STRING("winid"), winid);
  root->SetPropertyAsUint32(NS_LITERAL_STRING("mode"), mMode);
  root->SetPropertyAsAString(NS_LITERAL_STRING("title"), mTitle);
  root->SetPropertyAsAString(NS_LITERAL_STRING("name"), mDefaultName);
  json->CreateJSON(root, sendString);

  mResponseMap[winid] = EmbedFilePickerResponse();

  mService->SendAsyncMessage(winid, NS_LITERAL_STRING("embed:filepicker").get(), sendString.get());
  mService->AddMessageListener("filepickerresponse", this);

  return NS_OK;
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
    return NS_ERROR_FAILURE;
  }
  EmbedFilePickerResponse& response = it->second;

  root->GetPropertyAsBool(NS_LITERAL_STRING("accepted"), &response.accepted);
  root->GetPropertyAsAString(NS_LITERAL_STRING("items"), response.filePath);
//  root->GetPropertyAsArray(NS_LITERAL_STRING("items"), response.items);

  if (mCallback) {
    mCallback->Done(nsIFilePicker::returnOK);
    mCallback = nullptr;
    mService->RemoveMessageListener("promptresponse", this);
  }
  else {
    mModalDepth--;
  }

  return NS_OK;
}
