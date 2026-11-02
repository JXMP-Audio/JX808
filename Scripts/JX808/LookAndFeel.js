/*  Local LookAndFeel objects for the hardware-style controls. They only read the state
    HISE passes in (value, down) and draw with the Draw primitives in Theme.js.
*/

namespace Laf
{
	// small voice knob, orange cap (LEVEL)
	const var voiceOrange = Content.createLocalLookAndFeel();

	voiceOrange.registerFunction("drawRotarySlider", function(g, obj)
	{
		var a = obj.area;
		Draw.voiceKnob(g, a[2] / 2, a[3] / 2, Math.min(a[2], a[3]) / 2 - 6, 0xFFFFE2A6, 0xFFC4741C, obj.valueNormalized, true);
	});

	// small voice knob, white cap (TONE, TUNING, DECAY, SNAPPY, BEND, GLIDE)
	const var voiceWhite = Content.createLocalLookAndFeel();

	voiceWhite.registerFunction("drawRotarySlider", function(g, obj)
	{
		var a = obj.area;
		Draw.voiceKnob(g, a[2] / 2, a[3] / 2, Math.min(a[2], a[3]) / 2 - 6, 0xFFFFFFFF, 0xFFAAA79F, obj.valueNormalized, false);
	});

	// big black knob, 270 degrees (MASTER VOLUME, FINE)
	const var big270 = Content.createLocalLookAndFeel();

	big270.registerFunction("drawRotarySlider", function(g, obj)
	{
		var a = obj.area;
		Draw.bigKnob(g, a[2] / 2 - 1, a[3] / 2 - 1, Math.min(a[2], a[3]) / 2 - 3, -135 + 270 * obj.valueNormalized);
	});

	// big black knob, 300 degrees (TEMPO, INSTRUMENT-SELECT, TARGET, CHANNEL)
	const var big300 = Content.createLocalLookAndFeel();

	big300.registerFunction("drawRotarySlider", function(g, obj)
	{
		var a = obj.area;
		Draw.bigKnob(g, a[2] / 2 - 1, a[3] / 2 - 1, Math.min(a[2], a[3]) / 2 - 3, -150 + 300 * obj.valueNormalized);
	});

	// MODE selector: pointer angles follow the printed positions
	const var modeKnob = Content.createLocalLookAndFeel();

	modeKnob.registerFunction("drawRotarySlider", function(g, obj)
	{
		var a = obj.area;
		Draw.bigKnob(g, a[2] / 2 - 1, a[3] / 2 - 1, Math.min(a[2], a[3]) / 2 - 3, Theme.MODE_ANGLES[Math.round(obj.valueNormalized * 5)]);
	});

	// AUTO FILL IN selector
	const var autoFillKnob = Content.createLocalLookAndFeel();

	autoFillKnob.registerFunction("drawRotarySlider", function(g, obj)
	{
		var a = obj.area;
		Draw.bigKnob(g, a[2] / 2 - 1, a[3] / 2 - 1, Math.min(a[2], a[3]) / 2 - 3, Theme.AUTOFILL_ANGLES[Math.round(obj.valueNormalized * 5)]);
	});

	// cream key (START/STOP, TAP); "|" in the text breaks the line
	const var creamKey = Content.createLocalLookAndFeel();

	creamKey.registerFunction("drawToggleButton", function(g, obj)
	{
		var a = obj.area;
		// obj.down is only the mouse on the key itself; TAP is pressed through its touch area (value)
		var d = (obj.down || obj.value) ? 2 : 0;
		var lines = obj.text.split("|");
		var glow;
		var i;

		g.setColour(0x77000000);
		g.fillRoundedRectangle([4, 4, a[2] - 5, a[3] - 5], 3.0);
		g.setGradientFill([0xFFF8F0D0, 0, d, 0xFFA99D70, 0, a[3], false]);
		g.fillRoundedRectangle([1 + d, 1 + d, a[2] - 5, a[3] - 5], 3.0);

		// a small incandescent bulb under the plastic (right-click hold): warm amber light spread
		// through the key, with a hot spot over the filament
		glow = Colours.toVec4(obj.itemColour1)[3];

		if (glow > 0.0)
		{
			g.setGradientFill([Colours.withAlpha(0xFFFFE7A8, 0.95 * glow), a[2] / 2 + d, a[3] / 2 + d,
			                   Colours.withAlpha(0xFFF0A53C, 0.55 * glow), a[2] + d, a[3] / 2 + d, true]);
			g.fillRoundedRectangle([1 + d, 1 + d, a[2] - 5, a[3] - 5], 3.0);
			g.setGradientFill([Colours.withAlpha(0xFFFFF8E0, 0.9 * glow), a[2] / 2 + d, a[3] / 2 + d,
			                   Colours.withAlpha(0xFFFFD27A, 0.0), a[2] * 0.72 + d, a[3] / 2 + d, true]);
			g.fillRoundedRectangle([1 + d, 1 + d, a[2] - 5, a[3] - 5], 3.0);
		}
		g.setColour(0xFF8A7A50);
		g.drawRoundedRectangle([1 + d, 1 + d, a[2] - 5, a[3] - 5], 3.0, 1.0);
		g.setColour(0xFFC9B57A);
		g.drawRoundedRectangle([7 + d, 7 + d, a[2] - 17, a[3] - 17], 2.0, 1.0);
		g.setColour(0xFF3B3020);
		g.setFont(Theme.FONT_BOLD, 10.0);

		for (i = 0; i < lines.length; i++)
			g.drawAlignedText(lines[i], [d, d + (a[3] - 4) / 2 - lines.length * 6.5 + i * 13, a[2] - 4, 13], "centred");

	});

