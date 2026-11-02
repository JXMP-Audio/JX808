Content.makeFrontInterface(1280, 762);

// MIDI callbacks run on the UI thread: the events still reach the JX808 engine
// immediately and sample accurately, this script only uses copies for MIDI programming.
Synth.deferCallbacks(true);

include("JX808/Engine.js");
include("JX808/Theme.js");
include("JX808/LookAndFeel.js");
include("JX808/PanelArt.js");
include("JX808/FrontPanel.js");
include("JX808/RearPanel.js");
include("JX808/MidiExport.js");
include("JX808/Factory.js");
include("JX808/Presets.js");
include("JX808/Help.js");
include("JX808/Automation.js");

FrontPanel.pushAll();
// after onInit: the module state (node + pattern memory) is only complete once the
// interface is running, so the factory presets are written from a timer
const var factoryTimer = Engine.createTimerObject();
factoryTimer.setTimerCallback(function()
{
	this.stopTimer();
	Factory.generateIfRequested();
});
factoryTimer.startTimer(1000);
function onNoteOn()
{
	FrontPanel.handleMidiNote(Message.getNoteNumber(), Message.getVelocity(), Message.getChannel());
}
 function onNoteOff()
{

}
 function onController()
{

}
 function onTimer()
{

}
 function onControl(number, value)
{

}
