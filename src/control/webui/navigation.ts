/**
 * Navigation system for DMX Engine UI
 * Handles routing, page transitions, and navigation state
 */

import { store } from './store/store';
import { extendedStore } from './store/store-extended';
import { AuthPage } from './pages/AuthPage';
import { DashboardHome } from './pages/DashboardHome';
import { SceneEditor } from './pages/SceneEditor';
import { ConfigEditor } from './pages/ConfigEditor';
import { UserManager } from './pages/UserManager';

export interface Route {
  path: string;
  name: string;
  component: () => HTMLElement;
  requiresAuth: boolean;
  requiredPermissions?: string[];
  icon?: string;
  category?: 'dashboard' | 'configuration' | 'security' | 'monitoring' | 'control';
  mobileOnly?: boolean;
  desktopOnly?: boolean;
}

export class NavigationManager {
  private static instance: NavigationManager;
  private routes: Route[] = [];
  private currentRoute: Route | null = null;
  private container: HTMLElement | null = null;
  private listeners: Array<(route: Route) => void> = [];
  
  private constructor() {
    this.initializeRoutes();
    this.setupStoreSubscription();
  }
  
  static getInstance(): NavigationManager {
    if (!NavigationManager.instance) {
      NavigationManager.instance = new NavigationManager();
    }
    return NavigationManager.instance;
  }
  
  private initializeRoutes(): void {
    this.routes = [
      // Dashboard routes
      {
        path: '/',
        name: 'Dashboard',
        component: () => DashboardHome(),
        requiresAuth: true,
        icon: '📊',
        category: 'dashboard'
      },
      {
        path: '/audio',
        name: 'Audio Visualization',
        component: () => {
          // Import dynamically to avoid circular dependencies
          const { AudioVisualization } = require('./pages/AudioVisualization');
          return AudioVisualization();
        },
        requiresAuth: true,
        icon: '🎵',
        category: 'monitoring'
      },
      {
        path: '/dmx',
        name: 'DMX Monitor',
        component: () => {
          const { DMXMonitor } = require('./pages/DMXMonitor');
          return DMXMonitor();
        },
        requiresAuth: true,
        icon: '💡',
        category: 'monitoring'
      },
      
      // Configuration routes
      {
        path: '/config',
        name: 'Configuration Editor',
        component: () => ConfigEditor(),
        requiresAuth: true,
        requiredPermissions: ['config:read', 'config:write'],
        icon: '⚙️',
        category: 'configuration'
      },
      {
        path: '/scenes',
        name: 'Scene Editor',
        component: () => SceneEditor(),
        requiresAuth: true,
        requiredPermissions: ['scenes:read', 'scenes:write'],
        icon: '🎭',
        category: 'configuration'
      },
      {
        path: '/effects',
        name: 'Effect Editor',
        component: () => {
          const { EffectEditor } = require('./pages/EffectEditor');
          return EffectEditor();
        },
        requiresAuth: true,
        requiredPermissions: ['effects:read', 'effects:write'],
        icon: '✨',
        category: 'configuration'
      },
      {
        path: '/fixtures',
        name: 'Fixture Manager',
        component: () => {
          const { FixtureManager } = require('./pages/FixtureManager');
          return FixtureManager();
        },
        requiresAuth: true,
        requiredPermissions: ['fixtures:read', 'fixtures:write'],
        icon: '🔧',
        category: 'configuration'
      },
      {
        path: '/rules',
        name: 'Rule Editor',
        component: () => {
          const { RuleEditor } = require('./pages/RuleEditor');
          return RuleEditor();
        },
        requiresAuth: true,
        requiredPermissions: ['rules:read', 'rules:write'],
        icon: '📝',
        category: 'configuration'
      },
      
      // Security routes
      {
        path: '/auth',
        name: 'Authentication',
        component: () => AuthPage(),
        requiresAuth: false,
        icon: '🔐',
        category: 'security',
        desktopOnly: true
      },
      {
        path: '/users',
        name: 'User Management',
        component: () => UserManager(),
        requiresAuth: true,
        requiredPermissions: ['users:read', 'users:write'],
        icon: '👥',
        category: 'security'
      },
      {
        path: '/security',
        name: 'Security Settings',
        component: () => {
          // Create a simple security settings page
          const div = document.createElement('div');
          div.innerHTML = '<h2>Security Settings</h2><p>Security settings page would be implemented here.</p>';
          return div;
        },
        requiresAuth: true,
        requiredPermissions: ['security:read', 'security:write'],
        icon: '🛡️',
        category: 'security'
      },
      {
        path: '/audit',
        name: 'Audit Log',
        component: () => {
          const div = document.createElement('div');
          div.innerHTML = '<h2>Audit Log</h2><p>Audit log viewer would be implemented here.</p>';
          return div;
        },
        requiresAuth: true,
        requiredPermissions: ['audit:read'],
        icon: '📋',
        category: 'security'
      },
      
      // Settings
      {
        path: '/settings',
        name: 'System Settings',
        component: () => {
          const div = document.createElement('div');
          div.innerHTML = '<h2>System Settings</h2><p>System settings page would be implemented here.</p>';
          return div;
        },
        requiresAuth: true,
        icon: '⚙️',
        category: 'dashboard'
      }
    ];
  }
  
