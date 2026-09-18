#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /path/to/ObsidianVault" >&2
  exit 64
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
project_dir="$(cd -- "${script_dir}/.." && pwd -P)"
vault_input="$1"

if [[ ! -d "${vault_input}" ]]; then
  echo "Error: vault directory does not exist: ${vault_input}" >&2
  exit 66
fi

vault_dir="$(cd -- "${vault_input}" && pwd -P)"
if [[ ! -d "${vault_dir}/.obsidian" ]]; then
  echo "Error: ${vault_dir} is not an Obsidian vault (.obsidian is missing)." >&2
  exit 65
fi

echo "Building Linear Solver…"
(cd -- "${project_dir}" && npm run build)

plugin_dir="${vault_dir}/.obsidian/plugins/linear-solver"
install -d "${plugin_dir}"
install -m 0644 "${project_dir}/manifest.json" "${plugin_dir}/manifest.json"
install -m 0644 "${project_dir}/main.js" "${plugin_dir}/main.js"
install -m 0644 "${project_dir}/styles.css" "${plugin_dir}/styles.css"

echo "Installed Linear Solver in: ${plugin_dir}"
echo "Enable it under Obsidian → Settings → Community plugins."
