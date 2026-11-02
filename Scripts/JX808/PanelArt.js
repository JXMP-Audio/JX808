/*  Static silkscreen of the front and rear panel: everything printed on the metal.
    The controls draw themselves (LookAndFeel.js); this only paints the page backgrounds.
    Coordinates are mockup units (see Theme.js / Layout).
*/

namespace Art
{
	// ---------------------------------------------------------------- helpers (mockup units)

	inline function T(g, s, x, y, size, colour)
	{
		Draw.text(g, s, Layout.X(x), Layout.Y(y), Layout.S(size), colour, Theme.FONT_BOLD);
	}

	inline function Tn(g, s, x, y, size, colour)
	{
		Draw.text(g, s, Layout.X(x), Layout.Y(y), Layout.S(size), colour, Theme.FONT);
	}

	inline function TL(g, s, x, y, size, colour)
	{
		Draw.textLeft(g, s, Layout.X(x), Layout.Y(y), Layout.S(size), colour, Theme.FONT_BOLD);
	}

	inline function TLn(g, s, x, y, size, colour)
	{
		Draw.textLeft(g, s, Layout.X(x), Layout.Y(y), Layout.S(size), colour, Theme.FONT);
	}

	inline function line(g, x1, y1, x2, y2, colour, w)
	{
		g.setColour(colour);
		g.drawLine(Layout.X(x1), Layout.X(x2), Layout.Y(y1), Layout.Y(y2), w);
	}

	inline function rect(g, x, y, w, h, colour)
	{
		g.setColour(colour);
		g.fillRect([Layout.X(x), Layout.Y(y), Layout.S(w), Layout.S(h)]);
	}

	inline function frame(g, x, y, w, h, colour)
	{
		g.setColour(colour);
		g.drawRect([Layout.X(x), Layout.Y(y), Layout.S(w), Layout.S(h)], 1.0);
	}

	inline function greyRect(g, x, y, w, h)
	{
		g.setGradientFill([Theme.GREY_TOP, 0, Layout.Y(y), Theme.GREY_BOTTOM, 0, Layout.Y(y + h), false]);
		g.fillRect([Layout.X(x), Layout.Y(y), Layout.S(w), Layout.S(h)]);
	}

	/** Open polyline through [x0, y0, x1, y1, ...]. */
	inline function polyline(g, pts, colour)
	{
		local i;

		g.setColour(colour);

		for (i = 2; i < pts.length; i += 2)
			g.drawLine(Layout.X(pts[i - 2]), Layout.X(pts[i]), Layout.Y(pts[i - 1]), Layout.Y(pts[i + 1]), 1.0);
	}

	/** Filled polygon through [x0, y0, x1, y1, ...]. */
	inline function polygon(g, pts, colour)
	{
		local p = Content.createPath();
		local i;

		p.startNewSubPath(Layout.X(pts[0]), Layout.Y(pts[1]));

		for (i = 2; i < pts.length; i += 2)
			p.lineTo(Layout.X(pts[i]), Layout.Y(pts[i + 1]));

		p.closeSubPath();
		g.setColour(colour);
		g.fillPath(p, p.getBounds(1.0));
	}

	inline function creamLabel(g, x, y, w, h, s, big, small)
	{
		g.setColour(Theme.CREAM);
		g.fillRoundedRectangle([Layout.X(x), Layout.Y(y), Layout.S(w), Layout.S(h)], 1.5);
		g.setColour(0x66000000);
		g.drawRoundedRectangle([Layout.X(x), Layout.Y(y), Layout.S(w), Layout.S(h)], 1.5, 1.0);
		Draw.mixed(g, s, Layout.X(x + w / 2), Layout.Y(y + h - 5), Layout.S(big), Layout.S(small), Theme.INK);
	}

	inline function ticks(g, cx, cy, r1, r2, n, a0, a1, colour, w)
	{
		Draw.ticks(g, Layout.X(cx), Layout.Y(cy), Layout.S(r1), Layout.S(r2), n, a0, a1, colour, w);
	}

	/** Labels on a circle around (cx, cy), evenly from a0 to a1 degrees. */
	inline function ring(g, labels, cx, cy, r, a0, a1, size, colour)
	{
		local i;
		local a;

		for (i = 0; i < labels.length; i++)
		{
			a = a0 + (a1 - a0) * i / (labels.length - 1);
			T(g, labels[i], Draw.px(cx, a, r), Draw.py(cy, a, r) + size * 0.4, size, colour);
		}
	}

