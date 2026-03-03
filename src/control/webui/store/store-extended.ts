/**
 * Extended state management for DMX Engine UI with configuration and security support
 */

import { UISystemState, AudioMetrics, SocketState } from '../types/ui';
import { SystemMode } from '../../../engine/types';
import { SceneDefinition, EffectDescriptor, SceneRule } from '../../../brain/types';
import { ConfigEditorState, ConfigNode, ConfigSchema, ConfigTemplate, ConfigValidationResult } from '../types/config';
import { AuthState, UserManagementState, AuditLogState, SecuritySettings, User, Role, Permission, AuthToken, AuditLogEntry } from '../types/security';

export interface AppState {
  system: UISystemState;
  audio: AudioMetrics;
  socket: SocketState;
  ui: {
    theme: 'dark' | 'light';
    layout: 'compact' | 'expanded' | 'dashboard' | 'mobile';
    showDebug: boolean;
    currentPage: 'home' | 'audio' | 'dmx' | 'scenes' | 'effects' | 'fixtures' | 'rules' | 'settings' | 'config' | 'security' | 'users' | 'audit';
    sidebarCollapsed: boolean;
    isMobile: boolean;
    touchOptimized: boolean;
    offlineMode: boolean;
  };
  
  // Editor state
  editor: {
    // Scene editor
    currentScene: SceneDefinition | null;
    sceneDirty: boolean;
    sceneHistory: SceneDefinition[];
    
    // Effect editor
    currentEffect: EffectDescriptor | null;
    effectDirty: boolean;
    
    // Fixture manager
    currentPatch: any | null;
    patchDirty: boolean;
    
    // Rule editor
    currentRule: SceneRule | null;
    rulesDirty: boolean;
    
    // Undo/redo state
    canUndo: boolean;
    canRedo: boolean;
    lastSaveTime: number;
    
    // Drag and drop
    isDragging: boolean;
    dragPayload: any | null;
    
    // Preview state
    previewActive: boolean;
    previewSceneId: string | null;
    previewTime: number;
  };
  
  // Configuration editor state
  config: ConfigEditorState & {
    // Extended config state
    backups: Array<{
      id: string;
      name: string;
      timestamp: number;
      size: number;
    }>;
    importExport: {
      isImporting: boolean;
      isExporting: boolean;
      progress: number;
      error: string | null;
    };
    diagnostics: {
      lastCheck: number;
      health: 'healthy' | 'warning' | 'error';
      issues: Array<{
        id: string;
        severity: 'error' | 'warning' | 'info';
        message: string;
        component: string;
        timestamp: number;
      }>;
    };
  };
  
  // Security state
  security: {
    auth: AuthState;
    users: UserManagementState;
    audit: AuditLogState;
    settings: SecuritySettings;
    permissions: {
      available: Permission[];
      userPermissions: string[];
      rolePermissions: Record<string, string[]>;
    };
  };
  
  // Real-time data
  realtime: {
    audioData: {
      waveform: number[];
      spectrum: number[];
      peaks: number[];
    };
    dmxData: {
      channels: number[];
      fixtures: Array<{
        id: number;
        name: string;
        values: number[];
      }>;
    };
    systemMetrics: {
      cpu: number;
      memory: number;
      fps: number;
      networkLatency: number;
    };
  };
  
  // API connection state
  api: {
    baseUrl: string;
    isConnected: boolean;
    lastSync: number;
    pendingRequests: number;
    errors: Array<{
      id: string;
      timestamp: number;
      endpoint: string;
      error: string;
      retryCount: number;
    }>;
    websocket: {
      isConnected: boolean;
      lastMessage: number;
      reconnectAttempts: number;
    };
  };
  
  // Mobile/offline state
  mobile: {
    isOnline: boolean;
    connectionType: 'wifi' | 'cellular' | 'ethernet' | 'offline';
    batteryLevel: number;
    isCharging: boolean;
    storage: {
      used: number;
      available: number;
      quota: number;
    };
    cachedData: {
      configs: number;
      scenes: number;
      fixtures: number;
      lastSync: number;
    };
  };
}

type Listener = (state: AppState) => void;
type Unsubscribe = () => void;

class ExtendedStore {
  private state: AppState;
  private listeners: Listener[] = [];

  constructor() {
    // Initial state
    this.state = this.getInitialState();
  }

