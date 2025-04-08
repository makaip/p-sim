import ModelLoader from './modelLoader.js';
import FluidSimulation from './fluidSimulation.js';
import HeatmapVisualizer from './heatmapVisualizer.js';
import Controls from './controls.js';

class App {
    constructor() {
        // Initialize Three.js scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);
        
        // Setup camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 5, 10);
        
        // Setup renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth - 340, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);
        
        // Setup controls
        this.orbitControls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        
        // Setup lighting
        this.setupLighting();
        
        // Initialize components
        this.modelLoader = new ModelLoader(this.scene);
        this.fluidSimulation = new FluidSimulation();
        this.heatmapVisualizer = new HeatmapVisualizer();
        this.controls = new Controls(this);
        
        // Model and simulation state
        this.loadedModel = null;
        this.isSimulationRunning = false;
        this.debugMode = false; // Debug mode flag
        
        // Resize handler
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // Add debug key handler
        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        // Start render loop
        this.animate();
    }
    
    setupLighting() {
        // Ambient light
        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient);
        
        // Directional light (sun)
        const directional = new THREE.DirectionalLight(0xffffff, 0.8);
        directional.position.set(5, 10, 7.5);
        directional.castShadow = true;
        
        // Configure shadow properties
        directional.shadow.mapSize.width = 2048;
        directional.shadow.mapSize.height = 2048;
        directional.shadow.camera.near = 0.5;
        directional.shadow.camera.far = 50;
        directional.shadow.camera.left = -10;
        directional.shadow.camera.right = 10;
        directional.shadow.camera.top = 10;
        directional.shadow.camera.bottom = -10;
        
        this.scene.add(directional);
    }
    
    onWindowResize() {
        this.camera.aspect = (window.innerWidth - 340) / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth - 340, window.innerHeight);
    }
    
    handleKeyDown(event) {
        // Toggle debug mode with "D" key
        if (event.key === 'd' || event.key === 'D') {
            this.debugMode = !this.debugMode;
            const debugInfo = document.getElementById('debug-info');
            if (debugInfo) {
                debugInfo.style.display = this.debugMode ? 'block' : 'none';
                if (this.debugMode) {
                    this.updateDebugInfo();
                }
            }
        }
    }
    
    updateDebugInfo() {
        if (!this.debugMode) return;
        
        const debugInfo = document.getElementById('debug-info');
        if (!debugInfo) return;
        
        let infoText = "Debug Info:\n";
        infoText += `- Model loaded: ${this.loadedModel ? 'Yes' : 'No'}\n`;
        infoText += `- Simulation running: ${this.isSimulationRunning ? 'Yes' : 'No'}\n`;
        
        if (this.loadedModel) {
            let meshCount = 0;
            let validMeshes = 0;
            let totalVertices = 0;
            let totalFaces = 0;
            
            this.loadedModel.traverse(node => {
                if (node.isMesh) {
                    meshCount++;
                    if (node.geometry) {
                        const geo = node.geometry;
                        totalVertices += geo.attributes.position ? geo.attributes.position.count : 0;
                        totalFaces += geo.index ? geo.index.count / 3 : 0;
                        if (geo.attributes.uv && geo.index) {
                            validMeshes++;
                        }
                    }
                }
            });
            
            infoText += `- Meshes: ${meshCount} (${validMeshes} with UVs)\n`;
            infoText += `- Vertices: ${totalVertices}\n`;
            infoText += `- Faces: ${totalFaces}\n`;
        }
        
        debugInfo.textContent = infoText;
    }
    
    startSimulation() {
        if (!this.loadedModel) return;
        this.isSimulationRunning = true;
        
        // Get current parameters from UI controls
        const flowRate = this.controls.getFlowRate();
        const direction = this.controls.getDirection();
        const position = this.controls.getPosition();
        
        // Initialize fluid simulation with parameters
        this.fluidSimulation.init(this.loadedModel, this.scene, position, direction, flowRate);
        
        // Initialize heatmap visualizer and update with current position/direction
        this.heatmapVisualizer.init(this.loadedModel);
        this.heatmapVisualizer.updateUserControls(position, direction);
        
        // Force an immediate update of the heatmap
        this.heatmapVisualizer.update();
    }
    
    stopSimulation() {
        this.isSimulationRunning = false;
        this.fluidSimulation.stop();
    }
    
    resetHeatmap() {
        console.log("App: Resetting heatmap");
        this.heatmapVisualizer.reset();
        
        // Force an immediate update after reset
        this.heatmapVisualizer.update();
    }
    
    downloadResults() {
        this.heatmapVisualizer.downloadResults();
    }
    
    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        // Update debug info periodically if enabled
        if (this.debugMode && Math.random() < 0.02) { // Update roughly every 50 frames
            this.updateDebugInfo();
        }
        
        // Update heatmap visualizer's predictive calculations
        if (this.heatmapVisualizer) {
            this.heatmapVisualizer.update();
        }
        
        // Update simulation if running
        if (this.isSimulationRunning) {
            // Run single step of fluid simulation
            const collisions = this.fluidSimulation.update();
            
            // Update heatmap with new collision data
            if (collisions.length > 0) {
                this.heatmapVisualizer.addCollisionData(collisions);
            }
        }
        
        this.orbitControls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    window.app = app; // Expose app to console for debugging
});
