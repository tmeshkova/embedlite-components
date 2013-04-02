libbzdir = $(libdir)/mozembedlite/components
libbz_LTLIBRARIES = libhistory.la

libhistory_la_SOURCES = \
    EmbedHistoryListener.cpp \
    nsEmbedHistoryModule.cpp \
    $(NULL)

libhistory_la_CPPFLAGS = \
    $(ENGINE_CFLAGS) \
    $(NULL)

libhistory_la_LDFLAGS = -module -avoid-version
libhistory_la_LIBADD = \
    $(ENGINE_LIBS) \
    $(NULL)

# IDL = nsIEmbedLiteHistory
# EmbedHistoryListener.cpp: $(IDL).h
# $(IDL).h: $(IDL).idl
# 	$(PYTHON) $(SDK_DIR)/sdk/bin/header.py -I$(IDL_DIR) -I. $(srcdir)/$(IDL).idl -o $(IDL).h
# 	$(PYTHON) $(SDK_DIR)/sdk/bin/typelib.py -I$(IDL_DIR) -I. $(srcdir)/$(IDL).idl -o $(IDL).xpt