	// red round button (CLEAR)
	const var redButton = Content.createLocalLookAndFeel();

	redButton.registerFunction("drawToggleButton", function(g, obj)
	{
		var a = obj.area;
		var r = Math.min(a[2], a[3]) / 2 - 1;
		var cx = a[2] / 2;
		var cy = a[3] / 2;
		var glow;

		g.setColour(0xFF330000);
		g.fillEllipse([cx - r, cy - r, 2 * r, 2 * r]);
		g.setGradientFill([(obj.down || obj.value) ? 0xFFB02010 : 0xFFFFB0A0, cx - r * 0.3, cy - r * 0.3, 0xFF8A1008, cx + r, cy + r, true]);
		g.fillEllipse([cx - r + 1, cy - r + 1, 2 * r - 2, 2 * r - 2]);

		// a small incandescent bulb under the red plastic (right-click hold): orange-red glow with a
		// hot spot in the middle
		glow = Colours.toVec4(obj.itemColour1)[3];

		if (glow > 0.0)
		{
			g.setGradientFill([Colours.withAlpha(0xFFFFC27A, 0.95 * glow), cx, cy,
			                   Colours.withAlpha(0xFFFF3A12, 0.6 * glow), cx + r, cy, true]);
			g.fillEllipse([cx - r + 1, cy - r + 1, 2 * r - 2, 2 * r - 2]);
			g.setGradientFill([Colours.withAlpha(0xFFFFF1D0, 0.85 * glow), cx, cy,
			                   Colours.withAlpha(0xFFFFA060, 0.0), cx + r * 0.6, cy, true]);
			g.fillEllipse([cx - r + 1, cy - r + 1, 2 * r - 2, 2 * r - 2]);
		}
	});

	// POWER rocker: the pressed half is darker
	const var rocker = Content.createLocalLookAndFeel();

	rocker.registerFunction("drawToggleButton", function(g, obj)
	{
		var a = obj.area;
		var h = (a[3] - 11) / 2;

		g.setColour(0xFF000000);
		g.fillRect(a);
		g.setColour(0xFF2B2B2B);
		g.fillRect([3, 2, a[2] - 6, a[3] - 9]);
		g.setColour(0xFF555555);
		g.drawRect([3, 2, a[2] - 6, a[3] - 9], 1.0);
		g.setColour(0xFF161616);
		g.fillRect(obj.value ? [4, 3, a[2] - 8, h] : [4, 3 + h, a[2] - 8, h]);
	});

	// PITCH toggle lever: up = ON
	const var lever = Content.createLocalLookAndFeel();

	lever.registerFunction("drawToggleButton", function(g, obj)
	{
		var a = obj.area;
		var w = a[2] - 4;

		g.setColour(0xFF0D0D0D);
		g.fillRoundedRectangle([2, 2, w, a[3] - 4], 3.0);
		g.setColour(0xFF555555);
		g.drawRoundedRectangle([2, 2, w, a[3] - 4], 3.0, 1.0);
		g.setGradientFill([0xFFFFFFFF, 0, 0, 0xFF555555, 0, a[3], false]);
		g.fillRoundedRectangle([5, obj.value ? 5 : a[3] / 2, w - 6, a[3] / 2 - 5], 2.0);
	});

	// tab of the preset browser: lit (cream) when selected
	const var tabButton = Content.createLocalLookAndFeel();

	tabButton.registerFunction("drawToggleButton", function(g, obj)
	{
		var a = obj.area;

		g.setColour(obj.value ? Theme.CREAM : 0xFF1A1A1A);
		g.fillRoundedRectangle([0.5, 0.5, a[2] - 1, a[3] - 1], 2.0);
		g.setColour(obj.value ? Theme.ORANGE : 0xFF555555);
		g.drawRoundedRectangle([0.5, 0.5, a[2] - 1, a[3] - 1], 2.0, obj.value ? 2.0 : 1.0);
		g.setColour(obj.value ? Theme.INK : Theme.PRINT);
		g.setFont(Theme.FONT_BOLD, 14.0);
		g.drawAlignedText(obj.text, a, "centred");
	});

	// small dark push button (REAR / FRONT)
	const var smallButton = Content.createLocalLookAndFeel();

	smallButton.registerFunction("drawToggleButton", function(g, obj)
	{
		var a = obj.area;

		g.setColour(obj.down ? 0xFF2A2A2A : 0xFF1A1A1A);
		g.fillRoundedRectangle([0.5, 0.5, a[2] - 1, a[3] - 1], 2.0);
		g.setColour(0xFF555555);
		g.drawRoundedRectangle([0.5, 0.5, a[2] - 1, a[3] - 1], 2.0, 1.0);
		g.setColour(Theme.PRINT);
		g.setFont(Theme.FONT_BOLD, Math.max(8.5, Math.min(a[3] * 0.42, a[2] * 0.26)));   // narrow keys: fit the width
		g.drawAlignedText(obj.text, a, "centred");
	});
}
