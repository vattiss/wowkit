// The addon's texts.

import { TEXTS, type TextKey } from "./texts.constants";

export class LocaleService {
    getText(key: TextKey): string {
        return TEXTS[key];
    }
}
