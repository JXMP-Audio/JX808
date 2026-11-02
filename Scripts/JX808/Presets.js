/*  MEMORY CARTRIDGE (rear panel) and the cartridge browser: the whole machine (panel, pattern and
    track memory) as a HISE user preset.

    Cartridge: PREV / NEXT step through the presets, SAVE stores the next free "User/JX-808 nnn",
    BROWSE opens the browser over the whole window: FACTORY / USER banks, click a cartridge to load
    it, SAVE AS / RENAME / DELETE (user presets only; DELETE asks for a second press).
*/

namespace Presets
{
	const var CARTRIDGE_W = 300;
	const var CARTRIDGE_H = 76;
	const var ROW_HEIGHT = 48;
	const var VISIBLE_ROWS = 10;

	inline function presetName()
	{
		local n = Engine.getCurrentUserPresetName();
		return n == "" ? "- EMPTY -" : n;
	}

	inline function presetRoot()
	{
		return FileSystem.getFolder(FileSystem.UserPresets);
	}

	/** The next free "JX-808 nnn" in the USER bank. */
	inline function nextFreeName()
	{
		local n = 1;
		local name = "";

		while (n < 1000)
		{
			name = "JX-808 " + (n < 10 ? "00" : (n < 100 ? "0" : "")) + n;

			if (!presetRoot().getChildFile("User/" + name + ".preset").isFile())
				break;

			n++;
		}

		return name;
	}

	// ------------------------------------------------------------------- cartridge

	const var cartridgePaint = function(g)
	{
		var a = this.getLocalBounds(0);
		var i;
		var x;

		// plastic body with grip ribs
		g.setGradientFill([0xFF2E2E30, 0, 0, 0xFF161617, 0, a[3], false]);
		g.fillRoundedRectangle([1, 1, a[2] - 2, a[3] - 2], 4.0);
		g.setColour(0xFF000000);
		g.drawRoundedRectangle([1, 1, a[2] - 2, a[3] - 2], 4.0, 1.5);
		g.setColour(0xFF3C3C3E);

		for (i = 0; i < 6; i++)
		{
			x = a[2] - 26 + i * 3;
			g.drawLine(x, x, 10, a[3] - 10, 1.0);
		}

		// label sticker with the preset name
		g.setColour(Theme.CREAM);
		g.fillRoundedRectangle([10, 10, a[2] - 46, a[3] - 20], 2.0);
		g.setColour(Theme.ORANGE);
		g.fillRect([10, 10, a[2] - 46, 6]);
		g.setColour(Theme.INK);
		g.setFont(Theme.FONT, 9.0);
		g.drawAlignedText("JXMP AUDIO  ·  MEMORY", [16, 18, a[2] - 58, 12], "left");
		g.setFont(Theme.FONT_BOLD, 17.0);
		g.drawAlignedText(this.data.name, [16, 30, a[2] - 58, a[3] - 42], "left");
	};

	const var Cartridge = Content.addPanel("Cartridge", 0, 0);
	const var cartridgeBox = Layout.box(895, 400, CARTRIDGE_W, CARTRIDGE_H);
	FrontPanel.props(Cartridge, {
		"parentComponent": "RearPage", "x": cartridgeBox[0], "y": cartridgeBox[1],
		"width": cartridgeBox[2], "height": cartridgeBox[3], "saveInPreset": false, "allowCallbacks": "No Callbacks"
	});
	Cartridge.data.name = presetName();
	Cartridge.setPaintRoutine(cartridgePaint);

	inline function setName(name)
	{
		Cartridge.data.name = name;
		Cartridge.repaint();
	}

	// ------------------------------------------------------------------- browser page

	const var browserPaint = function(g)
	{
		g.setGradientFill([Theme.PANEL_TOP, 0, 0, Theme.PANEL_BOTTOM, 0, 762, false]);
		g.fillRect([0, 0, 1280, 762]);
		g.setColour(Theme.PRINT);
		g.drawRect([40, 36, 1200, 690], 1.0);
		g.setColour(Theme.PANEL_TOP);
		g.fillRect([56, 28, 250, 18]);
		g.setColour(Theme.WHITE);
		g.setFont(Theme.FONT_BOLD, 16.0);
		g.drawAlignedText("MEMORY CARTRIDGES", [64, 28, 240, 18], "left");
		g.setColour(Theme.PRINT);
		g.setFont(Theme.FONT_BOLD, 12.0);
		g.drawAlignedText("CARTRIDGE", [96, 116, 300, 16], "left");
		g.drawAlignedText("CATEGORY", [730, 116, 300, 16], "left");
		g.drawAlignedText("NAME", [60, 654, 60, 20], "left");
		g.setColour(Theme.ORANGE);
		g.drawLine(60, 1220, 136, 136, 1.0);
	};

	const var Browser = Content.addPanel("PresetBrowser", 0, 0);
	FrontPanel.props(Browser, {
		"x": 0, "y": 0, "width": 1280, "height": 762, "visible": false, "saveInPreset": false,
		"allowCallbacks": "No Callbacks"
	});
	Browser.setPaintRoutine(browserPaint);

	inline function addBrowserButton(id, laf, text, x, y, w, h, momentary)
	{
		local b = Content.addButton(id, 0, 0);

		FrontPanel.props(b, { "parentComponent": "PresetBrowser", "x": x, "y": y, "width": w, "height": h,
		                      "text": text, "isMomentary": momentary, "saveInPreset": false });
		b.setLocalLookAndFeel(laf);
		return b;
	}

	const var BankFactory = addBrowserButton("BankFactory", Laf.tabButton, "FACTORY", 60, 64, 140, 32, false);
	const var BankUser = addBrowserButton("BankUser", Laf.tabButton, "USER", 210, 64, 140, 32, false);
	const var BrowserClose = addBrowserButton("BrowserClose", Laf.smallButton, "CLOSE", 1120, 64, 100, 32, true);
	const var ListUp = addBrowserButton("ListUp", Laf.smallButton, "UP", 1170, 146, 50, 40, true);
	const var ListDown = addBrowserButton("ListDown", Laf.smallButton, "DOWN", 1170, 576, 50, 40, true);
	const var PresetSaveAs = addBrowserButton("PresetSaveAs", Laf.smallButton, "SAVE AS", 520, 648, 130, 34, true);
	const var PresetRename = addBrowserButton("PresetRename", Laf.smallButton, "RENAME", 660, 648, 130, 34, true);
	const var PresetDelete = addBrowserButton("PresetDelete", Laf.smallButton, "DELETE", 800, 648, 130, 34, true);
	BankFactory.setValue(1);

	const var NameInput = Content.addLabel("PresetNameInput", 0, 0);
	FrontPanel.props(NameInput, {
		"parentComponent": "PresetBrowser", "x": 120, "y": 648, "width": 380, "height": 34,
		"editable": true, "multiline": false, "saveInPreset": false, "text": "",
		"fontName": Theme.FONT_BOLD, "fontSize": 18, "alignment": "left",
		"bgColour": Theme.CREAM, "textColour": Theme.INK, "itemColour": Theme.ORANGE
	});

	// ------------------------------------------------------------------- the list

	const var listPaint = function(g)
	{
		var a = this.getLocalBounds(0);
		var rh = this.data.rowHeight;
		var i;
		var r;
		var y;

		for (i = this.data.offset; i < this.data.rows.length && i < this.data.offset + Presets.VISIBLE_ROWS; i++)
		{
			r = this.data.rows[i];
			y = (i - this.data.offset) * rh;

			Draw.lamp(g, 18, y + rh / 2, 5, r.current ? 1.0 : 0.0, Theme.LAMP_RED);

			g.setColour(Theme.CREAM);
			g.fillRoundedRectangle([36, y + 5, 620, rh - 10], 2.0);
			g.setColour(Theme.ORANGE);
			g.fillRect([36, y + 5, 8, rh - 10]);

			if (i == this.data.selected)
			{
				g.setColour(Theme.ORANGE);
				g.drawRoundedRectangle([34, y + 3, 624, rh - 6], 3.0, 2.5);
			}

			g.setColour(Theme.INK);
			g.setFont(Theme.FONT_BOLD, 19.0);
			g.drawAlignedText(r.name, [56, y + 5, 590, rh - 10], "left");
			g.setColour(Theme.PRINT);
			g.setFont(Theme.FONT_BOLD, 15.0);
			g.drawAlignedText(r.category, [670, y, 400, rh], "left");
		}

		if (this.data.rows.length == 0)
		{
			g.setColour(Theme.PRINT);
			g.setFont(Theme.FONT_BOLD, 16.0);
			g.drawAlignedText("- no cartridges here yet: SAVE AS stores the machine -", a, "centred");
		}
	};

	const var PresetList = Content.addPanel("PresetList", 0, 0);
	FrontPanel.props(PresetList, {
		"parentComponent": "PresetBrowser", "x": 60, "y": 146, "width": 1100, "height": ROW_HEIGHT * VISIBLE_ROWS,
		"saveInPreset": false, "allowCallbacks": "Clicks Only"
	});
	PresetList.data.rows = [];
	PresetList.data.offset = 0;
	PresetList.data.selected = -1;
	PresetList.data.rowHeight = ROW_HEIGHT;
	PresetList.setPaintRoutine(listPaint);

	const var state = { bank: 0, armed: false };

	inline function disarm()
	{
		state.armed = false;
		PresetDelete.set("text", "DELETE");
	}

	/** Rebuilds the list of the selected bank (FACTORY = Factory/..., USER = everything else). */
	inline function refreshList()
	{
		local all = Engine.getUserPresetList();
		local keys = [];
		local rows = [];
		local current = Engine.getCurrentUserPresetName();
		local i;
		local parts;
		local name;

		for (i = 0; i < all.length; i++)
		{
			parts = all[i].split("/");

			if ((parts[0] == "Factory") == (state.bank == 0))
				keys.push(all[i]);
		}

		keys.sortNatural();

		for (i = 0; i < keys.length; i++)
		{
			parts = keys[i].split("/");
			name = parts[parts.length - 1];
			rows.push({ "path": keys[i], "name": name,
			            "category": parts.length > 2 ? parts[parts.length - 2] : "",
			            "current": name == current });
		}

		PresetList.data.rows = rows;
		PresetList.data.offset = Math.range(PresetList.data.offset, 0, Math.max(0, rows.length - VISIBLE_ROWS));

		if (PresetList.data.selected >= rows.length)
			PresetList.data.selected = -1;

		PresetList.repaint();
	}

	inline function selectBank(bank)
	{
		state.bank = bank;
		BankFactory.setValue(bank == 0 ? 1 : 0);
		BankUser.setValue(bank == 1 ? 1 : 0);
		PresetList.data.offset = 0;
		PresetList.data.selected = -1;
		disarm();
		refreshList();
	}

	inline function selectedRow()
	{
		local i = PresetList.data.selected;
		return (i >= 0 && i < PresetList.data.rows.length) ? PresetList.data.rows[i] : undefined;
	}

	inline function isUserRow(row)
	{
		return isDefined(row) && row.path.split("/")[0] != "Factory";
	}

	inline function selectByName(name)
	{
		local i;

		for (i = 0; i < PresetList.data.rows.length; i++)
		{
			if (PresetList.data.rows[i].name == name)
				PresetList.data.selected = i;
		}

		PresetList.repaint();
	}

	/** Click a cartridge: select it and load it. */
	inline function clickRow(index)
	{
		local row;

		if (index < 0 || index >= PresetList.data.rows.length)
			return;

		disarm();
		PresetList.data.selected = index;
		row = PresetList.data.rows[index];
		NameInput.setValue(row.name);
		NameInput.set("text", row.name);
		Engine.loadUserPreset(presetRoot().getChildFile(row.path + ".preset"));
	}

	const var listMouse = function(event)
	{
		if (event.clicked)
			Presets.clickRow(this.data.offset + Math.floor(event.y / this.data.rowHeight));
	};

	PresetList.setMouseCallback(listMouse);

	// the cartridge label and the list follow every preset load (PREV / NEXT, browser, DAW session)
	const var presetHandler = Engine.createUserPresetHandler();

	presetHandler.setPostCallback(function(presetFile)
	{
		Presets.setName(Presets.presetName());
		Presets.refreshList();
	});

