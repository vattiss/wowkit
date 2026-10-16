// Switching debug mode on and off. While it is on, a sample is taken every second and the events
// the game really sends are counted (see samples.ts and recorder.ts).
import { runEvery, type RepeatingTimer } from "../../wow/clock";
import { getClassToken } from "../../wow/player";
import { attempt, swallowedError } from "../../wow/safe";
import { settingChanged, settings } from "../../settings";
import { clearDebugData, describeKind, getContext, getStore, isStoreFull, recordCount, recordText } from "./recorder";
import { takeSample } from "./samples";

const SAMPLE_SECONDS = 1;

let addonName = "";
let timer: RepeatingTimer | undefined;
let eventFrame: Frame | undefined;

function onDebugEvent(event: WowEvent, ...payload: unknown[]): void {
    const context = getContext();
    if (event === "UNIT_SPELLCAST_SUCCEEDED") {
        recordCount(`event ${event} spellID`, context, describeKind(payload[2]));
    } else if (event === "UI_ERROR_MESSAGE") {
        recordCount(`event ${event} message`, context, describeKind(payload[1]));
        recordText("UI_ERROR_MESSAGE", payload[1]);
    } else {
        recordCount(`event ${event}`, context, "fired");
    }
}

/** Which client, addon version, class and level the report is about. */
function recordInfo(): void {
    const [version, build, , interfaceVersion] = GetBuildInfo();
    getStore().info = {
        client: `${version} (build ${build}, interface ${interfaceVersion})`,
        addon: tostring(attempt(C_AddOns.GetAddOnMetadata, addonName, "Version")),
        className: tostring(getClassToken()),
        level: tostring(UnitLevel("player")),
    };
}

/** Starts or stops collecting, following settings.isDebugMode. */
export function applyDebugMode(): void {
    if (settings.isDebugMode) {
        // A full store drops every new key: start over, the old data is stale
        if (isStoreFull()) clearDebugData();
        recordInfo();
        if (!eventFrame) {
            eventFrame = CreateFrame("Frame");
            eventFrame.SetScript("OnEvent", (_frame, event, ...payload) => onDebugEvent(event, ...payload));
        }
        eventFrame.RegisterUnitEvent("UNIT_SPELLCAST_SUCCEEDED", "player");
        eventFrame.RegisterEvent("WEAPON_ENCHANT_CHANGED");
        eventFrame.RegisterEvent("UI_ERROR_MESSAGE");
        timer ??= runEvery(SAMPLE_SECONDS, () => attempt(takeSample));
    } else {
        eventFrame?.UnregisterAllEvents();
        timer?.stop();
        timer = undefined;
    }
}

/** Call once with this addon's folder name. */
export function initDebug(name: string): void {
    addonName = name;
    settingChanged.listen((key) => {
        if (key === "isDebugMode") applyDebugMode();
    });
    // Errors the addon swallowed on purpose: counted, so our own bugs do not stay hidden
    swallowedError.listen((message) => {
        if (settings.isDebugMode) recordText("swallowed error", message);
    });
}
