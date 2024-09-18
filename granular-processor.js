class GranularProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'grainSize', defaultValue: 0.1, minValue: 0.01, maxValue: 0.5 },
            { name: 'grainDensity', defaultValue: 0.5, minValue: 0.1, maxValue: 1.0 },
            { name: 'grainRandomization', defaultValue: 0.5, minValue: 0, maxValue: 1.0 }
        ];
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0][0];
        const output = outputs[0][0];
        const grainSize = parameters.grainSize[0];
        const density = parameters.grainDensity[0];
        const randomization = parameters.grainRandomization[0];

        if (input) {
            for (let i = 0; i < output.length; i++) {
                const grainPos = Math.floor((i + Math.random() * grainSize * input.length) % input.length);
                output[i] = input[grainPos] * Math.random() * randomization;
            }
        }
        return true;
    }
}

registerProcessor('granular-processor', GranularProcessor);
