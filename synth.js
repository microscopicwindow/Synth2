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

// Reverb mix (dry and wet) setup
const dryGain = audioContext.createGain();
const wetGain = audioContext.createGain();
dryGain.gain.value = 1;
wetGain.gain.value = 0.5;

// Define convolver (reverb)
const convolver = audioContext.createConvolver();
let reverbEnabled = false;

// Function to create an impulse response for the reverb effect
function createImpulseResponse(length) {
    const lengthInSamples = audioContext.sampleRate * length;
    const impulse = audioContext.createBuffer(2, lengthInSamples, audioContext.sampleRate); // Stereo buffer
    for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
        const channelData = impulse.getChannelData(channel);
        for (let i = 0; i < lengthInSamples; i++) {
            channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / lengthInSamples, 2); // Exponential decay
        }
    }
    convolver.buffer = impulse;
}

// Set initial impulse response length for reverb
createImpulseResponse(2);

// Properly connect dry and wet reverb mix to the master gain
masterGain.connect(dryGain).connect(audioContext.destination); // Dry path directly to destination
masterGain.connect(wetGain).connect(convolver); // Wet path through convolver
convolver.connect(audioContext.destination); // Convolver output to destination

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

    // Connect the oscillator to its filter and then to the master gain
    oscillators[index].port.postMessage({
        frequency: params[index].frequency,
        phaseDistortion: params[index].phaseDistortion,
        harmonicIntensity: params[index].harmonicIntensity,
        fractalDepth: params[index].fractalDepth,
    });

    // Ensure that each oscillator is connected to its corresponding filter and then to the master gain
    oscillators[index].connect(params[index].filter);
    params[index].filter.connect(masterGain);
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

// Function to create filters and gains for each oscillator
function setupAudioNodes(index) {
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2000;
    filter.Q.value = 1;

    const gain = audioContext.createGain();
    gain.gain.value = 0.2;

    params[index].filter = filter;
    params[index].gain = gain;

    // Connect each oscillator to the master gain
    filter.connect(gain).connect(masterGain);
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

// Setup and bind controls for each oscillator
function setupControls(index, prefix) {
    setupAudioNodes(index);

    document.getElementById(`startButton${prefix}`).addEventListener('click', () => {
        audioContext.resume().then(() => {
            startOscillator(index);
        });
    });

    document.getElementById(`stopButton${prefix}`).addEventListener('click', () => {
        stopOscillator(index);
    });

    document.getElementById(`frequencySlider${prefix}`).addEventListener('input', (event) => {
        params[index].frequency = parseFloat(event.target.value);
        if (isRunning[index]) {
            oscillators[index].port.postMessage({ frequency: params[index].frequency });
        }
    });

    document.getElementById(`phaseDistortionSlider${prefix}`).addEventListener('input', (event) => {
        params[index].phaseDistortion = parseFloat(event.target.value);
        if (isRunning[index]) {
            oscillators[index].port.postMessage({ phaseDistortion: params[index].phaseDistortion });
        }
    });

    document.getElementById(`harmonicIntensitySlider${prefix}`).addEventListener('input', (event) => {
        params[index].harmonicIntensity = parseFloat(event.target.value);
        if (isRunning[index]) {
            oscillators[index].port.postMessage({ harmonicIntensity: params[index].harmonicIntensity });
        }
    });

    document.getElementById(`fractalDepthSlider${prefix}`).addEventListener('input', (event) => {
        params[index].fractalDepth = parseInt(event.target.value);
        if (isRunning[index]) {
            oscillators[index].port.postMessage({ fractalDepth: params[index].fractalDepth });
        }
    });

    document.getElementById(`cutoffSlider${prefix}`).addEventListener('input', (event) => {
        params[index].filter.frequency.value = parseFloat(event.target.value);
    });

    document.getElementById(`resonanceSlider${prefix}`).addEventListener('input', (event) => {
        params[index].filter.Q.value = parseFloat(event.target.value);
    });
}

// Setup controls for the wavefolder/bitcrusher and other effects
function setupEffectControls(wavefolderNode, granularNode, pitchShifterNode) {
    // Wavefolder/Bitcrusher Controls
    document.getElementById('foldAmountSlider').addEventListener('input', (event) => {
        wavefolderNode.parameters.get('foldAmount').value = parseFloat(event.target.value);
    });

    document.getElementById('bitDepthSlider').addEventListener('input', (event) => {
        wavefolderNode.parameters.get('bitDepth').value = parseFloat(event.target.value);
    });

    document.getElementById('sampleRateReductionSlider').addEventListener('input', (event) => {
        wavefolderNode.parameters.get('sampleRateReduction').value = parseFloat(event.target.value);
    });

    // Granular Effect Controls
    document.getElementById('grainSizeSlider').addEventListener('input', (event) => {
        granularNode.parameters.get('grainSize').value = parseFloat(event.target.value);
    });

    document.getElementById('grainDensitySlider').addEventListener('input', (event) => {
        granularNode.parameters.get('grainDensity').value = parseFloat(event.target.value);
    });

    document.getElementById('grainRandomizationSlider').addEventListener('input', (event) => {
        granularNode.parameters.get('grainRandomization').value = parseFloat(event.target.value);
    });

    // Pitch Shifter Controls
    document.getElementById('pitchShiftAmountSlider').addEventListener('input', (event) => {
        pitchShifterNode.parameters.get('pitchShiftAmount').value = parseFloat(event.target.value);
    });

    document.getElementById('pitchShiftFeedbackSlider').addEventListener('input', (event) => {
        pitchShifterNode.parameters.get('pitchShiftFeedback').value = parseFloat(event.target.value);
    });
}

// Setup controls for each oscillator
setupControls(0, '1');
setupControls(1, '2');
setupControls(2, '3');
