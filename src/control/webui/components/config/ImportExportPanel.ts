/**
 * Import/Export panel for configuration management
 */

import { extendedStore } from '../../store/store-extended';
import { getAPIClient } from '../../api/client';
import { ConfigImportExportOptions, ConfigNode } from '../../types/config';

export interface ImportExportPanelProps {
  configId?: string;
  onImport?: (config: ConfigNode) => void;
  onExport?: () => void;
  className?: string;
}

export function ImportExportPanel(props: ImportExportPanelProps): HTMLElement {
  const container = document.createElement('div');
  container.className = `import-export-panel ${props.className || ''}`;
  
  const apiClient = getAPIClient();
  const state = extendedStore.getState();
  
  // Create tabs
  const tabs = ['import', 'export', 'backup'];
  let currentTab = 'import';
  
  const updateView = () => {
    container.innerHTML = '';
    
    // Header
    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = `
      <h3>Configuration Management</h3>
      <p>Import, export, and backup your configurations</p>
    `;
    container.appendChild(header);
    
    // Tabs
    const tabContainer = document.createElement('div');
    tabContainer.className = 'panel-tabs';
    tabs.forEach(tab => {
      const tabElement = document.createElement('button');
      tabElement.className = `panel-tab ${tab === currentTab ? 'active' : ''}`;
      tabElement.textContent = tab.charAt(0).toUpperCase() + tab.slice(1);
      tabElement.onclick = () => {
        currentTab = tab;
        updateView();
      };
      tabContainer.appendChild(tabElement);
    });
    container.appendChild(tabContainer);
    
    // Content
    const content = document.createElement('div');
    content.className = 'panel-content';
    
    switch (currentTab) {
      case 'import':
        content.appendChild(createImportSection());
        break;
      case 'export':
        content.appendChild(createExportSection());
        break;
      case 'backup':
        content.appendChild(createBackupSection());
        break;
    }
    
    container.appendChild(content);
    
    // Status
    const status = document.createElement('div');
    status.className = 'panel-status';
    
    const importExportState = state.config.importExport;
    if (importExportState.isImporting || importExportState.isExporting) {
      status.innerHTML = `
        <div class="progress-container">
          <div class="progress-bar" style="width: ${importExportState.progress}%"></div>
        </div>
        <div class="progress-text">
          ${importExportState.isImporting ? 'Importing...' : 'Exporting...'} ${importExportState.progress}%
        </div>
      `;
    } else if (importExportState.error) {
      status.innerHTML = `
        <div class="error-message">
          ❌ ${importExportState.error}
        </div>
      `;
    }
    
    container.appendChild(status);
  };
  
  function createImportSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'import-section';
    
    section.innerHTML = `
      <div class="section-description">
        <p>Import configuration from a file. Supported formats: JSON, YAML, TOML.</p>
        <p>The imported configuration will be validated before being applied.</p>
      </div>
      
      <div class="import-options">
        <div class="option-group">
          <label>
            <input type="radio" name="importFormat" value="json" checked>
            JSON
          </label>
          <label>
            <input type="radio" name="importFormat" value="yaml">
            YAML
          </label>
          <label>
            <input type="radio" name="importFormat" value="toml">
            TOML
          </label>
        </div>
        
        <div class="option-group">
          <label>
            <input type="checkbox" id="includeSchema" checked>
            Include schema validation
          </label>
          <label>
            <input type="checkbox" id="includeMetadata" checked>
            Include metadata
          </label>
          <label>
            <input type="checkbox" id="includeVersions">
            Include version history
          </label>
        </div>
        
        <div class="option-group">
          <label>
            <input type="checkbox" id="compressFile">
            Compress file (gzip)
          </label>
        </div>
      </div>
      
      <div class="file-drop-area" id="fileDropArea">
        <div class="drop-icon">📁</div>
        <div class="drop-text">
          <strong>Drag & drop your configuration file here</strong>
          <p>or click to browse</p>
        </div>
        <input type="file" id="fileInput" accept=".json,.yaml,.yml,.toml,.gz,.zip" style="display: none;">
      </div>
      
      <div class="validation-options">
        <h4>Validation Options</h4>
        <div class="option-group">
          <label>
            <input type="checkbox" id="validateSchema" checked>
            Validate against schema
          </label>
          <label>
            <input type="checkbox" id="validateRequired" checked>
            Check required fields
          </label>
          <label>
            <input type="checkbox" id="validateTypes" checked>
            Validate data types
          </label>
        </div>
      </div>
    `;
    
    // Setup file drop area
    const fileDropArea = section.querySelector('#fileDropArea') as HTMLElement;
    const fileInput = section.querySelector('#fileInput') as HTMLInputElement;
    
    fileDropArea.onclick = () => fileInput.click();
    
    fileDropArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      fileDropArea.classList.add('dragover');
    });
    
    fileDropArea.addEventListener('dragleave', () => {
      fileDropArea.classList.remove('dragover');
    });
    
    fileDropArea.addEventListener('drop', (e) => {
      e.preventDefault();
      fileDropArea.classList.remove('dragover');
      
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        handleFileImport(files[0]);
      }
    });
    
    fileInput.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        handleFileImport(files[0]);
      }
    });
    
    async function handleFileImport(file: File) {
      const format = (section.querySelector('input[name="importFormat"]:checked') as HTMLInputElement)?.value || 'json';
      const includeSchema = (section.querySelector('#includeSchema') as HTMLInputElement)?.checked || false;
      const includeMetadata = (section.querySelector('#includeMetadata') as HTMLInputElement)?.checked || false;
      const includeVersions = (section.querySelector('#includeVersions') as HTMLInputElement)?.checked || false;
      const compress = (section.querySelector('#compressFile') as HTMLInputElement)?.checked || false;
      
      const options: ConfigImportExportOptions = {
        format: format as any,
        includeSchema,
        includeMetadata,
        includeVersions,
        compress
      };
      
      // Update store
      extendedStore.setState({
        config: {
          ...state.config,
          importExport: {
            isImporting: true,
            isExporting: false,
            progress: 0,
            error: null
          }
        }
      });
      
      try {
        // Simulate progress
        const progressInterval = setInterval(() => {
          const currentProgress = extendedStore.getState().config.importExport.progress;
          if (currentProgress < 90) {
            extendedStore.setState({
              config: {
                ...extendedStore.getState().config,
                importExport: {
                  ...extendedStore.getState().config.importExport,
                  progress: currentProgress + 10
                }
              }
            });
          }
        }, 200);
        
        // Import file
        const config = await apiClient.importConfig(file, options);
        
        clearInterval(progressInterval);
        
        // Update store with imported config
        extendedStore.setState({
          config: {
            ...extendedStore.getState().config,
            currentConfig: config,
            importExport: {
              isImporting: false,
              isExporting: false,
              progress: 100,
              error: null
            }
          }
        });
        
        // Call callback
        if (props.onImport) {
          props.onImport(config);
        }
        
        // Show success message
        setTimeout(() => {
          extendedStore.setState({
            config: {
              ...extendedStore.getState().config,
              importExport: {
                isImporting: false,
                isExporting: false,
                progress: 0,
                error: null
              }
            }
          });
        }, 2000);
        
      } catch (error) {
        extendedStore.setState({
          config: {
            ...state.config,
            importExport: {
              isImporting: false,
              isExporting: false,
              progress: 0,
              error: error instanceof Error ? error.message : 'Import failed'
            }
          }
        });
      }
    }
    
    return section;
  }
  
  function createExportSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'export-section';
    
    const config = state.config.currentConfig;
    
    section.innerHTML = `
      <div class="section-description">
        <p>Export the current configuration to a file.</p>
        ${config ? '' : '<p class="warning">⚠️ No configuration loaded. Load a configuration first.</p>'}
      </div>
      
      <div class="export-options">
        <div class="option-group">
          <label>Format:</label>
          <select id="exportFormat">
            <option value="json">JSON</option>
            <option value="yaml">YAML</option>
            <option value="toml">TOML</option>
          </select>
        </div>
        
        <div class="option-group">
          <label>
            <input type="checkbox" id="includeEffects" checked>
            Effects
          </label>
          <label>
            <input type="checkbox" id="includeScenes" checked>
            Scenes
          </label>
          <label>
            <input type="checkbox" id="includeFixtures" checked>
            Fixtures
          </label>
          <label>
            <input type="checkbox" id="includeRules" checked>
            Rules
          </label>
        </div>
        
        <div class="option-group">
          <label>
            <input type="checkbox" id="createRestorePoint">
            Create as restore point
          </label>
          <small>Restore points are automatically created before major changes</small>
        </div>
      </div>
      
      <div class="backup-create-actions">
        <button class="action-button primary" id="confirmCreateBackup">
          Create Backup
        </button>
        <button class="action-button secondary" id="cancelCreateBackup">
          Cancel
        </button>
      </div>
    `;
    
    // Helper function to format bytes
    function formatBytes(bytes: number): string {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Setup event listeners
    const createBackupButton = section.querySelector('#createBackupButton') as HTMLButtonElement;
    const refreshBackupsButton = section.querySelector('#refreshBackupsButton') as HTMLButtonElement;
    const backupOptions = section.querySelector('.backup-options') as HTMLElement;
    const confirmCreateBackup = section.querySelector('#confirmCreateBackup') as HTMLButtonElement;
    const cancelCreateBackup = section.querySelector('#cancelCreateBackup') as HTMLButtonElement;
    
    createBackupButton.onclick = () => {
      backupOptions.style.display = 'block';
    };
    
    refreshBackupsButton.onclick = async () => {
      try {
        const backups = await apiClient.getBackups();
        extendedStore.setState({
          config: {
            ...state.config,
            backups: backups.map(b => ({
              id: b.id,
              name: b.name,
              timestamp: b.timestamp,
              size: b.size
            }))
          }
        });
        updateView();
      } catch (error) {
        console.error('Failed to refresh backups:', error);
      }
    };
    
    confirmCreateBackup.onclick = async () => {
      const name = (section.querySelector('#backupName') as HTMLInputElement).value;
      const description = (section.querySelector('#backupDescription') as HTMLTextAreaElement).value;
      const createRestorePoint = (section.querySelector('#createRestorePoint') as HTMLInputElement).checked;
      
      const includes = {
        system: (section.querySelector('#includeSystem') as HTMLInputElement).checked,
        audio: (section.querySelector('#includeAudio') as HTMLInputElement).checked,
        lighting: (section.querySelector('#includeLighting') as HTMLInputElement).checked,
        effects: (section.querySelector('#includeEffects') as HTMLInputElement).checked,
        scenes: (section.querySelector('#includeScenes') as HTMLInputElement).checked,
        fixtures: (section.querySelector('#includeFixtures') as HTMLInputElement).checked,
        rules: (section.querySelector('#includeRules') as HTMLInputElement).checked
      };
      
      try {
        const backup = await apiClient.createBackup({
          name,
          description,
          restorePoint: createRestorePoint,
          includes
        });
        
        // Add to local list
        extendedStore.setState({
          config: {
            ...state.config,
            backups: [
              ...state.config.backups,
              {
                id: backup.id,
                name: backup.name,
                timestamp: backup.timestamp,
                size: backup.size
              }
            ]
          }
        });
        
        backupOptions.style.display = 'none';
        updateView();
        
      } catch (error) {
        console.error('Failed to create backup:', error);
        alert('Failed to create backup: ' + (error instanceof Error ? error.message : String(error)));
      }
    };
    
    cancelCreateBackup.onclick = () => {
      backupOptions.style.display = 'none';
    };
    
    // Setup backup item actions
    setTimeout(() => {
      section.querySelectorAll('.action-button.restore').forEach(button => {
        button.addEventListener('click', async (e) => {
          const backupId = (e.target as HTMLElement).getAttribute('data-id');
          if (backupId && confirm('Are you sure you want to restore this backup? Current configuration will be replaced.')) {
            try {
              await apiClient.restoreBackup(backupId);
              alert('Backup restored successfully. Page will refresh.');
              window.location.reload();
            } catch (error) {
              alert('Failed to restore backup: ' + error);
            }
          }
        });
      });
      
      section.querySelectorAll('.action-button.download').forEach(button => {
        button.addEventListener('click', async (e) => {
          const backupId = (e.target as HTMLElement).getAttribute('data-id');
          if (backupId) {
            // Implement download logic
            alert('Download functionality would be implemented here');
          }
        });
      });
      
      section.querySelectorAll('.action-button.delete').forEach(button => {
        button.addEventListener('click', async (e) => {
          const backupId = (e.target as HTMLElement).getAttribute('data-id');
          if (backupId && confirm('Are you sure you want to delete this backup?')) {
            try {
              await apiClient.deleteBackup(backupId);
              
              // Remove from local list
              extendedStore.setState({
                config: {
                  ...state.config,
                  backups: state.config.backups.filter(b => b.id !== backupId)
                }
              });
              
              updateView();
            } catch (error) {
              alert('Failed to delete backup: ' + error);
            }
          }
        });
      });
    }, 0);
    
    return section;
  }
  
  // Initial render
  updateView();
  
  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .import-export-panel {
      background: var(--panel-bg, #1e1e1e);
      border-radius: 8px;
      padding: 1.5rem;
      color: var(--text-color, #ffffff);
    }
    
    .panel-header {
      margin-bottom: 1.5rem;
    }
    
    .panel-header h3 {
      margin: 0 0 0.5rem;
      font-size: 1.5rem;
    }
    
    .panel-header p {
      margin: 0;
      opacity: 0.7;
      font-size: 0.9rem;
    }
    
    .panel-tabs {
      display: flex;
      gap: 1px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 1.5rem;
    }
    
    .panel-tab {
      flex: 1;
      padding: 0.75rem;
      background: transparent;
      border: none;
      color: var(--text-color, #ffffff);
      cursor: pointer;
      font-size: 0.9rem;
      transition: background 0.2s;
    }
    
    .panel-tab:hover {
      background: rgba(255, 255, 255, 0.05);
    }
    
    .panel-tab.active {
      background: rgba(255, 255, 255, 0.15);
      font-weight: 500;
    }
    
    .panel-content {
      margin-bottom: 1.5rem;
    }
    
    .section-description {
      margin-bottom: 1.5rem;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 6px;
    }
    
    .section-description p {
      margin: 0 0 0.5rem;
    }
    
    .section-description p:last-child {
      margin-bottom: 0;
    }
    
    .warning {
      color: #ff6b6b;
    }
    
    .option-group {
      margin-bottom: 1rem;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 6px;
    }
    
    .option-group label {
      display: block;
      margin-bottom: 0.5rem;
      cursor: pointer;
    }
    
    .option-group label:last-child {
      margin-bottom: 0;
    }
    
    .option-group input[type="checkbox"],
    .option-group input[type="radio"] {
      margin-right: 0.5rem;
    }
    
    .file-drop-area {
      border: 2px dashed rgba(255, 255, 255, 0.3);
      border-radius: 8px;
      padding: 3rem 1rem;
      text-align: center;
      cursor: pointer;
      transition: border-color 0.2s, background 0.2s;
      margin-bottom: 1.5rem;
    }
    
    .file-drop-area:hover,
    .file-drop-area.dragover {
      border-color: rgba(255, 255, 255, 0.6);
      background: rgba(255, 255, 255, 0.05);
    }
    
    .drop-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
      opacity: 0.7;
    }
    
    .drop-text strong {
      display: block;
      margin-bottom: 0.5rem;
      font-size: 1.1rem;
    }
    
    .drop-text p {
      margin: 0;
      opacity: 0.7;
    }
    
    .export-actions,
    .backup-actions {
      display: flex;
      gap: 1rem;
      margin: 1.5rem 0;
    }
    
    .export-button,
    .backup-button {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
      transition: opacity 0.2s, transform 0.2s;
    }
    
    .export-button:disabled,
    .backup-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .export-button:hover:not(:disabled),
    .backup-button:hover:not(:disabled) {
      transform: translateY(-1px);
    }
    
    .export-button.primary,
    .backup-button.primary {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
    }
    
    .export-button.secondary,
    .backup-button.secondary {
      background: rgba(255, 255, 255, 0.1);
      color: white;
    }
    
    .backup-list {
      margin-top: 1.5rem;
    }
    
    .backup-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 6px;
      margin-bottom: 0.5rem;
    }
    
    .backup-info {
      flex: 1;
    }
    
    .backup-name {
      font-weight: 500;
      margin-bottom: 0.25rem;
    }
    
    .backup-details {
      display: flex;
      gap: 1rem;
      font-size: 0.8rem;
      opacity: 0.7;
    }
    
    .backup-actions {
      display: flex;
      gap: 0.5rem;
    }
    
    .action-button {
      padding: 0.25rem 0.75rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.8rem;
      transition: background 0.2s;
    }
    
    .action-button.restore {
      background: rgba(76, 175, 80, 0.2);
      color: #4caf50;
    }
    
    .action-button.download {
      background: rgba(33, 150, 243, 0.2);
      color: #2196f3;
    }
    
    .action-button.delete {
      background: rgba(244, 67, 54, 0.2);
      color: #f44336;
    }
    
    .action-button:hover {
      opacity: 0.8;
    }
    
    .empty-message {
      text-align: center;
      padding: 2rem;
      opacity: 0.7;
      font-style: italic;
    }
    
    .panel-status {
      margin-top: 1rem;
      padding: 1rem;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.05);
    }
    
    .progress-container {
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      overflow: hidden;
      margin-bottom: 0.5rem;
    }
    
    .progress-bar {
      height: 100%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      transition: width 0.3s;
    }
    
    .progress-text {
      text-align: center;
      font-size: 0.9rem;
      opacity: 0.8;
    }
    
    .error-message {
      color: #ff6b6b;
      text-align: center;
    }
    
    @media (max-width: 768px) {
      .import-export-panel {
        padding: 1rem;
      }
      
      .export-actions,
      .backup-actions {
        flex-direction: column;
      }
      
      .backup-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
      }
      
      .backup-actions {
        width: 100%;
        justify-content: flex-end;
      }
    }
  `;
  container.appendChild(style);
  
  return container;
}
            <input type="checkbox" id="exportIncludeSchema" checked>
            Include schema
          </label>
          <label>
            <input type="checkbox" id="exportIncludeMetadata" checked>
            Include metadata
          </label>
          <label>
            <input type="checkbox" id="exportIncludeVersions">
            Include version history
          </label>
        </div>
        
        <div class="option-group">
          <label>
            <input type="checkbox" id="exportCompress">
            Compress (gzip)
          </label>
        </div>
        
        <div class="option-group">
          <label>File name:</label>
          <input type="text" id="exportFileName" value="dmx-config-${new Date().toISOString().split('T')[0]}" placeholder="Enter file name">
        </div>
      </div>
      
      <div class="export-actions">
        <button class="export-button" id="exportButton" ${!config ? 'disabled' : ''}>
          Export Configuration
        </button>
        <button class="export-button secondary" id="exportClipboardButton" ${!config ? 'disabled' : ''}>
          Copy to Clipboard
        </button>
      </div>
      
      <div class="export-preview" style="display: none;">
        <h4>Preview</h4>
        <pre id="exportPreview"></pre>
      </div>
    `;
    
    const exportButton = section.querySelector('#exportButton') as HTMLButtonElement;
    const clipboardButton = section.querySelector('#exportClipboardButton') as HTMLButtonElement;
    
    exportButton.onclick = async () => {
      if (!config) return;
      
      const format = (section.querySelector('#exportFormat') as HTMLSelectElement).value;
      const includeSchema = (section.querySelector('#exportIncludeSchema') as HTMLInputElement).checked;
      const includeMetadata = (section.querySelector('#exportIncludeMetadata') as HTMLInputElement).checked;
      const includeVersions = (section.querySelector('#exportIncludeVersions') as HTMLInputElement).checked;
      const compress = (section.querySelector('#exportCompress') as HTMLInputElement).checked;
      const fileName = (section.querySelector('#exportFileName') as HTMLInputElement).value || 'config';
      
      const options: ConfigImportExportOptions = {
        format: format as any,
        includeSchema,
        includeMetadata,
        includeVersions,
        compress
      };
      
      // Update store
      extendedStore.setState({
        config: {
          ...state.config,
          importExport: {
            isImporting: false,
            isExporting: true,
            progress: 0,
            error: null
          }
        }
      });
      
      try {
        // Simulate progress
        const progressInterval = setInterval(() => {
          const currentProgress = extendedStore.getState().config.importExport.progress;
          if (currentProgress < 90) {
            extendedStore.setState({
              config: {
                ...extendedStore.getState().config,
                importExport: {
                  ...extendedStore.getState().config.importExport,
                  progress: currentProgress + 10
                }
              }
            });
          }
        }, 200);
        
        // Export
        const blob = await apiClient.exportConfig(props.configId || 'current', options);
        
        clearInterval(progressInterval);
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.${format}${compress ? '.gz' : ''}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Update store
        extendedStore.setState({
          config: {
            ...extendedStore.getState().config,
            importExport: {
              isImporting: false,
              isExporting: false,
              progress: 100,
              error: null
            }
          }
        });
        
        // Call callback
        if (props.onExport) {
          props.onExport();
        }
        
        // Reset progress after delay
        setTimeout(() => {
          extendedStore.setState({
            config: {
              ...extendedStore.getState().config,
              importExport: {
                isImporting: false,
                isExporting: false,
                progress: 0,
                error: null
              }
            }
          });
        }, 2000);
        
      } catch (error) {
        extendedStore.setState({
          config: {
            ...state.config,
            importExport: {
              isImporting: false,
              isExporting: false,
              progress: 0,
              error: error instanceof Error ? error.message : 'Export failed'
            }
          }
        });
      }
    };
    
    clipboardButton.onclick = async () => {
      if (!config) return;
      
      try {
        const configStr = JSON.stringify(config, null, 2);
        await navigator.clipboard.writeText(configStr);
        
        // Show success feedback
        clipboardButton.textContent = 'Copied!';
        setTimeout(() => {
          clipboardButton.textContent = 'Copy to Clipboard';
        }, 2000);
      } catch (error) {
        alert('Failed to copy to clipboard: ' + error);
      }
    };
    
    return section;
  }
  
  function createBackupSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'backup-section';
    
    const backups = state.config.backups;
    
    section.innerHTML = `
      <div class="section-description">
        <p>Create and manage configuration backups. Backups include all system configurations.</p>
      </div>
      
      <div class="backup-actions">
        <button class="backup-button primary" id="createBackupButton">
          Create New Backup
        </button>
        <button class="backup-button secondary" id="refreshBackupsButton">
          Refresh List
        </button>
      </div>
      
      <div class="backup-list">
        <h4>Available Backups</h4>
        ${backups.length === 0 ? 
          '<p class="empty-message">No backups available. Create your first backup.</p>' : 
          backups.map(backup => `
            <div class="backup-item">
              <div class="backup-info">
                <div class="backup-name">${backup.name}</div>
                <div class="backup-details">
                  <span class="backup-size">${formatBytes(backup.size)}</span>
                  <span class="backup-date">${new Date(backup.timestamp).toLocaleString()}</span>
                </div>
              </div>
              <div class="backup-actions">
                <button class="action-button restore" data-id="${backup.id}">Restore</button>
                <button class="action-button download" data-id="${backup.id}">Download</button>
                <button class="action-button delete" data-id="${backup.id}">Delete</button>
              </div>
            </div>
          `).join('')
        }
      </div>
      
      <div class="backup-options" style="display: none;">
        <h4>Backup Options</h4>
        <div class="option-group">
          <label>Backup name:</label>
          <input type="text" id="backupName" value="Backup-${new Date().toISOString().replace(/[:.]/g, '-')}">
        </div>
        
        <div class="option-group">
          <label>Description:</label>
          <textarea id="backupDescription" rows="3" placeholder="Optional description"></textarea>
        </div>
        
        <div class="option-group">
          <h5>Include in backup:</h5>
          <label>
            <input type="checkbox" id="includeSystem" checked>
            System configuration
          </label>
          <label>
            <input type="checkbox" id="includeAudio" checked>
            Audio settings
          </label>
          <label>
            <input type="checkbox" id="includeLighting" checked>
            Lighting configuration
          </label>
          <label>
