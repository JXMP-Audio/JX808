/*  JX-808 voice + sequencer engine.

    Plain C++17, no JUCE / HISE dependencies. The HISE node wrapper lives in ../JX808.h.

    Modelled after the classic analogue drum machine circuit (bridged-T voices, common trigger, accent):

    - Common Trig: the CPU emits one pulse per step (PI-2), widened to ~1 ms by IC6.
      Its amplitude is ~4 V without accent and 4..14 V with accent (VR3 = ACCENT knob).
      For CB, CY, OH and CH the range is narrowed to 7..14 V. Each sound generator's
      output amplitude is proportional to the trigger amplitude.
    - Tempo clock: 24 clocks per quarter note, tempo 40..300 BPM.
    - Pattern memory: 12 tracks (11 voices + accent), 1..16 steps per part, 1st/2nd part.
    - BD: bridged-T resonator; right after the trigger the filter time constant is halved
      (resonates at twice its frequency for half a cycle, ~4 ms), then a retrigger pulse
      starts the ring at its inherent frequency (period 16 ms nominal).
    - SD: two bridged-T networks (fundamental + harmonic), ratio = TONE (VR8),
      plus noise "snappy" (VR9).
    - Toms/Congas: bridged-T whose pitch is raised by diodes while the amplitude is large
      (pitch drops as it decays). Toms get pink noise with slightly longer decay.
    - RS: bridged-T outputs through a swing-type VCA (rich in harmonics). CL: high Q
      bridged-T.
    - CP: white noise -> band pass -> two VCAs: a sawtooth envelope (repeats until a
      ~30 ms pulse ends, i.e. ~3 sawtooth hits) and a longer "reverb" envelope.
      MA: white noise gated by a short envelope, high passed.
    - CB: two Schmitt-trigger square oscillators, a VCA each, mixed by a filter;
      envelope with an abrupt initial drop (R82/C34) to emphasise the attack.
    - CY/OH/CH: six square oscillators summed, split into frequency bands. CY: highest
      band short decay, next band decay = CY DECAY, low band; level ratio = CY TONE (VR4).
      OH/CH share the high band; a CH trigger terminates the OH decay.

    Component values in the scanned schematics are not machine readable, so frequencies and
    time constants below use commonly measured values of real units where the text does not
    state them.
*/

#pragma once

#include <algorithm>
#include <array>
#include <atomic>
#include <cmath>
#include <cstdint>

namespace jx808
{

constexpr double kPi = 3.14159265358979323846;
constexpr double kTwoPi = 2.0 * kPi;

inline float clamp01(float x) { return x < 0.0f ? 0.0f : (x > 1.0f ? 1.0f : x); }
inline float expMap(float x, float lo, float hi) { return lo * std::pow(hi / lo, clamp01(x)); }
inline float midiToHz(float note) { return 440.0f * std::pow(2.0f, (note - 69.0f) / 12.0f); }

// coefficient for a multiplicative decay reaching -60 dB after t60 seconds
inline float t60Coef(float t60, double sr) { return (float)std::exp(-6.907755 / (std::max(1.0e-4f, t60) * sr)); }

// =============================================================================================
// Building blocks
// =============================================================================================

struct WhiteNoise
{
    uint32_t s = 0x6d2b79f5u;
    float next()
    {
        s ^= s << 13; s ^= s >> 17; s ^= s << 5;
        return (float)(int32_t)s * (1.0f / 2147483648.0f);
    }
};

// Paul Kellet's economy pink filter
struct PinkFilter
{
    float b0 = 0, b1 = 0, b2 = 0;
    float process(float w)
    {
        b0 = 0.99765f * b0 + w * 0.0990460f;
        b1 = 0.96300f * b1 + w * 0.2965164f;
        b2 = 0.57000f * b2 + w * 1.0526913f;
        return (b0 + b1 + b2 + w * 0.1848f) * 0.25f;
    }
    void reset() { b0 = b1 = b2 = 0; }
};

struct OnePole
{
    float a = 0, z = 0, lastFc = -1.0f;
    void set(float fc, double sr)
    {
        if (fc == lastFc) return;
        lastFc = fc;
        a = (float)std::exp(-kTwoPi * std::min((double)fc, sr * 0.49) / sr);
    }
    float lp(float x) { z = x + a * (z - x); return z; }
    float hp(float x) { return x - lp(x); }
    void reset() { z = 0; }
};

// Topology preserving state variable filter (stable under modulation)
struct Svf
{
    float g = 0, k = 1, a1 = 0, a2 = 0, a3 = 0, ic1 = 0, ic2 = 0;
    float lp = 0, bp = 0, hp = 0, lastFc = -1.0f, lastQ = -1.0f;

    void set(float fc, float q, double sr)
    {
        if (fc == lastFc && q == lastQ) return;
        lastFc = fc;
        lastQ = q;
        fc = (float)std::min((double)fc, sr * 0.45);
        g = (float)std::tan(kPi * fc / sr);
        k = 1.0f / q;
        a1 = 1.0f / (1.0f + g * (g + k));
        a2 = g * a1;
        a3 = g * a2;
    }

    void tick(float v0)
    {
        const float v3 = v0 - ic2;
        const float v1 = a1 * ic1 + a2 * v3;
        const float v2 = ic2 + a2 * ic1 + a3 * v3;
        ic1 = 2.0f * v1 - ic1;
        ic2 = 2.0f * v2 - ic2;
        lp = v2;
        bp = v1 * k; // unity gain at centre
        hp = v0 - k * v1 - v2;
    }

    void reset() { ic1 = ic2 = lp = bp = hp = 0; }
};

/*  Damped resonator in coupled (rotation) form. A stand in for the bridged-T network:
    an impulse rings as an exponentially decaying sine. Frequency can change per sample
    without clicks because the rotation preserves the state energy.
*/
struct Resonator
{
    float x = 0, y = 0, c = 1, s = 0, r = 0.999f, lastHz = -1.0f, lastT60 = -1.0f;

    void setFreq(float hz, double sr)
    {
        if (hz != lastHz)
        {
            const double w = kTwoPi * std::min((double)hz, sr * 0.45) / sr;
            c = (float)std::cos(w);
            s = (float)std::sin(w);
            lastHz = hz;
        }
    }

    void setT60(float t60, double sr)
    {
        if (t60 == lastT60) return;
        lastT60 = t60;
        r = t60Coef(t60, sr);
    }

    void excite(float amp) { x += amp; }

