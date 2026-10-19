// What a click in the table of looks chooses: the next sound, and a color from the game's picker.
import { SOUNDS, type MessagesService, type SoundKey } from "@wowkit/ui";
import type { AddonLocale } from "../locale/locale.interface";
import type { StyleService } from "../settings/style.service";
import type { StyleRow } from "./style-rows.service";

export class StyleChoicesService {
    constructor(
        private readonly locale: AddonLocale,
        private readonly styles: StyleService,
        private readonly messages: MessagesService,
    ) {}

    /** The sound after (or, with a negative step, before) the current one; it plays once as a preview. */
    chooseNextSound(row: StyleRow, step: number): void {
        const current = this.styles.getStyle(row.kind, row.spellId).sound;
        const index = math.max(
            0,
            SOUNDS.findIndex((sound) => sound.key === current),
        );
        const chosen: SoundKey = SOUNDS[(index + step + SOUNDS.length) % SOUNDS.length]!.key;
        this.styles.changeStyle(row.kind, row.spellId, { sound: chosen });
        this.messages.playAlertSound(chosen);
    }

    /** The game's color picker; every move of it changes the color, and cancelling puts the old one back. */
    chooseColor(row: StyleRow): void {
        const picker = ColorPickerFrame;
        if (picker.SetupColorPickerAndShow === undefined) {
            this.messages.say(this.locale.getText("NO_COLOR_PICKER"));
            return;
        }
        const [r, g, b] = this.styles.getStyle(row.kind, row.spellId).color;
        picker.SetupColorPickerAndShow({
            r,
            g,
            b,
            hasOpacity: false,
            swatchFunc: () => {
                const [pickedR, pickedG, pickedB] = picker.GetColorRGB();
                this.styles.changeStyle(row.kind, row.spellId, { color: [pickedR, pickedG, pickedB] });
            },
            cancelFunc: () => this.styles.changeStyle(row.kind, row.spellId, { color: [r, g, b] }),
        });
    }
}
