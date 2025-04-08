// Manages the source point visualization and interaction
import * as THREE from 'three';

export class SourcePointManager {
    constructor(scene, camera, controls) {
        this.scene = scene;
        this.camera = camera;
        this.controls = controls;
        
        // Source point properties - changed initial position to (0,0,0)
        this.sourcePoint = new THREE.Vector3(0, 0, 0);
        this.sourceGroup = null;
        
        // Mouse interaction properties
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.isDragging = false;
        this.selectedArrow = null;
        this.dragPlane = new THREE.Plane();
        this.dragOffset = new THREE.Vector3();
        
        // Initialize source point visualization
        this.updateSourcePoint();
        
        // Bind methods that will be used as event handlers
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
    }
    
    // Helper function to clamp values between -5 and 5
    clampPosition(value) {
        return Math.max(-5, Math.min(5, value));
    }
    
    updateSourcePoint() {
        // Remove previous source group if exists
        const existingGroup = this.scene.getObjectByName("sourceGroup");
        if (existingGroup) this.scene.remove(existingGroup);
        
        // Create new source group
        this.sourceGroup = new THREE.Group();
        this.sourceGroup.name = "sourceGroup";
        this.scene.add(this.sourceGroup);
        
        // Create source point sphere
        const sphereGeometry = new THREE.SphereGeometry(0.1, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        const sourceSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sourceSphere.name = "sourcePoint";
        this.sourceGroup.add(sourceSphere);
        
        // Create directional arrows
        this.createDirectionalArrow("x-arrow", new THREE.Vector3(1, 0, 0), 0xff0000);
        this.createDirectionalArrow("y-arrow", new THREE.Vector3(0, 1, 0), 0x00ff00);
        this.createDirectionalArrow("z-arrow", new THREE.Vector3(0, 0, 1), 0x0000ff);
        
        // Position the source group
        this.sourceGroup.position.copy(this.sourcePoint);
        
        // Display source position coordinates (without sliders)
        const infoPanel = document.getElementById('stats');
        if (infoPanel) {
            const currentInfo = infoPanel.innerHTML;
            const positionInfo = `<p>Source position: X: ${this.sourcePoint.x.toFixed(2)}, Y: ${this.sourcePoint.y.toFixed(2)}, Z: ${this.sourcePoint.z.toFixed(2)}</p>`;
            
            // Only update if not already running a simulation
            if (!currentInfo.includes('Simulation complete')) {
                infoPanel.innerHTML = positionInfo + (currentInfo.includes('Model loaded') ? currentInfo : '');
            }
        }
    }
    
    createDirectionalArrow(name, direction, color) {
        // Create arrow geometry
        const arrowLength = 0.4;
        const headLength = 0.15;
        const headWidth = 0.1;
        
        // Create line part
        const lineGeometry = new THREE.CylinderGeometry(0.02, 0.02, arrowLength - headLength, 8);
        lineGeometry.translate(0, (arrowLength - headLength) / 2, 0);
        const lineMesh = new THREE.Mesh(lineGeometry, new THREE.MeshBasicMaterial({ color }));
        
        // Create arrowhead part
        const headGeometry = new THREE.ConeGeometry(headWidth, headLength, 8);
        headGeometry.translate(0, arrowLength - headLength / 2, 0);
        const headMesh = new THREE.Mesh(headGeometry, new THREE.MeshBasicMaterial({ color }));
        
        // Create arrow group
        const arrowGroup = new THREE.Group();
        arrowGroup.name = name;
        arrowGroup.add(lineMesh);
        arrowGroup.add(headMesh);
        
        // Orient arrow along the specified direction
        if (direction.x === 1) {
            arrowGroup.rotation.z = -Math.PI / 2;
        } else if (direction.z === 1) {
            arrowGroup.rotation.x = Math.PI / 2;
        }
        
        // Add user data for interaction
        arrowGroup.userData = { direction: direction.clone() };
        
        this.sourceGroup.add(arrowGroup);
        return arrowGroup;
    }
    
    setSourcePosition(x, y, z) {
        // Clamp all position values to the -5 to 5 range
        this.sourcePoint.set(
            this.clampPosition(x),
            this.clampPosition(y),
            this.clampPosition(z)
        );
        this.updateSourcePoint();
    }
    
    getSourcePoint() {
        return this.sourcePoint.clone();
    }
    
    onMouseDown(event) {
        // Skip if simulation is running
        if (document.getElementById('loading-overlay').style.display === 'flex') return;
        
        // Get normalized mouse coordinates
        const rect = event.target.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Check for intersections with arrows
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        if (!this.sourceGroup) return;
        
        const arrows = [
            this.sourceGroup.getObjectByName("x-arrow"),
            this.sourceGroup.getObjectByName("y-arrow"),
            this.sourceGroup.getObjectByName("z-arrow")
        ].filter(arrow => arrow !== undefined);
        
        const intersects = this.raycaster.intersectObjects(arrows, true);
        
        if (intersects.length > 0) {
            // Find the parent arrow group
            let arrowParent = intersects[0].object;
            while (arrowParent.parent && !arrowParent.name.endsWith('-arrow')) {
                arrowParent = arrowParent.parent;
            }
            
            if (arrowParent.name.endsWith('-arrow')) {
                // Disable orbit controls during drag
                this.controls.enabled = false;
                
                // Set up drag operation
                this.selectedArrow = arrowParent;
                this.isDragging = true;
                
                // Create drag plane perpendicular to camera direction
                const normal = new THREE.Vector3().subVectors(
                    this.camera.position, this.sourceGroup.position
                ).normalize();
                
                // Set up drag plane
                this.dragPlane.setFromNormalAndCoplanarPoint(
                    normal,
                    this.sourceGroup.position
                );
                
                // Calculate drag offset
                const dragIntersection = new THREE.Vector3();
                this.raycaster.ray.intersectPlane(this.dragPlane, dragIntersection);
                this.dragOffset.subVectors(this.sourceGroup.position, dragIntersection);
            }
        }
    }
    
    onMouseMove(event) {
        if (!this.isDragging || !this.selectedArrow) return;
        
        // Get normalized mouse coordinates
        const rect = event.target.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Update raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Find intersection with drag plane
        const intersection = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(this.dragPlane, intersection);
        intersection.add(this.dragOffset);
        
        // Get movement direction based on selected arrow
        const direction = this.selectedArrow.userData.direction;
        
        // Project movement onto arrow axis
        const targetPosition = new THREE.Vector3();
        const axisLine = new THREE.Line3(
            this.sourcePoint.clone(),
            this.sourcePoint.clone().add(direction.clone().multiplyScalar(100))
        );
        axisLine.closestPointToPoint(intersection, false, targetPosition);
        
        // Clamp the position values to -5 to 5 before updating
        targetPosition.x = this.clampPosition(targetPosition.x);
        targetPosition.y = this.clampPosition(targetPosition.y);
        targetPosition.z = this.clampPosition(targetPosition.z);
        
        // Update source position
        this.sourcePoint.copy(targetPosition);
        this.sourceGroup.position.copy(this.sourcePoint);
        
        // Update UI display with current position
        const infoPanel = document.getElementById('stats');
        if (infoPanel) {
            const currentInfo = infoPanel.innerHTML;
            const positionInfo = `<p>Source position: X: ${this.sourcePoint.x.toFixed(2)}, Y: ${this.sourcePoint.y.toFixed(2)}, Z: ${this.sourcePoint.z.toFixed(2)}</p>`;
            
            // Only update if not already running a simulation
            if (!currentInfo.includes('Simulation complete')) {
                infoPanel.innerHTML = positionInfo + (currentInfo.includes('Model loaded') ? currentInfo : '');
            }
        }
    }
    
    onMouseUp() {
        if (this.isDragging) {
            // Re-enable orbit controls
            this.controls.enabled = true;
            
            // Clear drag state
            this.isDragging = false;
            this.selectedArrow = null;
        }
    }
}
