// Simulation engine for calculating splashback factors
import * as THREE from 'three';

// Physics constants
const GRAVITY = 9.81;  // m/s²
const ANGULAR_RESOLUTION = 20;  // Number of directions to sample

// Simulate splashback for the given model and parameters
function simulateSplashback(model, sourcePoint, forceValue) {
    // Scale the force factor to a reasonable range
    const initialVelocity = forceValue / 10.0;
    
    // Create results data structure
    const results = {
        faceData: [],
        vertexData: new Map(), // Add vertex data for interpolation
        minSplashback: Infinity,
        maxSplashback: 0,
        averageSplashback: 0
    };
    
    let totalSplashback = 0;
    let faceCount = 0;
    
    // Collect all meshes from the model
    const meshes = [];
    model.traverse(function(child) {
        if (child instanceof THREE.Mesh) {
            meshes.push(child);
        }
    });
    
    // Go through each mesh
    for (const mesh of meshes) {
        const geometry = mesh.geometry;
        const positionAttribute = geometry.attributes.position;
        const normalAttribute = geometry.attributes.normal;
        
        // For indexed geometries
        const indices = geometry.index ? geometry.index.array : null;
        
        // Process vertices based on whether geometry is indexed or not
        const vertexCount = positionAttribute.count;
        const meshFaceCount = indices ? indices.length / 3 : vertexCount / 3;
        
        for (let i = 0; i < meshFaceCount; i++) {
            const face = { index: i, splashback: 0, vertices: [] };
            
            // Get face vertices and normal
            const normalVectors = [];
            const vertexPositions = [];
            const vertexIndices = [];
            
            // Get the three vertices of this face
            for (let j = 0; j < 3; j++) {
                const vertexIndex = indices ? indices[i * 3 + j] : i * 3 + j;
                
                // Get position
                const x = positionAttribute.getX(vertexIndex);
                const y = positionAttribute.getY(vertexIndex);
                const z = positionAttribute.getZ(vertexIndex);
                
                // Get normal
                const nx = normalAttribute.getX(vertexIndex);
                const ny = normalAttribute.getY(vertexIndex);
                const nz = normalAttribute.getZ(vertexIndex);
                
                vertexPositions.push(new THREE.Vector3(x, y, z).applyMatrix4(mesh.matrixWorld));
                normalVectors.push(new THREE.Vector3(nx, ny, nz).transformDirection(mesh.matrixWorld));
                
                face.vertices.push({ x, y, z });
                vertexIndices.push(vertexIndex);
            }
            
            // Calculate face centroid
            const centroid = new THREE.Vector3().add(vertexPositions[0]).add(vertexPositions[1]).add(vertexPositions[2]).divideScalar(3);
            
            // Get average face normal
            const faceNormal = new THREE.Vector3().add(normalVectors[0]).add(normalVectors[1]).add(normalVectors[2]).normalize();
            
            // Calculate splashback for this face by simulating multiple trajectories
            let faceSplashback = calculateFaceSplashback(sourcePoint, centroid, faceNormal, initialVelocity);
            
            // Store results
            face.splashback = faceSplashback;
            results.faceData.push(face);
            
            // Update stats
            if (faceSplashback < results.minSplashback) results.minSplashback = faceSplashback;
            if (faceSplashback > results.maxSplashback) results.maxSplashback = faceSplashback;
            totalSplashback += faceSplashback;
            faceCount++;
            
            // Add this splashback value to each vertex of the face for interpolation
            for (let j = 0; j < 3; j++) {
                const vertexIndex = vertexIndices[j];
                if (!results.vertexData.has(vertexIndex)) {
                    results.vertexData.set(vertexIndex, {
                        splashbackTotal: 0,
                        faceCount: 0
                    });
                }
                
                const vertexInfo = results.vertexData.get(vertexIndex);
                vertexInfo.splashbackTotal += faceSplashback;
                vertexInfo.faceCount++;
            }
        }
    }
    
    // Calculate average
    results.averageSplashback = faceCount > 0 ? totalSplashback / faceCount : 0;
    
    // Calculate per-vertex average splashback values for interpolation
    calculateVertexColors(results);
    
    return results;
}

// Calculate per-vertex colors for smooth gradient interpolation
function calculateVertexColors(results) {
    // Calculate average splashback value per vertex
    for (const [vertexIndex, vertexInfo] of results.vertexData.entries()) {
        vertexInfo.averageSplashback = vertexInfo.faceCount > 0 
            ? vertexInfo.splashbackTotal / vertexInfo.faceCount
            : 0;
    }
    
    // Now create colors with inverted gradient (higher splashback = cooler color)
    for (const [vertexIndex, vertexInfo] of results.vertexData.entries()) {
        // Normalize the value between 0 and 1
        let normalizedValue = 0;
        if (results.maxSplashback > results.minSplashback) {
            normalizedValue = (vertexInfo.averageSplashback - results.minSplashback) / 
                             (results.maxSplashback - results.minSplashback);
        }
        
        // Invert the gradient (1 - normalizedValue)
        normalizedValue = 1 - normalizedValue;
        
        // Calculate RGB color (example: red to blue gradient)
        vertexInfo.color = {
            r: normalizedValue,
            g: 0,
            b: 1 - normalizedValue
        };
    }
}

