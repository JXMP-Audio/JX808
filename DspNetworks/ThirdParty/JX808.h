// ==================================| Third Party Node: JX808 |==================================
//
// Drum machine CPU section (tempo clock, sequencer, trigger gates, accent)
// and the voicing board. The DSP lives in src/jx808_dsp.h (plain C++).
//
// Load it in a "Hardcoded Master FX" inside a "Silent Synth" (see Scripts/JX808/Engine.js):
// that module forwards all MIDI events with their timestamps to handleHiseEvent().
//
// External data:
//   SliderPack 0 = pattern memory, SliderPack 1 = rhythm track memory (layout: jx808::Memory)
//   SliderPack 0 display value = playback position (see jx808::Engine::playStep)

#pragma once

#include <JuceHeader.h>

#include "src/jx808_dsp.h"

namespace project
{

using namespace juce;
using namespace hise;
using namespace scriptnode;

template <int NV> struct JX808: public data::base,
                               public hise::TempoListener
{
	SNEX_NODE(JX808);

	struct MetadataClass
	{
		SN_NODE_ID("JX808");
	};

	static constexpr bool isModNode() { return false; };
	static constexpr bool isPolyphonic() { return NV > 1; };
	static constexpr bool hasTail() { return true; };
	static constexpr bool isSuspendedOnSilence() { return false; };
	static constexpr int getFixChannelAmount() { return 2; };

	static constexpr int NumTables = 0;
	static constexpr int NumSliderPacks = 2;
	static constexpr int NumAudioFiles = 0;
	static constexpr int NumFilters = 0;
	static constexpr int NumDisplayBuffers = 0;

	// ---------------------------------------------------------------------------- state

	struct QueuedEvent
	{
		enum Type { NoteOn, NoteOff, PitchBend, AllOff };
		int timestamp;
		Type type;
		int channel, number, value;
	};

	jx808::Engine engine;
	snex::ExternalData patternData, trackData;
	std::array<QueuedEvent, 512> queue;
	int numQueued = 0;
	double lastDisplayValue = -1.0;

	// ------------------------------------------------------------------------ callbacks

	hise::DllBoundaryTempoSyncer* syncer = nullptr;

	~JX808()
	{
		if (syncer != nullptr)
			syncer->deregisterItem(this);
	}

	void prepare(PrepareSpecs specs)
	{
		engine.prepare(specs.sampleRate);

		// DAW sync: tempo, transport and position (PPQ) of the host, see jx808::Engine::hostTransport
		if (syncer == nullptr && specs.voiceIndex != nullptr)
		{
			syncer = specs.voiceIndex->getTempoSyncer();

			if (syncer != nullptr)
				syncer->registerItem(this);
		}
	}

	void tempoChanged(double newTempo) override
	{
		engine.hostTempo(newTempo);
	}

	void onTransportChange(bool isPlaying, double ppqPosition) override
	{
		engine.hostTransport(isPlaying, ppqPosition);
	}

	void onResync(double ppqPosition) override
	{
		engine.hostResync(ppqPosition);
	}

	void reset()
	{
		engine.reset();
	}

	void handleHiseEvent(HiseEvent& e)
	{
		if (numQueued >= (int)queue.size())
			return;

		QueuedEvent q { e.getTimeStamp(), QueuedEvent::NoteOn, e.getChannel(), 0, 0 };

		if (e.isNoteOn())
		{
			q.number = e.getNoteNumber();
			q.value = e.getVelocity();
		}
		else if (e.isNoteOff())
		{
			q.type = QueuedEvent::NoteOff;
			q.number = e.getNoteNumber();
		}
		else if (e.isPitchWheel())
		{
			q.type = QueuedEvent::PitchBend;
			q.value = e.getPitchWheelValue();
		}
		else if (e.isAllNotesOff())
			q.type = QueuedEvent::AllOff;
		else
			return;

		// keep the queue sorted by timestamp (events usually arrive in order)
		int i = numQueued++;
		while (i > 0 && queue[i - 1].timestamp > q.timestamp)
		{
			queue[i] = queue[i - 1];
			i--;
		}
		queue[i] = q;
	}

	void applyEvent(const QueuedEvent& q)
	{
		switch (q.type)
		{
			case QueuedEvent::NoteOn:    engine.noteOn(q.channel, q.number, q.value); break;
			case QueuedEvent::NoteOff:   engine.noteOff(q.channel, q.number); break;
			case QueuedEvent::PitchBend: engine.pitchBend(q.channel, q.value); break;
			case QueuedEvent::AllOff:    engine.allNotesOff(); break;
		}
	}

	template <typename T> void process(T& data)
	{
		const int numSamples = data.getNumSamples();
		auto channels = data.getRawDataPointers();
		float* left = channels[0];
		float* right = data.getNumChannels() > 1 ? channels[1] : nullptr;

		DataTryReadLock patternLock(patternData);
		DataTryReadLock trackLock(trackData);

		engine.setMemory(patternLock ? static_cast<const float*>(patternData.data) : nullptr,
		                 patternLock ? patternData.numSamples : 0,
		                 trackLock ? static_cast<const float*>(trackData.data) : nullptr,
		                 trackLock ? trackData.numSamples : 0);

		engine.beginBlock();

		int pos = 0;

		for (int i = 0; i < numQueued; i++)
		{
			const int ts = jlimit(pos, numSamples, queue[i].timestamp);

			if (ts > pos)
			{
				engine.render(left + pos, right != nullptr ? right + pos : nullptr, ts - pos);
				pos = ts;
			}

			applyEvent(queue[i]);
		}

		numQueued = 0;

		if (pos < numSamples)
			engine.render(left + pos, right != nullptr ? right + pos : nullptr, numSamples - pos);

		engine.setMemory(nullptr, 0, nullptr, 0);

		// sequencer hits -> plugin MIDI output (HISE patch 0003: sendToMidiOut)
		if (syncer != nullptr && syncer->sendToMidiOut)
		{
			for (int i = 0; i < engine.numMidiOut; i++)
			{
				const auto& m = engine.midiOut[i];
				HiseEvent e(m.on ? HiseEvent::Type::NoteOn : HiseEvent::Type::NoteOff, (uint8)m.note, (uint8)m.velocity, 10);
				e.setTimeStamp(m.offset);
				e.setArtificial();
				syncer->sendToMidiOut(e);
			}
		}

		if (engine.displayValue != lastDisplayValue)
		{
			lastDisplayValue = engine.displayValue;
			patternData.setDisplayedValue(lastDisplayValue);
		}
	}

	template <typename T> void processFrame(T& data)
	{
		// not used: process() renders whole blocks
	}

	bool handleModulation(double& value)
	{
		return false;
	}

	void setExternalData(const ExternalData& data, int index)
	{
		if (index == 0)
		{
			data::base::setExternalData(data, index);
			patternData = data;
		}
		else if (index == 1)
			trackData = data;
	}

	// ----------------------------------------------------------------------- parameters

	template <int P> void setParameter(double v)
	{
		engine.setParam(P, (float)v);
	}

	void createParameters(ParameterDataList& data)
	{
		struct Def
		{
			const char* id;
			double min, max, step, def;
			StringArray names;
		};

		const StringArray offOn { "Off", "On" };

		const Def defs[jx808::NumParams] = {
			{ "Run",            0, 1, 1, 0, offOn },
			{ "Tempo",          40, 300, 0.1, 120, {} },
			{ "PreScale",       0, 3, 1, 2, { "1", "2", "3", "4" } },
			{ "Mode",           0, 2, 1, 0, { "Manual Play", "Track Play", "Pattern Edit" } },
			{ "Pattern",        0, 15, 1, 0, {} },
			{ "BasicVariation", 0, 2, 1, 0, { "A", "AB", "B" } },
			{ "IFVariation",    0, 1, 1, 0, { "A", "B" } },
			{ "AutoFill",       0, 5, 1, 0, { "Manual", "16", "12", "8", "4", "2" } },
			{ "FillSelect",     0, 3, 1, 0, { "13", "14", "15", "16" } },
			{ "FillTrigger",    0, 1, 1, 0, offOn },
			{ "TrackNumber",    0, 11, 1, 0, {} },
			{ "EditPart",       0, 1, 1, 0, { "1st", "2nd" } },
			{ "EditVariation",  0, 1, 1, 0, { "A", "B" } },
			{ "Accent",         0, 1, 0.0, 0.6, {} },
			{ "MasterVolume",   0, 1, 0.0, 0.8, {} },
			{ "BD_Level",       0, 1, 0.0, 0.75, {} },
			{ "BD_Tone",        0, 1, 0.0, 0.5, {} },
			{ "BD_Decay",       0, 1, 0.0, 0.5, {} },
			{ "SD_Level",       0, 1, 0.0, 0.75, {} },
			{ "SD_Tone",        0, 1, 0.0, 0.5, {} },
			{ "SD_Snappy",      0, 1, 0.0, 0.5, {} },
			{ "LT_Level",       0, 1, 0.0, 0.75, {} },
			{ "LT_Tuning",      0, 1, 0.0, 0.5, {} },
			{ "LT_Conga",       0, 1, 1, 0, { "LT", "LC" } },
			{ "MT_Level",       0, 1, 0.0, 0.75, {} },
			{ "MT_Tuning",      0, 1, 0.0, 0.5, {} },
			{ "MT_Conga",       0, 1, 1, 0, { "MT", "MC" } },
			{ "HT_Level",       0, 1, 0.0, 0.75, {} },
			{ "HT_Tuning",      0, 1, 0.0, 0.5, {} },
			{ "HT_Conga",       0, 1, 1, 0, { "HT", "HC" } },
			{ "RS_Level",       0, 1, 0.0, 0.75, {} },
			{ "RS_Claves",      0, 1, 1, 0, { "RS", "CL" } },
			{ "CP_Level",       0, 1, 0.0, 0.75, {} },
			{ "CP_Maracas",     0, 1, 1, 0, { "CP", "MA" } },
			{ "CB_Level",       0, 1, 0.0, 0.75, {} },
			{ "CY_Level",       0, 1, 0.0, 0.75, {} },
			{ "CY_Tone",        0, 1, 0.0, 0.5, {} },
			{ "CY_Decay",       0, 1, 0.0, 0.5, {} },
			{ "OH_Level",       0, 1, 0.0, 0.75, {} },
			{ "OH_Decay",       0, 1, 0.0, 0.5, {} },
			{ "CH_Level",       0, 1, 0.0, 0.75, {} },
			{ "VelocityMode",   0, 1, 1, 0, { "Accent", "Dynamic" } },
			{ "PitchMode",      0, 1, 1, 0, offOn },
			{ "PitchTarget",    0, 10, 1, 0, { "BD", "SD", "LT/LC", "MT/MC", "HT/HC", "RS/CL", "CP/MA", "CB", "CY", "OH", "CH" } },
			{ "PitchChannel",   0, 16, 1, 0, {} },
			{ "PitchBendRange", 0, 12, 1, 2, {} },
			{ "Glide",          0, 1000, 1, 0, {} },
			{ "HostSync",       0, 1, 1, 0, offOn },
			{ "Swing",          50, 75, 0.1, 50, {} },
			{ "MuteMask",       0, 2047, 1, 0, {} },
			{ "Drive",          0, 1, 0.0, 0, {} },
			{ "Age",            0, 1, 0.0, 0, {} },
			{ "MidiOut",        0, 1, 1, 0, offOn }
		};

		registerAll(data, defs, std::make_integer_sequence<int, jx808::NumParams>());
	}

	template <typename DefType, int... Ps>
	void registerAll(ParameterDataList& data, const DefType* defs, std::integer_sequence<int, Ps...>)
	{
		(registerOne<Ps>(data, defs[Ps]), ...);
	}

	template <int P, typename DefType> void registerOne(ParameterDataList& data, const DefType& d)
	{
		parameter::data p(d.id, { d.min, d.max, d.step });

		if (!d.names.isEmpty())
			p.setParameterValueNames(d.names);

		registerCallback<P>(p);
		p.setDefaultValue(d.def);
		data.add(std::move(p));
	}
};

}
