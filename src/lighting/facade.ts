/**
 * LightingFacade - фасад для модуля Lighting
 * Координирует Patch Manager, Attribute Manager и DMX Renderer
 * Реализует data-driven подход с конфигурационными файлами
 */

import { defaultLogger } from '../utils/logger';
import { ConfigLoader } from '../utils/config';
import { 
  LightingFacadeConfig,
  FixtureProfile,
  FixtureInstance,
  FixtureState,
  UniverseFrame,
  PatchConfig,
  LayoutConfig,
  MergeRules,
  DMXRenderingOptions,
  FixtureGroup,
  ColorPalette,
  StyleDefinition,
  RenderStatistics
} from './types';
import { BrainOutput } from '../engine/types';
import { LightingOutput } from '../engine/types';
import { GroupEffectState } from '../brain/types';

/**
 * Упрощённый Patch Manager для Phase 1
 */
class PatchManager {
  private logger = defaultLogger.child({ module: 'PatchManager' });
  private fixtures: Map<string, FixtureInstance> = new Map();
  private profiles: Map<string, FixtureProfile> = new Map();
  private groups: Map<string, string[]> = new Map(); // groupId -> fixtureIds
  private universes: Map<number, string[]> = new Map(); // universe -> fixtureIds

  constructor() {
    this.logger.info('PatchManager initialized');
  }

  loadPatch(patchConfig: PatchConfig): void {
    this.fixtures.clear();
    this.groups.clear();
    this.universes.clear();

    // Загрузка фикстур
    patchConfig.fixtures.forEach(fixture => {
      this.fixtures.set(fixture.id, fixture);
      
      // Добавление в группу
      if (!this.groups.has(fixture.groupId)) {
        this.groups.set(fixture.groupId, []);
      }
      this.groups.get(fixture.groupId)!.push(fixture.id);
      
      // Добавление в universe
      if (!this.universes.has(fixture.universe)) {
        this.universes.set(fixture.universe, []);
      }
      this.universes.get(fixture.universe)!.push(fixture.id);
    });

    this.logger.info('Patch loaded', {
      fixtureCount: this.fixtures.size,
      groupCount: this.groups.size,
      universeCount: this.universes.size
    });
  }

  loadProfiles(profiles: FixtureProfile[]): void {
    this.profiles.clear();
    profiles.forEach(profile => {
      this.profiles.set(profile.id, profile);
    });
    this.logger.info('Fixture profiles loaded', { count: profiles.length });
  }

  getFixture(id: string): FixtureInstance | undefined {
    return this.fixtures.get(id);
  }

  getFixtureProfile(profileId: string): FixtureProfile | undefined {
    return this.profiles.get(profileId);
  }

  getFixturesInGroup(groupId: string): string[] {
    return this.groups.get(groupId) || [];
  }

  getFixturesInUniverse(universe: number): string[] {
    return this.universes.get(universe) || [];
  }

  getAllFixtures(): FixtureInstance[] {
    return Array.from(this.fixtures.values());
  }

  getAllGroups(): string[] {
    return Array.from(this.groups.keys());
  }

  getAllUniverses(): number[] {
    return Array.from(this.universes.keys());
  }
}

/**
 * Упрощённый Attribute Manager для Phase 1
 */
class AttributeManager {
  private logger = defaultLogger.child({ module: 'AttributeManager' });
  private fixtureStates: Map<string, FixtureState> = new Map();
  private defaultAttributes: Partial<FixtureState>;
  private mergeRules: MergeRules;

  constructor(defaultAttributes: Partial<FixtureState>, mergeRules: MergeRules) {
    this.defaultAttributes = defaultAttributes;
    this.mergeRules = mergeRules;
    this.logger.info('AttributeManager initialized', { defaultAttributes, mergeRules });
  }

  initializeFixtures(fixtureIds: string[]): void {
    fixtureIds.forEach(id => {
      this.fixtureStates.set(id, this.createDefaultFixtureState(id));
    });
    this.logger.info('Fixtures initialized', { count: fixtureIds.length });
  }

  applyGroupEffect(groupId: string, effect: GroupEffectState): void {
    // В Phase 1 упрощённая логика
    // В будущих фазах будет реальное применение эффектов к каждому фикстуру в группе
    this.logger.debug('Group effect applied', { groupId, effectType: 'simplified' });
  }

