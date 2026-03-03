/**
 * Authentication page for DMX Engine UI
 * Handles login, registration, password reset, and session management
 */

import { store } from '../store/store';
import { extendedStore } from '../store/store-extended';
import { LoginCredentials, RegisterData, PasswordResetRequest } from '../types/security';

// Simple HTML button for auth page (since we're not using ImGui here)
function createHTMLButton(options: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  fullWidth?: boolean;
}): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'html-button';
  button.textContent = options.label;
  button.disabled = options.disabled || false;
  
  if (options.variant) {
    button.classList.add(`html-button-${options.variant}`);
  }
  
  if (options.fullWidth) {
    button.style.width = '100%';
  }
  
  button.onclick = (e) => {
    e.preventDefault();
    options.onClick();
  };
  
  return button;
}

function createAlreadyAuthenticatedView(): HTMLElement {
  const state = extendedStore.getState();
  const user = state.security.auth.user!;
  
  const container = document.createElement('div');
  container.className = 'already-auth';
  
  container.innerHTML = `
    <h2>Welcome back, ${user.displayName || user.username}!</h2>
    <p>You are already logged in to the DMX Engine control panel.</p>
    
    <div class="user-info">
      <div class="user-avatar">
        ${(user.displayName || user.username).charAt(0).toUpperCase()}
      </div>
      <div class="user-details">
        <h3 class="user-name">${user.displayName || user.username}</h3>
        <p class="user-email">${user.email}</p>
        <div class="user-roles">
          ${user.roles.map(role => `<span class="role-badge">${role}</span>`).join('')}
        </div>
      </div>
    </div>
    
    <p>Session expires in ${Math.round((state.security.auth.sessionExpiresAt - Date.now()) / 60000)} minutes</p>
  `;
  
  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.gap = '1rem';
  buttonContainer.style.marginTop = '2rem';
  buttonContainer.style.justifyContent = 'center';
  
  const goToDashboard = createHTMLButton({
    label: 'Go to Dashboard',
    onClick: () => store.setCurrentPage('home'),
    variant: 'primary'
  });
  
  const logoutButton = createHTMLButton({
    label: 'Logout',
    onClick: () => {
      extendedStore.setAuthState({
        isAuthenticated: false,
        user: null,
        token: null
      });
      // Force page refresh
      window.location.reload();
    },
    variant: 'secondary'
  });
  
  buttonContainer.appendChild(goToDashboard);
  buttonContainer.appendChild(logoutButton);
  container.appendChild(buttonContainer);
  
  return container;
}

