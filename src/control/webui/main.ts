import { ImGui, ImGui_Impl } from "@zhobo63/imgui-ts";
import { io, Socket } from "socket.io-client";

// Global state for now
let socket: Socket;
let isConnected = false;
let systemState: any = {};
let audioMetrics: any = {};

// Initialize Socket.IO
function initSocket() {
  socket = io(window.location.origin, {
    path: "/ws",
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    isConnected = true;
    console.log("Connected to WebSocket");
    socket.emit("authenticate", {
      type: "authenticate",
      token: "demo-token-phase-3",
      timestamp: Date.now(),
    });
  });

  socket.on("disconnect", () => {
    isConnected = false;
  });

  socket.on("stateUpdate", (data: any) => {
    if (data.systemState) {
      systemState = { ...systemState, ...data.systemState };
    }
  });

  // Listen for metrics if provided in loopUpdate
  socket.on("loopUpdate", (data: any) => {
    if (data.metrics && data.metrics.audio) {
      audioMetrics = data.metrics.audio;
    }
  });

  // Handle initial state
  socket.on("initialState", (data: any) => {
    if (data.systemState) {
      systemState = data.systemState;
    }
  });
}

async function main() {
  await ImGui.default();
  ImGui.CHECKVERSION();
  console.log("ImGui Version:", ImGui.VERSION);

  ImGui.CreateContext();
  ImGui.StyleColorsDark();

  // Adjust for mobile/high-DPI
  if (ImGui.isMobile.any()) {
    ImGui_Impl.setCanvasScale(1);
    ImGui_Impl.setFontScale(1.5);
  }

  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  ImGui_Impl.Init(canvas);

  initSocket();

  window.requestAnimationFrame(loop);
}

const clearColor = new ImGui.ImVec4(0.1, 0.1, 0.1, 1.0);

function loop(time: number) {
  if (ImGui_Impl.is_contextlost) return;

  ImGui_Impl.NewFrame(time);
  ImGui.NewFrame();

  // Draw UI
  drawUI();

  ImGui.EndFrame();
  ImGui.Render();

  ImGui_Impl.ClearBuffer(clearColor);
  ImGui_Impl.RenderDrawData(ImGui.GetDrawData());

  window.requestAnimationFrame(loop);
}

function drawUI() {
  // Main Control Window
  ImGui.SetNextWindowPos(new ImGui.ImVec2(10, 10), ImGui.Cond.FirstUseEver);
  ImGui.SetNextWindowSize(new ImGui.ImVec2(400, 500), ImGui.Cond.FirstUseEver);

  ImGui.Begin("Autonomous DMX Engine Control");

  // Status Header
  if (isConnected) {
    ImGui.TextColored(new ImGui.ImVec4(0, 1, 0, 1), "Connected to Server");
  } else {
    ImGui.TextColored(new ImGui.ImVec4(1, 0, 0, 1), "Disconnected");
    if (ImGui.Button("Reconnect")) {
      socket.connect();
    }
  }

  ImGui.Separator();

  // System Mode
  ImGui.Text("System Mode");
  // Mode selection logic here (simplified for now)
  if (ImGui.Button("Auto")) sendCommand("setMode", "auto");
  ImGui.SameLine();
  if (ImGui.Button("Manual")) sendCommand("setMode", "manual");
  ImGui.SameLine();
  if (ImGui.Button("Off")) sendCommand("setMode", "off");

  // Display current mode
  if (systemState.mode) {
    ImGui.Text(`Current Mode: ${systemState.mode}`);
  }

  ImGui.Separator();

  // Intensity Slider
  // ImGui.SliderFloat requires an array/object to hold the value reference
  // We'll use a static object for now and sync it on release
  // For simplicity in this step, let's just show text
  let intensity = systemState.globalIntensity || 0;
  ImGui.Text(`Global Intensity: ${(intensity * 100).toFixed(0)}%`);

  // Blackout
  let isBlackout = systemState.blackout || false;
  if (isBlackout) {
    if (ImGui.Button("Restore Output")) {
      sendCommand("setBlackout", false);
    }
  } else {
    if (ImGui.Button("BLACKOUT")) {
      sendCommand("setBlackout", true);
    }
  }

  ImGui.Separator();

  // Audio Metrics
  if (
    ImGui.CollapsingHeader("Audio Metrics", ImGui.TreeNodeFlags.DefaultOpen)
  ) {
    ImGui.Text(`Energy: ${(audioMetrics.energy || 0).toFixed(2)}`);
    // Beat indicator
    if (audioMetrics.isBeat) {
      ImGui.TextColored(new ImGui.ImVec4(0, 1, 0, 1), "BEAT!");
    } else {
      ImGui.Text("No Beat");
    }
  }

  ImGui.End();

  // Demo Window for debugging
  // ImGui.ShowDemoWindow();
}

function sendCommand(type: string, payload: any) {
  if (!socket || !isConnected) return;

  const command = {
    type: "command",
    data: {
      type,
      payload,
      timestamp: Date.now(),
      commandId: `cmd-${Date.now()}`,
    },
  };
  socket.emit("command", command);
}

// Start
document.addEventListener("DOMContentLoaded", main);
