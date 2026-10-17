// Generates TypeScript declarations (types/generated/*.d.ts) from Blizzard's API documentation
// (Interface/AddOns/Blizzard_APIDocumentationGenerated in Gethe/wow-ui-source, "forever" branch).
// Run "npm run fetch:wow-ui" first, then "npm run gen:types".
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { CACHE_DIR, DOCS_DIR, GENERATED_TYPES_DIR, MANUAL_TYPES_DIR, readPackageJson } from "./lib/paths.ts";
import { parseDocumentationFile } from "./lib/lua-table.ts";

// ---------------------------------------------------------------------------------------------
// Documentation shapes (only the keys we use)

interface DocField {
    Name: string;
    Type: string;
    Nilable?: boolean;
    InnerType?: string;
    KeyType?: string;
    Mixin?: string;
    Default?: unknown;
    StrideIndex?: number;
    EnumValue?: number;
    Value?: unknown;
    Documentation?: string[];
}

interface DocFunction {
    Name: string;
    Arguments?: DocField[];
    Returns?: DocField[];
    Documentation?: string[];
    HasRestrictions?: boolean;
    IsProtectedFunction?: boolean;
    MayReturnNothing?: boolean;
}

interface DocEvent {
    Name: string;
    LiteralName: string;
    Payload?: DocField[];
    Documentation?: string[];
    SynchronousEvent?: boolean;
    UniqueEvent?: boolean;
}

interface DocTable {
    Name: string;
    Type: string;
    Fields?: DocField[];
    Values?: DocField[];
    Arguments?: DocField[];
    Documentation?: string[];
}

interface DocSystem {
    Name: string;
    Type: "System" | "ScriptObject";
    Namespace?: string;
    Environment?: string;
    Functions?: DocFunction[];
    Events?: DocEvent[];
    Tables?: DocTable[];
    Documentation?: string[];
}

// ---------------------------------------------------------------------------------------------
// Hand-maintained knowledge the documentation does not contain

/** Documentation type names that map to TypeScript types directly. */
const PRIMITIVES: Record<string, string> = {
    bool: "boolean",
    number: "number",
    string: "string",
    cstring: "string",
    luaIndex: "number",
    table: "LuaTable",
    LuaValueVariant: "any",
    LuaValueReference: "any",
    LuaFunctionReference: "WowCallback",
    luaFunction: "WowCallback",
    function: "WowCallback",
    userdata: "any",
    any: "any",
    stringView: "string",
    kstringAuroraName: "string",
    kstringClubMessage: "string",
    KStringDiscordUserName: "string",
    kstringLfgListApplicant: "string",
    kstringLfgListChat: "string",
    kstringLfgListSearch: "string",
    WOWGUID: "string",
    WOWMONEY: "number",
    BigInteger: "number",
    BigUInteger: "number",
    fileID: "number",
    textureAtlas: "string",
    textureKit: "string",
    FileAsset: "string | number",
    TextureAsset: "string | number",
    TextureAssetDisk: "string | number",
    ModelAsset: "string | number",
    FontAsset: "string | number",
    time_t: "number",
    Seconds: "number",
    Milliseconds: "number",
    FrameTime: "number",
    normalizedValue: "number",
    SingleColorValue: "number",
    size: "number",
    uiFontHeight: "number",
    SoundHandle: "number",
    LuaInventorySlot: "number",
    ClubId: "string",
    ClubInvitationId: "string",
    ClubMemberOpaqueId: "string",
    ClubStreamId: "string",
    CalendarEventID: "string",
    SpellIdentifier: "number | string",
    IDOrLink: "number | string",
    uiAddon: "number | string",
    ScriptTypeName: "string",
    SendChatMessageType: "string",
    mouseButton: "MouseButton",
    ClickButton: "MouseButton",
    uiUnit: "number",
    UnitTokenVariant: "UnitToken",
    UnitTokenNamePlate: "UnitToken",
    UnitTokenRestrictedForAddOns: "UnitToken",
    UnitTokenPvPRestrictedForAddOns: "UnitToken",
};

