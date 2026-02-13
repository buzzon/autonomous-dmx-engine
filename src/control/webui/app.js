/**
 * Autonomous DMX Engine - Web UI Controller
 * Connects to WebSocket API for real-time control
 */

class DMXControlUI {
    constructor() {
        // WebSocket connection
        this.socket = null;
        this.connectionId = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        // System state
        this.systemState = {
            mode: 'auto',
            globalIntensity: 1.0,
            blackout: false,
            activeSceneId: null,
            activeVenue: null
        };
        
        // Audio metrics
        this.audioMetrics = {
            energy: 0,
            bpm: 0,
            beat: false,
            spectralCentroid: 0
        };
        
        // Initialize UI
        this.initializeElements();
        this.initializeEventListeners();
        this.updateUI();
        
        // Try to auto-connect after a short delay
        setTimeout(() => {
            this.log('System ready. Click "Connect" to establish WebSocket connection.', 'info');
        }, 1000);
    }
    
    /**
     * Initialize DOM element references
     */
    initializeElements() {
        // Connection elements
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        this.connectionDetails = document.getElementById('connectionDetails');
        this.connectBtn = document.getElementById('connectBtn');
        this.disconnectBtn = document.getElementById('disconnectBtn');
        
        // Control elements
        this.modeSelect = document.getElementById('modeSelect');
        this.intensitySlider = document.getElementById('intensitySlider');
        this.intensityValue = document.getElementById('intensityValue');
        this.blackoutBtn = document.getElementById('blackoutBtn');
        this.fullIntensityBtn = document.getElementById('fullIntensityBtn');
        
        // Scene & venue elements
        this.sceneSelect = document.getElementById('sceneSelect');
        this.venueSelect = document.getElementById('venueSelect');
        this.reloadConfigsBtn = document.getElementById('reloadConfigsBtn');
        
        // Display elements
        this.energyValue = document.getElementById('energyValue');
        this.bpmValue = document.getElementById('bpmValue');
        this.beatValue = document.getElementById('beatValue');
        this.centroidValue = document.getElementById('centroidValue');
        
        this.activeMode = document.getElementById('activeMode');
        this.blackoutState = document.getElementById('blackoutState');
        this.activeScene = document.getElementById('activeScene');
        this.activeVenue = document.getElementById('activeVenue');
        
        // Log elements
        this.logContainer = document.getElementById('logContainer');
        this.clearLogBtn = document.getElementById('clearLogBtn');
        
        // Footer elements
        this.wsUrl = document.getElementById('wsUrl');
        this.connectionIdElement = document.getElementById('connectionId');
        this.lastUpdate = document.getElementById('lastUpdate');
    }
    
    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        // Connection buttons
        this.connectBtn.addEventListener('click', () => this.connect());
        this.disconnectBtn.addEventListener('click', () => this.disconnect());
        
        // Control events
        this.modeSelect.addEventListener('change', (e) => this.sendCommand('setMode', { mode: e.target.value }));
        this.intensitySlider.addEventListener('input', (e) => {
            const intensity = parseInt(e.target.value) / 100;
            this.intensityValue.textContent = `${e.target.value}%`;
            this.sendCommand('setIntensity', { intensity });
        });
        
        this.blackoutBtn.addEventListener('click', () => {
            const enable = !this.systemState.blackout;
            this.sendCommand('setBlackout', { enable });
        });
        
        this.fullIntensityBtn.addEventListener('click', () => {
            this.intensitySlider.value = 100;
            this.intensityValue.textContent = '100%';
            this.sendCommand('setIntensity', { intensity: 1.0 });
        });
        
        // Scene & venue events
        this.sceneSelect.addEventListener('change', (e) => {
            this.sendCommand('setScene', { sceneId: e.target.value });
        });
        
        this.venueSelect.addEventListener('change', (e) => {
            this.sendVenueSwitch(e.target.value);
        });
        
        this.reloadConfigsBtn.addEventListener('click', () => {
            this.sendCommand('reloadConfigs', {});
        });
        