  private getInitialState(): AppState {
    return {
      system: {
        mode: 'manual' as SystemMode,
        globalIntensity: 0.5,
        blackout: false,
        activeStyleId: undefined,
        activeSceneId: undefined,
        manualOverrides: new Map(),
        lastUserActivity: Date.now(),
        uiTheme: 'dark',
        uiLayout: 'compact',
        showDebugPanel: false,
        showAudioMetrics: true,
      },
      audio: {
        energy: 0,
        isBeat: false,
        bpm: undefined,
        frequencyBands: undefined,
        mood: undefined,
      },
      socket: {
        isConnected: false,
        lastPing: undefined,
        latency: undefined,
        error: undefined,
      },
      ui: {
        theme: 'dark',
        layout: 'compact',
        showDebug: false,
        currentPage: 'home',
        sidebarCollapsed: false,
        isMobile: false,
        touchOptimized: false,
        offlineMode: false,
      },
      editor: {
        currentScene: null,
        sceneDirty: false,
        sceneHistory: [],
        
        currentEffect: null,
        effectDirty: false,
        
        currentPatch: null,
        patchDirty: false,
        
        currentRule: null,
        rulesDirty: false,
        
        canUndo: false,
        canRedo: false,
        lastSaveTime: 0,
        
        isDragging: false,
        dragPayload: null,
        
        previewActive: false,
        previewSceneId: null,
        previewTime: 0,
      },
      config: {
        currentConfig: null,
        schema: null,
        templates: [],
        selectedTemplate: null,
        validationResult: null,
        isDirty: false,
        isLoading: false,
        error: null,
        viewMode: 'tree',
        expandedPaths: [],
        selectedPath: null,
        searchQuery: '',
        filter: {
          category: undefined,
          type: undefined,
          requiredOnly: false,
          modifiedOnly: false,
        },
        history: {
          past: [],
          future: [],
          currentIndex: -1,
        },
        backups: [],
        importExport: {
          isImporting: false,
          isExporting: false,
          progress: 0,
          error: null,
        },
        diagnostics: {
          lastCheck: 0,
          health: 'healthy',
          issues: [],
        },
      },
      security: {
        auth: {
          isAuthenticated: false,
          user: null,
          token: null,
          isLoading: false,
          error: null,
          lastActivity: Date.now(),
          sessionExpiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        },
        users: {
          users: [],
          roles: [],
          permissions: [],
          selectedUser: null,
          selectedRole: null,
          isLoading: false,
          error: null,
          filter: {
            search: '',
            role: '',
            status: 'all',
          },
          pagination: {
            page: 1,
            pageSize: 20,
            total: 0,
          },
        },
        audit: {
          entries: [],
          isLoading: false,
          error: null,
          filter: {
            startDate: undefined,
            endDate: undefined,
            userId: undefined,
            action: undefined,
            resource: undefined,
            status: undefined,
            search: undefined,
          },
          pagination: {
            page: 1,
            pageSize: 50,
            total: 0,
          },
        },
        settings: {
          auth: {
            enabled: true,
            requireEmailVerification: false,
            allowRegistration: true,
            allowSocialLogin: false,
            sessionTimeout: 120, // minutes
            maxLoginAttempts: 5,
            lockoutDuration: 15, // minutes
            passwordPolicy: {
              minLength: 8,
              requireUppercase: true,
              requireLowercase: true,
              requireNumbers: true,
              requireSpecialChars: true,
              preventCommonPasswords: true,
            },
          },
          permissions: {
            defaultRole: 'user',
            enableRBAC: true,
            enableABAC: false,
            auditLogRetention: 90, // days
          },
          network: {
            enableCORS: true,
            allowedOrigins: ['*'],
            enableRateLimiting: true,
            rateLimit: {
              requestsPerMinute: 60,
              burstLimit: 100,
            },
            enableIPWhitelist: false,
            allowedIPs: [],
          },
          encryption: {
            algorithm: 'aes-256-gcm',
            keyRotationInterval: 90, // days
          },
        },
        permissions: {
          available: [],
          userPermissions: [],
          rolePermissions: {},
        },
      },
      realtime: {
        audioData: {
          waveform: [],
          spectrum: [],
          peaks: [],
        },
        dmxData: {
          channels: new Array(512).fill(0),
          fixtures: [],
        },
        systemMetrics: {
          cpu: 0,
          memory: 0,
          fps: 0,
          networkLatency: 0,
        },
      },
      api: {
        baseUrl: 'http://localhost:3000',
        isConnected: false,
        lastSync: 0,
        pendingRequests: 0,
        errors: [],
        websocket: {
          isConnected: false,
          lastMessage: 0,
          reconnectAttempts: 0,
        },
      },
      mobile: {
        isOnline: true,
        connectionType: 'wifi',
        batteryLevel: 100,
        isCharging: false,
        storage: {
          used: 0,
          available: 0,
          quota: 0,
        },
        cachedData: {
          configs: 0,
          scenes: 0,
          fixtures: 0,
          lastSync: 0,
        },
      },
    };
  }

