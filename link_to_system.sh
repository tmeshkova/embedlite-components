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

FILES_LIST="
$OBJPREFIX/chromehelper/.libs/libchromehelper.so
$OBJPREFIX/history/.libs/libhistory.so
$OBJPREFIX/prompt/.libs/libprompt.so
$OBJPREFIX/touchhelper/.libs/libtouchhelper.so
$OBJPREFIX/widgetfactory/.libs/libwidgetfactory.so
EmbedLiteBinComponents.manifest
EmbedLiteJSComponents.manifest
jscomps/AboutRedirector.js
jscomps/AlertsService.js
jscomps/LoginManagerPrompter.js
jscomps/HelperAppDialog.js
jscomps/DownloadManagerUI.js
jscomps/EmbedPrefService.js
jscomps/ContentPermissionPrompt.js
"

for str in $FILES_LIST; do
    fname="${str##*/}"
    rm -f $TARGET_DIR/$fname;
    ln -s $(pwd)/$str $TARGET_DIR/components/$fname;
done

rm -f $TARGET_DIR/chrome/EmbedLiteJSScripts.manifest;
ln -s $(pwd)/EmbedLiteJSScripts.manifest $TARGET_DIR/chrome/EmbedLiteJSScripts.manifest;

rm -rf $TARGET_DIR/chrome/embedlite;
mkdir -p $TARGET_DIR/chrome/embedlite/content;
ln -s $(pwd)/jsscripts/embedhelper.js $TARGET_DIR/chrome/embedlite/content/embedhelper.js;
