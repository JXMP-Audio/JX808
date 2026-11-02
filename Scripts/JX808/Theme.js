/*  Colours, panel geometry and the drawing primitives shared by the LookAndFeel objects
    (LookAndFeel.js) and the silkscreen (PanelArt.js).

    All layout numbers in the scripts are in mockup units (the panel frame at 72, 36, 1132 x 674).
    Layout converts them to interface pixels (1280 x 762). Draw works in pixels.
*/

namespace Theme
{
	const var PANEL_TOP = 0xFF323234;
	const var PANEL_BOTTOM = 0xFF262628;
	const var PRINT = 0xFFB9B5AE;
	const var WHITE = 0xFFE8E6E0;
	const var ORANGE = 0xFFFF6A2A;
	const var RED = 0xFFE8402A;
	const var CREAM = 0xFFEFE9C4;
	const var GREY_TOP = 0xFF96928D;
	const var GREY_BOTTOM = 0xFF7F7B77;
	const var BAR = 0xFF7C7975;
	const var DARK = 0xFF1D1D1F;
	const var INK = 0xFF1A1A1A;
	const var LED_OFF = 0xFF4A1210;
	const var LED_DIM = 0xFF8A2A22;

	const var LAMP_GREEN = 0xFF5CFF6A;
	const var LAMP_RED = 0xFFFF3020;      // POWER OFF: standby, still plugged in

	// Liberation Sans (Arial metrics, SIL OFL, Images/Fonts) is embedded, so the panel looks the
	// same on every system instead of falling back to whatever replaces "Arial" there
	Engine.loadFontAs("{PROJECT_FOLDER}Fonts/LiberationSans-Regular.ttf", "JX Sans");
	Engine.loadFontAs("{PROJECT_FOLDER}Fonts/LiberationSans-Bold.ttf", "JX Sans Bold");
	Engine.loadFontAs("{PROJECT_FOLDER}Fonts/LiberationSans-Italic.ttf", "JX Sans Italic");

	const var FONT = "JX Sans";
	const var FONT_BOLD = "JX Sans Bold";
	const var FONT_ITALIC = "JX Sans Italic";

	// step keys: 4 red, 4 orange, 4 yellow, 4 off white ([top, bottom] of the gradient)
	const var KEY_COLOURS = [[0xFFFF5A3C, 0xFFC42A18], [0xFFFF9A4A, 0xFFD8601C],
	                         [0xFFFFF070, 0xFFD6B81C], [0xFFFFFFFF, 0xFFD0CEC6]];

	// pointer angles (degrees, 0 = up, clockwise) of the selectors with printed positions
	const var MODE_ANGLES = [-160, -60, -22, 14, 50, 88];      // CLEAR, 1st, 2nd, MANUAL, PLAY, COMPOSE
	const var AUTOFILL_ANGLES = [-110, -60, -25, 10, 45, 85];  // MANUAL, 16, 12, 8, 4, 2

	const var INSTRUMENTS = ["AC", "BD", "SD", "LT", "MT", "HT", "RS", "CP", "CB", "CY", "OH", "CH"];
	const var PITCH_TARGETS = ["BD", "SD", "LT", "MT", "HT", "RS", "CP", "CB", "CY", "OH", "CH"];
}

namespace Layout
{
	const var K = 1280.0 / 1132.0;

	inline function X(v) { return (v - 72.0) * K; }
	inline function Y(v) { return (v - 36.0) * K; }
	inline function S(v) { return v * K; }

	/** Component bounds [x, y, w, h] in pixels for a control centred at (cx, cy) in mockup units. */
	inline function box(cx, cy, w, h)
	{
		return [Math.round(X(cx - w / 2)), Math.round(Y(cy - h / 2)), Math.round(S(w)), Math.round(S(h))];
	}

	// voice section: 12 columns of 71 units from x = 323, knob rows
	const var KNOB_Y = [172, 248, 325];

	inline function voiceX(i) { return 323 + 71 * i + 35.5; }

	// step keys 1..16
	inline function stepX(i) { return 339 + 47.2 * i; }

