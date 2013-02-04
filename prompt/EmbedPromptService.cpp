/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#define LOG_COMPONENT "EmbedPromptService"
#include "mozilla/embedlite/EmbedLog.h"

#include "EmbedPromptService.h"

#include "nsStringGlue.h"
#include "nsIAuthPrompt.h"
#include "nsISupportsImpl.h"
#include "nsIDOMWindowUtils.h"
#include "nsIInterfaceRequestorUtils.h"
#include "nsIInterfaceRequestor.h"
#include "nsIURI.h"
#include "nsServiceManagerUtils.h"
#include "nsILoadContext.h"
#include "nsIAuthInformation.h"
#include "nsICancelable.h"
#include "nsIAuthPromptCallback.h"
#include "nsIIOService.h"
#include "nsNetCID.h"
#include "nsIProtocolHandler.h"
#include "nsIDOMWindow.h"
#include "nsIEmbedLiteJSON.h"

// Prompt Factory Implementation

using namespace mozilla::embedlite;

EmbedPromptFactory::EmbedPromptFactory()
{
}

EmbedPromptFactory::~EmbedPromptFactory()
{
}

NS_IMPL_ISUPPORTS1(EmbedPromptFactory, nsIPromptFactory)


NS_IMETHODIMP
EmbedPromptFactory::GetPrompt(nsIDOMWindow* aParent, const nsIID& iid, void **result)
{
    if (iid.Equals(NS_GET_IID(nsIAuthPrompt)) ||
        iid.Equals(NS_GET_IID(nsIAuthPrompt2))) {
        nsRefPtr<EmbedAuthPromptService> service = new EmbedAuthPromptService(aParent);
        *result = service.forget().get();
    } else if (iid.Equals(NS_GET_IID(nsIPrompt))) {
        nsRefPtr<EmbedPromptService> service = new EmbedPromptService(aParent);
        *result = service.forget().get();
    }

    return NS_OK;
}

// Prompt Service Implementation

EmbedPromptService::EmbedPromptService(nsIDOMWindow* aWin)
  : mWin(aWin)
  , mModalDepth(0)
{
    mService = do_GetService("@mozilla.org/embedlite-app-service;1");
}

EmbedPromptService::~EmbedPromptService()
{
}

NS_IMPL_ISUPPORTS2(EmbedPromptService, nsIPrompt, nsIEmbedMessageListener)

NS_IMETHODIMP
EmbedPromptService::Alert(const PRUnichar* aDialogTitle, 
                          const PRUnichar* aDialogText)
{
    AlertCheck(aDialogTitle, aDialogText, nullptr, nullptr);
    return NS_OK;
}

NS_IMETHODIMP
EmbedPromptService::OnMessageReceived(const char* messageName, const PRUnichar* message)
{
    nsCOMPtr<nsIEmbedLiteJSON> json = do_GetService("@mozilla.org/embedlite-json;1");
    printf(">>>>>>Func:%s::%d name:%s, msg:%s\n", __PRETTY_FUNCTION__, __LINE__, messageName, NS_ConvertUTF16toUTF8(message).get());
    nsCOMPtr<nsIPropertyBag2> root;
    NS_ENSURE_SUCCESS(json->ParseJSON(nsDependentString(message), getter_AddRefs(root)), NS_ERROR_FAILURE);

    uint32_t winid = 0;
    root->GetPropertyAsUint32(NS_LITERAL_STRING("winid"), &winid);

    std::map<uint32_t, EmbedPromptResponse>::iterator it =
        mResponseMap.find(winid);
    if (it == mResponseMap.end())
        return NS_ERROR_FAILURE;
    EmbedPromptResponse& response = it->second;

    nsString promptValue;
    root->GetPropertyAsAString(NS_LITERAL_STRING("promptvalue"), response.promptvalue);
    root->GetPropertyAsBool(NS_LITERAL_STRING("accepted"), &response.accepted);
    root->GetPropertyAsBool(NS_LITERAL_STRING("checkvalue"), &response.checkvalue);

    mModalDepth--;

    return NS_OK;
}

