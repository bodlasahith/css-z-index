# z-index-visualizer README

## Description

The z-index-visualizer is a Visual Studio Code extension designed to help developers visualize and manage the z-index CSS property in their projects. This tool provides an intuitive interface to see the stacking context of elements, making it easier to debug and optimize the layering of elements on a webpage. With this extension, you can quickly identify z-index conflicts and ensure that your elements are displayed as intended.

## Features

- **Chart.js Rendering**: Visualize all the objects with a `z-index` attribute in a CSS file using an interactive chart powered by Chart.js.
- **Table View**: Render a detailed table displaying each HTML tag and its associated `z-index` value for easy reference.
- **Three.js DOM Visualization**: Explore an interactive 3D rendering of the DOM, highlighting selected HTML elements with `z-index` values for a comprehensive view of the stacking context.

## Deployment and Development

To package and deploy the z-index-visualizer extension locally, follow these steps:

1. **Install VSCE**:  
  Ensure you have the Visual Studio Code Extension Manager (VSCE) installed. You can install it globally using npm:  
  ```bash
  npm install -g @vscode/vsce
  ```

2. **Create the VSCE Package**:  
  Run the following command in the root directory of the project to generate the `.vsix` package:  
  ```bash
  vsce package
  ```

3. **Install the Extension Locally**:  
  Use the generated `.vsix` file to install the extension in Visual Studio Code:  
  ```bash
  code --install-extension <your-extension-name>.vsix
  ```

4. **For Developers**:  
  - Install Node.js if not already installed.
  - Run the following command to compile the project:  
    ```bash
    npm run compile
    ```
  - Open the project in Visual Studio Code and press `F5` to launch a local testing environment. Use the generated `out` file to test the extension on a CSS file.



https://github.com/user-attachments/assets/3c2664f3-7ede-4140-b23d-51148206f1e8



**Enjoy!**
