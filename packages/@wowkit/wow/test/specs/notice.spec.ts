import { NoticeService } from "@wowkit/wow";
import { beforeEach, createBasicGame, describe, expect, it, type BasicGame } from "@wowkit/test-kit";

describe("the notice on the screen", () => {
    let game!: BasicGame;
    let buffs!: NoticeService;
    let ranks!: NoticeService;

    beforeEach(() => {
        game = createBasicGame();
        buffs = new NoticeService("BuffReminder");
        ranks = new NoticeService("RankReminder");
    });

    it("shows a message", () => {
        buffs.showNotice("a buff is missing");
        expect(game.readNotice()).toBe("a buff is missing");
    });

    it("hides the message after ten seconds", () => {
        buffs.showNotice("a buff is missing");
        game.clock.advance(9);
        expect(game.readNotice()).toBe("a buff is missing");
        game.clock.advance(2);
        expect(game.readNotice()).toBe("");
    });

    it("is one frame for every addon", () => {
        buffs.showNotice("one");
        ranks.showNotice("two");
        const frames = game.frames.all.filter((frame) => frame.fontStrings.length > 0);
        expect(frames.length).toBe(1);
    });

    describe("when two addons show a message", () => {
        beforeEach(() => {
            buffs.showNotice("a buff is missing");
            game.clock.advance(1);
            ranks.showNotice("Smite is at an old rank");
        });

        it("stacks the lines in the order they first appeared, instead of drawing over each other", () => {
            expect(game.readNotice()).toBe("a buff is missing\nSmite is at an old rank");
        });

        it("takes the first addon's lines away when its time is up, and leaves the second's", () => {
            game.clock.advance(9.5);
            expect(game.readNotice()).toBe("Smite is at an old rank");
        });

        it("hides the notice when both are over", () => {
            game.clock.advance(12);
            expect(game.readNotice()).toBe("");
        });

        it("replaces an addon's own message in its place", () => {
            buffs.showNotice("another buff is missing");
            expect(game.readNotice()).toBe("another buff is missing\nSmite is at an old rank");
        });
    });

    it("lets a newer message live its full ten seconds, although an older one's timer comes first", () => {
        buffs.showNotice("first");
        game.clock.advance(6);
        buffs.showNotice("second");
        game.clock.advance(5);
        // ten seconds after the first message: its timer has run, but the second message is newer
        expect(game.readNotice()).toBe("second");
        game.clock.advance(6);
        expect(game.readNotice()).toBe("");
    });
});
