// Model loader for handling different 3D model formats
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class ModelLoader {
    constructor() {
        // Nothing to initialize
    }
    
    // Load a 3D model based on file type
    loadModel(file) {
        return new Promise((resolve, reject) => {
            const fileName = file.name.toLowerCase();
            const reader = new FileReader();
            
            reader.onload = function(event) {
                const fileContent = event.target.result;
                
                try {
                    if (fileName.endsWith('.obj')) {
                        const loader = new OBJLoader();
                        const object = loader.parse(fileContent);
                        this.prepareModelForSimulation(object);
                        resolve(object);
                    } else if (fileName.endsWith('.stl')) {
                        const loader = new STLLoader();
                        const geometry = loader.parse(fileContent);
                        const material = new THREE.MeshStandardMaterial({
                            color: 0xaaaaaa,
                            metalness: 0.25,
                            roughness: 0.6,
                            flatShading: true
                        });
                        const mesh = new THREE.Mesh(geometry, material);
                        const group = new THREE.Group();
                        group.add(mesh);
                        this.prepareModelForSimulation(group);
                        resolve(group);
                    } else if (fileName.endsWith('.glb') || fileName.endsWith('.gltf')) {
                        const loader = new GLTFLoader();
                        const buffer = fileContent instanceof ArrayBuffer ? fileContent : fileContent.arrayBuffer();
                        loader.parse(buffer, '', (gltf) => {
                            this.prepareModelForSimulation(gltf.scene);
                            resolve(gltf.scene);
                        }, (error) => {
                            reject(new Error('Failed to parse GLTF/GLB file: ' + error.message));
                        });
                    } else {
                        reject(new Error('Unsupported file format. Please upload OBJ, STL, or GLTF/GLB.'));
                    }
                } catch (error) {
                    reject(error);
                }
            }.bind(this);
            
            reader.onerror = function() {
                reject(new Error('Failed to read the file'));
            };
            
            if (fileName.endsWith('.obj') || fileName.endsWith('.stl')) {
                reader.readAsText(file);
            } else {
                reader.readAsArrayBuffer(file);
            }
        });
    }
    
    prepareModelForSimulation(model) {
        // Make sure the model has the properties needed for simulation
        model.traverse(function(child) {
            if (child instanceof THREE.Mesh) {
                // Ensure the geometry has computed face normals
                if (!child.geometry.attributes.normal) {
                    child.geometry.computeVertexNormals();
                }
                
                // Create default UV coordinates if they don't exist
                // This will be needed for applying the heatmap texture later
                if (!child.geometry.attributes.uv) {
                    this.generateSimpleUVs(child.geometry);
                }
                
                // Make the material cloneable for the heatmap
                child.material = new THREE.MeshStandardMaterial({
                    color: 0xaaaaaa,
                    metalness: 0.25,
                    roughness: 0.6,
                    flatShading: true
                });
            }
        }.bind(this));
    }
    
    generateSimpleUVs(geometry) {
        const positions = geometry.attributes.position;
        const count = positions.count;
        const uvs = new Float32Array(count * 2);
        
        // Create a simple UV mapping based on vertex positions
        // This is a placeholder and will generate basic UVs for visualization
        const bbox = new THREE.Box3();
        bbox.setFromBufferAttribute(positions);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        
        for (let i = 0; i < count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            
            // Simple planar mapping - can be improved for better visualizations
            uvs[i * 2] = (x - bbox.min.x) / size.x;
            uvs[i * 2 + 1] = (y - bbox.min.y) / size.y;
        }
        
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    }
}
