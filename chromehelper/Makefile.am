libbzdir = $(libdir)/mozembedlite/components
libbz_LTLIBRARIES = libchromehelper.la

libchromehelper_la_SOURCES = \
    EmbedChromeListener.cpp \
    EmbedChromeManager.cpp \
    nsEmbedChromeModule.cpp \
    $(NULL)

libchromehelper_la_CPPFLAGS = \
    $(ENGINE_CFLAGS) \
    $(NULL)

libchromehelper_la_LDFLAGS = -module -avoid-version
libchromehelper_la_LIBADD = \
    $(ENGINE_LIBS) \
    $(NULL)
