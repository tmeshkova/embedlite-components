%define embedlitecomponentsversion 1.0.0

Name:       embedlite-components
Summary:    Qt MozEmbed
Version:    %{embedlitecomponentsversion}
Release:    1
Group:      Applications/Internet
License:    Mozilla License
URL:        http://www.mozilla.com
Source0:    %{name}-%{version}.tar.bz2
BuildRequires:  pkgconfig(libxul)
BuildRequires:  python

%description
EmbedLite Components

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
%{_libdir}/*
# << files
