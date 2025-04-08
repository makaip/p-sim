// Generates and applies heatmap visualization to 3D models
import * as THREE from 'three';

// Generate a heatmap texture based on face data
function generateHeatmapTexture(resolution, faceData, minValue, maxValue) {
    // Create a canvas for the heatmap
    const canvas = document.createElement('canvas');
    canvas.width = resolution;
    canvas.height = resolution;
    const ctx = canvas.getContext('2d');
    
    // Fill with black background
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, resolution, resolution);
    
    // Draw each face with its splashback color
    for (const face of faceData) {
        // Skip faces with no vertices
        if (!face.vertices || face.vertices.length < 3) continue;
        
        // Normalize splashback value
        const normalizedValue = (face.splashback - minValue) / (maxValue - minValue);
        
        // Generate color based on splashback value (green to yellow to red)
        const color = getHeatmapColor(normalizedValue);
        
        // Get face UV coordinates and draw on canvas
        if (face.uvs && face.uvs.length >= 3) {
            // If we have UV info, use it
            ctx.beginPath();
            ctx.moveTo(face.uvs[0].x * resolution, (1 - face.uvs[0].y) * resolution);
            ctx.lineTo(face.uvs[1].x * resolution, (1 - face.uvs[1].y) * resolution);
            ctx.lineTo(face.uvs[2].x * resolution, (1 - face.uvs[2].y) * resolution);
            ctx.closePath();
            
            ctx.fillStyle = color;
            ctx.fill();
        }
    }
    
    return canvas;
}

// Get color for heatmap based on normalized value (0-1)
function getHeatmapColor(value) {
    // Green (0) -> Yellow (0.5) -> Red (1)
    let r, g, b;
    
    if (value < 0.5) {
        // Green to Yellow
        r = Math.floor(255 * (2 * value));
        g = 255;
        b = 0;
    } else {
        // Yellow to Red
        r = 255;
        g = Math.floor(255 * (2 - 2 * value));
        b = 0;
    }
    
    return `rgb(${r}, ${g}, ${b})`;
}

// Apply heatmap to the 3D model
function applyHeatmap(model, simulationResults) {
    // Extract data from simulation results
    const { faceData, minSplashback, maxSplashback } = simulationResults;
    
    // Generate the texture
    const heatmapTexture = new THREE.CanvasTexture(
        generateHeatmapTexture(1024, faceData, minSplashback, maxSplashback)
    );
    
    // Apply to all meshes in the model
    model.traverse(function(child) {
        if (child instanceof THREE.Mesh) {
            // Create a new material with the heatmap texture
            const material = new THREE.MeshStandardMaterial({
                map: heatmapTexture,
                metalness: 0.3,
                roughness: 0.5
            });
            
            // Store vertex-specific splashback data
            applyVertexColors(child, faceData, minSplashback, maxSplashback);
            
            // Apply the new material
            child.material = material;
        }
    });
    
    // Generate a more detailed per-vertex heatmap using vertex colors
    generatePerVertexHeatmap(model, faceData, minSplashback, maxSplashback);
}

// Apply vertex colors based on splashback data
function applyVertexColors(mesh, faceData, minValue, maxValue) {
    const geometry = mesh.geometry;
    
    // Create vertex colors attribute if it doesn't exist
    if (!geometry.attributes.color) {
        const colors = new Float32Array(geometry.attributes.position.count * 3);
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    
    // Reset color attribute
    const colorAttribute = geometry.attributes.color;
    
    // The actual implementation would map face indices to vertices and set colors
    // This is a placeholder that works for simple geometries
    if (geometry.index) {
        // Indexed geometry
        const indices = geometry.index.array;
        
        for (let i = 0; i < indices.length / 3; i++) {
            // Find corresponding face data
            const face = faceData.find(f => f.index === i);
            if (!face) continue;
            
            // Normalize the splashback value
            const normalizedValue = (face.splashback - minValue) / (maxValue - minValue);
            
            // Get color
            const color = new THREE.Color();
            setHeatmapThreeColor(color, normalizedValue);
            
            // Apply color to all three vertices of this face
            for (let j = 0; j < 3; j++) {
                const vertexIndex = indices[i * 3 + j];
                colorAttribute.setXYZ(vertexIndex, color.r, color.g, color.b);
            }
        }
    } else {
        // Non-indexed geometry
        for (let i = 0; i < geometry.attributes.position.count / 3; i++) {
            // Find corresponding face data
            const face = faceData.find(f => f.index === i);
            if (!face) continue;
            
            // Normalize the splashback value
            const normalizedValue = (face.splashback - minValue) / (maxValue - minValue);
            
            // Get color
            const color = new THREE.Color();
            setHeatmapThreeColor(color, normalizedValue);
            
            // Apply color to all three vertices of this face
            colorAttribute.setXYZ(i * 3, color.r, color.g, color.b);
            colorAttribute.setXYZ(i * 3 + 1, color.r, color.g, color.b);
            colorAttribute.setXYZ(i * 3 + 2, color.r, color.g, color.b);
        }
    }
    
    colorAttribute.needsUpdate = true;
}

// Set THREE.Color based on heatmap value
function setHeatmapThreeColor(color, value) {
    if (value < 0.5) {
        // Green to Yellow
        color.r = value * 2;
        color.g = 1.0;
        color.b = 0.0;
    } else {
        // Yellow to Red
        color.r = 1.0;
        color.g = 2.0 - value * 2;
        color.b = 0.0;
    }
}

// Generate a more detailed per-vertex heatmap
function generatePerVertexHeatmap(model, faceData, minValue, maxValue) {
    model.traverse(function(child) {
        if (child instanceof THREE.Mesh) {
            // Create a new vertex-colored material
            const vertexMaterial = new THREE.MeshStandardMaterial({
                vertexColors: true,
                metalness: 0.3,
                roughness: 0.5
            });
            
            // Apply vertex colors
            applyVertexColors(child, faceData, minValue, maxValue);
            
            // Use the vertex-colored material
            child.material = vertexMaterial;
        }
    });
}

// Export the functions we need to access from other modules
export const HeatmapGenerator = {
    applyHeatmap
};
