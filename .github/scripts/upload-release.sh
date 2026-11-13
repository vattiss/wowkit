#!/usr/bin/env bash
# Uploads an addon's release zip to CurseForge or to Wago, from the release workflow: one site a run, so a site that failed
# is run again alone. Each needs its token in the environment (CF_API_KEY, WAGO_API_TOKEN); without it, it is skipped.
# The project IDs are the TOC's X-Curse-Project-ID and X-Wago-ID. The game version follows the TOC's Interface (16001 is
# Forever 1.60.1): a site that does not have it yet is not uploaded to, rather than putting the file under another version.
# The file is named as the zip, its changelog is the release's, and a version like 1.0.0-beta.1 goes up as a beta.
#
#   bash .github/scripts/upload-release.sh curseforge|wago addons/glowing-bars/dist 1.0.0
set -euo pipefail

site="$1"
dist="$2"
version="$3"
zip="$(ls "$dist"/*-"$version".zip)"
name="$(basename "$zip")"
toc="$(ls "$dist"/*/*.toc | head -n 1)"
changelog="$dist/changelog.md"
work="$(mktemp -d)"

read_toc() { sed -n "s/^## $1: *//p" "$toc" | tr -d '\r' | head -n 1; }
interface="$(read_toc Interface)"
curse_id="$(read_toc X-Curse-Project-ID)"
wago_id="$(read_toc X-Wago-ID)"
if [[ "$version" == *-* ]]; then
    curse_type="beta"
    wago_stability="beta"
else
    curse_type="release"
    wago_stability="stable"
fi
failed=0

# CurseForge: WoW Forever is its game version type 88568; the version is the one whose apiVersion is the Interface
upload_to_curseforge() {
    local versions version_id status
    versions="$(curl -sS --fail -H "x-api-token: $CF_API_KEY" https://wow.curseforge.com/api/game/versions)"
    version_id="$(jq -r --arg api "$interface" \
        'map(select(.gameVersionTypeID == 88568 and .apiVersion == $api)) | .[0].id // empty' <<<"$versions")"
    if [[ -z "$version_id" ]]; then
        echo "CurseForge has no WoW Forever version for Interface $interface yet: not uploaded"
        return 1
    fi
    jq -n --arg name "$name" --argjson id "$version_id" --arg type "$curse_type" --rawfile log "$changelog" \
        '{displayName: $name, gameVersions: [$id], releaseType: $type, changelog: $log, changelogType: "markdown"}' >"$work/curse.json"
    status="$(curl -sS --retry 3 --retry-delay 10 -o "$work/curse-result.json" -w '%{http_code}' \
        -H "x-api-token: $CF_API_KEY" -F "metadata=<$work/curse.json" -F "file=@$zip" \
        "https://wow.curseforge.com/api/projects/$curse_id/upload-file")"
    if [[ "$status" != "200" ]]; then
        echo "CurseForge refused the upload ($status): $(cat "$work/curse-result.json" 2>/dev/null)"
        return 1
    fi
    echo "Uploaded $name to CurseForge ($curse_type, game version $version_id)"
}

# Wago: its Forever patch is the Interface read as a version (16001: 1.60.1)
upload_to_wago() {
    local patch status
    patch="$(printf '%d.%d.%d' $((interface / 10000)) $((interface / 100 % 100)) $((interface % 100)))"
    if ! curl -sS --fail https://addons.wago.io/api/data/game |
        jq -e --arg patch "$patch" '.patches.forever | index($patch)' >/dev/null; then
        echo "Wago has no Forever patch $patch yet: not uploaded"
        return 1
    fi
    jq -n --arg name "$name" --arg patch "$patch" --arg stability "$wago_stability" --rawfile log "$changelog" \
        '{label: $name, supported_forever_patches: [$patch], stability: $stability, changelog: $log}' >"$work/wago.json"
    status="$(curl -sS --retry 3 --retry-delay 10 -o "$work/wago-result.json" -w '%{http_code}' \
        -H "authorization: Bearer $WAGO_API_TOKEN" -H "accept: application/json" \
        -F "metadata=<$work/wago.json" -F "file=@$zip" \
        "https://addons.wago.io/api/projects/$wago_id/version")"
    if [[ "$status" != "200" && "$status" != "201" ]]; then
        echo "Wago refused the upload ($status): $(cat "$work/wago-result.json" 2>/dev/null)"
        return 1
    fi
    echo "Uploaded $name to Wago ($wago_stability, patch $patch)"
}

case "$site" in
    curseforge)
        if [[ -z "${CF_API_KEY:-}" || -z "$curse_id" ]]; then
            echo "CurseForge: no token or no X-Curse-Project-ID: skipped"
        else
            upload_to_curseforge || failed=1
        fi
        ;;
    wago)
        if [[ -z "${WAGO_API_TOKEN:-}" || -z "$wago_id" ]]; then
            echo "Wago: no token or no X-Wago-ID: skipped"
        else
            upload_to_wago || failed=1
        fi
        ;;
    *)
        echo "Unknown site $site: curseforge or wago"
        failed=1
        ;;
esac
rm -rf "$work"
exit "$failed"