	// printed column legends (808 lettering: upper case = big, lower case = small caps)
	const var VOICES = [
		{ name: "ACcent",     alt: "",         rows: ["LEVEL"] },
		{ name: "BassDrum",   alt: "",         rows: ["LEVEL", "TONE", "DECAY"] },
		{ name: "SnareDrum",  alt: "",         rows: ["LEVEL", "TONE", "SNAPPY"] },
		{ name: "LowTom",     alt: "LowConga", rows: ["LEVEL", "TUNING"] },
		{ name: "MidTom",     alt: "MidConga", rows: ["LEVEL", "TUNING"] },
		{ name: "HiTom",      alt: "HiConga",  rows: ["LEVEL", "TUNING"] },
		{ name: "RimShot",    alt: "CLaves",   rows: ["LEVEL"] },
		{ name: "handClaP",   alt: "MAracas",  rows: ["LEVEL"] },
		{ name: "CowBell",    alt: "",         rows: ["LEVEL"] },
		{ name: "CYmbal",     alt: "",         rows: ["LEVEL", "TONE", "DECAY"] },
		{ name: "OpenHihat",  alt: "",         rows: ["LEVEL", "", "DECAY"] },
		{ name: "Cls'dHihat", alt: "",         rows: ["LEVEL"] }
	];
}

namespace Draw
{
	const var DEG = Math.PI / 180.0;

	/** Point at `deg` degrees (0 = up, clockwise) and radius r around the centre. */
	inline function px(cx, deg, r) { return cx + Math.sin(deg * DEG) * r; }
	inline function py(cy, deg, r) { return cy - Math.cos(deg * DEG) * r; }

	inline function text(g, s, cx, baseline, size, colour, font)
	{
		g.setColour(colour);
		g.setFont(font, size);
		g.drawAlignedText(s, [cx - 300, baseline - size, 600, size * 1.25], "centred");
	}

	inline function textLeft(g, s, x, baseline, size, colour, font)
	{
		g.setColour(colour);
		g.setFont(font, size);
		g.drawAlignedText(s, [x, baseline - size, 600, size * 1.25], "left");
	}

	/** 808 label lettering: upper case letters big, lower case letters as small capitals. */
	inline function mixed(g, s, cx, baseline, big, small, colour)
	{
		local i;
		local c;
		local size;
		local w = 0.0;
		local x;

		for (i = 0; i < s.length; i++)
		{
			c = s.charAt(i);
			size = (c == c.toUpperCase()) ? big : small;
			w += Engine.getStringWidth(c.toUpperCase(), Theme.FONT_BOLD, size, 0.0);
		}

		x = cx - w / 2;
		g.setColour(colour);

		for (i = 0; i < s.length; i++)
		{
			c = s.charAt(i);
			size = (c == c.toUpperCase()) ? big : small;
			g.setFont(Theme.FONT_BOLD, size);
			g.drawAlignedText(c.toUpperCase(), [x, baseline - big * 1.2, 100, big * 1.45], "bottomLeft");
			x += Engine.getStringWidth(c.toUpperCase(), Theme.FONT_BOLD, size, 0.0);
		}
	}

	inline function ticks(g, cx, cy, r1, r2, n, a0, a1, colour, w)
	{
		local i;
		local a;

		g.setColour(colour);

		for (i = 0; i < n; i++)
		{
			a = a0 + (a1 - a0) * i / (n - 1);
			g.drawLine(px(cx, a, r1), px(cx, a, r2), py(cy, a, r1), py(cy, a, r2), w);
		}
	}

	/** Lamp in any colour: lit = full colour with a glow, otherwise a dark tint of it. */
	/** A lamp lit to `level` (0 = dark, 1 = full; between = warming up or the afterglow) over an
	    unlit glass of colour `base`. */
	inline function glowLamp(g, cx, cy, r, level, colour, base)
	{
		g.setColour(0xFF000000);
		g.fillEllipse([cx - r - 1, cy - r - 1, 2 * r + 2, 2 * r + 2]);

		if (level > 0.0)
		{
			g.setColour(Colours.withAlpha(colour, 0.25 * level));
			g.fillEllipse([cx - 2 * r, cy - 2 * r, 4 * r, 4 * r]);
		}

		g.setColour(base);
		g.fillEllipse([cx - r, cy - r, 2 * r, 2 * r]);

		if (level > 0.0)
		{
			g.setGradientFill([Colours.withAlpha(0xFFFFFFFF, level), cx - r * 0.3, cy - r * 0.3,
			                   Colours.withAlpha(colour, level), cx + r * 0.6, cy + r * 0.6, true]);
			g.fillEllipse([cx - r, cy - r, 2 * r, 2 * r]);
		}
	}

	inline function lamp(g, cx, cy, r, level, colour)
	{
		glowLamp(g, cx, cy, r, level, colour, Colours.mix(colour, 0xFF000000, 0.8));
	}

	/** Red LED. state 2 = dim (unlit glass a bit brighter); level = how much it is lit (0 to 1) */
	inline function led(g, cx, cy, r, state, level)
	{
		glowLamp(g, cx, cy, r, level, 0xFFFF3020, state == 2 ? Theme.LED_DIM : Colours.mix(0xFFFF3020, 0xFF000000, 0.8));
	}