NS_IMETHODIMP
EmbedPromptService::AlertCheck(const PRUnichar* aDialogTitle,
                               const PRUnichar* aDialogText,
                               const PRUnichar* aCheckMsg, bool* aCheckValue)
{
    uint32_t winid;
    mService->GetIDByWindow(mWin, &winid);

    nsString sendString;
    // Just simple property bag support still
    nsCOMPtr<nsIEmbedLiteJSON> json = do_GetService("@mozilla.org/embedlite-json;1");
    nsCOMPtr<nsIWritablePropertyBag2> root;
    json->CreateObject(getter_AddRefs(root));
    root->SetPropertyAsAString(NS_LITERAL_STRING("title"), nsDependentString(aDialogTitle));
    root->SetPropertyAsAString(NS_LITERAL_STRING("text"), nsDependentString(aDialogText));
    root->SetPropertyAsUint32(NS_LITERAL_STRING("winid"), winid);
    if (aCheckMsg && aCheckValue) {
        root->SetPropertyAsAString(NS_LITERAL_STRING("checkmsg"), nsDependentString(aCheckMsg));
        root->SetPropertyAsBool(NS_LITERAL_STRING("checkmsgval"), *aCheckValue);
    }
    json->CreateJSON(root, sendString);

    mResponseMap[winid] = EmbedPromptResponse();

    mService->SendAsyncMessage(winid, NS_LITERAL_STRING("embed:alert").get(), sendString.get());
    mService->AddMessageListener("alertresponse", this);

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
    mService->RemoveMessageListener("alertresponse", this);

    std::map<uint32_t, EmbedPromptResponse>::iterator it = mResponseMap.find(winid);
    if (it == mResponseMap.end()) {
        return NS_ERROR_UNEXPECTED;
    }

    if (!it->second.accepted) {
        NS_WARNING("Alert not accepted");
    }

    if (aCheckValue) {
        *aCheckValue = it->second.checkvalue;
    }

    mResponseMap.erase(it);

    rv = utils->LeaveModalStateWithWindow(modalStateWin);

    mService->LeaveSecureJSContext();

    return NS_OK;
}

NS_IMETHODIMP
EmbedPromptService::Confirm(const PRUnichar* aDialogTitle,
                            const PRUnichar* aDialogText, bool* aConfirm)
{
    ConfirmCheck(aDialogTitle,
                 aDialogText, nullptr, nullptr, aConfirm);
    return NS_OK;
}

NS_IMETHODIMP
EmbedPromptService::ConfirmCheck(const PRUnichar* aDialogTitle,
                                 const PRUnichar* aDialogText,
                                 const PRUnichar* aCheckMsg,
                                 bool* aCheckValue, bool* aConfirm)
{
    uint32_t winid;
    mService->GetIDByWindow(mWin, &winid);

    nsString sendString;
    // Just simple property bag support still
    nsCOMPtr<nsIEmbedLiteJSON> json = do_GetService("@mozilla.org/embedlite-json;1");
    nsCOMPtr<nsIWritablePropertyBag2> root;
    json->CreateObject(getter_AddRefs(root));
    root->SetPropertyAsAString(NS_LITERAL_STRING("title"), nsDependentString(aDialogTitle));
    root->SetPropertyAsAString(NS_LITERAL_STRING("text"), nsDependentString(aDialogText));
    root->SetPropertyAsUint32(NS_LITERAL_STRING("winid"), winid);
    if (aCheckMsg && aCheckValue) {
        root->SetPropertyAsAString(NS_LITERAL_STRING("checkmsg"), nsDependentString(aCheckMsg));
        root->SetPropertyAsBool(NS_LITERAL_STRING("checkmsgval"), *aCheckValue);
    }
    if (aConfirm) {
        root->SetPropertyAsBool(NS_LITERAL_STRING("confirmval"), *aConfirm);
    }

    json->CreateJSON(root, sendString);

    mResponseMap[winid] = EmbedPromptResponse();

    mService->SendAsyncMessage(winid, NS_LITERAL_STRING("embed:confirm").get(), sendString.get());
    mService->AddMessageListener("confirmresponse", this);

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
    mService->RemoveMessageListener("confirmresponse", this);

    std::map<uint32_t, EmbedPromptResponse>::iterator it = mResponseMap.find(winid);
    if (it == mResponseMap.end()) {
        return NS_ERROR_UNEXPECTED;
    }

    if (!it->second.accepted) {
        NS_WARNING("Alert not accepted");
    }

    if (aCheckValue) {
        *aCheckValue = it->second.checkvalue;
    }

    if (aConfirm) {
        *aConfirm = it->second.accepted;
    }

    mResponseMap.erase(it);

    rv = utils->LeaveModalStateWithWindow(modalStateWin);

    mService->LeaveSecureJSContext();

    return NS_OK;
}

