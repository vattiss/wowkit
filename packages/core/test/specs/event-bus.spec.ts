import { EventBus } from "@wowkit/core";
import { beforeEach, describe, expect, it } from "@wowkit/test-kit";

declare module "@wowkit/core/event-bus" {
    interface AppEvents {
        "test.counted": [count: number];
        "test.silent": [];
    }
}

describe("the event bus", () => {
    let bus!: EventBus;
    let log!: string[];

    beforeEach(() => {
        bus = new EventBus();
        log = [];
    });

    it("gives the payload to everyone who listens", () => {
        bus.on("test.counted", (count) => log.push(`a${count}`));
        bus.on("test.counted", (count) => log.push(`b${count}`));
        bus.emit("test.counted", 7);
        expect(log).toEqual(["a7", "b7"]);
    });

    it("calls the listeners in the order they started listening", () => {
        bus.on("test.silent", () => log.push("first"));
        bus.on("test.silent", () => log.push("second"));
        bus.emit("test.silent");
        expect(log).toEqual(["first", "second"]);
    });

    it("does nothing for an event nobody listens to", () => {
        bus.emit("test.silent");
        expect(log).toEqual([]);
    });

    it("keeps the events apart", () => {
        bus.on("test.counted", () => log.push("counted"));
        bus.emit("test.silent");
        expect(log).toEqual([]);
    });

    it("lets a listener start listening while an event is delivered; the new one gets the next event", () => {
        bus.on("test.silent", () => {
            log.push("old");
            bus.on("test.silent", () => log.push("new"));
        });
        bus.emit("test.silent");
        expect(log).toEqual(["old"]);
        bus.emit("test.silent");
        expect(log).toEqual(["old", "old", "new"]);
    });
});
