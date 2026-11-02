/*  DRAG TO DAW (rear panel): the selected rhythm (PATTERN) or rhythm track (TRACK) as a MIDI
    file. GM drum notes on channel 10, accented steps with velocity 127 (others 90), so the
    file also plays back through JX808's own MIDI drum map. PRE-SCALE and SHUFFLE are applied.
*/

namespace MidiExport
{
	const var TICKS_PER_CLOCK = 40;   // 960 ticks per quarter / 24 tempo clocks
	const var TICKS_PER_BAR = 3840;
	const var NOTE_TICKS = 60;        // drums: short notes

	// memory row -> [GM note, note with the voice switch on (conga, claves, maracas)]
	const var NOTES = [[36, 36], [38, 38], [41, 64], [45, 63], [48, 62], [37, 75], [39, 70],
	                   [56, 56], [49, 49], [46, 46], [42, 42]];
	const var SWITCHES = ["", "", "LT_Conga", "MT_Conga", "HT_Conga", "RS_Claves", "CP_Maracas", "", "", "", ""];

	inline function addNote(events, type, note, velocity, tick)
	{
		local h = Engine.createMessageHolder();

		h.setType(type);
		h.setChannel(10);
		h.setNoteNumber(note);
		h.setVelocity(velocity);
		h.setTimestamp(tick);
		events.push(h);
	}

	inline function noteFor(row)
	{
		local alt = SWITCHES[row] != "" && Content.getComponent(SWITCHES[row]).getValue() == 1;
		return NOTES[row][alt ? 1 : 0];
	}

	/** Adds one measure of pattern p (1st part, then the 2nd part if it has one) at `start`.
	    Returns its length in ticks. */
	inline function addMeasure(events, p, start)
	{
		local stepTicks = FrontPanel.PRESCALE_CLOCKS[FrontPanel.S.preScale] * TICKS_PER_CLOCK;
		local swing = Math.round((Content.getComponent("Shuffle").getValue() - 50.0) / 50.0 * stepTicks);
		local pos = start;
		local part;
		local len;
		local i;
		local row;
		local tick;
		local velocity;

		for (part = 0; part < 2; part++)
		{
			len = Mem.getLength(p, part);

			if (part == 0 && len == 0)
				len = 16;

			for (i = 0; i < len; i++)
			{
				velocity = Mem.getStep(p, part, Mem.AC, i) == 1 ? 127 : 90;   // below 100: not an accent when it comes back in
				tick = pos + i * stepTicks + ((i % 2 == 1) ? swing : 0);

				for (row = 0; row < 11; row++)
				{
					if (Mem.getStep(p, part, row, i) == 1)
					{
						addNote(events, 1, noteFor(row), velocity, tick);
						addNote(events, 2, noteFor(row), 0, tick + NOTE_TICKS);
					}
				}
			}

			pos += len * stepTicks;
		}

		return pos - start;
	}

	inline function writeFile(name, events, ticks)
	{
		local f = FileSystem.getFolder(FileSystem.Temp).getChildFile(name + ".mid");

		f.writeMidiFile(events, {
			"NumBars": Math.max(1, Math.ceil(ticks / TICKS_PER_BAR)),
			"Nominator": 4, "Denominator": 4, "Tempo": FrontPanel.S.tempo
		});

		return f;
	}

	/** The selected rhythm with the BASIC-VARIATION switch: A, B, or A then B. */
	inline function patternFile()
	{
		local events = [];
		local r = FrontPanel.S.editRhythm;
		local v = FrontPanel.S.basicVariation;
		local variations = v == 0 ? [0] : (v == 2 ? [1] : [0, 1]);
		local name = "JX808 Rhythm " + parseInt(r + 1) + (v == 0 ? "A" : (v == 2 ? "B" : "AB"));
		local ticks = 0;
		local i;

		for (i = 0; i < variations.length; i++)
			ticks += addMeasure(events, Mem.patternIndex(r, variations[i]), ticks);

		return writeFile(name, events, ticks);
	}

	/** The selected rhythm track, measure by measure. */
	inline function trackFile()
	{
		local events = [];
		local t = FrontPanel.S.track;
		local ticks = 0;
		local m;

		for (m = 0; m < Mem.getNumMeasures(t); m++)
			ticks += addMeasure(events, Mem.getMeasure(t, m), ticks);

		return writeFile("JX808 Track " + parseInt(t + 1), events, ticks);
	}

	/** TRACK tile label: EMPTY while the selected rhythm track has no measures. */
	inline function trackLabel()
	{
		return Mem.getNumMeasures(FrontPanel.S.track) > 0 ? "TRACK" : "EMPTY";
	}

	// ------------------------------------------------------------------- import

