// Writes down what the game answered. The counts live in the saved settings (settings.debug), so
// they survive a /reload and a logout; ReportService turns them into text. Nothing is printed.

import type { SettingsService } from "../settings/settings.service";
import type { DebugStore } from "../settings/settings.interface";
import type { PlayerService } from "@forever/wow";
import { isReadable } from "@forever/wow";

/** Different probe results kept; a full store drops new ones (and debug mode starts over). */
const MAX_KEYS = 700;
const MAX_TEXTS = 150;

export class RecorderService {
    constructor(
        private readonly settings: SettingsService,
        private readonly player: PlayerService,
    ) {}

    getStore(): DebugStore {
        let store = this.settings.get("debug");
        if (store === undefined) {
            store = { counts: {}, texts: {}, keys: 0, textKeys: 0, dropped: 0, samples: 0 };
            this.settings.write("debug", store);
        }
        return store;
    }

    isStoreFull(): boolean {
        const store = this.settings.get("debug");
        return store !== undefined && store.keys >= MAX_KEYS;
    }

    clearDebugData(): void {
        this.settings.write("debug", undefined);
    }

    /** "combat" or "idle": the situation a sample was taken in. */
    getContext(): string {
        return this.player.isInCombat() ? "combat" : "idle";
    }

    /** "number", "SECRET number", "nil", "boolean=true": what kind of value came back. */
    describeKind(value: unknown): string {
        if (value === undefined) return "nil";
        const kind = type(value);
        if (issecretvalue(value)) return `SECRET ${kind}`;
        if (kind === "boolean") return `boolean=${tostring(value)}`;
        return kind;
    }

    /** Counts one result of a probe in a situation. */
    recordCount(probe: string, context: string, result: string): void {
        const store = this.getStore();
        const key = `${probe}\t${context}\t${result}`;
        if (store.counts[key] === undefined) {
            if (store.keys >= MAX_KEYS) {
                store.dropped += 1;
                return;
            }
            store.keys += 1;
            store.counts[key] = 0;
        }
        store.counts[key] += 1;
    }

    /** Counts a short text the client sent (an error message): the exact wording matters. */
    recordText(label: string, message: unknown): void {
        if (type(message) !== "string" || !isReadable(message)) return;
        const store = this.getStore();
        const key = `${label}: ${string.sub(message as string, 1, 80)}`;
        if (store.texts[key] === undefined) {
            if (store.textKeys >= MAX_TEXTS) return;
            store.textKeys += 1;
            store.texts[key] = 0;
        }
        store.texts[key] += 1;
    }

    /** Calls `read` (which returns `arity` values) and counts the kinds of values it returned. */
    recordProbe(name: string, context: string, arity: number, read: (this: void) => unknown[]): void {
        const [didSucceed, values] = pcall(read);
        let result: string;
        if (!didSucceed) {
            result = `ERROR ${string.sub(tostring(values), 1, 70)}`;
        } else {
            const parts: string[] = [];
            for (let i = 0; i < arity; i++) parts.push(this.describeKind((values as unknown[])[i]));
            result = parts.join(",");
        }
        this.recordCount(name, context, result);
    }
}