export function AuthPage(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'auth-page';
  
  // Check if user is already authenticated
  const state = extendedStore.getState();
  if (state.security.auth.isAuthenticated) {
    return createAlreadyAuthenticatedView();
  }
  
  // Create tabs for different auth modes
  const tabs = ['login', 'register', 'reset'];
  let currentTab = 'login';
  
  const updateView = () => {
    container.innerHTML = '';
    
    // Header
    const header = document.createElement('div');
    header.className = 'auth-header';
    header.innerHTML = `
      <h1>DMX Engine</h1>
      <p>Autonomous lighting control system</p>
    `;
    container.appendChild(header);
    
    // Tabs
    const tabContainer = document.createElement('div');
    tabContainer.className = 'auth-tabs';
    tabs.forEach(tab => {
      const tabElement = document.createElement('button');
      tabElement.className = `auth-tab ${tab === currentTab ? 'active' : ''}`;
      tabElement.textContent = tab.charAt(0).toUpperCase() + tab.slice(1);
      tabElement.onclick = () => {
        currentTab = tab;
        updateView();
      };
      tabContainer.appendChild(tabElement);
    });
    container.appendChild(tabContainer);
    
    // Content based on current tab
    const content = document.createElement('div');
    content.className = 'auth-content';
    
    switch (currentTab) {
      case 'login':
        content.appendChild(createLoginForm());
        break;
      case 'register':
        content.appendChild(createRegisterForm());
        break;
      case 'reset':
        content.appendChild(createResetForm());
        break;
    }
    
    container.appendChild(content);
    
    // Footer with system info
    const footer = document.createElement('div');
    footer.className = 'auth-footer';
    footer.innerHTML = `
      <p>Version 1.0.0 • ${state.system.mode} mode</p>
      <p>API: ${state.api.isConnected ? 'Connected' : 'Disconnected'}</p>
    `;
    container.appendChild(footer);
  };
  
  updateView();
  
  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .auth-page {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 2rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    
    .auth-header {
      text-align: center;
      margin-bottom: 2rem;
    }
    
    .auth-header h1 {
      font-size: 2.5rem;
      margin: 0;
      font-weight: 300;
    }
    
    .auth-header p {
      opacity: 0.8;
      margin: 0.5rem 0 0;
    }
    
    .auth-tabs {
      display: flex;
      gap: 1px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 2rem;
    }
    
    .auth-tab {
      padding: 0.75rem 1.5rem;
      background: transparent;
      border: none;
      color: white;
      cursor: pointer;
      font-size: 0.9rem;
      transition: background 0.2s;
    }
    
    .auth-tab:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    
    .auth-tab.active {
      background: rgba(255, 255, 255, 0.2);
      font-weight: 500;
    }
    
    .auth-content {
      width: 100%;
      max-width: 400px;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }
    
    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .form-label {
      font-size: 0.9rem;
      opacity: 0.9;
    }
    
    .form-input {
      padding: 0.75rem;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.1);
      color: white;
      font-size: 1rem;
      transition: border-color 0.2s;
    }
    
    .form-input:focus {
      outline: none;
      border-color: rgba(255, 255, 255, 0.4);
    }
    
    .form-input::placeholder {
      color: rgba(255, 255, 255, 0.5);
    }
    
    .form-checkbox {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
    }
    
    .form-checkbox input {
      width: 1.2rem;
      height: 1.2rem;
    }
    
    .auth-error {
      background: rgba(255, 0, 0, 0.2);
      border: 1px solid rgba(255, 0, 0, 0.3);
      border-radius: 6px;
      padding: 0.75rem;
      margin-bottom: 1rem;
      font-size: 0.9rem;
    }
    
    .auth-success {
      background: rgba(0, 255, 0, 0.2);
      border: 1px solid rgba(0, 255, 0, 0.3);
      border-radius: 6px;
      padding: 0.75rem;
      margin-bottom: 1rem;
      font-size: 0.9rem;
    }
    
    .auth-footer {
      margin-top: 2rem;
      text-align: center;
      opacity: 0.7;
      font-size: 0.8rem;
    }
    
    .auth-footer p {
      margin: 0.25rem 0;
    }
    
    .already-auth {
      text-align: center;
      max-width: 500px;
      padding: 3rem;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }
    
    .already-auth h2 {
      margin-top: 0;
    }
    
    .user-info {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin: 2rem 0;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
    }
    
    .user-avatar {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      font-weight: bold;
    }
    
    .user-details {
      flex: 1;
    }
    
    .user-name {
      font-size: 1.2rem;
      font-weight: 500;
      margin: 0 0 0.25rem;
    }
    
    .user-email {
      opacity: 0.8;
      margin: 0;
      font-size: 0.9rem;
    }
    
    .user-roles {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
    
    .role-badge {
      background: rgba(255, 255, 255, 0.1);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.8rem;
    }
    
    @media (max-width: 768px) {
      .auth-page {
        padding: 1rem;
      }
      
      .auth-content {
        padding: 1.5rem;
      }
      
      .auth-header h1 {
        font-size: 2rem;
      }
    }
  `;
  container.appendChild(style);
  
  return container;
}

function createLoginForm(): HTMLElement {
  const form = document.createElement('div');
  form.className = 'auth-form';
  
  const state = extendedStore.getState();
  const error = state.security.auth.error;
  
  if (error) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'auth-error';
    errorDiv.textContent = error;
    form.appendChild(errorDiv);
  }
  
  // Username field
  const usernameGroup = document.createElement('div');
  usernameGroup.className = 'form-group';
  usernameGroup.innerHTML = `
    <label class="form-label">Username or Email</label>
    <input type="text" class="form-input" id="username" placeholder="Enter your username or email" autocomplete="username">
  `;
  form.appendChild(usernameGroup);
  
  // Password field
  const passwordGroup = document.createElement('div');
  passwordGroup.className = 'form-group';
  passwordGroup.innerHTML = `
    <label class="form-label">Password</label>
    <input type="password" class="form-input" id="password" placeholder="Enter your password" autocomplete="current-password">
  `;
  form.appendChild(passwordGroup);
  
  // Remember me checkbox
  const rememberGroup = document.createElement('div');
  rememberGroup.className = 'form-checkbox';
  rememberGroup.innerHTML = `
    <input type="checkbox" id="rememberMe">
    <label for="rememberMe">Remember me</label>
  `;
  form.appendChild(rememberGroup);
  
  // Login button
  const loginButton = createHTMLButton({
    label: state.security.auth.isLoading ? 'Logging in...' : 'Login',
    onClick: () => handleLogin(),
    disabled: state.security.auth.isLoading,
    variant: 'primary',
    fullWidth: true
  });
  form.appendChild(loginButton);
  
  // Forgot password link
  const forgotLink = document.createElement('div');
  forgotLink.className = 'form-group';
  forgotLink.style.textAlign = 'center';
  forgotLink.style.marginTop = '1rem';
  forgotLink.innerHTML = `
    <a href="#" style="color: rgba(255, 255, 255, 0.8); text-decoration: none; font-size: 0.9rem;">
      Forgot your password?
    </a>
  `;
  forgotLink.querySelector('a')!.onclick = (e) => {
    e.preventDefault();
    // Switch to reset tab
    const container = document.querySelector('.auth-page');
    if (container) {
      const tabs = container.querySelectorAll('.auth-tab');
      tabs[2].dispatchEvent(new MouseEvent('click'));
    }
  };
  form.appendChild(forgotLink);
  
  function handleLogin() {
    const username = (form.querySelector('#username') as HTMLInputElement).value;
    const password = (form.querySelector('#password') as HTMLInputElement).value;
    const rememberMe = (form.querySelector('#rememberMe') as HTMLInputElement).checked;
    
    if (!username || !password) {
      extendedStore.setAuthState({ error: 'Please enter username and password' });
      return;
    }
    
    const credentials: LoginCredentials = {
      username,
      password,
      rememberMe
    };
    
    // Simulate login for now
    extendedStore.setAuthState({ isLoading: true, error: null });
    
    setTimeout(() => {
      // Mock successful login
      extendedStore.setAuthState({
        isLoading: false,
        isAuthenticated: true,
        error: null,
        user: {
          id: 'user-123',
          username: username,
          email: username.includes('@') ? username : `${username}@example.com`,
          displayName: username.charAt(0).toUpperCase() + username.slice(1),
          roles: ['user', 'operator'],
          permissions: ['config:read', 'control:read', 'scenes:read'],
          isActive: true,
          isVerified: true,
          lastLogin: Date.now(),
          createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
          updatedAt: Date.now()
        },
        token: {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          expiresAt: Date.now() + 3600 * 1000
        }
      });
      
      // Update UI state
      store.setCurrentPage('home');
    }, 1000);
  }
  
  return form;
}

function createRegisterForm(): HTMLElement {
  const form = document.createElement('div');
  form.className = 'auth-form';
  
  form.innerHTML = `
    <div class="form-group">
      <label class="form-label">Username</label>
      <input type="text" class="form-input" id="regUsername" placeholder="Choose a username">
    </div>
    
    <div class="form-group">
      <label class="form-label">Email</label>
      <input type="email" class="form-input" id="regEmail" placeholder="Enter your email">
    </div>
    
    <div class="form-group">
      <label class="form-label">Display Name</label>
      <input type="text" class="form-input" id="regDisplayName" placeholder="Optional display name">
    </div>
    
    <div class="form-group">
      <label class="form-label">Password</label>
      <input type="password" class="form-input" id="regPassword" placeholder="Create a password">
      <small style="opacity: 0.7; font-size: 0.8rem;">Minimum 8 characters with uppercase, lowercase, number, and special character</small>
    </div>
    
    <div class="form-group">
      <label class="form-label">Confirm Password</label>
      <input type="password" class="form-input" id="regConfirmPassword" placeholder="Confirm your password">
    </div>
    
    <div class="form-checkbox">
      <input type="checkbox" id="acceptTerms">
      <label for="acceptTerms">I accept the terms and conditions</label>
    </div>
  `;
  
  const registerButton = createHTMLButton({
    label: 'Create Account',
    onClick: () => handleRegister(),
    variant: 'primary',
    fullWidth: true
  });
  form.appendChild(registerButton);
  
  function handleRegister() {
    const username = (form.querySelector('#regUsername') as HTMLInputElement).value;
    const email = (form.querySelector('#regEmail') as HTMLInputElement).value;
    const displayName = (form.querySelector('#regDisplayName') as HTMLInputElement).value;
    const password = (form.querySelector('#regPassword') as HTMLInputElement).value;
    const confirmPassword = (form.querySelector('#regConfirmPassword') as HTMLInputElement).value;
    const acceptTerms = (form.querySelector('#acceptTerms') as HTMLInputElement).checked;
    
    // Basic validation
    if (!username || !email || !password || !confirmPassword) {
      alert('Please fill in all required fields');
      return;
    }
    
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    
    if (!acceptTerms) {
      alert('You must accept the terms and conditions');
      return;
    }
    
    if (password.length < 8) {
      alert('Password must be at least 8 characters long');
      return;
    }
    
    const registerData: RegisterData = {
      username,
      email,
      password,
      displayName: displayName || undefined
    };
    
    // Simulate registration
    extendedStore.setAuthState({ isLoading: true });
    
    setTimeout(() => {
      extendedStore.setAuthState({ isLoading: false });
      alert('Registration successful! Please check your email to verify your account.');
      
      // Switch to login tab
      const container = document.querySelector('.auth-page');
      if (container) {
        const tabs = container.querySelectorAll('.auth-tab');
        tabs[0].dispatchEvent(new MouseEvent('click'));
      }
    }, 1500);
  }
  
  return form;
}

function createResetForm(): HTMLElement {
  const form = document.createElement('div');
  form.className = 'auth-form';
  
  form.innerHTML = `
    <div class="auth-success" style="display: none;" id="successMessage">
      Password reset instructions have been sent to your email.
    </div>
    
    <div class="form-group">
      <label class="form-label">Email Address</label>
      <input type="email" class="form-input" id="resetEmail" placeholder="Enter your email address">
      <small style="opacity: 0.7; font-size: 0.8rem;">We'll send you instructions to reset your password</small>
    </div>
  `;
  
  const resetButton = createHTMLButton({
    label: 'Send Reset Instructions',
    onClick: () => handleReset(),
    variant: 'primary',
    fullWidth: true
  });
  form.appendChild(resetButton);
  
  function handleReset() {
    const email = (form.querySelector('#resetEmail') as HTMLInputElement).value;
    
    if (!email || !email.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }
    
    const resetRequest: PasswordResetRequest = { email };
    
    // Simulate password reset request
    const successMessage = form.querySelector('#successMessage') as HTMLElement;
    successMessage.style.display = 'block';
    resetButton.disabled = true;
    resetButton.textContent = 'Instructions Sent';
    
    // Reset after 5 seconds
    setTimeout(() => {
      successMessage.style.display = 'none';
      resetButton.disabled = false;
      resetButton.textContent = 'Send Reset Instructions';
      (form.querySelector('#resetEmail') as HTMLInputElement).value = '';
    }, 5000);
  }
  
  return form;
}