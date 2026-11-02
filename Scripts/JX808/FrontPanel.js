/*  JX-808 front panel, laid out as a vintage drum machine, plus the page flip and the panel logic.

    The panel logic plays the role of the 808's uPD650C CPU front end: it reads the switches,
    edits the pattern memory and drives the LEDs. Timing-critical work (tempo clock,
    sequencing, trigger gates) runs inside the C++ node.

    Selectors are stepped sliders (values 1..N, as the combo boxes of 1.0.0), slide switches
    are panels with a value, LEDs are small panels. Coordinates are mockup units (Layout).
*/

namespace FrontPanel
{
	const var WIDTH = 1280;
	const var HEIGHT = 762;

	// MODE selector positions
	const var M_CLEAR = 0;
	const var M_1ST = 1;
	const var M_2ND = 2;
	const var M_MANUAL = 3;
	const var M_PLAY = 4;
	const var M_COMPOSE = 5;

	// INSTRUMENT SELECT position -> memory row (Mem.*)
	const var INSTRUMENT_ROWS = [11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

	// GM drum note -> memory row (for MIDI programming; same map as jx808::Engine::mapNote)
	const var NOTE_ROWS = {
		"35": 0, "36": 0, "37": 5, "38": 1, "40": 1, "39": 6, "41": 2, "43": 2, "45": 3, "47": 3,
		"48": 4, "50": 4, "42": 10, "44": 10, "46": 9, "49": 8, "57": 8, "56": 7,
		"64": 2, "63": 3, "62": 4, "75": 5, "70": 6
	};
	const var REST_NOTE = 24;   // step input: skip one step
	const var BACK_NOTE = 23;   // step input: cursor back one step
	const var PRESCALE_CLOCKS = [8, 4, 6, 3];

	const var S = {
		mode: M_MANUAL, instrument: 1, rhythm: 0, editRhythm: 0, fill: 0, track: 0, basicVariation: 0,
		running: false, power: true, clearHeld: false, clearUsed: false, tapHeld: false,
		clearLatched: false, tapLatched: false, latchTime: 0.0, startLamp: 0.0, lampTime: 0.0, glowTime: 0.0,
		bootStart: Engine.getUptime(),   // POWER ON self-test (light sweep over the step keys), -1 = done
		midiProgram: 0, velocityMode: 0, pitchOn: false, pitchChannel: 0,
		cursor: 0, groupOpen: false, lastNoteTime: 0.0,
		posStep: -1, posPart: 0, posPattern: 0, posMeasure: 0, lastStepTime: 0.0,
		fillReset: 0, sync: false, tempo: 120.0, preScale: 2
	};

	const var paramMap = {};    // id -> node parameter (value as is)
	const var indexMap = {};    // id -> node parameter (value - 1, the former combo boxes)
	const var paramIds = [];
	const var defaults = {};    // id -> panel default value (factory presets start from these)

	// ------------------------------------------------------------------- builders

	// components have no script-side setPropertiesFromJSON, only Content does
	inline function props(component, json)
	{
		Content.setPropertiesFromJSON(component.getId(), json);
	}

	inline function place(component, cx, cy, w, h)
	{
		local b = Layout.box(cx, cy, w, h);
		props(component, { "x": b[0], "y": b[1], "width": b[2], "height": b[3] });
	}

	/** Slide switches are panels and must be redrawn after a value change; sliders redraw themselves. */
	inline function redraw(component)
	{
		if (component.get("type") == "ScriptPanel")
			component.repaint();
	}

	inline function onParamControl(component, value)
	{
		local param = paramMap[component.getId()];

		redraw(component);
		Dsp.set(param, (param == Dsp.P.MasterVolume && !S.power) ? 0 : value);
	}

	inline function addKnobControl(id, page, laf, cx, cy, size, min, max, step, def)
	{
		local k = Content.addKnob(id, 0, 0);
		local mods;

		props(k, { "parentComponent": page, "min": min, "max": max, "stepSize": step, "defaultValue": def,
		           "saveInPreset": true, "showValuePopup": "Above" });
		place(k, cx, cy, size, size);
		k.setLocalLookAndFeel(laf);
		k.setValue(def);   // "defaultValue" alone leaves a new instance at 0; saved state overrides this

		// Shift (or Ctrl / Cmd) + drag = fine tune; HISE puts typing a value on Shift, move it to Alt.
		// Double click (reset) and the mouse wheel are HISE defaults.
		mods = k.createModifiers();
		k.setModifiers(mods.FineTune, mods.shiftDown | mods.ctrlDown | mods.cmdDown);
		k.setModifiers(mods.TextInput, mods.altDown);
		defaults[id] = def;
		return k;
	}

	inline function addParamKnob(id, page, laf, param, cx, cy, size, min, max, step, def)
	{
		local k = addKnobControl(id, page, laf, cx, cy, size, min, max, step, def);

		paramMap[id] = param;
		paramIds.push(id);
		k.setControlCallback(onParamControl);
		return k;
	}

	/** Rotary selector with positions 1..n (the 1.0.0 combo box values). */
	inline function addSelector(id, page, laf, cx, cy, size, n, def)
	{
		local k = addKnobControl(id, page, laf, cx, cy, size, 1, n, 1, def);

		props(k, { "showValuePopup": "No" });
		k.setValue(def);
		return k;
	}

	inline function onIndexControl(component, value)
	{
		local id = component.getId();

		redraw(component);
		Dsp.set(indexMap[id], value - 1);

		if (id == "PreScale")
			S.preScale = value - 1;
		else if (id == "VelocityMode")
			S.velocityMode = value - 1;
		else if (id == "PitchChannel")
			S.pitchChannel = value - 1;
		else if (id == "FillSelect")
			S.fill = value - 1;
	}

	inline function registerIndex(component, param)
	{
		indexMap[component.getId()] = param;
		paramIds.push(component.getId());
		component.setControlCallback(onIndexControl);
	}

	inline function addIndexSelector(id, page, laf, param, cx, cy, size, n, def)
	{
		local k = addSelector(id, page, laf, cx, cy, size, n, def);

		registerIndex(k, param);
		return k;
	}

	inline function addHidden(id, n, def)
	{
		local k = Content.addKnob(id, 0, 0);

		props(k, { "visible": false, "min": 1, "max": n, "stepSize": 1, "defaultValue": def, "saveInPreset": true });
		k.setValue(def);
		defaults[id] = def;
		return k;
	}

	// slide switch: data.values lists the values from top / left to bottom / right
	const var slidePaint = function(g)
	{
		var n = this.data.values.length;
		var idx = Math.max(0, this.data.values.indexOf(this.getValue()));
		var v = n > 1 ? idx / (n - 1) : 0;

		if (this.data.vertical)
			Draw.slideV(g, this.getLocalBounds(2), v);
		else
			Draw.slideH(g, this.getLocalBounds(2), v);
	};

	const var slideMouse = function(event)
	{
		var b;
		var n;
		var t;
		var v;

		if (event.clicked || event.drag)
		{
			b = this.getLocalBounds(0);
			n = this.data.values.length;
			t = this.data.vertical ? event.y / b[3] : event.x / b[2];
			v = this.data.values[Math.range(Math.floor(t * n), 0, n - 1)];

			if (v != this.getValue())
			{
				this.setValue(v);
				this.changed();
				this.repaint();
			}
		}
	};

	inline function addSlide(id, page, cx, cy, w, h, values, def)
	{
		local p = Content.addPanel(id, 0, 0);

		// "defaultValue": HISE resets saved controls that a restored state doesn't contain to it
		props(p, { "parentComponent": page, "saveInPreset": true, "allowCallbacks": "Clicks, Hover & Dragging",
		           "defaultValue": def });
		place(p, cx, cy, w + 4, h + 4);
		p.data.values = values;
		p.data.vertical = h > w;
		p.setValue(def);
		defaults[id] = def;
		p.setPaintRoutine(slidePaint);
		p.setMouseCallback(slideMouse);
		return p;
	}

	inline function addIndexSlide(id, page, param, cx, cy, w, h, values, def)
	{
		local p = addSlide(id, page, cx, cy, w, h, values, def);

		registerIndex(p, param);
		return p;
	}

	inline function addParamSlide(id, page, param, cx, cy, w, h, values, def)
	{
		local p = addSlide(id, page, cx, cy, w, h, values, def);

		paramMap[id] = param;
		paramIds.push(id);
		p.setControlCallback(onParamControl);
		return p;
	}

	inline function addPanelButton(id, page, laf, text, cx, cy, w, h, momentary)
	{
		local b = Content.addButton(id, 0, 0);

		props(b, { "parentComponent": page, "text": text, "isMomentary": momentary, "saveInPreset": false });
		place(b, cx, cy, w, h);
		b.setLocalLookAndFeel(laf);
		return b;
	}

	const var ledPaint = function(g)
	{
		var b = this.getLocalBounds(0);
		Draw.lamp(g, b[2] / 2, b[3] / 2, b[2] * 0.24, this.data.glow, this.data.lit);
	};

	const var LEDS = [];   // lamp panels, their glow follows data.on (glowLeds)

	inline function addLed(id, page, cx, cy)
	{
		local p = Content.addPanel(id, 0, 0);

		props(p, { "parentComponent": page, "saveInPreset": false, "allowCallbacks": "No Callbacks" });
		place(p, cx, cy, 12, 12);
		p.data.on = false;
		p.data.glow = 0.0;         // drawn level, follows data.on like a bulb (glowLeds)
		p.data.lit = 0xFFFF3020;   // red
		LEDS.push(p);
		p.setPaintRoutine(ledPaint);
		return p;
	}

	inline function addLamp(id, page, cx, cy, colour)
	{
		local p = addLed(id, page, cx, cy);

		p.data.lit = colour;
		return p;
	}

	inline function setLed(led, on)
	{
		if (led.data.on != on)
		{
			led.data.on = on;
			led.repaint();
		}
	}

	// ------------------------------------------------------------------- pages

	const var FrontPage = Content.addPanel("FrontPage", 0, 0);
	props(FrontPage, { "width": WIDTH, "height": HEIGHT, "saveInPreset": false, "allowCallbacks": "No Callbacks" });
	FrontPage.setPaintRoutine(function(g) { Art.paintFront(g); });

	const var RearPage = Content.addPanel("RearPage", 0, 0);
	props(RearPage, { "width": WIDTH, "height": HEIGHT, "saveInPreset": false, "allowCallbacks": "No Callbacks", "visible": false });
	RearPage.setPaintRoutine(function(g) { Art.paintRear(g); });

	// ------------------------------------------------------------------- voice section

	// [id, node parameter, knob row]
	const var voices = [
		{ knobs: [["Accent", Dsp.P.Accent, 0]] },
		{ knobs: [["BD_Level", Dsp.P.BD_Level, 0], ["BD_Tone", Dsp.P.BD_Tone, 1], ["BD_Decay", Dsp.P.BD_Decay, 2]] },
		{ knobs: [["SD_Level", Dsp.P.SD_Level, 0], ["SD_Tone", Dsp.P.SD_Tone, 1], ["SD_Snappy", Dsp.P.SD_Snappy, 2]] },
		{ knobs: [["LT_Level", Dsp.P.LT_Level, 0], ["LT_Tuning", Dsp.P.LT_Tuning, 1]], sw: ["LT_Conga", Dsp.P.LT_Conga] },
		{ knobs: [["MT_Level", Dsp.P.MT_Level, 0], ["MT_Tuning", Dsp.P.MT_Tuning, 1]], sw: ["MT_Conga", Dsp.P.MT_Conga] },
		{ knobs: [["HT_Level", Dsp.P.HT_Level, 0], ["HT_Tuning", Dsp.P.HT_Tuning, 1]], sw: ["HT_Conga", Dsp.P.HT_Conga] },
		{ knobs: [["RS_Level", Dsp.P.RS_Level, 0]], sw: ["RS_Claves", Dsp.P.RS_Claves] },
		{ knobs: [["CP_Level", Dsp.P.CP_Level, 0]], sw: ["CP_Maracas", Dsp.P.CP_Maracas] },
		{ knobs: [["CB_Level", Dsp.P.CB_Level, 0]] },
		{ knobs: [["CY_Level", Dsp.P.CY_Level, 0], ["CY_Tone", Dsp.P.CY_Tone, 1], ["CY_Decay", Dsp.P.CY_Decay, 2]] },
		{ knobs: [["OH_Level", Dsp.P.OH_Level, 0], ["OH_Decay", Dsp.P.OH_Decay, 2]] },
		{ knobs: [["CH_Level", Dsp.P.CH_Level, 0]] }
	];

	inline function createVoiceSection()
	{
		local vi;
		local ki;
		local v;
		local kd;
		local cx;

		for (vi = 0; vi < voices.length; vi++)
		{
			v = voices[vi];
			cx = Layout.voiceX(vi);

			for (ki = 0; ki < v.knobs.length; ki++)
			{
				kd = v.knobs[ki];
				addParamKnob(kd[0], "FrontPage", kd[2] == 0 ? Laf.voiceOrange : Laf.voiceWhite, kd[1],
				             cx, Layout.KNOB_Y[kd[2]], 38, 0.0, 1.0, 0.01,
				             kd[0] == "Accent" ? 0.6 : (kd[2] == 0 ? 0.75 : 0.5));
			}

			// two way switch: upper position = conga / claves / maracas (1)
			if (isDefined(v.sw))
				addParamSlide(v.sw[0], "FrontPage", v.sw[1], cx, 350, 10, 24, [1, 0], 0);
		}
	}

	createVoiceSection();

	// voice mutes: click a voice name (the cream label) to mute / unmute it
	const var MUTE_IDS = ["MuteBD", "MuteSD", "MuteLT", "MuteMT", "MuteHT", "MuteRS", "MuteCP",
	                      "MuteCB", "MuteCY", "MuteOH", "MuteCH"];
	const var mutePanels = [];

	const var mutePaint = function(g)
	{
		var a = this.getLocalBounds(0);

		if (this.getValue() == 1)
		{
			g.setColour(0xF0303032);
			g.fillRoundedRectangle(a, 1.5);
			g.setColour(Theme.RED);
			g.setFont(Theme.FONT_BOLD, 10.0);
			g.drawAlignedText("MUTE", a, "centred");
		}
	};

	const var muteMouse = function(event)
	{
		if (event.clicked)
		{
			this.setValue(1 - this.getValue());
			this.changed();
		}
	};

	inline function pushMutes()
	{
		local mask = 0;
		local i;

		for (i = 0; i < mutePanels.length; i++)
		{
			if (mutePanels[i].getValue() == 1)
				mask = mask | (1 << i);
		}

		Dsp.set(Dsp.P.MuteMask, mask);
	}

	inline function onMute(component, value)
	{
		component.repaint();
		pushMutes();
	}

	inline function createMutes()
	{
		local i;
		local p;

		for (i = 0; i < MUTE_IDS.length; i++)
		{
			p = Content.addPanel(MUTE_IDS[i], 0, 0);
			props(p, { "parentComponent": "FrontPage", "saveInPreset": true, "allowCallbacks": "Clicks Only", "defaultValue": 0 });
			place(p, Layout.voiceX(i + 1), 382, 64, 20);
			p.setValue(0);
			defaults[MUTE_IDS[i]] = 0;
			p.setPaintRoutine(mutePaint);
			p.setMouseCallback(muteMouse);
			p.setControlCallback(onMute);
			mutePanels.push(p);
		}
	}

	createMutes();

	const var MasterVolume = addParamKnob("MasterVolume", "FrontPage", Laf.big270, Dsp.P.MasterVolume, 1136, 436, 54, 0.0, 1.0, 0.01, 0.8);

	// ------------------------------------------------------------------- rhythm section

	const var Power = addPanelButton("Power", "FrontPage", Laf.rocker, "", 142, 93, 40, 30, false);
	const var FrontFlip = addPanelButton("FrontFlip", "FrontPage", Laf.smallButton, "REAR", 1155, 84, 40, 16, true);

	const var Mode = addSelector("Mode", "FrontPage", Laf.modeKnob, 152, 210, 68, 6, M_MANUAL + 1);
	const var Instrument = addSelector("InstrumentSelect", "FrontPage", Laf.big300, 264, 218, 40, 12, 2);
	const var AutoFill = addIndexSelector("AutoFill", "FrontPage", Laf.autoFillKnob, Dsp.P.AutoFill, 264, 310, 58, 6, 1);
	const var ClearButton = addPanelButton("Clear", "FrontPage", Laf.redButton, "", 152, 280, 20, 20, true);

	const var Tempo = addKnobControl("Tempo", "FrontPage", Laf.big300, 160, 410, 102, 40.0, 300.0, 0.1, 120.0);
	props(Tempo, { "middlePosition": 120.0, "suffix": " BPM" });
	const var TempoFine = addKnobControl("TempoFine", "FrontPage", Laf.big270, 270, 440, 36, -4.0, 4.0, 0.01, 0.0);
	props(TempoFine, { "suffix": " BPM", "middlePosition": 0.0 });   // HISE default -1 would be the middle of -4..4

	const var BasicVar = addSlide("BasicVariation", "FrontPage", 172, 531, 50, 12, [1, 2, 3], 1);
	const var PreScale = addIndexSlide("PreScale", "FrontPage", Dsp.P.PreScale, 277, 546, 10, 44, [1, 2, 3, 4], 3);
	const var IFVar = addIndexSlide("IFVariation", "FrontPage", Dsp.P.IFVariation, 1131, 531, 34, 12, [1, 2], 1);

	const var StartStop = addPanelButton("StartStop", "FrontPage", Laf.creamKey, "START|STOP", 171, 625, 96, 48, true);
	const var TapButton = addPanelButton("Tap", "FrontPage", Laf.creamKey, "TAP", 1130, 626, 50, 48, true);

	// no visible control of their own: driven by the step keys / INSTRUMENT-SELECT, saved in presets
	const var Rhythm = addHidden("Rhythm", 16, 1);
	const var Track = addHidden("Track", 12, 1);
	const var FillSelect = addHidden("FillSelect", 4, 1);
	registerIndex(FillSelect, Dsp.P.FillSelect);

	const var LedVarA = addLed("LedVarA", "FrontPage", 160, 568);
	const var LedVarB = addLed("LedVarB", "FrontPage", 190, 568);
	const var LedPart1 = addLed("LedPart1", "FrontPage", 278, 608);
	const var LedPart2 = addLed("LedPart2", "FrontPage", 278, 643);
	const var LedSync = addLed("LedSync", "FrontPage", 345, 440);
	const var LedSyncRear = addLed("LedSyncRear", "RearPage", 210, 255);
	const var LedPowerOn = addLamp("LedPowerOn", "FrontPage", 168, 84, Theme.LAMP_GREEN);
	const var LedPowerOff = addLamp("LedPowerOff", "FrontPage", 168, 103, Theme.LAMP_RED);

	// ------------------------------------------------------------------- step keys

	const var stepKeys = [];

	const var stepPaint = function(g)
	{
		var a = this.getLocalBounds(0);
		var c = Theme.KEY_COLOURS[Math.floor(this.data.index / 4)];
		var key = [1, 1, a[2] - 4, a[3] - 4];
		var lx = a[2] / 2 - 1;
		var ly = a[3] * 0.19;

		g.setColour(0x99000000);
		g.fillRoundedRectangle([3, 3, a[2] - 4, a[3] - 4], 2.0);
		g.setGradientFill([c[0], 0, 0, c[1], 0, a[3], false]);
		g.fillRoundedRectangle(key, 2.0);
		// years of playing: the middle is polished by fingers, the edges a bit grimy
		g.setGradientFill([0x24FFFFFF, a[2] / 2, a[3] * 0.62, 0x00FFFFFF, a[2] * 0.95, a[3] * 0.62, true]);
		g.fillRoundedRectangle(key, 2.0);
		g.setColour(0x1A000000);
		g.drawRoundedRectangle([2.5, 2.5, a[2] - 7, a[3] - 7], 2.0, 2.0);
		g.setColour(0x66000000);
		g.drawRoundedRectangle(key, 2.0, 1.0);
		Draw.led(g, lx, ly, 3.2, this.data.led, this.data.glow);

		if (this.data.cursor)
		{
			g.setColour(Theme.INK);
			g.drawEllipse([lx - 6.5, ly - 6.5, 13, 13], 1.5);
		}
	};

	const var NodeWarning = Content.addLabel("NodeWarning", 0, 0);
	props(NodeWarning, {
		"x": 390, "y": 340, "width": 500, "height": 40, "text": "COMPILE THE C++ NODE (see README)",
		"fontSize": 16, "fontStyle": "Bold", "textColour": Theme.ORANGE, "bgColour": 0xEE111111,
		"alignment": "centred", "editable": false, "saveInPreset": false, "visible": !Dsp.ready
	});

	// ======================================================================== logic

	inline function editVariation()
	{
		return S.basicVariation == 2 ? 1 : 0;
	}

	inline function editPart()
	{
		return S.mode == M_2ND ? 1 : 0;
	}

	inline function isWriteMode()
	{
		return S.mode == M_1ST || S.mode == M_2ND;
	}

	inline function isTrackMode()
	{
		return S.mode == M_PLAY || S.mode == M_COMPOSE;
	}

	inline function editPattern()
	{
		return Mem.patternIndex(S.editRhythm, editVariation());
	}

	inline function editRow()
	{
		return INSTRUMENT_ROWS[S.instrument];
	}

	inline function editLength()
	{
		local l = Mem.getLength(editPattern(), editPart());
		return (l == 0) ? 16 : l;
	}

	inline function pushNodeMode()
	{
		local nodeMode = Dsp.MODE_MANUAL;

		if (S.mode <= M_2ND)
			nodeMode = Dsp.MODE_EDIT;
		else if (S.mode >= M_PLAY)
			nodeMode = Dsp.MODE_TRACK;

		Dsp.set(Dsp.P.Mode, nodeMode);
		Dsp.set(Dsp.P.EditPart, editPart());
		Dsp.set(Dsp.P.EditVariation, editVariation());
		// the node plays the edited rhythm in CLEAR / write modes, the basic rhythm otherwise
		Dsp.set(Dsp.P.Pattern, S.mode <= M_2ND ? S.editRhythm : S.rhythm);
		Dsp.set(Dsp.P.TrackNumber, S.track);
	}

	inline function setRunning(shouldRun)
	{
		S.running = shouldRun;
		Dsp.set(Dsp.P.Run, shouldRun ? 1 : 0);
	}

	/** SYNC = DAW (and POWER on): the node follows the host tempo, transport and position. */
	inline function pushHostSync()
	{
		Dsp.set(Dsp.P.HostSync, (S.sync && S.power) ? 1 : 0);
	}

	inline function setTrack(t)
	{
		S.track = t;
		Track.setValue(t + 1);
		Dsp.set(Dsp.P.TrackNumber, t);
	}

	inline function applyTempo()
	{
		if (!S.sync)
			S.tempo = Math.range(Tempo.getValue() + TempoFine.getValue(), 40.0, 300.0);

		Dsp.set(Dsp.P.Tempo, S.tempo);
	}

	inline function refreshLeds()
	{
		local i;
		local led;
		local cursor;
		local p = editPattern();
		local part = editPart();
		local len = editLength();
		local playingHere = S.posStep >= 0;
		local varA;
		local varB;
		local part1;

		for (i = 0; i < 16; i++)
		{
			led = 0;
			cursor = false;

			if (isWriteMode())
			{
				if (i < len && Mem.getStep(p, part, editRow(), i))
					led = 1;

				if (playingHere && i == S.posStep)
					led = (led == 1) ? 2 : 1;  // running light inverts the programmed LED

				if (!S.running && S.midiProgram == 1)
					cursor = (i == ((S.cursor + (S.groupOpen ? 1 : 0)) % len));
			}
			else if (playingHere && i == S.posStep)
				led = 1;
			else if (S.mode == M_MANUAL && (i == S.rhythm || i == 12 + S.fill))
				led = 2;
			else if ((S.mode == M_CLEAR || S.mode == M_COMPOSE) && i == S.editRhythm)
				led = 2;

			if (!S.power)
			{
				led = 0;
				cursor = false;
			}

			if (stepKeys[i].data.led != led || stepKeys[i].data.cursor != cursor)
			{
				stepKeys[i].data.led = led;
				stepKeys[i].data.cursor = cursor;
				stepKeys[i].repaint();
			}
		}

		if (playingHere)
		{
			varA = S.posPattern % 2 == 0;
			varB = !varA;
			part1 = S.posPart == 0;
		}
		else if (isWriteMode())
		{
			varA = editVariation() == 0;
			varB = !varA;
			part1 = editPart() == 0;
		}
		else
		{
			varA = S.basicVariation != 2;
			varB = S.basicVariation != 0;
			part1 = true;
		}

		setLed(LedVarA, S.power && varA);
		setLed(LedVarB, S.power && varB);
		setLed(LedPart1, S.power && part1);
		setLed(LedPart2, S.power && !part1);
		setLed(LedPowerOn, S.power);
		setLed(LedPowerOff, !S.power);
		setLed(LedSync, S.power && S.sync);
		setLed(LedSyncRear, S.power && S.sync);
	}

	/** MANUAL PLAY: basic rhythm 1-12. CLEAR / COMPOSE: only the rhythm to clear / append. */
	inline function selectRhythm(r)
	{
		S.editRhythm = r;

		if (S.mode == M_MANUAL)
		{
			S.rhythm = r;
			Rhythm.setValue(r + 1);
		}

		pushNodeMode();
	}

	/** Keys 13-16: intro/fill rhythm 1-4, also the edit target (rhythm 13-16). */
	inline function selectFill(f)
	{
		S.editRhythm = 12 + f;

		if (S.mode == M_MANUAL)
		{
			S.fill = f;
			FillSelect.setValue(f + 1);
			Dsp.set(Dsp.P.FillSelect, f);
		}

		pushNodeMode();
	}

	/** Lets go of CLEAR / TAP held by a right click (see the touch areas below). */
	inline function releaseLatches()
	{
		if (S.clearLatched)
		{
			S.clearLatched = false;
			S.clearHeld = false;
			ClearButton.setValue(0);
			ClearButton.set("itemColour", 0);   // lamp off
		}

		if (S.tapLatched)
		{
			S.tapLatched = false;
			S.tapHeld = false;
			TapButton.setValue(0);
			TapButton.set("itemColour", 0);
		}
	}

	inline function onStepKey(index)
	{
		local p = editPattern();
		local part = editPart();

		if (!S.power)
			return;

		if (S.mode == M_CLEAR && S.tapHeld)
		{
			// TAP held + step key: copy the selected rhythm (A and B) onto rhythm `index`
			Mem.saveUndo();
			Mem.copyPattern(Mem.patternIndex(S.editRhythm, 0), Mem.patternIndex(index, 0));
			Mem.copyPattern(Mem.patternIndex(S.editRhythm, 1), Mem.patternIndex(index, 1));
			S.editRhythm = index;
			pushNodeMode();
		}
		else if (isWriteMode())
		{
			Mem.saveUndo();

			if (S.clearHeld)
			{
				Mem.setLength(p, part, index + 1);  // CLEAR held + step key = last step
				S.clearUsed = true;
			}
			else
			{
				if (part == 1 && Mem.getLength(p, 1) == 0)
					Mem.setLength(p, 1, 16); // programming the 2nd part creates it

				Mem.setStep(p, part, editRow(), index, !Mem.getStep(p, part, editRow(), index));
				S.cursor = index;
				S.groupOpen = true;
			}
		}
		else if (S.mode != M_PLAY)
		{
			if (index < 12)
				selectRhythm(index);
			else
				selectFill(index - 12);
		}

		refreshLeds();
	}

	// step keys are created here: their mouse callback calls onStepKey, which HISE must already know

	const var stepMouse = function(event)
	{
		if (event.clicked)
		{
			FrontPanel.onStepKey(this.data.index);
			FrontPanel.releaseLatches();   // a right-click-held CLEAR / TAP was used for this key
		}
	};

	inline function createStepKeys()
	{
		local si;
		local p;

		for (si = 0; si < 16; si++)
		{
			p = Content.addPanel("Step" + (si + 1), 0, 0);
			props(p, { "parentComponent": "FrontPage", "allowCallbacks": "Clicks Only", "saveInPreset": false });
			place(p, Layout.stepX(si), 629, 36, 60);
			p.data.index = si;
			p.data.led = 0;      // 0 off, 1 on, 2 dim
			p.data.glow = 0.0;   // drawn level of the LED (glowLeds)
			p.data.cursor = false;
			p.setPaintRoutine(stepPaint);
			p.setMouseCallback(stepMouse);
			stepKeys.push(p);
		}
	}

	createStepKeys();

	// ------------------------------------------------------------ MIDI programming

	inline function stepDuration()
	{
		return 60.0 / (S.tempo * 24.0) * PRESCALE_CLOCKS[S.preScale];
	}

	inline function writeMidiStep(row, step, velocity)
	{
		local p = editPattern();
		local part = editPart();

		Mem.saveUndo();

		if (part == 1 && Mem.getLength(p, 1) == 0)
			Mem.setLength(p, 1, 16);

		Mem.setStep(p, part, row, step, true);

		if (S.velocityMode == 0 && velocity >= 100)
			Mem.setStep(p, part, Mem.AC, step, true);
	}

	inline function handleMidiNote(note, velocity, channel)
	{
		local now = Engine.getUptime();
		local key = "" + note;
		local len;
		local step;

		if (S.midiProgram == 0 || !isWriteMode() || !S.power)
			return;

		if (S.pitchOn && (S.pitchChannel == 0 || S.pitchChannel == channel))
			return; // this note plays the pitched drum

		len = editLength();

		if (!S.running)
		{
			// STEP INPUT: notes closer than 50 ms form a chord on the same step
			if (S.groupOpen && (now - S.lastNoteTime) > 0.05)
			{
				S.cursor = (S.cursor + 1) % len;
				S.groupOpen = false;
			}

			if (note == REST_NOTE || note == BACK_NOTE)
			{
				if (S.groupOpen)
				{
					S.cursor = (S.cursor + 1) % len;
					S.groupOpen = false;
				}

				S.cursor = (note == REST_NOTE) ? (S.cursor + 1) % len : (S.cursor + len - 1) % len;
			}
			else if (isDefined(NOTE_ROWS[key]))
			{
				writeMidiStep(NOTE_ROWS[key], S.cursor, velocity);
				S.groupOpen = true;
			}

			S.lastNoteTime = now;
		}
		else if (isDefined(NOTE_ROWS[key]) && S.posStep >= 0)
		{
			// REAL-TIME: quantize to the nearest step
			step = S.posStep;

			if ((now - S.lastStepTime) > stepDuration() * 0.5)
				step = (step + 1) % len;

			writeMidiStep(NOTE_ROWS[key], step, velocity);
		}

		refreshLeds();
	}

	// ------------------------------------------------------------ control callbacks

	inline function onMode(component, value)
	{
		S.mode = value - 1;
		S.cursor = 0;
		S.groupOpen = false;

		if (isTrackMode())
			setTrack(S.instrument);

		pushNodeMode();
		refreshLeds();
	}

	inline function onInstrument(component, value)
	{
		S.instrument = value - 1;

		if (isTrackMode())
			setTrack(S.instrument);

		refreshLeds();
	}

	inline function onRhythm(component, value)
	{
		S.rhythm = value - 1;
		S.editRhythm = S.rhythm;
		pushNodeMode();
		refreshLeds();
	}

	inline function onTrack(component, value)
	{
		S.track = value - 1;
		Dsp.set(Dsp.P.TrackNumber, S.track);

		// PLAY / COMPOSE: INSTRUMENT-SELECT is the track knob, keep it on the restored track
		// (1.0.0 presets chose the track with the step keys)
		if (isTrackMode())
		{
			S.instrument = S.track;
			Instrument.setValue(value);
		}

		refreshLeds();
	}

	inline function onBasicVar(component, value)
	{
		component.repaint();
		S.basicVariation = value - 1;
		Dsp.set(Dsp.P.BasicVariation, S.basicVariation);
		Dsp.set(Dsp.P.EditVariation, editVariation());
		refreshLeds();
	}

	inline function onTempo(component, value)
	{
		applyTempo();
	}

	inline function onPower(component, value)
	{
		S.power = value == 1;

		if (!S.power)
			setRunning(false);
		else
			S.bootStart = Engine.getUptime();   // self-test sweep (glowLeds)

		pushHostSync();
		Dsp.set(Dsp.P.MasterVolume, S.power ? MasterVolume.getValue() : 0);
		refreshLeds();
	}

	inline function onStartStop(component, value)
	{
		// while synced the DAW transport starts and stops the sequencer
		if (value && S.power && !S.sync)
			setRunning(!S.running);
	}

	inline function onClear(component, value)
	{
		if (value)
		{
			S.clearHeld = true;
			S.clearUsed = false;

			// TAP held + CLEAR in a write mode: copy the edited variation into the other one
			if (S.tapHeld && isWriteMode() && S.power)
			{
				Mem.saveUndo();
				Mem.copyPattern(editPattern(), Mem.patternIndex(S.editRhythm, 1 - editVariation()));
				S.clearUsed = true;
				refreshLeds();
			}

			return;
		}

		S.clearHeld = false;

		if (S.clearUsed || !S.power)
			return;

		Mem.saveUndo();

		if (S.mode == M_CLEAR)
			Mem.clearPattern(editPattern());
		else if (isWriteMode())
			Mem.setMask(editPattern(), editPart(), editRow(), 0);
		else if (S.mode == M_COMPOSE)
			Mem.clearTrack(S.track);

		refreshLeds();
	}

	inline function triggerFill()
	{
		Dsp.set(Dsp.P.FillTrigger, 1);
		S.fillReset = 3; // released by the timer a few ticks later (the node looks for the rising edge)
	}

	inline function onTap(component, value)
	{
		S.tapHeld = value == 1;

		if (!value || !S.power)
			return;

		// CLEAR held + TAP: undo the last change of the pattern / track memory
		if (S.clearHeld)
		{
			Mem.undo();
			S.clearUsed = true;
			refreshLeds();
			return;
		}

		if (isWriteMode())
		{
			if (S.posStep >= 0)
			{
				Mem.saveUndo();
				Mem.setStep(editPattern(), editPart(), editRow(), S.posStep, true);
			}
		}
		else if (S.mode == M_COMPOSE)
		{
			Mem.saveUndo();
			Mem.appendMeasure(S.track, editPattern());
		}
		else if (S.mode == M_MANUAL || S.mode == M_PLAY)
			triggerFill();  // INTRO SET / FILL IN TRIGGER

		refreshLeds();
	}

	inline function showRear(rear)
	{
		FrontPage.set("visible", !rear);
		RearPage.set("visible", rear);
	}

	inline function onFlip(component, value)
	{
		if (value)
			showRear(!RearPage.get("visible"));
	}

	inline function onSync(component, value)
	{
		local bpm = Engine.getHostBpm();

		component.repaint();
		S.sync = value == 1;

		if (S.sync && bpm >= 40 && bpm <= 300)
		{
			S.tempo = bpm;
			Dsp.set(Dsp.P.Tempo, bpm);
		}
		else
			applyTempo();

		setRunning(false);
		pushHostSync();

		refreshLeds();
	}

	inline function onMidiProgram(component, value)
	{
		component.repaint();
		S.midiProgram = value - 1;
		S.cursor = 0;
		S.groupOpen = false;
		refreshLeds();
	}

	inline function onPitchMode(component, value)
	{
		S.pitchOn = value;
		Dsp.set(Dsp.P.PitchMode, value);
	}

	Mode.setControlCallback(onMode);
	Instrument.setControlCallback(onInstrument);
	Rhythm.setControlCallback(onRhythm);
	Track.setControlCallback(onTrack);
	BasicVar.setControlCallback(onBasicVar);
	Tempo.setControlCallback(onTempo);
	TempoFine.setControlCallback(onTempo);
	Power.setControlCallback(onPower);
	StartStop.setControlCallback(onStartStop);
	ClearButton.setControlCallback(onClear);
	TapButton.setControlCallback(onTap);
	props(ClearButton, { "itemColour": 0 });   // itemColour alpha = the lamp under the key (off)
	props(TapButton, { "itemColour": 0 });
	props(StartStop, { "itemColour": 0 });

	// ------------------------------------------------------------------- CLEAR / TAP touch areas
	// A mouse can't hold two keys at once. Touch areas over CLEAR and TAP pass left clicks on to the
	// key; a right click holds the key (shown pressed) until the next step key, CLEAR or TAP click.
	// A second right click, or a left click on the held key, lets go without doing anything.

	/** Holds (or lets go of) CLEAR / TAP as a pure modifier: no action of its own. */
	inline function toggleLatch(isClear)
	{
		local held = isClear ? S.clearLatched : S.tapLatched;

		releaseLatches();

		if (held)
			return;

		S.latchTime = Engine.getUptime();

		if (isClear)
		{
			S.clearLatched = true;
			S.clearHeld = true;
			S.clearUsed = false;
			ClearButton.setValue(1);
		}
		else
		{
			S.tapLatched = true;
			S.tapHeld = true;
			TapButton.setValue(1);
		}
	}

	/** Moves a lamp level towards on (1) or off (0) like a small bulb: it lights up in about 20 ms and
	    leaves an afterglow of about 90 ms. Returns the new level. */
	inline function bulb(level, on, dt)
	{
		local target = on ? 1.0 : 0.0;
		local next = level + (target - level) * (1.0 - Math.exp(-dt / (target > level ? 0.02 : 0.09)));

		return Math.abs(next - target) < 0.01 ? target : next;
	}

	/** Every timer tick: LEDs and the step key LEDs glow towards their state; repaint what changed. */
	inline function glowLeds()
	{
		local now = Engine.getUptime();
		local dt = Math.range(now - S.glowTime, 0.0, 0.2);
		local i;
		local p;
		local next;
		local sweep = -1;

		S.glowTime = now;

		// POWER ON self-test: one key after the other lights up, 35 ms each
		if (S.bootStart >= 0)
		{
			if (now - S.bootStart < 16 * 0.035 + 0.05)
				sweep = Math.floor((now - S.bootStart) / 0.035);
			else
				S.bootStart = -1;
		}

		for (i = 0; i < LEDS.length; i++)
		{
			p = LEDS[i];
			next = bulb(p.data.glow, p.data.on, dt);

			if (next != p.data.glow)
			{
				p.data.glow = next;
				p.repaint();
			}
		}

		for (i = 0; i < stepKeys.length; i++)
		{
			p = stepKeys[i];
			next = bulb(p.data.glow, sweep >= 0 ? (i == sweep) : (p.data.led == 1), dt);

			if (next != p.data.glow)
			{
				p.data.glow = next;
				p.repaint();
			}
		}
	}

	/** START/STOP is lit by the same kind of bulb while the sequencer runs: the filament warms up in
	    about 50 ms after START and cools down in about 130 ms after STOP. */
	inline function startLamp()
	{
		local now = Engine.getUptime();
		local dt = Math.range(now - S.lampTime, 0.0, 0.2);
		local target = (S.running && S.power) ? 1.0 : 0.0;
		local before = S.startLamp;

		S.lampTime = now;
		S.startLamp = S.startLamp + (target - S.startLamp) * (1.0 - Math.exp(-dt / (target > S.startLamp ? 0.045 : 0.13)));

		if (S.startLamp < 0.01)
			S.startLamp = 0.0;

		if (S.startLamp > 0.0 || before > 0.0)
			StartStop.set("itemColour", Colours.withAlpha(0xFFFFFFFF, S.startLamp * (0.97 + 0.03 * Math.sin(now * 53.0))));
	}

	/** A right-click-held CLEAR / TAP stays pressed while a small bulb under its plastic blinks like
	    an old indicator lamp: on for 0.55 s, off for 0.45 s. The filament warms up in about 50 ms and
	    cools down slower (130 ms), with a slight flicker. The lamp level travels to the look and feel
	    as the alpha of the key's itemColour. */
	inline function pulseLatches()
	{
		local t = Engine.getUptime() - S.latchTime;
		local phase = t - Math.floor(t);
		local level = phase < 0.55 ? 1.0 - Math.exp(-phase / 0.045)
		                           : (1.0 - Math.exp(-0.55 / 0.045)) * Math.exp(-(phase - 0.55) / 0.13);
		local colour;

		level = Math.range(level * (0.96 + 0.04 * Math.sin(t * 53.0)), 0.0, 1.0);
		colour = Colours.withAlpha(0xFFFFFFFF, level);

		startLamp();

		if (S.clearLatched)
		{
			if (ClearButton.getValue() != 1)
				ClearButton.setValue(1);

			ClearButton.set("itemColour", colour);
		}

		if (S.tapLatched)
		{
			if (TapButton.getValue() != 1)
				TapButton.setValue(1);

			TapButton.set("itemColour", colour);
		}
	}

	const var touchMouse = function(event)
	{
		var key = Content.getComponent(this.data.key);
		var isClear = this.data.key == "Clear";

		if (event.clicked)
		{
			this.data.down = false;

			if (event.rightClick)
				FrontPanel.toggleLatch(isClear);
			else if (isClear ? FrontPanel.S.clearLatched : FrontPanel.S.tapLatched)
				FrontPanel.releaseLatches();
			else
			{
				this.data.down = true;
				key.setValue(1);
				key.changed();
			}
		}
		else if (event.mouseUp && this.data.down)
		{
			this.data.down = false;
			key.setValue(0);
			key.changed();
			FrontPanel.releaseLatches();   // the other key was held for this one
		}
	};

	inline function addTouch(id, key, cx, cy, w, h)
	{
		local p = Content.addPanel(id, 0, 0);

		props(p, { "parentComponent": "FrontPage", "allowCallbacks": "Clicks Only", "saveInPreset": false });
		place(p, cx, cy, w, h);
		p.data.key = key;
		p.data.down = false;
		p.setMouseCallback(touchMouse);
		p.setPaintRoutine(function(g) {});   // invisible; without a routine HISE fills the panel
		return p;
	}

	const var ClearTouch = addTouch("ClearTouch", "Clear", 152, 280, 20, 20);
	const var TapTouch = addTouch("TapTouch", "Tap", 1130, 626, 50, 48);
	FrontFlip.setControlCallback(onFlip);

	// ------------------------------------------------------------------- host sync

	const var transport = Engine.createTransportHandler();

	transport.setOnTempoChange(false, function(bpm)
	{
		if (FrontPanel.S.sync && bpm >= 40 && bpm <= 300)
		{
			FrontPanel.S.tempo = bpm;
			Dsp.set(Dsp.P.Tempo, bpm);
		}
	});

	// start / stop / position: the node follows the host itself (HostSync, see jx808::Engine)

	// ------------------------------------------------------------------- LED timer

	const var ledTimer = Engine.createTimerObject();

	ledTimer.setTimerCallback(function()
	{
		var pos = Mem.getPosition();
		var changed = false;

		if (pos.step != FrontPanel.S.posStep || pos.part != FrontPanel.S.posPart || pos.pattern != FrontPanel.S.posPattern)
		{
			FrontPanel.S.posStep = pos.step;
			FrontPanel.S.running = pos.running;
			FrontPanel.S.posPart = pos.part;
			FrontPanel.S.posPattern = pos.pattern;
			FrontPanel.S.posMeasure = pos.measure;
			FrontPanel.S.lastStepTime = Engine.getUptime();
			changed = true;
		}

		if (FrontPanel.S.fillReset > 0)
		{
			FrontPanel.S.fillReset = FrontPanel.S.fillReset - 1;

			if (FrontPanel.S.fillReset == 0)
				Dsp.set(Dsp.P.FillTrigger, 0);
		}

		if (changed)
			FrontPanel.refreshLeds();

		FrontPanel.pulseLatches();
		FrontPanel.glowLeds();
	});

	ledTimer.startTimer(25);

	// ------------------------------------------------------------ push the current state to the node

	/** Called by Interface.js after RearPanel.js has created the rear controls. */
	inline function pushAll()
	{
		local i;
		local id;
		local c;

		for (i = 0; i < paramIds.length; i++)
		{
			id = paramIds[i];
			c = Content.getComponent(id);

			if (isDefined(indexMap[id]))
				Dsp.set(indexMap[id], c.getValue() - 1);
			else
				Dsp.set(paramMap[id], c.getValue());
		}

		Power.setValue(1);
		S.power = true;
		S.mode = Mode.getValue() - 1;
		S.instrument = Instrument.getValue() - 1;
		S.rhythm = Rhythm.getValue() - 1;
		S.editRhythm = S.rhythm;
		S.fill = FillSelect.getValue() - 1;
		S.track = isTrackMode() ? S.instrument : Track.getValue() - 1;
		S.basicVariation = BasicVar.getValue() - 1;
		S.preScale = PreScale.getValue() - 1;
		S.midiProgram = Content.getComponent("MidiProgram").getValue() - 1;
		S.velocityMode = Content.getComponent("VelocityMode").getValue() - 1;
		S.pitchOn = Content.getComponent("PitchMode").getValue();
		S.pitchChannel = Content.getComponent("PitchChannel").getValue() - 1;
		S.sync = Content.getComponent("SyncHost").getValue() == 1;
		pushHostSync();

		if (S.sync && Engine.getHostBpm() >= 40 && Engine.getHostBpm() <= 300)
			S.tempo = Engine.getHostBpm();

		applyTempo();
		Dsp.set(Dsp.P.BasicVariation, S.basicVariation);
		Dsp.set(Dsp.P.PitchMode, S.pitchOn);
		pushNodeMode();
		setRunning(false);
		showRear(false);
		pushMutes();
		refreshLeds();
	}
}