	/** Same "random" numbers on every paint: Park-Miller generator, returns 0..1. */
	reg wearSeed = 1;

	inline function rnd()
	{
		wearSeed = (wearSeed * 16807) % 2147483647;
		return wearSeed / 2147483647.0;
	}

	/** A used machine: fine scratches and specks of dust on the lacquer, always the same ones. */
	inline function wear(g, seed)
	{
		local i;
		local x;
		local y;
		local len;
		local a;

		wearSeed = seed;

		for (i = 0; i < 90; i++)
		{
			x = rnd() * 1280;
			y = rnd() * 762;
			len = 6 + rnd() * 38;
			a = (rnd() - 0.5) * 0.6;   // mostly sideways, like wiping and sliding things over it
			g.setColour(Colours.withAlpha(0xFFFFFFFF, 0.035 + rnd() * 0.05));
			g.drawLine(x, x + Math.cos(a) * len, y, y + Math.sin(a) * len, 0.6);
		}

		for (i = 0; i < 160; i++)
		{
			x = rnd() * 1280;
			y = rnd() * 762;
			g.setColour(Colours.withAlpha(rnd() < 0.5 ? 0xFFFFFFFF : 0xFF000000, 0.04 + rnd() * 0.05));
			g.fillEllipse([x, y, 0.8 + rnd() * 1.2, 0.8 + rnd() * 1.2]);
		}
	}

	inline function background(g)
	{
		g.setGradientFill([Theme.PANEL_TOP, 0, 0, Theme.PANEL_BOTTOM, 0, 762, false]);
		g.fillRect([0, 0, 1280, 762]);
		wear(g, 808);
	}

	// ---------------------------------------------------------------- front panel

	inline function paintModeSection(g)
	{
		local i;
		local a;

		polyline(g, [112, 142, 100, 142, 100, 262], Theme.PRINT);
		frame(g, 108, 136, 78, 12, Theme.WHITE);
		T(g, "PATTERN WRITE", 147, 145.5, 8, Theme.WHITE);
		T(g, "INSTRUMENT-SELECT", 255, 145.5, 8, Theme.WHITE);
		frame(g, 223, 149, 80, 11, Theme.ORANGE);
		T(g, "RHYTHM  TRACK", 263, 157.5, 8, Theme.ORANGE);

		// MODE positions (Theme.MODE_ANGLES)
		ticks(g, 152, 210, 34, 38, 2, Theme.MODE_ANGLES[0], Theme.MODE_ANGLES[1], Theme.PRINT, 1.0);
		ticks(g, 152, 210, 34, 38, 2, Theme.MODE_ANGLES[2], Theme.MODE_ANGLES[3], Theme.PRINT, 1.0);
		ticks(g, 152, 210, 34, 38, 2, Theme.MODE_ANGLES[4], Theme.MODE_ANGLES[5], Theme.PRINT, 1.0);
		frame(g, 101, 248, 78, 12, Theme.WHITE);
		T(g, "PATTERN CLEAR", 140, 257, 8, Theme.WHITE);
		T(g, "1st", 111, 184, 8, Theme.WHITE);
		T(g, "PART", 111, 192, 8, Theme.WHITE);
		T(g, "2nd", 128, 164, 8, Theme.WHITE);
		T(g, "PART", 128, 172, 8, Theme.WHITE);
		frame(g, 145, 154, 42, 18, 0xFF888888);
		T(g, "MANUAL", 166, 162, 8, 0xFF999999);
		T(g, "PLAY", 166, 170, 8, 0xFF999999);
		T(g, "PLAY", 190, 184, 8, Theme.ORANGE);
		T(g, "COM-", 198, 208, 8, Theme.ORANGE);
		T(g, "POSE", 198, 216, 8, Theme.ORANGE);

		// INSTRUMENT-SELECT: instrument names (write modes) and track numbers (rhythm track modes)
		for (i = 0; i < 12; i++)
		{
			a = -150 + 300 * i / 11;
			g.setColour(Theme.CREAM);
			g.fillRect([Layout.X(Draw.px(264, a, 45) - 10), Layout.Y(Draw.py(218, a, 45) - 6.5), Layout.S(20), Layout.S(12)]);
			T(g, Theme.INSTRUMENTS[i], Draw.px(264, a, 45), Draw.py(218, a, 45) + 3, 8, Theme.INK);
			T(g, "" + (i + 1), Draw.px(264, a, 29), Draw.py(218, a, 29) + 3, 8, Theme.ORANGE);
		}

		// CLEAR button legend and frame
		T(g, "STEP", 124, 270, 8, Theme.WHITE);
		T(g, "NUMBER", 124, 277, 8, Theme.WHITE);
		T(g, "PRE-", 124, 288, 8, Theme.WHITE);
		T(g, "SCALE", 124, 295, 8, Theme.WHITE);
		T(g, "TRACK", 178, 276, 8, Theme.ORANGE);
		T(g, "CLEAR", 178, 283, 8, Theme.ORANGE);
		polyline(g, [100, 298, 100, 314, 206, 314, 206, 268, 322, 268], Theme.PRINT);

		// AUTO FILL IN
		ring(g, ["16", "12", "8", "4", "2"], 264, 310, 37, -60, 85, 8, Theme.PRINT);
		T(g, "MANUAL", Draw.px(264, -110, 37) - 14, Draw.py(310, -110, 37) + 3, 8, Theme.PRINT);
		T(g, "MEASURES", 264, 349, 8, Theme.PRINT);
		T(g, "AUTO FILL IN", 264, 358, 8, Theme.WHITE);
	}

