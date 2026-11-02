/*  JX-808 engine access.

    Builds the module tree on first compile (idempotent):

        JX808 (master chain)
        └── JX808 Engine   (Silent Synth: only a container that forwards MIDI)
            └── FX: JX808 DSP   (Hardcoded Master FX running the compiled C++ node "JX808")

    The C++ node is DspNetworks/ThirdParty/JX808.h. It must be compiled once with
    Export -> Compile DSP networks as dll before HISE can load it.
*/

namespace Dsp
{
	const var ENGINE_ID = "JX808 Engine";
	const var DSP_ID = "JX808 DSP";
	const var NODE_ID = "JX808";

	// Parameter indexes, identical to jx808::Param in jx808_dsp.h
	const var P = {
		Run: 0, Tempo: 1, PreScale: 2, Mode: 3, Pattern: 4, BasicVariation: 5, IFVariation: 6,
		AutoFill: 7, FillSelect: 8, FillTrigger: 9, TrackNumber: 10, EditPart: 11, EditVariation: 12,
		Accent: 13, MasterVolume: 14,
		BD_Level: 15, BD_Tone: 16, BD_Decay: 17,
		SD_Level: 18, SD_Tone: 19, SD_Snappy: 20,
		LT_Level: 21, LT_Tuning: 22, LT_Conga: 23,
		MT_Level: 24, MT_Tuning: 25, MT_Conga: 26,
		HT_Level: 27, HT_Tuning: 28, HT_Conga: 29,
		RS_Level: 30, RS_Claves: 31,
		CP_Level: 32, CP_Maracas: 33,
		CB_Level: 34,
		CY_Level: 35, CY_Tone: 36, CY_Decay: 37,
		OH_Level: 38, OH_Decay: 39,
		CH_Level: 40,
		VelocityMode: 41, PitchMode: 42, PitchTarget: 43, PitchChannel: 44, PitchBendRange: 45, Glide: 46,
		HostSync: 47, Swing: 48, MuteMask: 49, Drive: 50, Age: 51, MidiOut: 52
	};

	// Node playback modes (jx808::PlayMode)
	const var MODE_MANUAL = 0;
	const var MODE_TRACK = 1;
	const var MODE_EDIT = 2;

	const var builder = Synth.createBuilder();
	const var engineIndex = builder.create(builder.SoundGenerators.SilentSynth, ENGINE_ID, 0, builder.ChainIndexes.Direct);
	builder.create(builder.Effects.HardcodedMasterFX, DSP_ID, engineIndex, builder.ChainIndexes.FX);
	builder.flush();

	const var slot = Synth.getSlotFX(DSP_ID);
	const var fx = Synth.getEffect(DSP_ID);

	reg ready = false;

	if (slot.getCurrentEffectId() == NODE_ID)
		ready = true;
	else if (slot.getModuleList().indexOf(NODE_ID) != -1)
	{
		slot.setEffect(NODE_ID);
		ready = true;
	}
	else
		Console.print("JX808: C++ node not found. Run Export -> Compile DSP networks as dll, then restart HISE.");

	// the module state (parameters + pattern memory slider packs) is part of every user preset
	Engine.addModuleStateToUserPreset(DSP_ID);

	inline function set(index, value)
	{
		if (ready)
			fx.setAttribute(index, value);
	}

	inline function get(index)
	{
		return ready ? fx.getAttribute(index) : 0;
	}
}

/*  Pattern / rhythm track memory, shared with the node through two slider packs.
    Layout (see jx808::Memory):

    patterns: [0] = 808 (magic), then 32 patterns (rhythm 1..16 x variation A/B) of 26 values:
              [part * 12 + track] = 16 bit step mask, [24] = 1st part last step, [25] = 2nd part last step (0 = none)
    tracks:   [0] = 808, then 12 rhythm tracks of 65 values: [0] = number of measures, [1 + m] = pattern index
*/
namespace Mem
{
	const var MAGIC = 808;
	const var NUM_PATTERNS = 32;
	const var STRIDE = 26;
	const var PAT_SIZE = 1 + 32 * 26;
	const var MAX_MEASURES = 64;
	const var TRACK_STRIDE = 65;
	const var TRK_SIZE = 1 + 12 * 65;

