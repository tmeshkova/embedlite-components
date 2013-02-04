#!/bin/sh

TARGET_DIR=$1
if [ "$TARGET_DIR" = "" ]; then
  echo "TARGET_DIR ex: /usr/lib/mozembedlite/components"
  TARGET_DIR=/usr/lib/mozembedlite/components
fi

mkdir -p $TARGET_DIR

FILES_LIST="
chromehelper/.libs/libchromehelper.so
history/.libs/libhistory.so
prompt/.libs/libprompt.so
touchhelper/.libs/libtouchhelper.so
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
