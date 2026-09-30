#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi
