// Handles UI interactions and updates

export class UIController {
    constructor(sourcePointManager, sceneManager, modelLoader, simulationRunner) {
        this.sourcePointManager = sourcePointManager;
        this.sceneManager = sceneManager;
        this.modelLoader = modelLoader;
        this.simulationRunner = simulationRunner;
        
        // Store simulation parameters
        this.forceValue = 50;
    }
    
    setupEventListeners() {
        // Model upload handling
        const modelUpload = document.getElementById('model-upload');
        if (modelUpload) {
            modelUpload.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    const file = e.target.files[0];
                    this.loadModel(file);
                }
            });
        } else {
            console.warn('Element not found: model-upload');
        }
        
        // Force slider control
        const forceSlider = document.getElementById('force-slider');
        if (forceSlider) {
            forceSlider.addEventListener('input', (e) => {
                this.forceValue = parseInt(e.target.value);
                const forceValueEl = document.getElementById('force-value');
                if (forceValueEl) {
                    forceValueEl.textContent = this.forceValue;
                }
            });
        } else {
            console.warn('Element not found: force-slider');
        }
        
        // Buttons
        const runButton = document.getElementById('run-simulation');
        if (runButton) {
            runButton.addEventListener('click', () => this.runSimulation());
        } else {
            console.warn('Element not found: run-simulation');
        }
        
        const resetButton = document.getElementById('reset-view');
        if (resetButton) {
            resetButton.addEventListener('click', () => this.sceneManager.resetView());
        } else {
            console.warn('Element not found: reset-view');
        }
        
        // Add mouse event listeners for source point interaction
        const renderer = this.sceneManager.getRenderer().domElement;
        if (renderer) {
            renderer.addEventListener('mousedown', this.sourcePointManager.onMouseDown);
            renderer.addEventListener('mousemove', this.sourcePointManager.onMouseMove);
            renderer.addEventListener('mouseup', this.sourcePointManager.onMouseUp);
            renderer.addEventListener('mouseleave', this.sourcePointManager.onMouseUp);
        } else {
            console.warn('Renderer element not found');
        }
    }
    
    loadModel(file) {
        this.showLoading(true);
        
        this.modelLoader.loadModel(file)
            .then(model => {
                this.sceneManager.setCurrentModel(model);
                this.sceneManager.resetView();
                this.showLoading(false);
                document.getElementById('stats').innerHTML = '<p>Model loaded. Run the simulation to analyze splashback.</p>';
            })
            .catch(error => {
                console.error('Error loading model:', error);
                this.showLoading(false);
                document.getElementById('stats').innerHTML = `<p class="error">Error loading model: ${error.message}</p>`;
            });
    }
    
    runSimulation() {
        const currentModel = this.sceneManager.getCurrentModel();
        if (!currentModel) {
            alert('Please upload a model first');
            return;
        }
        
        this.showLoading(true);
        
        // Run simulation in next tick to allow UI updates
        setTimeout(() => {
            try {
                const sourcePoint = this.sourcePointManager.getSourcePoint();
                const results = this.simulationRunner.runSimulation(
                    currentModel,
                    sourcePoint,
                    this.forceValue
                );
                
                // Update stats display
                const statsHtml = `
                    <p>Simulation complete!</p>
                    <p>Average splashback factor: ${results.averageSplashback.toFixed(2)}</p>
                    <p>Worst splashback area: ${results.maxSplashback.toFixed(2)}</p>
                    <p>Best splashback area: ${results.minSplashback.toFixed(2)}</p>
                `;
                document.getElementById('stats').innerHTML = statsHtml;
                
                this.showLoading(false);
            } catch (error) {
                console.error('Simulation error:', error);
                document.getElementById('stats').innerHTML = `<p class="error">Simulation failed: ${error.message}</p>`;
                this.showLoading(false);
            }
        }, 100);
    }
    
    showLoading(show) {
        document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none';
    }
}
