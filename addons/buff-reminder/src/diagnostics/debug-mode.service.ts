// Switching debug mode on and off. While it is on, a sample is taken every second and the events
// the game really sends are counted (see samples.service.ts and recorder.service.ts).
import { OnEvent, type OnFirstLogin } from "@wowkit/framework";
import type { AddonSettingsService } from "../settings/settings.interface";
import { type ClockService, type RepeatingTimer, type PlayerService, attempt, listenToSwallowedErrors } from "@wowkit/wow";
import type { RecorderService } from "./recorder.service";
import type { SamplesService } from "./samples.service";

const SAMPLE_SECONDS = 1;

export class DebugModeService implements OnFirstLogin {
    private timer: RepeatingTimer | undefined;
    private eventFrame: Frame | undefined;

    constructor(
        private readonly addonName: string,
        private readonly settings: AddonSettingsService,
        private readonly clock: ClockService,
        private readonly player: PlayerService,
        private readonly recorder: RecorderService,
        private readonly samples: SamplesService,
    ) {
        // Errors the addon swallowed on purpose: counted, so our own bugs do not stay hidden
        listenToSwallowedErrors((message) => {
            if (this.settings.get("isDebugMode")) this.recorder.recordText("swallowed error", message);
        });
    }

    onFirstLogin(): void {
        this.applyDebugMode();
    }

    @OnEvent("setting.changed")
    noteSettingChange(key: string): void {
        if (key === "isDebugMode") this.applyDebugMode();
    }

    /** Starts or stops collecting, following the isDebugMode setting. */
    applyDebugMode(): void {
        if (this.settings.get("isDebugMode")) {
            // A full store drops every new key: start over, the old data is stale
            if (this.recorder.isStoreFull()) this.recorder.clearDebugData();
            this.recordInfo();
            if (!this.eventFrame) {
                this.eventFrame = CreateFrame("Frame");
                this.eventFrame.SetScript("OnEvent", (_frame, event, ...payload) => this.recordEvent(event, ...payload));
            }
            this.eventFrame.RegisterUnitEvent("UNIT_SPELLCAST_SUCCEEDED", "player");
            this.eventFrame.RegisterEvent("WEAPON_ENCHANT_CHANGED");
            this.eventFrame.RegisterEvent("UI_ERROR_MESSAGE");
            this.timer ??= this.clock.runEvery(SAMPLE_SECONDS, () => attempt(() => this.samples.takeSample()));
        } else {
            this.eventFrame?.UnregisterAllEvents();
            this.timer?.stop();
            this.timer = undefined;
        }
    }

    private recordEvent(event: WowEvent, ...payload: unknown[]): void {
        const context = this.recorder.getContext();
        if (event === "UNIT_SPELLCAST_SUCCEEDED") {
            this.recorder.recordCount(`event ${event} spellID`, context, this.recorder.describeKind(payload[2]));
        } else if (event === "UI_ERROR_MESSAGE") {
            this.recorder.recordCount(`event ${event} message`, context, this.recorder.describeKind(payload[1]));
            this.recorder.recordText("UI_ERROR_MESSAGE", payload[1]);
        } else {
            this.recorder.recordCount(`event ${event}`, context, "fired");
        }
    }

    /** Which client, addon version, class and level the report is about. */
    private recordInfo(): void {
        const [version, build, , interfaceVersion] = GetBuildInfo();
        this.recorder.getStore().info = {
            client: `${version} (build ${build}, interface ${interfaceVersion})`,
            addon: tostring(attempt(C_AddOns.GetAddOnMetadata, this.addonName, "Version")),
            className: tostring(this.player.getClassToken()),
            level: tostring(UnitLevel("player")),
        };
    }
}
