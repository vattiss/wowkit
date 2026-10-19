import type { LocaleService } from "@wowkit/ui";
import type { TextKey } from "./texts.constants";

/** The texts of this addon: a LocaleService that knows its text keys. */
export type AddonLocale = LocaleService<TextKey>;