NS_IMETHODIMP
EmbedPromptService::ConfirmEx(const PRUnichar* aDialogTitle,
                              const PRUnichar* aDialogText,
                              PRUint32 aButtonFlags,
                              const PRUnichar* aButton0Title,
                              const PRUnichar* aButton1Title,
                              const PRUnichar* aButton2Title,
                              const PRUnichar* aCheckMsg, bool* aCheckValue,
                              PRInt32* aRetVal)
{
//    LOGNI();
    return NS_OK;
}

NS_IMETHODIMP
EmbedPromptService::Prompt(const PRUnichar* aDialogTitle,
                           const PRUnichar* aDialogText, PRUnichar** aValue,
                           const PRUnichar* aCheckMsg, bool* aCheckValue,
                           bool* aConfirm)
{
    uint32_t winid;
    mService->GetIDByWindow(mWin, &winid);

    nsString sendString;
    // Just simple property bag support still
    nsCOMPtr<nsIEmbedLiteJSON> json = do_GetService("@mozilla.org/embedlite-json;1");
    nsCOMPtr<nsIWritablePropertyBag2> root;
    json->CreateObject(getter_AddRefs(root));
    root->SetPropertyAsAString(NS_LITERAL_STRING("title"), nsDependentString(aDialogTitle));
    root->SetPropertyAsAString(NS_LITERAL_STRING("text"), nsDependentString(aDialogText));
    root->SetPropertyAsUint32(NS_LITERAL_STRING("winid"), winid);
    if (aCheckMsg && aCheckValue) {
        root->SetPropertyAsAString(NS_LITERAL_STRING("checkmsg"), nsDependentString(aCheckMsg));
        root->SetPropertyAsBool(NS_LITERAL_STRING("checkmsgval"), *aCheckValue);
    }
    if (aConfirm) {
        root->SetPropertyAsBool(NS_LITERAL_STRING("confirmval"), *aConfirm);
    }
    if (aValue) {
        root->SetPropertyAsAString(NS_LITERAL_STRING("defaultValue"), nsDependentString(*aValue));
    }
    json->CreateJSON(root, sendString);

    mResponseMap[winid] = EmbedPromptResponse();

    mService->SendAsyncMessage(winid, NS_LITERAL_STRING("embed:prompt").get(), sendString.get());
    mService->AddMessageListener("promptresponse", this);

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

    std::map<uint32_t, EmbedPromptResponse>::iterator it = mResponseMap.find(winid);
    if (it == mResponseMap.end()) {
        return NS_ERROR_UNEXPECTED;
    }

    if (!it->second.accepted) {
        NS_WARNING("Alert not accepted");
    }

    if (aCheckValue) {
        *aCheckValue = it->second.checkvalue;
    }

    if (aValue) {
        if (*aValue)
            NS_Free(*aValue);
       *aValue = ToNewUnicode(it->second.promptvalue);
    }

    if (aConfirm) {
        *aConfirm = it->second.accepted;
    }

    mResponseMap.erase(it);

    rv = utils->LeaveModalStateWithWindow(modalStateWin);

    mService->LeaveSecureJSContext();

    return NS_OK;
}

