/**
 * Buffer Geometry Utilities
 */

const BufferGeometryUtils = {
    /**
     * Generates indices for a non-indexed buffer geometry
     * @param {THREE.BufferGeometry} geometry - The geometry to index
     * @returns {THREE.BufferGeometry} The indexed geometry
     */
    createIndices(geometry) {
        if (!geometry.isBufferGeometry) {
            console.error('BufferGeometryUtils: geometry is not a BufferGeometry.');
            return geometry;
        }
        
        if (geometry.index) {
            console.warn('BufferGeometryUtils: geometry already has indices.');
            return geometry;
        }
        
        const vertexCount = geometry.attributes.position.count;
        let indexType = Uint16Array;
        
        if (vertexCount > 65535) {
            indexType = Uint32Array;
        }
        
        const indices = new indexType(vertexCount);
        for (let i = 0; i < vertexCount; i++) {
            indices[i] = i;
        }
        
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        return geometry;
    },
    
    /**
     * Merges vertices in a buffer geometry to eliminate duplicates
     * @param {THREE.BufferGeometry} geometry - The geometry to optimize
     * @param {number} tolerance - Distance tolerance for merging vertices
     * @returns {THREE.BufferGeometry} The optimized geometry
     */
    mergeVertices(geometry, tolerance = 1e-4) {
        // Make sure we're working with a buffer geometry
        if (!geometry.isBufferGeometry) {
            console.error('BufferGeometryUtils: geometry is not a BufferGeometry.');
            return geometry;
        }
        
        const positionAttr = geometry.attributes.position;
        const vertexCount = positionAttr.count;
        
        // Store unique vertices by their position hash
        const vertexMap = new Map();
        const uniquePositions = [];
        const uniqueIndices = [];
        const oldToNew = {};
        
        // Process each vertex
        for (let i = 0; i < vertexCount; i++) {
            const x = positionAttr.getX(i);
            const y = positionAttr.getY(i);
            const z = positionAttr.getZ(i);
            
            // Create a hash for this vertex position
            const hash = `${Math.round(x/tolerance)},${Math.round(y/tolerance)},${Math.round(z/tolerance)}`;
            
            if (vertexMap.has(hash)) {
                // This vertex position already exists, use its index
                oldToNew[i] = vertexMap.get(hash);
            } else {
                // New unique vertex
                const newIndex = uniquePositions.length / 3;
                vertexMap.set(hash, newIndex);
                oldToNew[i] = newIndex;
                
                // Store position data
                uniquePositions.push(x, y, z);
            }
        }
        
        // Create new position buffer with unique vertices
        const newPositions = new Float32Array(uniquePositions);
        
        // Create new index buffer
        const oldIndices = geometry.index ? geometry.index.array : Array(vertexCount).fill(0).map((_, i) => i);
        
        for (let i = 0; i < oldIndices.length; i++) {
            uniqueIndices.push(oldToNew[oldIndices[i]]);
        }
        
        // Copy the optimized data to the geometry
        geometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
        geometry.setIndex(uniqueIndices);
        
        // If we have other attributes like normals or UVs, we'd need to recompute them
        // This is simplified for clarity
        
        return geometry;
    },
    
    /**
     * Creates triangle-based indices for a mesh using simple triangulation
     * @param {THREE.BufferGeometry} geometry - The geometry to triangulate
     * @returns {THREE.BufferGeometry} The triangulated geometry
     */
    triangulate(geometry) {
        if (!geometry.isBufferGeometry) {
            console.error('BufferGeometryUtils: geometry is not a BufferGeometry.');
            return geometry;
        }
        
        const positionAttr = geometry.attributes.position;
        const vertexCount = positionAttr.count;
        
        if (vertexCount % 3 !== 0) {
            console.warn('BufferGeometryUtils: Vertex count is not a multiple of 3, triangulation may be imprecise.');
        }
        
        // For simple triangulation, we'll just create indices for each set of three vertices
        const indices = [];
        for (let i = 0; i < vertexCount; i += 3) {
            // Add a triangle
            indices.push(i, i + 1, i + 2);
        }
        
        geometry.setIndex(indices);
        return geometry;
    }
};

export default BufferGeometryUtils;