        // Log events
        this.clearLogBtn.addEventListener('click', () => {
            this.logContainer.innerHTML = '';
            this.log('Log cleared.', 'info');
        });
    }
    
    /**
     * Connect to WebSocket server
     */
    connect() {
        if (this.isConnected) {
            this.log('Already connected to server.', 'info');
            return;
        }
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        this.log(`Connecting to ${wsUrl}...`, 'info');
        this.updateConnectionStatus('connecting', 'Connecting...');
        
        try {
            // Use socket.io client
            // io is available globally from script tag
            this.socket = io(window.location.origin, {
                path: '/ws',
                transports: ['websocket', 'polling']
            });
            
            this.socket.on('connect', () => {
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus('connected', 'Connected');
                this.log('WebSocket connection established successfully.', 'success');
                
                // Send authentication (simulated for Phase 2)
                this.sendAuthentication();
            });
            
            this.socket.on('message', (event) => {
                // Socket.io event 'message' usually contains data directly
                // But our server might emit specific events like 'loopUpdate'
                // We need to check how server sends data.
                // In engine.ts: broadcastToAll('loopUpdate', ...)
                // In websocket.ts: socket.emit('stateUpdate', ...)
                
                // We should listen to specific events or catch-all if possible?
                // For now, let's assume we handle specific events separately
            });

            this.socket.on('loopUpdate', (data) => {
                 this.handleMessage({ type: 'loopUpdate', data });
            });

            this.socket.on('stateUpdate', (data) => {
                 this.handleMessage({ type: 'stateUpdate', data });
            });
            
            // Handle generic messages if any
            this.socket.on('message', (data) => {
                 // Try to handle as JSON if it matches our structure
                 if (data && data.type) {
                     this.handleMessage(data);
                 }
            });
            
            this.socket.on('disconnect', () => {
                this.isConnected = false;
                this.updateConnectionStatus('disconnected', 'Disconnected');
            });

            this.socket.on('connect_error', (error) => {
                this.isConnected = false;
                this.updateConnectionStatus('error', 'Connection Error');
                this.log(`WebSocket error: ${error.message}`, 'error');
            });
            
        } catch (error) {
            this.log(`Failed to create WebSocket: ${error.message}`, 'error');
            this.updateConnectionStatus('disconnected', 'Connection Failed');
        }
    }
    
    /**
     * Disconnect from WebSocket server
     */
    disconnect() {
        if (!this.socket || !this.isConnected) {
            this.log('Not connected to server.', 'info');
            return;
        }
        
        this.log('Disconnecting from server...', 'info');
        this.socket.close(1000, 'User requested disconnect');
    }
    
    /**
     * Send authentication to server
     */
    handleMessage(data) {
        try {
            // Socket.io sends objects directly
            const message = typeof data === 'string' ? JSON.parse(data) : data;
            
            if (!message) return;

            // Update last update timestamp
            const timeStr = new Date().toLocaleTimeString();
            if (this.lastUpdate) this.lastUpdate.textContent = timeStr;
            
            // Handle different message types
            // Normalized message structure: { type, data } or just mixed
            // If message has 'type' at root, use it.
            
            const msgType = message.type;
            const msgData = message.data || message; // Fallback if data is not wrapped

            if (msgType === 'initialState') {
                this.handleInitialState(msgData);
            } else if (msgType === 'stateUpdate' || msgType === 'loopUpdate') {
                // loopUpdate might contain more than just systemState (e.g. audio, lighting)
                // For now, treat it as state update if it has systemState
                if (msgData.systemState) {
                    this.handleStateUpdate(msgData);
                } else if (msgType === 'loopUpdate') {
                     // If loop update has complex structure, we might need specific handler
                     // For now, assume it might trigger UI updates directly if we had them
                     // or just update audio metrics if present
                     if (msgData.metrics && msgData.metrics.audio) {
                         // We could update audio metrics from server here!
                         // But updateAudioMetrics currently simulates it.
                     }
                }
            } else if (msgType === 'authenticated') {
                this.handleAuthenticated(msgData);
            } else if (msgType === 'error') {
                this.log(`Server Error: ${msgData.message || 'Unknown'}`, 'error');
            } else {
                // Try to infer or just log
                // this.log(`Received: ${JSON.stringify(message)}`, 'debug');
            }
            
        } catch (error) {
            this.log(`Error processing message: ${error.message}`, 'error');
        }
    }

    /**
     * Send authentication to server
     */
    sendAuthentication() {
        if (!this.isConnected) return;
        
        const authMessage = {
            type: 'authenticate',
            token: 'demo-token-phase-2',
            timestamp: Date.now()
        };
        
        this.socket.emit('authenticate', authMessage); // Use emit for specific event or send
        this.log('Authentication sent.', 'info');
    }
    
    /**
     * Send command to server
     */
    sendCommand(type, payload) {
        if (!this.isConnected) {
            this.log(`Cannot send command: Not connected to server.`, 'error');
            return;
        }
        
        const command = {
            type: 'command',
            data: {
                type,
                payload,
                timestamp: Date.now(),
                commandId: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            }
        };
        
        this.socket.emit('command', command);
        this.log(`Command sent: ${type}`, 'info');
    }
    
    /**
     * Send venue switch command
     */
    sendVenueSwitch(venueId) {
        if (!this.isConnected) {
            this.log(`Cannot switch venue: Not connected to server.`, 'error');
            return;
        }
        
        const venueMessage = {
            type: 'switchVenue',
            venueId,
            timestamp: Date.now()
        };
        
        this.socket.emit('command', venueMessage);
        this.log(`Venue switch requested: ${venueId}`, 'info');
    }

    
    /**
     * Handle initial state from server
     */
    handleInitialState(data) {
        this.connectionId = data.connectionId;
        this.connectionIdElement.textContent = this.connectionId || 'N/A';
        
        if (data.systemState) {
            this.systemState = { ...this.systemState, ...data.systemState };
            this.updateSystemStateUI();
        }
        
        if (data.venue) {
            this.systemState.activeVenue = data.venue.id;
            this.updateVenueSelect(data.venue.id);
        }
        
        if (data.availableVenues) {
            this.updateVenueOptions(data.availableVenues);
        }
        
        this.log('Received initial system state from server.', 'success');
        this.updateUI();
    }
    
    /**
     * Handle state update from server
     */
    handleStateUpdate(data) {
        if (data.systemState) {
            this.systemState = { ...this.systemState, ...data.systemState };
            this.updateSystemStateUI();
            this.log('System state updated from server.', 'info');
        }
    }
    
    /**
     * Handle socket.io style message
     */
    handleSocketIOMessage(data) {
        // For Phase 2, we'll handle this generically
        if (data.type === 'initialState') {
            this.handleInitialState(data.data);
        } else if (data.type === 'stateUpdate') {
            this.handleStateUpdate(data.data);
        }
    }
    
    /**
     * Handle authentication response
     */
    handleAuthenticated(data) {
        this.log(`Authenticated as user: ${data.userId || 'Unknown'}`, 'success');
    }
    
    /**
     * Handle venue change notification
     */
    handleVenueChanged(data) {
        this.systemState.activeVenue = data.venueId;
        this.updateVenueSelect(data.venueId);
        this.log(`Venue changed to: ${data.venueId}`, 'success');
        this.updateUI();
    }
    
    /**
     * Handle command response
     */
    handleCommandResponse(data) {
        if (data.success) {
            this.log(`Command executed successfully: ${data.message || 'No message'}`, 'success');
        } else {
            this.log(`Command failed: ${data.error || 'Unknown error'}`, 'error');
        }
    }
    
    /**
     * Update connection status UI
     */
    updateConnectionStatus(status, text) {
        // Update status indicator
        this.statusIndicator.className = 'status-indicator';
        
        switch (status) {
            case 'connected':
                this.statusIndicator.classList.add('status-connected');
                this.statusText.textContent = 'Connected';
                this.connectionDetails.textContent = `Connected to WebSocket server (ID: ${this.connectionId || 'Unknown'})`;
                break;
            case 'connecting':
                this.statusIndicator.classList.add('status-connecting');
                this.statusText.textContent = text || 'Connecting...';
                this.connectionDetails.textContent = 'Establishing connection...';
                break;
            case 'disconnected':
                this.statusIndicator.classList.add('status-disconnected');
                this.statusText.textContent = text || 'Disconnected';
                this.connectionDetails.textContent = 'Not connected to WebSocket server';
                break;
        }
        
        // Update button states
        this.connectBtn.disabled = status === 'connected' || status === 'connecting';
        this.disconnectBtn.disabled = status !== 'connected';
    }
    
    /**
     * Update system state UI
     */
    updateSystemStateUI() {
        // Update mode select
        if (this.systemState.mode) {
            this.modeSelect.value = this.systemState.mode;
            this.activeMode.textContent = this.systemState.mode.charAt(0).toUpperCase() + this.systemState.mode.slice(1);
        }
        
        // Update intensity
        if (this.systemState.globalIntensity !== undefined) {
            const intensityPercent = Math.round(this.systemState.globalIntensity * 100);
            this.intensitySlider.value = intensityPercent;
            this.intensityValue.textContent = `${intensityPercent}%`;
        }
        
        // Update blackout state
        if (this.systemState.blackout !== undefined) {
            this.blackoutState.textContent = this.systemState.blackout ? 'Enabled' : 'Disabled';
            this.blackoutBtn.innerHTML = this.systemState.blackout ? 
                '<i class="fas fa-sun"></i> Restore' : 
                '<i class="fas fa-moon"></i> Blackout';
            this.blackoutBtn.className = this.systemState.blackout ? 'success' : 'danger';
        }
        
        // Update active scene
        if (this.systemState.activeSceneId) {
            this.sceneSelect.value = this.systemState.activeSceneId;
            this.activeScene.textContent = this.systemState.activeSceneId;
        }
    }
    
    /**
     * Update venue select dropdown
     */
    updateVenueSelect(venueId) {
        if (venueId && this.venueSelect) {
            this.venueSelect.value = venueId;
            this.activeVenue.textContent = venueId;
        }
    }
    
    /**
     * Update venue options in dropdown
     */
    updateVenueOptions(venues) {
        if (!venues || !Array.isArray(venues)) return;
        
        // Clear existing options except the first one
        while (this.venueSelect.options.length > 1) {
            this.venueSelect.remove(1);
        }
        
        // Add new venue options
        venues.forEach(venue => {
            if (venue.id && venue.name) {
                const option = document.createElement('option');
                option.value = venue.id;
                option.textContent = venue.name;
                this.venueSelect.appendChild(option);
            }
        });
    }
    
    /**
     * Update audio metrics display
     */
    updateAudioMetrics() {
        // Simulate audio metrics for Phase 2 demo
        // In a real implementation, these would come from the server
        
        // Generate some demo metrics
        const now = Date.now();
        const energy = 0.3 + 0.5 * Math.sin(now / 1000);
        const bpm = 120 + Math.sin(now / 5000) * 20;
        const beat = Math.sin(now / 250) > 0.8;
        const centroid = 500 + 300 * Math.sin(now / 3000);
        
        this.energyValue.textContent = energy.toFixed(2);
        this.bpmValue.textContent = Math.round(bpm);
        this.beatValue.textContent = beat ? 'Beat Detected!' : 'No Beat';
        this.beatValue.style.color = beat ? '#00ff00' : '#ff0000';
        this.centroidValue.textContent = `${Math.round(centroid)} Hz`;
    }
    
    /**
     * Update the entire UI
     */
    updateUI() {
        this.updateAudioMetrics();
        
        // Schedule next update
        setTimeout(() => this.updateUI(), 100);
    }
    
    /**
     * Add log entry
     */
    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `[${timestamp}] ${message}`;
        
        this.logContainer.appendChild(logEntry);
        
        // Auto-scroll to bottom
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
        
        // Keep log size manageable
        const maxEntries = 50;
        while (this.logContainer.children.length > maxEntries) {
            this.logContainer.removeChild(this.logContainer.firstChild);
        }
    }
}

// Initialize the UI when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.dmxUI = new DMXControlUI();
    
    // Add some demo log entries
    setTimeout(() => {
        window.dmxUI.log('Phase 2 Web UI initialized successfully.', 'success');
        window.dmxUI.log('Ready to connect to WebSocket API on port 3001.', 'info');
        window.dmxUI.log('Use the controls to manage the DMX system.', 'info');
    }, 500);
});