NS_IMETHODIMP
EmbedPromptService::PromptUsernameAndPassword(const PRUnichar* aDialogTitle,
                                              const PRUnichar* aDialogText,
                                              PRUnichar** aUsername,
                                              PRUnichar** aPassword,
                                              const PRUnichar* aCheckMsg,
                                              bool* aCheckValue,
                                              bool* aConfirm)
{
//    LOGNI();
    return NS_OK;
}

NS_IMETHODIMP
EmbedPromptService::PromptPassword(const PRUnichar* aDialogTitle,
                                   const PRUnichar* aDialogText,
                                   PRUnichar** aPassword,
                                   const PRUnichar* aCheckMsg,
                                   bool* aCheckValue, bool* aConfirm)
{
//    LOGNI();
    return NS_OK;
}

NS_IMETHODIMP
EmbedPromptService::Select(const PRUnichar* aDialogTitle,
                           const PRUnichar* aDialogText, PRUint32 aCount,
                           const PRUnichar** aSelectList, PRInt32* outSelection,
                           bool* aConfirm)
{
//    LOGNI();
    return NS_OK;
}


// Prompt Auth Implementation

EmbedAuthPromptService::EmbedAuthPromptService(nsIDOMWindow* aWin)
  : mWin(aWin)
{
    mService = do_GetService("@mozilla.org/embedlite-app-service;1");
}

EmbedAuthPromptService::~EmbedAuthPromptService()
{
}

NS_IMPL_ISUPPORTS2(EmbedAuthPromptService, nsIAuthPrompt2, nsIEmbedMessageListener)

NS_IMETHODIMP
EmbedAuthPromptService::PromptAuth(nsIChannel* aChannel,
                                   uint32_t level,
                                   nsIAuthInformation* authInfo,
                                   bool *_retval)
{
//    LOGNI();
    return NS_OK;
}

class nsAuthCancelableConsumer MOZ_FINAL : public nsICancelable
{
public:
    NS_DECL_ISUPPORTS

    nsAuthCancelableConsumer(nsIAuthPromptCallback* aCallback,
                             nsISupports *aContext)
        : mCallback(aCallback)
        , mContext(aContext)
    {
        NS_ASSERTION(mCallback, "null callback");
    }

    ~nsAuthCancelableConsumer()
    {
    }

    NS_IMETHOD Cancel(nsresult reason)
    {
        NS_ENSURE_ARG(NS_FAILED(reason));

        // If we've already called DoCallback then, nothing more to do.
        if (mCallback) {
            mCallback->OnAuthCancelled(mContext, false);
        }
        mCallback = nullptr;
        mContext = nullptr;
        return NS_OK;
    }

    nsCOMPtr<nsIAuthPromptCallback> mCallback;
    nsCOMPtr<nsISupports> mContext;
};

NS_IMPL_ISUPPORTS1(nsAuthCancelableConsumer, nsICancelable);

static nsCString getFormattedHostname(nsIURI* uri)
{
    nsCString scheme;
    uri->GetScheme(scheme);
    nsCString host;
    uri->GetHost(host);
    nsCString hostname(scheme);
    hostname.AppendLiteral("://");
    hostname.Append(host);

    // If the URI explicitly specified a port, only include it when
    // it's not the default. (We never want "http://foo.com:80")
    int32_t port = -1;
    uri->GetPort(&port);
    if (port != -1) {
        int32_t handlerPort = -1;
        nsCOMPtr<nsIIOService> ioService = do_GetService(NS_IOSERVICE_CONTRACTID);
        if (ioService) {
            nsCOMPtr<nsIProtocolHandler> handler;
            ioService->GetProtocolHandler(scheme.get(), getter_AddRefs(handler));
            if (handler) {
                handler->GetDefaultPort(&handlerPort);
            }
        }
        if (port != handlerPort) {
            hostname.AppendLiteral(":");
            hostname.AppendInt(port);
        }
    }
    return hostname;
}