    float tick()
    {
        const float nx = r * (c * x - s * y);
        const float ny = r * (s * x + c * y);
        x = nx;
        y = ny;
        return y;
    }

    float amplitude() const { return std::sqrt(x * x + y * y); }
    void reset() { x = y = 0; lastHz = -1.0f; }
};

// Free running Schmitt trigger square oscillator (PolyBLEP to keep aliasing down)
struct Square
{
    double ph = 0, inc = 0;

    void setFreq(double hz, double sr) { inc = std::min(hz / sr, 0.45); }

    static float blep(double t, double dt)
    {
        if (t < dt) { t /= dt; return (float)(t + t - t * t - 1.0); }
        if (t > 1.0 - dt) { t = (t - 1.0) / dt; return (float)(t * t + t + t + 1.0); }
        return 0.0f;
    }

    float tick()
    {
        float v = ph < 0.5 ? 1.0f : -1.0f;
        v += blep(ph, inc);
        double p2 = ph + 0.5;
        if (p2 >= 1.0) p2 -= 1.0;
        v -= blep(p2, inc);
        ph += inc;
        if (ph >= 1.0) ph -= 1.0;
        return v;
    }
};

struct Decay
{
    float v = 0, c = 0.999f, lastT60 = -1.0f;
    void setT60(float t60, double sr)
    {
        if (t60 == lastT60) return;
        lastT60 = t60;
        c = t60Coef(t60, sr);
    }
    void trigger(float a) { v = a; }
    float tick() { v *= c; if (v < 1.0e-7f) v = 0; return v; }
};

// Six Schmitt oscillators of the cymbal / hi-hat source
struct MetalBank
{
    static constexpr double freqs[6] = { 205.3, 304.4, 369.6, 522.7, 540.0, 800.0 };
    std::array<Square, 6> osc;

    MetalBank()
    {
        // stagger the phases: the real oscillators run free and are never in sync
        for (int i = 0; i < 6; i++) osc[i].ph = 0.137 * (i + 1);
    }

    void setPitch(float mul, double sr)
    {
        for (int i = 0; i < 6; i++) osc[i].setFreq(freqs[i] * mul, sr);
    }

    float tick()
    {
        float sum = 0;
        for (auto& o : osc) sum += o.tick();
        return sum * (1.0f / 6.0f);
    }
};

// =============================================================================================
// Voices. Every voice: prepare(sr), trigger(volts, alt), tick(), level/knob members,
// pitchMul (1 = native tuning) and nativeHz() for MIDI pitch control.
// =============================================================================================

struct BassDrum
{
    double sr = 44100;
    float level = 0.75f, tone = 0.5f, decay = 0.5f, pitchMul = 1.0f;

    Resonator res;
    OnePole toneLp, clickHp;
    int age = 1 << 30, boostSamples = 0, pulseSamples = 0;
    float retrigAmp = 0, pulseAmp = 0;

    static float nativeHz() { return 56.0f; }

    void prepare(double s) { sr = s; clickHp.set(150.0f, sr); reset(); }
    void reset() { res.reset(); toneLp.reset(); clickHp.reset(); age = 1 << 30; }

    void trigger(float volts, bool)
    {
        const float a = volts / 14.0f;
        const float f = nativeHz() * pitchMul;
        // time constant halved: twice the frequency for half a cycle of that (= 1/4 period)
        boostSamples = (int)(sr / (4.0 * f));
        retrigAmp = a * 0.4f;
        pulseSamples = (int)(0.001 * sr);
        pulseAmp = a;
        res.excite(a);
        age = 0;
    }

    float tick()
    {
        const float f = nativeHz() * pitchMul;
        res.setFreq(age < boostSamples ? 2.0f * f : f, sr);
        res.setT60(expMap(decay, 0.15f, 2.5f), sr);

        if (age == boostSamples)
            res.excite(retrigAmp); // retriggering pulse from C39/R161

        const float click = clickHp.hp(age < pulseSamples ? pulseAmp : 0.0f) * 0.3f;
        const float y = res.tick();

        if (age < (1 << 30)) age++;

        toneLp.set(expMap(tone, 250.0f, 7000.0f), sr);
        return std::tanh(1.4f * toneLp.lp(y + click)) * level;
    }
};

struct SnareDrum
{
    double sr = 44100;
    float level = 0.75f, tone = 0.5f, snappy = 0.5f, pitchMul = 1.0f;

    Resonator r1, r2;
    Svf noiseFilter;
    OnePole noiseLp;
    Decay noiseEnv;
    WhiteNoise noise;

    static float nativeHz() { return 238.0f; }

    void prepare(double s)
    {
        sr = s;
        r1.setT60(0.28f, sr);
        r2.setT60(0.16f, sr);
        noiseFilter.set(1800.0f, 0.7f, sr);
        noiseLp.set(7000.0f, sr);
        noiseEnv.setT60(0.26f, sr);
        reset();
    }

    void reset() { r1.reset(); r2.reset(); noiseFilter.reset(); noiseLp.reset(); noiseEnv.v = 0; }

    void trigger(float volts, bool)
    {
        const float a = volts / 14.0f;
        r1.excite(a);
        r2.excite(a);
        noiseEnv.trigger(a);
    }

    float tick()
    {
        r1.setFreq(nativeHz() * pitchMul, sr);
        r2.setFreq(2.0f * nativeHz() * pitchMul, sr);

        const float body = r1.tick() * (1.0f - 0.6f * tone) + r2.tick() * (0.25f + 0.9f * tone);
        noiseFilter.tick(noise.next());
        const float snap = noiseLp.lp(noiseFilter.hp) * noiseEnv.tick() * snappy * 1.0f;
        return std::tanh(body + snap) * level;
    }
};

// LT/LC, MT/MC, HT/HC
struct TomConga
{
    double sr = 44100;
    float level = 0.75f, tuning = 0.5f, pitchMul = 1.0f;
    bool congaSwitch = false; // panel switch, used by the sequencer
    bool conga = false;       // timbre of the currently ringing note

    float tomLo, tomHi, congaLo, congaHi, tomT60, congaT60;

    Resonator res;
    Decay noiseEnv;
    WhiteNoise noise;
    PinkFilter pink;
    OnePole noiseLp;

    TomConga(float tl, float th, float cl, float ch, float tt, float ct):
        tomLo(tl), tomHi(th), congaLo(cl), congaHi(ch), tomT60(tt), congaT60(ct)
    {}

    float nativeHz() const
    {
        return conga ? expMap(tuning, congaLo, congaHi) : expMap(tuning, tomLo, tomHi);
    }

