---
layout: home

hero:
  name: wowkit
  text: "TypeScript for World of Warcraft: Forever addons"
  tagline: A toolkit of small packages, compiled to Lua with TypeScriptToLua, and the reminder addons built with it.
  actions:
    - theme: brand
      text: Getting started
      link: /getting-started
    - theme: alt
      text: Learning guide
      link: /learning-guide
    - theme: alt
      text: API reference
      link: /api/index.html
      target: _self

features:
  - title: Plain classes, wired by hand
    details: A service is a class that asks for what it needs in its constructor. No container, no magic; a missing dependency is a compile error.
    link: /architecture
    linkText: How it is built
  - title: The game's door
    details: One package answers every question about the game (spells, auras, action bars, the party), so the quirks of the client live in one place.
    link: /packages
    linkText: Packages and addons
  - title: Tested without the game
    details: The specs are TypeScript too. They run the built addon in LuaJIT against a fake game.
    link: /learning-guide
    linkText: Build your first addon
  - title: The IDs are checked
    details: A developer addon asks the client about every spell and item ID the code uses, and a check compares the answers with the code.
    link: /architecture
    linkText: Read how
---
