// The collected data as text, to copy into a bug report. It holds no character name, realm or chat.

import type { SettingsService } from "../settings/settings.service";
import type { RecorderService } from "./recorder.service";

/** The counts grouped by probe: "probe\n  context -> result  xN". */
function buildProbeLines(counts: { [key: string]: number }): string[] {
    const probes: string[] = [];
    const byProbe = new LuaMap<string, string[]>();
    for (const [key, count] of pairs(counts)) {
        const [name, context, result] = string.match(key as string, "^(.-)\t(.-)\t(.*)$");
        if (name !== undefined) {
            let list = byProbe.get(name);
            if (!list) {
                list = [];
                byProbe.set(name, list);
                probes.push(name);
            }
            list.push(`  ${context} -> ${result}  x${count}`);
        }
    }
    probes.sort();
    const lines: string[] = [];
    for (const name of probes) {
        lines.push(name);
        lines.push(...(byProbe.get(name) ?? []).sort());
    }
    return lines;
}

/** The texts the client sent, sorted, under a heading; nothing when there are none. */
function buildTextLines(counts: { [text: string]: number }): string[] {
    const texts: string[] = [];
    for (const [key, count] of pairs(counts)) texts.push(`${key}  x${count}`);
    if (texts.length === 0) return [];
    texts.sort();
    return ["texts the client sent", ...texts.map((text) => `  ${text}`)];
}

export class ReportService {
    constructor(
        private readonly settings: SettingsService,
        private readonly recorder: RecorderService,
    ) {}

    buildReport(): string {
        const store = this.recorder.getStore();
        const info = store.info;
        const lines = [
            "Forever Reminders debug report",
            `client: ${info?.client ?? "?"} | addon: ${info?.addon ?? "?"} | ${info?.className ?? "?"} level ${info?.level ?? "?"}`,
            `samples: ${store.samples}, keys: ${store.keys}, dropped: ${store.dropped}`,
        ];
        const blockedAction = this.settings.get("blockedAction");
        if (blockedAction !== undefined) lines.push(`blocked action: ${blockedAction}`);
        lines.push(...buildProbeLines(store.counts), ...buildTextLines(store.texts));
        return lines.join("\n");
    }
}
