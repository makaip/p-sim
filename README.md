# Urinal Splashback Calculator

Welcome to the **Urinal Splashback Calculator**, a cutting-edge web-based tool designed to simulate and analyze splashback patterns in 3D environments. This project leverages lightweight optimization and visualization techniques to provide an interactive and educational experience.

## Live Demo

No need to download or build anything! The calculator is deployed on GitHub Pages and can be accessed directly in your browser:

↗️ **[Launch the Calculator](https://makaip.github.io/p-sim/)**

## Features

- **Interactive 3D Environment**: Drag, rotate, and zoom to explore the simulation in real time.
- **Customizable Parameters**: Adjust the force factor and source point to see how splashback patterns change.
- **Heatmap Visualization**: View splashback intensity with a dynamic heatmap overlay.
- **Model Upload**: Upload your own 3D models in OBJ, STL, or GLTF/GLB formats for analysis.
- **Cross-Platform**: Works seamlessly on modern browsers across desktop and mobile devices.

## How To Use It

1. **Upload a Model**: Use the "Upload Model" section to load a 3D model of your choice.
2. **Adjust Parameters**: Modify the force factor and source point position to customize the simulation.
3. **Run the Simulation**: Click "Run Simulation" to analyze splashback patterns and view results.
4. **Explore Results**: Examine the heatmap and detailed statistics to understand the splashback behavior.

## How It Works

The Urinal Splashback Calculator uses lightweight physics modeling to calculate splashback patterns. Here's a breakdown of the process:

1. **Projectile Motion**:
   - The simulation models the trajectory of a particle (e.g., a droplet) using the principles of projectile motion.
   - The trajectory is calculated as a parabola, influenced by the initial velocity (derived from the force factor) and gravity.

2. **Force Factor**:
   - The force factor determines the initial velocity of the particle. A higher force factor results in a faster initial velocity, leading to longer and higher trajectories.

3. **Sampling Directions**:
   - The simulation samples multiple directions from the source point, covering a range of angles in 3D space.
   - This ensures that the splashback is analyzed comprehensively across all possible trajectories.

4. **Face Interception**:
   - For each trajectory, the simulation checks if the particle intersects with any face of the 3D model.
   - The intersection is calculated using ray-plane intersection techniques, where the face's normal vector and centroid are used to define the plane.

5. **Incident Angle**:
   - If an intersection is detected, the angle between the trajectory and the face's normal vector is calculated.
   - This angle determines the splashback intensity, as steeper angles generally result in higher splashback.

6. **Splashback Factor**:
   - The splashback factor for each face is computed based on the incident angle. The formula used is proportional to the square of the sine of the angle (`sin²(incidentAngle)`).

7. **Heatmap Visualization**:
   - The splashback factors are normalized and mapped to a color gradient (e.g., green to red) to create a heatmap.
   - The heatmap is applied to the 3D model, allowing users to visually identify areas with high and low splashback intensity.

By combining these calculations, the calculator provides an accurate and interactive visualization of splashback patterns.

