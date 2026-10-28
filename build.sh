#!/bin/sh
# Construit dist/chrome/cache-ton-facho.zip et dist/firefox/cache-ton-facho-firefox.xpi depuis src/.
set -e
root=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# Firefox : src/ tel quel, à la racine de l'archive.
rm -f "$root/dist/firefox/cache-ton-facho-firefox.xpi"
(cd "$root/src" && zip -qrX "$root/dist/firefox/cache-ton-facho-firefox.xpi" . -x '*.DS_Store')

# Chrome : un dossier cache-ton-facho/, sans la clé propre à Firefox (Chrome l'affiche en erreur)
# et avec un service worker à la place des scripts de fond (Firefox ne gère que ces derniers).
dir="$tmp/cache-ton-facho"
mkdir "$dir"
cp -R "$root/src/." "$dir/"
cp "$root/dist/chrome/README.md" "$dir/"
python3 - "$dir/manifest.json" <<'EOF'
import json, sys
path = sys.argv[1]
manifest = json.load(open(path, encoding="utf-8"))
del manifest["browser_specific_settings"]
manifest["background"] = {"service_worker": "background.js"}
with open(path, "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)
    f.write("\n")
EOF
rm -f "$root/dist/chrome/cache-ton-facho.zip"
(cd "$tmp" && zip -qrX "$root/dist/chrome/cache-ton-facho.zip" cache-ton-facho -x '*.DS_Store')

echo "OK : dist/chrome/cache-ton-facho.zip et dist/firefox/cache-ton-facho-firefox.xpi"