	inline function paintTempo(g)
	{
		local i;

		T(g, "TEMPO", 166, 333, 8.5, Theme.WHITE);
		g.setGradientFill([Theme.GREY_TOP, 0, Layout.Y(338), Theme.GREY_BOTTOM, 0, Layout.Y(482), false]);
		g.fillEllipse([Layout.X(88), Layout.Y(338), Layout.S(144), Layout.S(144)]);
		g.setColour(0xFF555555);
		g.drawEllipse([Layout.X(88), Layout.Y(338), Layout.S(144), Layout.S(144)], 1.0);
		g.setColour(0xFF0D0D0D);
		g.fillEllipse([Layout.X(105), Layout.Y(355), Layout.S(110), Layout.S(110)]);
		ticks(g, 160, 410, 60, 64, 41, -150, 150, 0xFF222222, 0.8);

		for (i = 0; i <= 10; i++)
			T(g, "" + i, Draw.px(160, -150 + 30 * i, 66), Draw.py(410, -150 + 30 * i, 66) + 3, 8, 0xFF222222);

		T(g, "FINE", 276, 407, 8, Theme.WHITE);
		ticks(g, 270, 440, 18, 22, 9, -135, 135, Theme.WHITE, 1.0);
		T(g, "SLOW", 250, 462, 8, Theme.PRINT);
		T(g, "FAST", 298, 462, 8, Theme.PRINT);
	}

	inline function paintVoices(g)
	{
		local i;
		local k;
		local v;
		local cx;

		line(g, 96, 131, 1178, 131, Theme.PRINT, 1.2);
		line(g, 323, 131, 323, 485, Theme.PRINT, 1.0);
		line(g, 1178, 131, 1178, 485, Theme.PRINT, 1.0);

		for (i = 0; i < 12; i++)
		{
			v = Layout.VOICES[i];
			cx = Layout.voiceX(i);

			if (i > 0)
				line(g, 323 + 71 * i, 134, 323 + 71 * i, 392, Theme.PRINT, 0.8);

			for (k = 0; k < v.rows.length; k++)
			{
				if (v.rows[k] != "")
				{
					Tn(g, v.rows[k], cx, Layout.KNOB_Y[k] - 30, 8, Theme.PRINT);
					ticks(g, cx, Layout.KNOB_Y[k], 16, 20, 11, -135, 135, Theme.WHITE, 1.0);
				}
			}

			if (v.alt != "")
				creamLabel(g, cx - 31, 310, 62, 19, v.alt, 10.5, 8);

			creamLabel(g, cx - 32, 372, 64, 20, v.name, 11, 8);
		}

		line(g, 323, 392, 1178, 392, Theme.PRINT, 0.8);
	}