    void prepare(double s) { sr = s; noiseLp.set(1200.0f, sr); reset(); }
    void reset() { res.reset(); noiseEnv.v = 0; pink.reset(); noiseLp.reset(); }

    void trigger(float volts, bool alt)
    {
        const float a = volts / 14.0f;
        conga = alt;
        res.setT60(conga ? congaT60 : tomT60, sr);
        noiseEnv.setT60((conga ? congaT60 : tomT60) * 1.25f, sr);
        res.excite(a);
        noiseEnv.trigger(conga ? 0.0f : a);
    }

    float tick()
    {
        // diodes D80/D81: large amplitude -> shorter time constant -> higher pitch
        const float sweep = conga ? 0.18f : 0.32f;
        res.setFreq(nativeHz() * pitchMul * (1.0f + sweep * std::min(1.0f, res.amplitude())), sr);
        const float body = res.tick();
        const float n = noiseLp.lp(pink.process(noise.next())) * noiseEnv.tick() * 0.12f;
        return std::tanh(1.2f * (body + n)) * level;
    }
};

struct RimClave
{
    double sr = 44100;
    float level = 0.75f, pitchMul = 1.0f;
    bool clavesSwitch = false;
    bool claves = false;

    Resonator rs1, rs2, cl;
    Decay vcaEnv;
    OnePole hp;

    float nativeHz() const { return claves ? 2500.0f : 455.0f; }

    void prepare(double s)
    {
        sr = s;
        rs1.setT60(0.06f, sr);
        rs2.setT60(0.045f, sr);
        cl.setT60(0.09f, sr);
        vcaEnv.setT60(0.06f, sr); // R107 / C24
        hp.set(220.0f, sr);
        reset();
    }

    void reset() { rs1.reset(); rs2.reset(); cl.reset(); vcaEnv.v = 0; hp.reset(); }

    void trigger(float volts, bool alt)
    {
        const float a = volts / 14.0f;
        claves = alt;
        if (claves)
            cl.excite(a);
        else
        {
            rs1.excite(a);
            rs2.excite(a * 0.8f);
            vcaEnv.trigger(a);
        }
    }

    float tick()
    {
        rs1.setFreq(455.0f * pitchMul, sr);
        rs2.setFreq(1667.0f * pitchMul, sr);
        cl.setFreq(2500.0f * pitchMul, sr);

        // swing type VCA: the signal rides on the envelope and only conducts in one
        // direction, which produces the rich harmonic content
        const float env = vcaEnv.tick();
        float v = (rs1.tick() + rs2.tick()) * 3.0f + env;
        v = v > 0.0f ? v : 0.15f * v;
        const float rim = hp.hp(v * env * 1.6f);

        return std::tanh(rim + cl.tick()) * level;
    }
};

struct ClapMaracas
{
    double sr = 44100;
    float level = 0.75f, pitchMul = 1.0f;
    bool maracasSwitch = false;

    WhiteNoise noise;
    Svf clapBp, maracasHp;
    OnePole clapOutHp;

    int clapAge = 1 << 30;
    float clapAmp = 0;
    float sawEnv = 0, sawCoef = 0;
    Decay reverbEnv, maracasEnv;
    float maracasAttack = 0, maracasAttackInc = 0;
    int sawPeriod = 0, sawCount = 0;

    static float nativeHz() { return 1000.0f; }

    void prepare(double s)
    {
        sr = s;
        sawCoef = t60Coef(0.025f, sr);
        reverbEnv.setT60(0.38f, sr);  // Q70 VCA, "reverberation of CP sound"
        maracasEnv.setT60(0.07f, sr);
        maracasAttackInc = (float)(1.0 / (0.002 * sr));
        sawPeriod = (int)(0.0105 * sr);
        clapOutHp.set(300.0f, sr);
        maracasHp.set(5000.0f, 0.8f, sr);
        reset();
    }

    void reset() { clapBp.reset(); maracasHp.reset(); clapOutHp.reset(); clapAge = 1 << 30; sawEnv = 0; reverbEnv.v = 0; maracasEnv.v = 0; maracasAttack = 1; }

    void trigger(float volts, bool alt)
    {
        const float a = volts / 14.0f;
        if (alt)
        {
            maracasEnv.trigger(a);
            maracasAttack = 0;
        }
        else
        {
            clapAmp = a;
            clapAge = 0;
            sawCount = 0;
            reverbEnv.trigger(a * 0.45f);
        }
    }

    float tick()
    {
        clapBp.set(nativeHz() * pitchMul, 1.4f, sr);

        // sawtooth envelope generator (IC23): restarts every ~10 ms until the 30 ms pulse
        // from R350/C140 ends; the third sawtooth runs out freely
        if (clapAge < (1 << 30))
        {
            if (clapAge % sawPeriod == 0 && sawCount < 3)
            {
                sawEnv = clapAmp;
                sawCount++;
            }
            clapAge++;
        }

        sawEnv *= sawCoef;
        const float n = noise.next();
        clapBp.tick(n);
        const float clap = clapOutHp.hp(clapBp.bp * (sawEnv * 2.2f + reverbEnv.tick()));

        maracasHp.tick(n);
        maracasAttack = std::min(1.0f, maracasAttack + maracasAttackInc);
        const float maracas = maracasHp.hp * maracasEnv.tick() * maracasAttack * 1.3f;

        return std::tanh(2.0f * (clap + maracas)) * level;
    }
};

struct Cowbell
{
    double sr = 44100;
    float level = 0.75f, pitchMul = 1.0f;

    Square o1, o2;
    Decay attackEnv, tailEnv;
    Svf bp;

    static float nativeHz() { return 540.0f; }

    void prepare(double s)
    {
        sr = s;
        o2.ph = 0.3;
        attackEnv.setT60(0.035f, sr); // R82/C34: abrupt drop right after the attack
        tailEnv.setT60(0.55f, sr);
        bp.set(2640.0f, 1.0f, sr);
        reset();
    }

    void reset() { attackEnv.v = tailEnv.v = 0; bp.reset(); }

    void trigger(float volts, bool)
    {
        const float a = volts / 14.0f;
        attackEnv.trigger(a * 0.75f);
        tailEnv.trigger(a * 0.25f);
    }

