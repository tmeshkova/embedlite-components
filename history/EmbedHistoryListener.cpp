/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "EmbedHistoryListener.h"
#include "nsIURI.h"
#include "mozilla/dom/Link.h"
#include "nsIEmbedLiteJSON.h"
#include "nsIObserverService.h"

using namespace mozilla;
using mozilla::dom::Link;

NS_IMPL_ISUPPORTS2(EmbedHistoryListener, IHistory, nsIRunnable)

EmbedHistoryListener* EmbedHistoryListener::sHistory = NULL;

/*static*/
EmbedHistoryListener*
EmbedHistoryListener::GetSingleton()
{
  if (!sHistory) {
    sHistory = new EmbedHistoryListener();
    NS_ENSURE_TRUE(sHistory, nullptr);
  }

  NS_ADDREF(sHistory);
  return sHistory;
}

EmbedHistoryListener::EmbedHistoryListener()
{
  nsresult rv;
  nsCOMPtr<nsIObserverService> observerService =
    do_GetService(NS_OBSERVERSERVICE_CONTRACTID);

  if (observerService) {
    rv = observerService->AddObserver(this,
                                      "history:notifyVisited", false);
  }
}

NS_IMETHODIMP
EmbedHistoryListener::RegisterVisitedCallback(nsIURI *aURI, Link *aContent)
{
  if (!aContent || !aURI)
    return NS_OK;

  nsAutoCString uri;
  nsresult rv = aURI->GetSpec(uri);
  if (NS_FAILED(rv)) return rv;

  nsTArray<Link*>* list = mListeners.Get(uri);
  if (!list) {
    list = new nsTArray<Link*>();
    mListeners.Put(uri, list);
  }
  list->AppendElement(aContent);

  nsString message;
  // Just simple property bag support still
  nsCOMPtr<nsIEmbedLiteJSON> json = do_GetService("@mozilla.org/embedlite-json;1");
  nsCOMPtr<nsIWritablePropertyBag2> root;
  json->CreateObject(getter_AddRefs(root));
  root->SetPropertyAsACString(NS_LITERAL_STRING("msg"), NS_LITERAL_CSTRING("checkvisited"));
  root->SetPropertyAsACString(NS_LITERAL_STRING("uri"), uri);

  json->CreateJSON(root, message);
  nsCOMPtr<nsIObserverService> observerService =
    do_GetService(NS_OBSERVERSERVICE_CONTRACTID);
  // Possible we can avoid json stuff for this case and send uri directly
  if (observerService) {
    observerService->NotifyObservers(nullptr, "em:history", message.get());
  }

  return NS_OK;
}

NS_IMETHODIMP
EmbedHistoryListener::UnregisterVisitedCallback(nsIURI *aURI, Link *aContent)
{
  if (!aContent || !aURI)
    return NS_OK;

  nsAutoCString uri;
  nsresult rv = aURI->GetSpec(uri);
  if (NS_FAILED(rv)) return rv;

  nsTArray<Link*>* list = mListeners.Get(uri);
  if (!list)
    return NS_OK;

  list->RemoveElement(aContent);
  if (list->IsEmpty()) {
    mListeners.Remove(uri);
    delete list;
  }
  return NS_OK;
}

NS_IMETHODIMP
EmbedHistoryListener::VisitURI(nsIURI *aURI, nsIURI *aLastVisitedURI, uint32_t aFlags)
{
  if (!aURI)
    return NS_OK;

  if (!(aFlags & VisitFlags::TOP_LEVEL))
    return NS_OK;

  if (aFlags & VisitFlags::REDIRECT_SOURCE)
    return NS_OK;

  if (aFlags & VisitFlags::UNRECOVERABLE_ERROR)
    return NS_OK;

  nsAutoCString uri;
  nsresult rv = aURI->GetSpec(uri);
  if (NS_FAILED(rv)) return rv;

  nsString message;
  // Just simple property bag support still
  nsCOMPtr<nsIEmbedLiteJSON> json = do_GetService("@mozilla.org/embedlite-json;1");
  nsCOMPtr<nsIWritablePropertyBag2> root;
  json->CreateObject(getter_AddRefs(root));
  root->SetPropertyAsACString(NS_LITERAL_STRING("msg"), NS_LITERAL_CSTRING("markvisited"));
  root->SetPropertyAsACString(NS_LITERAL_STRING("uri"), uri);

  json->CreateJSON(root, message);
  nsCOMPtr<nsIObserverService> observerService =
    do_GetService(NS_OBSERVERSERVICE_CONTRACTID);
  if (observerService) {
    observerService->NotifyObservers(nullptr, "em:history", message.get());
  }

  return NS_OK;
}

nsIEmbedAppService*
EmbedHistoryListener::GetService()
{
  if (!mService) {
    mService = do_GetService("@mozilla.org/embedlite-app-service;1");
  }
  return mService.get();
}

NS_IMETHODIMP
EmbedHistoryListener::SetURITitle(nsIURI *aURI, const nsAString& aTitle)
{
  if (!aURI)
    return NS_OK;

  // we don't do anything with this right now
  nsAutoCString uri;
  nsresult rv = aURI->GetSpec(uri);
  if (NS_FAILED(rv)) return rv;
  nsCOMPtr<nsIObserverService> observerService =
    do_GetService(NS_OBSERVERSERVICE_CONTRACTID);
  nsString message;
  // Just simple property bag support still
  nsCOMPtr<nsIEmbedLiteJSON> json = do_GetService("@mozilla.org/embedlite-json;1");
  nsCOMPtr<nsIWritablePropertyBag2> root;
  json->CreateObject(getter_AddRefs(root));
  root->SetPropertyAsACString(NS_LITERAL_STRING("msg"), NS_LITERAL_CSTRING("settitle"));
  root->SetPropertyAsACString(NS_LITERAL_STRING("uri"), uri);
  root->SetPropertyAsAString(NS_LITERAL_STRING("title"), aTitle);
  json->CreateJSON(root, message);
  if (observerService) {
    observerService->NotifyObservers(nullptr, "em:history", message.get());
  }
  return NS_OK;
}

NS_IMETHODIMP
EmbedHistoryListener::Observe(nsISupports *aSubject,
                              const char *aTopic,
                              const char16_t *aData)
{
  if (!strcmp(aTopic, "history:notifyVisited")) {
    sHistory->mPendingURIs.Push(NS_ConvertUTF16toUTF8(aData));
    NS_DispatchToMainThread(sHistory);
  }
  return NS_OK;
}

NS_IMETHODIMP
EmbedHistoryListener::NotifyVisited(nsIURI *aURI)
{
  if (aURI && sHistory) {
    nsAutoCString spec;
    (void)aURI->GetSpec(spec);
    sHistory->mPendingURIs.Push(spec);
    NS_DispatchToMainThread(sHistory);
  }

  return NS_OK;
}

NS_IMETHODIMP
EmbedHistoryListener::Run()
{
  while (!mPendingURIs.IsEmpty()) {
    nsCString uriString = mPendingURIs.Pop();
    nsTArray<Link*>* list = sHistory->mListeners.Get(uriString);
    if (list) {
      for (unsigned int i = 0; i < list->Length(); i++) {
        list->ElementAt(i)->SetLinkState(eLinkState_Visited);
      }
      // as per the IHistory interface contract, remove the
      // Link pointers once they have been notified
      sHistory->mListeners.Remove(uriString);
      delete list;
    }
  }

  return NS_OK;
}