	inline function paintNameplate(g)
	{
		local i;

		TL(g, "JXMP Audio", 955, 118, 27, Theme.ORANGE);
		g.setColour(Theme.ORANGE);
		g.setFont(Theme.FONT_ITALIC, Layout.S(30));
		g.drawAlignedText("Rhythm Machine", [Layout.X(600), Layout.Y(416), Layout.S(330), Layout.S(38)], "right");
		g.setFont(Theme.FONT_ITALIC, Layout.S(21));
		g.drawAlignedText("JX-808", [Layout.X(948), Layout.Y(424), Layout.S(110), Layout.S(30)], "left");
		line(g, 330, 452, 1076, 452, Theme.ORANGE, 1.2);
		Tn(g, "Analog Modelled", 954, 470, 14, 0xFFD8D4CC);

		// SYNC indicator (LED is a component)
		TL(g, "SYNC", 354, 443, 8, Theme.PRINT);

		// MASTER VOLUME
		for (i = 1; i <= 7; i++)
			T(g, "" + i, Draw.px(1136, -135 + 45 * (i - 1), 33), Draw.py(436, -135 + 45 * (i - 1), 33) + 3, 8, Theme.PRINT);

		T(g, "MIN", 1110, 471, 8, Theme.PRINT);
		T(g, "MAX", 1162, 471, 8, Theme.PRINT);
		T(g, "MASTER VOLUME", 1136, 483, 8, Theme.WHITE);

		// POWER
		T(g, "POWER", 141, 56, 8.5, Theme.PRINT);
		TL(g, "ON", 176, 87, 8, Theme.PRINT);     // POWER lamps are components left of the words
		TL(g, "OFF", 176, 106, 8, Theme.PRINT);
	}

	inline function paintSequencer(g)
	{
		local i;
		local b;
		local s;
		local x;
		local cx;
		// note-value bars of the PRE-SCALE: [y, note spacing, x0, w0, x1, w1, ...]
		local bars = [[510, 47.3, 320, 132, 462, 132, 604, 132, 746, 132, 890, 132, 1032, 32],
		              [530, 94.6, 320, 274, 604, 274, 890, 174],
		              [549, 63.0, 320, 180, 509, 180, 698, 180, 890, 174],
		              [568, 189.0, 320, 368, 698, 368]];

		rect(g, 99, 498, 1080, 194, Theme.DARK);
		greyRect(g, 99, 498, 146, 194);
		greyRect(g, 1080, 498, 99, 194);
		greyRect(g, 99, 668, 1080, 24);
		frame(g, 887, 670, 190, 20, 0xFFEEEEEE);

		// BASIC-VARIATION
		Tn(g, "BASIC-VARIATION", 172, 513, 8, 0xFF2A2A2A);
		Tn(g, "A", 156, 554, 8, 0xFF222222);
		Tn(g, "AB", 172, 554, 8, 0xFF222222);
		Tn(g, "B", 192, 554, 8, 0xFF222222);
		rect(g, 149, 561, 52, 14, 0xFF111111);
		line(g, 105, 584, 240, 584, 0xFF555555, 1.0);

		// PRE-SCALE
		T(g, "PRE-SCALE", 278, 513, 8, Theme.WHITE);

		for (i = 0; i < 4; i++)
			T(g, "" + (i + 1), 289, 532 + i * 10.67, 8, Theme.PRINT);

		for (i = 0; i < bars.length; i++)
		{
			b = bars[i];

			for (s = 2; s < b.length; s += 2)
			{
				g.setColour(Theme.BAR);
				g.fillRoundedRectangle([Layout.X(b[s]), Layout.Y(b[0] - 7), Layout.S(b[s + 1]), Layout.S(15)], 1.0);

				for (x = 0; x * b[1] < b[s + 1] - 10; x++)
					TLn(g, "♪", b[s] + 6 + x * b[1], b[0] + 5, 11, Theme.INK);
			}
		}

		// STEP NO, part LEDs legends
		polygon(g, [252, 582, 300, 582, 306, 589, 300, 596, 252, 596], Theme.BAR);
		T(g, "STEP NO", 276, 593, 8, 0xFF222222);
		T(g, "1st PART", 279, 625, 8, Theme.WHITE);
		T(g, "2nd PART", 279, 660, 8, Theme.WHITE);

		// step numbers above the keys, rhythm numbers below
		for (i = 0; i < 16; i++)
		{
			cx = Layout.stepX(i);
			T(g, "" + (i + 1), cx, 593, 8, Theme.WHITE);
			Tn(g, "" + (i < 12 ? i + 1 : i - 11), cx, 686, 13, Theme.INK);
		}

		polygon(g, [186, 673, 282, 673, 290, 680, 282, 687, 186, 687], 0xFF5B5855);
		T(g, "BASIC RHYTHM", 234, 684, 8, 0xFFDDDDDD);
		polygon(g, [1080, 680, 1088, 673, 1172, 673, 1172, 687, 1088, 687], 0xFF5B5855);
		T(g, "INTRO/FILL IN", 1128, 684, 8, 0xFFDDDDDD);

		// I/F-VARIATION, INTRO SET / FILL IN TRIGGER
		Tn(g, "I/F-VARIATION", 1129, 513, 8, 0xFF2A2A2A);
		Tn(g, "A", 1121, 552, 8, 0xFF222222);
		Tn(g, "B", 1141, 552, 8, 0xFF222222);
		line(g, 1086, 563, 1174, 563, 0xFF555555, 1.0);
		Tn(g, "INTRO SET", 1129, 584, 8, 0xFF222222);
		Tn(g, "FILL IN TRIGGER", 1129, 595, 8, 0xFF222222);
	}

