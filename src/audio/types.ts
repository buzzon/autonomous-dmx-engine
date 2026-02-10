// src/audio/types.ts

export type Mood = 'calm' | 'medium' | 'hard';

export interface AudioMetrics {
  timestamp: number;   // ms
  energy: number;      // 0..1, нормализованная энергия
  beat: boolean;       // есть ли удар в этом фрейме
  bpm: number | null;  // оценка BPM
  mood: Mood;          // грубое настроение
}

export interface AudioAnalyzerState {
  sampleRate: number;
  frameSize: number;
  hopSize: number;

  energyHistory: number[];
  energyAvg: number;
  energyPeak: number;

  lastBeats: number[];  // timestamps
  bpm: number | null;
  lastBeatTime: number;

  mood: Mood;
  moodHistory: Mood[];

  lastUpdateTimestamp: number;
  lastMoodUpdate: number;
}

export interface AudioAnalyzerConfig {
  sampleRate: number;
  frameSize: number;
  hopSize: number;
  beatThresholdCoeff: number;  // c для beat detection
  minBeatInterval: number;     // ms
  bpmSmoothingBeta: number;
  moodUpdateInterval: number;  // ms
  K_short: number;             // размер короткого окна
  N_beats: number;             // сколько beat'ов хранить
  K_mood: number;              // размер окна для mood
}
