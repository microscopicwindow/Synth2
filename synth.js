// Web Audio Context and Audio Worklet Setup
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Initialize state for oscillators
let oscillators = [null, null, null];
let isRunning = [false, false, false];

// Map to keep track of active MIDI notes and their corresponding oscillators
let activeMIDINotes = new Map();

const params = [
    { phase: 0, frequency: 440, phaseDistortion: 0.5, harmonicIntensity: 0.5, fractalDepth: 3, filter: null, gain: null },
    { phase: 0, frequency: 440, phaseDistortion: 0.5, harmonicIntensity: 0.5, fractalDepth: 3, filter: null, gain: null },
    { phase: 0, frequency: 440, phaseDistortion: 0.5, harmonicIntensity: 0.5, fractalDepth: 3, filter: null, gain: null },
];

const sampleRate = audioContext.sampleRate;
const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio

// Create master gain node for all oscillators
const masterGain = audioContext.createGain();
masterGain.gain.value = 0.8;

// MIDI Access and Handler Setup
function onMIDISuccess(midiAccess) {
    console.log('MIDI Access obtained');
    const inputs = midiAccess.inputs.values();

    for (let input of inputs) {
        input.onmidimessage = handleMIDIMessage;
    }
}

function onMIDIFailure() {
    console.log('Could not access MIDI devices.');
}

// Handle incoming MIDI messages
function handleMIDIMessage(event) {
    const [status, note, velocity] = event.data;

    if (status === 144 && velocity > 0) {
        // Note on event (start playing note)
        noteOn(note, velocity);
    } else if (status === 128 || (status === 144 && velocity === 0)) {
        // Note off event (stop playing note)
        noteOff(note);
    }
}

// Convert MIDI note number to frequency
function midiNoteToFrequency(note) {
    return 440 * Math.pow(2, (note - 69) / 12); // Standard formula for note to frequency
}

// Handle Note On event (start oscillator for given note)
function noteOn(note, velocity) {
    if (!activeMIDINotes.has(note)) {
        const frequency = midiNoteToFrequency(note);
        const oscillatorIndex = getFreeOscillator();

        if (oscillatorIndex !== null) {
            params[oscillatorIndex].frequency = frequency;
            startOscillator(oscillatorIndex);
            activeMIDINotes.set(note, oscillatorIndex);
        }
    }
}

// Handle Note Off event (stop oscillator for given note)
function noteOff(note) {
    if (activeMIDINotes.has(note)) {
        const oscillatorIndex = activeMIDINotes.get(note);
        stopOscillator(oscillatorIndex);
        activeMIDINotes.delete(note);
    }
}

// Find a free oscillator slot (not currently playing)
function getFreeOscillator() {
    for (let i = 0; i < oscillators.length; i++) {
        if (!isRunning[i]) {
            return i;
        }
    }
    return null;
}

// Initialize Web MIDI API
if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
} else {
    console.log('Web MIDI API not supported.');
}

// Function to start an oscillator
function startOscillator(index) {
    if (isRunning[index]) return;

    // Create an AudioWorkletNode for each oscillator using the oscillator processor
    oscillators[index] = new AudioWorkletNode(audioContext, 'oscillator-processor', {
        outputChannelCount: [2],  // Stereo output
        channelCount: 2,
        channelCountMode: 'explicit',
    });

    oscillators[index].port.postMessage({
        frequency: params[index].frequency,
        phaseDistortion: params[index].phaseDistortion,
        harmonicIntensity: params[index].harmonicIntensity,
        fractalDepth: params[index].fractalDepth,
    });

    oscillators[index].connect(params[index].filter);
    isRunning[index] = true;
}

// Function to stop an oscillator
function stopOscillator(index) {
    if (!isRunning[index]) return;
    oscillators[index].disconnect();
    oscillators[index] = null;
    isRunning[index] = false;
}

// Load worklet modules and initialize nodes after loading
async function setupAudioWorklets() {
    try {
        // Load the oscillator, wavefolder/bitcrusher, granular, and pitch shifter processors
        await audioContext.audioWorklet.addModule('oscillator-processor.js?nocache=' + Math.random());
        await audioContext.audioWorklet.addModule('wavefolder-bitcrusher-processor.js?nocache=' + Math.random());
        await audioContext.audioWorklet.addModule('granular-processor.js?nocache=' + Math.random());
        await audioContext.audioWorklet.addModule('pitch-shifter-processor.js?nocache=' + Math.random());

        // Setup Wavefolder/Bitcrusher Hybrid Effect with AudioWorkletNode
        const wavefolderNode = new AudioWorkletNode(audioContext, 'wavefolder-bitcrusher-processor', {
            outputChannelCount: [2],  // Stereo output
            channelCount: 2,
            channelCountMode: 'explicit',
        });
        wavefolderNode.parameters.get('foldAmount').value = 1;  // Initial value
        wavefolderNode.parameters.get('bitDepth').value = 8;    // Initial value
        wavefolderNode.parameters.get('sampleRateReduction').value = 1; // Initial value

        // Setup Granular Effect with AudioWorkletNode
        const granularNode = new AudioWorkletNode(audioContext, 'granular-processor', {
            outputChannelCount: [2],  // Stereo output
            channelCount: 2,
            channelCountMode: 'explicit',
        });
        granularNode.parameters.get('grainSize').value = 0.1;
        granularNode.parameters.get('grainDensity').value = 0.5;
        granularNode.parameters.get('grainRandomization').value = 0.5;

        // Setup Pitch Shifter with AudioWorkletNode
        const pitchShifterNode = new AudioWorkletNode(audioContext, 'pitch-shifter-processor', {
            outputChannelCount: [2],  // Stereo output
            channelCount: 2,
            channelCountMode: 'explicit',
        });
        pitchShifterNode.parameters.get('pitchShiftAmount').value = 0;
        pitchShifterNode.parameters.get('pitchShiftFeedback').value = 0.5;

        // Serial chain: wavefolderNode → convolver → granularNode → pitchShifterNode → audio destination
        masterGain.connect(wavefolderNode).connect(convolver).connect(granularNode).connect(pitchShifterNode).connect(audioContext.destination);

        // Attach event listeners for hybrid wavefolder/bitcrusher and other controls
        setupEffectControls(wavefolderNode, granularNode, pitchShifterNode);
    } catch (error) {
        console.error('Error loading audio worklet modules:', error);
    }
}

setupAudioWorklets();

// Other functions remain unchanged for controls and reverb, granular, pitch shifter setup
// ...
