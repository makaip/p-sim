export default class Controls {
    constructor(app) {
        this.app = app;
        
        // Get UI elements
        this.flowRateControl = document.getElementById('flow-rate');
        
        this.directionXControl = document.getElementById('direction-x');
        this.directionYControl = document.getElementById('direction-y');
        this.directionZControl = document.getElementById('direction-z');
        
        this.positionXControl = document.getElementById('position-x');
        this.positionYControl = document.getElementById('position-y');
        this.positionZControl = document.getElementById('position-z');
        
        this.resetButton = document.getElementById('reset-heatmap');
        this.downloadButton = document.getElementById('download-heatmap');
        
        // Model upload handling
        this.modelUpload = document.getElementById('model-upload');
        
        // Setup event listeners
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Monitor for direction and position changes
        this.directionXControl.addEventListener('input', this.updateDirectionIndicator.bind(this));
        this.directionYControl.addEventListener('input', this.updateDirectionIndicator.bind(this));
        this.directionZControl.addEventListener('input', this.updateDirectionIndicator.bind(this));
        
        this.positionXControl.addEventListener('input', this.updatePositionIndicator.bind(this));
        this.positionYControl.addEventListener('input', this.updatePositionIndicator.bind(this));
        this.positionZControl.addEventListener('input', this.updatePositionIndicator.bind(this));
        
        // Button controls
        this.resetButton.addEventListener('click', () => {
            this.app.resetHeatmap();
        });
        
        this.downloadButton.addEventListener('click', () => {
            this.app.downloadResults();
        });
        
        // Listen for model ready event
        document.addEventListener('model-ready', (event) => {
            this.app.loadedModel = event.detail;
            
            // Create position and direction indicators
            this.createPositionIndicator();
            this.createDirectionIndicator();
            
            // Enable simulation controls
            this.resetButton.disabled = false;
            this.downloadButton.disabled = false;
            
            // Start simulation immediately
            this.app.startSimulation();
        });
    }
    
    createPositionIndicator() {
        // Create a small sphere to indicate the source position
        if (this.positionIndicator) {
            this.app.scene.remove(this.positionIndicator);
        }
        
        const geometry = new THREE.SphereGeometry(0.1, 16, 16);
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        this.positionIndicator = new THREE.Mesh(geometry, material);
        
        // Set initial position
        const pos = this.getPosition();
        this.positionIndicator.position.copy(pos);
        
        this.app.scene.add(this.positionIndicator);
    }
    
    createDirectionIndicator() {
        // Create an arrow to indicate the pee direction
        if (this.directionIndicator) {
            this.app.scene.remove(this.directionIndicator);
        }
        
        const pos = this.getPosition();
        const dir = this.getDirection();
        
        // Create arrow geometry pointing in the direction
        const origin = pos;
        const length = 2;
        const arrowHelper = new THREE.ArrowHelper(
            dir,
            origin,
            length,
            0x00ffff,
            0.3,
            0.2
        );
        
        this.directionIndicator = arrowHelper;
        this.app.scene.add(this.directionIndicator);
    }
    
    updatePositionIndicator() {
        if (!this.positionIndicator) return;
        
        const pos = this.getPosition();
        this.positionIndicator.position.copy(pos);
        
        // Also update direction indicator
        this.updateDirectionIndicator();
        
        // Update the heatmap visualizer with new position and direction
        if (this.app.heatmapVisualizer) {
            const dir = this.getDirection();
            this.app.heatmapVisualizer.updateUserControls(pos, dir);
            
            // Force immediate update of the heatmap
            this.app.heatmapVisualizer.update();
        }
        
        // Update simulation if it's running
        if (this.app.isSimulationRunning) {
            this.app.stopSimulation();
            this.app.startSimulation();
        }
    }
    
    updateDirectionIndicator() {
        if (!this.directionIndicator) return;
        
        const pos = this.getPosition();
        const dir = this.getDirection();
        
        this.directionIndicator.position.copy(pos);
        this.directionIndicator.setDirection(dir);
        
        // Update the heatmap visualizer with new position and direction
        if (this.app.heatmapVisualizer) {
            this.app.heatmapVisualizer.updateUserControls(pos, dir);
            
            // Force immediate update of the heatmap
            this.app.heatmapVisualizer.update();
        }
        
        // Update simulation if it's running
        if (this.app.isSimulationRunning) {
            this.app.stopSimulation();
            this.app.startSimulation();
        }
    }
    
    getFlowRate() {
        return parseInt(this.flowRateControl.value);
    }
    
    getDirection() {
        const x = parseFloat(this.directionXControl.value);
        const y = parseFloat(this.directionYControl.value);
        const z = parseFloat(this.directionZControl.value);
        
        const direction = new THREE.Vector3(x, y, z);
        return direction.normalize();
    }
    
    getPosition() {
        const x = parseFloat(this.positionXControl.value);
        const y = parseFloat(this.positionYControl.value);
        const z = parseFloat(this.positionZControl.value);
        
        return new THREE.Vector3(x, y, z);
    }
}
