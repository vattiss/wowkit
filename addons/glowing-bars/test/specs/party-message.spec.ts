// The message of the party or raid members missing the player's buff: its own switch for a party and for a raid (on by
// default), whatever the table's Message column says of the missing buff. The button glows for them too, and this says why.
import { createWorld, describe, expect, it, learnSpell, playAs, POWER, FORTITUDE, PRIEST, type World } from "@wowkit/test-kit";

/** A priest with Fortitude on, a member without it, in a party (or a raid), with these settings. */
function createPriest(saved: Record<string, unknown>, isInRaid = false): World {
    const world = createWorld((state) => {
        playAs(state, PRIEST);
        learnSpell(state, FORTITUDE);
        state.auras.push({ name: FORTITUDE.name, spellId: FORTITUDE.id, expirationTime: 1000 + 1800 });
        state.bars[1] = FORTITUDE.id;
        state.party = [{ name: "Bob", classToken: "WARRIOR", power: POWER.Rage, auras: [] }];
        state.isInRaid = isInRaid;
    }, saved);
    world.advance(2);
    return world;
}

const MESSAGE_OFF = { styles: { missingBuff: { isMessageOn: false } } };
const MESSAGE_ON = { styles: { missingBuff: { isMessageOn: true } } };
const isTold = (world: World) => (world.notice() ?? "").includes("Power Word: Fortitude missing on: Bob");

describe("the message of the members missing the player's buff", () => {
    it("shows in a party by default, though the table's Message is off", () => {
        expect(isTold(createPriest(MESSAGE_OFF))).toBe(true);
    });

    it("does not show in a party once its switch is off, though the table's Message is on", () => {
        expect(isTold(createPriest({ ...MESSAGE_ON, showPartyBuffMessage: false }))).toBe(false);
    });

    it("follows the raid's switch in a raid, not the party's", () => {
        expect(isTold(createPriest({ ...MESSAGE_OFF, showPartyBuffMessage: false }, true))).toBe(true);
        expect(isTold(createPriest({ ...MESSAGE_ON, showRaidBuffMessage: false }, true))).toBe(false);
    });
});
