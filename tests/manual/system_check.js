"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/node-microphone/index.js
var require_node_microphone = __commonJS({
  "node_modules/node-microphone/index.js"(exports2, module2) {
    "use strict";
    var isMac = require("os").type() == "Darwin";
    var isWin = require("os").type().indexOf("Windows") > -1;
    var spawn = require("child_process").spawn;
    var EventEmitter2 = require("events");
    var Microphone2 = class extends EventEmitter2 {
      constructor(options) {
        super();
        this.ps = null;
        options = options || {};
        this.endian = options.endian || "little";
        this.bitwidth = options.bitwidth || "16";
        this.encoding = options.encoding || "signed-integer";
        this.rate = options.rate || "16000";
        this.channels = options.channels || "1";
        this.additionalParameters = options.additionalParameters || false;
        this.useDataEmitter = !!options.useDataEmitter;
        if (isWin) {
          this.device = options.device || "default";
        }
        if (!isWin && !isMac) {
          this.device = options.device || "plughw:1,0";
          this.format = void 0;
          this.formatEndian = void 0;
          this.formatEncoding = void 0;
          if (this.encoding === "unsigned-integer") {
            this.formatEncoding = "U";
          } else {
            this.formatEncoding = "S";
          }
          if (this.endian === "big") {
            this.formatEndian = "BE";
          } else {
            this.formatEndian = "LE";
          }
          this.format = this.formatEncoding + this.bitwidth + "_" + this.formatEndian;
        }
      }
      // end on silence - default threshold 0.5
      //'silence', '1', '0.1', options.threshold + '%',
      //'1', '1.0', options.threshold + '%'
      startRecording() {
        let audioOptions;
        if (this.ps === null) {
          if (isWin) {
            audioOptions = [
              "-b",
              this.bitwidth,
              "--endian",
              this.endian,
              "-c",
              this.channels,
              "-r",
              this.rate,
              "-e",
              this.encoding,
              "-t",
              "waveaudio",
              this.device,
              "-p"
            ];
            if (this.additionalParameters) {
              audioOptions = audioOptions.concat(
                this.additionalParameters
              );
            }
            this.ps = spawn("sox", audioOptions);
          } else if (isMac) {
            audioOptions = [
              "-q",
              "-b",
              this.bitwidth,
              "-c",
              this.channels,
              "-r",
              this.rate,
              "-e",
              this.encoding,
              "-t",
              "wav",
              "-"
            ];
            if (this.additionalParameters) {
              audioOptions = audioOptions.concat(
                this.additionalParameters
              );
            }
            this.ps = spawn("rec", audioOptions);
          } else {
            audioOptions = [
              "-c",
              this.channels,
              "-r",
              this.rate,
              "-f",
              this.format,
              "-D",
              this.device
            ];
            if (this.additionalParameters) {
              audioOptions = audioOptions.concat(
                this.additionalParameters
              );
            }
            this.ps = spawn("arecord", audioOptions);
          }
          this.ps.on("error", (error) => {
            this.emit("error", error);
          });
          this.ps.stderr.on("error", (error) => {
            this.emit("error", error);
          });
          this.ps.stderr.on("data", (info) => {
            this.emit("info", info);
          });
          if (this.useDataEmitter) {
            this.ps.stdout.on("data", (data) => {
              this.emit("data", data);
            });
          }
          return this.ps.stdout;
        }
      }
      stopRecording() {
        if (this.ps) {
          this.ps.kill();
          this.ps = null;
        }
      }
    };
    module2.exports = Microphone2;
  }
});

