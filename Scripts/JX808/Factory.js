/*  Factory presets: kits (sound + tempo + shuffle) with rhythm 1A, 1B, fill 13A and rhythm track 1.

    The .preset files in UserPresets/Factory are generated from these definitions by HISE
    itself: create an empty file ".generate-factory" in the user preset folder and start the
    app once. HISE embeds UserPresets/ into the plugin (HISE_OVERWRITE_OLD_USER_PRESETS
    re-extracts them when the version changes).
*/

namespace Factory
{
	// pattern rows: memory row per instrument name
	const var ROWS = { "BD": 0, "SD": 1, "LT": 2, "MT": 3, "HT": 4, "RS": 5, "CP": 6, "CB": 7,
	                   "CY": 8, "OH": 9, "CH": 10, "AC": 11 };

	// MANUAL PLAY, BASIC-VARIATION AB, auto fill every 8 measures with fill 1 (rhythm 13)
	const var COMMON = { "Mode": 4, "BasicVariation": 2, "AutoFill": 4, "FillSelect": 1, "IFVariation": 1,
	                     "Rhythm": 1, "InstrumentSelect": 2 };

	// rhythm track 1 of every kit: 1A 1A 1B 1B 1A 1A 1B 13A (pattern memory indices)
	const var TRACK1 = [0, 0, 1, 1, 0, 0, 1, 24];

	const var KITS = [
		{
			category: "Classic", name: "808 Basic",
			controls: { "Tempo": 118 },
			patterns: [
				[0,  { "BD": "x...x...x...x...", "CP": "....x.......x...", "CH": "x.x.x.x.x.x.x.x.", "OH": "..x...x...x...x.", "AC": "x...x...x...x..." }],
				[1,  { "BD": "x...x...x...x.x.", "SD": "....x.......x..x", "CH": "xxxxxxxxxxxxxxxx", "CB": "..x..x....x..x..", "AC": "x.......x......." }],
				[24, { "BD": "x...............", "SD": "....x.x.xxxxxxxx", "AC": "........x...x..." }]
			]
		},
		{
			category: "Electro", name: "Planet Electro",
			controls: { "Tempo": 127, "BD_Decay": 0.6, "SD_Snappy": 0.7, "CB_Level": 0.6 },
			patterns: [
				[0,  { "BD": "x.....x...x.....", "SD": "....x.......x...", "CH": "x.x.x.x.x.x.x.x.", "CB": "..x.....x.x.....", "AC": "x...x...x...x..." }],
				[1,  { "BD": "x.....x...x..x..", "CP": "....x.......x...", "CH": "x.x.x.x.x.x.xxxx", "HT": "..............x.", "CY": "x...............", "AC": "x.......x......." }],
				[24, { "BD": "x...............", "HT": "x.x.............", "MT": "....x.x.........", "LT": "........x.x.x.x.", "AC": "x...x...x...x..." }]
			]
		},
		{
			category: "Hip Hop", name: "Boom Bap",
			controls: { "Tempo": 90, "Shuffle": 58, "BD_Decay": 0.7, "BD_Tone": 0.3, "SD_Tone": 0.35 },
			patterns: [
				[0,  { "BD": "x......x..x.....", "SD": "....x.......x...", "CH": "x.x.x.x.x.x.x.x.", "OH": "..............x.", "RS": ".......x........", "AC": "x...x.......x..." }],
				[1,  { "BD": "x......x..x..x..", "SD": "....x.......x...", "CH": "x.x.x.x.xxx.x.x.", "CP": "............x...", "AC": "x...x.......x..." }],
				[24, { "BD": "x.....x.........", "SD": "....x...x.x.xxxx", "AC": "....x.......x..." }]
			]
		},
		{
			category: "Trap", name: "Trap 140",
			controls: { "Tempo": 140, "BD_Decay": 0.95, "BD_Tone": 0.2, "BD_Level": 0.9, "CH_Level": 0.6, "CP_Level": 0.8 },
			patterns: [
				[0,  { "BD": "x.........x.....", "CP": "........x.......", "CH": "x.x.x.x.x.x.x.x.", "OH": "......x.........", "AC": "x.......x......." }],
				[1,  { "BD": "x......x..x...x.", "CP": "........x.......", "CH": "xxxxx.x.xxxxx.x.", "SD": "..............x.", "AC": "x.......x......." }],
				[24, { "BD": "x.....x.x.......", "CP": "....x.......x...", "CH": "xxxxxxxxxxxxxxxx", "AC": "x...x...x...x..." }]
			]
		},
		{
			category: "House", name: "Deep House",
			controls: { "Tempo": 122, "Shuffle": 54, "LT_Conga": 1, "OH_Decay": 0.35, "RS_Level": 0.6 },
			patterns: [
				[0,  { "BD": "x...x...x...x...", "CP": "....x.......x...", "OH": "..x...x...x...x.", "CH": "x.x.x.x.x.x.x.x.", "AC": "x...x...x...x..." }],
				[1,  { "BD": "x...x...x...x...", "CP": "....x.......x..x", "OH": "..x...x...x...x.", "CH": "x.xxx.x.x.xxx.x.", "RS": "...x......x.....", "LT": "......x.......x.", "AC": "x...x...x...x..." }],
				[24, { "BD": "x...x...x...x...", "CP": "....x.x.x.xxxxxx", "AC": "x...x...x...x..." }]
			]
		},
		{
			category: "Miami Bass", name: "Miami 130",
			controls: { "Tempo": 130, "BD_Decay": 0.9, "CH_Level": 0.65, "CB_Level": 0.55 },
			patterns: [
				[0,  { "BD": "x..x..x...x..x..", "SD": "....x.......x...", "CH": "xxxxxxxxxxxxxxxx", "CB": "..x.....x.......", "AC": "x...x...x...x..." }],
				[1,  { "BD": "x..x..x...x..x.x", "CP": "....x.......x...", "CH": "xxxxxxxxxxxxxxxx", "CY": "x...............", "AC": "x...x...x...x..." }],
				[24, { "BD": "x..x..x.x.x.x.x.", "SD": "........x.x.xxxx", "AC": "x.......x...x..." }]
			]
		}
	];

