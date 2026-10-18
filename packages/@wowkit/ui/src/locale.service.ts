// The addon's texts: `LocaleService<MyTextKey>`, so a misspelled key does not compile.
export class LocaleService<K extends string> {
    constructor(private readonly texts: Record<K, string>) {}

    getText(key: K): string {
        return this.texts[key];
    }
}
