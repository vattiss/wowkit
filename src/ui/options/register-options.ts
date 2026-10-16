// The addon's pages in the game's Settings panel: a landing page with the Reminders page and the
// Debug report page under it. The pages only read and change settings (changeSetting); whoever
// cares reacts to settingChanged.
import { say } from "../../wow/notice";
import { registerDebugPage } from "./debug-page";
import { registerHomePage } from "./home-page";
import { registerRemindersPage } from "./reminders-page";

let isRegistered = false;

function registerPages(): void {
    const root = registerHomePage();
    registerRemindersPage(root);
    registerDebugPage(root);
}

/** Adds the pages to the Settings panel; a failure is printed, never thrown. */
export function registerOptions(): void {
    if (isRegistered || typeof Settings === "undefined") return;
    isRegistered = true;
    const [didSucceed, error] = pcall(registerPages);
    if (!didSucceed) say(tostring(error));
}