static nsresult
getAuthTarget(nsIChannel* aChannel, nsIAuthInformation *authInfo, nsCString& hostname, nsCString& realm)
{
    nsresult rv;
    nsCOMPtr<nsIURI> uri;
    rv = aChannel->GetURI(getter_AddRefs(uri));
    NS_ENSURE_SUCCESS(rv, rv);
    hostname = getFormattedHostname(uri);
    // If a HTTP WWW-Authenticate header specified a realm, that value
    // will be available here. If it wasn't set or wasn't HTTP, we'll use
    // the formatted hostname instead.
    nsString ut16realm;
    if (NS_FAILED(authInfo->GetRealm(ut16realm)) || ut16realm.IsEmpty()) {
        realm = hostname;
    } else {
        realm = NS_ConvertUTF16toUTF8(ut16realm);
    }
    return NS_OK;
}

class EmbedAuthRunnable : public nsIRunnable
{
public:
    NS_DECL_ISUPPORTS

    EmbedAuthRunnable(EmbedAsyncAuthPrompt* aPrompt)
      : mPrompt(aPrompt)
    {
    }
    virtual ~EmbedAuthRunnable()
    {
    }
    NS_IMETHOD Run();
    EmbedAsyncAuthPrompt* mPrompt;
};

NS_IMPL_ISUPPORTS1(EmbedAuthRunnable, nsIRunnable)

NS_IMETHODIMP
EmbedAuthRunnable::Run()
{
    mPrompt->mService->DoSendAsyncPrompt(mPrompt);
    delete mPrompt;
    mPrompt = nullptr;
    return NS_OK;
}

NS_IMETHODIMP
EmbedAuthPromptService::AsyncPromptAuth(nsIChannel* aChannel,
                                        nsIAuthPromptCallback* aCallback,
                                        nsISupports *aContext, uint32_t level,
                                        nsIAuthInformation *authInfo,
                                        nsICancelable * *_retval)
{
    // The cases that we don't support now.
    nsresult rv;
    uint32_t authInfoFlags;
    rv = authInfo->GetFlags(&authInfoFlags);
    NS_ENSURE_SUCCESS(rv, rv);
    if ((authInfoFlags & nsIAuthInformation::AUTH_PROXY) &&
        (authInfoFlags & nsIAuthInformation::ONLY_PASSWORD)) {
        NS_ERROR("Not Implemented");
        return NS_ERROR_FAILURE;
    }

    nsCOMPtr<nsIInterfaceRequestor> notificationCallbacks;
    rv = aChannel->GetNotificationCallbacks(getter_AddRefs(notificationCallbacks));
    NS_ENSURE_SUCCESS(rv, rv);
    nsCOMPtr<nsILoadContext> loadContext = do_GetInterface(notificationCallbacks);
    nsCOMPtr<nsIDOMWindow> topWindow;
    rv = loadContext->GetTopWindow(getter_AddRefs(topWindow));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsAuthCancelableConsumer> consumer = new nsAuthCancelableConsumer(aCallback, aContext);

    nsCString hostname, httpRealm;
    NS_ENSURE_SUCCESS(getAuthTarget(aChannel, authInfo, hostname, httpRealm), NS_ERROR_FAILURE);

    nsCString hashKey;
    hashKey.AppendInt(level);
    hashKey.AppendLiteral("|");
    hashKey.Append(hostname);
    hashKey.AppendLiteral("|");
    hashKey.Append(httpRealm);
//    hashKey.AppendPrintf("%u|%s|%s", level, hostname.get(), httpRealm.get());
    LOGT("host:%s, realm:%s, hash:%s", hostname.get(), httpRealm.get(), hashKey.get());
    EmbedAsyncAuthPrompt* asyncPrompt = asyncPrompts[hashKey.get()];
    if (asyncPrompt) {
        asyncPrompt->consumers.AppendElement(consumer);
        *_retval = consumer.forget().get();
        return NS_OK;
    }
    asyncPrompt = new EmbedAsyncAuthPrompt(consumer, aChannel, authInfo, level, false);
    asyncPrompt->mWin = mWin;
    asyncPrompt->mHashKey = hashKey;
    asyncPrompt->mService = this;
    asyncPrompts[hashKey.get()] = asyncPrompt;
    DoAsyncPrompt();
    return NS_OK;
}