/** Documentation names for widget types that differ from the widget's own name. */
const WIDGET_ALIASES: Record<string, string> = {
    CScriptObject: "FrameScriptObject",
    CooldownFrame: "Cooldown",
    ModelSceneFrame: "ModelScene",
    ModelSceneFrameActor: "ModelSceneActor",
    NamePlateFrame: "NamePlate",
    Tooltip: "GameTooltip",
    SimplePathAnim: "PathAnimation",
    DurationTextBinding: "DurationTextBindingObject",
    LuaDurationClock: "LuaDurationClockObject",
};

/**
 * Widget (ScriptObject) hierarchy. Each widget is an interface that extends its bases and adds
 * the methods of the listed documentation systems. The first listed system also names the
 * widget in the docs: "SimpleTextureAPI" means the docs refer to Texture as "SimpleTexture".
 */
const WIDGETS: [name: string, bases: string[], systems: string[]][] = [
    ["FrameScriptObject", [], ["SimpleFrameScriptObjectAPI"]],
    ["UIObject", ["FrameScriptObject"], ["SimpleObjectAPI"]],
    ["ScriptRegion", ["UIObject"], ["SimpleScriptRegionAPI", "SimpleScriptRegionResizingAPI", "SimpleAnimatableObjectAPI"]],
    ["Region", ["ScriptRegion"], ["SimpleRegionAPI"]],
    ["TextureBase", ["Region"], ["SimpleTextureBaseAPI"]],
    ["Texture", ["TextureBase"], ["SimpleTextureAPI"]],
    ["MaskTexture", ["TextureBase"], ["SimpleMaskTextureAPI"]],
    ["Line", ["TextureBase"], ["SimpleLineAPI"]],
    ["FontString", ["Region"], ["SimpleFontStringAPI"]],
    ["VectorGraphics", ["Region"], ["SimpleVectorGraphicsAPI"]],
    ["Font", ["FrameScriptObject"], ["SimpleFontAPI"]],
    ["Frame", ["ScriptRegion"], ["SimpleFrameAPI"]],
    ["Button", ["Frame"], ["SimpleButtonAPI"]],
    ["CheckButton", ["Button"], ["SimpleCheckboxAPI"]],
    ["EditBox", ["Frame"], ["SimpleEditBoxAPI"]],
    ["ScrollFrame", ["Frame"], ["SimpleScrollFrameAPI"]],
    ["Slider", ["Frame"], ["SimpleSliderAPI"]],
    ["StatusBar", ["Frame"], ["SimpleStatusBarAPI"]],
    ["ColorSelect", ["Frame"], ["SimpleColorSelectAPI"]],
    ["MessageFrame", ["Frame"], ["SimpleMessageFrameAPI"]],
    ["SimpleHTML", ["Frame"], ["SimpleHTMLAPI"]],
    ["Browser", ["Frame"], ["SimpleBrowserAPI"]],
    ["MovieFrame", ["Frame"], ["SimpleMovieAPI"]],
    ["OffScreenFrame", ["Frame"], ["SimpleOffScreenFrameAPI"]],
    ["MapScene", ["Frame"], ["SimpleMapSceneAPI"]],
    ["Model", ["Frame"], ["SimpleModelAPI"]],
    ["ModelFFX", ["Model"], ["SimpleModelFFXAPI"]],
    ["PlayerModel", ["Model"], ["FrameAPICharacterModelBase"]],
    ["CinematicModel", ["PlayerModel"], ["FrameAPICinematicModel"]],
    ["DressUpModel", ["PlayerModel"], ["FrameAPIDressUpModel"]],
    ["TabardModelBase", ["PlayerModel"], ["FrameAPITabardModelBase"]],
    ["TabardModel", ["TabardModelBase"], ["FrameAPITabardModel"]],
    ["ModelScene", ["Frame"], ["FrameAPIModelSceneFrame"]],
    ["ModelSceneActorBase", ["UIObject"], ["FrameAPIModelSceneFrameActorBase"]],
    ["ModelSceneActor", ["ModelSceneActorBase"], ["FrameAPIModelSceneFrameActor"]],
    ["Cooldown", ["Frame"], ["FrameAPICooldown"]],
    ["GameTooltip", ["Frame"], ["FrameAPITooltip"]],
    ["Minimap", ["Frame"], ["MinimapFrameAPI"]],
    ["ArchaeologyDigSiteFrame", ["Frame"], ["FrameAPIArchaeologyDigSiteFrame"]],
    ["FogOfWarFrame", ["Frame"], ["FrameAPIFogOfWarFrame"]],
    ["Blob", ["Frame"], ["FrameAPIBlob"]],
    ["QuestPOIFrame", ["Blob"], ["FrameAPIQuestPOI"]],
    ["ScenarioPOIFrame", ["Blob"], ["FrameAPIScenarioPOI"]],
    ["UnitPositionFrame", ["Frame"], ["FrameAPIUnitPositionFrame"]],
    ["NamePlate", ["Frame"], ["FrameAPINamePlate"]],
    ["Checkout", ["Frame"], ["FrameAPISimpleCheckout"]],
    ["PingPinFrame", ["Frame"], ["PingPinFrameAPI"]],
    ["HousingFixturePointFrame", ["Frame"], ["HousingFixturePointFrameAPI"]],
    ["HousingLayoutPinFrame", ["Frame"], ["HousingLayoutPinFrameAPI"]],
    ["AnimationGroup", ["UIObject"], ["SimpleAnimGroupAPI"]],
    ["Animation", ["UIObject"], ["SimpleAnimAPI"]],
    ["AlphaAnimation", ["Animation"], ["SimpleAnimAlphaAPI"]],
    ["FlipBookAnimation", ["Animation"], ["SimpleAnimFlipBookAPI"]],
    ["PathAnimation", ["Animation"], ["SimpleAnimPathAPI"]],
    ["RadialProgressAnimation", ["Animation"], ["SimpleAnimRadialProgressAPI"]],
    ["RotationAnimation", ["Animation"], ["SimpleAnimRotationAPI"]],
    ["ScaleAnimation", ["Animation"], ["SimpleAnimScaleAPI"]],
    ["LineScaleAnimation", ["Animation"], ["SimpleAnimScaleLineAPI"]],
    ["TextureCoordTranslationAnimation", ["Animation"], ["SimpleAnimTextureCoordTranslationAPI"]],
    ["TranslationAnimation", ["Animation"], ["SimpleAnimTranslationAPI"]],
    ["LineTranslationAnimation", ["Animation"], ["SimpleAnimTranslationLineAPI"]],
    ["VertexColorAnimation", ["Animation"], ["SimpleAnimVertexColorAPI"]],
    ["ControlPoint", ["UIObject"], ["SimpleControlPointAPI"]],
    ["LuaCurveObjectBase", [], ["LuaCurveObjectBaseAPI"]],
    ["LuaCurveObject", ["LuaCurveObjectBase"], ["LuaCurveObjectAPI"]],
    ["LuaColorCurveObject", ["LuaCurveObjectBase"], ["LuaColorCurveObjectAPI"]],
];

