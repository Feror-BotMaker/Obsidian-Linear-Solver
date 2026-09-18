#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
project_dir="$(cd -- "${script_dir}/.." && pwd -P)"
version="$(node -p "require('${project_dir}/manifest.json').version")"
dist_dir="${project_dir}/dist"
archive="${dist_dir}/linear-solver-${version}.zip"

(cd -- "${project_dir}" && npm run build)

mkdir -p "${dist_dir}"
rm -f "${dist_dir}/main.js" "${dist_dir}/manifest.json" "${dist_dir}/styles.css" "${archive}"
install -m 0644 "${project_dir}/main.js" "${dist_dir}/main.js"
install -m 0644 "${project_dir}/manifest.json" "${dist_dir}/manifest.json"
install -m 0644 "${project_dir}/styles.css" "${dist_dir}/styles.css"

(cd -- "${dist_dir}" && zip -q "$(basename -- "${archive}")" main.js manifest.json styles.css)

echo "Created release package: ${archive}"