    float tick()
    {
        o1.setFreq(540.0 * pitchMul, sr);
        o2.setFreq(800.0 * pitchMul, sr);
        const float env = attackEnv.tick() + tailEnv.tick();
        bp.tick((o1.tick() + o2.tick()) * env);
        return std::tanh(0.9f * bp.bp) * level;
    }
};

struct Cymbal
{
    double sr = 44100;
    float level = 0.75f, tone = 0.5f, decay = 0.5f, pitchMul = 1.0f;

    MetalBank bank;
    Svf lowBand, midBand, highBand, outHp;
    Decay lowEnv, midEnv, highEnv;

    void prepare(double s)
    {
        sr = s;
        lowEnv.setT60(0.6f, sr);
        highEnv.setT60(0.12f, sr);
        reset();
    }

    void reset() { lowBand.reset(); midBand.reset(); highBand.reset(); outHp.reset(); lowEnv.v = midEnv.v = highEnv.v = 0; }

    void trigger(float volts, bool)
    {
        const float a = volts / 14.0f;
        lowEnv.trigger(a);
        midEnv.trigger(a);
        highEnv.trigger(a);
    }

    float tick()
    {
        bank.setPitch(pitchMul, sr);
        lowBand.set(3440.0f * pitchMul, 1.2f, sr);
        midBand.set(7100.0f * pitchMul, 0.9f, sr);
        highBand.set(10500.0f * pitchMul, 0.9f, sr);
        outHp.set(2800.0f, 0.7f, sr);
        midEnv.setT60(expMap(decay, 0.35f, 2.6f), sr);

        const float src = bank.tick();
        lowBand.tick(src);
        midBand.tick(src);
        highBand.tick(src);

        const float lo = lowBand.bp * lowEnv.tick() * (1.1f - 0.9f * tone);
        const float mid = midBand.hp * midEnv.tick() * (0.5f + 0.6f * tone);
        const float hi = highBand.hp * highEnv.tick() * (0.3f + 0.9f * tone);

        outHp.tick(lo + mid + hi);
        return std::tanh(3.0f * outHp.hp) * level;
    }
};

// OH and CH share the metallic source and the high band
struct HiHats
{
    double sr = 44100;
    float ohLevel = 0.75f, ohDecay = 0.5f, chLevel = 0.75f, ohPitchMul = 1.0f, chPitchMul = 1.0f;

    MetalBank ohBank, chBank;
    Svf ohBand, chBand, ohOut, chOut;
    Decay ohEnv, chEnv;
    bool choking = false;
    float chokeCoef = 0.99f;

    void prepare(double s)
    {
        sr = s;
        chEnv.setT60(0.12f, sr);
        chokeCoef = t60Coef(0.012f, sr);
        reset();
    }

    void reset() { ohBand.reset(); chBand.reset(); ohOut.reset(); chOut.reset(); ohEnv.v = chEnv.v = 0; choking = false; }

    void triggerOH(float volts) { ohEnv.trigger(volts / 14.0f); choking = false; }

    void triggerCH(float volts)
    {
        chEnv.trigger(volts / 14.0f);
        choking = true; // Q23 terminates the OH decay
    }

    float tickOH()
    {
        ohBank.setPitch(ohPitchMul, sr);
        ohBand.set(7100.0f * ohPitchMul, 0.9f, sr);
        ohOut.set(7000.0f * ohPitchMul, 0.7f, sr);
        ohEnv.setT60(expMap(ohDecay, 0.12f, 1.1f), sr);

        if (choking) ohEnv.v *= chokeCoef;

        ohBand.tick(ohBank.tick());
        ohOut.tick(ohBand.hp * ohEnv.tick());
        return std::tanh(4.0f * ohOut.hp) * ohLevel;
    }

    float tickCH()
    {
        chBank.setPitch(chPitchMul, sr);
        chBand.set(7100.0f * chPitchMul, 0.9f, sr);
        chOut.set(7000.0f * chPitchMul, 0.7f, sr);
        chBand.tick(chBank.tick());
        chOut.tick(chBand.hp * chEnv.tick());
        return std::tanh(4.0f * chOut.hp) * chLevel;
    }
};

// =============================================================================================
// Parameters (the order is the HISE parameter / module attribute index)
// =============================================================================================

enum Param
{
    Run = 0, Tempo, PreScale, Mode, Pattern, BasicVariation, IFVariation, AutoFill, FillSelect,
    FillTrigger, TrackNumber, EditPart, EditVariation,
    Accent, MasterVolume,
    BD_Level, BD_Tone, BD_Decay,
    SD_Level, SD_Tone, SD_Snappy,
    LT_Level, LT_Tuning, LT_Conga,
    MT_Level, MT_Tuning, MT_Conga,
    HT_Level, HT_Tuning, HT_Conga,
    RS_Level, RS_Claves,
    CP_Level, CP_Maracas,
    CB_Level,
    CY_Level, CY_Tone, CY_Decay,
    OH_Level, OH_Decay,
    CH_Level,
    VelocityMode, PitchMode, PitchTarget, PitchChannel, PitchBendRange, Glide,
    HostSync,   // 1: tempo, start/stop and position follow the DAW (PPQ)
    Swing,      // shuffle in percent: 50 = straight, 66.7 = triplet feel, 75 = maximum
    MuteMask,   // bit per instrument (BD = bit 0 ... CH = bit 10): muted voices are not mixed
    Drive,      // 0..1 soft saturation of the output
    Age,        // 0..1 sequencer hits up to 4 ms late and +-15 % in level, like a worn unit
    MidiOut,    // 1: sequencer hits are also sent as MIDI notes (GM drums, channel 10)
    NumParams
};

enum Instrument { BD = 0, SD, LT, MT, HT, RS, CP, CB, CY, OH, CH, AC, NumTracks };

enum PlayMode { ManualPlay = 0, TrackPlay = 1, PatternEdit = 2 };

// Step lengths in tempo clocks for PRE-SCALE 1..4 (8th triplet, 16th triplet, 16th, 32nd)
constexpr int kPreScaleClocks[4] = { 8, 4, 6, 3 };
constexpr int kAutoFillMeasures[6] = { 0, 16, 12, 8, 4, 2 }; // MANUAL, 16, 12, 8, 4, 2

// =============================================================================================
// Pattern memory layout (shared with the interface script through two HISE slider packs)
// =============================================================================================

struct Memory
{
    static constexpr int kMagic = 808;
    static constexpr int kNumPatterns = 32;       // rhythm 1..16 x variation A/B
    static constexpr int kPatternStride = 26;     // 2 parts x 12 track masks + 2 lengths
    static constexpr int kPatternSize = 1 + kNumPatterns * kPatternStride;
    static constexpr int kNumSongTracks = 12;
    static constexpr int kMaxMeasures = 64;
    static constexpr int kTrackStride = 1 + kMaxMeasures;
    static constexpr int kTrackSize = 1 + kNumSongTracks * kTrackStride;

