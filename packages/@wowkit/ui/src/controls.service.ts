// The controls of the settings window, bound to the addon's settings. A control reads the setting through `get` and writes
// it through `set` (always SettingsService.change, so whoever cares reacts to "setting.changed"). They are the game's own
// templates, each made for this window alone.
import { connectChoiceMenu } from "./choice-menu";
import { CONTROL_LEFT, type OptionRow, type OptionsTab } from "./options-tab";
import type { SettingsService } from "./settings.service";

const DROPDOWN_WIDTH = 240;
const CONTROL_HEIGHT = 22;
const SLIDER_WIDTH = 170;
/** A choice: its title, the line under it that says what it means, and a gap before the next one. */
const CHOICE_ROW_HEIGHT = 50;
/** The game's gold, for the choice picked. */
const PICKED_COLOR: [number, number, number] = [1, 0.82, 0];

/** The keys of the settings that hold a true / false. */
type SwitchKey<T> = { [K in keyof T]: T[K] extends boolean ? K : never }[keyof T];

export class ControlsService<T extends object> {
    constructor(
        private readonly settings: SettingsService<T>,
        /** Starts the name each control is found by, so two addons never share one. */
        private readonly variablePrefix: string,
    ) {}

    addHeader(tab: OptionsTab, label: string): void {
        tab.addHeader(label);
    }

    addCheckbox(
        tab: OptionsTab,
        variable: string,
        label: string,
        tooltip: string | undefined,
        isOnByDefault: boolean,
        get: () => boolean,
        set: (isChecked: boolean) => void,
    ): OptionRow {
        const row = tab.createRow(label, tooltip);
        const box = CreateFrame("CheckButton", undefined, row, "UICheckButtonTemplate");
        box.SetSize(26, 26);
        box.SetPoint("LEFT", row, "LEFT", CONTROL_LEFT, 0);
        const apply = (value?: unknown) => {
            set(value === true);
            tab.refresh();
        };
        box.SetScript("OnClick", () => apply(box.GetChecked()));
        return tab.addControl(row, {
            variable: `${this.variablePrefix}_${variable}`,
            apply,
            refresh: () => box.SetChecked(get()),
            setEnabled: (isEnabled) => box.SetEnabled(isEnabled),
            reset: () => set(isOnByDefault),
        });
    }

    /**
     * One of several choices of a setting, as a round radio button: its title, and under it a line that says what it means.
     * The one picked is in gold.
     */
    addChoice(
        tab: OptionsTab,
        variable: string,
        label: string,
        meaning: string,
        isOnByDefault: boolean,
        get: () => boolean,
        set: (isChecked: boolean) => void,
    ): OptionRow {
        const row = tab.createRow(label, undefined);
        const radio = CreateFrame("CheckButton", undefined, row, "UIRadioButtonTemplate");
        radio.SetSize(20, 20);
        radio.SetPoint("TOPLEFT", row, "TOPLEFT", 0, -2);
        const title = tab.findLabel(row)!;
        title.ClearAllPoints();
        title.SetPoint("TOPLEFT", radio, "TOPRIGHT", 6, -3);
        title.SetWidth(tab.getRowWidth() - 30);
        const text = row.CreateFontString(undefined, "OVERLAY", "GameFontHighlightSmall");
        text.SetPoint("TOPLEFT", title, "BOTTOMLEFT", 0, -4);
        text.SetWidth(tab.getRowWidth() - 30);
        text.SetJustifyH("LEFT");
        text.SetText(meaning);
        const apply = (value?: unknown) => {
            set(value === true);
            tab.refresh();
        };
        radio.SetScript("OnClick", () => apply(radio.GetChecked()));
        // The title and the line under it pick it too, not only the round button
        let isEnabled = true;
        row.EnableMouse(true);
        row.SetScript("OnMouseDown", () => {
            if (isEnabled) apply(true);
        });
        const control = {
            variable: `${this.variablePrefix}_${variable}`,
            apply,
            refresh: () => {
                radio.SetChecked(get());
                if (get()) title.SetTextColor(PICKED_COLOR[0], PICKED_COLOR[1], PICKED_COLOR[2]);
            },
            setEnabled: (isOn: boolean) => {
                isEnabled = isOn;
                radio.SetEnabled(isOn);
            },
            reset: () => set(isOnByDefault),
        };
        return tab.addControl(row, control, CHOICE_ROW_HEIGHT);
    }

