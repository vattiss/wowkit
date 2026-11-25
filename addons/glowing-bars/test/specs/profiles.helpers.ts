// Opening the Profiles window as a player does: by the button at the top left of the settings.
import type { World } from "@wowkit/test-kit";

export function openProfilesWindow(world: World): void {
    world.openOptions();
    world.advance(1);
    const settings = world.frames.find((frame) => frame.name === "GlowingBarsOptions")!;
    const button = world.frames.find((frame) => frame.parent === settings && frame.text === "Profiles")!;
    button.scripts.OnClick!(button);
    world.advance(1);
}
