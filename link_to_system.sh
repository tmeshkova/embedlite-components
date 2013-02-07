#!/bin/sh

TARGET_DIR=$1
if [ "$TARGET_DIR" = "" ]; then
  echo "TARGET_DIR ex: /usr/lib/mozembedlite/components"
  TARGET_DIR=/usr/lib/mozembedlite/components
fi

BARCH=`uname -m`
LAST_OBJ_DIR="objdir-$BARCH"

mkdir -p $TARGET_DIR

FILES_LIST="
$LAST_OBJ_DIR/chromehelper/.libs/libchromehelper.so
$LAST_OBJ_DIR/history/.libs/libhistory.so
$LAST_OBJ_DIR/prompt/.libs/libprompt.so
$LAST_OBJ_DIR/touchhelper/.libs/libtouchhelper.so
EmbedLiteBinComponents.manifest
EmbedLiteJSComponents.manifest
jscomps/AboutRedirector.js
jscomps/AlertsService.js
jscomps/LoginManagerPrompter.js
"
for str in $FILES_LIST; do
    fname="${str##*/}"
    rm -f $TARGET_DIR/$fname;
    ln -s $(pwd)/$str $TARGET_DIR/$fname;
done
