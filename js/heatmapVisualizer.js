export default class HeatmapVisualizer {
    constructor() {
        this.targetModel = null;
        this.heatmapData = new Map();  // Map to store splashback data per face
        this.maxIntensity = 1;  // Will be updated as collisions occur
        this.heatmapShader = null;
        this.originalMaterials = new Map();  // Store original materials
        this.userPosition = new THREE.Vector3(); // Current user-controlled position
        this.userDirection = new THREE.Vector3(); // Current user-controlled direction
        
        // Flag to recalculate the entire predictive heatmap
        this.needsFullRecalculation = true;
        
        // Debug counter to track updates
        this.updateCounter = 0;
        
        // Define our heatmap colors from low to high intensity
        this.colorScale = [
            { value: 0.0, color: new THREE.Color(0x0000ff) },  // Blue (high splashback)
            { value: 0.4, color: new THREE.Color(0x00ff00) },  // Green (medium splashback)
            { value: 0.7, color: new THREE.Color(0xffff00) },  // Yellow (low splashback)
            { value: 1.0, color: new THREE.Color(0xff0000) }   // Red (minimal splashback)
        ];
        
        // Create heatmap shader material
        this.createHeatmapShader();
    }
    
    init(model) {
        this.targetModel = model;
        this.heatmapData.clear();
        this.maxIntensity = 1;
        
        // Store original materials and apply heatmap shader
        this.prepareModel();
        
        // Need to do a full predictive calculation
        this.needsFullRecalculation = true;
        console.log("HeatmapVisualizer initialized, will calculate heatmap");
    }
    
    createHeatmapShader() {
        // Define the vertex and fragment shaders for the heatmap
        const vertexShader = `
            varying vec3 vNormal;
            varying vec3 vPosition;
            varying vec2 vUv;
            
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vPosition = position;
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
        
        const fragmentShader = `
            uniform sampler2D heatmapTexture;
            uniform float heatmapIntensity;
            uniform vec3 colorLow;
            uniform vec3 colorMedium;
            uniform vec3 colorHigh;
            uniform vec3 colorMax;
            uniform float mediumPoint;
            uniform float highPoint;
            
            varying vec3 vNormal;
            varying vec3 vPosition;
            varying vec2 vUv;
            
            void main() {
                // Get heatmap value from texture
                float intensity = texture2D(heatmapTexture, vUv).r * heatmapIntensity;
                
                // Calculate color based on intensity
                vec3 color;
                
                if (intensity < mediumPoint) {
                    float t = intensity / mediumPoint;
                    color = mix(colorLow, colorMedium, t);
                } else if (intensity < highPoint) {
                    float t = (intensity - mediumPoint) / (highPoint - mediumPoint);
                    color = mix(colorMedium, colorHigh, t);
                } else {
                    float t = (intensity - highPoint) / (1.0 - highPoint);
                    color = mix(colorHigh, colorMax, t);
                }
                
                // Add some specular highlights
                vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
                float specular = pow(max(dot(reflect(-lightDir, vNormal), vec3(0.0, 0.0, 1.0)), 0.0), 20.0) * 0.5;
                
                gl_FragColor = vec4(color + specular, 1.0);
            }
        `;
        
        // Create the heatmap shader material
        this.heatmapShader = {
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: {
                heatmapTexture: { value: null },
                heatmapIntensity: { value: 1.0 },
                colorLow: { value: this.colorScale[0].color },
                colorMedium: { value: this.colorScale[1].color },
                colorHigh: { value: this.colorScale[2].color },
                colorMax: { value: this.colorScale[3].color },
                mediumPoint: { value: this.colorScale[1].value },
                highPoint: { value: this.colorScale[2].value }
            }
        };
    }
    
    prepareModel() {
        if (!this.targetModel) return;
        
        let hasValidMeshes = false;
        
        this.targetModel.traverse((node) => {
            if (node.isMesh) {
                // Check if the geometry is suitable for heatmap visualization
                const isValidGeometry = this.validateGeometry(node.geometry);
                
                if (isValidGeometry) {
                    hasValidMeshes = true;
                    // Store the original material
                    this.originalMaterials.set(node.uuid, node.material);
                    
                    // Create a texture for the heatmap
                    const heatmapTexture = this.createHeatmapTexture();
                    
                    // Create a new shader material based on our heatmap shader
                    const material = new THREE.ShaderMaterial({
                        vertexShader: this.heatmapShader.vertexShader,
                        fragmentShader: this.heatmapShader.fragmentShader,
                        uniforms: {
                            heatmapTexture: { value: heatmapTexture },
                            heatmapIntensity: { value: 1.0 },
                            colorLow: { value: this.colorScale[0].color.clone() },
                            colorMedium: { value: this.colorScale[1].color.clone() },
                            colorHigh: { value: this.colorScale[2].color.clone() },
                            colorMax: { value: this.colorScale[3].color.clone() },
                            mediumPoint: { value: this.colorScale[1].value },
                            highPoint: { value: this.colorScale[2].value }
                        }
                    });
                    
                    // Store mesh data for later updates
                    node.userData.heatmapMaterial = material;
                    node.userData.heatmapTexture = heatmapTexture;
                    node.userData.heatmapValid = true;
                    
                    // Apply the heatmap material
                    node.material = material;
                } else {
                    console.warn(`Mesh ${node.name || 'unnamed'} has invalid geometry for heatmap`);
                    node.userData.heatmapValid = false;
                    
                    // Apply a basic color material for visualization fallback
                    const fallbackMaterial = new THREE.MeshPhongMaterial({
                        color: 0x0000ff, // Default to blue
                        specular: 0x222222,
                        shininess: 30
                    });
                    
                    node.userData.fallbackMaterial = fallbackMaterial;
                    this.originalMaterials.set(node.uuid, node.material);
                    node.material = fallbackMaterial;
                }
            }
        });
        
        if (!hasValidMeshes) {
            console.error("No valid meshes found for heatmap visualization. Please use a model with proper geometry.");
            const statusElement = document.getElementById('status');
            if (statusElement) {
                statusElement.textContent = "Error: Model lacks proper geometry for heatmap. See console for details.";
                statusElement.style.color = "red";
            }
        }
    }
    
    validateGeometry(geometry) {
        if (!geometry || !geometry.isBufferGeometry) return false;
        
        // Check if geometry has indices
        const hasIndices = geometry.index !== null;
        
        // Check if geometry has UV coordinates
        const hasUVs = geometry.attributes.uv !== undefined;
        
        // Check if geometry has normals
        const hasNormals = geometry.attributes.normal !== undefined;
        
        // Verify index count is a multiple of 3 (triangles)
        const validIndices = hasIndices && geometry.index.count % 3 === 0;
        
        // Log the validation status
        console.log(`Geometry validation for ${geometry.uuid}: 
            Indices: ${hasIndices} (${validIndices ? 'valid' : 'invalid'}, count: ${hasIndices ? geometry.index.count : 0}), 
            UVs: ${hasUVs}, 
            Normals: ${hasNormals}, 
            Vertices: ${geometry.attributes.position ? geometry.attributes.position.count : 0}
        `);
        
        // Return true if geometry has all required attributes, otherwise false
        return validIndices && hasUVs && hasNormals;
    }

    createHeatmapTexture() {
        // Create a blank texture to hold heatmap data
        const size = 1024;
        const data = new Uint8Array(size * size * 4);
        
        // Initialize to zero (no heat)
        for (let i = 0; i < size * size * 4; i += 4) {
            data[i] = 0;      // R
            data[i + 1] = 0;  // G
            data[i + 2] = 0;  // B
            data[i + 3] = 255;// A
        }
        
        // Create the texture
        const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
        texture.needsUpdate = true;
        
        return texture;
    }
    
    addCollisionData(collisions) {
        // More robust input validation
        if (!this.targetModel || !collisions) {
            console.warn("Invalid collision data or no target model");
            return;
        }
        
        // Force collisions to be an array
        const collisionArray = Array.isArray(collisions) ? collisions : [];
        if (collisionArray.length === 0) {
            return;
        }
        
        // Process each collision
        collisionArray.forEach(collision => {
            if (!collision || !collision.point) {
                console.warn("Invalid collision data received");
                return;
            }
            
            // Calculate intensity based on velocity and angle of impact
            const angleNormalized = 1 - (collision.angle / Math.PI); 
            const velocityFactor = collision.velocity / 10;
            const intensity = angleNormalized * velocityFactor;
            
            try {
                // Store collision data with error catching
                this.updateHeatmapForCollision(collision.point, intensity);
                
                // Update max intensity
                if (intensity > this.maxIntensity) {
                    this.maxIntensity = intensity;
                    this.updateHeatmapVisualization();
                }
            } catch (error) {
                console.error("Error processing collision:", error);
            }
        });
    }

    updateUserControls(position, direction) {
        console.log("Updating user controls:", position, direction);
        // Update the user control values
        this.userPosition.copy(position);
        this.userDirection.copy(direction).normalize();
        
        // Mark for recalculation
        this.needsFullRecalculation = true;
    }
    
    update() {
        // Check if we need to recalculate the predictive heatmap
        if (this.needsFullRecalculation && this.targetModel) {
            console.log("Recalculating heatmap, update #", ++this.updateCounter);
            this.calculatePredictiveHeatmap();
            this.needsFullRecalculation = false;
        }
    }
    
    calculatePredictiveHeatmap() {
        // Display status
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = "Calculating heatmap...";
        }
        
        // Clear existing heatmap data
        this.heatmapData.clear();
        this.maxIntensity = 0.01; // Start with a small non-zero value to avoid division by zero
        
        let processedFaces = 0;
        let validMeshes = 0;
        let totalMeshes = 0;
        
        // Process each mesh in the model
        this.targetModel.traverse((node) => {
            if (node.isMesh) {
                totalMeshes++;
                
                // First, verify that the mesh has valid geometry for heatmap calculation
                if (node.geometry && node.geometry.index) {
                    validMeshes++;
                    const faceCount = this.calculateMeshHeatmap(node);
                    processedFaces += faceCount;
                    
                    // Update debug status
                    console.log(`Processed ${faceCount} faces for mesh ${node.name || 'unnamed'}`);
                } else {
                    console.warn(`Skipping mesh ${node.name || 'unnamed'} - no geometry or indices`);
                }
            }
        });
        
        // If no faces were processed, something is wrong
        if (processedFaces === 0) {
            console.error(`No faces processed during heatmap calculation. Valid meshes: ${validMeshes}/${totalMeshes}`);
            if (statusElement) {
                statusElement.textContent = `Error: Failed to calculate heatmap. Valid meshes: ${validMeshes}/${totalMeshes}`;
                statusElement.style.color = "red";
            }
            return;
        }
        
        // Ensure we have a reasonable max intensity
        if (this.maxIntensity < 0.1) this.maxIntensity = 1.0;
        
        // Update all meshes after determining max intensity across all faces
        this.targetModel.traverse((node) => {
            if (node.isMesh && node.userData.heatmapValid) {
                this.updateMeshHeatmap(node);
            } else if (node.isMesh && node.userData.fallbackMaterial) {
                this.updateFallbackMaterial(node);
            }
        });
        
        // Update status
        if (statusElement) {
            statusElement.textContent = `Heatmap updated (${new Date().toLocaleTimeString()})`;
            statusElement.style.color = "";
        }
        
        // Log the results for debugging
        console.log(`Heatmap calculated with max intensity: ${this.maxIntensity}, processed ${processedFaces} faces`);
    }
    
    calculateMeshHeatmap(mesh) {
        // Get mesh geometry
        const geometry = mesh.geometry;
        if (!geometry.isBufferGeometry) return 0;
        
        // Get position attribute and index
        const positions = geometry.getAttribute('position');
        const normals = geometry.getAttribute('normal');
        const index = geometry.index;
        
        if (!index) {
            console.warn("Mesh geometry has no index, can't calculate heatmap", mesh);
            return 0;
        }
        if (!normals) {
            console.warn("Mesh geometry has no normals, can't calculate heatmap", mesh);
            return 0;
        }
        
        let processedFaces = 0;
        
        // Process each face of the mesh
        for (let i = 0; i < index.count / 3; i++) {
            const faceIndex = i;
            
            // Get vertices indices for this face
            const idx1 = index.getX(i * 3);
            const idx2 = index.getX(i * 3 + 1);
            const idx3 = index.getX(i * 3 + 2);
            
            // Get positions for vertices
            const pos1 = new THREE.Vector3(
                positions.getX(idx1),
                positions.getY(idx1),
                positions.getZ(idx1)
            );
            const pos2 = new THREE.Vector3(
                positions.getX(idx2),
                positions.getY(idx2),
                positions.getZ(idx2)
            );
            const pos3 = new THREE.Vector3(
                positions.getX(idx3),
                positions.getY(idx3),
                positions.getZ(idx3)
            );
            
            // Get normals for vertices
            const norm1 = new THREE.Vector3(
                normals.getX(idx1),
                normals.getY(idx1),
                normals.getZ(idx1)
            );
            const norm2 = new THREE.Vector3(
                normals.getX(idx2),
                normals.getY(idx2),
                normals.getZ(idx2)
            );
            const norm3 = new THREE.Vector3(
                normals.getX(idx3),
                normals.getY(idx3),
                normals.getZ(idx3)
            );
            
            // Transform to world coordinates
            pos1.applyMatrix4(mesh.matrixWorld);
            pos2.applyMatrix4(mesh.matrixWorld);
            pos3.applyMatrix4(mesh.matrixWorld);
            
            // Transform normals to world coordinates
            norm1.transformDirection(mesh.matrixWorld);
            norm2.transformDirection(mesh.matrixWorld);
            norm3.transformDirection(mesh.matrixWorld);
            
            // Calculate face center and average normal
            const faceCenter = new THREE.Vector3().add(pos1).add(pos2).add(pos3).divideScalar(3);
            const faceNormal = new THREE.Vector3().add(norm1).add(norm2).add(norm3).normalize();
            
            // Calculate splashback intensity
            const intensity = this.calculateSplashbackIntensity(faceCenter, faceNormal);
            
            // Store splashback data for this face
            const key = `${mesh.uuid}-${faceIndex}`;
            this.heatmapData.set(key, { intensity: intensity, hits: 0 });
            
            // Update max intensity
            if (intensity > this.maxIntensity) {
                this.maxIntensity = intensity;
            }
            
            processedFaces++;
        }
        
        return processedFaces;
    }

    calculateSplashbackIntensity(position, normal) {
        // Vector from emission point to the face
        const toFace = new THREE.Vector3().subVectors(position, this.userPosition).normalize();
        
        // Calculate the dot product between direction and normal
        // For reduced splashback, parallel impacts are better (dot product close to 1 or -1)
        // This gives higher values when the stream is parallel to the face (reducing splashback)
        const dirToNormalAngle = Math.abs(this.userDirection.dot(normal));
        
        // Reverse the normal factor: faces parallel to stream direction get higher values
        // We take the absolute value because both parallel and anti-parallel are good
        const normalFactor = Math.abs(dirToNormalAngle);
        
        // Distance affects splashback - closer means more intense
        const distance = this.userPosition.distanceTo(position);
        const distanceFactor = Math.max(0, 1 - (distance / 10)); // Normalize to 0-1 for distances up to 10 units
        
        // Height affects splashback - higher means less intense
        const heightFactor = Math.max(0, 1 - (position.y / 5)); // Normalize to 0-1 for heights up to 5 units
        
        // Visibility factor - check if the face is visible from the emission point
        const visibilityFactor = this.isPointVisible(position);
        
        // Calculate the overall splashback intensity
        // Higher weight on normal factor since it's the most important for splashback
        const intensity = (normalFactor * 0.7 + distanceFactor * 0.2 + heightFactor * 0.1) * visibilityFactor;
        
        return intensity;
    }
    
    isPointVisible(point) {
        // Simple raycasting to check if the point is visible from the emission point
        const direction = new THREE.Vector3().subVectors(point, this.userPosition).normalize();
        const raycaster = new THREE.Raycaster(this.userPosition, direction);
        const intersects = raycaster.intersectObject(this.targetModel, true);
        
        if (intersects.length === 0) return 0; // No intersection, not visible
        
        // Check if the first intersection is close to our target point
        const distance = this.userPosition.distanceTo(point);
        const hitDistance = intersects[0].distance;
        
        // If the hit is very close to our expected distance, the point is visible
        return Math.abs(hitDistance - distance) < 0.1 ? 1 : 0;
    }
    
    updateHeatmapForCollision(point, intensity) {
        if (!this.targetModel || !point) return;
        
        try {
            // Raycast to find which face was hit
            const raycaster = new THREE.Raycaster();
            const direction = new THREE.Vector3(0, -1, 0);
            const offsetPoint = point.clone().add(new THREE.Vector3(0, 0.01, 0));
            
            raycaster.set(offsetPoint, direction);
            const intersects = raycaster.intersectObject(this.targetModel, true);
            
            if (intersects.length === 0) return;
            
            const hit = intersects[0];
            if (!hit.object) return;
            
            const mesh = hit.object;
            
            // Only proceed with valid meshes that we've prepared for heatmap visualization
            if (!mesh.userData || !mesh.userData.heatmapValid) {
                return;
            }
            
            // Don't try to update meshes without proper geometry
            if (!mesh.geometry || !mesh.geometry.index) {
                return;
            }
            
            const faceIndex = hit.faceIndex;
            if (faceIndex === undefined || faceIndex < 0) {
                return;
            }
            
            // Create a unique key for this face
            const key = `${mesh.uuid}-${faceIndex}`;
            
            // Update the heatmap data for this face
            if (!this.heatmapData.has(key)) {
                this.heatmapData.set(key, { intensity: 0, hits: 0 });
            }
            
            const data = this.heatmapData.get(key);
            data.intensity += intensity;
            data.hits++;
            
            // Now we make sure to update the mesh's heatmap safely
            this.safeUpdateHeatmap(mesh);
            
        } catch (error) {
            console.error("Error in updateHeatmapForCollision:", error);
        }
    }

    // Add a new method to safely update the heatmap
    safeUpdateHeatmap(mesh) {
        if (!mesh) return;
        
        // Queue this update for the next animation frame to avoid race conditions
        requestAnimationFrame(() => {
            try {
                if (mesh.userData && mesh.userData.heatmapValid) {
                    this.updateMeshHeatmap(mesh);
                }
            } catch (error) {
                console.error("Error in safeUpdateHeatmap:", error);
            }
        });
    }

    updateMeshHeatmap(mesh) {
        // This is where the error is happening - line 236
        try {
            if (!mesh) return;
            if (!mesh.userData || !mesh.userData.heatmapTexture) return;
            
            // Get mesh geometry
            const geometry = mesh.geometry;
            if (!geometry) return;
            
            // CRITICAL FIX: Create a new texture data array
            const texture = mesh.userData.heatmapTexture;
            const width = texture.image.width;
            const height = texture.image.height;
            const data = new Uint8Array(width * height * 4);
            
            // Fill with transparent black
            for (let i = 0; i < data.length; i += 4) {
                data[i] = 0;      // R
                data[i + 1] = 0;  // G
                data[i + 2] = 0;  // B
                data[i + 3] = 255;// A
            }
            
            // Early check for missing index
            const index = geometry.index;
            const uvs = geometry.getAttribute('uv');
            
            // CRITICAL FIX: Double-check index is not null before proceeding
            if (!index || !uvs) {
                console.warn("Cannot update heatmap: Mesh is missing index or UVs");
                
                // Still update the texture with blank data to avoid stale visuals
                texture.image.data = data;
                texture.needsUpdate = true;
                return;
            }
            
            // Extra defense - ensure index.count exists and is valid
            if (typeof index.count !== 'number' || index.count <= 0) {
                console.warn("Cannot update heatmap: Invalid index count");
                
                // Still update the texture with blank data
                texture.image.data = data;
                texture.needsUpdate = true;
                return;
            }
            
            // Now it's safe to process the faces
            let faceCount = 0;
            let updatedFaces = 0;
            
            // For each face in the mesh (triple check index.count is valid)
            if (index && index.count && index.count % 3 === 0) {
                for (let i = 0; i < index.count / 3; i++) {
                    // ...existing face processing code...
                }
            }
            
            // Update the texture
            texture.image.data = data;
            texture.needsUpdate = true;
            
        } catch (error) {
            console.error("Error in updateMeshHeatmap:", error);
        }
    }
    
    paintFaceInTexture(textureData, uv1, uv2, uv3, intensity, width, height) {
        // Simple triangle rasterization
        const minX = Math.max(0, Math.floor(Math.min(uv1.x, uv2.x, uv3.x) * width));
        const maxX = Math.min(width - 1, Math.ceil(Math.max(uv1.x, uv2.x, uv3.x) * width));
        const minY = Math.max(0, Math.floor(Math.min(uv1.y, uv2.y, uv3.y) * height));
        const maxY = Math.min(height - 1, Math.ceil(Math.max(uv1.y, uv2.y, uv3.y) * height));
        
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                // Normalize pixel coordinates to UV space
                const u = x / width;
                const v = y / height;
                
                // Check if the point is inside the triangle
                if (this.pointInTriangle(u, v, uv1, uv2, uv3)) {
                    const index = (y * width + x) * 4;
                    
                    // Set the red channel to intensity (can use RGB for different visualizations)
                    textureData[index] = Math.floor(intensity * 255);
                }
            }
        }
    }
    
    pointInTriangle(x, y, v1, v2, v3) {
        // Barycentric coordinate test
        const denominator = ((v2.y - v3.y) * (v1.x - v3.x) + (v3.x - v2.x) * (v1.y - v3.y));
        
        // Avoid division by zero
        if (Math.abs(denominator) < 0.0001) return false;
        
        const a = ((v2.y - v3.y) * (x - v3.x) + (v3.x - v2.x) * (y - v3.y)) / denominator;
        const b = ((v3.y - v1.y) * (x - v3.x) + (v1.x - v3.x) * (y - v3.y)) / denominator;
        const c = 1 - a - b;
        
        // The point is in the triangle if all coordinates are between 0 and 1
        return (a >= 0 && a <= 1 && b >= 0 && b <= 1 && c >= 0 && c <= 1);
    }
    
    updateFallbackMaterial(mesh) {
        if (!mesh.userData.fallbackMaterial) return;
        
        // Calculate average intensity for this mesh
        let totalIntensity = 0;
        let faceCount = 0;
        
        // Iterate through all heatmap data for this mesh
        for (const [key, data] of this.heatmapData.entries()) {
            if (key.startsWith(mesh.uuid)) {
                totalIntensity += data.intensity;
                faceCount++;
            }
        }
        
        if (faceCount === 0) return;
        
        // Calculate average intensity and normalize it
        const avgIntensity = totalIntensity / faceCount;
        const normalizedIntensity = Math.min(avgIntensity / this.maxIntensity, 1.0);
        
        // Determine color based on intensity
        let color;
        if (normalizedIntensity < this.colorScale[1].value) {
            const t = normalizedIntensity / this.colorScale[1].value;
            color = this.colorScale[0].color.clone().lerp(this.colorScale[1].color, t);
        } else if (normalizedIntensity < this.colorScale[2].value) {
            const t = (normalizedIntensity - this.colorScale[1].value) / 
                      (this.colorScale[2].value - this.colorScale[1].value);
            color = this.colorScale[1].color.clone().lerp(this.colorScale[2].color, t);
        } else {
            const t = (normalizedIntensity - this.colorScale[2].value) / 
                      (1.0 - this.colorScale[2].value);
            color = this.colorScale[2].color.clone().lerp(this.colorScale[3].color, t);
        }
        
        // Update the material color
        mesh.userData.fallbackMaterial.color = color;
    }

    updateHeatmapVisualization() {
        if (!this.targetModel) return;
        
        this.targetModel.traverse((node) => {
            if (node.isMesh && node.userData.heatmapMaterial) {
                // Update shader uniforms if needed
                node.userData.heatmapMaterial.uniforms.heatmapIntensity.value = 1.0;
            }
        });
    }
    
    reset() {
        console.log("Resetting heatmap");
        // Clear all heatmap data
        this.heatmapData.clear();
        this.maxIntensity = 1;
        
        // Reset all mesh heatmap textures
        if (this.targetModel) {
            this.targetModel.traverse((node) => {
                if (node.isMesh && node.userData.heatmapTexture) {
                    // Reset texture to zeros
                    const texture = node.userData.heatmapTexture;
                    const width = texture.image.width;
                    const height = texture.image.height;
                    const data = new Uint8Array(width * height * 4);
                    
                    // Fill with zero (no heat)
                    for (let i = 0; i < width * height * 4; i += 4) {
                        data[i] = 0;      // R
                        data[i + 1] = 0;  // G
                        data[i + 2] = 0;  // B
                        data[i + 3] = 255;// A
                    }
                    
                    texture.image.data = data;
                    texture.needsUpdate = true;
                }
            });
        }
        
        // Trigger a recalculation of the predictive heatmap
        this.needsFullRecalculation = true;
    }
    
    downloadResults() {
        // Count the number of stored heatmap data points
        const dataCount = this.heatmapData.size;
        
        if (!this.targetModel || dataCount === 0) {
            console.error("No heatmap data available to download");
            alert("No heatmap data available to download. Try adjusting position and direction first.");
            return;
        }
        
        // Create a JSON representation of the heatmap data
        const heatmapExport = {
            modelName: this.targetModel.name || "urinal-model",
            timestamp: new Date().toISOString(),
            maxIntensity: this.maxIntensity,
            dataPoints: dataCount,
            emitterPosition: {
                x: this.userPosition.x,
                y: this.userPosition.y,
                z: this.userPosition.z
            },
            emitterDirection: {
                x: this.userDirection.x,
                y: this.userDirection.y,
                z: this.userDirection.z
            },
            heatmapData: {}
        };
        
        // Convert map to regular object
        for (const [key, value] of this.heatmapData.entries()) {
            heatmapExport.heatmapData[key] = value;
        }
        
        // Create download link
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(heatmapExport, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "urinal-heatmap-data.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }
}
