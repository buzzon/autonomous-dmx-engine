/**
 * Responsive design utilities for mobile adaptation
 */

import { extendedStore } from '../store/store-extended';

export interface Breakpoints {
  xs: number;    // < 576px
  sm: number;    // ≥ 576px
  md: number;    // ≥ 768px
  lg: number;    // ≥ 992px
  xl: number;    // ≥ 1200px
  xxl: number;   // ≥ 1400px
}

export const breakpoints: Breakpoints = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1400
};

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  orientation: 'portrait' | 'landscape';
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'offline';
  batteryLevel: number;
  isCharging: boolean;
}

export class ResponsiveManager {
  private static instance: ResponsiveManager;
  private deviceInfo: DeviceInfo;
  private listeners: Array<(info: DeviceInfo) => void> = [];
  
  private constructor() {
    this.deviceInfo = this.detectDeviceInfo();
    this.setupEventListeners();
    this.updateStore();
  }
  
  static getInstance(): ResponsiveManager {
    if (!ResponsiveManager.instance) {
      ResponsiveManager.instance = new ResponsiveManager();
    }
    return ResponsiveManager.instance;
  }
  
  private detectDeviceInfo(): DeviceInfo {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isTouchDevice = 'ontouchstart' in window || 
      navigator.maxTouchPoints > 0 ||
      (navigator as any).msMaxTouchPoints > 0;
    
    const isMobile = width < breakpoints.md;
    const isTablet = width >= breakpoints.md && width < breakpoints.lg;
    const isDesktop = width >= breakpoints.lg;
    
    const orientation = width > height ? 'landscape' : 'portrait';
    
    return {
      isMobile,
      isTablet,
      isDesktop,
      isTouchDevice,
      screenWidth: width,
      screenHeight: height,
      pixelRatio: window.devicePixelRatio || 1,
      orientation,
      connectionType: this.detectConnectionType(),
      batteryLevel: 100,
      isCharging: false
    };
  }
  
  private detectConnectionType(): DeviceInfo['connectionType'] {
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    
    if (connection) {
      if (connection.type === 'wifi') return 'wifi';
      if (connection.type === 'cellular') return 'cellular';
      if (connection.type === 'ethernet') return 'ethernet';
    }
    
    return navigator.onLine ? 'wifi' : 'offline';
  }
  
  private setupEventListeners(): void {
    // Window resize
    window.addEventListener('resize', () => this.handleResize());
    
    // Orientation change
    window.addEventListener('orientationchange', () => this.handleResize());
    
    // Online/offline
    window.addEventListener('online', () => this.handleConnectionChange());
    window.addEventListener('offline', () => this.handleConnectionChange());
    
    // Battery API (if available)
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        this.updateBatteryInfo(battery);
        
        battery.addEventListener('levelchange', () => {
          this.updateBatteryInfo(battery);
        });
        
        battery.addEventListener('chargingchange', () => {
          this.updateBatteryInfo(battery);
        });
      });
    }
    
    // Connection API (if available)
    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', () => {
        this.handleConnectionChange();
      });
    }
  }
  
  private handleResize(): void {
    const oldInfo = { ...this.deviceInfo };
    this.deviceInfo = this.detectDeviceInfo();
    
    // Only notify if something actually changed
    if (JSON.stringify(oldInfo) !== JSON.stringify(this.deviceInfo)) {
      this.notifyListeners();
      this.updateStore();
    }
  }
  
  private handleConnectionChange(): void {
    const oldConnection = this.deviceInfo.connectionType;
    this.deviceInfo.connectionType = this.detectConnectionType();
    
    if (oldConnection !== this.deviceInfo.connectionType) {
      this.notifyListeners();
      this.updateStore();
    }
  }
  
  private updateBatteryInfo(battery: any): void {
    this.deviceInfo.batteryLevel = Math.round(battery.level * 100);
    this.deviceInfo.isCharging = battery.charging;
    this.notifyListeners();
    this.updateStore();
  }
  
  private updateStore(): void {
    const state = extendedStore.getState();
    
    // Update mobile state
    extendedStore.setOnlineStatus(
      this.deviceInfo.connectionType !== 'offline',
      this.deviceInfo.connectionType
    );
    
    extendedStore.setBatteryStatus(
      this.deviceInfo.batteryLevel,
      this.deviceInfo.isCharging
    );
    
    // Update UI state for mobile mode
    extendedStore.setMobileMode(this.deviceInfo.isMobile);
    
    // Update layout based on screen size
    if (this.deviceInfo.isMobile) {
      if (state.ui.layout !== 'mobile') {
        extendedStore.setLayout('mobile');
      }
    } else if (this.deviceInfo.isTablet) {
      if (state.ui.layout === 'mobile') {
        extendedStore.setLayout('compact');
      }
    }
  }
  
  private notifyListeners(): void {
    const info = this.getDeviceInfo();
    this.listeners.forEach(listener => {
      try {
        listener(info);
      } catch (error) {
        console.error('Responsive listener error:', error);
      }
    });
  }
  
  getDeviceInfo(): DeviceInfo {
    return { ...this.deviceInfo };
  }
  
  subscribe(listener: (info: DeviceInfo) => void): () => void {
    this.listeners.push(listener);
    
    // Call immediately with current state
    listener(this.getDeviceInfo());
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }
  
  // Utility methods
  isBreakpoint(breakpoint: keyof Breakpoints): boolean {
    const width = window.innerWidth;
    const bp = breakpoints[breakpoint];
    const nextBp = this.getNextBreakpoint(breakpoint);
    
    if (breakpoint === 'xs') {
      return width < breakpoints.sm;
    }
    
    return width >= bp && (nextBp ? width < nextBp : true);
  }
  
  private getNextBreakpoint(breakpoint: keyof Breakpoints): number | null {
    const keys = Object.keys(breakpoints) as (keyof Breakpoints)[];
    const index = keys.indexOf(breakpoint);
    
    if (index < keys.length - 1) {
      return breakpoints[keys[index + 1]];
    }
    
    return null;
  }
  
  getCurrentBreakpoint(): keyof Breakpoints {
    const width = window.innerWidth;
    
    if (width < breakpoints.sm) return 'xs';
    if (width < breakpoints.md) return 'sm';
    if (width < breakpoints.lg) return 'md';
    if (width < breakpoints.xl) return 'lg';
    if (width < breakpoints.xxl) return 'xl';
    return 'xxl';
  }
  
  // CSS utility methods
  getResponsiveClass(baseClass: string): string {
    const breakpoint = this.getCurrentBreakpoint();
    return `${baseClass} ${baseClass}--${breakpoint}`;
  }
  
  getResponsiveValue<T>(values: Partial<Record<keyof Breakpoints, T>>, defaultValue: T): T {
    const breakpoint = this.getCurrentBreakpoint();
    return values[breakpoint] ?? defaultValue;
  }
}

