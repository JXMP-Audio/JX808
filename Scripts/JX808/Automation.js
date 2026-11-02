/*  DAW automation: the sound and tempo knobs are plugin parameters. Selectors, slide switches
    and keys are not (they change modes and patterns, automating them would fight the panel).
*/

namespace Automation
{
	const var IDS = ["Accent", "MasterVolume", "Tempo", "TempoFine", "Shuffle", "Drive", "Age", "PitchBendRange", "Glide",
	                 "BD_Level", "BD_Tone", "BD_Decay", "SD_Level", "SD_Tone", "SD_Snappy", "LT_Level", "LT_Tuning",
	                 "MT_Level", "MT_Tuning", "HT_Level", "HT_Tuning", "RS_Level", "CP_Level", "CB_Level",
	                 "CY_Level", "CY_Tone", "CY_Decay", "OH_Level", "OH_Decay", "CH_Level"];

	const var NAMES = { "MasterVolume": "Master Volume", "TempoFine": "Tempo Fine", "PitchBendRange": "Pitch Bend Range" };

	inline function displayName(id)
	{
		return isDefined(NAMES[id]) ? NAMES[id] : id.replace("_", " ");
	}

	inline function register()
	{
		local i;

		for (i = 0; i < IDS.length; i++)
			FrontPanel.props(Content.getComponent(IDS[i]), { "isPluginParameter": true, "pluginParameterName": displayName(IDS[i]) });
	}

	register();
}
