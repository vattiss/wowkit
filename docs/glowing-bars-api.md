# Glowing Bars API for UI addons

[Glowing Bars](https://github.com/vattiss/wowkit/tree/main/addons/glowing-bars) makes the action button the player should
press glow. To have it glow on your addon's own action buttons, register them.

## 1. Load after Glowing Bars

In your `.toc`:

```
## OptionalDeps: GlowingBars
```

## 2. Register your buttons

Once your buttons are made:

```lua
if GlowingBars then
    -- your second bar counts as Action Bar 2
    for i = 1, 12 do
        GlowingBars.RegisterButton(_G["MyBar2Button" .. i], 2)
    end
    -- the stance bar (forms, paladin auras...)
    for i = 1, 10 do
        GlowingBars.RegisterStanceButton(_G["MyStanceButton" .. i], i)
    end
end
```

- `RegisterButton(button, bar, shape)`: `bar` is the Action Bar (1 to 8) the button counts as, so the player's settings
  for that bar apply to it. Pass `nil` for a button of no bar.
- `RegisterStanceButton(button, stance, shape)`: `stance` is the stance the button stands for, 1 the first.
- `shape` (optional, both functions): `"Circle"` for a round button, which then gets a round glow (the client's own
  gamepad highlight) instead of Blizzard's square proc glow. `"Square"`, or nothing, keeps the square glow.

Round buttons, a gamepad addon's for example:

```lua
if GlowingBars then
    for i = 1, 12 do
        GlowingBars.RegisterButton(_G["MyPadButton" .. i], nil, "Circle")
    end
end
```

The button needs its action slot where Blizzard's buttons keep it (`button.action` or the `action` attribute). Buttons
made from `ActionBarButtonTemplate` or with LibActionButton-1.0 have it.

That's all: the glows show on your buttons within a few seconds.

## Checking it

`/dump GlowingBars` in game shows the two functions. Drop a buff of your class that is on one of your buttons, and the
button glows.

## Questions, problems

Open an issue on [GitHub](https://github.com/vattiss/wowkit/issues).