  getState(): AppState {
    return { ...this.state };
  }

  setState(updater: Partial<AppState> | ((state: AppState) => Partial<AppState>)): void {
    const newPartialState = typeof updater === 'function' ? updater(this.state) : updater;
    
    this.state = {
      ...this.state,
      ...newPartialState,
    };

    this.notifyListeners();
  }

  // ========== System State Methods ==========
  
  updateSystemState(updates: Partial<UISystemState>): void {
    this.setState({
      system: {
        ...this.state.system,
        ...updates,
      },
    });
  }

  updateAudioMetrics(updates: Partial<AudioMetrics>): void {
    this.setState({
      audio: {
        ...this.state.audio,
        ...updates,
      },
    });
  }

  updateSocketState(updates: Partial<SocketState>): void {
    this.setState({
      socket: {
        ...this.state.socket,
        ...updates,
      },
    });
  }

  // ========== UI State Methods ==========
  
  setTheme(theme: 'dark' | 'light'): void {
    this.setState({
      ui: {
        ...this.state.ui,
        theme,
      },
    });
  }

  setLayout(layout: 'compact' | 'expanded' | 'dashboard' | 'mobile'): void {
    this.setState({
      ui: {
        ...this.state.ui,
        layout,
      },
    });
  }

  setCurrentPage(page: AppState['ui']['currentPage']): void {
    this.setState({
      ui: {
        ...this.state.ui,
        currentPage: page,
      },
    });
  }

  toggleSidebar(): void {
    this.setState({
      ui: {
        ...this.state.ui,
        sidebarCollapsed: !this.state.ui.sidebarCollapsed,
      },
    });
  }

  setMobileMode(isMobile: boolean): void {
    this.setState({
      ui: {
        ...this.state.ui,
        isMobile,
        touchOptimized: isMobile,
        layout: isMobile ? 'mobile' : this.state.ui.layout,
      },
    });
  }

  setOfflineMode(offline: boolean): void {
    this.setState({
      ui: {
        ...this.state.ui,
        offlineMode: offline,
      },
    });
  }

  // ========== Configuration Editor Methods ==========
  
  setCurrentConfig(config: ConfigNode | null): void {
    this.setState({
      config: {
        ...this.state.config,
        currentConfig: config,
        isDirty: config !== null,
      },
    });
  }

  setConfigSchema(schema: ConfigSchema | null): void {
    this.setState({
      config: {
        ...this.state.config,
        schema,
      },
    });
  }

  setConfigTemplates(templates: ConfigTemplate[]): void {
    this.setState({
      config: {
        ...this.state.config,
        templates,
      },
    });
  }

  setSelectedTemplate(templateId: string | null): void {
    this.setState({
      config: {
        ...this.state.config,
        selectedTemplate: templateId,
      },
    });
  }

  setConfigValidationResult(result: ConfigValidationResult | null): void {
    this.setState({
      config: {
        ...this.state.config,
        validationResult: result,
      },
    });
  }

  setConfigDirty(dirty: boolean): void {
    this.setState({
      config: {
        ...this.state.config,
        isDirty: dirty,
      },
    });
  }

  setConfigLoading(loading: boolean): void {
    this.setState({
      config: {
        ...this.state.config,
        isLoading: loading,
      },
    });
  }

  setConfigError(error: string | null): void {
    this.setState({
      config: {
        ...this.state.config,
        error,
      },
    });
  }

  setConfigViewMode(mode: 'tree' | 'form' | 'code' | 'diff'): void {
    this.setState({
      config: {
        ...this.state.config,
        viewMode: mode,
      },
    });
  }

  setExpandedPaths(paths: string[]): void {
    this.setState({
      config: {
        ...this.state.config,
        expandedPaths: paths,
      },
    });
  }