nsresult
EmbedAuthPromptService::DoSendAsyncPrompt(EmbedAsyncAuthPrompt* mPrompt)
{
    if (!mPrompt->mWin) {
        return NS_ERROR_FAILURE;
    }
    nsCString hostname, httpRealm;
    NS_ENSURE_SUCCESS(getAuthTarget(mPrompt->mChannel, mPrompt->mAuthInfo, hostname, httpRealm), NS_ERROR_FAILURE);
    nsString username;
    nsresult rv;
    uint32_t authInfoFlags;
    rv = mPrompt->mAuthInfo->GetFlags(&authInfoFlags);
    NS_ENSURE_SUCCESS(rv, rv);
    bool isOnlyPassword = !!(authInfoFlags & nsIAuthInformation::ONLY_PASSWORD);
    mPrompt->mAuthInfo->GetUsername(username);

    uint32_t winid;
    mService->GetIDByWindow(mPrompt->mWin, &winid);

    nsString sendString;
    // Just simple property bag support still
    nsCOMPtr<nsIEmbedLiteJSON> json = do_GetService("@mozilla.org/embedlite-json;1");
    nsCOMPtr<nsIWritablePropertyBag2> root;
    json->CreateObject(getter_AddRefs(root));
    root->SetPropertyAsACString(NS_LITERAL_STRING("title"), httpRealm);
    root->SetPropertyAsACString(NS_LITERAL_STRING("text"), hostname);
    root->SetPropertyAsUint32(NS_LITERAL_STRING("winid"), winid);
    root->SetPropertyAsBool(NS_LITERAL_STRING("passwordOnly"), isOnlyPassword);
    root->SetPropertyAsAString(NS_LITERAL_STRING("defaultValue"), username);

    json->CreateJSON(root, sendString);

    mResponseMap[winid] = EmbedPromptResponse();

    mService->SendAsyncMessage(winid, NS_LITERAL_STRING("embed:auth").get(), sendString.get());
    mService->AddMessageListener("authresponse", this);

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
    mService->RemoveMessageListener("authresponse", this);

    std::map<uint32_t, EmbedPromptResponse>::iterator it = mResponseMap.find(winid);
    if (it == mResponseMap.end()) {
        return NS_ERROR_UNEXPECTED;
    }

    if (!it->second.accepted) {
        NS_WARNING("Alert not accepted");
    }

    DoResponseAsyncPrompt(mPrompt, it->second.accepted, it->second.username, it->second.password);

    mResponseMap.erase(it);

    return NS_OK;
}

NS_IMETHODIMP
EmbedAuthPromptService::OnMessageReceived(const char* messageName, const PRUnichar* message)
{
    nsCOMPtr<nsIEmbedLiteJSON> json = do_GetService("@mozilla.org/embedlite-json;1");
    nsCOMPtr<nsIPropertyBag2> root;
    NS_ENSURE_SUCCESS(json->ParseJSON(nsDependentString(message), getter_AddRefs(root)), NS_ERROR_FAILURE);

    uint32_t winid = 0;
    root->GetPropertyAsUint32(NS_LITERAL_STRING("winid"), &winid);

    std::map<uint32_t, EmbedPromptResponse>::iterator it =
        mResponseMap.find(winid);
    if (it == mResponseMap.end())
        return NS_ERROR_FAILURE;
    EmbedPromptResponse& response = it->second;

    nsString promptValue;
    root->GetPropertyAsBool(NS_LITERAL_STRING("accepted"), &response.accepted);
    root->GetPropertyAsBool(NS_LITERAL_STRING("checkvalue"), &response.checkvalue);
    root->GetPropertyAsAString(NS_LITERAL_STRING("username"), response.username);
    root->GetPropertyAsAString(NS_LITERAL_STRING("password"), response.password);

    mModalDepth--;

    return NS_OK;
}

