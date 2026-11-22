// The buff memory through a /reload: in a dungeon the game keeps some buffs secret, and what was seen of them before (when
// one runs out, that a blessing is up) is all there is to go by; a reload would forget it until the game shows them again.
// So it is saved as the addon logs out, and taken back as the player enters the world again, after a reload only: GetTime
// counts on through one, as do the buffs. After a login it is dropped: the buffs' times stood still while the player was
// away, and anything else may have happened to them.
import { OnGameEvent, type OnLogout } from "@wowkit/core";
import type { ClockService } from "@wowkit/wow";
import type { AddonSettingsService } from "../settings/settings.interface";
import type { BuffMemoryService } from "./buff-memory.service";
import { isSavedBuffMemory } from "./buff-memory.snapshot";
import type { BuffStateService } from "./buff-state.service";

/** A save older than this is not taken back, a reload or not. */
const RELOAD_SECONDS = 300;

export class BuffMemorySaveService implements OnLogout {
    constructor(
        private readonly memory: BuffMemoryService,
        private readonly buffState: BuffStateService,
        private readonly settings: AddonSettingsService,
        private readonly clock: ClockService,
    ) {}

    /** Entering the world after a reload, the game says so (a zone after it says not): the memory comes back. */
    @OnGameEvent("PLAYER_ENTERING_WORLD")
    restoreAfterReload(...[, isReloadingUi]: [isInitialLogin: boolean, isReloadingUi: boolean]): void {
        const saved = this.settings.get("buffMemory");
        if (isReloadingUi !== true || !isSavedBuffMemory(saved)) return;
        const age = this.clock.getCurrentTime() - saved.savedAt;
        if (age < 0 || age > RELOAD_SECONDS) return;
        this.memory.restoreSnapshot(saved.memory);
        this.buffState.restorePerCasterVerdicts(saved.perCasterVerdicts);
    }

    onLogout(): void {
        this.settings.change("buffMemory", {
            savedAt: this.clock.getCurrentTime(),
            memory: this.memory.buildSnapshot(),
            perCasterVerdicts: this.buffState.buildPerCasterVerdicts(),
        });
    }
}