	// track (memory row) indexes
	const var BD = 0; const var SD = 1; const var LT = 2; const var MT = 3; const var HT = 4; const var RS = 5;
	const var CP = 6; const var CB = 7; const var CY = 8; const var OH = 9; const var CH = 10; const var AC = 11;

	reg pat;
	reg trk;
	reg ok = false;

	inline function patternIndex(rhythm, variation)
	{
		return rhythm * 2 + variation;
	}

	inline function base(p)
	{
		return 1 + p * STRIDE;
	}

	inline function getMask(p, part, track)
	{
		return ok ? Math.round(pat.getValue(base(p) + part * 12 + track)) : 0;
	}

	inline function setMask(p, part, track, mask)
	{
		if (ok)
			pat.setValue(base(p) + part * 12 + track, mask);
	}

	inline function getStep(p, part, track, step)
	{
		return (getMask(p, part, track) >> step) & 1;
	}

	inline function setStep(p, part, track, step, shouldBeOn)
	{
		local m = getMask(p, part, track);

		if (shouldBeOn)
			m = m | (1 << step);
		else
			m = m & (65535 - (1 << step));

		setMask(p, part, track, m);
	}

	inline function getLength(p, part)
	{
		return ok ? Math.round(pat.getValue(base(p) + 24 + part)) : 16;
	}

	inline function setLength(p, part, numSteps)
	{
		if (ok)
			pat.setValue(base(p) + 24 + part, numSteps);
	}

	inline function clearPattern(p)
	{
		local i;

		for (i = 0; i < 24; i++)
			pat.setValue(base(p) + i, 0);

		setLength(p, 0, 16);
		setLength(p, 1, 0);
	}

	inline function getNumMeasures(t)
	{
		return ok ? Math.round(trk.getValue(1 + t * TRACK_STRIDE)) : 0;
	}

	inline function getMeasure(t, m)
	{
		return Math.round(trk.getValue(1 + t * TRACK_STRIDE + 1 + m));
	}

	inline function appendMeasure(t, p)
	{
		local n = getNumMeasures(t);

		if (ok && n < MAX_MEASURES)
		{
			trk.setValue(1 + t * TRACK_STRIDE + 1 + n, p);
			trk.setValue(1 + t * TRACK_STRIDE, n + 1);
		}
	}

	inline function clearTrack(t)
	{
		if (ok)
			trk.setValue(1 + t * TRACK_STRIDE, 0);
	}

	/** Copies pattern src (both parts, lengths) onto pattern dst. */
	inline function copyPattern(src, dst)
	{
		local i;

		if (!ok || src == dst)
			return;

		for (i = 0; i < STRIDE; i++)
			pat.setValue(base(dst) + i, pat.getValue(base(src) + i));
	}

	// one level of undo for the pattern and track memory
	reg undoPat = [];
	reg undoTrk = [];

	/** Call before every change of the memory, undo() goes back to this state. */
	inline function saveUndo()
	{
		local i;

		if (!ok)
			return;

		undoPat = [];
		undoTrk = [];

		for (i = 0; i < PAT_SIZE; i++)
			undoPat.push(pat.getValue(i));

		for (i = 0; i < TRK_SIZE; i++)
			undoTrk.push(trk.getValue(i));
	}

	inline function undo()
	{
		local i;

		if (!ok || undoPat.length != PAT_SIZE)
			return false;

		for (i = 0; i < PAT_SIZE; i++)
			pat.setValue(i, undoPat[i]);

		for (i = 0; i < TRK_SIZE; i++)
			trk.setValue(i, undoTrk[i]);

		return true;
	}

	inline function setRow(p, part, track, stepString)
	{
		// "x...x...x...x..." -> mask (x = on)
		local m = 0;
		local i;

		for (i = 0; i < stepString.length; i++)
		{
			if (stepString.charAt(i) == "x")
				m = m | (1 << i);
		}

		setMask(p, part, track, m);
	}