  setSelectedPath(path: string | null): void {
    this.setState({
      config: {
        ...this.state.config,
        selectedPath: path,
      },
    });
  }

  setConfigSearchQuery(query: string): void {
    this.setState({
      config: {
        ...this.state.config,
        searchQuery: query,
      },
    });
  }

  setConfigFilter(filter: Partial<AppState['config']['filter']>): void {
    this.setState({
      config: {
        ...this.state.config,
        filter: {
          ...this.state.config.filter,
          ...filter,
        },
      },
    });
  }

  addConfigHistory(config: ConfigNode): void {
    const past = [...this.state.config.history.past];
    const future: ConfigNode[] = [];
    
    past.push(config);
    
    this.setState({
      config: {
        ...this.state.config,
        history: {
          past,
          future,
          currentIndex: past.length - 1,
        },
      },
    });
  }

  undoConfig(): void {
    const { past, currentIndex } = this.state.config.history;
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      const config = past[newIndex];
      
      this.setState({
        config: {
          ...this.state.config,
          currentConfig: config,
          history: {
            ...this.state.config.history,
            currentIndex: newIndex,
          },
        },
      });
    }
  }

  redoConfig(): void {
    const { past, currentIndex } = this.state.config.history;
    if (currentIndex < past.length - 1) {
      const newIndex = currentIndex + 1;
      const config = past[newIndex];
      
      this.setState({
        config: {
          ...this.state.config,
          currentConfig: config,
          history: {
            ...this.state.config.history,
            currentIndex: newIndex,
          },
        },
      });
    }
  }

  // ========== Security Methods ==========
  
  setAuthState(auth: Partial<AuthState>): void {
    this.setState({
      security: {
        ...this.state.security,
        auth: {
          ...this.state.security.auth,
          ...auth,
        },
      },
    });
  }

  setUser(user: User | null): void {
    this.setState({
      security: {
        ...this.state.security,
        auth: {
          ...this.state.security.auth,
          user,
          isAuthenticated: !!user,
        },
      },
    });
  }

  setToken(token: AuthToken | null): void {
    this.setState({
      security: {
        ...this.state.security,
        auth: {
          ...this.state.security.auth,
          token,
        },
      },
    });
  }

  setUsers(users: User[]): void {
    this.setState({
      security: {
        ...this.state.security,
        users: {
          ...this.state.security.users,
          users,
        },
      },
    });
  }

  setRoles(roles: Role[]): void {
    this.setState({
      security: {
        ...this.state.security,
        users: {
          ...this.state.security.users,
          roles,
        },
      },
    });
  }

  setPermissions(permissions: Permission[]): void {
    this.setState({
      security: {
        ...this.state.security,
        permissions: {
          ...this.state.security.permissions,
          available: permissions,
        },
      },
    });
  }

  setAuditEntries(entries: AuditLogEntry[]): void {
    this.setState({
      security: {
        ...this.state.security,
        audit: {
          ...this.state.security.audit,
          entries,
        },
      },
    });
  }

  setSecuritySettings(settings: Partial<SecuritySettings>): void {
    this.setState({
      security: {
        ...this.state.security,
        settings: {
          ...this.state.security.settings,
          ...settings,
        },
      },
    });
  }

  setUserPermissions(permissions: string[]): void {
    this.setState({
      security: {
        ...this.state.security,
        permissions: {
          ...this.state.security.permissions,
          userPermissions: permissions,
        },
      },
    });
  }

  setRolePermissions(roleId: string, permissions: string[]): void {
    this.setState({
      security: {
        ...this.state.security,
        permissions: {
          ...this.state.security.permissions,
          rolePermissions: {
            ...this.state.security.permissions.rolePermissions,
            [roleId]: permissions,
          },
        },
      },
    });
  }

  // ========== API Connection Methods ==========
  
  setApiConnected(connected: boolean): void {
    this.setState({
      api: {
        ...this.state.api,
        isConnected: connected,
      },
    });
  }

  setWebSocketConnected(connected: boolean): void {
    this.setState({
      api: {
        ...this.state.api,
        websocket: {
          ...this.state.api.websocket,
          isConnected: connected,
          reconnectAttempts: connected ? 0 : this.state.api.websocket.reconnectAttempts + 1,
        },
      },
    });
  }

  addApiError(error: { endpoint: string; error: string }): void {
    const errors = [...this.state.api.errors];
    errors.push({
      id: Date.now().toString(),
      timestamp: Date.now(),
      endpoint: error.endpoint,
      error: error.error,
      retryCount: 0,
    });

    // Keep only last 50 errors
    if (errors.length > 50) {
      errors.shift();
    }

    this.setState({
      api: {
        ...this.state.api,
        errors,
      },
    });
  }

  clearApiErrors(): void {
    this.setState({
      api: {
        ...this.state.api,
        errors: [],
      },
    });
  }

  setPendingRequests(count: number): void {
    this.setState({
      api: {
        ...this.state.api,
        pendingRequests: count,
      },
    });
  }

  // ========== Mobile/Offline Methods ==========
  
  setOnlineStatus(online: boolean, connectionType?: AppState['mobile']['connectionType']): void {
    this.setState({
      mobile: {
        ...this.state.mobile,
        isOnline: online,
        connectionType: connectionType || this.state.mobile.connectionType,
      },
    });
  }

  setBatteryStatus(level: number, charging: boolean): void {
    this.setState({
      mobile: {
        ...this.state.mobile,
        batteryLevel: level,
        isCharging: charging,
      },
    });
  }

  setStorageStatus(storage: Partial<AppState['mobile']['storage']>): void {
    this.setState({
      mobile: {
        ...this.state.mobile,
        storage: {
          ...this.state.mobile.storage,
          ...storage,
        },
      },
    });
  }

  updateCachedData(data: Partial<AppState['mobile']['cachedData']>): void {
    this.setState({
      mobile: {
        ...this.state.mobile,
        cachedData: {
          ...this.state.mobile.cachedData,
          ...data,
          lastSync: Date.now(),
        },
      },
    });
  }

  // ========== Real-time Data Methods ==========
  
  updateAudioData(data: Partial<AppState['realtime']['audioData']>): void {
    this.setState({
      realtime: {
        ...this.state.realtime,
        audioData: {
          ...this.state.realtime.audioData,
          ...data,
        },
      },
    });
  }

  updateDMXData(data: Partial<AppState['realtime']['dmxData']>): void {
    this.setState({
      realtime: {
        ...this.state.realtime,
        dmxData: {
          ...this.state.realtime.dmxData,
          ...data,
        },
      },
    });
  }

  updateSystemMetrics(metrics: Partial<AppState['realtime']['systemMetrics']>): void {
    this.setState({
      realtime: {
        ...this.state.realtime,
        systemMetrics: {
          ...this.state.realtime.systemMetrics,
          ...metrics,
        },
      },
    });
  }

  updateDMXChannel(channel: number, value: number): void {
    const channels = [...this.state.realtime.dmxData.channels];
    if (channel >= 1 && channel <= 512) {
      channels[channel - 1] = Math.max(0, Math.min(1, value));
      
      this.setState({
        realtime: {
          ...this.state.realtime,
          dmxData: {
            ...this.state.realtime.dmxData,
            channels,
          },
        },
      });
    }
  }

  // ========== Editor Methods (from original store) ==========
  
  setCurrentScene(scene: SceneDefinition | null): void {
    this.setState({
      editor: {
        ...this.state.editor,
        currentScene: scene,
        sceneDirty: scene !== null,
      },
    });
  }

  setSceneDirty(dirty: boolean): void {
    this.setState({
      editor: {
        ...this.state.editor,
        sceneDirty: dirty,
      },
    });
  }

  setCurrentEffect(effect: EffectDescriptor | null): void {
    this.setState({
      editor: {
        ...this.state.editor,
        currentEffect: effect,
        effectDirty: effect !== null,
      },
    });
  }

  setEffectDirty(dirty: boolean): void {
    this.setState({
      editor: {
        ...this.state.editor,
        effectDirty: dirty,
      },
    });
  }

  setCurrentPatch(patch: any | null): void {
    this.setState({
      editor: {
        ...this.state.editor,
        currentPatch: patch,
        patchDirty: patch !== null,
      },
    });
  }

  setPatchDirty(dirty: boolean): void {
    this.setState({
      editor: {
        ...this.state.editor,
        patchDirty: dirty,
      },
    });
  }

  setCurrentRule(rule: SceneRule | null): void {
    this.setState({
      editor: {
        ...this.state.editor,
        currentRule: rule,
        rulesDirty: rule !== null,
      },
    });
  }

  setRulesDirty(dirty: boolean): void {
    this.setState({
      editor: {
        ...this.state.editor,
        rulesDirty: dirty,
      },
    });
  }

  setUndoState(canUndo: boolean, canRedo: boolean): void {
    this.setState({
      editor: {
        ...this.state.editor,
        canUndo,
        canRedo,
      },
    });
  }

  setDragState(isDragging: boolean, payload: any = null): void {
    this.setState({
      editor: {
        ...this.state.editor,
        isDragging,
        dragPayload: payload,
      },
    });
  }

  setPreviewState(active: boolean, sceneId: string | null = null, time: number = 0): void {
    this.setState({
      editor: {
        ...this.state.editor,
        previewActive: active,
        previewSceneId: sceneId,
        previewTime: time,
      },
    });
  }

  saveEditorState(): void {
    this.setState({
      editor: {
        ...this.state.editor,
        sceneDirty: false,
        effectDirty: false,
        patchDirty: false,
        rulesDirty: false,
        lastSaveTime: Date.now(),
      },
    });
  }

  resetEditorState(): void {
    this.setState({
      editor: {
        currentScene: null,
        sceneDirty: false,
        sceneHistory: [],
        
        currentEffect: null,
        effectDirty: false,
        
        currentPatch: null,
        patchDirty: false,
        
        currentRule: null,
        rulesDirty: false,
        
        canUndo: false,
        canRedo: false,
        lastSaveTime: 0,
        
        isDragging: false,
        dragPayload: null,
        
        previewActive: false,
        previewSceneId: null,
        previewTime: 0,
      },
    });
  }

  // ========== Store Core Methods ==========
  
  subscribe(listener: Listener): Unsubscribe {
    this.listeners.push(listener);
    
    // Immediately call with current state
    listener(this.getState());

    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    const currentState = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(currentState);
      } catch (error) {
        console.error('Store listener error:', error);
      }
    });
  }

  // Action creators
  setMode(mode: SystemMode): void {
    this.updateSystemState({ mode });
  }

  setIntensity(intensity: number): void {
    this.updateSystemState({ globalIntensity: Math.max(0, Math.min(1, intensity)) });
  }

  setBlackout(blackout: boolean): void {
    this.updateSystemState({ blackout });
  }

  toggleDebug(): void {
    this.setState({
      ui: {
        ...this.state.ui,
        showDebug: !this.state.ui.showDebug,
      },
    });
  }

  toggleTheme(): void {
    const newTheme = this.state.ui.theme === 'dark' ? 'light' : 'dark';
    this.setState({
      ui: {
        ...this.state.ui,
        theme: newTheme,
      },
    });
  }
}

