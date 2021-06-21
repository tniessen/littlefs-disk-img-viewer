#!/bin/bash
set -e

rm -rf build
mkdir build

echo "Downloading tailwind.min.css"
tailwindcss_version=2.2.2
tailwindcss_repo="https://github.com/tailwindlabs/tailwindcss"
curl --silent "https://unpkg.com/tailwindcss@$tailwindcss_version/dist/tailwind.min.css" -o "build/tailwind.min.css"

echo "Determining versions"
viewer_commit=$(git rev-parse --short=8 HEAD)
viewer_repo=$(git remote get-url origin)
heroicons_version=$(git -C icons tag --points-at HEAD)
heroicons_repo=$(git -C icons remote get-url origin)
littlefs_version=$(git -C src/littlefs tag --points-at HEAD)
littlefs_repo=$(git -C src/littlefs remote get-url origin)

declare -A glue_defs
glue_defs[ASYNCIFY_BUFFER_SIZE]=8192
glue_defs[MAX_CACHE_SIZE]=4096
glue_defs[MAX_LOOKAHEAD_SIZE]=128
glue_defs[MAX_PATH_SIZE]=1024
glue_defs[FILE_READ_BUFFER_SIZE]=8192

echo "Generating app-resources.js"
(
  echo "window.appResources = {"
  echo "  softwareInfo: ["
  echo "    {"
  echo "      name: 'littlefs disk image viewer',"
  echo "      version: '$viewer_commit',"
  echo "      repo: '$viewer_repo',"
  echo -n "      license: \`"
  cat LICENSE
  echo "\`"
  echo "    },"
  echo "    {"
  echo "      name: 'littlefs',"
  echo "      version: '$littlefs_version',"
  echo "      repo: '$littlefs_repo',"
  echo -n "      license: \`"
  cat src/littlefs/LICENSE.md
  echo "\`"
  echo "    },"
  echo "    {"
  echo "      name: 'tailwindcss',"
  echo "      version: '$tailwindcss_version',"
  echo "      repo: '$tailwindcss_repo',"
  echo -n "      license: \`"
  curl --silent "https://raw.githubusercontent.com/tailwindlabs/tailwindcss/v$tailwindcss_version/LICENSE"
  echo "\`"
  echo "    },"
  echo "    {"
  echo "      name: 'Heroicons',"
  echo "      version: '$heroicons_version',"
  echo "      repo: '$heroicons_repo',"
  echo -n "      license: \`"
  cat icons/LICENSE
  echo "\`"
  echo "    }"
  echo "  ],"
  echo "  definitions: {"
  for key in "${!glue_defs[@]}"; do
    echo "    $key: ${glue_defs[$key]},"
  done
  echo "  },"
  echo "  icons: {"
  for icon in outline/database outline/download outline/folder outline/information-circle outline/tag solid/document; do
    echo -n "    '$icon': \`"
    cat "icons/optimized/$icon.svg"
    echo "\`,"
  done
  echo "  }"
  echo "};"
) > build/app-resources.js

glue_def_flags=""
for key in "${!glue_defs[@]}"; do
  glue_def_flags="$glue_def_flags -D$key=${glue_defs[$key]}"
done

echo "Compiling WebAssembly"
# TODO: Warn on unused function
clang -flto -Os -Wall -Wextra \
      -Wno-unused-function \
      --target=wasm32-unknown-wasi \
      --sysroot wasi-sdk-12.0/share/wasi-sysroot/ \
      -Wl,--export-all \
      -Wl,--no-entry \
      -nostartfiles \
      -DLFS_NO_MALLOC -DLFS_NO_ASSERT -DLFS_NO_DEBUG -DLFS_NO_WARN -DLFS_NO_ERROR -DLFS_READONLY \
      $glue_def_flags \
      -Wl,--lto-O3, \
      -Wl,-z,stack-size=$[20 * 1024] \
      -o build/main.sync.wasm \
      src/glue.c src/littlefs/lfs*.c

echo "Asyncifying WebAssembly"
wasm-opt build/main.sync.wasm -Os --asyncify -o build/main.async.wasm

echo "Copying static files"
cp index.html build/index.html
cp -R lib/ build/

echo "Cleaning up"
rm build/main.sync.wasm
