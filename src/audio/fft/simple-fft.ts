/**
 * Simple FFT implementation using Cooley-Tukey algorithm
 * Replaces fft.js which has issues in Node v23
 */
export class SimpleFFT {
  private size: number;
  private reverseTable: Uint32Array;
  private sinTable: Float32Array;
  private cosTable: Float32Array;

  constructor(size: number) {
    this.size = size;
    this.reverseTable = new Uint32Array(size);
    this.sinTable = new Float32Array(size);
    this.cosTable = new Float32Array(size);

    let limit = 1;
    let bit = size >> 1;

    // Precompute bit reversal table
    while (limit < size) {
      for (let i = 0; i < limit; i++) {
        this.reverseTable[i + limit] = this.reverseTable[i] + bit;
      }
      limit <<= 1;
      bit >>= 1;
    }

    // Precompute sin/cos tables
    for (let i = 0; i < size; i++) {
      this.sinTable[i] = Math.sin(-Math.PI / i);
      this.cosTable[i] = Math.cos(-Math.PI / i);
    }
  }

  /**
   * Create a complex array for input
   */
  createComplexArray(): Float32Array {
    return new Float32Array(this.size * 2);
  }

  /**
   * Compare with fft.js interface for minimal refactoring
   */
  transform(out: Float32Array, data?: Float32Array): void {
    // If data is provided (fft.js style might differ, but our usage was:
    // const complex = this.fft.createComplexArray();
    // ... fill complex ...
    // this.fft.transform(complex);  <-- in-place? or out, in?
    // fft.js: transform(out, data) where data is input, out is output.
    // If only one arg, it does in-place?
    // fft.js doc: transform(out, data). If data is null, in-place on out.

    const input = data || out;
    const output = out;

    // Bit-reverse copy
    const rev = this.reverseTable;
    for (let i = 0; i < this.size; i++) {
      const off = i * 2;
      const revOff = rev[i] * 2;
      output[revOff] = input[off];
      output[revOff + 1] = input[off + 1];
    }

    // Cooley-Tukey
    let halfSize = 1;
    while (halfSize < this.size) {
      const phaseShiftStepReal = Math.cos(-Math.PI / halfSize);
      const phaseShiftStepImag = Math.sin(-Math.PI / halfSize);

      let currentPhaseShiftReal = 1.0;
      let currentPhaseShiftImag = 0.0;

      for (let fftStep = 0; fftStep < halfSize; fftStep++) {
        for (let i = fftStep; i < this.size; i += 2 * halfSize) {
          const off = i * 2;
          const nextOff = (i + halfSize) * 2;

          const tr =
            currentPhaseShiftReal * output[nextOff] -
            currentPhaseShiftImag * output[nextOff + 1];
          const ti =
            currentPhaseShiftReal * output[nextOff + 1] +
            currentPhaseShiftImag * output[nextOff];

          output[nextOff] = output[off] - tr;
          output[nextOff + 1] = output[off + 1] - ti;
          output[off] += tr;
          output[off + 1] += ti;
        }

        const tmpReal = currentPhaseShiftReal;
        currentPhaseShiftReal =
          tmpReal * phaseShiftStepReal -
          currentPhaseShiftImag * phaseShiftStepImag;
        currentPhaseShiftImag =
          tmpReal * phaseShiftStepImag +
          currentPhaseShiftImag * phaseShiftStepReal;
      }
      halfSize <<= 1;
    }
  }
}