    /** A checkbox in the middle at the bottom of the window, its words after it: for the one choice a tab is not about. */
    addFooterCheckbox(tab: OptionsTab, variable: string, label: string, get: () => boolean, set: (isChecked: boolean) => void): void {
        const row = tab.createFooterRow();
        const box = CreateFrame("CheckButton", undefined, row, "UICheckButtonTemplate");
        box.SetSize(26, 26);
        box.SetPoint("LEFT", row, "LEFT", 0, 0);
        const text = row.CreateFontString(undefined, "OVERLAY", "GameFontHighlight");
        text.SetPoint("LEFT", box, "RIGHT", 4, 0);
        text.SetText(label);
        // As wide as the box and its words, so it stands in the middle
        row.SetWidth(30 + ((text.GetStringWidth() as number | undefined) ?? 0));
        const apply = (value?: unknown) => {
            set(value === true);
            tab.refresh();
        };
        box.SetScript("OnClick", () => apply(box.GetChecked()));
        tab.addFooterControl({
            variable: `${this.variablePrefix}_${variable}`,
            apply,
            refresh: () => box.SetChecked(get()),
            setEnabled: (isEnabled) => box.SetEnabled(isEnabled),
        });
    }

    /** A switch stored in the settings under `key`; its default is the default of the setting. */
    addSwitchCheckbox(tab: OptionsTab, key: SwitchKey<T>, label: string, tooltip: string): OptionRow {
        return this.addCheckbox(
            tab,
            String(key),
            label,
            tooltip,
            this.settings.getDefault(key) as boolean,
            () => this.settings.get(key) as boolean,
            (isChecked) => this.settings.change(key, isChecked as T[SwitchKey<T>]),
        );
    }

    /** `items` returns [value, label] pairs; a static list is read once. */
    addDropdown(
        tab: OptionsTab,
        variable: string,
        label: string,
        tooltip: string,
        defaultValue: string,
        get: () => string,
        set: (value: string) => void,
        items: () => [value: string, label: string][],
        isStatic = false,
    ): OptionRow {
        const row = tab.createRow(label, tooltip);
        const button = CreateFrame("Button", undefined, row, "UIPanelButtonTemplate");
        button.SetSize(DROPDOWN_WIDTH, CONTROL_HEIGHT);
        button.SetPoint("LEFT", row, "LEFT", CONTROL_LEFT, 0);
        let kept: [value: string, label: string][] | undefined;
        const listItems = () => {
            const list = kept ?? items();
            if (isStatic) kept = list;
            return list;
        };
        const apply = (value?: unknown) => {
            set(value as string);
            tab.refresh();
        };
        connectChoiceMenu(button, () =>
            listItems().map(([value, text]) => ({ label: text, isChosen: () => get() === value, choose: () => apply(value) })),
        );
        return tab.addControl(row, {
            variable: `${this.variablePrefix}_${variable}`,
            apply,
            refresh: () => button.SetText(listItems().find(([value]) => value === get())?.[1] ?? ""),
            setEnabled: (isEnabled) => button.SetEnabled(isEnabled),
            reset: () => set(defaultValue),
        });
    }

    /** A number the player sets with a slider; `formatValue` is what it shows beside it. */
    addSlider(
        tab: OptionsTab,
        variable: string,
        label: string,
        tooltip: string,
        range: { min: number; max: number; step: number; defaultValue: number },
        formatValue: (this: void, value: number) => string,
        get: () => number,
        set: (value: number) => void,
    ): OptionRow {
        const row = tab.createRow(label, tooltip);
        const slider = CreateFrame("Slider", undefined, row, "UISliderTemplate");
        slider.SetSize(SLIDER_WIDTH, 17);
        slider.SetPoint("LEFT", row, "LEFT", CONTROL_LEFT, 0);
        slider.SetMinMaxValues(range.min, range.max);
        slider.SetValueStep(range.step);
        slider.SetObeyStepOnDrag(true);
        const shown = row.CreateFontString(undefined, "OVERLAY", "GameFontHighlight");
        shown.SetPoint("LEFT", slider, "RIGHT", 8, 0);
        const apply = (value?: unknown) => {
            set(value as number);
            tab.refresh();
        };
        (slider as unknown as ValueSlider).SetScript("OnValueChanged", (_frame, value, isUserInput) => {
            shown.SetText(formatValue(value));
            if (isUserInput) apply(value);
        });
        return tab.addControl(row, {
            variable: `${this.variablePrefix}_${variable}`,
            apply,
            refresh: () => {
                slider.SetValue(get());
                shown.SetText(formatValue(get()));
            },
            setEnabled: (isEnabled) => (isEnabled ? slider.Enable() : slider.Disable()),
            reset: () => set(range.defaultValue),
        });
    }
}