// node_modules/artnet/lib/artnet.js
var require_artnet = __commonJS({
  "node_modules/artnet/lib/artnet.js"(exports2, module2) {
    var dgram = require("dgram");
    var util = require("util");
    var EventEmitter2 = require("events").EventEmitter;
    var Artnet = function(config) {
      if (!(this instanceof Artnet)) {
        return new Artnet(config);
      }
      var that = this;
      config = config || {};
      var host = config.host || "255.255.255.255";
      var port = parseInt(config.port, 10) || 6454;
      var refresh = parseInt(config.refresh, 10) || 4e3;
      var sendAll = config.sendAll || false;
      var socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
      socket.on("error", function(err) {
        that.emit("error", err);
      });
      if (config.iface && host === "255.255.255.255") {
        socket.bind(port, config.iface, function() {
          socket.setBroadcast(true);
        });
      } else if (host.match(/255$/)) {
        socket.bind(port, function() {
          socket.setBroadcast(true);
        });
      }
      var data = [];
      var interval = [];
      var sendThrottle = [];
      var sendDelayed = [];
      var dataChanged = [];
      this.data = data;
      var startRefresh = function(universe) {
        interval[universe] = setInterval(function() {
          that.send(universe, 512);
        }, refresh);
      };
      var triggerPackage = function(oem, key, subkey) {
        var hOem = oem >> 8 & 255;
        var lOem = oem & 255;
        var header = [65, 114, 116, 45, 78, 101, 116, 0, 0, 153, 0, 14, 0, 0, hOem, lOem, key, subkey];
        var payload = Array.apply(null, new Array(512)).map(function() {
          return null;
        }, 0);
        return new Buffer(header.concat(payload));
      };
      this.sendTrigger = function(oem, key, subkey, callback) {
        var buf = triggerPackage(oem, key, subkey);
        socket.send(buf, 0, buf.length, port, host, callback);
      };
      var artdmxPackage = function(universe, length) {
        length = parseInt(length, 10) || 2;
        if (length % 2) {
          length += 1;
        }
        var hUni = universe >> 8 & 255;
        var lUni = universe & 255;
        var hLen = length >> 8 & 255;
        var lLen = length & 255;
        var header = [65, 114, 116, 45, 78, 101, 116, 0, 0, 80, 0, 14, 0, 0, lUni, hUni, hLen, lLen];
        if (!data[universe]) {
          data[universe] = Array.apply(null, new Array(512)).map(function() {
            return null;
          }, 0);
        }
        return new Buffer(header.concat(data[universe].slice(0, hLen * 256 + lLen)));
      };
      this.send = function(universe, refresh2, callback) {
        if (typeof refresh2 === "function") {
          callback = refresh2;
          refresh2 = false;
        }
        if (sendAll) {
          refresh2 = true;
        }
        if (!interval[universe]) {
          startRefresh(universe);
        }
        if (sendThrottle[universe]) {
          sendDelayed[universe] = true;
          return;
        }
        clearTimeout(sendThrottle[universe]);
        sendThrottle[universe] = setTimeout(function() {
          sendThrottle[universe] = null;
          if (sendDelayed[universe]) {
            sendDelayed[universe] = false;
            that.send(universe, callback);
          }
        }, 25);
        var buf = artdmxPackage(universe, refresh2 ? 512 : dataChanged[universe]);
        dataChanged[universe] = 0;
        socket.send(buf, 0, buf.length, port, host, callback);
      };
      this.set = function() {
        var universe;
        var channel;
        var value;
        var callback;
        if (arguments.length === 4) {
          universe = arguments[0];
          channel = arguments[1];
          value = arguments[2];
          callback = arguments[3];
        } else if (arguments.length === 3) {
          if (typeof arguments[2] === "function") {
            channel = arguments[0];
            value = arguments[1];
            callback = arguments[2];
          } else {
            universe = arguments[0];
            channel = arguments[1];
            value = arguments[2];
          }
        } else if (arguments.length === 2) {
          if (typeof arguments[1] === "function") {
            channel = 1;
            value = arguments[0];
            callback = arguments[1];
          } else {
            channel = arguments[0];
            value = arguments[1];
          }
        } else if (arguments.length === 1) {
          channel = 1;
          value = arguments[0];
        } else {
          return false;
        }
        universe = parseInt(universe, 10) || 0;
        if (!data[universe]) {
          data[universe] = Array.apply(null, new Array(512)).map(function() {
            return null;
          }, 0);
        }
        dataChanged[universe] = dataChanged[universe] || 0;
        var index;
        if (typeof value === "object" && value.length > 0) {
          for (var i = 0; i < value.length; i++) {
            index = channel + i - 1;
            if (typeof value[i] === "number" && data[universe][index] !== value[i]) {
              data[universe][index] = value[i];
              if (index + 1 > dataChanged[universe]) {
                dataChanged[universe] = index + 1;
              }
            }
          }
        } else if (typeof value === "number" && data[universe][channel - 1] !== value) {
          data[universe][channel - 1] = value;
          if (channel > dataChanged[universe]) {
            dataChanged[universe] = channel;
          }
        }
        if (dataChanged[universe]) {
          that.send(universe, callback);
        } else if (typeof callback === "function") {
          callback(null, null);
        }
        return true;
      };
      this.trigger = function() {
        var oem;
        var subkey;
        var key;
        var callback;
        if (arguments.length === 4) {
          oem = arguments[0];
          subkey = arguments[1];
          key = arguments[2];
          callback = arguments[3];
        } else if (arguments.length === 3) {
          if (typeof arguments[2] === "function") {
            subkey = arguments[0];
            key = arguments[1];
            callback = arguments[2];
          } else {
            oem = arguments[0];
            subkey = arguments[1];
            key = arguments[2];
          }
        } else if (arguments.length === 2) {
          if (typeof arguments[1] === "function") {
            subkey = 1;
            key = arguments[0];
            callback = arguments[1];
          } else {
            subkey = arguments[0];
            key = arguments[1];
          }
        } else if (arguments.length === 1) {
          subkey = 0;
          key = arguments[0];
        } else {
          return false;
        }
        oem = parseInt(oem, 10) || 65535;
        key = parseInt(key, 10) || 255;
        that.sendTrigger(oem, key, subkey, callback);
        return true;
      };
      this.close = function() {
        var i;
        for (i = 0; i < interval.length; i++) {
          clearInterval(interval[i]);
        }
        for (i = 0; i < sendThrottle.length; i++) {
          clearTimeout(sendThrottle[i]);
        }
        socket.close();
      };
      this.setHost = function(h) {
        host = h;
      };
      this.setPort = function(p) {
        if (host === "255.255.255.255") {
          throw new Error("Can't change port when using broadcast address 255.255.255.255");
        } else {
          port = p;
        }
      };
    };
    util.inherits(Artnet, EventEmitter2);
    module2.exports = Artnet;
  }
});

