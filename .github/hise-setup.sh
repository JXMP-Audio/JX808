#!/usr/bin/env bash
# CI: prepares HISE 4.1.0 next to the checkout (../HISE, same layout as in PluginCollection):
# source + SDK + our patches (.github/hise-patches),
# and on Linux also the HISE binary that exports the project.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HISE="$ROOT/../HISE"
TAG=4.1.0

mkdir -p "$HISE"
[ -d "$HISE/source" ] || git clone --branch "$TAG" --depth 1 https://github.com/christophhart/HISE.git "$HISE/source"
unzip -o -q "$HISE/source/tools/SDK/sdk.zip" -d "$HISE/source/tools/SDK"

for p in "$ROOT"/.github/hise-patches/*.patch; do
	git -C "$HISE/source" apply --reverse --check "$p" 2>/dev/null || git -C "$HISE/source" apply "$p"
done

if [ "$(uname -s)" = "Linux" ]; then
	if [ ! -x "$HISE/HISE Standalone" ]; then
		curl -L --fail -o "$HISE/hise.zip" "https://github.com/christophhart/HISE/releases/download/$TAG/HISE.$TAG.debian.x64.zip"
		unzip -o -q "$HISE/hise.zip" -d "$HISE"
		chmod +x "$HISE/HISE Standalone"
	fi
	chmod +x "$HISE/source/tools/projucer/Projucer"

	# the export sanity check reads the HISE path from the settings, not from -h:
	mkdir -p ~/.hise
	cat > ~/.hise/compilerSettings.xml <<XML
<?xml version="1.0" encoding="UTF-8"?>
<CompilerSettings>
  <HisePath value="$(cd "$HISE/source" && pwd)"/>
  <VisualStudioVersion value="Visual Studio 2022"/>
  <UseIPP value="No"/>
  <LegacyCPUSupport value="No"/>
  <RebuildPoolFiles value="Yes"/>
</CompilerSettings>
XML
fi