    static int patternIndex(int rhythm, int variation) { return rhythm * 2 + variation; }

    const float* pat = nullptr;
    int patSize = 0;
    const float* trk = nullptr;
    int trkSize = 0;

    bool patternsValid() const { return pat != nullptr && patSize >= kPatternSize && (int)pat[0] == kMagic; }
    bool tracksValid() const { return trk != nullptr && trkSize >= kTrackSize && (int)trk[0] == kMagic; }

    uint32_t mask(int p, int part, int track) const
    {
        if (!patternsValid()) return 0;
        return (uint32_t)pat[1 + p * kPatternStride + part * 12 + track];
    }

    int length(int p, int part) const
    {
        if (!patternsValid()) return part == 0 ? 16 : 0;
        const int v = (int)pat[1 + p * kPatternStride + 24 + part];
        return part == 0 ? std::clamp(v, 1, 16) : std::clamp(v, 0, 16);
    }

    int numMeasures(int t) const
    {
        if (!tracksValid()) return 0;
        return std::clamp((int)trk[1 + t * kTrackStride], 0, kMaxMeasures);
    }

    int measurePattern(int t, int m) const
    {
        return std::clamp((int)trk[1 + t * kTrackStride + 1 + m], 0, kNumPatterns - 1);
    }
};

// =============================================================================================
// Engine: CPU (tempo clock, sequencer, trigger gates) + voicing board
// =============================================================================================

struct Engine
{
    double sr = 44100.0;

    std::array<std::atomic<float>, NumParams> params;

    BassDrum bd;
    SnareDrum sd;
    TomConga lt { 80.0f, 115.0f, 165.0f, 225.0f, 0.9f, 0.32f };
    TomConga mt { 115.0f, 165.0f, 240.0f, 320.0f, 0.75f, 0.27f };
    TomConga ht { 165.0f, 235.0f, 340.0f, 460.0f, 0.6f, 0.22f };
    RimClave rs;
    ClapMaracas cp;
    Cowbell cb;
    Cymbal cy;
    HiHats hh;

    Memory mem;

    // --- sequencer state (audio thread only)
    bool running = false;
    double clockCounter = 0.0;
    int tick = 0, step = 0, part = 0, pattern = 0, measureCount = 0, trackPos = 0, playingMeasure = 0;
    int abCounter = 0;
    bool fillPending = false, lastFillTrigger = false, lastRun = false, isFillMeasure = false;
    double displayValue = 0.0;

    // --- DAW sync. The host callbacks (JX808.h, TempoListener) run on the audio thread before
    //     the block, they only store the transport here; beginBlock() applies it.
    std::atomic<double> hostBpm { 120.0 }, hostPpq { 0.0 };
    std::atomic<bool> hostPlaying { false }, hostPositionFresh { false };
    std::atomic<int> hostEvents { 0 };
    int seenHostEvents = 0;
    bool lastHostSync = false;
    double hostSamples = 0.0;           // samples rendered since the host reported hostPpq
    double pendingStartSamples = -1.0;  // count-in (negative PPQ): start at PPQ 0 after this
    double pendingStepSamples = -1.0;   // shuffle / age: the current step plays after this
    uint32_t rng = 0x2545F491u;         // AGE randomness (deterministic, so renders repeat)

    // --- MIDI out: the sequencer hits of the current block (offsets in samples from the block
    //     start; note-offs may lie beyond the block, the host side keeps them for later)
    struct MidiOutEvent { int note; int velocity; int offset; bool on; };
    std::array<MidiOutEvent, 256> midiOut {};
    int numMidiOut = 0;
    int sampleInBlock = 0;

    static int gmNote(int inst, bool alt)
    {
        static constexpr int notes[11][2] = { { 36, 36 }, { 38, 38 }, { 41, 64 }, { 45, 63 }, { 48, 62 },
                                              { 37, 75 }, { 39, 70 }, { 56, 56 }, { 49, 49 }, { 46, 46 }, { 42, 42 } };
        return notes[std::clamp(inst, 0, 10)][alt ? 1 : 0];
    }

    void sendMidiOut(int inst, bool alt, bool accent)
    {
        if (numMidiOut + 2 > (int)midiOut.size())
            return;

        const int note = gmNote(inst, alt);
        const int length = (int)(sr * 0.05);   // 50 ms notes
        midiOut[numMidiOut++] = { note, accent ? 127 : 90, sampleInBlock, true };
        midiOut[numMidiOut++] = { note, 0, sampleInBlock + length, false };
    }

    float nextRandom()                  // 0..1
    {
        rng = rng * 1664525u + 1013904223u;
        return (float)(rng >> 8) * (1.0f / 16777216.0f);
    }

    // --- MIDI pitch mode state
    std::array<int, 16> held {};
    int numHeld = 0;
    float currentNote = 36.0f, targetNote = 36.0f, bendSemis = 0.0f;
    bool pitchActive = false;
    int lastPitchTarget = -1;

    Engine()
    {
        static constexpr float defaults[NumParams] = {
            0, 120, 2, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0,
            0.6f, 0.8f,
            0.75f, 0.5f, 0.5f,
            0.75f, 0.5f, 0.5f,
            0.75f, 0.5f, 0,
            0.75f, 0.5f, 0,
            0.75f, 0.5f, 0,
            0.75f, 0,
            0.75f, 0,
            0.75f,
            0.75f, 0.5f, 0.5f,
            0.75f, 0.5f,
            0.75f,
            0, 0, 0, 0, 2, 0,
            0, 50,
            0, 0, 0,
            0
        };

        for (int i = 0; i < NumParams; i++) params[i].store(defaults[i]);
    }

    void setParam(int index, float v)
    {
        if (index >= 0 && index < NumParams) params[index].store(v, std::memory_order_relaxed);
    }

    float p(int index) const { return params[index].load(std::memory_order_relaxed); }
    int pi(int index) const { return (int)std::lround(p(index)); }

    void prepare(double sampleRate)
    {
        sr = sampleRate;
        bd.prepare(sr); sd.prepare(sr); lt.prepare(sr); mt.prepare(sr); ht.prepare(sr);
        rs.prepare(sr); cp.prepare(sr); cb.prepare(sr); cy.prepare(sr); hh.prepare(sr);
    }

