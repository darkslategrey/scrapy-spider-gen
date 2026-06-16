# justfile for scrapy-spider-gen
# https://github.com/casey/just
#
# Install: cargo install just  |  brew install just  |  apt install just
# Usage:   just                # list recipes
#          just test           # run tests
#          just publish        # full local publish flow

set shell := ["bash", "-uc"]
set dotenv-load
set positional-arguments

# Package name from package.json
name := `node -p "require('./package.json').name"`
# Current version from package.json
ver := `node -p "require('./package.json').version"`

# Default: list available recipes
default:
    @just --list

# -----------------------------------------------------------------------------
# Quality gates (mirrors CI)
# -----------------------------------------------------------------------------

# Run biome check
lint:
    npm run check

# Compile TypeScript to dist/
build:
    npm run build

# Run vitest once
test:
    npm test

# Run lint + build + test (same as `npm run ci`)
ci: lint build test

# -----------------------------------------------------------------------------
# Tarball sanity
# -----------------------------------------------------------------------------

# Pack a dry-run, show what would be in the tarball
pack-check:
    npm pack --dry-run
    @echo
    @echo "--- detailed contents ---"
    @TGZ=$(npm pack 2>/dev/null | tail -n 1) && tar -tzf "$TGZ" | sort

# Verify the tarball does not leak scrapy-spider-gen-omp/
verify-clean-tarball:
    #!/usr/bin/env bash
    set -euo pipefail
    TGZ=$(npm pack 2>/dev/null | tail -n 1)
    if tar -tzf "$TGZ" | grep -q "scrapy-spider-gen-omp/"; then
        echo "::error::tarball leaks scrapy-spider-gen-omp/" >&2
        tar -tzf "$TGZ" | grep "scrapy-spider-gen-omp" >&2 || true
        exit 1
    fi
    echo "Tarball clean: $TGZ"

# Smoke-test the tarball in a throwaway project
smoke:
    #!/usr/bin/env bash
    set -euo pipefail
    TGZ=$(ls scrapy-spider-gen-*.tgz 2>/dev/null | head -n 1)
    if [ -z "$TGZ" ]; then
        TGZ=$(npm pack 2>/dev/null | tail -n 1)
    fi
    TGZ_ABS="$(cd "$(dirname "$TGZ")" && pwd)/$(basename "$TGZ")"
    PROBE=$(mktemp -d)
    trap "rm -rf $PROBE" EXIT
    (cd "$PROBE" && npm init -y >/dev/null && npm install "$TGZ_ABS" 2>&1 | tail -3)
    (cd "$PROBE" && node --input-type=module -e "import('{{name}}').then(m => { console.log('default type:', typeof m.default); console.log('named keys:', Object.keys(m).filter(k => k !== 'default')); }).catch(e => { console.error('IMPORT FAIL:', e.message); process.exit(1); })")
    echo "Smoke test passed"
    rm -f "$TGZ_ABS"
publish-dry:
    just ci
    just verify-clean-tarball
    just smoke

# Publish locally using NPM_TOKEN from env (interactive 2FA fallback)
publish-local token:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "==> Checking auth with provided token"
    echo "Token length: ${#1}"
    curl -s -H "Authorization: Bearer $1" https://registry.npmjs.org/-/whoami
    echo
    echo "==> Bumping version"
    npm version patch
    echo "==> Building"
    npm run build
    echo "==> Publishing"
    NPM_CONFIG_USERCONFIG=/tmp/.npmrc.publish-$$ \
        npm publish --access public
    echo "==> Cleaning up"
    rm -f /tmp/.npmrc.publish-*
    echo
    echo "==> Done. Verify on https://www.npmjs.com/package/{{name}}"

# Full publish flow:
# 1. Run CI gates
# 2. Verify tarball cleanliness
# 3. Smoke test
# 4. Bump version (patch by default, or pass minor/major)
# 5. Push commit + tag
# 6. Open the GitHub Actions run URL in your browser
publish level="patch":
    #!/usr/bin/env bash
    set -euo pipefail
    echo "==> Running CI gates"
    just ci
    echo
    echo "==> Verifying tarball"
    just verify-clean-tarball
    echo
    echo "==> Smoke test"
    just smoke
    echo
    echo "==> Current version: $(node -p "require('./package.json').version")"
    echo "==> Bumping ($level)"
    npm version "$level"
    echo
    echo "==> Pushing commit + tag"
    git push --follow-tags
    echo
    echo "==> Done. Open the Actions tab to approve the deployment:"
    echo "    https://github.com/darkslategrey/{{name}}/actions"
    open "https://github.com/darkslategrey/{{name}}/actions" 2>/dev/null || \
        echo "    (open the URL manually)"

# -----------------------------------------------------------------------------
# Maintenance
# -----------------------------------------------------------------------------

# Remove build artifacts and node_modules
clean:
    rm -rf dist node_modules coverage .vitest

# Reinstall dependencies
install:
    npm install

# Show current version
version:
    @echo "{{name}} @ {{ver}}"

# Bump version without publishing (used by CI on tag push)
bump level="patch":
    npm version "$level"
    git push --follow-tags

# -----------------------------------------------------------------------------
# Release notes
# -----------------------------------------------------------------------------

# Generate release notes between two tags
notes prev next:
    @echo "## {{name}} $next"
    @echo
    @echo "Changes since $prev:"
    @git log --oneline "$prev..$next" | sed 's/^/- /' | head -20