	inline function loadDemoPatterns()
	{
		local p;

		// 1A: four on the floor
		p = patternIndex(0, 0);
		setRow(p, 0, BD, "x...x...x...x...");
		setRow(p, 0, CP, "....x.......x...");
		setRow(p, 0, CH, "x.x.x.x.x.x.x.x.");
		setRow(p, 0, OH, "..x...x...x...x.");
		setRow(p, 0, AC, "x...x...x...x...");

		// 1B: same with snare and cowbell
		p = patternIndex(0, 1);
		setRow(p, 0, BD, "x...x...x...x.x.");
		setRow(p, 0, SD, "....x.......x...");
		setRow(p, 0, CH, "xxxxxxxxxxxxxxxx");
		setRow(p, 0, CB, "..x..x....x..x..");
		setRow(p, 0, AC, "x.......x.......");

		// 2A / 2B: electro
		p = patternIndex(1, 0);
		setRow(p, 0, BD, "x.....x...x.....");
		setRow(p, 0, SD, "....x.......x...");
		setRow(p, 0, CH, "x.x.x.x.x.x.x.x.");
		setRow(p, 0, CP, "....x.......x...");
		p = patternIndex(1, 1);
		setRow(p, 0, BD, "x.....x...x..x..");
		setRow(p, 0, SD, "....x.......x..x");
		setRow(p, 0, CH, "x.x.x.x.x.x.x.x.");
		setRow(p, 0, RS, "..x.....x.....x.");

		// 3A: hip hop with toms in the 2nd part
		p = patternIndex(2, 0);
		setRow(p, 0, BD, "x......x..x.....");
		setRow(p, 0, SD, "....x.......x...");
		setRow(p, 0, CH, "x.xxx.x.x.xxx.x.");
		setRow(p, 1, BD, "x......x..x.....");
		setRow(p, 1, SD, "....x.......x...");
		setRow(p, 1, LT, "............x...");
		setRow(p, 1, MT, "..........x.....");
		setRow(p, 1, HT, "........x.......");
		setLength(p, 1, 16);

		// 13A / 13B: fill ins
		p = patternIndex(12, 0);
		setRow(p, 0, BD, "x...............");
		setRow(p, 0, SD, "....x.x.xxxxxxxx");
		setRow(p, 0, AC, "........x...x...");
		p = patternIndex(12, 1);
		setRow(p, 0, BD, "x...............");
		setRow(p, 0, HT, "....xx..........");
		setRow(p, 0, MT, "........xx......");
		setRow(p, 0, LT, "............xx..");
		setRow(p, 0, CY, "x...............");

		// rhythm track 1: 1A 1A 1B 13A
		appendMeasure(0, patternIndex(0, 0));
		appendMeasure(0, patternIndex(0, 0));
		appendMeasure(0, patternIndex(0, 1));
		appendMeasure(0, patternIndex(12, 0));
	}

	inline function init()
	{
		local i;

		if (!Dsp.ready)
			return;

		pat = Engine.getComplexDataReference("SliderPack", Dsp.DSP_ID, 0);
		trk = Engine.getComplexDataReference("SliderPack", Dsp.DSP_ID, 1);

		ok = isDefined(pat) && isDefined(trk);

		if (!ok)
			return;

		pat.setRange(0.0, 65535.0, 1.0);
		trk.setRange(0.0, 65535.0, 1.0);

		if (pat.getNumSliders() != PAT_SIZE || Math.round(pat.getValue(0)) != MAGIC)
		{
			pat.setNumSliders(PAT_SIZE);
			pat.setAllValues(0.0);

			for (i = 0; i < NUM_PATTERNS; i++)
				setLength(i, 0, 16);

			pat.setValue(0, MAGIC);

			trk.setNumSliders(TRK_SIZE);
			trk.setAllValues(0.0);
			trk.setValue(0, MAGIC);

			loadDemoPatterns();
		}

		if (trk.getNumSliders() != TRK_SIZE || Math.round(trk.getValue(0)) != MAGIC)
		{
			trk.setNumSliders(TRK_SIZE);
			trk.setAllValues(0.0);
			trk.setValue(0, MAGIC);
		}
	}

	/** Playback position published by the node: {running, step, part, pattern, measure}. */
	inline function getPosition()
	{
		local v = ok ? Math.round(pat.getCurrentlyDisplayedIndex()) : 0;

		if (v <= 0)
			return { running: false, step: -1, part: 0, pattern: 0, measure: 0 };

		v = v - 1;

		return {
			running: true,
			step: v % 16,
			part: Math.floor(v / 16) % 2,
			pattern: Math.floor(v / 32) % 32,
			measure: Math.floor(v / 1024)
		};
	}

	init();
}