// tests/manual/system_check.ts
var import_events = require("events");

// src/audio/sources/mic-source.ts
var import_node_microphone = __toESM(require_node_microphone());

// src/utils/logger.ts
var LogLevel = /* @__PURE__ */ ((LogLevel2) => {
  LogLevel2[LogLevel2["DEBUG"] = 0] = "DEBUG";
  LogLevel2[LogLevel2["INFO"] = 1] = "INFO";
  LogLevel2[LogLevel2["WARN"] = 2] = "WARN";
  LogLevel2[LogLevel2["ERROR"] = 3] = "ERROR";
  LogLevel2[LogLevel2["SILENT"] = 4] = "SILENT";
  return LogLevel2;
})(LogLevel || {});
var Logger = class _Logger {
  constructor(level = 1 /* INFO */, initialContext = {}) {
    this.context = {};
    this.level = level;
    this.context = { ...initialContext };
  }
  /**
   * Create a child logger with additional context
   */
  child(additionalContext) {
    return new _Logger(this.level, { ...this.context, ...additionalContext });
  }
  /**
   * Log a debug message
   */
  debug(message, data) {
    this.log(0 /* DEBUG */, message, data);
  }
  /**
   * Log an info message
   */
  info(message, data) {
    this.log(1 /* INFO */, message, data);
  }
  /**
   * Log a warning message
   */
  warn(message, data) {
    this.log(2 /* WARN */, message, data);
  }
  /**
   * Log an error message
   */
  error(message, data) {
    this.log(3 /* ERROR */, message, data);
  }
  /**
   * Internal log method
   */
  log(level, message, data) {
    if (level < this.level) {
      return;
    }
    const entry = {
      timestamp: /* @__PURE__ */ new Date(),
      level,
      message,
      context: { ...this.context, ...data }
    };
    this.writeToConsole(entry);
  }
  /**
   * Write log entry to console with appropriate formatting
   */
  writeToConsole(entry) {
    const timestamp = entry.timestamp.toISOString();
    const levelStr = LogLevel[entry.level].padEnd(5);
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : "";
    const logMessage = `[${timestamp}] ${levelStr} ${entry.message}${contextStr}`;
    switch (entry.level) {
      case 3 /* ERROR */:
        console.error(logMessage);
        break;
      case 2 /* WARN */:
        console.warn(logMessage);
        break;
      case 1 /* INFO */:
        console.log(logMessage);
        break;
      case 0 /* DEBUG */:
        console.debug(logMessage);
        break;
    }
  }
  /**
   * Set the log level
   */
  setLevel(level) {
    this.level = level;
  }
  /**
   * Get the current log level
   */
  getLevel() {
    return this.level;
  }
};
var defaultLogger = new Logger(
  typeof process !== "undefined" && process.env.NODE_ENV === "development" ? 0 /* DEBUG */ : 1 /* INFO */
);

