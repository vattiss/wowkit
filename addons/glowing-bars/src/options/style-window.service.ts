// The frame of the table of looks: the classic dialog border, the title, the close button, the column headers and the
// scroll area. The rows are the table's.
import type { AddonLocale } from "../locale/locale.interface";
import type { TextKey } from "../locale/texts.constants";
import { BORDER_COLOR, COLUMN, WINDOW_HEIGHT, WINDOW_NAME, WINDOW_WIDTH } from "./style-table.constants";

export class StyleWindowService {
    constructor(private readonly locale: AddonLocale) {}

    /** The frame, and the frame inside its scroll area that the rows go in. */
    createWindow(): { window: Frame; content: Frame } {
        const window = this.createFrameWithBorder();
        window.SetSize(WINDOW_WIDTH, WINDOW_HEIGHT);
        window.SetPoint("CENTER", UIParent, "CENTER", 0, 0);
        window.SetFrameStrata("DIALOG");
        window.SetMovable(true);
        window.EnableMouse(true);
        window.RegisterForDrag("LeftButton");
        window.SetScript("OnDragStart", () => window.StartMoving());
        window.SetScript("OnDragStop", () => window.StopMovingOrSizing());
        // Escape closes it
        table.insert(UISpecialFrames, WINDOW_NAME);
        const title = window.CreateFontString(undefined, "OVERLAY", "GameFontNormalLarge");
        title.SetPoint("TOP", window, "TOP", 0, -16);
        title.SetText(this.locale.getText("TABLE_TITLE"));
        const close = CreateFrame("Button", undefined, window, "UIPanelCloseButton");
        close.SetPoint("TOPRIGHT", window, "TOPRIGHT", -6, -6);
        this.addColumnHeaders(window);
        const scroll = CreateFrame("ScrollFrame", undefined, window, "UIPanelScrollFrameTemplate");
        scroll.SetPoint("TOPLEFT", window, "TOPLEFT", 16, -60);
        scroll.SetPoint("BOTTOMRIGHT", window, "BOTTOMRIGHT", -34, 16);
        this.applyScrollBarTint(scroll);
        const content = CreateFrame("Frame", undefined, scroll);
        content.SetSize(WINDOW_WIDTH - 50, 10);
        scroll.SetScrollChild(content);
        // A new frame is shown; the table opens when it is asked for
        window.Hide();
        return { window, content };
    }

    /** A solid dark brown window, with the bronze border of the classic dialogs where the client has the art for it. */
    private createFrameWithBorder(): Frame {
        const [didSucceed, created] = pcall(() => CreateFrame("Frame", WINDOW_NAME, UIParent, "BackdropTemplate"));
        const frame = didSucceed ? (created as Frame) : CreateFrame("Frame", WINDOW_NAME, UIParent);
        // The background is a texture of our own: a backdrop file the client lacks would leave the window see-through
        const background = frame.CreateTexture(undefined, "BACKGROUND");
        background.SetPoint("TOPLEFT", frame, "TOPLEFT", 6, -6);
        background.SetPoint("BOTTOMRIGHT", frame, "BOTTOMRIGHT", -6, 6);
        background.SetColorTexture(0.1, 0.07, 0.04, 1);
        if (didSucceed) {
            const backdrop = created as Frame & BackdropFrame;
            backdrop.SetBackdrop({
                edgeFile: "Interface\\DialogFrame\\UI-DialogBox-Border",
                edgeSize: 32,
                insets: { left: 11, right: 12, top: 12, bottom: 11 },
            });
            // The border art is silver; tinted, it is the bronze of Forever's own windows
            backdrop.SetBackdropBorderColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
        }
        return frame;
    }

    /** The scroll bar of the template is silver art too: tinted like the border. A client without it keeps it silver. */
    private applyScrollBarTint(scroll: ScrollFrame): void {
        const bar = (scroll as unknown as { ScrollBar?: Frame }).ScrollBar;
        if (bar !== undefined) pcall(() => this.applyTextureTint(bar, 0));
    }

    /** Every texture of the frame and of its children (the arrow buttons, the thumb), two levels down. */
    private applyTextureTint(frame: Frame, depth: number): void {
        for (const region of [...frame.GetRegions()]) {
            if (region.GetObjectType() === "Texture") region.SetVertexColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
        }
        if (depth < 2) for (const child of [...frame.GetChildren()]) this.applyTextureTint(child, depth + 1);
    }

    private addColumnHeaders(window: Frame): void {
        const columns: [x: number, text: TextKey][] = [
            [COLUMN.name, "COL_SPELL"],
            [COLUMN.kind, "COL_KIND"],
            [COLUMN.color, "COL_COLOR"],
            [COLUMN.opacity, "COL_OPACITY"],
            [COLUMN.message, "COL_MESSAGE"],
            [COLUMN.sound, "COL_SOUND"],
        ];
        for (const [x, text] of columns) {
            const header = window.CreateFontString(undefined, "OVERLAY", "GameFontNormalSmall");
            header.SetPoint("TOPLEFT", window, "TOPLEFT", 14 + x, -42);
            header.SetText(this.locale.getText(text));
        }
    }
}
