# locale/

Every player-facing text of the addon, English only. `texts.constants.ts` holds them and the `TextKey` type;
`locale.interface.ts` makes `AddonLocale`, a `LocaleService` of `@wowkit/ui` that knows these keys, so a misspelled
key does not compile.