	inline function showBrowser(show)
	{
		disarm();
		Browser.set("visible", show);

		if (show)
			refreshList();
	}

	// ------------------------------------------------------------------- callbacks

	inline function onPrev(component, value)
	{
		if (value)
			Engine.loadPreviousUserPreset(false);
	}

	inline function onNext(component, value)
	{
		if (value)
			Engine.loadNextUserPreset(false);
	}

	/** Stores the machine as User/<name>.preset and shows it selected in the USER bank. */
	inline function saveAs(name)
	{
		Engine.saveUserPreset(presetRoot().createDirectory("User").getChildFile(name + ".preset"));
		setName(name);
		selectBank(1);
		selectByName(name);
	}

	/** Cartridge SAVE: the next free "User/JX-808 nnn" (rename it in BROWSE). */
	inline function onSave(component, value)
	{
		if (value)
			saveAs(nextFreeName());
	}

	inline function onSaveAs(component, value)
	{
		local name = ("" + NameInput.getValue()).trim();

		if (!value)
			return;

		disarm();
		saveAs(name == "" ? nextFreeName() : name);
	}

	inline function onRename(component, value)
	{
		local row = selectedRow();
		local name = ("" + NameInput.getValue()).trim();
		local wasCurrent;

		if (!value || !isUserRow(row) || name == "" || name == row.name)
			return;

		disarm();
		wasCurrent = row.current;

		if (presetRoot().getChildFile(row.path + ".preset").rename(name))
		{
			if (wasCurrent)
				setName(name);

			refreshList();
			selectByName(name);
		}
	}

	/** DELETE: the first press arms it (CONFIRM?), the second one deletes the user preset. */
	inline function onDelete(component, value)
	{
		local row = selectedRow();

		if (!value || !isUserRow(row))
			return;

		if (!state.armed)
		{
			state.armed = true;
			PresetDelete.set("text", "CONFIRM?");
			return;
		}

		disarm();
		presetRoot().getChildFile(row.path + ".preset").deleteFileOrDirectory();
		PresetList.data.selected = -1;
		refreshList();
	}

	inline function onBank(component, value)
	{
		// tabs: a click on the active one keeps it active
		selectBank(value ? (component.getId() == "BankUser" ? 1 : 0) : state.bank);
	}

	inline function onScroll(component, value)
	{
		local maxOffset = Math.max(0, PresetList.data.rows.length - VISIBLE_ROWS);

		if (!value)
			return;

		PresetList.data.offset = Math.range(PresetList.data.offset + (component.getId() == "ListDown" ? VISIBLE_ROWS - 1 : 1 - VISIBLE_ROWS), 0, maxOffset);
		PresetList.repaint();
	}

	inline function onBrowse(component, value)
	{
		if (value)
			showBrowser(true);
	}

	inline function onClose(component, value)
	{
		if (value)
			showBrowser(false);
	}

	const var PresetPrev = FrontPanel.addPanelButton("PresetPrev", "RearPage", Laf.smallButton, "PREV", 1097, 382, 46, 20, true);
	const var PresetNext = FrontPanel.addPanelButton("PresetNext", "RearPage", Laf.smallButton, "NEXT", 1149, 382, 46, 20, true);
	const var PresetSave = FrontPanel.addPanelButton("PresetSave", "RearPage", Laf.smallButton, "SAVE", 1097, 418, 46, 20, true);
	const var PresetBrowse = FrontPanel.addPanelButton("PresetBrowse", "RearPage", Laf.smallButton, "BROWSE", 1149, 418, 46, 20, true);

	PresetPrev.setControlCallback(onPrev);
	PresetNext.setControlCallback(onNext);
	PresetSave.setControlCallback(onSave);
	PresetBrowse.setControlCallback(onBrowse);
	BrowserClose.setControlCallback(onClose);
	PresetSaveAs.setControlCallback(onSaveAs);
	PresetRename.setControlCallback(onRename);
	PresetDelete.setControlCallback(onDelete);
	BankFactory.setControlCallback(onBank);
	BankUser.setControlCallback(onBank);
	ListUp.setControlCallback(onScroll);
	ListDown.setControlCallback(onScroll);
}