/** Signatures where the documentation is wrong, keyed by "Namespace.Function" (or plain name for globals). */
const SIGNATURE_OVERRIDES: Record<string, string> = {
    // The docs claim these return their callback; they return a cancellable handle
    "C_Timer.NewTicker": "(seconds: number, callback: (this: void, ticker: TimerHandle) => void, iterations?: number): TimerHandle",
    "C_Timer.NewTimer": "(seconds: number, callback: (this: void, timer: TimerHandle) => void): TimerHandle",
};

/** Methods left out of the generated widgets because types/wow-manual.d.ts declares typed versions. */
const MANUAL_METHODS: Record<string, string[]> = {
    SimpleScriptRegionAPI: ["SetScript", "HookScript", "GetScript"],
};

// ---------------------------------------------------------------------------------------------
// Load the documentation

if (!existsSync(DOCS_DIR)) {
    console.error(`Missing ${DOCS_DIR}\nRun "npm run fetch:wow-ui" first.`);
    process.exit(1);
}

const systems: DocSystem[] = [];
for (const file of readdirSync(DOCS_DIR).filter((f) => f.endsWith(".lua")).sort()) {
    try {
        systems.push(parseDocumentationFile(readFileSync(`${DOCS_DIR}/${file}`, "utf8")) as unknown as DocSystem);
    } catch (error) {
        throw new Error(`${file}: ${(error as Error).message}`, { cause: error });
    }
}

