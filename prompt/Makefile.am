libbzdir = $(libdir)/mozembedlite/components
libbz_LTLIBRARIES = libprompt.la

libprompt_la_SOURCES = \
    EmbedPromptRegister.cpp \
    EmbedPromptService.cpp \
    GenericFactory.cpp \
    nsEmbedChildModule.cpp \
    nsAlertsService.cpp \
    $(NULL)

libprompt_la_CPPFLAGS = \
    $(ENGINE_CFLAGS) \
    $(NULL)

libprompt_la_LDFLAGS = -module -avoid-version
libprompt_la_LIBADD = \
    $(ENGINE_LIBS) \
    $(NULL)
