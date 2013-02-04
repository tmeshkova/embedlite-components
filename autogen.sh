#!/bin/sh

set -x
libtoolize --automake
aclocal
autoconf
autoheader
automake --add-missing --foreign
if [ "$NO_CONFIGURE" = "yes" ]; then
  echo "Disable auto configure start"
else
./configure --prefix=/usr
fi