    void reset()
    {
        bd.reset(); sd.reset(); lt.reset(); mt.reset(); ht.reset();
        rs.reset(); cp.reset(); cb.reset(); cy.reset(); hh.reset();
    }

    void setMemory(const float* pat, int patSize, const float* trk, int trkSize)
    {
        mem.pat = pat; mem.patSize = patSize;
        mem.trk = trk; mem.trkSize = trkSize;
    }

    // ----------------------------------------------------------------------------- triggers

    // Common Trig amplitude in volts: 4 V, or 4..14 V with accent
    float trigVolts(bool accent) const { return accent ? 4.0f + 10.0f * clamp01(p(Accent)) : 4.0f; }

    void triggerInstrument(int inst, float volts, bool alt)
    {
        // CB, CY, OH and CH: trig variation narrowed to 7..14 V (IC2 on the voicing board)
        const float metal = 7.0f + (volts - 4.0f) * 0.7f;

        switch (inst)
        {
            case BD: bd.trigger(volts, false); break;
            case SD: sd.trigger(volts, false); break;
            case LT: lt.trigger(volts, alt); break;
            case MT: mt.trigger(volts, alt); break;
            case HT: ht.trigger(volts, alt); break;
            case RS: rs.trigger(volts, alt); break;
            case CP: cp.trigger(volts, alt); break;
            case CB: cb.trigger(metal, false); break;
            case CY: cy.trigger(metal, false); break;
            case OH: hh.triggerOH(metal); break;
            case CH: hh.triggerCH(metal); break;
            default: break;
        }
    }

    bool panelAlt(int inst) const
    {
        switch (inst)
        {
            case LT: return pi(LT_Conga) != 0;
            case MT: return pi(MT_Conga) != 0;
            case HT: return pi(HT_Conga) != 0;
            case RS: return pi(RS_Claves) != 0;
            case CP: return pi(CP_Maracas) != 0;
            default: return false;
        }
    }

    // ---------------------------------------------------------------------------- DAW sync

    void hostTempo(double bpm)
    {
        if (bpm > 0.0) hostBpm.store(bpm);
    }

    void hostTransport(bool playing, double ppq)
    {
        hostPpq.store(ppq);
        hostPlaying.store(playing);
        hostPositionFresh.store(true);
        hostEvents.fetch_add(1);
    }

    /** The host jumped (loop, locate): realign at the new position. */
    void hostResync(double ppq)
    {
        hostPpq.store(ppq);
        hostPositionFresh.store(true);
        hostEvents.fetch_add(1);
    }

    double currentTempo() const
    {
        const double bpm = pi(HostSync) != 0 ? hostBpm.load() : (double)p(Tempo);
        return std::clamp(bpm, 30.0, 300.0);
    }

    double samplesPerClock() const { return sr * 60.0 / (currentTempo() * 24.0); }

    // --------------------------------------------------------------------------- sequencer

    int currentRhythm() const { return std::clamp(pi(Pattern), 0, 15); }

    int partLength(int pt, int prt) const
    {
        const int l = mem.length(pt, prt);
        return (prt == 1 && l == 0) ? 16 : l; // editing an empty 2nd part: show all 16 steps
    }

    void beginMeasure()
    {
        step = 0;
        part = 0;
        isFillMeasure = false;
        const int mode = pi(Mode);

        if (mode == PatternEdit)
        {
            pattern = Memory::patternIndex(currentRhythm(), pi(EditVariation));
            part = std::clamp(pi(EditPart), 0, 1);
            return;
        }

        if (mode == TrackPlay)
        {
            const int t = std::clamp(pi(TrackNumber), 0, 11);
            const int n = mem.numMeasures(t);

            if (n > 0)
            {
                if (trackPos >= n) trackPos = 0;
                playingMeasure = trackPos;
                pattern = mem.measurePattern(t, trackPos);
                trackPos = (trackPos + 1) % n;
                measureCount++;
                return;
            }
        }

        // MANUAL PLAY: basic variation A / AB / B, intro / fill in
        const int autoFill = kAutoFillMeasures[std::clamp(pi(AutoFill), 0, 5)];
        const bool autoFillNow = autoFill > 0 && (measureCount % autoFill) == autoFill - 1;

        if (fillPending || autoFillNow)
        {
            fillPending = false;
            isFillMeasure = true;
            pattern = Memory::patternIndex(12 + std::clamp(pi(FillSelect), 0, 3), pi(IFVariation));
        }
        else
        {
            int variation = 0;
            switch (pi(BasicVariation))
            {
                case 0: variation = 0; break;
                case 1: variation = abCounter & 1; break;
                default: variation = 1; break;
            }
            abCounter++;
            pattern = Memory::patternIndex(currentRhythm(), variation);
        }

        measureCount++;
    }

    void playStep()
    {
        const bool accent = (mem.mask(pattern, part, AC) >> step) & 1u;
        const float age = std::clamp(p(Age), 0.0f, 1.0f);
        const float volts = trigVolts(accent) * (age > 0.0f ? 1.0f + (nextRandom() * 2.0f - 1.0f) * 0.15f * age : 1.0f);

        for (int t = 0; t < AC; t++)
        {
            if ((mem.mask(pattern, part, t) >> step) & 1u)
            {
                if (pitchActive && pi(PitchMode) != 0 && t == pi(PitchTarget) && numHeld == 0)
                {
                    pitchActive = false; // sequencer hit with no keys held: back to panel tuning
                    applyPitch(true);
                }
                triggerInstrument(t, volts, panelAlt(t));

                if (pi(MidiOut) != 0)
                    sendMidiOut(t, panelAlt(t), accent);
            }
        }

        updateDisplay();
    }

    void updateDisplay()
    {
        // encode: 1 + step + 16*part + 32*pattern + 1024*measure (0 = stopped)
        displayValue = 1.0 + step + 16 * part + 32 * pattern + 1024 * playingMeasure;
    }

    void advanceStep()
    {
        step++;
        const int mode = pi(Mode);

        if (mode == PatternEdit)
        {
            const int editPattern = Memory::patternIndex(currentRhythm(), pi(EditVariation));
            const int editPart = std::clamp(pi(EditPart), 0, 1);

            if (step >= partLength(pattern, part) || editPattern != pattern || editPart != part)
                beginMeasure();
            return;
        }

        if (step >= partLength(pattern, part))
        {
            if (part == 0 && mem.length(pattern, 1) > 0)
            {
                part = 1;
                step = 0;
            }
            else
                beginMeasure();
        }
    }