// src/audio/sources/mic-source.ts
var MicAudioSource = class {
  constructor(analyzer, device) {
    this.logger = defaultLogger.child({ module: "MicAudioSource" });
    this.isRecording = false;
    this.analyzer = analyzer;
    this.mic = new import_node_microphone.default({
      rate: 44100,
      channels: 1,
      debug: false,
      device: device || "default"
    });
  }
  start() {
    if (this.isRecording) return;
    this.logger.info("Starting microphone capture...");
    try {
      this.stream = this.mic.startRecording();
      this.isRecording = true;
      const frameSize = 1024;
      let buffer = [];
      this.stream.on("data", (data) => {
        for (let i = 0; i < data.length; i += 2) {
          const int16 = data.readInt16LE(i);
          const float32 = int16 / 32768;
          buffer.push(float32);
          if (buffer.length >= frameSize) {
            const frame = new Float32Array(buffer);
            this.analyzer.processFrame(frame, Date.now());
            buffer = [];
          }
        }
      });
      this.stream.on("error", (err) => {
        this.logger.error("Microphone stream error", err);
      });
    } catch (error) {
      this.logger.error("Failed to start microphone", { error });
    }
  }
  stop() {
    if (!this.isRecording) return;
    this.mic.stopRecording();
    this.isRecording = false;
    this.logger.info("Microphone capture stopped");
  }
};

