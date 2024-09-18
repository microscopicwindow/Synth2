class OscillatorProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.phase = 0;
        this.frequency = 440;
        this.phaseDistortion = 0.5;
        this.harmonicIntensity = 0.5;
        this.fractalDepth = 3;

        // Define the golden ratio (phi) inside the processor scope
        this.phi = (1 + Math.sqrt(5)) / 2;

        this.port.onmessage = (event) => {
            if (event.data.frequency !== undefined) this.frequency = event.data.frequency;
            if (event.data.phaseDistortion !== undefined) this.phaseDistortion = event.data.phaseDistortion;
            if (event.data.harmonicIntensity !== undefined) this.harmonicIntensity = event.data.harmonicIntensity;
            if (event.data.fractalDepth !== undefined) this.fractalDepth = event.data.fractalDepth;
        };
    }

    process(inputs, outputs) {
        const outputL = outputs[0][0]; // Left channel
        const outputR = outputs[0][1]; // Right channel
        for (let i = 0; i < outputL.length; i++) {
            this.phase += (this.frequency / sampleRate) * 2 * Math.PI;
            const distortedPhase = this.phase + Math.sin(this.phase * this.phaseDistortion) * this.phaseDistortion;

            // Generate the same signal for left and right channels
            const sample = Math.sin(distortedPhase * Math.pow(this.phi, this.fractalDepth)) * Math.pow(this.phi, -i % (5 * this.harmonicIntensity + 1));

            outputL[i] = sample;  // Left channel
            outputR[i] = sample;  // Right channel (same as left for now)
        }
        return true;
    }
}

registerProcessor('oscillator-processor', OscillatorProcessor);
