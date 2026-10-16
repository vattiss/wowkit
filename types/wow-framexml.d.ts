// Hand-written declarations for client functions missing from the generated API docs and for
// FrameXML (Blizzard's Lua UI code): the Settings panel API, action buttons, templates.

/** One aura (C_UnitAuras). Any field can be a secret value in combat: check with readable(). */
interface AuraData {
    auraInstanceID: number;
    name: string;
    spellId: number;
    icon: number;
    applications: number;
    duration: number;
    /** GetTime() based; 0 for auras without an end. */
    expirationTime: number;
    isHelpful: boolean;
    sourceUnit?: UnitToken;
}

/** C_TooltipInfo result. */
interface TooltipData {
    lines: { leftText?: string; rightText?: string }[];
}

declare function GetActionInfo(
    slot: number,
): LuaMultiReturn<[actionType: string | undefined, id: number | undefined, subType: string | undefined, spellId: number | undefined]>;
declare function GetMacroSpell(macro: number | string): number | undefined;
declare function GetMacroBody(macro: number | string): string | undefined;
declare function GetNumShapeshiftForms(): number;
declare function GetShapeshiftFormInfo(
    index: number,
): LuaMultiReturn<[icon: number | undefined, active: boolean, castable: boolean, spellId: number | undefined]>;
declare function GetInventoryItemID(unit: UnitToken, slot: number): number | undefined;

interface Frame {
    // The docs type the units as an enum; the client takes unit tokens
    RegisterUnitEvent(eventName: string, ...units: UnitToken[]): boolean;
}

interface FontString {
    SetFontObject(fontName: string): void;
}

interface EditBox {
    SetFontObject(fontName: string): void;
}

/** A Blizzard action button (ActionBarButtonTemplate and friends). */
interface ActionButton extends Button {
    action?: number;
    icon?: Texture;
    Icon?: Texture;
    GetPagedID?(): number;
    CalculateAction?(): number;
}

/** A frame created from ActionButtonSpellAlertTemplate (the proc glow). */
interface SpellAlertFrame extends Frame {
    ProcStartAnim?: AnimationGroup;
    ProcLoop?: AnimationGroup;
    ProcAltGlow?: Texture;
    ProcStartFlipbook?: Texture;
    ProcLoopFlipbook?: Texture;
}

/** A frame created with BackdropTemplate. */
interface BackdropFrame {
    SetBackdrop(backdrop: {
        bgFile?: string;
        edgeFile?: string;
        tile?: boolean;
        tileSize?: number;
        edgeSize?: number;
        insets?: { left: number; right: number; top: number; bottom: number };
    }): void;
    SetBackdropColor(r: number, g: number, b: number, a?: number): void;
    SetBackdropBorderColor(r: number, g: number, b: number, a?: number): void;
}

interface ChatFrame {
    editBox?: EditBox;
}

/** Blizzard_ChatFrameBase/Shared/ChatFrameUtil.lua */
declare const ChatFrameUtil:
    | {
          OpenChat?: (this: void, text: string, chatFrame?: ChatFrame) => void;
          ChooseBoxForSend?: (this: void) => EditBox | undefined;
          ActivateChat?: (this: void, editBox: EditBox) => void;
      }
    | undefined;

declare function CreateColorFromHexString(hexColor: string): ColorMixin | undefined;

// ---------------------------------------------------------------------------------------------
// Settings panel (Blizzard_Settings_Shared)

interface SettingsCategory {
    GetID(): number;
}

interface SettingsLayout {
    AddInitializer(initializer: SettingsInitializer): void;
}

interface SettingsInitializer {}

interface SettingsSetting {
    GetValue(): unknown;
    SetValue(value: unknown): void;
}

interface SettingsControlTextContainer {
    Add(value: string, label: string, tooltip?: string): void;
    GetData(): unknown;
}

declare namespace Settings {
    const VarType: { Boolean: "boolean"; Number: "number"; String: "string" };
    function RegisterCanvasLayoutCategory(frame: Frame, name: string): SettingsCategory;
    function RegisterCanvasLayoutSubcategory(parent: SettingsCategory, frame: Frame, name: string): SettingsCategory;
    function RegisterVerticalLayoutSubcategory(parent: SettingsCategory, name: string): LuaMultiReturn<[SettingsCategory, SettingsLayout]>;
    function RegisterAddOnCategory(category: SettingsCategory): void;
    function RegisterProxySetting<T>(
        category: SettingsCategory,
        variable: string,
        varType: string,
        name: string,
        defaultValue: T,
        getValue: (this: void) => T,
        setValue: (this: void, value: T) => void,
    ): SettingsSetting;
    function CreateCheckbox(category: SettingsCategory, setting: SettingsSetting, tooltip?: string): SettingsInitializer;
    function CreateDropdown(
        category: SettingsCategory,
        setting: SettingsSetting,
        options: (this: void) => unknown,
        tooltip?: string,
    ): SettingsInitializer;
    function CreateControlTextContainer(): SettingsControlTextContainer;
    /** Missing on some clients: check before use. */
    const CreateColorSwatch:
        | ((this: void, category: SettingsCategory, setting: SettingsSetting, tooltip?: string) => SettingsInitializer)
        | undefined;
    function OpenToCategory(categoryId: number): void;
}

declare function CreateSettingsListSectionHeaderInitializer(name: string, tooltip?: string): SettingsInitializer;
