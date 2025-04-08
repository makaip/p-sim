// Main application script for Urinal Splashback Simulator
import * as THREE from 'three';
import { SceneManager } from './sceneManager.js';
import { SourcePointManager } from './sourcePointManager.js';
import { UIController } from './uiController.js';
import { SimulationRunner } from './simulationRunner.js';
import { ModelLoader } from './modelLoader.js';

// Main application variables
let sceneManager;
let sourcePointManager;
let uiController;
let simulationRunner;
let modelLoader;

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);

function init() {
    // Initialize scene manager
    sceneManager = new SceneManager(document.getElementById('renderer'));
    
    // Initialize source point manager with initial coordinates
    sourcePointManager = new SourcePointManager(
        sceneManager.getScene(), 
        sceneManager.getCamera(), 
        sceneManager.getControls()
    );
    
    // Initialize model loader
    modelLoader = new ModelLoader();
    
    // Initialize simulation runner
    simulationRunner = new SimulationRunner();
    
    // Initialize UI controller with all required dependencies
    uiController = new UIController(
        sourcePointManager,
        sceneManager,
        modelLoader,
        simulationRunner
    );
    
    // Set up event listeners
    setupEventListeners();
    
    // Start animation loop
    animate();
}

function setupEventListeners() {
    // Let UIController handle most UI events
    uiController.setupEventListeners();
    
    // Additional application-wide event listeners can go here
    window.addEventListener('resize', sceneManager.onWindowResize);
}

function animate() {
    requestAnimationFrame(animate);
    sceneManager.update();
}

