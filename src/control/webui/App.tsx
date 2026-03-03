/**
 * Главный компонент приложения Phase 3
 * Интегрирует все страницы и компоненты UI
 */

import { ImGui } from "@zhobo63/imgui-ts";
import { store, selectors } from './store/store';
import { extendedStore } from './store/store-extended';
import { DashboardLayout } from './layouts/DashboardLayout';
import { DashboardHome } from './pages/DashboardHome';
import { AudioVisualization } from './pages/AudioVisualization';
import { DMXMonitor } from './pages/DMXMonitor';
import { SceneEditor } from './pages/SceneEditor';
import { EffectEditor } from './pages/EffectEditor';
import { FixtureManager } from './pages/FixtureManager';
import { RuleEditor } from './pages/RuleEditor';
import { AuthPage } from './pages/AuthPage';

interface AppProps {
  onCommand?: (type: string, payload: any) => void;
  onNavigate?: (page: string) => void;
  initialPage?: string;
}

/**
 * Главный компонент приложения, управляющий рендерингом всех страниц
 */
export function App(props: AppProps) {
  const state = store.getState();
  const extendedState = extendedStore.getState();
  const currentPage = props.initialPage || selectors.getCurrentPage(state);
  
  // Определяем, какой компонент рендерить
  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return DashboardHome({
          onNavigate: props.onNavigate || (() => {}),
          onCommand: props.onCommand || (() => {}),
          systemState: state.system,
          audioMetrics: state.audio,
          realtimeData: state.realtime
        });
        
      case 'audio':
        return AudioVisualization({
          onNavigate: props.onNavigate || (() => {}),
          audioData: state.realtime.audioData,
          audioMetrics: state.audio,
          onAudioCommand: props.onCommand || (() => {})
        });
        
      case 'dmx':
        return DMXMonitor({
          onNavigate: props.onNavigate || (() => {}),
          dmxData: state.realtime.dmxData,
          fixtures: extendedState.fixtures || [],
          onDMXCommand: props.onCommand || (() => {})
        });
        
      case 'scenes':
        return SceneEditor({
          onNavigate: props.onNavigate || (() => {}),
          scenes: extendedState.scenes || [],
          currentScene: extendedState.currentScene,
          onSceneCommand: props.onCommand || (() => {}),
          onSceneSelect: (sceneId: string) => {
            // Базовая реализация
            console.log('Scene selected:', sceneId);
          }
        });
        
      case 'effects':
        return EffectEditor({
          onNavigate: props.onNavigate || (() => {}),
          effects: extendedState.effects || [],
          activeEffects: extendedState.activeEffects || [],
          onEffectCommand: props.onCommand || (() => {}),
          onEffectToggle: (effectId: string, enabled: boolean) => {
            // Базовая реализация
            console.log('Effect toggled:', effectId, enabled);
          }
        });
        
      case 'fixtures':
        return FixtureManager({
          onNavigate: props.onNavigate || (() => {}),
          fixtures: extendedState.fixtures || [],
          patch: extendedState.patch || {},
          onFixtureCommand: props.onCommand || (() => {}),
          onFixtureUpdate: (fixtureId: string, updates: any) => {
            // Базовая реализация
            console.log('Fixture updated:', fixtureId, updates);
          }
        });
        
      case 'rules':
        return RuleEditor({
          onNavigate: props.onNavigate || (() => {}),
          rules: extendedState.rules || [],
          onRuleCommand: props.onCommand || (() => {}),
          onRuleUpdate: (ruleId: string, updates: any) => {
            // Базовая реализация
            console.log('Rule updated:', ruleId, updates);
          }
        });
        
      case 'auth':
        return AuthPage({
          onLogin: (credentials: any) => {
            // Базовая реализация
            console.log('Login:', credentials);
            if (props.onNavigate) props.onNavigate('home');
          },
          onRegister: (credentials: any) => {
            // Базовая реализация
            console.log('Register:', credentials);
            if (props.onNavigate) props.onNavigate('home');
          }
        });
        
      default:
        return renderNotFoundPage();
    }
  };
  
  // Рендерим с использованием текущего layout
  const renderWithLayout = () => {
    const layout = state.ui.layout;
    
    switch (layout) {
      case 'dashboard':
        return DashboardLayout({
          systemState: state.system,
          audioMetrics: state.audio,
          onCommand: props.onCommand || (() => {}),
          onNavigate: props.onNavigate || (() => {}),
          currentPage,
          children: renderPage()
        });
        
      case 'expanded':
        return renderExpandedLayout(renderPage);
        
      case 'compact':
      default:
        return renderCompactLayout(renderPage);
    }
  };
  
  return renderWithLayout();
}

/**
 * Расширенный layout с полным экраном
 */
function renderExpandedLayout(renderPage: () => any) {
  ImGui.SetNextWindowPos(new ImGui.ImVec2(0, 0), ImGui.Cond.Always);
  ImGui.SetNextWindowSize(new ImGui.ImVec2(ImGui.GetIO().DisplaySize.x, ImGui.GetIO().DisplaySize.y), ImGui.Cond.Always);
  
  ImGui.Begin("Autonomous DMX Engine - Phase 3", null, 
    ImGui.WindowFlags.NoTitleBar | 
    ImGui.WindowFlags.NoResize | 
    ImGui.WindowFlags.NoMove |
    ImGui.WindowFlags.NoBringToFrontOnFocus
  );
  
  // Верхняя панель навигации
  renderNavigationBar();
  
  // Основной контент
  ImGui.BeginChild("content", new ImGui.ImVec2(0, -40), true);
  renderPage();
  ImGui.EndChild();
  
  // Нижняя панель статуса
  renderStatusBar();
  
  ImGui.End();
}

