# options/

The addon's page in the game's Settings panel (`highlights.page.ts`): a section per cue the class has (interrupt, purge,
cleanse and totems only where they exist), the role, the combat mode and the AoE threshold, and the Help section. Like
`packages/@wowkit/wow/src/`, this folder may call the game, because the Settings panel API is the game's.

The page only reads and changes settings (`change`); the tick redraws on `setting.changed`.