  applyFixtureEffect(fixtureId: string, effect: Partial<FixtureState>): void {
    const currentState = this.fixtureStates.get(fixtureId);
    if (!currentState) {
      this.logger.warn('Fixture not found', { fixtureId });
      return;
    }

    // Обновление состояния с применением эффекта
    const newState: FixtureState = {
      ...currentState,
      ...effect,
      timestamp: Date.now()
    };

    this.fixtureStates.set(fixtureId, newState);
  }

  getAll(): Map<string, FixtureState> {
    return new Map(this.fixtureStates);
  }

  getFixtureState(fixtureId: string): FixtureState | undefined {
    return this.fixtureStates.get(fixtureId);
  }

  updateFixtureState(fixtureId: string, state: Partial<FixtureState>): void {
    const currentState = this.fixtureStates.get(fixtureId);
    if (!currentState) {
      this.logger.warn('Fixture not found for update', { fixtureId });
      return;
    }

    const newState: FixtureState = {
      ...currentState,
      ...state,
      timestamp: Date.now()
    };

    this.fixtureStates.set(fixtureId, newState);
  }

  resetAll(): void {
    this.fixtureStates.forEach((state, fixtureId) => {
      this.fixtureStates.set(fixtureId, this.createDefaultFixtureState(fixtureId));
    });
    this.logger.info('All fixture states reset to defaults');
  }

  private createDefaultFixtureState(fixtureId: string): FixtureState {
    return {
      fixtureId,
      dim: this.defaultAttributes.dim || 0,
      colorIndex: this.defaultAttributes.colorIndex || 0,
      panNorm: this.defaultAttributes.panNorm || 0,
      tiltNorm: this.defaultAttributes.tiltNorm || 0,
      strobe: this.defaultAttributes.strobe || 0,
      goboIndex: this.defaultAttributes.goboIndex || 0,
      focus: this.defaultAttributes.focus || 0,
      zoom: this.defaultAttributes.zoom || 1,
      iris: this.defaultAttributes.iris || 1,
      frost: this.defaultAttributes.frost || 0,
      prism: this.defaultAttributes.prism || 0,
      shutter: this.defaultAttributes.shutter || 0,
      timestamp: Date.now()
    };
  }
}

/**
 * Упрощённый DMX Renderer для Phase 1
 */
class DMXRenderer {
  private logger = defaultLogger.child({ module: 'DMXRenderer' });
  private options: DMXRenderingOptions;
  private statistics: RenderStatistics = {
    framesRendered: 0,
    averageRenderTime: 0,
    dmxPacketsSent: 0,
    lastRenderTime: 0,
    fixtureCount: 0,
    universeCount: 0
  };

  constructor(options: DMXRenderingOptions) {
    this.options = options;
    this.logger.info('DMXRenderer initialized', { options });
  }

  renderToDMX(fixtureStates: Map<string, FixtureState>, patchManager: PatchManager): UniverseFrame[] {
    const startTime = performance.now();
    const universeFrames: UniverseFrame[] = [];
    
    // Получение всех universe
    const universes = patchManager.getAllUniverses();
    
    universes.forEach(universe => {
      const fixtureIds = patchManager.getFixturesInUniverse(universe);
      const frameData = new Uint8Array(512); // 512 DMX каналов
      
      fixtureIds.forEach(fixtureId => {
        const fixture = patchManager.getFixture(fixtureId);
        const state = fixtureStates.get(fixtureId);
        
        if (!fixture || !state) {
          return;
        }
        
        // В Phase 1 упрощённый рендеринг
        // В будущих фазах будет реальное преобразование атрибутов в DMX значения
        this.renderFixtureToDMX(fixture, state, frameData);
      });
      
      universeFrames.push({
        universe,
        data: frameData,
        timestamp: Date.now()
      });
    });
    
    // Обновление статистики
    const renderTime = performance.now() - startTime;
    this.updateStatistics(renderTime, universeFrames.length);
    
    this.logger.debug('DMX rendering complete', {
      universeCount: universeFrames.length,
      renderTime: renderTime.toFixed(2)
    });
    
    return universeFrames;
  }

