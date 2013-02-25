EXTRA_DIST = \
	autogen.sh

SUBDIRS = history chromehelper prompt jscomps touchhelper jsscripts

INCLUDES = $(DEPS_CFLAGS) 

manifests_manifestdir=$(libdir)/mozembedlite/components
manifests_manifest_DATA = \
	EmbedLiteBinComponents.manifest \
	EmbedLiteJSComponents.manifest \
	$(NULL)

manifestsscript_manifestdir=$(libdir)/mozembedlite/chrome
manifestsscript_manifest_DATA = \
	EmbedLiteJSScripts.manifest \
	$(NULL)
