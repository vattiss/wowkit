-- A small mock of the WoW client for the smoke test: frames, timers, the spellbook, action bars,
-- auras, weapon enchants and the Settings panel. Only what the addon calls is modelled.
local M = {}

local now = 1000
local timers, tickers, frames = {}, {}, {}
M.frames = frames
M.printed, M.sounds = {}, {}

local function noop() end

-- Frames answer every unknown method (capitalized key) with a no-op; plain fields stay nil
local frameMeta = {
	__index = function(_, key)
		if type(key) == "string" and key:match("^[A-Z]") then
			return noop
		end
	end,
}

local function newRegion(props)
	local region = props or {}
	region.shown = region.shown ~= false
	region.scripts = region.scripts or {}
	region.events = region.events or {}
	function region:Show()
		if not self.shown then
			self.shown = true
			if self.scripts.OnShow then self.scripts.OnShow(self) end
		end
	end
	function region:Hide()
		if self.shown then
			self.shown = false
			if self.scripts.OnHide then self.scripts.OnHide(self) end
		end
	end
	function region:IsShown() return self.shown end
	function region:SetScript(name, fn) self.scripts[name] = fn end
	function region:GetFrameLevel() return 1 end
	function region:GetWidth() return 36 end
	function region:GetHeight() return 36 end
	function region:GetName() return self.name end
	function region:RegisterEvent(event) self.events[event] = true; return true end
	function region:RegisterUnitEvent(event) self.events[event] = true; return true end
	function region:UnregisterEvent(event) self.events[event] = nil end
	function region:UnregisterAllEvents() self.events = {} end
	function region:SetText(text) self.text = text end
	function region:GetText() return self.text end
	function region:CreateFontString() return newRegion() end
	function region:CreateTexture() return newRegion() end
	return setmetatable(region, frameMeta)
end
M.newRegion = newRegion

local function animation()
	return { Play = noop, Stop = noop }
end

