// The client's options (CVars), the talents, the stable, and the curves the client evaluates over hidden values.
import type { ClientState } from "./client-state";
import { defineNamespace, defineValues, fake } from "./define";
import { createInertObject } from "./frames";

/** A linear curve through its points, like the client's LuaCurveObject (its methods are called with the object: method syntax). */
function createCurve(): LuaCurveObject {
    const points: [x: number, y: number][] = [];
    return fake<LuaCurveObject>({
        SetType() {
            return undefined;
        },
        AddPoint(x: number, y: number) {
            points.push([x, y]);
            points.sort((a, b) => a[0] - b[0]);
        },
        Evaluate(x: number) {
            if (points.length === 0) return 0;
            if (x <= points[0]![0]) return points[0]![1];
            for (let i = 1; i < points.length; i++) {
                const [x1, y1] = points[i]!;
                const [x0, y0] = points[i - 1]!;
                if (x <= x1) return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
            }
            return points[points.length - 1]![1];
        },
    });
}

/** The windows of the Cooldown Manager: the icons of the tracked buffs are in the first buff window, an icon's cooldown ID is its spell's. */
function installCooldownViewers(state: ClientState): void {
    // The addon's table goes through the encoding as it is
    let written: { [field: number]: unknown } | undefined;
    defineNamespace<typeof C_EncodingUtil>("C_EncodingUtil", {
        DecodeBase64: (source) => source,
        EncodeBase64: (source) => source,
        DecompressString: (source) => source,
        CompressString: (source) => source,
        DeserializeCBOR: () => state.layoutData,
        SerializeCBOR: (value) => {
            written = value as { [field: number]: unknown };
            return "saved";
        },
    });
    defineNamespace<typeof C_UI>("C_UI", {
        Reload: () => {
            state.reloads += 1;
        },
    });
    defineNamespace<typeof C_EditMode>("C_EditMode", {
        GetLayouts: () => state.editModeLayouts,
        SaveLayouts: (saved) => {
            state.editModeLayouts = saved;
            state.editModeSaves += 1;
        },
    });
    defineNamespace<typeof C_CooldownViewer>("C_CooldownViewer", {
        GetCooldownViewerCooldownInfo: (cooldownID) => {
            const isHidden = state.buffCatalog.find((buff) => buff.spellId === cooldownID)?.isHiddenByDefault === true;
            return fake<CooldownViewerCooldown>({
                cooldownID,
                spellID: cooldownID,
                flags: (isHidden ? 2 : 0) as Enum.CooldownSetSpellFlags,
                linkedSpellIDs: state.linkedSpells[cooldownID] ?? [],
                selfAura: state.trackedBuffs.find((buff) => buff.spellId === cooldownID)?.isOwnBuff === true,
            });
        },
        GetGroupBuffItems: () => [],
        GetLayoutData: () => (state.layoutData === undefined ? "" : "1|saved"),
        SetLayoutData: () => {
            state.layoutData = written;
            state.viewerSaves += 1;
        },
        GetCooldownViewerCategorySet: (category) =>
            state.buffCatalog.filter((buff) => (buff.isInSpellsTab === true ? category === 1 : category === 2)).map((buff) => buff.spellId),
    });
    /** The icon of a buff: the same frame each time, as the window's are. */
    const icons = new LuaMap<object, Record<string, unknown>>();
    const findIcon = (buff: ClientState["trackedBuffs"][number], isInSpells: boolean) => {
        const icon = icons.get(buff) ?? createInertObject<Record<string, unknown>>();
        icons.set(buff, icon);
        icon.cooldownID = buff.spellId;
        icon.auraInstanceID = isInSpells && buff.isActive ? 1 : undefined;
        icon.auraDataUnit = buff.unit;
        icon.IsActive = (_self: unknown) => (isInSpells ? true : buff.isActive);
        icon.isOnActualCooldown = buff.isOnCooldown;
        icon.IsVisible = (_self: unknown) => buff.isDrawn !== false;
        icon.GetFrameLevel = (_self: unknown) => 1;
        icon.SetAlpha = (_self: unknown, alpha: number) => {
            buff.iconAlpha = alpha;
        };
        return icon;
    };
    const createViewer = (name: string, kind: "none" | "buffs" | "spells") => ({
        SetAlpha(alpha: number) {
            state.viewerAlpha = alpha;
            state.windowAlphas[name] = alpha;
        },
        IsVisible() {
            return !state.hiddenViewers.includes(name);
        },
        itemFramePool: {
            EnumerateActive() {
                let index = 0;
                const buffs = state.trackedBuffs.filter((buff) => kind !== "none" && (buff.isInSpellsTab === true) === (kind === "spells"));
                return () => {
                    const buff = buffs[index];
                    index += 1;
                    if (buff === undefined) return undefined;
                    return findIcon(buff, kind === "spells");
                };
            },
        },
    });
    const provider = {
        GetLayoutManager() {
            return state.isViewerDataLoaded ? {} : false;
        },
    };
    defineValues({
        CooldownViewerUtil: { GetCurrentClassAndSpecTag: () => state.viewerLayout },
        CooldownViewerSettings: {
            GetDataProvider() {
                return provider;
            },
            IsShown: () => state.isViewerSettingsShown,
            Show: () => {
                state.isViewerSettingsShown = true;
            },
            Hide: () => {
                state.isViewerSettingsShown = false;
            },
        },
        EssentialCooldownViewer: createViewer("EssentialCooldownViewer", "none"),
        UtilityCooldownViewer: createViewer("UtilityCooldownViewer", "spells"),
        BuffIconCooldownViewer: createViewer("BuffIconCooldownViewer", "buffs"),
        BuffBarCooldownViewer: createViewer("BuffBarCooldownViewer", "none"),
        EditModePresetLayoutManager: {
            GetCopyOfPresetLayouts: () => [
                fake<EditModeLayoutInfo>({ layoutName: "Modern", layoutType: Enum.EditModeLayoutType.Preset, systems: [] }),
                fake<EditModeLayoutInfo>({ layoutName: "Classic", layoutType: Enum.EditModeLayoutType.Preset, systems: [] }),
            ],
        },
    });
}

export function installCurves(state: ClientState): void {
    defineNamespace<typeof C_CurveUtil>("C_CurveUtil", { CreateCurve: createCurve });
    defineNamespace<typeof C_CVar>("C_CVar", {
        GetCVarBool: (name) => state.cvars[name] === true,
        SetCVar: (name, value) => {
            state.cvars[name] = value === "1";
            return true;
        },
    });
    installCooldownViewers(state);
    // No talents spent (a low level character): the role stays as picked
    defineNamespace<typeof C_SpecializationInfo>("C_SpecializationInfo", {
        GetSpecializationInfo: () => $multi(0, undefined, undefined, undefined, undefined, undefined, 0, undefined, 0, false),
    });
    // A hunter has a pet in stable slot 1 when the test gave one
    defineNamespace<typeof C_StableInfo>("C_StableInfo", {
        GetStablePetInfo: () => (state.pet !== undefined ? fake<PetInfo>({}) : undefined),
    });
}