// src/audio/analyzer.ts
var import_worker_threads = require("worker_threads");
var import_path = require("path");
var AudioAnalyzer = class {
  constructor(config) {
    this.logger = defaultLogger.child({ module: "AudioAnalyzer" });
    this.worker = null;
    this.latestMetrics = null;
    this.config = config;
    this.initializeWorker();
  }
  initializeWorker() {
    try {
      const workerPath = (0, import_path.resolve)(__dirname, "./worker.ts");
      this.worker = new import_worker_threads.Worker(workerPath, {
        workerData: { config: this.config },
        execArgv: ["-r", "ts-node/register"]
        // Required for running .ts worker
      });
      this.worker.on("message", (message) => {
        if (message.type === "metrics") {
          this.latestMetrics = message.data;
        }
      });
      this.worker.on("error", (err) => {
        this.logger.error("Audio Worker error", err);
      });
      this.worker.on("exit", (code) => {
        if (code !== 0) {
          this.logger.error(`Audio Worker stopped with exit code ${code}`);
        }
      });
      this.logger.info("Audio Worker initialized", { workerPath });
    } catch (error) {
      this.logger.error("Failed to initialize Audio Worker", { error });
    }
  }
  /**
   * Process audio frame (Asynchronous/Non-blocking)
   * Sends data to worker and returns immediately.
   */
  processFrame(samples, timestamp) {
    if (this.worker) {
      this.worker.postMessage({
        type: "process",
        data: { samples, timestamp }
      });
    }
    return this.latestMetrics || this.createEmptyMetrics(timestamp);
  }
  createEmptyMetrics(timestamp) {
    return {
      timestamp,
      energy: 0,
      bpm: 0,
      beat: false,
      mood: "calm",
      spectralCentroid: 0,
      spectralFlux: 0,
      zeroCrossingRate: 0
    };
  }
  stop() {
    if (this.worker) {
      this.worker.terminate();
      this.logger.info("Audio Worker terminated");
    }
  }
  // Methods required by facade/existing interface
  // These might need to be implemented via async requests to worker or removed from interface if possible
  updateConfig(config) {
    this.config = { ...this.config, ...config };
    if (this.worker) {
      this.worker.postMessage({ type: "config", data: config });
    }
  }
  reset() {
    this.latestMetrics = null;
  }
  // Stubs for methods used in debugging/logging that relied on internal state
  // If these are critical, we need to request state from worker or cache it
  getState() {
    return {
      sampleRate: this.config.sampleRate,
      frameSize: this.config.frameSize,
      hopSize: this.config.hopSize,
      energyHistory: [],
      energyAvg: 0,
      energyPeak: 0,
      lastBeats: [],
      bpm: this.latestMetrics?.bpm || null,
      lastBeatTime: 0,
      mood: this.latestMetrics?.mood || "calm",
      moodHistory: [],
      lastUpdateTimestamp: this.latestMetrics?.timestamp || 0,
      lastMoodUpdate: 0,
      framesProcessed: 0,
      averageProcessingTime: 0
    };
  }
};

