AC_INIT(configure.ac)
AM_CONFIG_HEADER(config.h)

VERSION=1.0.0

AM_INIT_AUTOMAKE(historycomponent, $VERSION)

AC_PROG_CXX
AC_PROG_CXXCPP
AC_PROG_CC
AM_PROG_CC_STDC
AC_PROG_INSTALL
AC_DISABLE_STATIC
AM_DISABLE_STATIC
AC_PROG_RANLIB
AC_HEADER_STDC
AM_PROG_LIBTOOL
AC_PROG_CPP

if test "$PYTHON" == ""; then
    PYTHON=python
fi
AC_SUBST(PYTHON)
echo "Using PYTHON=$PYTHON"

AC_ARG_WITH(engine-path,
    AC_HELP_STRING([--with-engine-path[=path_to_obj_build_dir]],
                   [Specify engine path (default=)]
    ),
    with_engine=$withval, with_engine=
)

OBJ_PATH=
AC_ARG_WITH(engine-path,
[  --with-engine-path[[=DIR]]       use engine obj build in DIR],[
  if test "$withval" != "no" -a "$withval" != "yes"; then
    OBJ_PATH=$withval
  fi
])

if test "$OBJ_PATH" != ""; then
SDK_DIR=$OBJ_PATH/dist
IDL_DIR=$OBJ_PATH/dist/idl
ENGINE_CFLAGS="-I$OBJ_PATH/dist/include -I$OBJ_PATH/dist/include/nspr -I$OBJ_PATH/dist/include/mozilla -I$OBJ_PATH/dist/include/dom -I/usr/include/nspr4"
ENGINE_LIBS="-L$OBJ_PATH/dist/sdk/lib -lxpcomglue_s -lxul -lmozalloc"
else
PKG_CHECK_MODULES(ENGINE, libxul nspr,
[
    SDK_DIR=`pkg-config --variable=sdkdir libxul`
    IDL_DIR=`pkg-config --variable=idldir libxul`
    INCLUDE_DIR=`pkg-config --variable=includedir libxul`
    ENGINE_CFLAGS="$ENGINE_CFLAGS -I$INCLUDE_DIR/nspr"
])
fi
AC_SUBST(SDK_DIR)
AC_SUBST(IDL_DIR)


# Required flags
CXXFLAGS="$CXXFLAGS -include mozilla-config.h -std=gnu++0x -fno-rtti -fvisibility=hidden "
# random warnings hide
CXXFLAGS="$CXXFLAGS -Wno-attributes -Wno-ignored-qualifiers -Wall "
CXXFLAGS="$CXXFLAGS -Wno-unused-parameter -Wpointer-arith -Woverloaded-virtual "
CXXFLAGS="$CXXFLAGS -Werror=return-type -Wtype-limits -Wempty-body -Wno-ctor-dtor-privacy "
CXXFLAGS="$CXXFLAGS -Wno-format -Wno-overlength-strings -Wno-invalid-offsetof "
CXXFLAGS="$CXXFLAGS -Wno-variadic-macros -Wno-long-long  -Wno-psabi "

AC_SUBST(ENGINE_CFLAGS)
AC_SUBST(ENGINE_LIBS)

AC_OUTPUT([
    Makefile
    history/Makefile
    chromehelper/Makefile
    prompt/Makefile
    jscomps/Makefile
    touchhelper/Makefile
    jsscripts/Makefile
    widgetfactory/Makefile
    overrides/Makefile
])
