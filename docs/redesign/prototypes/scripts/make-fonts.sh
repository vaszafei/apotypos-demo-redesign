#!/usr/bin/env bash
# Download Inter, Source Serif 4 and three candidate sans families (IBM Plex Sans, Manrope, Commissioner) from the Google Fonts repository and write the Greek and Latin woff2 subsets.
# Usage: make-fonts.sh <cache-dir> <out-dir>. Needs fonttools and brotli (pip install fonttools brotli).
# The commit is fixed and the script checks the SHA-256 of each file, so a second run gives the same bytes.
set -euo pipefail
cache=$1; out=$2
mkdir -p "$cache" "$out"
commit=47d54ca1ebb14fd864695f1d39dc734f39017c33
base=https://github.com/google/fonts/raw/$commit/ofl
[ -f "$cache/Inter.ttf" ] || curl -sSfL -o "$cache/Inter.ttf" "$base/inter/Inter%5Bopsz,wght%5D.ttf"
[ -f "$cache/SourceSerif4.ttf" ] || curl -sSfL -o "$cache/SourceSerif4.ttf" "$base/sourceserif4/SourceSerif4%5Bopsz,wght%5D.ttf"
[ -f "$cache/IBMPlexSans.ttf" ] || curl -sSfL -o "$cache/IBMPlexSans.ttf" "$base/ibmplexsans/IBMPlexSans%5Bwdth,wght%5D.ttf"
[ -f "$cache/Manrope.ttf" ] || curl -sSfL -o "$cache/Manrope.ttf" "$base/manrope/Manrope%5Bwght%5D.ttf"
[ -f "$cache/Commissioner.ttf" ] || curl -sSfL -o "$cache/Commissioner.ttf" "$base/commissioner/Commissioner%5BFLAR,VOLM,slnt,wght%5D.ttf"
sha256sum -c - <<SUMS
29160a80ff49ddcab2c97711247e08b1fab27a484a329ce8b813d820dc559031  $cache/Inter.ttf
97b2d4da6e3cb494b5a1e66ae176914d852ccabef49e0c02c0df25f3e39aca0b  $cache/SourceSerif4.ttf
3b031aa4216174205bd8471f88a49b91f093169e9e87bd5262242bc5967fe2e3  $cache/IBMPlexSans.ttf
3ae11c49db0455a3cc33e37d380f20fdb8c7f8b41dc07625c177e3d87a9d6ae6  $cache/Manrope.ttf
db01279a6eb8676ee62675a4d7e5edbfe5f08fbc109358e2f49760b70c0447d3  $cache/Commissioner.ttf
SUMS
# The SIL Open Font License of each family goes next to the subsets.
curl -sSfL -o "$out/Inter-OFL.txt" "$base/inter/OFL.txt"
curl -sSfL -o "$out/SourceSerif4-OFL.txt" "$base/sourceserif4/OFL.txt"
curl -sSfL -o "$out/IBMPlexSans-OFL.txt" "$base/ibmplexsans/OFL.txt"
curl -sSfL -o "$out/Manrope-OFL.txt" "$base/manrope/OFL.txt"
curl -sSfL -o "$out/Commissioner-OFL.txt" "$base/commissioner/OFL.txt"
# Fix the axes that the UI does not use. Only the weight axis stays variable.
python3 -m fontTools.varLib.instancer "$cache/IBMPlexSans.ttf" wdth=100 -q -o "$cache/IBMPlexSans-wght.ttf"
python3 -m fontTools.varLib.instancer "$cache/Commissioner.ttf" slnt=0 FLAR=0 VOLM=0 -q -o "$cache/Commissioner-wght.ttf"
cp "$cache/Manrope.ttf" "$cache/Manrope-wght.ttf"
# Basic Latin, Latin-1, Greek and Coptic, general punctuation, euro and minus.
unicodes="U+0020-007E,U+00A0-00FF,U+0370-03FF,U+2010-2027,U+2030-203A,U+20AC,U+2212"
for f in Inter SourceSerif4; do
  python3 -m fontTools.subset "$cache/$f.ttf" --unicodes="$unicodes" --layout-features=kern,liga,tnum,lnum,case \
    --flavor=woff2 --output-file="$out/$f-greek-latin.woff2"
done
for f in IBMPlexSans Manrope Commissioner; do
  python3 -m fontTools.subset "$cache/$f-wght.ttf" --unicodes="$unicodes" --layout-features=kern,liga,tnum,lnum,case \
    --flavor=woff2 --output-file="$out/$f-greek-latin.woff2"
done
ls -l "$out"