// Singleton store instance
export const extendedStore = new ExtendedStore();

// Hook-like function for React-like components (if needed)
export function useExtendedStore(): AppState {
  return extendedStore.getState();
}

// Selector functions
export const selectors = {
  // System selectors
  isConnected: (state: AppState) => state.socket.isConnected,
  getMode: (state: AppState) => state.system.mode,
  getIntensity: (state: AppState) => state.system.globalIntensity,
  isBlackout: (state: AppState) => state.system.blackout,
  getAudioEnergy: (state: AppState) => state.audio.energy,
  isBeat: (state: AppState) => state.audio.isBeat,
  
  // UI selectors
  getTheme: (state: AppState) => state.ui.theme,
  getLayout: (state: AppState) => state.ui.layout,
  showDebug: (state: AppState) => state.ui.showDebug,
  getCurrentPage: (state: AppState) => state.ui.currentPage,
  isSidebarCollapsed: (state: AppState) => state.ui.sidebarCollapsed,
  isMobile: (state: AppState) => state.ui.isMobile,
  isOfflineMode: (state: AppState) => state.ui.offlineMode,
  
  // Real-time data selectors
  getAudioWaveform: (state: AppState) => state.realtime.audioData.waveform,
  getAudioSpectrum: (state: AppState) => state.realtime.audioData.spectrum,
  getAudioPeaks: (state: AppState) => state.realtime.audioData.peaks,
  getDMXChannels: (state: AppState) => state.realtime.dmxData.channels,
  getDMXFixtures: (state: AppState) => state.realtime.dmxData.fixtures,
  getSystemMetrics: (state: AppState) => state.realtime.systemMetrics,
  
  // Derived selectors
  getActiveDMXChannels: (state: AppState) =>
    state.realtime.dmxData.channels.filter(value => value > 0.01).length,
  getAverageDMXValue: (state: AppState) => {
    const channels = state.realtime.dmxData.channels;
    if (channels.length === 0) return 0;
    const sum = channels.reduce((a, b) => a + b, 0);
    return sum / channels.length;
  },

  // Editor selectors
  getCurrentScene: (state: AppState) => state.editor.currentScene,
  isSceneDirty: (state: AppState) => state.editor.sceneDirty,
  getCurrentEffect: (state: AppState) => state.editor.currentEffect,
  isEffectDirty: (state: AppState) => state.editor.effectDirty,
  getCurrentPatch: (state: AppState) => state.editor.currentPatch,
  isPatchDirty: (state: AppState) => state.editor.patchDirty,
  getCurrentRule: (state: AppState) => state.editor.currentRule,
  isRulesDirty: (state: AppState) => state.editor.rulesDirty,
  canUndo: (state: AppState) => state.editor.canUndo,
  canRedo: (state: AppState) => state.editor.canRedo,
  isDragging: (state: AppState) => state.editor.isDragging,
  getDragPayload: (state: AppState) => state.editor.dragPayload,
  isPreviewActive: (state: AppState) => state.editor.previewActive,
  getPreviewSceneId: (state: AppState) => state.editor.previewSceneId,
  getPreviewTime: (state: AppState) => state.editor.previewTime,
  getLastSaveTime: (state: AppState) => state.editor.lastSaveTime,
  
  // Combined dirty state
  isAnyEditorDirty: (state: AppState) =>
    state.editor.sceneDirty ||
    state.editor.effectDirty ||
    state.editor.patchDirty ||
    state.editor.rulesDirty,

  // Configuration selectors
  getCurrentConfig: (state: AppState) => state.config.currentConfig,
  getConfigSchema: (state: AppState) => state.config.schema,
  getConfigTemplates: (state: AppState) => state.config.templates,
  getSelectedTemplate: (state: AppState) => state.config.selectedTemplate,
  getConfigValidationResult: (state: AppState) => state.config.validationResult,
  isConfigDirty: (state: AppState) => state.config.isDirty,
  isConfigLoading: (state: AppState) => state.config.isLoading,
  getConfigError: (state: AppState) => state.config.error,
  getConfigViewMode: (state: AppState) => state.config.viewMode,
  getExpandedPaths: (state: AppState) => state.config.expandedPaths,
  getSelectedPath: (state: AppState) => state.config.selectedPath,
  getConfigSearchQuery: (state: AppState) => state.config.searchQuery,
  getConfigFilter: (state: AppState) => state.config.filter,
  canUndoConfig: (state: AppState) => state.config.history.currentIndex > 0,
  canRedoConfig: (state: AppState) => state.config.history.currentIndex < state.config.history.past.length - 1,

  // Security selectors
  isAuthenticated: (state: AppState) => state.security.auth.isAuthenticated,
  getCurrentUser: (state: AppState) => state.security.auth.user,
  getAuthToken: (state: AppState) => state.security.auth.token,
  isAuthLoading: (state: AppState) => state.security.auth.isLoading,
  getAuthError: (state: AppState) => state.security.auth.error,
  getUsers: (state: AppState) => state.security.users.users,
  getRoles: (state: AppState) => state.security.users.roles,
  getPermissions: (state: AppState) => state.security.permissions.available,
  getUserPermissions: (state: AppState) => state.security.permissions.userPermissions,
  getAuditEntries: (state: AppState) => state.security.audit.entries,
  getSecuritySettings: (state: AppState) => state.security.settings,
  hasPermission: (state: AppState, permission: string) =>
    state.security.permissions.userPermissions.includes(permission) ||
    state.security.auth.user?.permissions?.includes(permission),

  // API selectors
  isApiConnected: (state: AppState) => state.api.isConnected,
  isWebSocketConnected: (state: AppState) => state.api.websocket.isConnected,
  getPendingRequests: (state: AppState) => state.api.pendingRequests,
  getApiErrors: (state: AppState) => state.api.errors,

  // Mobile selectors
  isOnline: (state: AppState) => state.mobile.isOnline,
  getConnectionType: (state: AppState) => state.mobile.connectionType,
  getBatteryLevel: (state: AppState) => state.mobile.batteryLevel,
  isCharging: (state: AppState) => state.mobile.isCharging,
  getStorageStatus: (state: AppState) => state.mobile.storage,
  getCachedData: (state: AppState) => state.mobile.cachedData,
};