	inline function setControl(id, value)
	{
		local c = Content.getComponent(id);

		c.setValue(value);
		c.changed();
	}

	/** Puts the whole machine into the state of a kit: panel defaults, kit settings, memory. */
	inline function apply(kit)
	{
		local id;
		local i;
		local p;
		local row;

		for (id in FrontPanel.defaults)
			setControl(id, FrontPanel.defaults[id]);

		for (id in COMMON)
			setControl(id, COMMON[id]);

		for (id in kit.controls)
			setControl(id, kit.controls[id]);

		for (i = 0; i < 32; i++)
			Mem.clearPattern(i);

		for (i = 0; i < 12; i++)
			Mem.clearTrack(i);

		for (i = 0; i < kit.patterns.length; i++)
		{
			p = kit.patterns[i][0];

			for (row in kit.patterns[i][1])
				Mem.setRow(p, 0, ROWS[row], kit.patterns[i][1][row]);
		}

		for (i = 0; i < TRACK1.length; i++)
			Mem.appendMeasure(0, TRACK1[i]);

		FrontPanel.refreshLeds();
	}

	/** Writes UserPresets/Factory/<category>/<name>.preset for every kit when the marker
	    file ".generate-factory" is in the user preset folder (see the comment at the top). */
	inline function generateIfRequested()
	{
		local root = FileSystem.getFolder(FileSystem.UserPresets);
		local marker = root.getChildFile(".generate-factory");
		local i;
		local dir;

		if (!marker.isFile())
			return;

		for (i = 0; i < KITS.length; i++)
		{
			apply(KITS[i]);
			dir = root.createDirectory("Factory").createDirectory(KITS[i].category);
			Engine.saveUserPreset(dir.getChildFile(KITS[i].name + ".preset"));
		}

		marker.deleteFileOrDirectory();
		apply(KITS[0]);
	}
}