  private setupStoreSubscription(): void {
    // Subscribe to store changes for current page
    store.subscribe((state) => {
      const page = state.ui.currentPage;
      this.navigateToPage(page);
    });
    
    // Subscribe to auth state changes
    extendedStore.subscribe((state) => {
      const isAuthenticated = state.security.auth.isAuthenticated;
      const currentRoute = this.currentRoute;
      
      // If user logs out and is on a protected route, redirect to auth
      if (!isAuthenticated && currentRoute && currentRoute.requiresAuth) {
        this.navigate('/auth');
      }
      
      // If user logs in and is on auth page, redirect to dashboard
      if (isAuthenticated && currentRoute?.path === '/auth') {
        this.navigate('/');
      }
    });
  }
  
  setContainer(container: HTMLElement): void {
    this.container = container;
  }
  
  navigate(path: string): void {
    // Find route
    const route = this.routes.find(r => r.path === path) || this.routes[0];
    
    // Check authentication
    const state = extendedStore.getState();
    if (route.requiresAuth && !state.security.auth.isAuthenticated) {
      this.navigate('/auth');
      return;
    }
    
    // Check permissions
    if (route.requiredPermissions) {
      const hasPermission = route.requiredPermissions.some(permission => 
        state.security.permissions.userPermissions.includes(permission) ||
        state.security.auth.user?.permissions?.includes(permission)
      );
      
      if (!hasPermission) {
        console.warn(`Insufficient permissions for route: ${route.path}`);
        this.showPermissionDenied();
        return;
      }
    }
    
    // Check device compatibility
    const deviceInfo = state.ui;
    if (route.mobileOnly && !deviceInfo.isMobile) {
      console.warn(`Route ${route.path} is mobile only`);
      this.navigate('/');
      return;
    }
    
    if (route.desktopOnly && deviceInfo.isMobile) {
      console.warn(`Route ${route.path} is desktop only`);
      this.navigate('/');
      return;
    }
    
    // Update current route
    this.currentRoute = route;
    
    // Update store
    const pageName = this.pathToPageName(path);
    if (pageName) {
      store.setCurrentPage(pageName);
    }
    
    // Render component
    this.renderRoute(route);
    
    // Notify listeners
    this.notifyListeners(route);
    
    // Update browser history
    this.updateBrowserHistory(path);
  }
  
  private navigateToPage(page: string): void {
    const path = this.pageNameToPath(page);
    if (path) {
      this.navigate(path);
    }
  }
  
  private pathToPageName(path: string): string | null {
    const route = this.routes.find(r => r.path === path);
    if (!route) return null;
    
    // Map path to page name used in store
    const pageMap: Record<string, string> = {
      '/': 'home',
      '/audio': 'audio',
      '/dmx': 'dmx',
      '/scenes': 'scenes',
      '/effects': 'effects',
      '/fixtures': 'fixtures',
      '/rules': 'rules',
      '/config': 'config',
      '/auth': 'auth',
      '/users': 'users',
      '/security': 'security',
      '/audit': 'audit',
      '/settings': 'settings'
    };
    
    return pageMap[path] || 'home';
  }
  
  private pageNameToPath(page: string): string | null {
    const pathMap: Record<string, string> = {
      'home': '/',
      'audio': '/audio',
      'dmx': '/dmx',
      'scenes': '/scenes',
      'effects': '/effects',
      'fixtures': '/fixtures',
      'rules': '/rules',
      'config': '/config',
      'auth': '/auth',
      'users': '/users',
      'security': '/security',
      'audit': '/audit',
      'settings': '/settings'
    };
    
    return pathMap[page] || '/';
  }
  
  private renderRoute(route: Route): void {
    if (!this.container) {
      console.error('Navigation container not set');
      return;
    }
    
    // Clear container
    this.container.innerHTML = '';
    
    // Show loading indicator
    const loading = document.createElement('div');
    loading.className = 'page-loading';
    loading.innerHTML = `
      <div class="loading-spinner"></div>
      <p>Loading ${route.name}...</p>
    `;
    this.container.appendChild(loading);
    
    // Load component asynchronously
    setTimeout(() => {
      try {
        const component = route.component();
        
        // Clear loading and add component
        this.container!.innerHTML = '';
        this.container!.appendChild(component);
        
        // Add page class for styling
        component.classList.add('page-content', `page-${route.path.replace('/', '') || 'home'}`);
        
      } catch (error) {
        console.error(`Failed to render route ${route.path}:`, error);
        this.showError(`Failed to load ${route.name}`);
      }
    }, 50);
  }
  
