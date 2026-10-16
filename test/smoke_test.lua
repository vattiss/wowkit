-- Loads the built addon in plain Lua 5.1 / LuaJIT against a mock of the WoW client (mock_wow.lua)
-- and plays a few scenarios through events and time.
-- Usage: luajit test/smoke_test.lua dist/ForeverReminders/ForeverReminders.lua
local addonFile = assert(arg[1], "usage: smoke_test.lua <addon.lua>")
local testDir = arg[0]:match("^(.*)[/\\]") or "."

-- The mock captures print (the addon's chat output); the test reports through its own copy
local report = print

local failures = 0
local function check(name, condition, detail)
	if condition then
		report("ok   " .. name)
	else
		failures = failures + 1
		report("FAIL " .. name .. (detail ~= nil and (": " .. tostring(detail)) or ""))
	end
end

--- A fresh client with the addon loaded and logged in. `setup(state)` fills in the character.
local function scenario(title, setup)
	report("-- " .. title)
	ForeverRemindersCharDB = nil
	local wow = dofile(testDir .. "/mock_wow.lua")
	setup(wow.state)
	-- WoW calls each addon file with (addonName, addonTable)
	assert(loadfile(addonFile))("ForeverReminders", {})
	wow.fire("ADDON_LOADED", "ForeverReminders", false)
	wow.fire("PLAYER_LOGIN")
	wow.fire("PLAYER_ENTERING_WORLD", true, false)
	wow.advance(1)
	return wow
end

local function learn(state, id, name, rank, icon)
	state.spells[id] = { name = name, rank = rank, icon = icon }
	state.known[id] = true
end

-- Priest: buffs, the "not on your bars" notice and old ranks ---------------------------------
do
	local wow = scenario("priest", function(s)
		s.class = { "Priest", "PRIEST", 5 }
		learn(s, 1243, "Power Word: Fortitude", 1, 135987)
		learn(s, 588, "Inner Fire", 1, 135926)
		learn(s, 585, "Smite", 1, 135924)
		learn(s, 591, "Smite", 2, 135924)
		s.bars[1] = 1243 -- Power Word: Fortitude
		s.bars[2] = 585 -- Smite, rank 1
	end)
	local s = wow.state

	check("greets in chat", wow.printed[1] and wow.printed[1]:find("Initialized", 1, true), wow.printed[1])
	check("saved variables are the live settings", type(ForeverRemindersCharDB) == "table" and ForeverRemindersCharDB.showBuff == true)
	check("registers the options page", wow.settings.ForeverReminders_showBuff ~= nil)
	check("missing buff on the bars glows", wow.glowsOn("ActionButton1") == 1, wow.glowsOn("ActionButton1"))
	check("other buttons do not glow", wow.glowsOn("ActionButton2") == 0)
	local notice = wow.notice()
	check("notice names the missing buff not on the bars", notice:find("not on your action bars: Inner Fire", 1, true), notice)
	check("notice names the old rank", notice:find("Smite: Rank 1 is on your action bar, but you know Rank 2.", 1, true), notice)
	check("buff sound is off by default", #wow.sounds == 0, #wow.sounds)

	-- Fortitude goes up: its glow goes out
	s.auras[1] = { name = "Power Word: Fortitude", spellId = 1243, expirationTime = 1000 + 1800 }
	wow.fire("UNIT_AURA", "player")
	wow.advance(1)
	check("buff up: glow goes out", wow.glowsOn("ActionButton1") == 0)

	-- Combat hides every aura: the remembered buff still counts
	s.combat, s.hideAuras = true, true
	wow.advance(1)
	check("in combat the remembered buff still counts", wow.glowsOn("ActionButton1") == 0)
	s.combat, s.hideAuras = false, false

	-- The new rank goes on the bar: the rank line disappears
	s.bars[2] = 591
	wow.fire("ACTIONBAR_SLOT_CHANGED", 2)
	wow.advance(32)
	check("rank notice clears when the bar holds the best rank", not wow.notice():find("Smite", 1, true), wow.notice())

	-- Switching a buff off on the options page
	wow.settings.ForeverReminders_buff_InnerFire.set(false)
	check("buff switch is saved", ForeverRemindersCharDB.buffOn.InnerFire == false)
	wow.settings.ForeverReminders_buff_InnerFire.set(true)
	check("default is not stored", ForeverRemindersCharDB.buffOn.InnerFire == nil)

	-- Resting in town: quiet
	s.auras = {}
	s.resting = true
	wow.fire("PLAYER_UPDATE_RESTING")
	wow.advance(1)
	check("quiet while resting", wow.glowsOn("ActionButton1") == 0)
end

-- Priest in a party: group versions, party buffs, reagents ------------------------------------
do
	local HOLY_CANDLE = 17028
	local wow = scenario("priest in a party", function(s)
		s.class = { "Priest", "PRIEST", 5 }
		learn(s, 1243, "Power Word: Fortitude", 1, 135987)
		learn(s, 21562, "Prayer of Fortitude", 1, 135941)
		s.reagentText[21562] = "Holy Candle"
		s.bars[1] = 1243
		s.bars[2] = 21562
		s.bags[HOLY_CANDLE] = 0
		s.resting = true
		-- Another priest's Prayer of Fortitude on me: it counts as Fortitude
		s.auras[1] = { name = "Prayer of Fortitude", spellId = 21562, expirationTime = 1000 + 3600 }
		s.party[1] = { name = "Bob", class = "WARRIOR", power = 1, auras = {} }
		s.party[2] = { name = "Alice", class = "MAGE", power = 0, auras = {} }
		s.party[3] = { name = "Dead", class = "ROGUE", power = 3, auras = {}, dead = true }
	end)
	local s = wow.state

	local warned
	for _, line in ipairs(wow.printed) do
		if line:find("Reagents running low: Holy Candle (0)", 1, true) then warned = true end
	end
	check("arriving in town warns about low reagents", warned)

	-- Leave town so the reminders are not quiet
	s.resting = false
	wow.fire("PLAYER_UPDATE_RESTING")
	wow.advance(2)
	local notice = wow.notice()
	check("no candle: the single buff is suggested", notice:find("Power Word: Fortitude missing on: Bob, Alice", 1, true), notice)
	check("dead members are skipped", not notice:find("Dead", 1, true), notice)
	check("the party buff glows on its button", wow.glowsOn("ActionButton1") == 1, wow.glowsOn("ActionButton1"))

	-- Candles in the bags: the group version
	s.bags[HOLY_CANDLE] = 20
	wow.fire("GROUP_ROSTER_UPDATE")
	wow.advance(2)
	notice = wow.notice()
	check("with candles the group version is suggested", notice:find("Prayer of Fortitude missing on: Bob, Alice", 1, true), notice)
	check("the group version glows", wow.glowsOn("ActionButton2") == 1, wow.glowsOn("ActionButton2"))

	-- Alice got it: one left, the single buff again
	s.party[2].auras[1] = { name = "Power Word: Fortitude", spellId = 1243, expirationTime = 1000 + 1800 }
	wow.fire("GROUP_ROSTER_UPDATE")
	wow.advance(2)
	notice = wow.notice()
	check("one member missing: the single buff", notice:find("Power Word: Fortitude missing on: Bob", 1, true) and not notice:find("Alice", 1, true), notice)

	-- In combat other units' auras are not read
	s.combat = true
	wow.fire("GROUP_ROSTER_UPDATE")
	wow.advance(2)
	check("no party glow in combat", wow.glowsOn("ActionButton1") == 0 and wow.glowsOn("ActionButton2") == 0)
end

-- Solo priest with another priest's Prayer of Fortitude ----------------------------------------
do
	local wow = scenario("priest with a group buff on", function(s)
		s.class = { "Priest", "PRIEST", 5 }
		learn(s, 1243, "Power Word: Fortitude", 1, 135987)
		s.bars[1] = 1243
		s.auras[1] = { name = "Prayer of Fortitude", spellId = 21562, expirationTime = 1000 + 3600 }
	end)
	check("Prayer of Fortitude counts as Fortitude", wow.glowsOn("ActionButton1") == 0, wow.glowsOn("ActionButton1"))
end

-- Paladin: Greater Blessings per class, only own blessings count -------------------------------
do
	local wow = scenario("paladin in a party", function(s)
		s.class = { "Paladin", "PALADIN", 2 }
		learn(s, 20217, "Blessing of Kings", 1, 135995)
		learn(s, 25898, "Greater Blessing of Kings", 1, 135993)
		s.reagentText[25898] = "Symbol of Kings"
		s.bags[21177] = 10
		s.auras[1] = { name = "Blessing of Kings", spellId = 20217, expirationTime = 1000 + 300 }
		s.party[1] = { name = "Tank", class = "WARRIOR", power = 1, auras = {} }
		-- Another paladin's blessing: not mine, so still missing mine
		s.party[2] = { name = "Dps", class = "WARRIOR", power = 1, auras = { { name = "Blessing of Might", spellId = 19740, sourceUnit = "party4" } } }
		s.party[3] = { name = "Healer", class = "PRIEST", power = 0, auras = { { name = "Blessing of Kings", spellId = 20217, sourceUnit = "player" } } }
		s.party[4] = { name = "Caster", class = "MAGE", power = 0, auras = {} }
	end)
	local notice = wow.notice()
	check("two of one class: Greater Blessing", notice:find("Greater Blessing of Kings missing on: Tank, Dps", 1, true), notice)
	check("one of a class: the single blessing", notice:find("Blessing of Kings missing on: Caster", 1, true), notice)
	check("my blessing on a member counts", not notice:find("Healer", 1, true), notice)
end

-- Mage: Arcane Intellect only for mana users --------------------------------------------------
do
	local wow = scenario("mage in a party", function(s)
		s.class = { "Mage", "MAGE", 8 }
		learn(s, 1459, "Arcane Intellect", 1, 135932)
		s.auras[1] = { name = "Arcane Intellect", spellId = 1459, expirationTime = 1000 + 1800 }
		s.bars[1] = 1459
		s.party[1] = { name = "Bob", class = "WARRIOR", power = 1, auras = {} }
		s.party[2] = { name = "Alice", class = "PRIEST", power = 0, auras = {} }
		s.party[3] = { name = "Far", class = "DRUID", power = 0, auras = {}, outOfRange = true }
	end)
	local notice = wow.notice()
	check("Arcane Intellect only for mana users in range", notice:find("Arcane Intellect missing on: Alice", 1, true) and not notice:find("Bob", 1, true) and not notice:find("Far", 1, true), notice)
end

-- Warrior: a buff that needs rage -------------------------------------------------------------
do
	local wow = scenario("warrior", function(s)
		s.class = { "Warrior", "WARRIOR", 1 }
		learn(s, 6673, "Battle Shout", 1, 132333)
		s.bars[1] = 6673
		s.unusable[6673] = true -- no rage out of combat
	end)
	local s = wow.state

	check("no rage: Battle Shout does not glow", wow.glowsOn("ActionButton1") == 0)
	check("no rage: not named as missing from the bars", not wow.notice():find("Battle Shout", 1, true), wow.notice())

	-- In combat with enough rage
	s.combat, s.unusable[6673] = true, nil
	wow.advance(1)
	check("enough rage: Battle Shout glows", wow.glowsOn("ActionButton1") == 1, wow.glowsOn("ActionButton1"))
end

-- Druid: every missing buff glows at once ---------------------------------------------------
do
	local wow = scenario("druid", function(s)
		s.class = { "Druid", "DRUID", 11 }
		learn(s, 1126, "Mark of the Wild", 1, 136078)
		learn(s, 467, "Thorns", 1, 136104)
		s.bars[1] = 1126
		s.bars[2] = 467
	end)
	local s = wow.state
	check("both missing buffs glow at once", wow.glowsOn("ActionButton1") == 1 and wow.glowsOn("ActionButton2") == 1)

	s.auras[1] = { name = "Mark of the Wild", spellId = 1126, expirationTime = 1000 + 1800 }
	wow.fire("UNIT_AURA", "player")
	wow.advance(1)
	check("cast one: it goes out, the other stays", wow.glowsOn("ActionButton1") == 0 and wow.glowsOn("ActionButton2") == 1)
end

-- Hunter: of a group of buffs (aspects) only one glows --------------------------------------
do
	local wow = scenario("hunter", function(s)
		s.class = { "Hunter", "HUNTER", 3 }
		learn(s, 13165, "Aspect of the Hawk", 1, 136076)
		learn(s, 13163, "Aspect of the Monkey", 1, 132160)
		learn(s, 20043, "Aspect of the Wild", 1, 136074)
		s.bars[1], s.bars[2], s.bars[3] = 13165, 13163, 20043
	end)
	check("only the first aspect glows", wow.glowsOn("ActionButton1") == 1 and wow.glowsOn("ActionButton2") == 0 and wow.glowsOn("ActionButton3") == 0)
end

-- Debug mode and the debug report page ---------------------------------------------------------
do
	local wow = scenario("debug report", function(s)
		s.class = { "Priest", "PRIEST", 5 }
		learn(s, 1243, "Power Word: Fortitude", 1, 135987)
		s.bars[1] = 1243
	end)
	wow.settings.ForeverReminders_isDebugMode.set(true)
	wow.advance(3)

	-- The page is built when it is first shown: find the hidden page, show it, press "Debug report"
	local page
	for _, frame in ipairs(wow.frames) do
		if frame.scripts.OnShow and not frame.shown and frame.template == nil and frame.parent == nil then page = frame end
	end
	check("the debug page is registered", page ~= nil)
	page.scripts.OnShow(page)
	local reportButton
	for _, frame in ipairs(wow.frames) do
		if frame.template == "UIPanelButtonTemplate" and frame.text == "Debug report" then reportButton = frame end
	end
	check("the page has a Debug report button", reportButton ~= nil)
	reportButton.scripts.OnClick(reportButton)
	local report
	for _, frame in ipairs(wow.frames) do
		if frame.frameType == "EditBox" and type(frame.text) == "string" and frame.text:find("debug report", 1, true) then report = frame.text end
	end
	check("the report is written", report ~= nil)
	check("the report counts the samples", report:find("samples: ", 1, true) and not report:find("samples: 0", 1, true), report)
	check("the report says why the buff is wanted", report:find("buff says | Power Word: Fortitude", 1, true), report)
	check("the report shows no swallowed errors", not report:find("swallowed error", 1, true), report)

	-- Switching it off stops the samples; clearing empties the report
	wow.settings.ForeverReminders_isDebugMode.set(false)
	local clearButton
	for _, frame in ipairs(wow.frames) do
		if frame.template == "UIPanelButtonTemplate" and frame.text == "Clear debug data" then clearButton = frame end
	end
	clearButton.scripts.OnClick(clearButton)
	reportButton.scripts.OnClick(reportButton)
	local after
	for _, frame in ipairs(wow.frames) do
		if frame.frameType == "EditBox" and type(frame.text) == "string" and frame.text:find("debug report", 1, true) then after = frame.text end
	end
	check("clearing the data empties the report", after:find("samples: 0", 1, true), after)
end

-- Shaman: the weapon buff --------------------------------------------------------------------
do
	local wow = scenario("shaman", function(s)
		s.class = { "Shaman", "SHAMAN", 7 }
		learn(s, 8017, "Rockbiter Weapon", 1, 136086)
		learn(s, 324, "Lightning Shield", 1, 136051)
		s.bars[3] = 8017
		s.bars[4] = 324
		s.items[16] = 1234
	end)
	local s = wow.state

	wow.advance(2)
	check("missing weapon buff glows", wow.glowsOn("ActionButton3") == 1, wow.glowsOn("ActionButton3"))
	check("missing shield glows too", wow.glowsOn("ActionButton4") == 1)
	check("weapon alarm sound plays once", #wow.sounds == 1 and wow.sounds[1] == 12889, #wow.sounds)
	wow.advance(2)
	check("sound does not repeat", #wow.sounds == 1, #wow.sounds)

	-- Casting the shield is not applying the weapon buff: its glow must not blink out
	s.auras[1] = { name = "Lightning Shield", spellId = 324, expirationTime = 1000 + 600 }
	wow.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-guid", 324)
	wow.advance(0.5)
	check("casting the shield: the shield glow goes out", wow.glowsOn("ActionButton4") == 0)
	check("casting the shield: the weapon glow stays", wow.glowsOn("ActionButton3") == 1, wow.glowsOn("ActionButton3"))

	-- Rockbiter goes on the weapon
	s.enchant[16] = { enchantID = 1, remainingTimeMs = 3600 * 1000 }
	wow.fire("WEAPON_ENCHANT_CHANGED")
	wow.advance(1)
	check("weapon buff up: glow goes out", wow.glowsOn("ActionButton3") == 0)

	-- About to run out
	s.enchant[16] = { enchantID = 1, remainingTimeMs = 20 * 1000 }
	wow.advance(1)
	check("expiring weapon buff glows", wow.glowsOn("ActionButton3") == 1)

	-- Switched off on the options page
	wow.settings.ForeverReminders_showWeapon.set(false)
	check("switching the weapon reminder off clears its glow", wow.glowsOn("ActionButton3") == 0)
end

report(failures == 0 and "All smoke tests passed." or (failures .. " smoke test(s) failed."))
os.exit(failures == 0 and 0 or 1)
