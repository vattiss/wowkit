import { buildNameKey, doesTextName, isSameName } from "@wowkit/wow";
import { describe, expect, it } from "@wowkit/test-kit";

describe("the key names are compared by", () => {
    it("leaves out the rank, what is in brackets, spaces and punctuation", () => {
        expect(buildNameKey("Power Word: Fortitude (Rank 2)")).toBe("powerwordfortitude");
        expect(buildNameKey("Shadow Bolt Rank 3")).toBe("shadowbolt");
        expect(buildNameKey("Bear Form (Shapeshift)")).toBe("bearform");
    });

    it("makes one name of the ways a client writes it: apostrophes, dashes, spaces", () => {
        expect(isSameName("Plaie d'agonie", "Plaie d\u2019agonie")).toBe(true);
        expect(isSameName("Mind-numbing Poison", "Mind numbing Poison")).toBe(true);
        expect(isSameName("Mot de pouvoir : Robustesse", "Mot de pouvoir\u00a0: Robustesse")).toBe(true);
    });

    it("makes one name of the full-width marks of a Chinese or Japanese client and the plain ones", () => {
        expect(isSameName("暗影箭（等级 2）", "暗影箭")).toBe(true);
        expect(isSameName("真言术：韧", "真言术:韧")).toBe(true);
        expect(isSameName("シャドウ・ボルト", "シャドウ　ボルト")).toBe(true);
        expect(isSameName("暗影箭", "寒冰箭")).toBe(false);
    });

    it("keeps names apart that differ in a letter", () => {
        expect(isSameName("Instant Poison II", "Instant Poison")).toBe(false);
        expect(isSameName("Seal of Light", "Seal of Might")).toBe(false);
    });

    it("keeps the letters of other scripts, so a name of no English letter is never empty", () => {
        expect(buildNameKey("Слово силы: Стойкость") !== "").toBe(true);
        expect(isSameName("Слово силы: Стойкость", "Слово силы: Стойкость")).toBe(true);
        expect(isSameName("Malédiction", "Malédiction")).toBe(true);
    });

    it("keeps names of no letter (a spell named by its ID) apart", () => {
        expect(buildNameKey("1719")).toBe("1719");
        expect(isSameName("1719", "556")).toBe(false);
        expect(isSameName("", "")).toBe(false);
    });

    it("tells no name apart from a missing one", () => {
        expect(isSameName(undefined, "Smite")).toBe(false);
        expect(isSameName("Smite", undefined)).toBe(false);
    });

    it("finds a name in a tooltip's line however either writes it", () => {
        expect(doesTextName("Instant Poison II (30 min)", "instant poison")).toBe(true);
        expect(doesTextName("Réactifs : Bougie sacrée", "Bougie sacr\u00e9e")).toBe(true);
        expect(doesTextName("Instant Poison II (30 min)", "Deadly Poison")).toBe(false);
        expect(doesTextName("anything", "")).toBe(false);
    });
});
