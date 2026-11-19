// Written by scripts/generate-faq.ts from faq.md, at each build: not to be edited by hand.

export interface Faq {
    question: string;
    /** The answer as the game shows it. */
    answer: string;
}

/** The common questions, in the order of faq.md. */
export const FAQS: Faq[] = [
    { question: "The Cooldown Manager changes after every login.", answer: "Glowing Bars adds the spells it needs. To stop it, set Blizzard Cooldown Manager on the Cooldown Manager tab to Only use what's already there or Don't use it." },
    { question: "An ID from Wowhead doesn't work.", answer: "Forever's IDs can differ. Turn on Show spell and item IDs in tooltips on the General tab and hover your own button. Low stock takes the Item ID, everything else a spell ID." },
    { question: "The Cooldown Manager's windows don't show.", answer: "On the Cooldown Manager tab, set the window to Show (e.g. Essential Cooldowns Icons), or press Repair Hidden Windows." },
    { question: "A buff that falls off in a dungeon or raid isn't reminded.", answer: "There the game hides some buffs from addons, like food buffs and elixirs. Your class buffs in the Cooldown Manager's Tracked Buffs are still reminded." },
];
