import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const PACKAGE_JSON = `${ROOT}package.json`;
export const CACHE_DIR = `${ROOT}.cache/wow-ui-source`;
export const DOCS_DIR = `${CACHE_DIR}/Interface/AddOns/Blizzard_APIDocumentationGenerated`;
export const MANUAL_TYPES_DIR = `${ROOT}types`;
export const GENERATED_TYPES_DIR = `${MANUAL_TYPES_DIR}/generated`;
export const ADDON_DIR = `${ROOT}addon`;
export const DIST_DIR = `${ROOT}dist`;

export interface PackageJson {
    version: string;
    addon: { name: string };
    wowUiSource: { repository: string; branch: string; commit: string };
}

export function readPackageJson(): PackageJson {
    return JSON.parse(readFileSync(PACKAGE_JSON, "utf8")) as PackageJson;
}