    void start()
    {
        running = true;
        tick = 0;
        clockCounter = 0.0; // step 1 plays on the first sample, clock n on sample n * samplesPerClock
        measureCount = 0;
        abCounter = 0;
        trackPos = 0;
        playingMeasure = 0;
        beginMeasure();   // a pending fill here = INTRO
        playStep();
    }

    /** Starts the sequencer at a host position: replays the step / measure logic from the song
        start without sound, so patterns, 2nd parts, A/B, tracks and fills land where they would be. */
    void startAt(double ppq)
    {
        pendingStartSamples = -1.0;
        pendingStepSamples = -1.0;

        if (ppq < -1.0e-9)
        {
            running = false;
            displayValue = 0.0;
            pendingStartSamples = -ppq * 60.0 / currentTempo() * sr;
            return;
        }

        const int clocksPerStep = kPreScaleClocks[std::clamp(pi(PreScale), 0, 3)];
        const double clocks = std::max(0.0, ppq) * 24.0;
        const long long clockIndex = (long long)std::floor(clocks + 1.0e-6);
        const double frac = std::max(0.0, clocks - (double)clockIndex);
        const long long stepIndex = clockIndex / clocksPerStep;

        running = true;
        measureCount = 0;
        abCounter = 0;
        trackPos = 0;
        playingMeasure = 0;
        beginMeasure();

        for (long long i = 0; i < stepIndex; i++)
            advanceStep();

        tick = (int)(clockIndex % clocksPerStep);
        clockCounter = frac * samplesPerClock();

        if (tick == 0 && frac < 1.0e-6)
            playStep();      // exactly on a step: play it now
        else
            updateDisplay(); // inside a step: it already played, wait for the next one
    }

    void stop()
    {
        running = false;
        pendingStartSamples = -1.0;
        pendingStepSamples = -1.0;
        displayValue = 0.0;
    }

    void updateTransportParams()
    {
        const bool sync = pi(HostSync) != 0;

        if (sync)
        {
            // the DAW runs the sequencer: start / stop / realign on host events and when SYNC
            // is switched on (at the position the host has reached by now)
            const int events = hostEvents.load();

            if (events != seenHostEvents || !lastHostSync)
            {
                seenHostEvents = events;

                if (hostPlaying.load())
                    startAt(hostPpq.load() + hostSamples * currentTempo() / (60.0 * sr));
                else
                    stop();
            }

            lastRun = pi(Run) != 0;   // the START/STOP key is ignored while synced
        }
        else
        {
            if (lastHostSync)
            {
                stop();
                lastRun = pi(Run) != 0;
            }

            const bool run = pi(Run) != 0;
            if (run != lastRun)
            {
                lastRun = run;
                if (run) start(); else stop();
            }
        }

        lastHostSync = sync;

        const bool fill = pi(FillTrigger) != 0;
        if (fill && !lastFillTrigger) fillPending = true;
        lastFillTrigger = fill;
    }

    void clockTick()
    {
        const int clocksPerStep = kPreScaleClocks[std::clamp(pi(PreScale), 0, 3)];
        if (++tick >= clocksPerStep)
        {
            tick = 0;

            if (pendingStepSamples >= 0.0)   // a swung step that has not played yet
                playPendingStep();

            advanceStep();

            // SHUFFLE: the 2nd step of every pair moves later by (swing - 50%) of the step pair
            const double swing = std::clamp((double)p(Swing), 50.0, 75.0);
            double delay = (step & 1) != 0 ? (swing - 50.0) / 50.0 * clocksPerStep * samplesPerClock() : 0.0;

            // AGE: every step up to 4 ms late
            const double age = std::clamp((double)p(Age), 0.0, 1.0);
            if (age > 0.0)
                delay += nextRandom() * age * 0.004 * sr;

            if (delay >= 1.0)
                pendingStepSamples = delay;
            else
                playStep();
        }
    }

    void playPendingStep()
    {
        pendingStepSamples = -1.0;
        playStep();
    }

    // ---------------------------------------------------------------------------- MIDI input

    static bool mapNote(int note, int& inst, bool& alt)
    {
        alt = false;
        switch (note)
        {
            case 35: case 36: inst = BD; return true;
            case 37: inst = RS; return true;
            case 38: case 40: inst = SD; return true;
            case 39: inst = CP; return true;
            case 41: case 43: inst = LT; return true;
            case 45: case 47: inst = MT; return true;
            case 48: case 50: inst = HT; return true;
            case 42: case 44: inst = CH; return true;
            case 46: inst = OH; return true;
            case 49: case 57: inst = CY; return true;
            case 56: inst = CB; return true;
            case 64: inst = LT; alt = true; return true;
            case 63: inst = MT; alt = true; return true;
            case 62: inst = HT; alt = true; return true;
            case 75: inst = RS; alt = true; return true;
            case 70: inst = CP; alt = true; return true;
            default: return false;
        }
    }

    float velocityToVolts(int velocity) const
    {
        if (pi(VelocityMode) == 0)
            return trigVolts(velocity >= 100); // 808 style: loud notes are accented
        return (float)velocity / 127.0f * trigVolts(true);
    }

    bool isPitchChannel(int channel) const
    {
        const int pc = pi(PitchChannel);
        return pi(PitchMode) != 0 && (pc == 0 || pc == channel);
    }

    bool targetIsAbsolute(int target) const
    {
        return target != CY && target != OH && target != CH;
    }

    float targetNativeHz(int target) const
    {
        switch (target)
        {
            case BD: return BassDrum::nativeHz();
            case SD: return SnareDrum::nativeHz();
            case LT: return lt.nativeHz();
            case MT: return mt.nativeHz();
            case HT: return ht.nativeHz();
            case RS: return rs.nativeHz();
            case CP: return ClapMaracas::nativeHz();
            case CB: return Cowbell::nativeHz();
            default: return 1.0f;
        }
    }

    float* targetPitchMul(int target)
    {
        switch (target)
        {
            case BD: return &bd.pitchMul;
            case SD: return &sd.pitchMul;
            case LT: return &lt.pitchMul;
            case MT: return &mt.pitchMul;
            case HT: return &ht.pitchMul;
            case RS: return &rs.pitchMul;
            case CP: return &cp.pitchMul;
            case CB: return &cb.pitchMul;
            case CY: return &cy.pitchMul;
            case OH: return &hh.ohPitchMul;
            case CH: return &hh.chPitchMul;
            default: return nullptr;
        }
    }

