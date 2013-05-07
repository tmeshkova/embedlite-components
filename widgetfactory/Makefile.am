libbzdir = $(libdir)/mozembedlite/components
libbz_LTLIBRARIES = libwidgetfactory.la

libwidgetfactory_la_SOURCES = \
    EmbedWidgetFactoryRegister.cpp \
    nsFilePicker.cpp \
    GenericFactory.cpp \
    nsEmbedChildModule.cpp \
    nsClipboard.cpp \
    $(NULL)

libwidgetfactory_la_CPPFLAGS = \
    $(ENGINE_CFLAGS) \
    $(NULL)

libwidgetfactory_la_LDFLAGS = -module -avoid-version
libwidgetfactory_la_LIBADD = \
    $(ENGINE_LIBS) \
    $(NULL)
