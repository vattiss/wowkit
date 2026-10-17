# Glossary

The words used in the code and in these docs, in plain terms. One word means one thing.

## Spells and buffs

| Word | Meaning | In the code |
|---|---|---|
| **spell** | Something the player can cast. Has an ID, a name and ranks. | `packages/wow/src/spells.service.ts` |
| **rank** | A numbered version of a spell (Rank 1, Rank 2). The action bar may still hold an old one. | `getSpellRank`, `getHighestRank` |
| **outdated rank** | A spell on the bars at a lower rank than the highest one the player knows. | `OutdatedRank`, `findOutdatedRanks` |
| **buff** | A helpful effect the player wants to keep up on themselves or on party members (Fortitude, an aspect). This is the addon's word; the reminder logic only ever says "buff". | `reminders/` |
| **class buff** | One entry of a class's buff list: which spell, how long it lasts, whether it is on by default, and whether it can be cast on party members. | `ClassBuff`, `reminders/class-buffs.constants.ts` |
| **buff category** | Buffs of which one is enough: one aspect, one paladin aura, one armor, or a buff together with its group version (Fortitude and Prayer of Fortitude). Any member of the category counts for the whole category. | `BuffCategory`, `categoryMembers`, `data/buff-categories.ts` |
| **group version** | The spell that buffs the whole party in one cast and costs a reagent (Prayer of Fortitude, Gift of the Wild, a Greater Blessing). Not to be mixed up with a buff category. | `Group` in `data/spells.ts`, `groupIds` |
| **party buff** | A class buff the player can also cast on other party members. | `party` in `ClassBuff`, `reminders/party-buffs.service.ts` |
| **weapon buff** | A buff that sits on a weapon: a shaman imbue, a rogue poison, a warlock stone. It has its own timing rules, so it has its own reminder. | `WeaponBuff`, `reminders/weapon/weapon-*.service.ts` |
| **picked weapon buff** | The weapon buff the reminder keeps up (the player's choice, or the best one learned) together with its highest learned rank. | `PickedWeaponBuff` |
| **reagent** | An item a group version uses up when cast. | `packages/wow/src/reagents.constants.ts`, `reagents.service.ts` |

## The game's side

| Word | Meaning | In the code |
|---|---|---|
| **aura** | The game's own word for an effect that is on a unit right now. Only the code that reads the game says "aura"; everything above it says "buff". | `packages/wow/src/auras.service.ts` |
| **aura memory** | While the game hides auras (in combat), the addon remembers which buffs it saw or cast, for as long as they last. | `AuraMemoryService` |
| **secret value** | A value the game refuses to let addon code read in some situations (mostly in combat). Reading or comparing it raises an error. | `isReadable`, `getReadable` in `packages/wow/src/safe.ts` |
| **protected call** | A call to the game made so that an error does not stop the addon; the error is reported instead. | `attempt`, `tryCall` |
| **action bar, button** | The bars of buttons the player puts spells on. A spell is "on the bars" when a button holds it. | `packages/wow/src/action-bars.service.ts` |
| **idle** | Dead, mounted, on a taxi, eating, or resting in town: nothing is shown then. | `shouldStayIdle` |

## What the addon does with them

| Word | Meaning | In the code |
|---|---|---|
| **reminder** | Anything the addon wants the player to notice right now. | `Reminders` |
| **tick** | One look at the game, every 0.2 seconds and sooner when something happens. | `tick/tick.service.ts` |
| **service** | A class that does one job; it gets the services it needs in its constructor. Most also say which game events they react to. | `*.service.ts` |
| **wiring** | `addons/buff-reminder/src/addon.ts`: where every service is made with `new`, dependencies first. The order of its lines is the order of the lifecycle hooks. | `addon.ts` |
| **lifecycle hook** | A method a service has to be told of a moment of the addon's life: `onAddonLoaded`, `onFirstLogin`, `onLogin`, `onReady`, `onLogout`. | `packages/core/src/README.md` |
| **EventBus** | The addon's own events: a service emits a named event, others listen with `@OnEvent`. | `packages/core/src/event-bus.ts` |
| **stage** | One half of a tick: *find* what is due, then *show* it. | `tick/find-reminders.service.ts`, `tick/show-reminders.service.ts` |
| **glow** | The highlight on an action button. | `packages/wow/src/glow.service.ts` |
| **notice** | The message at the top of the screen. | `tick/notices.service.ts` |
| **grace time** | After a cast, a "missing" reading is ignored for a few seconds, because the game's data lags behind. | `reminders/weapon/weapon-memory.service.ts` |
| **event** | A small announcement a lower service makes so that a higher one can react without importing it ("spells.invalidated"). | `AppEvents` |
