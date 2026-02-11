import { 
  clamp, 
  lerp, 
  mapRange,
  normalize,
  mean,
  std,
  median,
  exponentialMovingAverage,
  rms,
  wrap,
  degToRad,
  radToDeg,
  distance2D,
  distance3D,
  sineWave,
  triangleWave,
  sawtoothWave,
  squareWave,
  bpmFromInterval,
  intervalFromBpm,
  easeInOut,
  calculateAudioEnergy,
  LookupTable,
  defaultLookupTable
} from '../../../src/utils/math';

describe('Math Utilities', () => {
  describe('clamp', () => {
    test('should clamp value within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
    });
  });

  describe('lerp', () => {
    test('should linearly interpolate between values', () => {
      expect(lerp(0, 10, 0)).toBe(0);
      expect(lerp(0, 10, 0.5)).toBe(5);
      expect(lerp(0, 10, 1)).toBe(10);
      expect(lerp(10, 20, 0.25)).toBe(12.5);
      expect(lerp(-10, 10, 0.5)).toBe(0);
    });
  });

  describe('mapRange', () => {
    test('should map value from one range to another', () => {
      expect(mapRange(5, 0, 10, 0, 100)).toBe(50);
      expect(mapRange(2.5, 0, 5, 0, 10)).toBe(5);
      expect(mapRange(0, -10, 10, 0, 100)).toBe(50);
      expect(mapRange(75, 0, 100, 0, 1)).toBe(0.75);
    });
  });

  describe('normalize', () => {
    test('should normalize value to 0-1 range', () => {
      expect(normalize(5, 0, 10)).toBe(0.5);
      expect(normalize(0, 0, 10)).toBe(0);
      expect(normalize(10, 0, 10)).toBe(1);
      expect(normalize(-5, -10, 0)).toBe(0.5);
    });
  });

  describe('statistical functions', () => {
    test('mean should calculate average', () => {
      expect(mean([1, 2, 3, 4, 5])).toBe(3);
      expect(mean([10])).toBe(10);
      expect(mean([])).toBe(0);
    });

    test('std should calculate standard deviation', () => {
      expect(std([1, 2, 3, 4, 5])).toBeCloseTo(1.414, 3);
      expect(std([10, 10, 10])).toBe(0);
      expect(std([])).toBe(0);
    });

    test('median should calculate median value', () => {
      expect(median([1, 3, 2])).toBe(2);
      expect(median([1, 2, 3, 4])).toBe(2.5);
      expect(median([10])).toBe(10);
      expect(median([])).toBe(0);
    });

    test('rms should calculate root mean square', () => {
      expect(rms([1, 2, 3, 4, 5])).toBeCloseTo(3.3166, 3);
      expect(rms([-1, -2, -3])).toBeCloseTo(2.160, 3);
      expect(rms([])).toBe(0);
    });
  });

  describe('exponentialMovingAverage', () => {
    test('should calculate EMA', () => {
      expect(exponentialMovingAverage(10, 5, 0.5)).toBe(7.5);
      expect(exponentialMovingAverage(0, 10, 0.1)).toBe(9); // 0*0.1 + 10*0.9 = 9
      expect(exponentialMovingAverage(5, 5, 0.5)).toBe(5);
    });
  });

  describe('wrap', () => {
    test('should wrap value around range', () => {
      expect(wrap(5, 0, 10)).toBe(5);
      expect(wrap(15, 0, 10)).toBe(5);
      expect(wrap(-5, 0, 10)).toBe(5);
      expect(wrap(25, 0, 10)).toBe(5);
      expect(wrap(0, 0, 10)).toBe(0);
      expect(wrap(10, 0, 10)).toBe(0); // wrap makes max exclusive
    });
  });

  describe('angle conversions', () => {
    test('degToRad should convert degrees to radians', () => {
      expect(degToRad(0)).toBe(0);
      expect(degToRad(90)).toBeCloseTo(Math.PI / 2);
      expect(degToRad(180)).toBeCloseTo(Math.PI);
      expect(degToRad(360)).toBeCloseTo(2 * Math.PI);
      expect(degToRad(45)).toBeCloseTo(Math.PI / 4);
    });

    test('radToDeg should convert radians to degrees', () => {
      expect(radToDeg(0)).toBe(0);
      expect(radToDeg(Math.PI / 2)).toBeCloseTo(90);
      expect(radToDeg(Math.PI)).toBeCloseTo(180);
      expect(radToDeg(2 * Math.PI)).toBeCloseTo(360);
      expect(radToDeg(Math.PI / 4)).toBeCloseTo(45);
    });

    test('conversions should be inverses', () => {
      const degrees = 123.45;
      const radians = degToRad(degrees);
      expect(radToDeg(radians)).toBeCloseTo(degrees);
      
      const radians2 = 2.345;
      const degrees2 = radToDeg(radians2);
      expect(degToRad(degrees2)).toBeCloseTo(radians2);
    });
  });

  describe('distance calculations', () => {
    test('distance2D should calculate 2D distance', () => {
      expect(distance2D(0, 0, 3, 4)).toBe(5);
      expect(distance2D(1, 1, 4, 5)).toBe(5);
      expect(distance2D(0, 0, 0, 0)).toBe(0);
    });

    test('distance3D should calculate 3D distance', () => {
      expect(distance3D(0, 0, 0, 3, 4, 5)).toBeCloseTo(7.071, 3);
      expect(distance3D(1, 2, 3, 4, 6, 8)).toBeCloseTo(7.071, 3);
      expect(distance3D(0, 0, 0, 0, 0, 0)).toBe(0);
    });
  });

  describe('wave functions', () => {
    test('sineWave should generate sine values', () => {
      expect(sineWave(0)).toBe(0);
      expect(sineWave(Math.PI / 2)).toBeCloseTo(1);
      expect(sineWave(Math.PI)).toBeCloseTo(0);
      expect(sineWave(3 * Math.PI / 2)).toBeCloseTo(-1);
      expect(sineWave(2 * Math.PI)).toBeCloseTo(0);
    });

    test('triangleWave should generate triangle values', () => {
      expect(triangleWave(0)).toBe(1);
      expect(triangleWave(Math.PI / 2)).toBeCloseTo(0);
      expect(triangleWave(Math.PI)).toBeCloseTo(-1);
      expect(triangleWave(3 * Math.PI / 2)).toBeCloseTo(0);
      expect(triangleWave(2 * Math.PI)).toBeCloseTo(1);
    });

    test('sawtoothWave should generate sawtooth values', () => {
      expect(sawtoothWave(0)).toBe(-1);
      expect(sawtoothWave(Math.PI)).toBeCloseTo(0);
      expect(sawtoothWave(2 * Math.PI)).toBeCloseTo(-1);
    });

    test('squareWave should generate square values', () => {
      expect(squareWave(0)).toBe(1);
      expect(squareWave(Math.PI)).toBe(-1);
      expect(squareWave(2 * Math.PI)).toBe(1);
    });
  });

  describe('BPM calculations', () => {
    test('bpmFromInterval should convert interval to BPM', () => {
      expect(bpmFromInterval(500)).toBe(120); // 500ms = 120 BPM
      expect(bpmFromInterval(1000)).toBe(60); // 1000ms = 60 BPM
      expect(bpmFromInterval(250)).toBe(240); // 250ms = 240 BPM
      expect(bpmFromInterval(0)).toBe(0);
      expect(bpmFromInterval(-100)).toBe(0);
    });

    test('intervalFromBpm should convert BPM to interval', () => {
      expect(intervalFromBpm(120)).toBe(500); // 120 BPM = 500ms
      expect(intervalFromBpm(60)).toBe(1000); // 60 BPM = 1000ms
      expect(intervalFromBpm(240)).toBe(250); // 240 BPM = 250ms
      expect(intervalFromBpm(0)).toBe(0);
      expect(intervalFromBpm(-100)).toBe(0);
    });

    test('conversions should be inverses', () => {
      const bpm = 128;
      const interval = intervalFromBpm(bpm);
      expect(bpmFromInterval(interval)).toBeCloseTo(bpm);
      
      const interval2 = 333;
      const bpm2 = bpmFromInterval(interval2);
      expect(intervalFromBpm(bpm2)).toBeCloseTo(interval2);
    });
  });

  describe('easeInOut', () => {
    test('should apply ease-in-out interpolation', () => {
      expect(easeInOut(0)).toBe(0);
      expect(easeInOut(0.5)).toBe(0.5);
      expect(easeInOut(1)).toBe(1);
      
      // Should be smooth curve (quadratic ease-in-out)
      expect(easeInOut(0.25)).toBeGreaterThan(0.25 * 0.25);
      expect(easeInOut(0.75)).toBeGreaterThan(0.75);
    });
  });

  describe('calculateAudioEnergy', () => {
    test('should calculate audio energy from samples', () => {
      const samples = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      const energy = calculateAudioEnergy(samples);
      expect(energy).toBeCloseTo(0.5);
    });

    test('should handle empty samples', () => {
      const samples = new Float32Array(0);
      expect(calculateAudioEnergy(samples)).toBe(0);
    });

    test('should clamp energy to 0-1 range', () => {
      const loudSamples = new Float32Array([2, 2, 2, 2]);
      const energy = calculateAudioEnergy(loudSamples);
      expect(energy).toBe(1);
    });
  });

  describe('LookupTable', () => {
    let lookupTable: LookupTable;

    beforeEach(() => {
      lookupTable = new LookupTable(1024);
    });

    test('should create lookup table with specified resolution', () => {
      expect(lookupTable).toBeInstanceOf(LookupTable);
    });

    test('fastSin should approximate sine function', () => {
      expect(lookupTable.fastSin(0)).toBeCloseTo(0, 3);
      expect(lookupTable.fastSin(Math.PI / 2)).toBeCloseTo(1, 3);
      expect(lookupTable.fastSin(Math.PI)).toBeCloseTo(0, 3);
      expect(lookupTable.fastSin(3 * Math.PI / 2)).toBeCloseTo(-1, 3);
      expect(lookupTable.fastSin(2 * Math.PI)).toBeCloseTo(0, 3);
    });

    test('fastCos should approximate cosine function', () => {
      expect(lookupTable.fastCos(0)).toBeCloseTo(1, 3);
      expect(lookupTable.fastCos(Math.PI / 2)).toBeCloseTo(0, 3);
      expect(lookupTable.fastCos(Math.PI)).toBeCloseTo(-1, 3);
      expect(lookupTable.fastCos(3 * Math.PI / 2)).toBeCloseTo(0, 3);
      expect(lookupTable.fastCos(2 * Math.PI)).toBeCloseTo(1, 3);
    });

    test('should wrap phase values', () => {
      expect(lookupTable.fastSin(4 * Math.PI)).toBeCloseTo(0, 3);
      expect(lookupTable.fastCos(4 * Math.PI)).toBeCloseTo(1, 3);
    });
  });

  describe('defaultLookupTable', () => {
    test('should be instance of LookupTable', () => {
      expect(defaultLookupTable).toBeInstanceOf(LookupTable);
    });

    test('should have working fastSin method', () => {
      expect(defaultLookupTable.fastSin(0)).toBeCloseTo(0, 3);
      expect(defaultLookupTable.fastSin(Math.PI / 2)).toBeCloseTo(1, 3);
    });
  });

  describe('edge cases', () => {
    test('should handle NaN values gracefully', () => {
      expect(() => clamp(NaN, 0, 10)).not.toThrow();
      expect(() => lerp(NaN, 10, 0.5)).not.toThrow();
      expect(() => mapRange(NaN, 0, 10, 0, 100)).not.toThrow();
    });

    test('should handle Infinity values', () => {
      expect(clamp(Infinity, 0, 10)).toBe(10);
      expect(clamp(-Infinity, 0, 10)).toBe(0);
      expect(lerp(0, Infinity, 0.5)).toBe(Infinity);
    });
  });
});