	/** A MIDI file dropped on PATTERN: bar 1 -> variation A, bar 2 -> B of the selected rhythm.
	    GM drum notes, velocity >= 100 = accent, quantized to the nearest step (PRE-SCALE). */
	inline function importFile(path)
	{
		local data = FileSystem.fromAbsolutePath(path).loadAsMidiFile(0);
		local stepTicks = FrontPanel.PRESCALE_CLOCKS[FrontPanel.S.preScale] * TICKS_PER_CLOCK;
		local r = FrontPanel.S.editRhythm;
		local bars = 1;
		local i;
		local e;
		local step;
		local p;
		local key;

		if (!isDefined(data) || !isDefined(data.Events))
			return false;

		for (i = 0; i < data.Events.length; i++)
		{
			e = data.Events[i];

			if (e.isNoteOn() && Math.round(e.getTimestamp() / stepTicks) >= 16)
				bars = 2;
		}

		Mem.saveUndo();
		Mem.clearPattern(Mem.patternIndex(r, 0));

		if (bars == 2)
			Mem.clearPattern(Mem.patternIndex(r, 1));

		for (i = 0; i < data.Events.length; i++)
		{
			e = data.Events[i];
			key = "" + e.getNoteNumber();
			step = Math.round(e.getTimestamp() / stepTicks);

			if (!e.isNoteOn() || step >= 32 || !isDefined(FrontPanel.NOTE_ROWS[key]))
				continue;

			p = Mem.patternIndex(r, step >= 16 ? 1 : 0);
			Mem.setStep(p, 0, FrontPanel.NOTE_ROWS[key], step % 16, true);

			if (e.getVelocity() >= 100)
				Mem.setStep(p, 0, Mem.AC, step % 16, true);
		}

		FrontPanel.refreshLeds();
		return true;
	}

	// ------------------------------------------------------------------- drag tiles

	const var tilePaint = function(g)
	{
		var a = this.getLocalBounds(1);
		var cx = a[0] + a[2] / 2;

		g.setColour(this.data.hover ? 0xFF2C2C2E : 0xFF1A1A1A);
		g.fillRoundedRectangle(a, 3.0);
		g.setColour(this.data.isTrack && MidiExport.trackLabel() == "EMPTY" ? Colours.withAlpha(Theme.CREAM, 0.4) : Theme.CREAM);
		g.drawRoundedRectangle(a, 3.0, 1.0);
		g.setFont(Theme.FONT_BOLD, 11.0);
		g.drawAlignedText(this.data.isTrack ? MidiExport.trackLabel() : this.data.label, [a[0] + 4, a[1], a[2] - 22, a[3]], "centred");

		// drag arrow
		cx = a[0] + a[2] - 13;
		g.drawLine(cx, cx, a[1] + a[3] * 0.25, a[1] + a[3] * 0.75, 1.5);
		g.drawLine(cx - 4, cx, a[1] + a[3] * 0.55, a[1] + a[3] * 0.75, 1.5);
		g.drawLine(cx + 4, cx, a[1] + a[3] * 0.55, a[1] + a[3] * 0.75, 1.5);
	};

	const var tileMouse = function(event)
	{
		if (event.hover != this.data.hover)
		{
			this.data.hover = event.hover;
			this.repaint();
		}

		if (event.clicked)
			this.data.dragged = false;

		// the file is written when the drag starts, so it always has the current pattern
		if (event.drag && !this.data.dragged)
		{
			this.data.dragged = true;

			// an empty track would be a MIDI file without notes, which the DAW ignores
			if (this.data.isTrack && MidiExport.trackLabel() == "EMPTY")
				return;

			this.startExternalFileDrag(this.data.isTrack ? MidiExport.trackFile() : MidiExport.patternFile(), false, 0);
		}
	};

	inline function addTile(id, label, isTrack, cx)
	{
		local p = Content.addPanel(id, 0, 0);
		local b = Layout.box(cx, 609, 70, 30);

		FrontPanel.props(p, {
			"parentComponent": "RearPage", "x": b[0], "y": b[1], "width": b[2], "height": b[3],
			"saveInPreset": false, "allowCallbacks": "All Callbacks",
			"tooltip": isTrack ? "Drag into your DAW: the rhythm track composed in COMPOSE"
			                   : "Drag into your DAW: the selected rhythm as MIDI. Drop a MIDI clip here to import it (bar 1 = A, bar 2 = B)"
		});
		p.data.label = label;
		p.data.isTrack = isTrack;
		p.data.hover = false;
		p.data.dragged = false;
		p.setPaintRoutine(tilePaint);
		p.setMouseCallback(tileMouse);
		return p;
	}

	const var PatternTile = addTile("MidiPattern", "PATTERN", false, 1040);

	// drop a MIDI clip from the DAW on PATTERN to import it
	PatternTile.setFileDropCallback("Drop Only", "*.mid", function(f)
	{
		if (f.drop)
			MidiExport.importFile(f.fileName);
	});
	const var TrackTile = addTile("MidiTrack", "TRACK", true, 1120);
}
