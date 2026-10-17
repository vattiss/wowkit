// The landing page of an addon in the Settings panel: what it does, and where to report problems. The other pages
// go under it.
import type { OptionsPage } from "./options.service";
import type { WidgetsService } from "./widgets.service";

/** The words on the landing page. */
export interface HomePageTexts {
    title: string;
    /** What the addon does. */
    text: string;
    /** How to get help. */
    help: string;
    githubLabel: string;
    issuesLabel: string;
}

export class HomePage implements OptionsPage {
    constructor(
        private readonly widgets: WidgetsService,
        private readonly texts: HomePageTexts,
        /** The page of the project; the issues are at its /issues. */
        private readonly githubUrl: string,
    ) {}

    /** Adds the addon's category with the landing page; the other pages go under it. */
    registerPage(): SettingsCategory {
        const home = CreateFrame("Frame");
        this.buildHomePage(home);
        const root = Settings.RegisterCanvasLayoutCategory(home, this.texts.title);
        Settings.RegisterAddOnCategory(root);
        return root;
    }

    private buildHomePage(home: Frame): void {
        const title = home.CreateFontString(undefined, "OVERLAY", "GameFontNormalHuge");
        title.SetPoint("TOPLEFT", 16, -16);
        title.SetTextColor(1, 0.82, 0.2);
        title.SetText(this.texts.title);
        const text = home.CreateFontString(undefined, "OVERLAY", "GameFontHighlight");
        text.SetPoint("TOPLEFT", title, "BOTTOMLEFT", 0, -16);
        text.SetPoint("RIGHT", home, "RIGHT", -24, 0);
        text.SetJustifyH("LEFT");
        text.SetWordWrap(true);
        text.SetText(this.texts.text);
        const help = home.CreateFontString(undefined, "OVERLAY", "GameFontHighlightSmall");
        help.SetPoint("TOPLEFT", text, "BOTTOMLEFT", 0, -12);
        help.SetPoint("RIGHT", home, "RIGHT", -24, 0);
        help.SetJustifyH("LEFT");
        help.SetWordWrap(true);
        help.SetText(this.texts.help);
        const githubRow = this.widgets.createLinkRow(home, this.texts.githubLabel, this.githubUrl);
        githubRow.SetPoint("TOPLEFT", help, "BOTTOMLEFT", 0, -16);
        githubRow.SetPoint("RIGHT", home, "RIGHT", -24, 0);
        const issuesRow = this.widgets.createLinkRow(home, this.texts.issuesLabel, `${this.githubUrl}/issues`);
        issuesRow.SetPoint("TOPLEFT", githubRow, "BOTTOMLEFT", 0, -4);
        issuesRow.SetPoint("RIGHT", home, "RIGHT", -24, 0);
    }
}