void
EmbedAuthPromptService::DoAsyncPrompt()
{
    // Find the key of a prompt whose browser element parent does not have
    // async prompt in progress.
    nsCString hashKey;
    std::map<std::string, EmbedAsyncAuthPrompt*>::iterator it;
    for (it = asyncPrompts.begin(); it != asyncPrompts.end(); it++) {
        EmbedAsyncAuthPrompt* asyncPrompt = it->second;
        if (asyncPrompt) {
            if (!asyncPrompt || !asyncPromptInProgress[asyncPrompt->mWin]) {
                hashKey = it->first.c_str();
                break;
            }
        }
    }
    // Didn't find an available prompt, so just return.
    if (hashKey.IsEmpty()) {
        return;
    }

    EmbedAsyncAuthPrompt* asyncPrompt = asyncPrompts[hashKey.get()];
    nsCString hostname, httpRealm;
    NS_ENSURE_SUCCESS(getAuthTarget(asyncPrompt->mChannel, asyncPrompt->mAuthInfo, hostname, httpRealm), );
    if (asyncPrompt->mWin) {
        asyncPromptInProgress[asyncPrompt->mWin] = true;
    }
    asyncPrompt->mInProgress = true;
    nsCOMPtr<nsIRunnable> runnable = new EmbedAuthRunnable(asyncPrompt);
    nsCOMPtr<nsIThread> thread;
    NS_GetCurrentThread(getter_AddRefs(thread));
    if (NS_FAILED(thread->Dispatch(runnable, nsIThread::DISPATCH_NORMAL))) {
        NS_WARNING("Dispatching EmbedAuthRunnable failed.");
    }
}

void
EmbedAuthPromptService::DoResponseAsyncPrompt(EmbedAsyncAuthPrompt* prompt,
                                              const bool& confirmed,
                                              const nsString& username,
                                              const nsString& password)
{
    nsresult rv;
    asyncPrompts.erase(prompt->mHashKey.get());
    prompt->mInProgress = false;
    if (prompt->mWin) {
        asyncPromptInProgress.erase(prompt->mWin);
    }
    // Fill authentication information with username and password provided
    // by user.
    uint32_t flags;
    rv = prompt->mAuthInfo->GetFlags(&flags);
    NS_ENSURE_SUCCESS(rv, );
    if (!username.IsEmpty()) {
        if (flags & nsIAuthInformation::NEED_DOMAIN) {
            // Domain is separated from username by a backslash
            int idx = username.Find("\\");
            if (idx == -1) {
                prompt->mAuthInfo->SetUsername(username);
            } else {
                prompt->mAuthInfo->SetDomain(nsDependentSubstring(username, 0, idx));
                prompt->mAuthInfo->SetUsername(nsDependentSubstring(username, idx + 1));
            }
        } else {
            prompt->mAuthInfo->SetUsername(username);
        }
    }

    if (!password.IsEmpty()) {
        prompt->mAuthInfo->SetPassword(password);
    }

    for (unsigned int i = 0; i < prompt->consumers.Length(); i++) {
        nsCOMPtr<nsICancelable> consumerI = prompt->consumers[i];
        nsCOMPtr<nsAuthCancelableConsumer> consumer = do_QueryInterface(consumerI);
        if (!consumer->mCallback) {
            // Not having a callback means that consumer didn't provide it
            // or canceled the notification.
            continue;
        }
        if (confirmed) {
            // printf("Ok, calling onAuthAvailable to finish auth.\n");
            consumer->mCallback->OnAuthAvailable(consumer->mContext, prompt->mAuthInfo);
        } else {
            // printf("Cancelled, calling onAuthCancelled to finish auth.\n");
            consumer->mCallback->OnAuthCancelled(consumer->mContext, true);
        }
    }

    // Process the next prompt, if one is pending.
    DoAsyncPrompt();
}

