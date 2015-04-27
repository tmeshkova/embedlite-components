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
#include "nsIThread.h"
#include "nsThreadUtils.h"
#include "nsIVariant.h"
#include "nsArrayEnumerator.h"
#include "nsIDOMFile.h"
#include "nsIDOMWindowUtils.h"

//-----------------------------

/* Implementation file */

NS_IMPL_ISUPPORTS(nsEmbedFilePicker, nsIFilePicker, nsIEmbedMessageListener)

nsEmbedFilePicker::nsEmbedFilePicker()
{
  mService = do_GetService("@mozilla.org/embedlite-app-service;1");
}

nsEmbedFilePicker::~nsEmbedFilePicker()
{
}

NS_IMETHODIMP nsEmbedFilePicker::Init(nsIDOMWindow* parent, const nsAString& title, int16_t mode)
{
  mWin = parent;
  mModalDepth = 0;
  mTitle.Assign(title);
  mDefaultName.Truncate();
  mMode = mode;
  mCallback = nullptr;
  mFilterIndex = 0;
  mFilters.clear();
  return NS_OK;
}

NS_IMETHODIMP nsEmbedFilePicker::AppendFilters(int32_t filterMask)
{
  mFilters.push_back(filterMask);
  return NS_OK;
}

NS_IMETHODIMP nsEmbedFilePicker::AppendFilter(const nsAString& title, const nsAString& filter)
{
  printf("nsEmbedFilePicker::AppendFilter NOT USED: title:%s, filter:%s\n", NS_ConvertUTF16toUTF8(title).get(), NS_ConvertUTF16toUTF8(filter).get());
  return NS_OK;
}

NS_IMETHODIMP nsEmbedFilePicker::GetDefaultString(nsAString& aDefaultString)
{
  aDefaultString.Assign(mDefaultName);
  return NS_OK;
}

NS_IMETHODIMP nsEmbedFilePicker::SetDefaultString(const nsAString& aDefaultString)
{
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
  mFilterIndex = aFilterIndex;
  return NS_OK;
}