// src/lighting/renderer.ts
var ArtNet = require_artnet();
var DMXRenderer = class {
  constructor(options = {}) {
    this.logger = defaultLogger.child({ module: "DMXRenderer" });
    this.artNetClient = null;
    this.statistics = {
      framesRendered: 0,
      averageRenderTime: 0,
      dmxPacketsSent: 0,
      lastRenderTime: 0,
      fixtureCount: 0,
      universeCount: 0
    };
    // Transition tracking
    this.transitions = /* @__PURE__ */ new Map();
    // Previous values for rate limiting
    this.previousValues = /* @__PURE__ */ new Map();
    // Fixture profile cache
    this.profileCache = /* @__PURE__ */ new Map();
    this.options = {
      applyGammaCorrection: options.applyGammaCorrection ?? true,
      gamma: options.gamma ?? 2.2,
      smoothTransitions: options.smoothTransitions ?? true,
      transitionTime: options.transitionTime ?? 100,
      limitRateOfChange: options.limitRateOfChange ?? true,
      maxChangePerFrame: options.maxChangePerFrame ?? 0.1,
      artNet: options.artNet
    };
    if (this.options.artNet) {
      this.artNetClient = ArtNet({
        host: this.options.artNet.host,
        port: this.options.artNet.port,
        refresh: this.options.artNet.refreshRate
      });
      this.logger.info("ArtNet client initialized", {
        config: this.options.artNet
      });
    }
    this.logger.info("DMXRenderer initialized for real equipment", {
      options: this.options
    });
  }
  /**
   * Render fixture states to DMX universe frames
   */
  renderToDMX(fixtureStates, patchManager, profiles) {
    const startTime = performance.now();
    const universeFrames = [];
    const universeMap = /* @__PURE__ */ new Map();
    for (const [fixtureId, state] of fixtureStates) {
      const fixture = patchManager.getFixture(fixtureId);
      if (!fixture) {
        this.logger.warn("Fixture not found in patch", { fixtureId });
        continue;
      }
      const universe = fixture.universe;
      if (!universeMap.has(universe)) {
        universeMap.set(universe, []);
      }
      universeMap.get(universe).push({ fixture, state });
    }
    for (const [universe, fixtures] of universeMap) {
      const frameData = new Uint8Array(512);
      for (const { fixture, state } of fixtures) {
        this.renderFixtureToDMX(fixture, state, frameData, profiles);
      }
      universeFrames.push({
        universe,
        data: frameData,
        timestamp: Date.now()
      });
      if (this.artNetClient) {
        const dataArray = Array.from(frameData);
        this.artNetClient.set(
          universe,
          dataArray,
          (err, res) => {
            if (err) {
              this.logger.error("Failed to send ArtNet packet", {
                universe,
                error: err.message
              });
            }
          }
        );
      }
    }
    const renderTime = performance.now() - startTime;
    this.updateStatistics(
      renderTime,
      universeFrames.length,
      fixtureStates.size
    );
    this.logger.debug("DMX rendering complete", {
      universeCount: universeFrames.length,
      fixtureCount: fixtureStates.size,
      renderTime: renderTime.toFixed(2)
    });
    return universeFrames;
  }
  /**
   * Render a single fixture to DMX
   */
  renderFixtureToDMX(fixture, state, frameData, profiles) {
    const profile = profiles.get(fixture.profileId);
    if (!profile) {
      this.logger.warn("Fixture profile not found", {
        profileId: fixture.profileId,
        fixtureId: fixture.id
      });
      return;
    }
    const channelMapping = this.getChannelMapping(profile);
    this.processAttribute(
      "dim",
      state.dim,
      fixture,
      channelMapping.dim,
      frameData
    );
    this.processAttribute(
      "pan",
      this.normalizePan(state.panNorm),
      fixture,
      channelMapping.pan,
      frameData
    );
    this.processAttribute(
      "tilt",
      this.normalizeTilt(state.tiltNorm),
      fixture,
      channelMapping.tilt,
      frameData
    );
    this.processAttribute(
      "color",
      state.colorIndex,
      fixture,
      channelMapping.color,
      frameData
    );
    this.processAttribute(
      "strobe",
      state.strobe,
      fixture,
      channelMapping.strobe,
      frameData
    );
    this.processAttribute(
      "gobo",
      state.goboIndex,
      fixture,
      channelMapping.gobo,
      frameData
    );
    if (state.focus !== void 0 && channelMapping.focus) {
      this.processAttribute(
        "focus",
        state.focus,
        fixture,
        channelMapping.focus,
        frameData
      );
    }
    if (state.zoom !== void 0 && channelMapping.zoom) {
      this.processAttribute(
        "zoom",
        state.zoom,
        fixture,
        channelMapping.zoom,
        frameData
      );
    }
    if (state.iris !== void 0 && channelMapping.iris) {
      this.processAttribute(
        "iris",
        state.iris,
        fixture,
        channelMapping.iris,
        frameData
      );
    }
    if (state.frost !== void 0 && channelMapping.frost) {
      this.processAttribute(
        "frost",
        state.frost,
        fixture,
        channelMapping.frost,
        frameData
      );
    }
    if (state.prism !== void 0 && channelMapping.prism) {
      this.processAttribute(
        "prism",
        state.prism,
        fixture,
        channelMapping.prism,
        frameData
      );
    }
    if (state.shutter !== void 0 && channelMapping.shutter) {
      this.processAttribute(
        "shutter",
        state.shutter,
        fixture,
        channelMapping.shutter,
        frameData
      );
    }
  }
  /**
   * Process a single attribute to DMX
   */
  processAttribute(attributeName, normalizedValue, fixture, channelDef, frameData) {
    if (!channelDef) {
      return;
    }
    let processedValue = normalizedValue;
    if (this.options.smoothTransitions) {
      processedValue = this.applySmoothTransition(
        fixture.id,
        attributeName,
        normalizedValue
      );
    }
    if (this.options.limitRateOfChange) {
      processedValue = this.applyRateLimiting(
        fixture.id,
        attributeName,
        processedValue
      );
    }
    let dmxValue = this.normalizedToDMX(processedValue, channelDef.range);
    if (this.options.applyGammaCorrection) {
      dmxValue = this.applyGammaCorrection(dmxValue);
    }
    const dmxChannel = fixture.startAddress - 1 + (channelDef.channelIndex - 1);
    if (dmxChannel >= 0 && dmxChannel < 512) {
      frameData[dmxChannel] = dmxValue;
    } else {
      this.logger.warn("DMX channel out of range", {
        fixtureId: fixture.id,
        attribute: attributeName,
        channel: dmxChannel,
        startAddress: fixture.startAddress,
        channelIndex: channelDef.channelIndex
      });
    }
  }
  /**
   * Apply smooth transition to value
   */
  applySmoothTransition(fixtureId, attributeName, targetValue) {
    const transitionKey = `${fixtureId}:${attributeName}`;
    const now = Date.now();
    if (!this.transitions.has(fixtureId)) {
      this.transitions.set(fixtureId, /* @__PURE__ */ new Map());
    }
    const fixtureTransitions = this.transitions.get(fixtureId);
    if (!fixtureTransitions.has(attributeName)) {
      fixtureTransitions.set(attributeName, {
        targetValue,
        currentValue: targetValue,
        startTime: now,
        endTime: now + this.options.transitionTime,
        startValue: targetValue
      });
      return targetValue;
    }
    const transition = fixtureTransitions.get(attributeName);
    if (Math.abs(transition.targetValue - targetValue) > 1e-3) {
      transition.targetValue = targetValue;
      transition.startValue = transition.currentValue;
      transition.startTime = now;
      transition.endTime = now + this.options.transitionTime;
    }
    if (now >= transition.endTime) {
      transition.currentValue = transition.targetValue;
      return transition.currentValue;
    }
    const progress = (now - transition.startTime) / (transition.endTime - transition.startTime);
    transition.currentValue = transition.startValue + (transition.targetValue - transition.startValue) * progress;
    return transition.currentValue;
  }
  /**
   * Apply rate limiting to value changes
   */
  applyRateLimiting(fixtureId, attributeName, currentValue) {
    if (!this.previousValues.has(fixtureId)) {
      this.previousValues.set(fixtureId, /* @__PURE__ */ new Map());
    }
    const fixtureValues = this.previousValues.get(fixtureId);
    const previousValue = fixtureValues.get(attributeName) ?? currentValue;
    const maxChange = this.options.maxChangePerFrame;
    const delta = currentValue - previousValue;
    let limitedValue = currentValue;
    if (Math.abs(delta) > maxChange) {
      limitedValue = previousValue + Math.sign(delta) * maxChange;
    }
    fixtureValues.set(attributeName, limitedValue);
    return limitedValue;
  }
  /**
   * Convert normalized value (0..1) to DMX value (0..255)
   */
  normalizedToDMX(normalizedValue, range) {
    const clamped = Math.max(0, Math.min(1, normalizedValue));
    if (range) {
      const [min, max] = range;
      return Math.round(min + clamped * (max - min));
    }
    return Math.round(clamped * 255);
  }
  /**
   * Apply gamma correction to DMX value
   */
  applyGammaCorrection(dmxValue) {
    if (!this.options.applyGammaCorrection || this.options.gamma === 1) {
      return dmxValue;
    }
    const normalized = dmxValue / 255;
    const corrected = Math.pow(normalized, 1 / this.options.gamma);
    return Math.round(corrected * 255);
  }
  /**
   * Normalize pan value (-1..1) to 0..1
   */
  normalizePan(panNorm) {
    return (panNorm + 1) / 2;
  }
  /**
   * Normalize tilt value (-1..1) to 0..1
   */
  normalizeTilt(tiltNorm) {
    return (tiltNorm + 1) / 2;
  }
  /**
   * Get channel mapping for a fixture profile
   */
  getChannelMapping(profile) {
    if (this.profileCache.has(profile.id)) {
      return this.profileCache.get(profile.id);
    }
    const mapping = {};
    for (const channel of profile.channels) {
      switch (channel.type) {
        case "dim":
          mapping.dim = channel;
          break;
        case "position":
          if (channel.name.toLowerCase().includes("pan")) {
            mapping.pan = channel;
          } else if (channel.name.toLowerCase().includes("tilt")) {
            mapping.tilt = channel;
          }
          break;
        case "color":
          mapping.color = channel;
          break;
        case "strobe":
          mapping.strobe = channel;
          break;
        case "other":
          if (channel.name.toLowerCase().includes("gobo")) {
            mapping.gobo = channel;
          } else if (channel.name.toLowerCase().includes("focus")) {
            mapping.focus = channel;
          } else if (channel.name.toLowerCase().includes("zoom")) {
            mapping.zoom = channel;
          } else if (channel.name.toLowerCase().includes("iris")) {
            mapping.iris = channel;
          } else if (channel.name.toLowerCase().includes("frost")) {
            mapping.frost = channel;
          } else if (channel.name.toLowerCase().includes("prism")) {
            mapping.prism = channel;
          } else if (channel.name.toLowerCase().includes("shutter")) {
            mapping.shutter = channel;
          }
          break;
      }
    }
    this.profileCache.set(profile.id, mapping);
    return mapping;
  }
  /**
   * Update render statistics
   */
  updateStatistics(renderTime, universeCount, fixtureCount) {
    this.statistics.framesRendered++;
    this.statistics.lastRenderTime = renderTime;
    this.statistics.fixtureCount = fixtureCount;
    this.statistics.universeCount = universeCount;
    this.statistics.averageRenderTime = (this.statistics.averageRenderTime * (this.statistics.framesRendered - 1) + renderTime) / this.statistics.framesRendered;
    this.statistics.dmxPacketsSent += universeCount;
  }
  /**
   * Get render statistics
   */
  getStatistics() {
    return { ...this.statistics };
  }
  /**
   * Reset render statistics
   */
  resetStatistics() {
    this.statistics = {
      framesRendered: 0,
      averageRenderTime: 0,
      dmxPacketsSent: 0,
      lastRenderTime: 0,
      fixtureCount: 0,
      universeCount: 0
    };
    this.transitions.clear();
    this.previousValues.clear();
    this.logger.info("DMX render statistics and caches reset");
  }
  /**
   * Update renderer options
   */
  updateOptions(options) {
    this.options = { ...this.options, ...options };
    this.logger.info("DMX renderer options updated", {
      newOptions: this.options
    });
  }
  /**
   * Clear all transitions (useful for scene changes)
   */
  clearTransitions() {
    this.transitions.clear();
    this.previousValues.clear();
    this.logger.info("All transitions cleared");
  }
  /**
   * Get current renderer options
   */
  getOptions() {
    return { ...this.options };
  }
};

