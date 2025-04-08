// Manages the Three.js scene, camera, and renderer
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class SceneManager {
    constructor(canvas) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x222222);
        
        // Create camera
        this.camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
        this.camera.position.z = 5;
        this.camera.position.y = 2;
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // Create controls for camera manipulation
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        
        // Setup lighting and environment
        this.setupLighting();
        
        // Add grid
        this.setupGrid();
        
        // Store current model
        this.currentModel = null;
        
        // Bind methods
        this.onWindowResize = this.onWindowResize.bind(this);
    }
    
    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(directionalLight);
    }
    
    setupGrid() {
        const gridHelper = new THREE.GridHelper(10, 10);
        this.scene.add(gridHelper);
    }
    
    update() {
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
    
    getScene() {
        return this.scene;
    }
    
    getCamera() {
        return this.camera;
    }
    
    getRenderer() {
        return this.renderer;
    }
    
    getControls() {
        return this.controls;
    }
    
    setCurrentModel(model) {
        if (this.currentModel) {
            this.scene.remove(this.currentModel);
        }
        this.currentModel = model;
        if (model) {
            this.scene.add(model);
        }
    }
    
    getCurrentModel() {
        return this.currentModel;
    }
    
    resetView() {
        if (this.currentModel) {
            // Center the model
            const box = new THREE.Box3().setFromObject(this.currentModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            this.currentModel.position.sub(center);
            
            // Reset camera
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = this.camera.fov * (Math.PI / 180);
            const cameraDistance = maxDim / (2 * Math.tan(fov / 2));
            
            this.camera.position.set(0, maxDim / 2, cameraDistance * 1.5);
            this.camera.lookAt(0, 0, 0);
            
            this.controls.target.set(0, 0, 0);
            this.controls.update();
        }
    }
    
    onWindowResize() {
        const canvas = this.renderer.domElement;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }
}