  private renderFixtureToDMX(fixture: FixtureInstance, state: FixtureState, frameData: Uint8Array): void {
    // Упрощённый рендеринг для Phase 1
    // Просто устанавливаем dim канал для демонстрации
    const dimChannel = fixture.startAddress - 1; // 0-based index
    const dimValue = Math.floor(state.dim * 255);
    
    if (dimChannel >= 0 && dimChannel < 512) {
      frameData[dimChannel] = dimValue;
    }
    
    // В Phase 1 игнорируем остальные атрибуты
    // В будущих фазах будет полная поддержка всех каналов
  }

  private updateStatistics(renderTime: number, universeCount: number): void {
    this.statistics.framesRendered++;
    this.statistics.lastRenderTime = renderTime;
    
    // Обновление среднего времени рендеринга
    this.statistics.averageRenderTime = 
      (this.statistics.averageRenderTime * (this.statistics.framesRendered - 1) + renderTime) / 
      this.statistics.framesRendered;
    
    this.statistics.dmxPacketsSent += universeCount;
  }

  getStatistics(): RenderStatistics {
    return { ...this.statistics };
  }

  resetStatistics(): void {
    this.statistics = {
      framesRendered: 0,
      averageRenderTime: 0,
      dmxPacketsSent: 0,
      lastRenderTime: 0,
      fixtureCount: 0,
      universeCount: 0
    };
    this.logger.info('DMX render statistics reset');
  }
}

/**
 * LightingFacade - главный фасад модуля Lighting
 */
export class LightingFacade {
  private logger = defaultLogger.child({ module: 'LightingFacade' });
  private patchManager: PatchManager;
  private attributeManager: AttributeManager;
  private dmxRenderer: DMXRenderer;
  private config: LightingFacadeConfig;
  private configLoader: ConfigLoader;
  private isInitialized = false;

  constructor(config: LightingFacadeConfig) {
    this.config = config;
    this.configLoader = new ConfigLoader();
    
    // Инициализация компонентов
    this.patchManager = new PatchManager();
    this.attributeManager = new AttributeManager(
      config.defaultAttributes,
      config.mergeRules
    );
    this.dmxRenderer = new DMXRenderer({
      applyGammaCorrection: true,
      gamma: 2.2,
      smoothTransitions: true,
      transitionTime: 100,
      limitRateOfChange: true,
      maxChangePerFrame: 0.1
    });
    
    this.logger.info('LightingFacade initialized', { config });
  }

  /**
   * Инициализация lighting системы
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('LightingFacade is already initialized');
      return;
    }
    
    try {
      this.logger.info('Initializing LightingFacade...');
      
      // В Phase 1 создаём mock данные
      // В будущих фазах будет загрузка из конфигурационных файлов
      await this.loadMockConfiguration();
      
      // Инициализация состояний фикстур
      const allFixtures = this.patchManager.getAllFixtures();
      const fixtureIds = allFixtures.map(f => f.id);
      this.attributeManager.initializeFixtures(fixtureIds);
      
      this.isInitialized = true;
      this.logger.info('LightingFacade initialized successfully', {
        fixtureCount: fixtureIds.length
      });
      
    } catch (error) {
      this.logger.error('Error initializing LightingFacade', { error });
      throw error;
    }
  }

  /**
   * Основной метод обновления - вызывается в fast loop
   */
  update(brainOutput: BrainOutput): LightingOutput {
    if (!this.isInitialized) {
      this.logger.error('LightingFacade not initialized');
      return this.createEmptyOutput();
    }
    
    const startTime = performance.now();
    
    try {
      // 1. Применение эффектов к атрибутам
      for (const effect of brainOutput.groupEffects) {
        this.attributeManager.applyGroupEffect(effect.groupId, effect);
      }
      
      // 2. Получение финальных состояний
      const finalStates = this.attributeManager.getAll();
      
      // 3. Рендеринг DMX (mock для Phase 1)
      const universeFrames = this.config.enableDMXOutput
        ? this.dmxRenderer.renderToDMX(finalStates, this.patchManager)
        : [];
      
      const processingTime = performance.now() - startTime;
      this.logger.debug('Lighting processing complete', {
        effectCount: brainOutput.groupEffects.length,
        fixtureCount: finalStates.size,
        universeCount: universeFrames.length,
        processingTime: processingTime.toFixed(2)
      });
      
      return {
        universeFrames,
        fixtureStates: finalStates
      };
      
    } catch (error) {
      this.logger.error('Error in lighting processing', { error });
      return this.createEmptyOutput();
    }
  }

