---
layout: home

hero:
  name: wowkit
  text: "TypeScript for World of Warcraft: Forever addons"
  tagline: A layer of small packages, compiled to Lua with TypeScriptToLua, written to be read by people. An AI writes most of the code; the rules make sure a person can still read, review and change it.
  actions:
    - theme: brand
      text: Getting started
      link: /getting-started
    - theme: alt
      text: Design goal
      link: /design-goal
    - theme: alt
      text: Learning guide
      link: /learning-guide
    - theme: alt
      text: API reference
      link: /api/index.html
      target: _self

features:
  - title: Written to be read
    details: Names that read like English, small files and functions, one job for each class. Every rule is checked by a tool, so it holds for code a person wrote and for code an AI wrote.
    link: /design-goal
    linkText: The design goal
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