// Apply the interpolated vertex colors to a mesh
function applyVertexColors(mesh, results) {
    const geometry = mesh.geometry;
    const positionAttribute = geometry.attributes.position;
    const colors = new Float32Array(positionAttribute.count * 3);
    
    // For indexed geometries
    const indices = geometry.index ? geometry.index.array : null;
    
    for (let i = 0; i < positionAttribute.count; i++) {
        const vertexIndex = indices ? indices[i] : i;
        const vertexInfo = results.vertexData.get(vertexIndex);
        
        if (vertexInfo) {
            const idx = i * 3;
            colors[idx] = vertexInfo.color.r;
            colors[idx + 1] = vertexInfo.color.g;
            colors[idx + 2] = vertexInfo.color.b;
        }
    }
    
    // Add the color attribute to the geometry
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    // Update the material to use vertex colors
    if (mesh.material) {
        mesh.material.vertexColors = true;
        mesh.material.needsUpdate = true;
    }
}

// Calculate splashback factor for a specific face
function calculateFaceSplashback(sourcePoint, facePoint, faceNormal, initialVelocity) {
    let totalSplashback = 0;
    let sampleCount = 0;
    
    // Sample multiple directions
    for (let phi = 0; phi < Math.PI * 2; phi += Math.PI * 2 / ANGULAR_RESOLUTION) {
        for (let theta = Math.PI / 6; theta < Math.PI / 3; theta += Math.PI / 12) {
            // Convert spherical to Cartesian coordinates for initial velocity vector
            const vx = initialVelocity * Math.sin(theta) * Math.cos(phi);
            const vy = initialVelocity * Math.cos(theta);
            const vz = initialVelocity * Math.sin(theta) * Math.sin(phi);
            
            const initialVelocityVector = new THREE.Vector3(vx, vy, vz);
            
            // Create the trajectory (parabola)
            const trajectoryPoints = calculateTrajectory(sourcePoint, initialVelocityVector);
            
            // Find if this trajectory intersects with the face
            const intersection = findIntersection(trajectoryPoints, facePoint, faceNormal);
            
            if (intersection) {
                // Calculate incident angle between trajectory and face
                const incidentAngle = intersection.incidentAngle;
                
                // Calculate splashback factor (higher angle = more splashback)
                // Formula: splashback ~ sin(incidentAngle)²
                const splashbackFactor = Math.sin(incidentAngle) * Math.sin(incidentAngle);
                
                totalSplashback += splashbackFactor;
                sampleCount++;
            }
        }
    }
    
    // Return average splashback factor for this face
    return sampleCount > 0 ? totalSplashback / sampleCount : 0;
}

// Calculate the parabolic trajectory
function calculateTrajectory(startPoint, initialVelocity) {
    const points = [];
    const timeStep = 0.01;  // seconds
    const maxTime = 2.0;    // maximum simulation time
    
    for (let t = 0; t <= maxTime; t += timeStep) {
        // Calculate position at time t using projectile motion equations
        const x = startPoint.x + initialVelocity.x * t;
        const y = startPoint.y + initialVelocity.y * t - 0.5 * GRAVITY * t * t;
        const z = startPoint.z + initialVelocity.z * t;
        
        points.push(new THREE.Vector3(x, y, z));
        
        // Stop if the trajectory goes below floor level
        if (y < 0) break;
    }
    
    return points;
}

// Find intersection between trajectory and face
function findIntersection(trajectoryPoints, facePoint, faceNormal) {
    if (trajectoryPoints.length < 2) return null;
    
    // Check each segment of the trajectory
    for (let i = 1; i < trajectoryPoints.length; i++) {
        const p1 = trajectoryPoints[i-1];
        const p2 = trajectoryPoints[i];
        
        // Calculate ray direction
        const rayDirection = new THREE.Vector3().subVectors(p2, p1).normalize();
        
        // Create a ray for this segment
        const ray = new THREE.Ray(p1, rayDirection);
        
        // Create a plane representing the face
        const plane = new THREE.Plane(faceNormal, -faceNormal.dot(facePoint));
        
        // Check intersection with plane
        const intersectionPoint = new THREE.Vector3();
        const intersectionDistance = ray.distanceToPlane(plane);
        
        if (intersectionDistance > 0 && intersectionDistance <= p1.distanceTo(p2)) {
            // Calculate actual intersection point
            ray.at(intersectionDistance, intersectionPoint);
            
            // Calculate incident angle
            const incidentAngle = Math.acos(Math.abs(rayDirection.dot(faceNormal)));
            
            return {
                point: intersectionPoint,
                incidentAngle: incidentAngle
            };
        }
    }
    
    return null;
}

// Export the functions we need to access from other modules
export const SimulationEngine = {
    simulateSplashback,
    applyVertexColors // Export the new function
};
