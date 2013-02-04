AC_INIT(configure.ac)
AM_CONFIG_HEADER(config.h)

VERSION=1.0.0

AM_INIT_AUTOMAKE(historycomponent, $VERSION)

AC_PROG_CXX
AC_PROG_CXXCPP
AC_ISC_POSIX
AC_PROG_CC
AM_PROG_CC_STDC
AC_PROG_INSTALL
AC_PROG_RANLIB
AC_CHECK_TOOL(AR, ar)
AC_HEADER_STDC
AC_LIBTOOL_DLOPEN
AM_PROG_LIBTOOL
AC_PROG_CPP
AC_HEADER_STDC


PKG_CHECK_MODULES(ENGINE, libxul nspr,
[
    SDK_DIR=`pkg-config --variable=sdkdir libxul`
    IDL_DIR=`pkg-config --variable=idldir libxul`
    AC_SUBST(SDK_DIR)
    AC_SUBST(IDL_DIR)
])

CXXFLAGS+=" -include mozilla-config.h -std=gnu++0x "
CXXFLAGS+=" -Wno-attributes -Wno-ignored-qualifiers -Wall "
CXXFLAGS+=" -Wno-unused-parameter -Wpointer-arith -Woverloaded-virtual "
CXXFLAGS+=" -Werror=return-type -Wtype-limits -Wempty-body -Wno-ctor-dtor-privacy "
CXXFLAGS+=" -Wno-format -Wno-overlength-strings -Wno-invalid-offsetof "
CXXFLAGS+=" -Wno-variadic-macros -Wno-long-long  -Wno-psabi "

AC_SUBST(ENGINE_CFLAGS)
AC_SUBST(ENGINE_LIBS)


AC_OUTPUT([
    Makefile
    history/Makefile
    chromehelper/Makefile
    prompt/Makefile
])