  private showPermissionDenied(): void {
    if (!this.container) return;
    
    this.container.innerHTML = `
      <div class="permission-denied">
        <div class="denied-icon">🚫</div>
        <h2>Permission Denied</h2>
        <p>You don't have permission to access this page.</p>
        <button class="back-button">Go Back</button>
      </div>
    `;
    
    // Add event listener to back button
    setTimeout(() => {
      const backButton = this.container!.querySelector('.back-button');
      if (backButton) {
        backButton.addEventListener('click', () => this.navigate('/'));
      }
    }, 0);
  }
  
  private showError(message: string): void {
    if (!this.container) return;
    
    this.container.innerHTML = `
      <div class="page-error">
        <div class="error-icon">❌</div>
        <h2>Error Loading Page</h2>
        <p>${message}</p>
        <button class="retry-button">Retry</button>
        <button class="home-button">Go Home</button>
      </div>
    `;
    
    // Add event listeners
    setTimeout(() => {
      const retryButton = this.container!.querySelector('.retry-button');
      const homeButton = this.container!.querySelector('.home-button');
      
      if (retryButton && this.currentRoute) {
        retryButton.addEventListener('click', () => this.renderRoute(this.currentRoute!));
      }
      
      if (homeButton) {
        homeButton.addEventListener('click', () => this.navigate('/'));
      }
    }, 0);
  }
  
  private updateBrowserHistory(path: string): void {
    if (window.history && window.history.pushState) {
      window.history.pushState({ path }, '', path);
    }
  }
  
  private notifyListeners(route: Route): void {
    this.listeners.forEach(listener => {
      try {
        listener(route);
      } catch (error) {
        console.error('Navigation listener error:', error);
      }
    });
  }
  
  subscribe(listener: (route: Route) => void): () => void {
    this.listeners.push(listener);
    
    // Call immediately with current route if exists
    if (this.currentRoute) {
      listener(this.currentRoute);
    }
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }
  
  getCurrentRoute(): Route | null {
    return this.currentRoute;
  }
  
  getRoutes(): Route[] {
    const state = extendedStore.getState();
    const isAuthenticated = state.security.auth.isAuthenticated;
    const isMobile = state.ui.isMobile;
    
    return this.routes.filter(route => {
      // Filter by authentication
      if (route.requiresAuth && !isAuthenticated) return false;
      
      // Filter by device compatibility
      if (route.mobileOnly && !isMobile) return false;
      if (route.desktopOnly && isMobile) return false;
      
      // Filter by permissions
      if (route.requiredPermissions) {
        const hasPermission = route.requiredPermissions.some(permission => 
          state.security.permissions.userPermissions.includes(permission) ||
          state.security.auth.user?.permissions?.includes(permission)
        );
        if (!hasPermission) return false;
      }
      
      return true;
    });
  }
  
  getRoutesByCategory(category: string): Route[] {
    return this.getRoutes().filter(route => route.category === category);
  }
  
  // Initialize browser history handling
  setupBrowserHistory(): void {
    // Handle back/forward navigation
    window.addEventListener('popstate', (event) => {
      if (event.state && event.state.path) {
        this.navigate(event.state.path);
      }
    });
    
    // Initial navigation based on current URL
    const initialPath = window.location.pathname || '/';
    this.navigate(initialPath);
  }
}

// Export singleton instance
export const navigationManager = NavigationManager.getInstance();

// Hook-like function for components
export function useNavigation(): {
  navigate: (path: string) => void;
  currentRoute: Route | null;
  routes: Route[];
} {
  return {
    navigate: (path: string) => navigationManager.navigate(path),
    currentRoute: navigationManager.getCurrentRoute(),
    routes: navigationManager.getRoutes()
  };
}

// Add styles for navigation components
export function addNavigationStyles(): void {
  const style = document.createElement('style');
  style.textContent = `
    .page-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 2rem;
    }
    
    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255, 255, 255, 0.1);
      border-top-color: #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }
    
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    
    .page-content {
      height: 100%;
      overflow-y: auto;
      padding: 1rem;
    }
    
    .permission-denied,
    .page-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 2rem;
      text-align: center;
    }
    
    .denied-icon,
    .error-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
      opacity: 0.8;
    }
    
    .permission-denied h2,
    .page-error h2 {
      margin: 0 0 0.5rem;
      font-size: 1.5rem;
    }
    
    .permission-denied p,
    .page-error p {
      margin: 0 0 1.5rem;
      opacity: 0.7;
      max-width: 400px;
    }
    
    .back-button,
    .retry-button,
    .home-button {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
      transition: opacity 0.2s, transform 0.2s;
    }
    
    .back-button {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
    }
    
    .retry-button {
      background: rgba(255, 255, 255, 0.1);
      color: white;
      margin-right: 0.5rem;
    }
    
    .home-button {
      background: rgba(255, 255, 255, 0.05);
      color: white;
    }
    
    .back-button:hover,
    .retry-button:hover,
    .home-button:hover {
      opacity: 0.9;
      transform: translateY(-