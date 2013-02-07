#!/bin/sh

set -x
libtoolize --automake -c
aclocal
autoconf
autoheader
automake --add-missing --foreign -a
if [ "$NO_CONFIGURE" = "yes" ]; then
  echo "Disable auto configure start"
else
./configure --prefix=/usr
fi
