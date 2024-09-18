class WavefolderBitcrusherProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'foldAmount', defaultValue: 1, minValue: 0, maxValue: 5 },
            { name: 'bitDepth', defaultValue: 8, minValue: 1, maxValue: 16 },
            { name: 'sampleRateReduction', defaultValue: 1, minValue: 1, maxValue: 100 }
        ];
    }

    constructor() {
        super();
        this.phase = 0;
        this.lastOutput = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];
        const foldAmount = parameters.foldAmount[0];
        const bitDepth = parameters.bitDepth[0];
        const sampleRateReduction = parameters.sampleRateReduction[0];

        if (input.length > 0) {
            const inputChannel = input[0];
            const outputChannel = output[0];
            
            for (let i = 0; i < outputChannel.length; i++) {
                // Wavefolder: fold the signal back on itself
                let sample = inputChannel[i];
                sample = (Math.abs(sample) > 1 ? (sample % 2) - 1 : sample) * foldAmount;

                // Bitcrusher: reduce the bit depth
                const step = Math.pow(0.5, bitDepth);
                sample = Math.floor(sample / step) * step;

                // Sample rate reduction
                if (i % sampleRateReduction === 0) {
                    this.lastOutput = sample;
                }
                outputChannel[i] = this.lastOutput;
            }
        }
        return true;
    }
}

registerProcessor('wavefolder-bitcrusher-processor', WavefolderBitcrusherProcessor);
