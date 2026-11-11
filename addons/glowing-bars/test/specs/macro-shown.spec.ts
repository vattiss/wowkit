// Which spells of a macro count: with #showtooltip or #show the one it shows, otherwise every one it casts; in both, not
// one for another stance or form. Any other condition (a key, a target, a fight) counts either way. See issue #53.
import { createWorld, describe, expect, INNER_FIRE, it, learnSpell, playAs, PRIEST, type SpellDefinition } from "@wowkit/test-kit";

const FADE: SpellDefinition = { id: 586, name: "Fade", rank: 1, icon: 1, isHelpful: true };
const SHADOWFORM: SpellDefinition = { id: 15473, name: "Shadowform", rank: 1, icon: 2, isHelpful: true };

/** Does the macro on button 2 glow for Inner Fire, which is missing? */
function isLit(body: string, change: { isInForm?: boolean; isInCombat?: boolean; isEverySpell?: boolean } = {}): boolean {
    const world = createWorld(
        (state) => {
            playAs(state, PRIEST);
            learnSpell(state, INNER_FIRE);
            learnSpell(state, FADE);
            learnSpell(state, SHADOWFORM);
            state.stances = [SHADOWFORM.id];
            if (change.isInForm === true) state.activeStance = SHADOWFORM.id;
            state.isInCombat = change.isInCombat === true;
            state.barMacros = { 2: { body } };
        },
        { shouldGlowOnEveryMacroSpell: change.isEverySpell === true },
    );
    world.advance(3);
    return world.glowsOn(2) > 0;
}

describe("a macro with #showtooltip or #show", () => {
    it("glows only for the spell it names, not for its other lines", () => {
        expect(isLit("#showtooltip Fade\n/startattack\n/cast Inner Fire\n/cast Fade")).toBe(false);
        expect(isLit("#show Fade\n/cast Inner Fire\n/cast Fade")).toBe(false);
    });

    it("glows for every spell it casts when the player asks for it", () => {
        expect(isLit("#showtooltip Fade\n/cast Inner Fire\n/cast Fade", { isEverySpell: true })).toBe(true);
    });

    it("glows, without a spell named, for the one of the stance it shows now", () => {
        const body = "#showtooltip\n/startattack\n/cast [form:1] Fade; Inner Fire\n/cast Inner Fire";
        expect(isLit(body)).toBe(true);
        expect(isLit(body, { isInForm: true })).toBe(false);
    });

    it("falls back to its cast lines when only spaces follow #showtooltip", () => {
        expect(isLit("#showtooltip  \n/cast Inner Fire")).toBe(true);
    });

    it("glows for a spell behind a key held at the press", () => {
        expect(isLit("#showtooltip\n/cast [mod:shift] Inner Fire; Fade")).toBe(true);
    });
});

describe("a macro without #showtooltip or #show", () => {
    it("glows for every spell it casts", () => {
        expect(isLit("/cast Fade\n/cast Inner Fire")).toBe(true);
    });

    it("does not glow for a spell of another stance, even when every spell counts", () => {
        expect(isLit("/cast [form:1] Inner Fire; Fade")).toBe(false);
        expect(isLit("/cast [form:1] Inner Fire; Fade", { isInForm: true })).toBe(true);
        expect(isLit("/cast [form:1] Inner Fire; Fade", { isEverySpell: true })).toBe(false);
    });

    it("follows a new stance, on any bar", () => {
        const world = createWorld((state) => {
            playAs(state, PRIEST);
            learnSpell(state, INNER_FIRE);
            learnSpell(state, FADE);
            learnSpell(state, SHADOWFORM);
            state.stances = [SHADOWFORM.id];
            state.barMacros = { 2: { body: "/cast [form:1] Inner Fire; Fade" } };
        });
        world.advance(3);
        expect(world.glowsOn(2)).toBe(0);
        world.state.activeStance = SHADOWFORM.id;
        world.fire("UPDATE_SHAPESHIFT_FORM");
        world.advance(3);
        expect(world.glowsOn(2)).toBe(1);
    });

    it("counts a clause behind a target or a fight either way, as it may hold at the press", () => {
        expect(isLit("/cast [help] Inner Fire")).toBe(true);
        expect(isLit("/cast [@mouseover,help] Inner Fire")).toBe(true);
        expect(isLit("/use [combat] Inner Fire")).toBe(true);
        expect(isLit("/cast [harm] Fade; Inner Fire")).toBe(true);
    });

    it("does not let a target alone stand for a condition: the next clause is for another case", () => {
        expect(isLit("/cast [@player] Fade; Inner Fire")).toBe(false);
    });
});
