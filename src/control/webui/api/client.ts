/**
 * API Client for REST API and WebSocket integration
 */

import { extendedStore } from '../store/store-extended';
import { ConfigAPIClient, ConfigNode, ConfigTemplate, ConfigValidationResult, ConfigVersion, ConfigDiff, ConfigBackup, ConfigImportExportOptions } from '../types/config';
import { SecurityAPIClient, LoginCredentials, RegisterData, PasswordResetRequest, PasswordResetConfirm, User, Role, Permission, AuthToken, AuditLogEntry, SecuritySettings } from '../types/security';

export interface APIConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  enableWebSocket: boolean;
  webSocketUrl: string;
}

export interface APIRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  data?: any;
  headers?: Record<string, string>;
  retry?: boolean;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export class APIClient implements ConfigAPIClient, SecurityAPIClient {
  private config: APIConfig;
  private ws: WebSocket | null = null;
  private wsReconnectTimer: any = null;
  private wsReconnectAttempts = 0;
  private wsMessageHandlers: Map<string, Array<(data: any) => void>> = new Map();
  private requestQueue: Array<{
    id: string;
    options: APIRequestOptions;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    retries: number;
  }> = [];
  private isProcessingQueue = false;
  
  constructor(config: Partial<APIConfig> = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:3000',
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      enableWebSocket: config.enableWebSocket !== false,
      webSocketUrl: config.webSocketUrl || 'ws://localhost:3000/ws'
    };
    
    this.initialize();
  }
  
  private initialize(): void {
    // Update store with API config
    extendedStore.setState({
      api: {
        ...extendedStore.getState().api,
        baseUrl: this.config.baseUrl
      }
    });
    
    // Setup WebSocket if enabled
    if (this.config.enableWebSocket) {
      this.setupWebSocket();
    }
    
    // Start processing request queue
    this.processRequestQueue();
    
    // Setup offline detection
    this.setupOfflineDetection();
  }
  
  private async request<T>(options: APIRequestOptions): Promise<T> {
    const state = extendedStore.getState();
    
    // Check if we're offline
    if (!state.mobile.isOnline && !options.retry) {
      throw new Error('Network is offline');
    }
    
    // Generate request ID
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      // Add to queue
      this.requestQueue.push({
        id: requestId,
        options,
        resolve,
        reject,
        retries: 0
      });
      
      // Update store
      extendedStore.setPendingRequests(this.requestQueue.length);
      
      // Trigger queue processing
      if (!this.isProcessingQueue) {
        this.processRequestQueue();
      }
    });
  }
  
  private async processRequestQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()!;
      
      try {
        const result = await this.executeRequest(request.options);
        request.resolve(result);
      } catch (error) {
        // Check if we should retry
        if (request.retries < this.config.retryAttempts && this.shouldRetry(error)) {
          request.retries++;
          
          // Re-add to queue with delay
          setTimeout(() => {
            this.requestQueue.unshift(request);
            this.processRequestQueue();
          }, this.config.retryDelay * request.retries);
        } else {
          request.reject(error);
          
          // Log error to store
          extendedStore.addApiError({
            endpoint: request.options.path,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      // Update store
      extendedStore.setPendingRequests(this.requestQueue.length);
      
      // Small delay between requests to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    this.isProcessingQueue = false;
  }
  
  private async executeRequest<T>(options: APIRequestOptions): Promise<T> {
    const state = extendedStore.getState();
    const url = `${this.config.baseUrl}${options.path}`;
    
    // Get auth token if available
    const token = state.security.auth.token?.accessToken;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    
    try {
      const response = await fetch(url, {
        method: options.method,
        headers,
        body: options.data ? JSON.stringify(options.data) : undefined,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Update last sync time
      extendedStore.setState({
        api: {
          ...state.api,
          lastSync: Date.now()
        }
      });
      
      if (!response.ok) {
        // Handle authentication errors
        if (response.status === 401) {
          extendedStore.setAuthState({
            isAuthenticated: false,
            user: null,
            token: null,
            error: 'Session expired. Please login again.'
          });
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result: APIResponse<T> = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'API request failed');
      }
      
      return result.data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Check if it's a network error
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        extendedStore.setApiConnected(false);
        throw new Error('Network error: Unable to connect to server');
      }
      
      throw error;
    }
  }
  
  private shouldRetry(error: any): boolean {
    // Retry on network errors, timeouts, and server errors
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      return true;
    }
    
    if (error.name === 'AbortError') {
      return true; // Timeout
    }
    
    if (error.message && error.message.includes('Network error')) {
      return true;
    }
    
    // Don't retry on 4xx errors (except 429 - rate limit)
    if (error.message && error.message.includes('HTTP 4')) {
      return error.message.includes('HTTP 429'); // Rate limit
    }
    
    return false;
  }
  
  // ========== WebSocket Methods ==========
  
  private setupWebSocket(): void {
    this.connectWebSocket();
  }
  
  private connectWebSocket(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }
    
    try {
      this.ws = new WebSocket(this.config.webSocketUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.wsReconnectAttempts = 0;
        extendedStore.setWebSocketConnected(true);
        
        // Send authentication if available
        const token = extendedStore.getState().security.auth.token?.accessToken;
        if (token) {
          this.sendWebSocketMessage('auth', { token });
        }
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        extendedStore.setWebSocketConnected(false);
        this.scheduleWebSocketReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        extendedStore.setWebSocketConnected(false);
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.scheduleWebSocketReconnect();
    }
  }
  
  private scheduleWebSocketReconnect(): void {
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
    }
    
    this.wsReconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.wsReconnectAttempts), 30000);
    
    this.wsReconnectTimer = setTimeout(() => {
      this.connectWebSocket();
    }, delay);
  }
  
  private sendWebSocketMessage(type: string, data: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot send message');
      return;
    }
    
    try {
      const message = JSON.stringify({ type, data, timestamp: Date.now() });
      this.ws.send(message);
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
    }
  }
  
  private handleWebSocketMessage(message: any): void {
    const { type, data } = message;
    
    // Update last message time
    extendedStore.setState({
      api: {
        ...extendedStore.getState().api,
        websocket: {
          ...extendedStore.getState().api.websocket,
          lastMessage: Date.now()
        }
      }
    });
    
    // Call registered handlers
    const handlers = this.wsMessageHandlers.get(type) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`WebSocket handler error for type ${type}:`, error);
      }
    });
    
    // Handle specific message types
    switch (type) {
      case 'system_update':
        this.handleSystemUpdate(data);
        break;
      case 'audio_data':
        this.handleAudioData(data);
        break;
      case 'dmx_data':
        this.handleDMXData(data);
        break;
      case 'config_update':
        this.handleConfigUpdate(data);
        break;
      case 'auth_required':
        this.handleAuthRequired(data);
        break;
    }
  }
  
  private handleSystemUpdate(data: any): void {
    extendedStore.updateSystemMetrics({
      cpu: data.cpu || 0,
      memory: data.memory || 0,
      fps: data.fps || 0,
      networkLatency: data.networkLatency || 0
    });
  }
  
  private handleAudioData(data: any): void {
    extendedStore.updateAudioData({
      waveform: data.waveform || [],
      spectrum: data.spectrum || [],
      peaks: data.peaks || []
    });
    
    extendedStore.updateAudioMetrics({
      energy: data.energy || 0,
      isBeat: data.isBeat || false,
      bpm: data.bpm,
      frequencyBands: data.frequencyBands,
      mood: data.mood
    });
  }
  
  private handleDMXData(data: any): void {
    extendedStore.updateDMXData({
      channels: data.channels || new Array(512).fill(0),
      fixtures: data.fixtures || []
    });
  }
  
  private handleConfigUpdate(data: any): void {
    // Notify config editor if open
    console.log('Config updated:', data);
  }
  
  private handleAuthRequired(data: any): void {
    // Try to re-authenticate
    const token = extendedStore.getState().security.auth.token?.accessToken;
    if (token) {
      this.sendWebSocketMessage('auth', { token });
    }
  }
  
  subscribeWebSocket(type: string, handler: (data: any) => void): () => void {
    if (!this.wsMessageHandlers.has(type)) {
      this.wsMessageHandlers.set(type, []);
    }
    
    const handlers = this.wsMessageHandlers.get(type)!;
    handlers.push(handler);
    
    return () => {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }
  
  // ========== Offline Detection ==========
  
  private setupOfflineDetection(): void {
    window.addEventListener('online', () => {
      extendedStore.setOnlineStatus(true, 'wifi');
      extendedStore.setApiConnected(true);
      
      // Try to reconnect WebSocket
      if (this.config.enableWebSocket) {
        this.connectWebSocket();
      }
      
      // Process any queued requests
      this.processRequestQueue();
    });
    
    window.addEventListener('offline', () => {
      extendedStore.setOnlineStatus(false, 'offline');
      extendedStore.setApiConnected(false);
    });
  }
  
  // ========== Configuration API Methods ==========
  
  async getConfig(path: string): Promise<ConfigNode> {
    return this.request({
      method: 'GET',
      path: `/api/config${path}`
    });
  }
  
  async saveConfig(path: string, data: ConfigNode): Promise<void> {
    return this.request({
      method: 'POST',
      path: `/api/config${path}`,
      data
    });
  }
  
  async validateConfig(data: ConfigNode): Promise<ConfigValidationResult> {
    return this.request({
      method: 'POST',
      path: '/api/config/validate',
      data
    });
  }
  
  async getTemplates(): Promise<ConfigTemplate[]> {
    return this.request({
      method: 'GET',
      path: '/api/config/templates'
    });
  }
  
  async getTemplate(id: string): Promise<ConfigTemplate> {
    return this.request({
      method: 'GET',
      path: `/api/config/templates/${id}`
    });
  }
  
  async createTemplate(template: Omit<ConfigTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<ConfigTemplate> {
    return this.request({
      method: 'POST',
      path: '/api/config/templates',
      data: template
    });
  }
  
  async getVersions(configId: string): Promise<ConfigVersion[]> {
    return this.request({
      method: 'GET',
      path: `/api/config/${configId}/versions`
    });
  }
  
  async getVersion(configId: string, version: number): Promise<ConfigVersion> {
    return this.request({
      method: 'GET',
      path: `/api/config/${configId}/versions/${version}`
    });
  }
  
  async compareVersions(configId: string, version1: number, version2: number): Promise<ConfigDiff[]> {
    return this.request({
      method: 'GET',
      path: `/api/config/${configId}/compare/${version1}/${version2}`
    });
  }
  
  async importConfig(file: File, options: ConfigImportExportOptions): Promise<ConfigNode> {
    // For file upload, we need to use FormData
    const formData = new FormData();
    formData.append('file', file);
    formData.append('options', JSON.stringify(options));
    
    return this.request({
      method: 'POST',
      path: '/api/config/import',
      data: formData,
      headers: {
        // Don't set Content-Type, let browser set it with boundary
      }
    });
  }
  
  async exportConfig(configId: string, options: ConfigImportExportOptions): Promise<Blob> {
    const response = await fetch(`${this.config.baseUrl}/api/config/${configId}/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${extendedStore.getState().security.auth.token?.accessToken}`
      },
      body: JSON.stringify(options)
    });
    
    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }
    
    return response.blob();
  }
  
  async createBackup(options: Partial<ConfigBackup>): Promise<ConfigBackup> {
    return this.request({
      method: 'POST',
      path: '/api/config/backup',
      data: options
    });
  }
  
  async restoreBackup(backupId: string): Promise<void> {
    return this.request({
      method: 'POST',
      path: `/api/config/backup/${backupId}/restore`
    });
  }
  
  async getBackups(): Promise<ConfigBackup[]> {
    return this.request({
      method: 'GET',
      path: '/api/config/backups'
    });
  }
  
  async deleteBackup(backupId: string): Promise<void> {
    return this.request({
      method: 'DELETE',
      path: `/api/config/backup/${backupId}`
    });
  }
  
  // ========== Security API Methods ==========
  
  async login(credentials: LoginCredentials): Promise<AuthToken> {
    const token = await this.request<AuthToken>({
      method: 'POST',
      path: '/api/auth/login',
      data: credentials
    });
    
    // Update store
    extendedStore.setAuthState({
      isAuthenticated: true,
      token,
      error: null
    });
    
    // Reconnect WebSocket with new token
    if (this.config.enableWebSocket) {
      this.connectWebSocket();
    }
    
    return token;
  }
  
  async logout(): Promise<void> {
    try {
      await this.request({
        method: 'POST',
        path: '/api/auth/logout'
      });
    } finally {
      // Always clear local auth state
      extendedStore.setAuthState({
        isAuthenticated: false,
        user: null,
        token: null,
        error: null
      });
      
      // Close WebSocket
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
    }
  }
  
  async refreshToken(refreshToken: string): Promise<AuthToken> {
    return this.request({
      method: 'POST',
      path: '/api/auth/refresh',
      data: { refreshToken }
    });
  }
  
  async register(data: RegisterData): Promise<User> {
    return this.request({
      method: 'POST',
      path: '/api/auth/register',
      data
    });
  }
  
  async verifyEmail(token: string): Promise<void> {
    return this.request({
      method: 'POST',
      path: '/api/auth/verify-email',
      data: { token }
    });
  }
  
  async requestPasswordReset(email: string): Promise<void> {
    return this.request({
      method: 'POST',
      path: '/api/auth/password-reset',
      data: { email }
    });
  }
  
  async resetPassword(data: PasswordResetConfirm): Promise<void> {
    return this.request({
      method: 'POST',
      path: '/api/auth/password-reset/confirm',
      data
    });
  }
  
  async getCurrentUser(): Promise<User> {
    const user = await this.request<User>({
      method: 'GET',
      path: '/api/auth/me'
    });
    
    // Update store
    extendedStore.setUser(user);
    
    return user;
  }
  
  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    const user = await this.request<User>({
      method: 'PATCH',
      path: `/api/users/${userId}`,
      data: updates
    });
    
    // Update store if it's the current user
    const state = extendedStore.getState();
    if (state.security.auth.user?.id === userId) {
      extendedStore.setUser(user);
    }
    
    return user;
  }
  
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    return this.request({
      method: 'POST',
      path: `/api/users/${userId}/change-password`,
      data: { oldPassword, newPassword }
    });
  }
  
  // ========== User Management Methods ==========
  
  async getUsers(filter?: any, pagination?: any): Promise<{ users: User[]; total: number }> {
    const params = new URLSearchParams();
    
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, String(value));
        }
      });
    }
    
    if (pagination) {
      params.append('page', String(pagination.page || 1));
      params.append('pageSize', String(pagination.pageSize || 20));
    }
    
    const query = params.toString();
    const path = query ? `/api/users?${query}` : '/api/users';
    
    return this.request({
      method: 'GET',
      path
    });
  }
  
  async getUser(userId: string): Promise<User> {
    return this.request({
      method: 'GET',
      path: `/api/users/${userId}`
    });
  }
  
  async createUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    return this.request({
      method: 'POST',
      path: '/api/users',
      data: user
    });
  }
  
  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    return this.request({
      method: 'PATCH',
      path: `/api/users/${userId}`,
      data: updates
    });
  }
  
  async deleteUser(userId: string): Promise<void> {
    return this.request({
      method: 'DELETE',
      path: `/api/users/${userId}`
    });
  }
  
  async activateUser(userId: string): Promise<void> {
    return this.request({
      method: 'POST',
      path: `/api/users/${userId}/activate`
    });
  }
  
  async deactivateUser(userId: string): Promise<void> {
    return this.request({
      method: 'POST',
      path: `/api/users/${userId}/deactivate`
    });
  }
  
  // ========== Role Management Methods ==========
  
  async getRoles(): Promise<Role[]> {
    return this.request({
      method: 'GET',
      path: '/api/roles'
    });
  }
  
  async getRole(roleId: string): Promise<Role> {
    return this.request({
      method: 'GET',
      path: `/api/roles/${roleId}`
    });
  }
  
  async createRole(role: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Promise<Role> {
    return this.request({
      method: 'POST',
      path: '/api/roles',
      data: role
    });
  }
  
  async updateRole(roleId: string, updates: Partial<Role>): Promise<Role> {
    return this.request({
      method: 'PATCH',
      path: `/api/roles/${roleId}`,
      data: updates
    });
  }
  
  async deleteRole(roleId: string): Promise<void> {
    return this.request({
      method: 'DELETE',
      path: `/api/roles/${roleId}`
    });
  }
  
  async assignRole(userId: string, roleId: string): Promise<void> {
    return this.request({
      method: 'POST',
      path: `/api/users/${userId}/roles/${roleId}`
    });
  }
  
  async removeRole(userId: string, roleId: string): Promise<void> {
    return this.request({
      method: 'DELETE',
      path: `/api/users/${userId}/roles/${roleId}`
    });
  }
  
  // ========== Permission Management Methods ==========
  
  async getPermissions(): Promise<Permission[]> {
    return this.request({
      method: 'GET',
      path: '/api/permissions'
    });
  }
  
  async getPermission(permissionId: string): Promise<Permission> {
    return this.request({
      method: 'GET',
      path: `/api/permissions/${permissionId}`
    });
  }
  
  async createPermission(permission: Omit<Permission, 'id' | 'createdAt'>): Promise<Permission> {
    return this.request({
      method: 'POST',
      path: '/api/permissions',
      data: permission
    });
  }
  
  async updatePermission(permissionId: string, updates: Partial<Permission>): Promise<Permission> {
    return this.request({
      method: 'PATCH',
      path: `/api/permissions/${permissionId}`,
      data: updates
    });
  }
  
  async deletePermission(permissionId: string): Promise<void> {
    return this.request({
      method: 'DELETE',
      path: `/api/permissions/${permissionId}`
    });
  }
  
  async assignPermission(roleId: string, permissionId: string): Promise<void> {
    return this.request({
      method: 'POST',
      path: `/api/roles/${roleId}/permissions/${permissionId}`
    });
  }
  
  async removePermission(roleId: string, permissionId: string): Promise<void> {
    return this.request({
      method: 'DELETE',
      path: `/api/roles/${roleId}/permissions/${permissionId}`
    });
  }
  
  // ========== Audit Log Methods ==========
  
  async getAuditLog(filter?: any, pagination?: any): Promise<{ entries: AuditLogEntry[]; total: number }> {
    const params = new URLSearchParams();
    
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, String(value));
        }
      });
    }
    
    if (pagination) {
      params.append('page', String(pagination.page || 1));
      params.append('pageSize', String(pagination.pageSize || 50));
    }
    
    const query = params.toString();
    const path = query ? `/api/audit?${query}` : '/api/audit';
    
    return this.request({
      method: 'GET',
      path
    });
  }
  
  async getAuditEntry(entryId: string): Promise<AuditLogEntry> {
    return this.request({
      method: 'GET',
      path: `/api/audit/${entryId}`
    });
  }
  
  async exportAuditLog(format: 'json' | 'csv'): Promise<Blob> {
    const response = await fetch(`${this.config.baseUrl}/api/audit/export?format=${format}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${extendedStore.getState().security.auth.token?.accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }
    
    return response.blob();
  }
  
  // ========== Security Settings Methods ==========
  
  async getSecuritySettings(): Promise<SecuritySettings> {
    return this.request({
      method: 'GET',
      path: '/api/security/settings'
    });
  }
  
  async updateSecuritySettings(settings: Partial<SecuritySettings>): Promise<SecuritySettings> {
    return this.request({
      method: 'PATCH',
      path: '/api/security/settings',
      data: settings
    });
  }
  
  // ========== Health & Diagnostics Methods ==========
  
  async getSecurityHealth(): Promise<{
    auth: boolean;
    database: boolean;
    encryption: boolean;
    auditLog: boolean;
    lastCheck: number;
  }> {
    return this.request({
      method: 'GET',
      path: '/api/security/health'
    });
  }
}

// Export singleton instance
let apiClientInstance: APIClient | null = null;

export function getAPIClient(config?: Partial<APIConfig>): APIClient {
  if (!apiClientInstance) {
    apiClientInstance = new APIClient(config);
  }
  return apiClientInstance;
}

export function initializeAPI(config?: Partial<APIConfig>): APIClient {
  apiClientInstance = new APIClient(config);
  return apiClientInstance;
}

// Hook-like function for components
export function useAPI(): APIClient {
  return getAPIClient();
}