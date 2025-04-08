export default class FluidSimulation {
    constructor() {
        // Simulation parameters
        this.particles = [];
        this.particleGeometry = null;
        this.particleMaterial = null;
        this.particleSystem = null;
        this.target = null;
        this.scene = null;
        
        // Physics parameters
        this.gravity = new THREE.Vector3(0, -9.8, 0);
        this.timeStep = 1/60;
        this.maxParticles = 1000;
        
        // Emitter properties
        this.emitterPosition = new THREE.Vector3();
        this.emitterDirection = new THREE.Vector3();
        this.flowRate = 50; // Particles per second
        this.particleLifetime = 5; // Seconds
        this.particleSpeed = 5;
        
        // Collision detection
        this.raycaster = new THREE.Raycaster();
        this.collisionThreshold = 0.1;
    }
    
    init(targetModel, scene, position, direction, flowRate) {
        this.target = targetModel;
        this.scene = scene;
        this.emitterPosition.copy(position);
        this.emitterDirection.copy(direction).normalize();
        this.flowRate = flowRate;
        
        // Create particle system
        this.createParticleSystem();
        
        // Start emission timer
        this.lastEmitTime = 0;
    }
    
    createParticleSystem() {
        // Create particle geometry
        this.particleGeometry = new THREE.BufferGeometry();
        
        // Create positions array for the maximum number of particles
        const positions = new Float32Array(this.maxParticles * 3);
        const colors = new Float32Array(this.maxParticles * 3);
        
        // Initialize all positions off-screen
        for (let i = 0; i < this.maxParticles; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = -1000; // Off-screen
            positions[i * 3 + 2] = 0;
            
            // Yellow color for particles
            colors[i * 3] = 1.0;     // R (full red)
            colors[i * 3 + 1] = 0.9; // G (high green)
            colors[i * 3 + 2] = 0.0; // B (no blue)
        }
        
        this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        // Create particle material
        this.particleMaterial = new THREE.PointsMaterial({
            size: 0.08, // Increased size for better visibility
            transparent: true,
            opacity: 0.8,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        // Create particle system and add to scene
        this.particleSystem = new THREE.Points(this.particleGeometry, this.particleMaterial);
        this.scene.add(this.particleSystem);
    }
    
    createParticle() {
        if (this.particles.length >= this.maxParticles) return;
        
        // Create a small random offset for natural spread
        const spread = 0.05;
        const spreadVector = new THREE.Vector3(
            (Math.random() - 0.5) * spread,
            (Math.random() - 0.5) * spread,
            (Math.random() - 0.5) * spread
        );
        
        // Calculate initial velocity based on direction and speed
        const velocity = this.emitterDirection.clone()
            .add(spreadVector)
            .normalize()
            .multiplyScalar(this.particleSpeed * (0.8 + Math.random() * 0.4));
        
        // Create the particle object
        const particle = {
            position: this.emitterPosition.clone(),
            velocity: velocity,
            lifetime: 0,
            maxLifetime: this.particleLifetime,
            active: true,
            index: this.particles.length
        };
        
        this.particles.push(particle);
        
        // Update particle geometry
        this.updateParticlePosition(particle);
    }
    
    updateParticlePosition(particle) {
        const positions = this.particleGeometry.attributes.position.array;
        const index = particle.index * 3;
        
        positions[index] = particle.position.x;
        positions[index + 1] = particle.position.y;
        positions[index + 2] = particle.position.z;
        
        this.particleGeometry.attributes.position.needsUpdate = true;
    }
    
    update() {
        const now = performance.now() / 1000; // Current time in seconds
        const collisions = [];
        
        // Emit new particles based on flow rate
        if (!this.lastEmitTime) this.lastEmitTime = now;
        
        const timeSinceLastEmit = now - this.lastEmitTime;
        const particlesToEmit = Math.floor(this.flowRate * timeSinceLastEmit);
        
        if (particlesToEmit > 0) {
            for (let i = 0; i < particlesToEmit; i++) {
                this.createParticle();
            }
            this.lastEmitTime = now;
        }
        
        // Update existing particles
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            
            if (!particle.active) continue;
            
            // Update lifetime
            particle.lifetime += this.timeStep;
            if (particle.lifetime >= particle.maxLifetime) {
                // Deactivate the particle and move it off-screen
                particle.active = false;
                particle.position.y = -1000;
                this.updateParticlePosition(particle);
                continue;
            }
            
            // Store previous position for collision detection
            const prevPosition = particle.position.clone();
            
            // Apply gravity
            particle.velocity.add(this.gravity.clone().multiplyScalar(this.timeStep));
            
            // Update position
            const movement = particle.velocity.clone().multiplyScalar(this.timeStep);
            particle.position.add(movement);
            
            // Check for collision with target model
            const collision = this.checkCollision(prevPosition, particle.position, particle.velocity);
            if (collision) {
                // Add collision to the results
                collisions.push({
                    point: collision.point,
                    normal: collision.face.normal,
                    velocity: particle.velocity.length(),
                    angle: particle.velocity.angleTo(collision.face.normal)
                });
                
                // Make particle inactive after collision
                particle.active = false;
                particle.position.y = -1000;
            }
            
            // Update particle position in geometry
            this.updateParticlePosition(particle);
        }
        
        return collisions;
    }
    
    checkCollision(startPoint, endPoint, velocity) {
        // Check if the particle intersects with the model using raycasting
        const direction = new THREE.Vector3().subVectors(endPoint, startPoint).normalize();
        const distance = startPoint.distanceTo(endPoint);
        
        this.raycaster.set(startPoint, direction);
        
        // Find intersections with the model
        const intersects = this.raycaster.intersectObject(this.target, true);
        
        if (intersects.length > 0 && intersects[0].distance <= distance) {
            return intersects[0];
        }
        
        return null;
    }
    
    stop() {
        if (this.particleSystem && this.scene) {
            this.scene.remove(this.particleSystem);
        }
        
        this.particles = [];
        this.particleSystem = null;
    }
}
