// Handles simulation execution and integration with simulation engine and heatmap generator

// Import existing modules
import { SimulationEngine } from './simulationEngine.js';
import { HeatmapGenerator } from './heatmapGenerator.js';

export class SimulationRunner {
    constructor() {
        // Nothing to initialize
    }
    
    runSimulation(model, sourcePoint, forceValue) {
        try {
            // Run the simulation using the SimulationEngine
            const results = SimulationEngine.simulateSplashback(
                model,
                sourcePoint,
                forceValue
            );
            
            // Apply heatmap visualization to the model
            HeatmapGenerator.applyHeatmap(model, results);
            
            return results;
        } catch (error) {
            console.error('SimulationRunner error:', error);
            
            // If the error is about assigning to a constant variable,
            // provide a more specific error message
            if (error instanceof TypeError && error.message.includes('Assignment to constant variable')) {
                throw new Error('Simulation parameter conflict detected. This might be caused by a constraint violation in the physics model. Try different source position or force values.');
            }
            
            // Re-throw the original error with additional context
            throw new Error(`Simulation failed: ${error.message}`);
        }
    }
}