    // called per sample while pitch mode is active
    void applyPitch(bool resetToPanel = false)
    {
        const int target = std::clamp(pi(PitchTarget), 0, 10);

        if (target != lastPitchTarget)
        {
            if (auto old = targetPitchMul(lastPitchTarget)) *old = 1.0f;
            lastPitchTarget = target;
        }

        float* mul = targetPitchMul(target);
        if (mul == nullptr) return;

        if (resetToPanel || !pitchActive)
        {
            *mul = 1.0f;
            return;
        }

        const float note = currentNote + bendSemis;
        if (targetIsAbsolute(target))
        {
            // native frequency of a voice already includes its own pitchMul-free tuning
            const float native = targetNativeHz(target);
            *mul = midiToHz(note) / native;
        }
        else
            *mul = std::pow(2.0f, (note - 60.0f) / 12.0f);
    }

    void pitchNoteOn(int note, int velocity)
    {
        const bool legato = numHeld > 0 && p(Glide) > 0.0f;

        if (numHeld < (int)held.size()) held[numHeld++] = note;

        targetNote = (float)note;
        pitchActive = true;

        if (!legato)
        {
            currentNote = targetNote;
            applyPitch();
            const int target = std::clamp(pi(PitchTarget), 0, 10);
            triggerInstrument(target, velocityToVolts(velocity), panelAlt(target));
        }
    }

    void pitchNoteOff(int note)
    {
        for (int i = 0; i < numHeld; i++)
        {
            if (held[i] == note)
            {
                for (int j = i; j < numHeld - 1; j++) held[j] = held[j + 1];
                numHeld--;
                break;
            }
        }

        if (numHeld > 0 && p(Glide) > 0.0f)
            targetNote = (float)held[numHeld - 1]; // legato back to the last held key
    }

    void noteOn(int channel, int note, int velocity)
    {
        if (velocity <= 0) { noteOff(channel, note); return; }

        if (isPitchChannel(channel))
        {
            pitchNoteOn(note, velocity);
            return;
        }

        int inst; bool alt;
        if (mapNote(note, inst, alt))
            triggerInstrument(inst, velocityToVolts(velocity), alt);
    }

    void noteOff(int channel, int note)
    {
        if (isPitchChannel(channel))
            pitchNoteOff(note);
    }

    void pitchBend(int channel, int value14bit)
    {
        if (isPitchChannel(channel))
            bendSemis = (float)(value14bit - 8192) / 8192.0f * p(PitchBendRange);
    }

    void allNotesOff()
    {
        numHeld = 0;
    }

    // ------------------------------------------------------------------------------ render

    void pushVoiceParams()
    {
        bd.level = p(BD_Level); bd.tone = p(BD_Tone); bd.decay = p(BD_Decay);
        sd.level = p(SD_Level); sd.tone = p(SD_Tone); sd.snappy = p(SD_Snappy);
        lt.level = p(LT_Level); lt.tuning = p(LT_Tuning);
        mt.level = p(MT_Level); mt.tuning = p(MT_Tuning);
        ht.level = p(HT_Level); ht.tuning = p(HT_Tuning);
        rs.level = p(RS_Level);
        cp.level = p(CP_Level);
        cb.level = p(CB_Level);
        cy.level = p(CY_Level); cy.tone = p(CY_Tone); cy.decay = p(CY_Decay);
        hh.ohLevel = p(OH_Level); hh.ohDecay = p(OH_Decay); hh.chLevel = p(CH_Level);
    }

    float renderSample()
    {
        if (pendingStartSamples >= 0.0)
        {
            pendingStartSamples -= 1.0;   // count-in: the song starts at PPQ 0
            if (pendingStartSamples <= 0.0)
                startAt(0.0);
        }

        if (pendingStepSamples >= 0.0)
        {
            pendingStepSamples -= 1.0;
            if (pendingStepSamples <= 0.0)
                playPendingStep();
        }

        if (running)
        {
            const double spc = samplesPerClock();
            while (clockCounter >= spc)
            {
                clockCounter -= spc;
                clockTick();
            }
            clockCounter += 1.0;
        }

        if (pitchActive && pi(PitchMode) != 0)
        {
            const float glideMs = p(Glide);
            if (glideMs > 0.0f)
            {
                const float coef = 1.0f - (float)std::exp(-1.0 / (glideMs * 0.001 * sr));
                currentNote += (targetNote - currentNote) * coef;
            }
            else
                currentNote = targetNote;
            applyPitch();
        }
        else if (pitchActive)
        {
            pitchActive = false; // pitch mode switched off
            applyPitch(true);
        }

        const int mute = pi(MuteMask);
        auto on = [mute](int inst) { return ((mute >> inst) & 1) != 0 ? 0.0f : 1.0f; };

        const float mix = bd.tick() * on(BD) + sd.tick() * on(SD) + lt.tick() * on(LT) + mt.tick() * on(MT)
                        + ht.tick() * on(HT) + rs.tick() * on(RS) + cp.tick() * on(CP) + cb.tick() * on(CB)
                        + cy.tick() * on(CY) + hh.tickOH() * on(OH) + hh.tickCH() * on(CH);

        // +7.4 dB over the 2.5 voices: an accented BD at full MASTER VOLUME peaks near -1 dBFS
        float out = mix * 1.65f * p(MasterVolume);

        // DRIVE: tanh saturation, normalised so that full scale stays full scale
        const float drive = std::clamp(p(Drive), 0.0f, 1.0f);
        if (drive > 0.0f)
        {
            const float k = 1.0f + 9.0f * drive;
            out = std::tanh(k * out) / std::tanh(k);
        }

        // output stage: untouched below -2 dBFS, hits that land together are bent softly under 0 dBFS
        constexpr float knee = 0.8f;
        const float mag = std::abs(out);
        if (mag > knee)
            out = std::copysign(knee + (1.0f - knee) * std::tanh((mag - knee) / (1.0f - knee)), out);

        return out;
    }

    // call once per block before rendering
    void beginBlock()
    {
        if (hostPositionFresh.exchange(false))
            hostSamples = 0.0;

        numMidiOut = 0;
        sampleInBlock = 0;

        pushVoiceParams();
        updateTransportParams();
    }

    void render(float* left, float* right, int numSamples)
    {
        if (hostPlaying.load())
            hostSamples += numSamples;

        for (int i = 0; i < numSamples; i++)
        {
            const float s = renderSample();
            left[i] = s;
            if (right != nullptr) right[i] = s;
            sampleInBlock++;
        }
    }
};

} // namespace jx808