	inline function paintFront(g)
	{
		background(g);
		paintNameplate(g);
		paintModeSection(g);
		paintTempo(g);
		paintVoices(g);
		paintSequencer(g);
	}

	// ---------------------------------------------------------------- rear panel

	inline function box(g, x, y, w, h, title)
	{
		frame(g, x, y, w, h, Theme.PRINT);
		rect(g, x + 10, y - 7, title.length * 6.4 + 12, 14, 0xFF2E2E30);
		TL(g, title, x + 16, y + 4, 9, Theme.WHITE);
	}

	inline function slideLegend(g, cx, cy, w, labels, caption)
	{
		local i;

		for (i = 0; i < labels.length; i++)
			T(g, labels[i], cx - w / 2 + 8 + (w - 16) * i / (labels.length - 1), cy + 20, 8, Theme.PRINT);

		T(g, caption, cx, cy - 16, 8, Theme.WHITE);
	}

	inline function paintRear(g)
	{
		local i;
		local channels = ["ALL"];
		local notes = [["BD", "35 · 36"], ["SD", "38 · 40"], ["LT", "41 · 43"], ["MT", "45 · 47"],
		               ["HT", "48 · 50"], ["RS", "37"], ["CP", "39"], ["CB", "56"],
		               ["CY", "49 · 57"], ["OH", "46"], ["CH", "42 · 44"], ["LC", "64"],
		               ["MC", "63"], ["HC", "62"], ["CL", "75"], ["MA", "70"]];
		local x;
		local y;

		for (i = 1; i <= 16; i++)
			channels.push("" + i);

		background(g);
		TL(g, "JXMP Audio", 130, 70, 22, Theme.ORANGE);
		TLn(g, "Rhythm Machine JX-808  ·  REAR PANEL", 130, 88, 9, Theme.PRINT);
		line(g, 96, 110, 1178, 110, Theme.PRINT, 1.2);

		box(g, 110, 140, 200, 150, "SYNC");
		slideLegend(g, 210, 205, 70, ["INT", "DAW"], "TEMPO / START-STOP");
		T(g, "LOCKED TO HOST", 210, 273, 8, Theme.PRINT);

		box(g, 340, 140, 330, 150, "MIDI PROGRAMMING");
		slideLegend(g, 430, 205, 90, ["OFF", "STEP", "REAL-TIME"], "INPUT");
		slideLegend(g, 580, 205, 80, ["ACCENT≥100", "DYNAMIC"], "VELOCITY");
		Tn(g, "STEP: note 24 = rest · note 23 = back", 470, 265, 8, Theme.PRINT);
		T(g, "SEQ → MIDI OUT", 625, 244, 8, Theme.WHITE);
		T(g, "OFF", 609, 280, 8, Theme.PRINT);
		T(g, "ON", 641, 280, 8, Theme.PRINT);

		box(g, 700, 140, 478, 150, "MIDI PITCH");
		T(g, "PITCH", 745, 185, 8, Theme.WHITE);
		T(g, "ON", 745, 247, 8, Theme.ORANGE);
		T(g, "OFF", 745, 258, 8, Theme.PRINT);
		ticks(g, 850, 220, 26, 30, 11, -150, 150, Theme.PRINT, 1.0);
		ring(g, Theme.PITCH_TARGETS, 850, 220, 38, -150, 150, 8, Theme.PRINT);
		T(g, "TARGET", 850, 278, 8, Theme.WHITE);
		ticks(g, 990, 220, 26, 30, 17, -150, 150, Theme.PRINT, 1.0);
		ring(g, channels, 990, 220, 38, -150, 150, 8, Theme.PRINT);
		T(g, "CHANNEL", 990, 278, 8, Theme.WHITE);
		Tn(g, "BEND", 1080, 180, 8, Theme.PRINT);
		ticks(g, 1080, 205, 16, 20, 11, -135, 135, Theme.WHITE, 1.0);
		Tn(g, "GLIDE", 1080, 236, 8, Theme.PRINT);
		ticks(g, 1080, 261, 16, 20, 11, -135, 135, Theme.WHITE, 1.0);
		T(g, "0–12 st", 1135, 210, 8, Theme.PRINT);
		T(g, "0–1000 ms", 1135, 266, 8, Theme.PRINT);

		box(g, 110, 330, 590, 140, "MIDI NOTE ASSIGN (GM)");

		for (i = 0; i < notes.length; i++)
		{
			x = 128 + (i % 8) * 71;
			y = 368 + Math.floor(i / 8) * 46;
			rect(g, x, y - 12, 26, 16, Theme.CREAM);
			T(g, notes[i][0], x + 13, y, 9, Theme.INK);
			TLn(g, notes[i][1], x + 30, y, 9, Theme.WHITE);
		}

		Tn(g, "Live MIDI notes always trigger the drums. PITCH channel notes play the TARGET drum at pitch.", 405, 458, 8, Theme.PRINT);

		box(g, 720, 330, 458, 140, "MEMORY CARTRIDGE");
		Tn(g, "whole machine: panel, patterns and rhythm tracks", 895, 452, 8, Theme.PRINT);

		// the standalone app has to pick its own audio device and MIDI inputs (in a plugin the DAW does)
		box(g, 110, 495, 750, 185, "AUDIO / MIDI SETUP");

		if (Engine.isPlugin())
			Tn(g, "Audio and MIDI are set up in your DAW.", 485, 590, 9, Theme.PRINT);
		else
		{
			Tn(g, "AUDIO DEVICE", 295, 516, 8, Theme.PRINT);
			Tn(g, "MIDI INPUTS", 670, 516, 8, Theme.PRINT);
		}

		box(g, 880, 495, 290, 72, "GROOVE");
		ticks(g, 925, 535, 16, 20, 11, -135, 135, Theme.WHITE, 1.0);
		ticks(g, 1025, 535, 16, 20, 11, -135, 135, Theme.WHITE, 1.0);
		ticks(g, 1125, 535, 16, 20, 11, -135, 135, Theme.WHITE, 1.0);
		T(g, "SHUFFLE", 925, 562, 8, Theme.WHITE);
		T(g, "DRIVE", 1025, 562, 8, Theme.WHITE);
		T(g, "AGE", 1125, 562, 8, Theme.WHITE);

		box(g, 880, 585, 290, 48, "DRAG TO DAW");

		g.setColour(0xFFBDB8AD);
		g.fillRoundedRectangle([Layout.X(880), Layout.Y(645), Layout.S(290), Layout.S(32)], 3.0);
		g.setColour(0xFF666666);
		g.drawRoundedRectangle([Layout.X(880), Layout.Y(645), Layout.S(290), Layout.S(32)], 3.0, 1.0);
		T(g, "JXMP Audio  RHYTHM MACHINE JX-808", 1025, 659, 8, 0xFF222222);
		Tn(g, "VST3 · SERIAL No. 000808   v" + Engine.getVersion(), 1025, 672, 8, 0xFF333333);
	}
}
