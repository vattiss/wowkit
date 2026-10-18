// The game's frames (windows, buttons, text). The addon creates them, shows and hides them and sets
// scripts on them. Only what the addon does is modelled; any other method of a frame does nothing.
import { defineValues } from "./define";

type Script = (...args: any[]) => void;

export interface FakeFrame {
    frameType: string;
    name: string | undefined;
    parent: FakeFrame | undefined;
    template: string | undefined;
    /** The action slot of an action button. */
    action: number | undefined;
    isShown: boolean;
    /** The opacity the addon set (a glow faded by a hidden value). */
    alpha: number;
    text: string | undefined;
    scripts: { [script: string]: Script | undefined };
    events: { [event: string]: true | undefined };
    fontStrings: FakeFrame[];
    // The parts of the spell-alert glow template
    ProcStartAnim?: FakeFrame;
    ProcLoop?: FakeFrame;
    ProcAltGlow?: FakeFrame;
    ProcStartFlipbook?: FakeFrame;
    ProcLoopFlipbook?: FakeFrame;
    Show(): void;
    Hide(): void;
    IsShown(): boolean;
    SetAlpha(alpha: number): void;
    GetAlpha(): number;
    SetScript(script: string, handler: Script | undefined): void;
    GetName(): string | undefined;
    GetFrameLevel(): number;
    GetWidth(): number;
    GetHeight(): number;
    RegisterEvent(event: string): boolean;
    RegisterUnitEvent(event: string): boolean;
    UnregisterEvent(event: string): void;
    UnregisterAllEvents(): void;
    SetText(text: string): void;
    GetText(): string | undefined;
    CreateFontString(): FakeFrame;
    CreateTexture(): FakeFrame;
}

const doNothing = () => undefined;

// Any method nobody modelled (SetPoint, SetSize...) is found as a function that does nothing
const unmodelledMethods: object = {
    __index: (_table: unknown, key: unknown) =>
        type(key) === "string" && string.match(key as string, "^%u")[0] !== undefined ? doNothing : undefined,
};

/** An object that answers every method with a no-op: the game's settings categories, layouts, ... */
export function createInertObject<T>(): T {
    return setmetatable({}, unmodelledMethods) as T;
}

interface FrameInit {
    frameType: string;
    name?: string;
    parent?: FakeFrame;
    template?: string;
}

function createFakeFrame(init: FrameInit): FakeFrame {
    const frame: FakeFrame = {
        frameType: init.frameType,
        name: init.name,
        parent: init.parent,
        template: init.template,
        action: undefined,
        isShown: true,
        alpha: 1,
        text: undefined,
        scripts: {},
        events: {},
        fontStrings: [],
        Show() {
            if (this.isShown) return;
            this.isShown = true;
            this.scripts.OnShow?.(this);
        },
        Hide() {
            if (!this.isShown) return;
            this.isShown = false;
            this.scripts.OnHide?.(this);
        },
        SetAlpha(alpha) {
            this.alpha = alpha;
        },
        GetAlpha() {
            return this.alpha;
        },
        IsShown() {
            return this.isShown;
        },
        SetScript(script, handler) {
            this.scripts[script] = handler;
        },
        GetName() {
            return this.name;
        },
        GetFrameLevel() {
            return 1;
        },
        GetWidth() {
            return 36;
        },
        GetHeight() {
            return 36;
        },
        RegisterEvent(event) {
            this.events[event] = true;
            return true;
        },
        RegisterUnitEvent(event) {
            this.events[event] = true;
            return true;
        },
        UnregisterEvent(event) {
            this.events[event] = undefined;
        },
        UnregisterAllEvents() {
            this.events = {};
        },
        SetText(text) {
            this.text = text;
        },
        GetText() {
            return this.text;
        },
        CreateFontString() {
            const fontString = createFakeFrame({ frameType: "FontString", parent: this });
            this.fontStrings.push(fontString);
            return fontString;
        },
        CreateTexture() {
            return createFakeFrame({ frameType: "Texture", parent: this });
        },
    };
    return setmetatable(frame, unmodelledMethods);
}

export interface FrameRegistry {
    all: FakeFrame[];
    create(frameType: string, name?: string, parent?: FakeFrame, template?: string): FakeFrame;
    /** Delivers a game event to every frame that registered for it. */
    fire(event: string, ...args: unknown[]): void;
}

export function createFrameRegistry(): FrameRegistry {
    const all: FakeFrame[] = [];
    return {
        all,
        create(frameType, name, parent, template) {
            const frame = createFakeFrame({ frameType, name, parent, template });
            if (template === "ActionButtonSpellAlertTemplate") {
                frame.ProcStartAnim = createFakeFrame({ frameType: "AnimationGroup" });
                frame.ProcLoop = createFakeFrame({ frameType: "AnimationGroup" });
                frame.ProcAltGlow = createFakeFrame({ frameType: "Texture" });
                frame.ProcStartFlipbook = createFakeFrame({ frameType: "Texture" });
                frame.ProcLoopFlipbook = createFakeFrame({ frameType: "Texture" });
            }
            all.push(frame);
            if (name !== undefined) defineValues({ [name]: frame });
            return frame;
        },
        fire(event, ...args) {
            for (const frame of [...all]) {
                if (frame.events[event] !== undefined) frame.scripts.OnEvent?.(frame, event, ...args);
            }
        },
    };
}
