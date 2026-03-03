/**
 * Security types for authentication and authorization
 */

export interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  avatar?: string;
  roles: string[];
  permissions: string[];
  isActive: boolean;
  isVerified: boolean;
  lastLogin?: number;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, any>;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Permission {
  id: string;
  name: string;
  description?: string;
  category: 'system' | 'config' | 'control' | 'monitoring' | 'admin';
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'execute';
  scope?: 'own' | 'all' | 'team';
  isSystem: boolean;
  createdAt: number;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  expiresAt: number;
}

export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  displayName?: string;
  inviteCode?: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  userId?: string;
  username?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failure' | 'warning';
  error?: string;
}

export interface SecuritySettings {
  auth: {
    enabled: boolean;
    requireEmailVerification: boolean;
    allowRegistration: boolean;
    allowSocialLogin: boolean;
    sessionTimeout: number; // minutes
    maxLoginAttempts: number;
    lockoutDuration: number; // minutes
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
      preventCommonPasswords: boolean;
    };
  };
  permissions: {
    defaultRole: string;
    enableRBAC: boolean;
    enableABAC: boolean;
    auditLogRetention: number; // days
  };
  network: {
    enableCORS: boolean;
    allowedOrigins: string[];
    enableRateLimiting: boolean;
    rateLimit: {
      requestsPerMinute: number;
      burstLimit: number;
    };
    enableIPWhitelist: boolean;
    allowedIPs: string[];
  };
  encryption: {
    algorithm: string;
    keyRotationInterval: number; // days
  };
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: AuthToken | null;
  isLoading: boolean;
  error: string | null;
  lastActivity: number;
  sessionExpiresAt: number;
}

export interface UserManagementState {
  users: User[];
  roles: Role[];
  permissions: Permission[];
  selectedUser: User | null;
  selectedRole: Role | null;
  isLoading: boolean;
  error: string | null;
  filter: {
    search: string;
    role: string;
    status: 'all' | 'active' | 'inactive';
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export interface AuditLogState {
  entries: AuditLogEntry[];
  isLoading: boolean;
  error: string | null;
  filter: {
    startDate?: number;
    endDate?: number;
    userId?: string;
    action?: string;
    resource?: string;
    status?: string;
    search?: string;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export interface SecurityAPIClient {
  // Authentication
  login(credentials: LoginCredentials): Promise<AuthToken>;
  logout(): Promise<void>;
  refreshToken(refreshToken: string): Promise<AuthToken>;
  register(data: RegisterData): Promise<User>;
  verifyEmail(token: string): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(data: PasswordResetConfirm): Promise<void>;
  getCurrentUser(): Promise<User>;
  updateProfile(userId: string, updates: Partial<User>): Promise<User>;
  changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>;
  
  // User Management
  getUsers(filter?: Partial<UserManagementState['filter']>, pagination?: Partial<UserManagementState['pagination']>): Promise<{ users: User[]; total: number }>;
  getUser(userId: string): Promise<User>;
  createUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  updateUser(userId: string, updates: Partial<User>): Promise<User>;
  deleteUser(userId: string): Promise<void>;
  activateUser(userId: string): Promise<void>;
  deactivateUser(userId: string): Promise<void>;
  
  // Role Management
  getRoles(): Promise<Role[]>;
  getRole(roleId: string): Promise<Role>;
  createRole(role: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Promise<Role>;
  updateRole(roleId: string, updates: Partial<Role>): Promise<Role>;
  deleteRole(roleId: string): Promise<void>;
  assignRole(userId: string, roleId: string): Promise<void>;
  removeRole(userId: string, roleId: string): Promise<void>;
  
  // Permission Management
  getPermissions(): Promise<Permission[]>;
  getPermission(permissionId: string): Promise<Permission>;
  createPermission(permission: Omit<Permission, 'id' | 'createdAt'>): Promise<Permission>;
  updatePermission(permissionId: string, updates: Partial<Permission>): Promise<Permission>;
  deletePermission(permissionId: string): Promise<void>;
  assignPermission(roleId: string, permissionId: string): Promise<void>;
  removePermission(roleId: string, permissionId: string): Promise<void>;
  
  // Audit Log
  getAuditLog(filter?: Partial<AuditLogState['filter']>, pagination?: Partial<AuditLogState['pagination']>): Promise<{ entries: AuditLogEntry[]; total: number }>;
  getAuditEntry(entryId: string): Promise<AuditLogEntry>;
  exportAuditLog(format: 'json' | 'csv'): Promise<Blob>;
  
  // Security Settings
  getSecuritySettings(): Promise<SecuritySettings>;
  updateSecuritySettings(settings: Partial<SecuritySettings>): Promise<SecuritySettings>;
  
  // Health & Diagnostics
  getSecurityHealth(): Promise<{
    auth: boolean;
    database: boolean;
    encryption: boolean;
    auditLog: boolean;
    lastCheck: number;
  }>;
}