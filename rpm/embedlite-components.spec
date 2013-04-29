Name:       embedlite-components
Summary:    EmbedLite components
Version:    1.0.0
Release:    1
Group:      Applications/Internet
License:    Mozilla License
URL:        https://github.com/tmeshkova/embedlite-components
Source0:    %{name}-%{version}.tar.bz2
BuildRequires:  pkgconfig(libxul) >= 23.0a1
BuildRequires:  pkgconfig(nspr)
BuildRequires:  python
BuildRequires:  libtool

%description
EmbedLite Components required for embeded browser UI

%prep
%setup -q -n %{name}-%{version}

# >> setup
# << setup

%build
# >> build pre
# << build pre

NO_CONFIGURE=YES ./autogen.sh
%configure --prefix=/usr \

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
