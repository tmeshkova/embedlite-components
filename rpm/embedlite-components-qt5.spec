Name:       embedlite-components-qt5
Summary:    EmbedLite components Qt5
Version:    1.0.0
Release:    1
Group:      Applications/Internet
License:    Mozilla License
URL:        https://github.com/tmeshkova/embedlite-components
Source0:    %{name}-%{version}.tar.bz2
BuildRequires:  xulrunner-qt5-devel
BuildRequires:  pkgconfig(nspr)
BuildRequires:  python
BuildRequires:  libtool
BuildRequires:  automake
BuildRequires:  autoconf
BuildRequires:  perl
Requires:  xulrunner-qt5
Conflicts: embedlite-components

%description
EmbedLite Components required for embeded browser UI

%prep
%setup -q -n %{name}-%{version}

# >> setup
# << setup

%build
# >> build pre
# << build pre

NO_CONFIGURE=yes ./autogen.sh
%configure --with-system-nspr

make %{?jobs:-j%jobs}

# >> build post
# << build post

%install
rm -rf %{buildroot}
# >> install pre
# << install pre
%make_install

# >> install post
# << install post

%post
# >> post
/sbin/ldconfig
touch /var/lib/_MOZEMBED_CACHE_CLEAN_
# << post

%postun
# >> postun
/sbin/ldconfig
# << postun

%files
%defattr(-,root,root,-)
# >> files
%{_libdir}/mozembedlite/*
# << files
