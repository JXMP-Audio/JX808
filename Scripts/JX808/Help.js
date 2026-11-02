/*  HELP: tooltips for every control, shown in a bar at the bottom of the window while HELP is on
    (the exported plugin only shows tooltips in a TooltipPanel). Off by default, so the panel
    keeps its vintage look.
*/

namespace Help
{
	const var VOICES = { "BD": "bass drum", "SD": "snare drum", "LT": "low tom / low conga",
	                     "MT": "mid tom / mid conga", "HT": "high tom / high conga", "RS": "rim shot / claves",
	                     "CP": "hand clap / maracas", "CB": "cowbell", "CY": "cymbal", "OH": "open hihat",
	                     "CH": "closed hihat" };

	const var TEXT = {
		"Power": "POWER: off stops the sequencer and mutes the output (the red OFF lamp stays on)",
		"FrontFlip": "REAR: turn the machine around (DAW sync, MIDI, groove, presets, MIDI export)",
		"RearFlip": "FRONT: back to the front panel",
		"HelpFront": "HELP: show / hide this help bar",
		"HelpRear": "HELP: show / hide this help bar",
		"Mode": "MODE: PATTERN CLEAR, 1st / 2nd PART (write), MANUAL PLAY, PLAY and COMPOSE (rhythm tracks)",
		"InstrumentSelect": "INSTRUMENT-SELECT: the instrument you write in 1st / 2nd PART; the rhythm track 1-12 in PLAY and COMPOSE",
		"Clear": "CLEAR: clears the rhythm / row / track. Hold + step key: last step. Hold + TAP: undo. TAP held + CLEAR: copy A <-> B",
		"AutoFill": "AUTO FILL IN: play the fill rhythm every 16, 12, 8, 4 or 2 measures (MANUAL = only with TAP)",
		"Tempo": "TEMPO: 40-300 BPM (ignored while SYNC = DAW)",
		"TempoFine": "FINE: tempo fine tune, +-4 BPM",
		"Accent": "ACCENT: how much louder accented steps are",
		"MasterVolume": "MASTER VOLUME",
		"BasicVariation": "BASIC-VARIATION: play A, B or A and B in turn. In write modes: A or B is the variation you edit",
		"PreScale": "PRE-SCALE: step length 1 = 8th triplet, 2 = 16th triplet, 3 = 16th, 4 = 32nd",
		"IFVariation": "I/F-VARIATION: variation of the intro / fill rhythm",
		"StartStop": "START/STOP (ignored while SYNC = DAW: the DAW transport runs the machine)",
		"ClearTouch": "CLEAR: clears the rhythm / row / track. RIGHT CLICK holds it: then a step key = last step, TAP = undo",
		"TapTouch": "TAP: write / add to track / INTRO, FILL IN. RIGHT CLICK holds it: then CLEAR = copy A <-> B, PATTERN CLEAR + step key = copy the rhythm",
		"Tap": "TAP: write at the playing step / add to track / INTRO, FILL IN. PATTERN CLEAR: hold + step key copies the rhythm there",
		"SyncHost": "SYNC: INT = own tempo, DAW = tempo, start / stop and song position follow the DAW",
		"MidiProgram": "MIDI PROGRAMMING: write patterns from a MIDI keyboard, STEP (stopped) or REAL-TIME (running)",
		"MidiOut": "SEQ -> MIDI OUT: the sequencer also sends its hits as MIDI notes (GM drums, channel 10) to the DAW",
		"VelocityMode": "VELOCITY: ACCENT = notes from 100 up are accented; DYNAMIC = velocity sets the level",
		"PitchMode": "PITCH: MIDI notes on the PITCH channel play the TARGET drum at their pitch (808 bass)",
		"PitchTarget": "TARGET: the drum the PITCH channel plays",
		"PitchChannel": "CHANNEL: MIDI channel for PITCH (ALL = every channel)",
		"PitchBendRange": "BEND: pitch bend range in semitones",
		"Glide": "GLIDE: slide time between overlapping notes",
		"Shuffle": "SHUFFLE: 50 % straight, 66 % triplet feel, up to 75 %",
		"Drive": "DRIVE: saturation of the output",
		"Age": "AGE: hits up to 4 ms late and uneven in level, like a worn machine",
		"MidiPattern": "Drag into your DAW: the selected rhythm as MIDI. Drop a MIDI clip here to import it (bar 1 = A, bar 2 = B)",
		"MidiTrack": "Drag into your DAW: the rhythm track chosen with INSTRUMENT-SELECT in PLAY / COMPOSE, as composed in COMPOSE (EMPTY = nothing composed yet)",
		"Cartridge": "MEMORY CARTRIDGE: the loaded preset (panel, patterns and rhythm tracks)",
		"PresetPrev": "PREV: load the previous preset",
		"PresetNext": "NEXT: load the next preset",
		"PresetSave": "SAVE: store the machine as a new user preset (rename it in BROWSE)",
		"PresetBrowse": "BROWSE: the cartridge browser (factory and user presets, save as, rename, delete)"
	};

