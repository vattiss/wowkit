// Asks the client about every spell and item ID written in @wowkit/wow-data, so a wrong or remapped ID shows. For a
// spell ID the client does not know it also looks for the real one: it goes through the spell IDs and lists the spells
// whose name has the rarest words of the name the code gives the ID ("Paladin.BlessingLight" -> blessing, light).
// The answers are saved in the saved variable, for scripts/generate-wow-data.ts to read.
import type { MessagesService } from "@wowkit/ui";
import type { BagsService, ClockService, SavedVariablesService, SpellsService } from "@wowkit/wow";
import { ITEMS, SPELLS } from "@wowkit/wow-data";

/**
 * What the client says of each ID the code uses: "Name|rank" for a spell (just "Name" without a rank), "Name" for an
 * item, "" when it does not know the ID. And, per unknown spell ID of the code, the spells that could be it ("id|Name|rank").
 */
interface CheckDb {
    checked: { spells: { [spellId: number]: string }; items: { [itemId: number]: string } };
    candidates: { [label: string]: string[] };
}

/** A spell ID of the code the client does not know: its label, the words of the name in it, and the ID. */
type UnknownSpell = [label: string, words: string[], spellId: number];

/** The client loads an item's name on the first ask; the check asks again after this many seconds. */
const ITEM_LOAD_SECONDS = 3;
/** The highest spell ID looked at when searching; Forever's own spells (Water Shield) are in the 400000s. */
const LAST_SPELL_ID = 500000;
/** IDs asked per frame while searching, so the game stays playable. */
const BATCH = 400;
/** At most this many candidates are kept per ID: the ones with the most words of its name. */
const MAX_CANDIDATES = 10;
/** Shorter words ("of", "the") are in too many spell names to tell anything. */
const MIN_WORD_LENGTH = 4;

export class IdCheckService {
    /** Every spell and item ID of wow-data, with the name it has there. */
    private readonly wantedSpells = this.listIds(SPELLS);
    private readonly wantedItems = this.listIds(ITEMS);
    private db: CheckDb = { checked: { spells: {}, items: {} }, candidates: {} };
    /** The spells found by the words of each unknown ID, while the search runs. */
    private matches: { [label: string]: { words: string[]; spellId: number; text: string }[] | undefined } = {};
    /** How many spells each word of an unknown ID is in, per label: a rare word says more than a common one. */
    private wordCounts: { [label: string]: { [word: string]: number } | undefined } = {};

    constructor(
        private readonly spells: SpellsService,
        private readonly bags: BagsService,
        private readonly clock: ClockService,
        private readonly messages: MessagesService,
        private readonly savedVariables: SavedVariablesService,
    ) {}

    onAddonLoaded(): void {
        const saved = this.savedVariables.loadTable<CheckDb>();
        this.db = { checked: saved?.checked ?? { spells: {}, items: {} }, candidates: saved?.candidates ?? {} };
        this.savedVariables.bindTable(this.db);
    }

    /** Asks the client about every spell and item ID of wow-data, says which it does not know, and looks for the real IDs. */
    checkIds(): void {
        const checked: CheckDb["checked"] = { spells: {}, items: {} };
        const unknownSpells: UnknownSpell[] = [];
        for (const [label, spellId] of this.wantedSpells) {
            const name = this.spells.getSpellName(spellId);
            const rank = this.spells.getSpellRank(spellId);
            checked.spells[spellId] = name === undefined ? "" : rank === undefined ? name : `${name}|${rank}`;
            if (name === undefined) unknownSpells.push([label, this.listLabelWords(label), spellId]);
        }
        // Asking for an item's name makes the client load it; the answer is there a moment later
        for (const [, itemId] of this.wantedItems) this.bags.getItemName(itemId);
        this.messages.say(
            `Checked ${this.wantedSpells.length} spell IDs; the ${this.wantedItems.length} items follow in ${ITEM_LOAD_SECONDS} seconds.`,
        );
        this.clock.runAfter(ITEM_LOAD_SECONDS, () => this.collectItemAnswers(checked, unknownSpells));
    }