  /**
   * Перезагрузка конфигураций
   */
  async reloadConfigs(): Promise<void> {
    this.logger.info('Reloading lighting configurations...');
    
    try {
      // В Phase 1 просто логируем
      // В будущих фазах будет реальная перезагрузка из файлов
      this.logger.info('Config reload would be implemented in Phase 2');
      
    } catch (error) {
      this.logger.error('Error reloading configs', { error });
    }
  }

  /**
   * Получение статистики рендеринга
   */
  getRenderStatistics(): RenderStatistics {
    return this.dmxRenderer.getStatistics();
  }

  /**
   * Получение состояния конкретного фикстура
   */
  getFixtureState(fixtureId: string): FixtureState | undefined {
    return this.attributeManager.getFixtureState(fixtureId);
  }

  /**
   * Обновление состояния фикстура вручную (для тестирования)
   */
  updateFixtureState(fixtureId: string, state: Partial<FixtureState>): void {
    this.attributeManager.updateFixtureState(fixtureId, state);
    this.logger.info('Fixture state manually updated', { fixtureId, state });
  }

  /**
   * Сброс всех состояний к значениям по умолчанию
   */
  resetAllStates(): void {
    this.attributeManager.resetAll();
    this.logger.info('All fixture states reset to defaults');
  }

  /**
   * Проверка, инициализирован ли фасад
   */
  isFacadeInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Загрузка mock конфигурации для Phase 1
   */
  private async loadMockConfiguration(): Promise<void> {
    // Mock профили фикстур
    const mockProfiles: FixtureProfile[] = [
      {
        id: 'beam-300',
        name: 'Beam 300',
        manufacturer: 'Generic',
        channels: [
          { name: 'dim', type: 'dim', channelIndex: 1 },
          { name: 'pan', type: 'position', channelIndex: 2 },
          { name: 'tilt', type: 'position', channelIndex: 3 },
          { name: 'color', type: 'color', channelIndex: 4 }
        ],
        capabilities: ['dim', 'color', 'position']
      },
      {
        id: 'wash-200',
        name: 'Wash 200',
        manufacturer: 'Generic',
        channels: [
          { name: 'dim', type: 'dim', channelIndex: 1 },
          { name: 'color', type: 'color', channelIndex: 2 }
        ],
        capabilities: ['dim', 'color']
      }
    ];
    
    // Mock patch конфигурация
    // Используем числовые ID для совместимости с типом PatchConfig
    const mockPatch: PatchConfig = {
      fixtures: [
        {
          id: '1', // Числовой ID как строка
          name: 'Beam 1',
          universe: 1,
          startAddress: 1,
          profileId: 'beam-300',
          groupId: 'BEAMS'
        },
        {
          id: '2',
          name: 'Beam 2',
          universe: 1,
          startAddress: 5,
          profileId: 'beam-300',
          groupId: 'BEAMS'
        },
        {
          id: '3',
          name: 'Wash 1',
          universe: 1,
          startAddress: 9,
          profileId: 'wash-200',
          groupId: 'WASHES'
        },
        {
          id: '4',
          name: 'Wash 2',
          universe: 1,
          startAddress: 11,
          profileId: 'wash-200',
          groupId: 'WASHES'
        }
      ],
      groups: {
        'BEAMS': ['1', '2'],
        'WASHES': ['3', '4']
      },
      universes: {
        1: [1, 2, 3, 4] // Числовые ID фикстур
      }
    };
    
    // Загрузка профилей и patch
    this.patchManager.loadProfiles(mockProfiles);
    this.patchManager.loadPatch(mockPatch);
    
    this.logger.info('Mock configuration loaded', {
      profileCount: mockProfiles.length,
      fixtureCount: mockPatch.fixtures.length
    });
  }

  /**
   * Создание пустого вывода при ошибке
   */
  private createEmptyOutput(): LightingOutput {
    return {
      universeFrames: [],
      fixtureStates: new Map()
    };
  }
}