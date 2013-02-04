libbzdir = $(libdir)/mozembedlite/components
libbz_LTLIBRARIES = libtouchhelper.la

libtouchhelper_la_SOURCES = \
    nsEmbedTouchModule.cpp \
    EmbedTouchManager.cpp \
    EmbedTouchListener.cpp \
    $(NULL)

libtouchhelper_la_CPPFLAGS = \
    $(ENGINE_CFLAGS) \
    $(NULL)

libtouchhelper_la_LDFLAGS = -module -avoid-version
libtouchhelper_la_LIBADD = \
    $(ENGINE_LIBS) \
    $(NULL)
