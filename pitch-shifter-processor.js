class PitchShifterProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'pitchShiftAmount', defaultValue: 0, minValue: -12, maxValue: 12 },
            { name: 'pitchShiftFeedback', defaultValue: 0.5, minValue: 0, maxValue: 0.95 }
        ];
    }

    constructor() {
        super();
        this.delayBuffer = new Float32Array(2048);
        this.writeIndex = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0][0];
        const output = outputs[0][0];
        const shiftAmount = parameters.pitchShiftAmount[0];
        const feedback = parameters.pitchShiftFeedback[0];

        if (input) {
            for (let i = 0; i < output.length; i++) {
                const delayReadIndex = (this.writeIndex - Math.round(shiftAmount * 5)) % this.delayBuffer.length;
                output[i] = this.delayBuffer[delayReadIndex] || 0;
                this.delayBuffer[this.writeIndex] = input[i] + output[i] * feedback;
                this.writeIndex = (this.writeIndex + 1) % this.delayBuffer.length;
            }
        }
        return true;
    }
}

registerProcessor('pitch-shifter-processor', PitchShifterProcessor);