	inline function chrome(g, cx, cy, r)
	{
		g.setGradientFill([0xFFFFFFFF, cx - r * 0.35, cy - r * 0.35, 0xFF444444, cx + r, cy + r, true]);
		g.fillEllipse([cx - r, cy - r, 2 * r, 2 * r]);
	}

	/** Voice knob: knurled black skirt, coloured cap with an indicator dot, optional orange marker. */
	inline function voiceKnob(g, cx, cy, r, capTop, capBottom, v, dot)
	{
		local a = -135 + 270 * v;
		local cr = r * 0.62;
		local i;

		g.setColour(0x88000000);
		g.fillEllipse([cx - r + 1, cy - r + 2, 2 * r, 2 * r]);
		g.setGradientFill([0xFF1B1B1B, cx, cy, 0xFF050505, cx + r, cy + r, true]);
		g.fillEllipse([cx - r, cy - r, 2 * r, 2 * r]);

		g.setColour(0xFF555555);

		for (i = 0; i < 18; i++)
			g.drawLine(px(cx, i * 20, r * 0.8), px(cx, i * 20, r), py(cy, i * 20, r * 0.8), py(cy, i * 20, r), 1.0);

		g.setGradientFill([capTop, cx - cr * 0.3, cy - cr * 0.4, capBottom, cx + cr, cy + cr, true]);
		g.fillEllipse([cx - cr, cy - cr, 2 * cr, 2 * cr]);

		g.setColour(0xFF222222);
		g.fillEllipse([px(cx, a, r * 0.42) - r * 0.12, py(cy, a, r * 0.42) - r * 0.12, r * 0.24, r * 0.24]);

		if (dot)
		{
			g.setColour(Theme.ORANGE);
			g.fillEllipse([px(cx, a, r + 3.5) - 1.6, py(cy, a, r + 3.5) - 1.6, 3.2, 3.2]);
		}
	}

	/** Large black knob with a red pointer line at `deg`. */
	inline function bigKnob(g, cx, cy, r, deg)
	{
		g.setColour(0x88000000);
		g.fillEllipse([cx - r + 2, cy - r + 3, 2 * r, 2 * r]);
		g.setGradientFill([0xFF1C1C1C, cx - r * 0.1, cy - r * 0.2, 0xFF050505, cx + r, cy + r, true]);
		g.fillEllipse([cx - r, cy - r, 2 * r, 2 * r]);
		g.setColour(0xFF000000);
		g.drawEllipse([cx - r, cy - r, 2 * r, 2 * r], 1.0);
		g.setGradientFill([0xFF3A3A3A, cx - r * 0.3, cy - r * 0.4, 0xFF141414, cx + r * 0.6, cy + r * 0.6, true]);
		g.fillEllipse([cx - r * 0.78, cy - r * 0.78, r * 1.56, r * 1.56]);
		g.setColour(Theme.RED);
		g.drawLine(px(cx, deg, r * 0.35), px(cx, deg, r * 0.75), py(cy, deg, r * 0.35), py(cy, deg, r * 0.75), Math.max(2.0, r * 0.08));
	}

	/** Horizontal slide switch (rounded slot, chrome ball lever). v = 0 left ... 1 right. */
	inline function slideH(g, area, v)
	{
		local h = area[3];
		local cy = area[1] + h / 2;
		local x0 = area[0] + h / 2;
		local tx = x0 + (area[2] - h) * v;

		g.setColour(0xFF0D0D0D);
		g.fillRoundedRectangle(area, h / 2);
		g.setColour(0xFF555555);
		g.drawRoundedRectangle(area, h / 2, 1.0);
		g.setColour(0xFF999999);
		g.drawLine(x0, tx, cy, cy, h * 0.25);
		chrome(g, tx, cy, h * 0.42);
	}

	/** Vertical slide switch (slot with a grey block). v = 0 top ... 1 bottom. */
	inline function slideV(g, area, v)
	{
		local bh = area[2] * 0.8;
		local ty = area[1] + 2 + (area[3] - 4 - bh) * v;

		g.setColour(0xFF111111);
		g.fillRect(area);
		g.setColour(0xFF444444);
		g.drawRect(area, 1.0);
		g.setGradientFill([0xFFDDDDDD, 0, ty, 0xFF777777, 0, ty + bh, false]);
		g.fillRect([area[0] + 1, ty, area[2] - 2, bh]);
	}
}
