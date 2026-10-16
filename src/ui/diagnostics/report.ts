// The collected data as text, to copy into a bug report. It holds no character name, realm or chat.
import { settings } from "../../settings";
import { getStore } from "./recorder";

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

export function buildReport(): string {
    const store = getStore();
    const info = store.info;
    const lines = [
        "Forever Reminders debug report",
        `client: ${info?.client ?? "?"} | addon: ${info?.addon ?? "?"} | ${info?.className ?? "?"} level ${info?.level ?? "?"}`,
        `samples: ${store.samples}, keys: ${store.keys}, dropped: ${store.dropped}`,
    ];
    if (settings.blockedAction !== undefined) lines.push(`blocked action: ${settings.blockedAction}`);
    lines.push(...buildProbeLines(store.counts));

    const texts: string[] = [];
    for (const [key, count] of pairs(store.texts)) texts.push(`${key}  x${count}`);
    texts.sort();
    if (texts.length > 0) {
        lines.push("texts the client sent");
        for (const text of texts) lines.push(`  ${text}`);
    }
    return lines.join("\n");
}