// Export singleton instance
export const responsiveManager = ResponsiveManager.getInstance();

// Hook-like function for components
export function useResponsive(): DeviceInfo {
  return responsiveManager.getDeviceInfo();
}

// Media query utility
export function mediaQuery(minWidth?: number, maxWidth?: number): string {
  const parts: string[] = [];
  
  if (minWidth !== undefined) {
    parts.push(`(min-width: ${minWidth}px)`);
  }
  
  if (maxWidth !== undefined) {
    parts.push(`(max-width: ${maxWidth}px)`);
  }
  
  return parts.join(' and ');
}

// Touch optimization utilities
export function optimizeForTouch(element: HTMLElement): void {
  if (!responsiveManager.getDeviceInfo().isTouchDevice) return;
  
  // Increase touch target size (minimum 44x44px)
  const style = element.style;
  const computed = window.getComputedStyle(element);
  
  const minWidth = Math.max(parseInt(computed.width || '0'), 44);
  const minHeight = Math.max(parseInt(computed.height || '0'), 44);
  
  style.minWidth = `${minWidth}px`;
  style.minHeight = `${minHeight}px`;
  
  // Add touch feedback
  element.style.cursor = 'pointer';
  
  // Prevent text selection on touch devices
  element.style.userSelect = 'none';
  element.style.webkitUserSelect = 'none';
  element.style.touchAction = 'manipulation';
}

// Mobile layout utilities
export function applyMobileLayout(element: HTMLElement): void {
  const deviceInfo = responsiveManager.getDeviceInfo();
  
  if (!deviceInfo.isMobile && !deviceInfo.isTablet) return;
  
  element.classList.add('mobile-layout');
  
  if (deviceInfo.orientation === 'landscape') {
    element.classList.add('landscape');
    element.classList.remove('portrait');
  } else {
    element.classList.add('portrait');
    element.classList.remove('landscape');
  }
  
  // Apply safe area insets for notched devices
  const style = element.style;
  style.paddingTop = 'env(safe-area-inset-top)';
  style.paddingBottom = 'env(safe-area-inset-bottom)';
  style.paddingLeft = 'env(safe-area-inset-left)';
  style.paddingRight = 'env(safe-area-inset-right)';
}

// Offline support utilities
export function setupOfflineSupport(): void {
  const handleOnline = () => {
    console.log('Application is online');
    extendedStore.setOnlineStatus(true, responsiveManager.getDeviceInfo().connectionType);
  };
  
  const handleOffline = () => {
    console.log('Application is offline');
    extendedStore.setOnlineStatus(false, 'offline');
    
    // Show offline notification
    showOfflineNotification();
  };
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // Initial check
  if (!navigator.onLine) {
    handleOffline();
  }
}

function showOfflineNotification(): void {
  // Create or update offline notification
  let notification = document.getElementById('offline-notification');
  
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'offline-notification';
    notification.className = 'offline-notification';
    notification.innerHTML = `
      <div class="offline-content">
        <span class="offline-icon">📶</span>
        <span class="offline-text">You are currently offline. Some features may be limited.</span>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .offline-notification {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #ff6b6b, #ee5a52);
        color: white;
        padding: 12px 16px;
        text-align: center;
        z-index: 10000;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        animation: slideDown 0.3s ease-out;
      }
      
      .offline-content {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        max-width: 1200px;
        margin: 0 auto;
      }
      
      .offline-icon {
        font-size: 1.2rem;
      }
      
      .offline-text {
        font-size: 0.9rem;
        font-weight: 500;
      }
      
      @keyframes slideDown {
        from {
          transform: translateY(-100%);
        }
        to {
          transform: translateY(0);
        }
      }
      
      @media (max-width: 768px) {
        .offline-content {
          flex-direction: column;
          gap: 5px;
        }
        
        .offline-text {
          font-size: 0.8rem;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Auto-hide when online
  const checkOnline = () => {
    if (navigator.onLine && notification) {
      notification.style.animation = 'slideUp 0.3s ease-in forwards';
      
      setTimeout(() => {
        if (notification && notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
      
      window.removeEventListener('online', checkOnline);
    }
  };
  
  window.addEventListener('online', checkOnline);
}