const enums = new Map<string, DocTable>();
const structures = new Map<string, DocTable>();
const callbacks = new Map<string, DocTable>();
const constants = new Map<string, DocTable>();
const events = new Map<string, DocEvent>();
const duplicates: string[] = [];

function register(map: Map<string, DocTable>, table: DocTable): void {
    if (map.has(table.Name)) duplicates.push(`${table.Type} ${table.Name}`);
    else map.set(table.Name, table);
}

for (const system of systems) {
    for (const table of system.Tables ?? []) {
        if (table.Type === "Enumeration") register(enums, table);
        else if (table.Type === "Structure") register(structures, table);
        else if (table.Type === "CallbackType") register(callbacks, table);
        else if (table.Type === "Constants") register(constants, table);
        // Precondition / Secret tables describe engine-side checks and have no Lua surface
    }
    for (const event of system.Events ?? []) {
        if (events.has(event.LiteralName)) duplicates.push(`Event ${event.LiteralName}`);
        else events.set(event.LiteralName, event);
    }
}

const systemsByName = new Map(systems.filter((s) => s.Type === "ScriptObject").map((s) => [s.Name, s]));
const widgetNames = new Set<string>();
const widgetAliases = new Map<string, string>();
for (const [name, , systemNames] of WIDGETS) {
    widgetNames.add(name);
    widgetAliases.set(systemNames[0]!.replace(/API$/, ""), name);
    for (const systemName of systemNames) {
        if (!systemsByName.has(systemName)) throw new Error(`Widget ${name}: unknown ScriptObject system ${systemName}`);
    }
}
const mappedSystems = new Set(WIDGETS.flatMap(([, , systemNames]) => systemNames));
// ScriptObjects outside the widget hierarchy (formatters, clocks, ...) become standalone interfaces
const standaloneObjects = [...systemsByName.values()].filter((s) => !mappedSystems.has(s.Name));
for (const system of standaloneObjects) {
    const name = system.Name.replace(/API$/, "");
    widgetNames.add(name);
    widgetAliases.set(name, name);
}
for (const [alias, name] of Object.entries(WIDGET_ALIASES)) widgetAliases.set(alias, name);

// Types declared by hand in types/*.d.ts (e.g. FramePoint, ColorMixin) count as resolved
const manualTypes = new Set(
    readdirSync(MANUAL_TYPES_DIR)
        .filter((f) => f.endsWith(".d.ts"))
        .flatMap((f) => [...readFileSync(`${MANUAL_TYPES_DIR}/${f}`, "utf8").matchAll(/^(?:declare )?(?:type|interface) (\w+)/gm)])
        .map((m) => m[1]!),
);

// ---------------------------------------------------------------------------------------------
// Type rendering

const unresolved = new Map<string, number>();

function resolveTypeName(name: string): string {
    const primitive = PRIMITIVES[name];
    if (primitive) return primitive;
    if (enums.has(name)) return `Enum.${name}`;
    if (structures.has(name) || callbacks.has(name) || widgetNames.has(name) || manualTypes.has(name)) return name;
    const widget = widgetAliases.get(name);
    if (widget) return widget;
    unresolved.set(name, (unresolved.get(name) ?? 0) + 1);
    return name;
}