    private collectItemAnswers(checked: CheckDb["checked"], unknownSpells: UnknownSpell[]): void {
        const unknownItems: string[] = [];
        for (const [label, itemId] of this.wantedItems) {
            const name = this.bags.getItemName(itemId);
            checked.items[itemId] = name ?? "";
            if (name === undefined) unknownItems.push(`${label} ${itemId}`);
        }
        this.db = { checked, candidates: {} };
        this.matches = {};
        this.wordCounts = {};
        this.savedVariables.bindTable(this.db);
        for (const [label, , spellId] of unknownSpells) this.messages.say(`NOT KNOWN TO THE CLIENT: ${label} ${spellId}`);
        for (const line of unknownItems) this.messages.say(`NOT KNOWN TO THE CLIENT: ${line}`);
        const unknownCount = unknownSpells.length + unknownItems.length;
        if (unknownSpells.length === 0)
            return this.messages.say(`${unknownCount} of the IDs are not known to the client. Type /reload to save the answers to disk.`);
        this.messages.say(
            `Looking for the real IDs of the ${unknownSpells.length} unknown spells by name: this takes a while, the game stays playable.`,
        );
        this.findCandidates(unknownSpells, 1);
    }

    /** Goes through the spell IDs a batch a frame, and keeps the spells whose name has all the words of an unknown ID's name. */
    private findCandidates(unknownSpells: UnknownSpell[], firstId: number): void {
        const lastId = math.min(firstId + BATCH - 1, LAST_SPELL_ID);
        for (let spellId = firstId; spellId <= lastId; spellId++) this.matchSpell(spellId, unknownSpells);
        if (lastId < LAST_SPELL_ID) return this.clock.runAfter(0, () => this.findCandidates(unknownSpells, lastId + 1));
        for (const [label] of unknownSpells) this.reportCandidates(label);
        this.messages.say("Type /reload to save the answers to disk.");
    }

    /** Keeps the best candidates of a label (the rarest words of its name first, then the lowest ID) and tells the player. */
    private reportCandidates(label: string): void {
        const counts = this.wordCounts[label] ?? {};
        const scored = (this.matches[label] ?? []).map((match) => {
            let score = 0;
            for (const word of match.words) score += 1 / (counts[word] ?? 1);
            return { score, spellId: match.spellId, text: match.text };
        });
        scored.sort((a, b) => b.score - a.score || a.spellId - b.spellId);
        const best = scored.slice(0, MAX_CANDIDATES).map((match) => match.text);
        this.db.candidates[label] = best;
        this.messages.say(best.length === 0 ? `${label}: no spell with a word of that name` : `${label}: ${best.join(", ")}`);
    }

    /** Notes the spell for every unknown ID whose name has at least one word of the spell's name. */
    private matchSpell(spellId: number, unknownSpells: UnknownSpell[]): void {
        const name = this.spells.getSpellName(spellId);
        if (name === undefined || name === "") return;
        const lower = string.lower(name);
        for (const [label, words] of unknownSpells) {
            const found = words.filter((word) => string.find(lower, word, 1, true)[0] !== undefined);
            if (found.length === 0) continue;
            const counts = this.wordCounts[label] ?? {};
            for (const word of found) counts[word] = (counts[word] ?? 0) + 1;
            this.wordCounts[label] = counts;
            const rank = this.spells.getSpellRank(spellId);
            const matches = this.matches[label] ?? [];
            matches.push({ words: found, spellId, text: rank === undefined ? `${spellId}|${name}` : `${spellId}|${name}|${rank}` });
            this.matches[label] = matches;
        }
    }

    /** Every ID of the category tables of wow-data, with the name it has there ("Paladin.BlessingMight", "Priest.PrayerOfFortitude[0]"). */
    private listIds(tables: { [category: string]: { [key: string]: number | number[] } }): [label: string, id: number][] {
        const ids: [string, number][] = [];
        for (const [category, entries] of pairs(tables)) {
            for (const [key, value] of pairs(entries)) {
                if (type(value) === "number") ids.push([`${category}.${key}`, value as number]);
                else (value as number[]).forEach((id, index) => ids.push([`${category}.${key}[${index}]`, id]));
            }
        }
        return ids;
    }

    /** The lowercase words of the name in a label: "Paladin.BlessingLight" -> blessing, light. */
    private listLabelWords(label: string): string[] {
        const [name] = string.match(label, "%.(%a+)");
        const words: string[] = [];
        for (const [word] of string.gmatch(name ?? "", "%u%l*")) {
            if (string.len(word as string) >= MIN_WORD_LENGTH) words.push(string.lower(word as string));
        }
        return words;
    }
}
