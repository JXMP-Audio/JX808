/*  Rear panel: the functions a vintage front panel doesn't have (DAW sync, MIDI drum programming,
    MIDI pitch mode).
    The logic lives in FrontPanel.
*/

namespace RearPanel
{
	const var RearFlip = FrontPanel.addPanelButton("RearFlip", "RearPage", Laf.smallButton, "FRONT", 1148, 78, 46, 16, true);
	RearFlip.setControlCallback(FrontPanel.onFlip);

	// SYNC: INT / DAW (0 / 1, the 1.0.0 SYNC button values)
	const var SyncHost = FrontPanel.addSlide("SyncHost", "RearPage", 210, 205, 70, 12, [0, 1], 0);
	SyncHost.setControlCallback(FrontPanel.onSync);

	// MIDI PROGRAMMING: OFF / STEP / REAL-TIME, VELOCITY: ACCENT >= 100 / DYNAMIC
	const var MidiProgram = FrontPanel.addSlide("MidiProgram", "RearPage", 430, 205, 90, 12, [1, 2, 3], 1);
	MidiProgram.setControlCallback(FrontPanel.onMidiProgram);
	const var VelocityMode = FrontPanel.addIndexSlide("VelocityMode", "RearPage", Dsp.P.VelocityMode, 580, 205, 80, 12, [1, 2], 1);

	// SEQ -> MIDI OUT: the sequencer also plays its hits as MIDI notes (GM drums, channel 10)
	const var MidiOut = FrontPanel.addParamSlide("MidiOut", "RearPage", Dsp.P.MidiOut, 625, 258, 40, 12, [0, 1], 0);

	// MIDI PITCH
	const var PitchMode = FrontPanel.addPanelButton("PitchMode", "RearPage", Laf.lever, "", 745, 213, 22, 38, false);
	FrontPanel.props(PitchMode, { "saveInPreset": true });
	PitchMode.setControlCallback(FrontPanel.onPitchMode);

	const var PitchTarget = FrontPanel.addIndexSelector("PitchTarget", "RearPage", Laf.big300, Dsp.P.PitchTarget, 850, 220, 56, 11, 1);
	const var PitchChannel = FrontPanel.addIndexSelector("PitchChannel", "RearPage", Laf.big300, Dsp.P.PitchChannel, 990, 220, 56, 17, 1);

	const var BendRange = FrontPanel.addParamKnob("PitchBendRange", "RearPage", Laf.voiceWhite, Dsp.P.PitchBendRange, 1080, 205, 38, 0.0, 12.0, 1.0, 2.0);
	const var Glide = FrontPanel.addParamKnob("Glide", "RearPage", Laf.voiceWhite, Dsp.P.Glide, 1080, 261, 38, 0.0, 1000.0, 1.0, 0.0);
	FrontPanel.props(Glide, { "suffix": " ms", "middlePosition": 150.0 });

	// GROOVE: shuffle (kept off the vintage front panel, so it lives on the back)
	const var Shuffle = FrontPanel.addParamKnob("Shuffle", "RearPage", Laf.voiceWhite, Dsp.P.Swing, 925, 535, 38, 50.0, 75.0, 0.1, 50.0);
	FrontPanel.props(Shuffle, { "suffix": " %" });

	// character: output saturation and a worn unit's timing / level spread
	const var Drive = FrontPanel.addParamKnob("Drive", "RearPage", Laf.voiceWhite, Dsp.P.Drive, 1025, 535, 38, 0.0, 1.0, 0.01, 0.0);
	const var Age = FrontPanel.addParamKnob("Age", "RearPage", Laf.voiceWhite, Dsp.P.Age, 1125, 535, 38, 0.0, 1.0, 0.01, 0.0);

	// AUDIO / MIDI SETUP: only the standalone app needs it, in a plugin the DAW owns audio and MIDI
	inline function addSetupTile(id, cx, cy, w, h, data)
	{
		local t = Content.addFloatingTile(id, 0, 0);
		local b = Layout.box(cx, cy, w, h);

		FrontPanel.props(t, {
			"parentComponent": "RearPage", "x": b[0], "y": b[1], "width": b[2], "height": b[3],
			"saveInPreset": false, "visible": !Engine.isPlugin(),
			"Font": Theme.FONT_BOLD, "FontSize": 13, "itemColour": Theme.CREAM, "itemColour2": Theme.DARK,
			"bgColour": 0, "textColour": Theme.PRINT
		});
		t.setContentData(data);
		return t;
	}

	const var AudioSetup = addSetupTile("AudioSetup", 295, 597, 350, 150, {
		"Type": "CustomSettings", "Driver": true, "Device": true, "Output": true, "BufferSize": true,
		"SampleRate": true, "GlobalBPM": false, "ScaleFactor": true, "ScaleFactorList": [0.75, 1.0, 1.25, 1.5], "GraphicRendering": false,
		"StreamingMode": false, "SustainCC": false, "VoiceAmount": false, "ClearMidiCC": false,
		"SampleLocation": false, "DebugMode": false
	});

	const var MidiSetup = addSetupTile("MidiSetup", 670, 597, 350, 150, { "Type": "MidiSources" });
}
