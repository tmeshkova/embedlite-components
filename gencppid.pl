#!/usr/bin/perl -w

my $val = `uuid`;
my $NAME = $ARGV[0];
if ($NAME && $val=~/(\S{8})\-(\S{4})\-(\S{4})-(\S{2})(\S{2})\-(\S{2})(\S{2})(\S{2})(\S{2})(\S{2})(\S{2})/) {
  print "
uuid - $val
#define $NAME \\
{ 0x$1, \\
  0x$2, \\
  0x$3, \\
  { 0x$4, 0x$5, 0x$6, 0x$7, 0x$8, 0x$9, 0x$10 }}
\n";
} else {
  print "Bad value provided.. use gencppid.pl NS_BLA_NAME_CID\n";
}
