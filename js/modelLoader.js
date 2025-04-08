import BufferGeometryUtils from './utils/BufferGeometryUtils.js';

export default class ModelLoader {
    constructor(scene) {
        this.scene = scene;
        this.loadedModel = null;
        this.boundingBox = new THREE.Box3();
        
        // Initialize loaders
        this.gltfLoader = new THREE.GLTFLoader();
        this.objLoader = new THREE.OBJLoader();
        
        // Set up event listeners for file input
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        const fileInput = document.getElementById('model-upload');
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            const fileName = file.name.toLowerCase();
            const fileURL = URL.createObjectURL(file);
            
            this.loadModel(fileURL, fileName);
        });
    }
    
    loadModel(fileURL, fileName) {
        // Clear previous model if it exists
        if (this.loadedModel) {
            this.scene.remove(this.loadedModel);
            this.loadedModel = null;
        }
        
        if (fileName.endsWith('.glb') || fileName.endsWith('.gltf')) {
            this.loadGLTF(fileURL);
        } else if (fileName.endsWith('.obj')) {
            this.loadOBJ(fileURL);
        } else {
            alert('Unsupported file format. Please upload .glb, .gltf, or .obj files.');
        }
    }
    
    loadGLTF(url) {
        this.gltfLoader.load(
            url,
            (gltf) => {
                this.processLoadedModel(gltf.scene);
            },
            (xhr) => {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            (error) => {
                console.error('An error happened while loading the model:', error);
                alert('Failed to load the model. See console for details.');
            }
        );
    }
    
    loadOBJ(url) {
        this.objLoader.load(
            url,
            (obj) => {
                this.processLoadedModel(obj);
            },
            (xhr) => {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            (error) => {
                console.error('An error happened while loading the model:', error);
                alert('Failed to load the model. See console for details.');
            }
        );
    }
    
    processLoadedModel(model) {
        // Set up the model for rendering and simulation
        this.setupModel(model);
        
        // Add the model to the scene
        this.scene.add(model);
        this.loadedModel = model;
        
        // Calculate model bounding box
        this.calculateBoundingBox();
        
        // Center and normalize the model
        this.centerAndNormalizeModel();
        
        // Make the model receive shadows
        this.setupShadowsAndMaterials(model);
        
        // Notify that model is ready for simulation
        this.notifyModelReady();
    }
    
    setupModel(model) {
        // Set initial properties
        model.position.set(0, 0, 0);
        model.rotation.set(0, 0, 0);
    }
    
    calculateBoundingBox() {
        this.boundingBox.setFromObject(this.loadedModel);
    }
    
    centerAndNormalizeModel() {
        if (!this.loadedModel) return;
        
        // Calculate the center of the bounding box
        const center = new THREE.Vector3();
        this.boundingBox.getCenter(center);
        
        // Calculate the size of the bounding box
        const size = new THREE.Vector3();
        this.boundingBox.getSize(size);
        
        // Find the maximum dimension to normalize scale
        const maxDimension = Math.max(size.x, size.y, size.z);
        const scale = 5 / maxDimension; // Scale to fit in a 5x5x5 cube
        
        // Apply transformations: center the model and normalize its size
        this.loadedModel.position.sub(center.multiplyScalar(scale));
        this.loadedModel.scale.set(scale, scale, scale);
        
        // Position the model on the ground
        const box = new THREE.Box3().setFromObject(this.loadedModel);
        const offset = -box.min.y;
        this.loadedModel.position.y += offset;
    }
    
    setupShadowsAndMaterials(model) {
        model.traverse((node) => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                
                // Check and process the geometry for proper visualization
                if (node.geometry) {
                    // Add indices if they don't exist
                    if (!node.geometry.index) {
                        console.log(`Creating indices for mesh ${node.name || 'unnamed'}`);
                        this.createIndicesForGeometry(node.geometry);
                    }
                    
                    // Check for UV coordinates and generate them if missing
                    if (!node.geometry.attributes.uv) {
                        console.log(`Generating UVs for mesh ${node.name || 'unnamed'}`);
                        this.generateUVs(node.geometry);
                    }
                }
                
                // Create an improved material if the object doesn't have one
                if (!node.material || node.material.type === 'MeshBasicMaterial') {
                    // Create a phong material for better shading
                    const material = new THREE.MeshPhongMaterial({
                        color: 0xcccccc,
                        specular: 0x111111,
                        shininess: 30,
                        flatShading: false
                    });
                    node.material = material;
                } else if (node.material) {
                    // Enhance the existing material
                    if (node.material.type === 'MeshStandardMaterial') {
                        node.material.roughness = 0.3;
                        node.material.metalness = 0.7;
                    } else {
                        // Convert to phong material
                        const color = node.material.color ? node.material.color.clone() : new THREE.Color(0xcccccc);
                        const phongMaterial = new THREE.MeshPhongMaterial({
                            color: color,
                            specular: 0x222222,
                            shininess: 30,
                            flatShading: false
                        });
                        node.material = phongMaterial;
                    }
                }
                
                // Store original material for later use with heatmap
                node.userData.originalMaterial = node.material.clone();
            }
        });
    }
    
    // Generate simple UV coordinates for meshes that don't have them
    generateUVs(geometry) {
        if (!geometry.isBufferGeometry) return;
        
        const positions = geometry.attributes.position;
        const count = positions.count;
        const uvs = new Float32Array(count * 2);
        
        // Create a simple UV mapping based on position
        for (let i = 0; i < count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = positions.getZ(i);
            
            // Project onto a sphere and then flatten to UV
            const u = 0.5 + Math.atan2(z, x) / (2 * Math.PI);
            const v = 0.5 - Math.asin(y) / Math.PI;
            
            uvs[i * 2] = u;
            uvs[i * 2 + 1] = v;
        }
        
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    }
    
    // Create indices for non-indexed geometry
    createIndicesForGeometry(geometry) {
        if (!geometry.isBufferGeometry) return;
        
        console.log(`Creating indices for geometry with ${geometry.attributes.position.count} vertices`);
        
        // Use our utility function to create indices
        BufferGeometryUtils.createIndices(geometry);
        
        // Additionally, attempt to merge vertices for better performance
        try {
            BufferGeometryUtils.mergeVertices(geometry);
        } catch (error) {
            console.warn("Error while optimizing geometry:", error);
        }
        
        return geometry;
    }
    
    notifyModelReady() {
        // Dispatch custom event when model is fully loaded and ready
        const event = new CustomEvent('model-ready', { detail: this.loadedModel });
        document.dispatchEvent(event);
    }
    
    getLoadedModel() {
        return this.loadedModel;
    }
}
