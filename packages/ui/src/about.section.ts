// The Help section at the bottom of an addon's page: where to ask, and where to report a problem.
import type { WidgetsService } from "./widgets.service";

/** The words of the Help section. */
export interface AboutTexts {
    header: string;
    githubLabel: string;
    issuesLabel: string;
}

export class AboutSection {
    constructor(
        private readonly widgets: WidgetsService,
        private readonly texts: AboutTexts,
        /** The page of the project; the issues are at its /issues. */
        private readonly githubUrl: string,
    ) {}

    addAboutSection(layout: SettingsLayout): void {
        layout.AddInitializer(CreateSettingsListSectionHeaderInitializer(this.texts.header));
        this.widgets.addLinkButton(layout, this.texts.githubLabel, this.githubUrl);
        this.widgets.addLinkButton(layout, this.texts.issuesLabel, `${this.githubUrl}/issues`);
    }
}
