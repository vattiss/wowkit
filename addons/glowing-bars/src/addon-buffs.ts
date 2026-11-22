// Putting the addon together, the stage of the buffs (see addon.ts): a file of its own, as addon.ts is full.
import type { Addon } from "@wowkit/core";
import type { Texts } from "./addon";
import type { Game } from "./game-services";
import { BouncedBuffsService } from "./character/bounced-buffs.service";
import { BuffMemorySaveService } from "./character/buff-memory-save.service";
import { BuffMemoryService } from "./character/buff-memory.service";
import { BuffStateService } from "./character/buff-state.service";
import { HiddenBuffsService } from "./character/hidden-buffs.service";
import { IdleService } from "./character/idle.service";
import { BuffKnowledgeService } from "./knowledge/buff-knowledge.service";
import { ClassBuffsService } from "./reminders/class-buffs.service";

/** What the addon knows about the player's buffs. */
export function makeBuffs(addon: Addon, game: Game, texts: Texts) {
    const idle = addon.register(new IdleService(game.player));
    const classBuffs = addon.register(new ClassBuffsService(game.player, game.spells, texts.settings));
    const knowledge = addon.register(new BuffKnowledgeService(classBuffs, game.spells));
    const memory = addon.register(new BuffMemoryService(game.spells, game.clock, knowledge));
    const hidden = addon.register(new HiddenBuffsService(game.auraSecrecy, texts.settings, texts.locale, texts.messages));
    memory.useLearnedDurations((key) => hidden.findLearnedSeconds(key));
    const state = addon.register(
        new BuffStateService(game.auras, game.spells, game.player, memory, knowledge, game.cooldownViewer, hidden),
    );
    addon.register(new BuffMemorySaveService(memory, state, texts.settings, game.clock));
    const bounced = addon.register(new BouncedBuffsService(game.auras, game.spells, game.player));
    return { idle, classBuffs, state, bounced };
}
export type Buffs = ReturnType<typeof makeBuffs>;