/**
 * Компактный layout для небольших экранов
 */
function renderCompactLayout(renderPage: () => any) {
  ImGui.SetNextWindowPos(new ImGui.ImVec2(10, 10), ImGui.Cond.FirstUseEver);
  ImGui.SetNextWindowSize(new ImGui.ImVec2(800, 600), ImGui.Cond.FirstUseEver);
  
  ImGui.Begin("DMX Engine Control");
  
  // Простой заголовок
  const state = store.getState();
  const isConnected = selectors.isConnected(state);
  
  if (isConnected) {
    ImGui.TextColored(new ImGui.ImVec4(0, 1, 0, 1), "Connected");
  } else {
    ImGui.TextColored(new ImGui.ImVec4(1, 0, 0, 1), "Disconnected");
  }
  
  ImGui.SameLine();
  ImGui.Text(` | Phase 3 UI | Layout: ${state.ui.layout}`);
  
  // Навигационные кнопки
  renderCompactNavigation();
  
  ImGui.NewLine();
  
  // Контент страницы
  renderPage();
  
  ImGui.End();
}

/**
 * Панель навигации для расширенного layout
 */
function renderNavigationBar() {
  const state = store.getState();
  const currentPage = selectors.getCurrentPage(state);
  const pages = [
    { id: 'home', label: 'Dashboard' },
    { id: 'audio', label: 'Audio' },
    { id: 'dmx', label: 'DMX Monitor' },
    { id: 'scenes', label: 'Scenes' },
    { id: 'effects', label: 'Effects' },
    { id: 'fixtures', label: 'Fixtures' },
    { id: 'rules', label: 'Rules' },
    { id: 'config', label: 'Config' }
  ];
  
  ImGui.BeginChild("navigation", new ImGui.ImVec2(0, 40), false);
  
  for (const page of pages) {
    const isActive = currentPage === page.id;
    
    if (isActive) {
      ImGui.PushStyleColor(ImGui.Col.Button, new ImGui.ImVec4(0.3, 0.5, 0.8, 1));
      ImGui.PushStyleColor(ImGui.Col.ButtonHovered, new ImGui.ImVec4(0.4, 0.6, 0.9, 1));
    }
    
    if (ImGui.Button(page.label)) {
      store.setCurrentPage(page.id as any);
    }
    
    if (isActive) {
      ImGui.PopStyleColor(2);
    }
    
    ImGui.SameLine();
  }
  
  ImGui.EndChild();
}

/**
 * Компактная навигация
 */
function renderCompactNavigation() {
  const state = store.getState();
  const currentPage = selectors.getCurrentPage(state);
  const pages = ['home', 'audio', 'dmx', 'scenes', 'effects', 'fixtures', 'rules'];
  
  for (const page of pages) {
    const isActive = currentPage === page;
    
    if (isActive) {
      ImGui.PushStyleColor(ImGui.Col.Button, new ImGui.ImVec4(0.3, 0.5, 0.8, 1));
    }
    
    if (ImGui.Button(page)) {
      store.setCurrentPage(page as any);
    }
    
    if (isActive) {
      ImGui.PopStyleColor();
    }
    
    ImGui.SameLine();
  }
}

/**
 * Панель статуса
 */
function renderStatusBar() {
  const state = store.getState();
  
  ImGui.BeginChild("status", new ImGui.ImVec2(0, 30), false);
  
  // Левая часть: системная информация
  ImGui.Text(`Mode: ${state.system.mode} | Intensity: ${state.system.globalIntensity.toFixed(2)}`);
  ImGui.SameLine();
  
  // Центральная часть: аудио информация
  if (state.audio.isBeat) {
    ImGui.TextColored(new ImGui.ImVec4(1, 0.5, 0, 1), "BEAT!");
    ImGui.SameLine();
  }
  
  ImGui.Text(`Energy: ${state.audio.energy.toFixed(3)} | BPM: ${state.audio.bpm || 'N/A'}`);
  ImGui.SameLine();
  
  // Правая часть: производительность
  ImGui.SameLine(ImGui.GetWindowWidth() - 150);
  ImGui.Text(`FPS: 60`);
  
  ImGui.EndChild();
}

/**
 * Страница "не найдено"
 */
function renderNotFoundPage() {
  ImGui.Begin("Page Not Found");
  
  ImGui.TextColored(new ImGui.ImVec4(1, 0.5, 0, 1), "404 - Page Not Found");
  ImGui.Text("The requested page does not exist or you don't have permission to access it.");
  
  ImGui.NewLine();
  
  if (ImGui.Button("Return to Dashboard")) {
    store.setCurrentPage('home');
  }
  
  ImGui.End();
}

/**
 * Экспорт утилит для отладки
 */
export const AppUtils = {
  store,
  extendedStore,
  selectors
};

// Экспорт для глобального доступа (отладка)
if (typeof window !== 'undefined') {
  (window as any).DMXEngineApp = {
    App,
    AppUtils
  };
}