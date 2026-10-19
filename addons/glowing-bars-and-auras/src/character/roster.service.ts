// Party members who are missing the player's buffs: the roster changed, read the party again.
import { OnGameEvent } from "@wowkit/core";
import type { PartyBuffsService } from "../reminders/party-buffs.service";
import type { RefreshService } from "../tick/refresh.service";

export class RosterService {
    constructor(
        private readonly refresh: RefreshService,
        private readonly partyBuffs: PartyBuffsService,
    ) {}

    @OnGameEvent("GROUP_ROSTER_UPDATE")
    updateParty(): void {
        this.partyBuffs.refreshPartyBuffs();
        this.refresh.requestTick();
    }
}