NS_IMETHODIMP nsEmbedFilePicker::GetDisplayDirectory(nsIFile* *aDisplayDirectory)
{
  printf("nsEmbedFilePicker::GetDisplayDirectory NOT IMPLEMENTED\n");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEmbedFilePicker::SetDisplayDirectory(nsIFile* aDisplayDirectory)
{
  printf("nsEmbedFilePicker::SetDisplayDirectory NOT USED\n");
  return NS_OK;
}

NS_IMETHODIMP nsEmbedFilePicker::GetFile(nsIFile* *aFile)
{
  EmbedFilePickerResponse response = GetResponse();
  if (response.accepted) {
    NS_ENSURE_ARG_POINTER(aFile);

    *aFile = nullptr;

    nsCOMPtr<nsIFile> file(do_CreateInstance("@mozilla.org/file/local;1"));
    NS_ENSURE_TRUE(file, NS_ERROR_FAILURE);
    if (!response.items.IsEmpty()) {
        file->InitWithNativePath(NS_ConvertUTF16toUTF8(response.items[0]));
    }

    NS_ADDREF(*aFile = file);

    return NS_OK;
  }

  return NS_ERROR_ABORT;
}

NS_IMETHODIMP nsEmbedFilePicker::GetFileURL(nsIURI* *aFileURL)
{
  *aFileURL = nullptr;
  EmbedFilePickerResponse response = GetResponse();
  if (response.accepted) {
    if (!response.items.IsEmpty()) {
        return NS_NewURI(aFileURL, NS_ConvertUTF16toUTF8(response.items[0]));
    }
  }
  return NS_ERROR_ABORT;
}

NS_IMETHODIMP nsEmbedFilePicker::GetFiles(nsISimpleEnumerator* *aFiles)
{
  NS_ENSURE_ARG_POINTER(aFiles);
  EmbedFilePickerResponse response = GetResponse();
  if (response.accepted) {
    nsCOMArray<nsIFile> mFiles;
    int32_t count = response.items.Length();
    for (int32_t i = 0; i < count; i++) {
      nsCOMPtr<nsIFile> file(do_CreateInstance("@mozilla.org/file/local;1"));
      NS_ENSURE_TRUE(file, NS_ERROR_FAILURE);
      file->InitWithNativePath(NS_ConvertUTF16toUTF8(response.items[i]));
      mFiles.AppendObject(file);
    }
    return NS_NewArrayEnumerator(aFiles, mFiles);
  }
  return NS_ERROR_ABORT;
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

NS_IMETHODIMP nsEmbedFilePicker::GetMode(int16_t *aMode)
{
  *aMode = mMode;
  return NS_OK;
}

NS_IMETHODIMP nsEmbedFilePicker::Show(int16_t* _retval)
{
  DoSendPrompt();

  nsresult rv;

  mService->EnterSecureJSContext();
  nsCOMPtr<nsIDOMWindowUtils> utils = do_GetInterface(mWin);
  NS_ENSURE_TRUE(utils, NS_ERROR_FAILURE);

  rv = utils->EnterModalState();

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
  mService->RemoveMessageListener("filepickerresponse", this);

  uint32_t winid;
  mService->GetIDByWindow(mWin, &winid);

  std::map<uint32_t, EmbedFilePickerResponse>::iterator it = mResponseMap.find(winid);
  if (it == mResponseMap.end()) {
    return NS_ERROR_UNEXPECTED;
  }

  rv = utils->LeaveModalState();
  mService->LeaveSecureJSContext();

  return rv;
}

NS_IMETHODIMP nsEmbedFilePicker::Open(nsIFilePickerShownCallback* aFilePickerShownCallback)
{
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
  if (mFilters.size() > 0 && mFilterIndex > -1 && (unsigned)mFilterIndex < mFilters.size()) {
    root->SetPropertyAsUint32(NS_LITERAL_STRING("filter"), mFilters.at(mFilterIndex));
  }
  root->SetPropertyAsAString(NS_LITERAL_STRING("name"), mDefaultName);
  json->CreateJSON(root, sendString);

  mResponseMap[winid] = EmbedFilePickerResponse();

  mService->SendAsyncMessage(winid, NS_LITERAL_STRING("embed:filepicker").get(), sendString.get());
  mService->AddMessageListener("filepickerresponse", this);

  return NS_OK;
}

NS_IMETHODIMP
nsEmbedFilePicker::OnMessageReceived(const char* messageName, const char16_t* message)
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
  nsCOMPtr<nsIVariant> itemsvar;
  nsresult rv = root->GetProperty(NS_LITERAL_STRING("items"), getter_AddRefs(itemsvar));

  uint16_t dataType = 0;
  itemsvar->GetDataType(&dataType);

  if (dataType == nsIDataType::VTYPE_ARRAY) {
    uint16_t valueType;
    nsIID iid;
    uint32_t valueCount;
    void* rawArray;
    if (NS_SUCCEEDED(itemsvar->GetAsArray(&valueType, &iid, &valueCount, &rawArray))) {
      if (valueType == nsIDataType::VTYPE_INTERFACE ||
          valueType == nsIDataType::VTYPE_INTERFACE_IS) {
        nsISupports** values = static_cast<nsISupports**>(rawArray);
        for (uint32_t i = 0; i < valueCount; ++i) {
          nsCOMPtr<nsISupports> supports = dont_AddRef(values[i]);
          nsCOMPtr<nsIVariant> item = do_QueryInterface(supports);
          nsString itemString;
          if (item && NS_SUCCEEDED(item->GetAsAString(itemString))) {
            response.items.AppendElement(itemString);
          }
        }
      }
      free(rawArray);
    }
  } else {
    NS_ERROR("Unexpected items type");
  }

  if (mCallback) {
    mCallback->Done(nsIFilePicker::returnOK);
    mCallback = nullptr;
    mService->RemoveMessageListener("filepickerresponse", this);
  }
  else {
    mModalDepth--;
  }

  return NS_OK;
}

NS_IMETHODIMP
nsEmbedFilePicker::GetDomfile(nsIDOMFile * *aDomfile)
{
  nsCOMPtr<nsIFile> localFile;
  nsresult rv = GetFile(getter_AddRefs(localFile));
  NS_ENSURE_SUCCESS(rv, rv);

  if (!localFile) {
    *aDomfile = nullptr;
    return NS_OK;
  }

  mService->EnterSecureJSContext();
  nsCOMPtr<nsIDOMWindowUtils> utils = do_GetInterface(mWin);
  nsCOMPtr<nsIDOMFile> file;
  utils->WrapDOMFile(localFile, getter_AddRefs(file));
  file.forget(aDomfile);
  mService->LeaveSecureJSContext();

  return NS_OK;
}

class nsBaseFilePickerEnumerator : public nsISimpleEnumerator
{
public:
  NS_DECL_ISUPPORTS

  nsBaseFilePickerEnumerator(nsISimpleEnumerator* iterator, nsIDOMWindow* aWin)
    : mIterator(iterator)
  {
    utils = do_GetInterface(aWin);
  }


  NS_IMETHOD
  GetNext(nsISupports** aResult)
  {
    nsCOMPtr<nsISupports> tmp;
    nsresult rv = mIterator->GetNext(getter_AddRefs(tmp));
    NS_ENSURE_SUCCESS(rv, rv);

    if (!tmp) {
      return NS_OK;
    }

    nsCOMPtr<nsIFile> localFile = do_QueryInterface(tmp);
    if (!localFile) {
      return NS_ERROR_FAILURE;
    }

    nsCOMPtr<nsIDOMFile> file;
    utils->WrapDOMFile(localFile, getter_AddRefs(file));
    file.forget(aResult);
    return NS_OK;
  }

  NS_IMETHOD
  HasMoreElements(bool* aResult)
  {
    return mIterator->HasMoreElements(aResult);
  }

private:
  virtual ~nsBaseFilePickerEnumerator() {}

  nsCOMPtr<nsISimpleEnumerator> mIterator;
  nsCOMPtr<nsIDOMWindowUtils> utils;
};

NS_IMPL_ISUPPORTS(nsBaseFilePickerEnumerator, nsISimpleEnumerator)

NS_IMETHODIMP
nsEmbedFilePicker::GetDomfiles(nsISimpleEnumerator * *aDomfiles)
{
  nsCOMPtr<nsISimpleEnumerator> iter;
  nsresult rv = GetFiles(getter_AddRefs(iter));
  NS_ENSURE_SUCCESS(rv, rv);

  nsRefPtr<nsBaseFilePickerEnumerator> retIter =
    new nsBaseFilePickerEnumerator(iter, mWin);

  retIter.forget(aDomfiles);
  return NS_OK;
}