	/** Tooltip for a voice control, e.g. "BD_Decay" -> "DECAY of the bass drum". */
	inline function voiceText(id)
	{
		local parts = id.split("_");
		local switchText = { "Conga": "switch tom / conga", "Claves": "switch rim shot / claves", "Maracas": "switch hand clap / maracas" };

		if (parts.length != 2 || !isDefined(VOICES[parts[0]]))
			return "";

		if (isDefined(switchText[parts[1]]))
			return parts[0] + ": " + switchText[parts[1]];

		return parts[1].toUpperCase() + " of the " + VOICES[parts[0]];
	}

	inline function applyTooltips()
	{
		local i;
		local id;
		local c;

		for (id in TEXT)
		{
			c = Content.getComponent(id);

			if (isDefined(c))
				FrontPanel.props(c, { "tooltip": TEXT[id] });
		}

		for (i = 0; i < FrontPanel.paramIds.length; i++)
		{
			id = FrontPanel.paramIds[i];

			if (voiceText(id) != "")
				FrontPanel.props(Content.getComponent(id), { "tooltip": voiceText(id) });
		}

		for (i = 0; i < FrontPanel.MUTE_IDS.length; i++)
			FrontPanel.props(Content.getComponent(FrontPanel.MUTE_IDS[i]), { "tooltip": "Click: mute / unmute this voice" });

		for (i = 1; i <= 16; i++)
			FrontPanel.props(Content.getComponent("Step" + i),
			                 { "tooltip": "STEP " + i + ": write modes toggle the step; MANUAL PLAY: keys 1-12 rhythm, 13-16 fill" });
	}

	// ------------------------------------------------------------------- help bar

	const var HelpBar = Content.addFloatingTile("HelpBar", 0, 0);
	FrontPanel.props(HelpBar, {
		"x": 0, "y": 734, "width": 1280, "height": 28, "visible": false, "saveInPreset": false,
		"Font": Theme.FONT_BOLD, "FontSize": 14, "bgColour": 0xF0141415, "textColour": Theme.CREAM,
		"itemColour": Theme.ORANGE
	});
	HelpBar.setContentData({ "Type": "TooltipPanel" });

	inline function onHelp(component, value)
	{
		if (value)
			HelpBar.set("visible", !HelpBar.get("visible"));
	}

	const var HelpFront = FrontPanel.addPanelButton("HelpFront", "FrontPage", Laf.smallButton, "HELP", 1110, 84, 40, 16, true);
	const var HelpRear = FrontPanel.addPanelButton("HelpRear", "RearPage", Laf.smallButton, "HELP", 1096, 78, 46, 16, true);

	HelpFront.setControlCallback(onHelp);
	HelpRear.setControlCallback(onHelp);

	applyTooltips();
}