// tests/manual/system_check.ts
var mockMic = new import_events.EventEmitter();
mockMic.startRecording = () => mockMic;
mockMic.stopRecording = () => {
};
var originalRequire = require;
console.log("Imports successful. Checking logic...");
async function systemCheck() {
  try {
    console.log("Initializing AudioAnalyzer...");
    global.Worker = class MockWorker {
      postMessage(msg) {
        if (msg.type === "process") {
          if (this.onmessage) {
            this.onmessage({
              data: {
                type: "metrics",
                data: {
                  energy: 0.5,
                  beat: true,
                  timestamp: Date.now()
                }
              }
            });
          }
        }
      }
      terminate() {
      }
      addEventListener() {
      }
      removeEventListener() {
      }
      dispatchEvent() {
        return true;
      }
    };
    const analyzer = new AudioAnalyzer();
    console.log("AudioAnalyzer created.");
    console.log("Initializing MicAudioSource...");
    try {
      const mic = new MicAudioSource(analyzer);
      console.log("MicAudioSource created (stub).");
    } catch (e) {
      console.log(
        "MicAudioSource instantiation failed (expected without hardware/mocks):",
        e.message
      );
    }
    console.log("Initializing DMXRenderer...");
    const renderer = new DMXRenderer({
      artNet: { host: "127.0.0.1", port: 6454 }
    });
    console.log("DMXRenderer created.");
    console.log("SYSTEM INTEGRATION CHECK PASSED (Static)");
  } catch (e) {
    console.error("System Check Failed:", e);
    process.exit(1);
  }
}
systemCheck();
