#!/bin/sh

TARGET_DIR=$1
if [ "$TARGET_DIR" = "" ]; then
  echo "TARGET_DIR ex: /usr/lib/mozembedlite"
  TARGET_DIR=/usr/lib/mozembedlite
fi

OBJPREFIX=$2
if [ "$OBJPREFIX" = "" ]; then
  BARCH=`uname -m`
  OBJPREFIX=objdir-$BARCH
fi

LAST_OBJ_DIR="$OBJPREFIX"

mkdir -p $TARGET_DIR
mkdir -p $TARGET_DIR/components

FILES_LIST="
$OBJPREFIX/chromehelper/.libs/libchromehelper.so
$OBJPREFIX/history/.libs/libhistory.so
$OBJPREFIX/prompt/.libs/libprompt.so
$OBJPREFIX/touchhelper/.libs/libtouchhelper.so
$OBJPREFIX/widgetfactory/.libs/libwidgetfactory.so
EmbedLiteBinComponents.manifest
jscomps/EmbedLiteJSComponents.manifest
jscomps/AboutRedirector.js
jscomps/AlertsService.js
jscomps/LoginManagerPrompter.js
jscomps/HelperAppDialog.js
jscomps/DownloadManagerUI.js
jscomps/EmbedPrefService.js
jscomps/ContentPermissionPrompt.js
jscomps/EmbedLiteGlobalHelper.js
jscomps/EmbedLiteConsoleListener.js
jscomps/EmbedLiteSyncService.js
jscomps/EmbedLiteFaviconService.js
jscomps/EmbedLiteSearchEngine.js
jscomps/EmbedLiteErrorPageHandler.js
"

for str in $FILES_LIST; do
    fname="${str##*/}"
    rm -f $TARGET_DIR/$fname;
    ln -s $(pwd)/$str $TARGET_DIR/components/$fname;
done

rm -f $TARGET_DIR/chrome/EmbedLiteJSScripts.manifest;
ln -s $(pwd)/jsscripts/EmbedLiteJSScripts.manifest $TARGET_DIR/chrome/EmbedLiteJSScripts.manifest;

rm -rf $TARGET_DIR/chrome/embedlite;
mkdir -p $TARGET_DIR/chrome/embedlite/content;
ln -s $(pwd)/jsscripts/embedhelper.js $TARGET_DIR/chrome/embedlite/content/embedhelper.js;
ln -s $(pwd)/jsscripts/SelectHelper.js $TARGET_DIR/chrome/embedlite/content/SelectHelper.js;
ln -s $(pwd)/jsscripts/google.xml $TARGET_DIR/chrome/embedlite/content/google.xml;
ln -s $(pwd)/jsscripts/bing.xml $TARGET_DIR/chrome/embedlite/content/bing.xml;
ln -s $(pwd)/jsscripts/yahoo.xml $TARGET_DIR/chrome/embedlite/content/yahoo.xml;

rm -f $TARGET_DIR/chrome/EmbedLiteOverrides.manifest;
ln -s $(pwd)/overrides/EmbedLiteOverrides.manifest $TARGET_DIR/chrome/EmbedLiteOverrides.manifest;

rm -rf $TARGET_DIR/chrome/chrome;
mkdir -p $TARGET_DIR/chrome/chrome/content;
mkdir -p $TARGET_DIR/chrome/chrome/skin;
ln -s $(pwd)/overrides/aboutCertError.xhtml $TARGET_DIR/chrome/chrome/content/
ln -s $(pwd)/overrides/netError.xhtml $TARGET_DIR/chrome/chrome/content/
ln -s $(pwd)/overrides/netError.css $TARGET_DIR/chrome/chrome/skin/

rm -rf $TARGET_DIR/chrome/en-US/locale/branding;
rm -rf $TARGET_DIR/chrome/en-US/locale/en-US/browser;
mkdir -p $TARGET_DIR/chrome/en-US/locale/branding;
mkdir -p $TARGET_DIR/chrome/en-US/locale/en-US/browser;
ln -s $(pwd)/overrides/brand.dtd $TARGET_DIR/chrome/en-US/locale/branding/
ln -s $(pwd)/overrides/brand.properties $TARGET_DIR/chrome/en-US/locale/branding/
ln -s $(pwd)/overrides/aboutCertError.dtd $TARGET_DIR/chrome/en-US/locale/en-US/browser/
ln -s $(pwd)/overrides/netError.dtd $TARGET_DIR/chrome/en-US/locale/en-US/browser/