function fieldType(field: DocField): string {
    if (field.Mixin) return resolveTypeName(field.Mixin);
    if (field.Type === "table" && field.InnerType) {
        const inner = resolveTypeName(field.InnerType);
        if (field.KeyType) return `LuaTable<${resolveTypeName(field.KeyType)}, ${inner}>`;
        return /^[\w.]+$/.test(inner) ? `${inner}[]` : `(${inner})[]`;
    }
    return resolveTypeName(field.Type);
}

function nilable(type: string, isNilable: boolean | undefined): string {
    return isNilable ? `${type} | undefined` : type;
}

const RESERVED = new Set(
    ("break case catch class const continue debugger default delete do else enum export extends false finally for " +
        "function if import in instanceof new null return super switch this throw true try typeof var void while with " +
        "implements interface let package private protected public static yield arguments eval").split(" "),
);

function identifier(name: string): string {
    return RESERVED.has(name) ? `${name}_` : name;
}

function propertyKey(name: string): string {
    return /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
}

function parameters(args: DocField[] = []): string {
    const strided = args.filter((a) => a.StrideIndex !== undefined);
    const plain = args.filter((a) => a.StrideIndex === undefined);
    // An argument may only be optional (`?`) when every argument after it is optional too
    let optionalFrom = plain.length;
    while (optionalFrom > 0 && (plain[optionalFrom - 1]!.Nilable || plain[optionalFrom - 1]!.Default !== undefined)) {
        optionalFrom--;
    }
    const rendered = plain.map((arg, i) =>
        i >= optionalFrom ? `${identifier(arg.Name)}?: ${fieldType(arg)}` : `${identifier(arg.Name)}: ${nilable(fieldType(arg), arg.Nilable)}`,
    );
    if (strided.length > 0) {
        const types = [...new Set(strided.map((a) => nilable(fieldType(a), a.Nilable)))].join(" | ");
        rendered.push(`...${identifier(strided[0]!.Name)}: (${types})[]`);
    }
    return rendered.join(", ");
}

function returnType(fn: DocFunction): string {
    const returns = fn.Returns ?? [];
    const strided = returns.filter((r) => r.StrideIndex !== undefined);
    const plain = returns.filter((r) => r.StrideIndex === undefined);
    if (strided.length === 0 && plain.length === 0) return "void";
    if (strided.length === 0 && plain.length === 1) return nilable(fieldType(plain[0]!), plain[0]!.Nilable || fn.MayReturnNothing);
    const elements = plain.map((r) => `${identifier(r.Name)}: ${nilable(fieldType(r), r.Nilable || fn.MayReturnNothing)}`);
    if (strided.length > 0) {
        const types = [...new Set(strided.map((r) => nilable(fieldType(r), r.Nilable)))].join(" | ");
        elements.push(`...${identifier(strided[0]!.Name)}: (${types})[]`);
    }
    return `LuaMultiReturn<[${elements.join(", ")}]>`;
}

