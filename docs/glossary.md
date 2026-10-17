# Glossary

The words this project uses in its own sense, in plain terms. One word means one thing. The words every player knows
(spell, rank, buff, aura, reagent, action bar) are not listed.

## Buffs

| Word | Meaning | In the code |
|---|---|---|
| **aura and buff** | The game says *aura* for an effect that is on a unit; this project says *buff* for the same thing. Only the code that reads the game says aura; everything above it says buff. | `packages/wow/src/auras.service.ts` |
| **class buff** | One entry of a class's buff list: which spell, how long it lasts, whether it is on by default, and whether it can be cast on party members. | `ClassBuff`, `reminders/class-buffs.constants.ts` |
| **buff category** | Buffs of which one is enough: one aspect, one paladin aura, one armor, or a buff together with its group version (Fortitude and Prayer of Fortitude). Any member counts for the whole category. | `BuffCategory`, `categoryMembers`, `knowledge/buff-categories.constants.ts` |
| **group version** | The spell that buffs the whole party in one cast and costs a reagent (Prayer of Fortitude, Gift of the Wild, a Greater Blessing). Not to be mixed up with a buff category. | `Group` in `packages/wow/src/spell-ids.constants.ts`, `groupIds` |
| **party buff** | A class buff the player can also cast on other party members. | `party` in `ClassBuff`, `reminders/party-buffs.service.ts` |
| **weapon buff** | A buff that sits on a weapon (an imbue, a poison, a stone). It has its own timing rules, so it has its own reminder. | `WeaponBuff`, `reminders/weapon/` |
| **picked weapon buff** | The weapon buff the reminder keeps up: the player's choice, or the best one learned, with its highest learned rank. | `PickedWeaponBuff` |
| **outdated rank** | A spell on the action bars at a lower rank than the highest one the player knows. | `OutdatedRank`, `findOutdatedRanks` |

## Reading the game

| Word | Meaning | In the code |
|---|---|---|
| **secret value** | A value the game refuses to let addon code read in some situations (mostly in combat). Reading or comparing it raises an error. | `isReadable`, `getReadable` in `packages/wow/src/safe.ts` |
| **protected call** | A call to the game made so that an error does not stop the addon. | `attempt`, `tryCall` |
| **aura memory** | While the game hides auras (in combat), the addon remembers which buffs it saw or cast, for as long as they last. | `AuraMemoryService` |
| **idle** | Dead, mounted, on a taxi, eating, or resting in town: nothing is shown then. | `shouldStayIdle` |

## How the code is organised

| Word | Meaning | In the code |
|---|---|---|
| **reminder** | Anything the addon wants the player to notice right now. | `Reminders` |
| **tick** | One look at the game, every 0.2 seconds and sooner when something happens. | `tick/tick.service.ts` |
| **stage** | One half of a tick: *find* what is due, then *show* it. | `tick/find-reminders.service.ts`, `tick/show-reminders.service.ts` |
| **glow** and **notice** | The glow is the highlight on an action button; the notice is the message at the top of the screen (one frame shared by all the addons). | `packages/wow/src/glow.service.ts`, `notice.service.ts` |
| **grace time** | After a cast, a "missing" reading is ignored for a few seconds, because the game's data lags behind. | `reminders/weapon/weapon-memory.service.ts` |
| **service** | A class that does one job; it gets the services it needs in its constructor. Most also say which game events they react to. | `*.service.ts` |
| **wiring** | `addon.ts` of an addon: where every service is made with `new`, dependencies first. The order of its lines is the order of the lifecycle hooks. | `addons/*/src/addon.ts` |
| **lifecycle hook** | A method a service has to be told of a moment of the addon's life: `onAddonLoaded`, `onFirstLogin`, `onLogin`, `onReady`, `onLogout`. | `packages/core/README.md` |
| **event** | A small announcement a lower service makes so that a higher one can react without importing it ("spells.invalidated"), on the `EventBus`. | `AppEvents`, `packages/core/src/event-bus.ts` |