function CreateFrame(frameType, name, parent, template)
	local frame = newRegion({ frameType = frameType, name = name, parent = parent, template = template })
	if template == "ActionButtonSpellAlertTemplate" then
		frame.ProcStartAnim, frame.ProcLoop = animation(), animation()
		frame.ProcStartFlipbook, frame.ProcLoopFlipbook, frame.ProcAltGlow = newRegion(), newRegion(), newRegion()
	end
	frames[#frames + 1] = frame
	if name then _G[name] = frame end
	return frame
end

UIParent = newRegion({ name = "UIParent" })
RaidWarningFrame = newRegion()
DEFAULT_CHAT_FRAME = newRegion()

---------------------------------------------------------------------------------------------
-- Time

function GetTime() return now end
function GetServerTime() return math.floor(now) end
C_Timer = {
	After = function(delay, fn) timers[#timers + 1] = { at = now + delay, fn = fn } end,
	NewTicker = function(interval, fn)
		local ticker = { interval = interval, nextAt = now + interval, fn = fn }
		function ticker:Cancel() self.cancelled = true end
		function ticker:IsCancelled() return self.cancelled == true end
		tickers[#tickers + 1] = ticker
		return ticker
	end,
}

local function runDueTimers()
	for _ = 1, 1000 do
		local due
		for i, timer in ipairs(timers) do
			if timer.at <= now then
				due = table.remove(timers, i)
				break
			end
		end
		if not due then return end
		due.fn()
	end
	error("timers keep scheduling themselves")
end

--- Moves the clock forward in small steps, running timers and tickers on the way.
function M.advance(seconds)
	local target = now + seconds
	while now < target do
		now = math.min(now + 0.05, target)
		runDueTimers()
		for _, ticker in ipairs(tickers) do
			if not ticker.cancelled and ticker.nextAt <= now then
				ticker.nextAt = now + ticker.interval
				ticker.fn(ticker)
			end
		end
	end
end

function M.fire(event, ...)
	for _, frame in ipairs(frames) do
		if frame.events[event] and frame.scripts.OnEvent then frame.scripts.OnEvent(frame, event, ...) end
	end
end

---------------------------------------------------------------------------------------------
-- Player, spells, bars, auras

M.state = {
	class = { "Priest", "PRIEST", 5 },
	spells = {}, -- id -> { name, rank, icon }
	known = {}, -- id -> true
	bars = {}, -- slot -> spell id
	auras = {}, -- list of { name, spellId, expirationTime }
	combat = false,
	hideAuras = false,
	resting = false,
	enchant = {}, -- slot -> { enchantID, remainingTimeMs }
	items = {}, -- slot -> item id
	unusable = {}, -- id -> true while the spell cannot be cast (no rage, no mana)
	party = {}, -- party1..4: { name, class = "MAGE", power = 0 (mana) / 1 (rage), auras = {}, dead, outOfRange }
	inRaid = false,
	bags = {}, -- item id -> count
	reagentText = {}, -- spell id -> reagent named in its tooltip
}
local S = M.state

Enum = {
	SpellBookSpellBank = { Player = 0, Pet = 1 },
	SpellBookItemType = { None = 0, Spell = 1, FutureSpell = 2, PetAction = 3, Flyout = 4 },
	WeaponSlot = { MainHand = 0, OffHand = 1, Ranged = 2 },
	ItemEnchantType = { None = 0, Permanent = 1, Temporary = 2, Imbue = 3 },
	ItemClass = { Weapon = 2 },
	PowerType = { Mana = 0, Rage = 1, Focus = 2, Energy = 3 },
}

function issecretvalue() return false end
function canaccessvalue() return true end
function strtrim(s) return (s:gsub("^%s+", ""):gsub("%s+$", "")) end
function print(...)
	local parts = {}
	for i = 1, select("#", ...) do parts[i] = tostring((select(i, ...))) end
	M.printed[#M.printed + 1] = table.concat(parts, " ")
end

local function member(unit)
	local index = type(unit) == "string" and tonumber(unit:match("^party(%d)$"))
	return index and S.party[index]
end

function UnitClass(unit)
	local m = member(unit)
	if m then return m.class, m.class, 0 end
	return S.class[1], S.class[2], S.class[3]
end
function UnitName(unit)
	local m = member(unit)
	return m and m.name or "Me", nil
end
function UnitIsConnected() return true end
function UnitIsVisible() return true end
function UnitIsUnit(a, b) return a == b end
function UnitInRange() return true, true end
function UnitPowerType(unit)
	local m = member(unit)
	return m and m.power or 0
end
function UnitClassBase() return S.class[2], S.class[3] end
function UnitLevel() return 60 end
function UnitAffectingCombat() return S.combat end
function UnitIsDeadOrGhost(unit)
	local m = member(unit)
	return m and m.dead == true or false
end
function UnitOnTaxi() return false end
function UnitExists(unit)
	if unit == "raid1" then return S.inRaid end
	return member(unit) ~= nil
end
function UnitCastingInfo() return nil end
function IsMounted() return false end
function IsResting() return S.resting end
function IsSwimming() return false end
function GetBuildInfo() return "1.60.1", "70425", "Oct 16 2026", 16001 end
function GetNumShapeshiftForms() return 0 end
function GetInventoryItemID(_, slot) return S.items[slot] end

local function spellById(id)
	local spell = S.spells[id]
	if spell then
		return { name = spell.name, spellID = id, iconID = spell.icon, originalIconID = spell.icon }
	end
end

C_Spell = {
	GetSpellInfo = function(idOrName)
		if type(idOrName) == "number" then return spellById(idOrName) end
		-- By name: the highest rank, like the client
		local best
		for id, spell in pairs(S.spells) do
			if spell.name == idOrName and (not best or spell.rank > S.spells[best].rank) then best = id end
		end
		return best and spellById(best)
	end,
	GetSpellSubtext = function(id)
		local spell = S.spells[id]
		return spell and spell.rank and ("Rank " .. spell.rank) or nil
	end,
	GetOverrideSpell = function(id) return id end,
	-- Usable unless marked: state.unusable[id] = true means "not enough power"
	IsSpellInRange = function(_, unit)
		local m = member(unit)
		if m then return not m.outOfRange end
		return true
	end,
	IsSpellUsable = function(id)
		if S.unusable[id] then return false, true end
		return true, false
	end,
	GetSpellTexture = function(id)
		local spell = S.spells[id]
		return spell and spell.icon, spell and spell.icon
	end,
}

-- The spellbook lists the known spells, sorted by ID
local function bookSpells()
	local ids = {}
	for id in pairs(S.known) do ids[#ids + 1] = id end
	table.sort(ids)
	return ids
end

C_SpellBook = {
	IsSpellKnown = function(id) return S.known[id] == true end,
	IsSpellInSpellBook = function(id) return S.known[id] == true end,
	GetNumSpellBookSkillLines = function() return 1 end,
	GetSpellBookSkillLineInfo = function() return { itemIndexOffset = 0, numSpellBookItems = #bookSpells() } end,
	GetSpellBookItemInfo = function(slot, bank)
		if bank ~= 0 then return nil end
		local id = bookSpells()[slot]
		return id and { name = S.spells[id].name, spellID = id, itemType = 1 }
	end,
	GetSpellBookItemName = function() return nil end,
	FindSpellBookSlotForSpell = function() return nil end,
}

C_ActionBar = {
	HasAction = function(slot) return S.bars[slot] ~= nil end,
	GetActionTexture = function(slot)
		local spell = S.spells[S.bars[slot]]
		return spell and spell.icon
	end,
}
function GetActionInfo(slot)
	local id = S.bars[slot]
	if id then return "spell", id, nil, id end
end

-- Blizzard's action buttons
for i = 1, 12 do
	local button = newRegion({ name = "ActionButton" .. i, action = i })
	_G["ActionButton" .. i] = button
end

local function visibleAuras()
	if S.hideAuras then return {} end
	return S.auras
end

C_UnitAuras = {
	GetAuraDataByIndex = function(unit, index)
		local m = member(unit)
		if m then return m.auras[index] end
		return visibleAuras()[index]
	end,
	GetPlayerAuraBySpellID = function(id)
		for _, aura in ipairs(visibleAuras()) do
			if aura.spellId == id then return aura end
		end
	end,
	GetAuraDataBySpellName = function(_, name)
		for _, aura in ipairs(visibleAuras()) do
			if aura.name == name then return aura end
		end
	end,
}

C_PaperDollInfo = {
	GetTemporaryEnchantmentInfo = function(slot) return S.enchant[slot] end,
}
C_Item = {
	GetWeaponEnchantInfo = function() return {} end,
	GetItemInfoInstant = function(id) return id, "Weapon", "Mace", "INVTYPE_WEAPON", 0, 2, 4 end,
	GetItemSpell = function() return nil end,
	GetItemCount = function(id) return S.bags[id] or 0 end,
	GetItemNameByID = function() return nil end,
}
C_TooltipInfo = {
	GetInventoryItem = function() return { lines = {} } end,
	GetSpellByID = function(id)
		local spell = S.spells[id]
		local lines = { { leftText = spell and spell.name or "?" } }
		if S.reagentText[id] then lines[2] = { leftText = "Reagents: " .. S.reagentText[id] } end
		return { lines = lines }
	end,
}
C_AddOns = { GetAddOnMetadata = function() return "test" end }
C_Sound = { PlaySound = function(id) M.sounds[#M.sounds + 1] = id end }
SOUNDKIT = { ALARM_CLOCK_WARNING_3 = 12889, RAID_WARNING = 8959 }
function GetMacroSpell() return nil end
function GetMacroBody() return nil end

---------------------------------------------------------------------------------------------
-- Settings panel: records what was registered

M.settings = {}
local function settingsObject()
	return setmetatable({}, frameMeta)
end
Settings = {
	VarType = { Boolean = "boolean", Number = "number", String = "string" },
	RegisterCanvasLayoutCategory = function() return settingsObject() end,
	RegisterCanvasLayoutSubcategory = function() return settingsObject() end,
	RegisterVerticalLayoutSubcategory = function() return settingsObject(), settingsObject() end,
	RegisterAddOnCategory = noop,
	RegisterProxySetting = function(_, variable, _, _, default, get, set)
		M.settings[variable] = { default = default, get = get, set = set }
		return settingsObject()
	end,
	CreateCheckbox = noop,
	CreateDropdown = function(_, _, options) options() end,
	CreateControlTextContainer = function()
		local data = {}
		return { Add = function(_, value, label) data[#data + 1] = { value, label } end, GetData = function() return data end }
	end,
}
function CreateSettingsListSectionHeaderInitializer() return {} end

--- Glow frames that are shown on the given button.
function M.glowsOn(buttonName)
	local count = 0
	for _, frame in ipairs(frames) do
		if frame.parent == _G[buttonName] and frame.template == "ActionButtonSpellAlertTemplate" and frame.shown then
			count = count + 1
		end
	end
	return count
end

--- The text currently shown by the on-screen notice ("" when hidden).
function M.notice()
	for _, frame in ipairs(frames) do
		if frame.parent == UIParent and frame.noticeText then
			return frame.shown and frame.noticeText.text or ""
		end
	end
	return ""
end

-- The notice frame is the first plain Frame parented to UIParent; remember its font string
local createFontString = newRegion().CreateFontString
local originalCreateFrame = CreateFrame
function CreateFrame(frameType, name, parent, template)
	local frame = originalCreateFrame(frameType, name, parent, template)
	if parent == UIParent then
		function frame:CreateFontString()
			self.noticeText = createFontString(self)
			return self.noticeText
		end
	end
	return frame
end

return M