function docComment(indent: string, lines: (string | undefined | false)[]): string {
    const text = lines.filter((l): l is string => !!l).map((l) => l.replace(/\*\//g, "*\\/"));
    if (text.length === 0) return "";
    if (text.length === 1) return `${indent}/** ${text[0]} */\n`;
    return `${indent}/**\n${text.map((l) => `${indent} * ${l}`).join("\n")}\n${indent} */\n`;
}

function functionDoc(indent: string, fn: DocFunction): string {
    return docComment(indent, [
        ...(fn.Documentation ?? []),
        fn.IsProtectedFunction && "@remarks Protected: only callable from secure (untainted) code.",
        fn.HasRestrictions && "@remarks Has restrictions: may fail or be blocked depending on game state.",
    ]);
}

// ---------------------------------------------------------------------------------------------
// Emitters

const pkg = readPackageJson();
const gameVersion = readFileSync(`${CACHE_DIR}/version.txt`, "utf8").trim();
const header = (description: string) =>
    `// GENERATED FILE - do not edit. Regenerate with "npm run gen:types".\n` +
    `// ${description}\n` +
    `// Source: ${pkg.wowUiSource.repository} (${pkg.wowUiSource.branch} @ ${pkg.wowUiSource.commit.slice(0, 10)}), game version ${gameVersion}\n\n`;

function emitApi(): string {
    let out = header("Global functions and C_* namespaces.") + "/** @noSelfInFile */\n\n";
    const byNamespace = new Map<string, DocFunction[]>();
    for (const system of systems) {
        if (system.Type !== "System") continue;
        const list = byNamespace.get(system.Namespace ?? "") ?? [];
        list.push(...(system.Functions ?? []));
        byNamespace.set(system.Namespace ?? "", list);
    }
    for (const [namespace, functions] of [...byNamespace].sort(([a], [b]) => a.localeCompare(b))) {
        if (functions.length === 0) continue;
        const indent = namespace ? "    " : "";
        const keyword = namespace ? "function" : "declare function";
        if (namespace) out += `declare namespace ${namespace} {\n`;
        for (const fn of functions.sort((a, b) => a.Name.localeCompare(b.Name))) {
            const signature =
                SIGNATURE_OVERRIDES[namespace ? `${namespace}.${fn.Name}` : fn.Name] ??
                `(${parameters(fn.Arguments)}): ${returnType(fn)}`;
            out += functionDoc(indent, fn) + `${indent}${keyword} ${fn.Name}${signature};\n`;
        }
        if (namespace) out += "}\n";
        out += "\n";
    }
    out += "declare namespace Constants {\n";
    for (const table of [...constants.values()].sort((a, b) => a.Name.localeCompare(b.Name))) {
        out += `    namespace ${table.Name} {\n`;
        for (const value of table.Values ?? []) {
            const literal = typeof value.Value === "number" || typeof value.Value === "string" ? JSON.stringify(value.Value) : fieldType(value);
            out += `        const ${value.Name}: ${literal};\n`;
        }
        out += "    }\n";
    }
    return out + "}\n";
}

function emitEnums(): string {
    let out = header("Enum.* tables.") + "declare namespace Enum {\n";
    for (const table of [...enums.values()].sort((a, b) => a.Name.localeCompare(b.Name))) {
        out += docComment("    ", table.Documentation ?? []) + `    enum ${table.Name} {\n`;
        for (const field of table.Fields ?? []) {
            out += docComment("        ", field.Documentation ?? []) + `        ${propertyKey(field.Name)} = ${field.EnumValue},\n`;
        }
        out += "    }\n";
    }
    return out + "}\n";
}

function emitStructures(): string {
    let out = header("Structures and callback types.") + "/** @noSelfInFile */\n\n";
    for (const table of [...structures.values()].sort((a, b) => a.Name.localeCompare(b.Name))) {
        out += docComment("", table.Documentation ?? []) + `interface ${table.Name} {\n`;
        for (const field of table.Fields ?? []) {
            const optional = field.Nilable ? "?" : "";
            out += docComment("    ", field.Documentation ?? []) + `    ${propertyKey(field.Name)}${optional}: ${fieldType(field)};\n`;
        }
        out += "}\n\n";
    }
    for (const table of [...callbacks.values()].sort((a, b) => a.Name.localeCompare(b.Name))) {
        out += docComment("", table.Documentation ?? []) + `type ${table.Name} = (this: void, ${parameters(table.Arguments)}) => void;\n`;
    }
    return out.replace(/\(this: void, \)/g, "(this: void)");
}

function emitEvents(): string {
    let out = header("Event payloads, keyed by event name.") + "interface WowEventPayloads {\n";
    for (const [name, event] of [...events].sort(([a], [b]) => a.localeCompare(b))) {
        const payload = (event.Payload ?? []).map((p) => `${identifier(p.Name)}: ${nilable(fieldType(p), p.Nilable)}`);
        out += docComment("    ", [
            ...(event.Documentation ?? []),
            event.SynchronousEvent && "@remarks Synchronous event.",
            event.UniqueEvent && "@remarks Unique event: only the most recent one is delivered per frame.",
        ]);
        out += `    ${name}: [${payload.join(", ")}];\n`;
    }
    return out + "}\n\n/** Any event name the client can fire. */\ntype WowEvent = keyof WowEventPayloads;\n";
}

function emitWidgets(): string {
    let out = header("Widget (ScriptObject) interfaces; methods are called with `:`.");
    // Signatures of every method a widget has, including inherited ones: widget -> method -> signatures
    const signaturesOf = new Map<string, Map<string, string[]>>();
    const emitInterface = (name: string, bases: string[], systemNames: string[]) => {
        const inherited = new Map<string, string[]>();
        for (const base of bases) {
            for (const [method, signatures] of signaturesOf.get(base) ?? []) {
                inherited.set(method, [...new Set([...(inherited.get(method) ?? []), ...signatures])]);
            }
        }
        const all = new Map(inherited);
        out += `interface ${name}${bases.length ? ` extends ${bases.join(", ")}` : ""} {\n`;
        const own = systemNames.flatMap((s) =>
            (systemsByName.get(s)!.Functions ?? []).filter((fn) => !MANUAL_METHODS[s]?.includes(fn.Name)),
        );
        for (const fn of own.sort((a, b) => a.Name.localeCompare(b.Name))) {
            const signature = `(${parameters(fn.Arguments)}): ${returnType(fn)}`;
            const baseSignatures = inherited.get(fn.Name) ?? [];
            if (baseSignatures.includes(signature)) continue;
            // A redeclared method keeps the base signatures as overloads so `extends` stays valid
            const signatures = [signature, ...baseSignatures];
            all.set(fn.Name, signatures);
            out += functionDoc("    ", fn) + signatures.map((s) => `    ${fn.Name}${s};\n`).join("");
        }
        signaturesOf.set(name, all);
        out += "}\n\n";
    };
    for (const [name, bases, systemNames] of WIDGETS) emitInterface(name, bases, systemNames);
    for (const system of standaloneObjects) emitInterface(system.Name.replace(/API$/, ""), [], [system.Name]);
    return out;
}

function emitUnresolved(): string {
    let out =
        header("Type names the documentation references but never defines.") +
        "// Add proper definitions to PRIMITIVES in scripts/generate-wow-types.ts or to types/wow-manual.d.ts.\n\n";
    for (const [name, count] of [...unresolved].sort(([a], [b]) => a.localeCompare(b))) {
        out += `/** Undocumented type, referenced ${count} time(s). */\ntype ${name} = any;\n`;
    }
    return out;
}

// Order matters: emitters register the unresolved names they meet, so emitUnresolved runs last
const files: [string, string][] = [
    ["wow-api.d.ts", emitApi()],
    ["wow-enums.d.ts", emitEnums()],
    ["wow-structures.d.ts", emitStructures()],
    ["wow-events.d.ts", emitEvents()],
    ["wow-widgets.d.ts", emitWidgets()],
];
files.push(["wow-unresolved.d.ts", emitUnresolved()]);

rmSync(GENERATED_TYPES_DIR, { recursive: true, force: true });
mkdirSync(GENERATED_TYPES_DIR, { recursive: true });
for (const [file, content] of files) writeFileSync(`${GENERATED_TYPES_DIR}/${file}`, content);

console.log(
    `Generated ${files.length} files from ${systems.length} documentation tables: ` +
        `${enums.size} enums, ${structures.size} structures, ${events.size} events, ${WIDGETS.length + standaloneObjects.length} widget types, ` +
        `${unresolved.size} unresolved type names.`,
);
if (duplicates.length) console.log(`Skipped duplicate definitions: ${duplicates.join(", ")}`);
