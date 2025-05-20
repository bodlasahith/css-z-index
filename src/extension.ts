import * as vscode from "vscode";
import * as fs from "fs";
import postcss from "postcss";
import { load } from "cheerio";
import { Element } from "domhandler";

class ZIndexItem extends vscode.TreeItem {
  constructor(public readonly label: string, public readonly zIndex: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = `z-index: ${zIndex}`;
  }
}

class ZIndexProvider implements vscode.TreeDataProvider<ZIndexItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ZIndexItem | undefined | void> =
    new vscode.EventEmitter<ZIndexItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<ZIndexItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private zIndexData: ZIndexItem[] = [];

  refresh(data: { selector: string; value: string }[]) {
    this.zIndexData = data.map((entry) => new ZIndexItem(entry.selector, entry.value));
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ZIndexItem): vscode.TreeItem {
    return element;
  }

  getChildren(): ZIndexItem[] {
    return this.zIndexData;
  }
}

let activeDecoratedEditor: vscode.TextEditor | undefined; // Store reference to the editor with decorations
let decorationType: vscode.TextEditorDecorationType | null = null; // Store the decoration type globally

function toggleHighlights(
  enabled: boolean,
  zIndexData: { selector: string; value: string }[],
  cssDocument: vscode.TextDocument
) {
  const editor = vscode.window.visibleTextEditors.find(
    (e) => e.document.uri.toString() === cssDocument.uri.toString()
  );
  if (!editor) {
    return;
  }

  // Create the decoration type if it doesn't exist
  if (!decorationType) {
    decorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: "rgba(255, 255, 0, 0.3)",
      border: "1px solid green",
    });
  }

  if (enabled) {
    const decorations: vscode.DecorationOptions[] = [];
    const text = cssDocument.getText();

    zIndexData.forEach((item) => {
      const regex = new RegExp(`${item.selector}\\s*\\{[^}]*z-index:\\s*${item.value}`, "g");
      let match;
      while ((match = regex.exec(text)) !== null) {
        const startPos = cssDocument.positionAt(match.index);
        const endPos = cssDocument.positionAt(match.index + match[0].length);

        decorations.push({ range: new vscode.Range(startPos, endPos) });
      }
    });

    editor.setDecorations(decorationType, decorations);
  } else {
    // Clear decorations when disabled
    editor.setDecorations(decorationType, []);
  }
}

function createWebview(
  zIndexData: {
    selector: string;
    value: string;
    width: string;
    height: string;
    margin: string;
    padding: string;
    marginTop: string;
    marginBottom: string;
    marginLeft: string;
    marginRight: string;
    paddingTop: string;
    paddingBottom: string;
    paddingLeft: string;
    paddingRight: string;
    left: string;
    right: string;
    top: string;
    bottom: string;
  }[],
  cssDocument: vscode.TextDocument
) {
  const panel = vscode.window.createWebviewPanel(
    "zIndexVisualizer",
    "Z-Index Visualizer",
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    { enableScripts: true }
  );

  const cssFilePath = vscode.window.activeTextEditor?.document.uri.fsPath;
  if (!cssFilePath) {
    vscode.window.showErrorMessage("No active CSS file found.");
    return;
  }

  const htmlFilePath = cssFilePath.replace(/\.css$/, ".html");
  if (!fs.existsSync(htmlFilePath)) {
    vscode.window.showErrorMessage("No corresponding HTML file found.");
    return;
  }

  const htmlContent = fs.readFileSync(htmlFilePath, "utf-8");
  const $ = load(htmlContent);

  // Extract DOM structure
  const htmlStructure: {
    tag: string;
    id: string;
    classList: string[];
    zIndex: number;
    width: number;
    height: number;
    margin: number;
    padding: number;
    marginTop: number;
    marginBottom: number;
    marginLeft: number;
    marginRight: number;
    paddingTop: number;
    paddingBottom: number;
    paddingLeft: number;
    paddingRight: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
  }[] = [];
  $("*").each((_, element) => {
    const tag = (element as Element).tagName;
    const id = $(element).attr("id") || "";
    const classList = ($(element).attr("class") || "").split(/\s+/);
    const selector = id ? `#${id}` : classList.length ? `.${classList.join(".")}` : tag;

    // Match selector with CSS data
    const zIndexEntry = zIndexData.find((entry) => entry.selector === selector);
    const zIndex = zIndexEntry ? parseInt(zIndexEntry.value, 10) : 0;

    const width = zIndexEntry ? parseInt(zIndexEntry.width, 10) : 0;
    const height = zIndexEntry ? parseInt(zIndexEntry.height, 10) : 0;
    const margin = zIndexEntry ? parseInt(zIndexEntry.margin, 10) : 0;
    const padding = zIndexEntry ? parseInt(zIndexEntry.padding, 10) : 0;
    const marginTop = zIndexEntry ? parseInt(zIndexEntry.marginTop, 10) : 0;
    const marginBottom = zIndexEntry ? parseInt(zIndexEntry.marginBottom, 10) : 0;
    const marginLeft = zIndexEntry ? parseInt(zIndexEntry.marginLeft, 10) : 0;
    const marginRight = zIndexEntry ? parseInt(zIndexEntry.marginRight, 10) : 0;
    const paddingTop = zIndexEntry ? parseInt(zIndexEntry.paddingTop, 10) : 0;
    const paddingBottom = zIndexEntry ? parseInt(zIndexEntry.paddingBottom, 10) : 0;
    const paddingLeft = zIndexEntry ? parseInt(zIndexEntry.paddingLeft, 10) : 0;
    const paddingRight = zIndexEntry ? parseInt(zIndexEntry.paddingRight, 10) : 0;
    const left = zIndexEntry ? parseInt(zIndexEntry.left, 10) : 0;
    const right = zIndexEntry ? parseInt(zIndexEntry.right, 10) : 0;
    const top = zIndexEntry ? parseInt(zIndexEntry.top, 10) : 0;
    const bottom = zIndexEntry ? parseInt(zIndexEntry.bottom, 10) : 0;

    htmlStructure.push({
      tag,
      id,
      classList,
      zIndex,
      width,
      height,
      margin,
      padding,
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
      paddingTop,
      paddingBottom,
      paddingLeft,
      paddingRight,
      left,
      right,
      top,
      bottom,
    });
  });

  panel.webview.html = getWebviewContent(zIndexData, htmlStructure);

  // Keep track of highlights state
  let highlightsEnabled = false;

  panel.webview.onDidReceiveMessage((message) => {
    if (message.command === "revealCss") {
      const { line, character } = message.position;
      const editor = vscode.window.visibleTextEditors.find(
        (e) => e.document.uri.toString() === cssDocument.uri.toString()
      );
      if (editor) {
        const position = new vscode.Position(line, character);
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.Default
        );
        editor.selection = new vscode.Selection(position, position);
      }
    } else if (message.command === "toggleHighlights") {
      highlightsEnabled = message.enabled;
      toggleHighlights(highlightsEnabled, zIndexData, cssDocument);
    }
  });
}

// Helper function to generate the webview HTML content
function getWebviewContent(
  zIndexData: { selector: string; value: string }[],
  htmlStructure: {
    tag: string;
    id: string;
    classList: string[];
    zIndex: number;
    width: number;
    height: number;
    margin: number;
    padding: number;
    marginTop: number;
    marginBottom: number;
    marginLeft: number;
    marginRight: number;
    paddingTop: number;
    paddingBottom: number;
    paddingLeft: number;
    paddingRight: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
  }[]
) {
  const labels = zIndexData.map((item) => item.selector);
  const data = zIndexData.map((item) => parseInt(item.value, 10));

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/three/examples/js/controls/OrbitControls.js"></script>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          margin: 0;
          overflow-y: auto;
          overflow-x: auto;
        }
        canvas {
          max-width: 100%;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
          margin-bottom: 20px;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        tr:nth-child(even) {
          background-color: #f2f2f2;
        }
        tr:hover {
          background-color: #ddd;
          cursor: pointer;
        }
        #toggle-button {
          margin: 10px 0;
          padding: 8px 16px;
          background-color: #007acc;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        #toggle-button:hover {
          background-color: #005fa3;
        }
        #info {
          padding: 10px;
          border-radius: 5px;
          z-index: 100;
          font-size: 13px;
          margin-bottom: 60px;
        }
        #three-container {
          bottom: 0;
          width: 95%;
          height: 400px;
          position: relative;
        }
      </style>
    </head>
    <body>
      <h1>Z-Index Stacking Order</h1>
      <button id="toggle-button">Enable Highlights</button>
      <p>Click a bar in the chart or a row in the table to reveal the corresponding CSS element.</p>
      <canvas id="zIndexChart"></canvas>
      <table>
        <thead>
          <tr>
            <th>Selector</th>
            <th>Z-Index</th>
          </tr>
        </thead>
        <tbody>
          ${zIndexData
            .map(
              (item, index) => `
            <tr data-index="${index}">
              <td>${item.selector}</td>
              <td>${item.value}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
      <div id="three-container"></div>
      <div id="info">
        <h3>3D Z-Index Topology Map</h3>
        <p>Hover over elements to view details.</p>
      </div>
      <script>
        const vscode = acquireVsCodeApi();
        let highlightsEnabled = false;

        // Toggle Highlights
        document.getElementById('toggle-button').addEventListener('click', () => {
          highlightsEnabled = !highlightsEnabled;
          vscode.postMessage({ command: 'toggleHighlights', enabled: highlightsEnabled });

          const button = document.getElementById('toggle-button');
          button.textContent = highlightsEnabled ? 'Disable Highlights' : 'Enable Highlights';
        });

        // Chart.js Visualization
        const ctx = document.getElementById('zIndexChart').getContext('2d');
        const zIndexChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: ${JSON.stringify(labels)},
            datasets: [
              {
                label: 'Z-Index Values',
                data: ${JSON.stringify(data)},
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1,
              },
            ],
          },
          options: {
            responsive: true,
            plugins: {
              legend: {
                display: false,
              },
              tooltip: {
                callbacks: {
                  label: (context) => \`Selector: \${context.label}, Z-Index: \${context.raw}\`,
                },
              },
            },
            scales: {
              y: {
                beginAtZero: true,
              },
            },
            onClick: (event, elements) => {
              if (elements.length > 0) {
                const index = elements[0].index;
                vscode.postMessage({
                  command: 'revealCss',
                  position: {
                    line: index * 4, // Example mapping: Adjust to your CSS file structure
                    character: 0,
                  },
                });
              }
            },
          },
        });

        // Reveal on Table Row Click
        document.querySelectorAll('tr[data-index]').forEach((row) => {
          row.addEventListener('click', () => {
            const index = row.getAttribute('data-index');
            vscode.postMessage({
              command: 'revealCss',
              position: {
                line: parseInt(index) * 4, // Example: Adjust this to match your line mapping
                character: 0,
              },
            });
          });
        });

        const container = document.getElementById('three-container');
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(renderer.domElement);

        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.25;
        controls.enableZoom = true;
        controls.enablePan = true;
        controls.maxPolarAngle = Math.PI / 2;
        controls.minDistance = 5;
        controls.maxDistance = 50;

        const gridHelper = new THREE.GridHelper(5000, 5000);
        scene.add(gridHelper);
        const axesHelper = new THREE.AxesHelper(50, 50);
        scene.add(axesHelper);

        const light = new THREE.PointLight(0xffffff, 1, 100);
        light.position.set(10, 10, 10);
        scene.add(light);

        // 3D Visualization
        const htmlData = ${JSON.stringify(htmlStructure)};

        const elements = [];

        function parseLength(value) {
          const numeric = parseFloat(value);
          return isNaN(numeric) ? 1 : numeric;
        }

        function parseMarginAndPadding(value, fallback) {
          const numeric = parseFloat(value);
          return isNaN(numeric) || numeric === 0 ? parseFloat(fallback) || 0 : numeric;
        }

        function getRandomColor() {
          const letters = '0123456789ABCDEF';
          let color = '#';
          for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
          }
          return color;
        }

        htmlData.forEach((element) => {
          const { tag, id, classList, zIndex, width, height, margin, padding, marginTop, marginBottom, marginLeft, marginRight, paddingTop, paddingBottom, paddingLeft, paddingRight, left, right, top, bottom } = element;

          const effectiveWidth = parseLength(width) + parseMarginAndPadding(margin, marginLeft) + parseMarginAndPadding(margin, marginRight) + parseMarginAndPadding(padding, paddingLeft) + parseMarginAndPadding(padding, paddingRight);
          const effectiveHeight = parseLength(height) + parseMarginAndPadding(margin, marginTop) + parseMarginAndPadding(margin, marginBottom) + parseMarginAndPadding(padding, paddingTop) + parseMarginAndPadding(padding, paddingBottom);
          const effectiveLeft = parseLength(left) + parseMarginAndPadding(margin, marginLeft) + parseMarginAndPadding(padding, paddingLeft);
          const effectiveRight = parseLength(right) + parseMarginAndPadding(margin, marginRight) + parseMarginAndPadding(padding, paddingRight);
          const effectiveTop = parseLength(top) + parseMarginAndPadding(margin, marginTop) + parseMarginAndPadding(padding, paddingTop);
          const effectiveBottom = parseLength(bottom) + parseMarginAndPadding(margin, marginBottom) + parseMarginAndPadding(padding, paddingBottom);
          const elevation = (zIndex || 0) * 0.2 + 0.01; // z-index → elevation, min > 0

          const geometry = new THREE.BoxGeometry(effectiveWidth, elevation, effectiveHeight);
          const material = new THREE.MeshStandardMaterial({ color: getRandomColor(), transparent: true, opacity: 0.85 });
          const mesh = new THREE.Mesh(geometry, material);

          mesh.position.set(
            effectiveLeft - effectiveRight, // Use left/right to determine x position
            elevation / 2,                 // Elevation based on z-index
            effectiveTop - effectiveBottom  // Use top/bottom to determine z position
          );

          mesh.userData = { tag, id, classList, zIndex };
          elements.push(mesh);
          scene.add(mesh);
        });

        camera.position.set(5, 5, 20);
        camera.lookAt(scene.position);

        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        const highlightMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });

        function onMouseMove(event) {
          const rect = container.getBoundingClientRect();
          mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

          raycaster.setFromCamera(mouse, camera);
          const intersects = raycaster.intersectObjects(elements, true); // Ensure recursive check for child objects

          elements.forEach((el) => {
            if (!el.userData.defaultMaterial) {
              el.userData.defaultMaterial = el.material; // Store default material if not already stored
            }
            el.material = el.userData.defaultMaterial;
          });

          if (intersects.length > 0) {
            const selected = intersects[0].object;
            selected.material = highlightMaterial;

            const { tag, id, classList, zIndex } = selected.userData;
            document.getElementById('info').innerHTML = \`
              <h3>Element Details</h3>
              <p>Tag: \${tag}</p>
              <p>ID: \${id || 'None'}</p>
              <p>Classes: \${classList.join(', ') || 'None'}</p>
              <p>Z-Index: \${zIndex || 'None'}</p>
            \`;
          } else {
            document.getElementById('info').innerHTML = "<h3>3D Z-Index Topology Map</h3><p>Hover over elements to view details.</p>";
          }
        }

        container.addEventListener('mousemove', onMouseMove);

        function animate() {
          requestAnimationFrame(animate);
          renderer.render(scene, camera);
          controls.update();
        }

        window.addEventListener('resize', () => {
          camera.aspect = container.clientWidth / container.clientHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(container.clientWidth, container.clientHeight);
        });
        animate();
      </script>
    </body>
    </html>
  `;
}

function highlightZIndexDeclarations(
  zIndexes: { selector: string; value: string }[],
  document: vscode.TextDocument
) {
  const editor = vscode.window.visibleTextEditors.find((e) => e.document === document);
  if (!editor) {
    vscode.window.showWarningMessage("No active editor found for the document!");
    return;
  }

  // Clear previous decorations if they exist
  if (activeDecoratedEditor && decorationType) {
    activeDecoratedEditor.setDecorations(decorationType, []);
  }

  const decorations: vscode.DecorationOptions[] = [];
  const text = document.getText();

  zIndexes.forEach((item) => {
    const regex = new RegExp(`${item.selector}\\s*\\{[^}]*z-index:\\s*${item.value}`, "g");
    let match;
    while ((match = regex.exec(text)) !== null) {
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);

      decorations.push({ range: new vscode.Range(startPos, endPos) });
    }
  });

  decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgba(255, 255, 0, 0.3)",
    border: "1px solid green",
  });

  activeDecoratedEditor = editor;
  editor.setDecorations(decorationType, decorations);
}

export function activate(context: vscode.ExtensionContext) {
  const zIndexProvider = new ZIndexProvider();

  vscode.window.registerTreeDataProvider("zIndexTree", zIndexProvider);

  const disposable = vscode.commands.registerCommand("extension.parseZIndex", async () => {
    const editor = vscode.window.activeTextEditor;

    if (editor) {
      const document = editor.document;

      if (document.languageId === "css") {
        const cssContent = document.getText();
        const root = postcss.parse(cssContent);

        const zIndexes: {
          selector: string;
          value: string;
          width: string;
          height: string;
          margin: string;
          padding: string;
          marginTop: string;
          marginBottom: string;
          marginLeft: string;
          marginRight: string;
          paddingTop: string;
          paddingBottom: string;
          paddingLeft: string;
          paddingRight: string;
          left: string;
          right: string;
          top: string;
          bottom: string;
        }[] = [];

        root.walkRules((rule) => {
          let zIndexValue = "0";
          let widthValue = "0";
          let heightValue = "0";
          let marginValue = "0";
          let paddingValue = "0";
          let marginTop = "0";
          let marginBottom = "0";
          let marginLeft = "0";
          let marginRight = "0";
          let paddingTop = "0";
          let paddingBottom = "0";
          let paddingLeft = "0";
          let paddingRight = "0";
          let leftValue = "0";
          let rightValue = "0";
          let topValue = "0";
          let bottomValue = "0";

          rule.walkDecls((decl) => {
            if (decl.prop === "z-index") {
              zIndexValue = decl.value;
            } else if (decl.prop === "width") {
              widthValue = decl.value;
            } else if (decl.prop === "height") {
              heightValue = decl.value;
            } else if (decl.prop === "margin") {
              marginValue = decl.value;
            } else if (decl.prop === "padding") {
              paddingValue = decl.value;
            } else if (decl.prop === "margin-top") {
              marginTop = decl.value;
            } else if (decl.prop === "margin-bottom") {
              marginBottom = decl.value;
            } else if (decl.prop === "margin-left") {
              marginLeft = decl.value;
            } else if (decl.prop === "margin-right") {
              marginRight = decl.value;
            } else if (decl.prop === "padding-top") {
              paddingTop = decl.value;
            } else if (decl.prop === "padding-bottom") {
              paddingBottom = decl.value;
            } else if (decl.prop === "padding-left") {
              paddingLeft = decl.value;
            } else if (decl.prop === "padding-right") {
              paddingRight = decl.value;
            } else if (decl.prop === "left") {
              leftValue = decl.value;
            } else if (decl.prop === "right") {
              rightValue = decl.value;
            } else if (decl.prop === "top") {
              topValue = decl.value;
            } else if (decl.prop === "bottom") {
              bottomValue = decl.value;
            }
          });

          zIndexes.push({
            selector: rule.selector,
            value: zIndexValue,
            width: widthValue,
            height: heightValue,
            margin: marginValue,
            padding: paddingValue,
            marginTop,
            marginBottom,
            marginLeft,
            marginRight,
            paddingTop,
            paddingBottom,
            paddingLeft,
            paddingRight,
            left: leftValue,
            right: rightValue,
            top: topValue,
            bottom: bottomValue,
          });
        });

        zIndexProvider.refresh(zIndexes);
        vscode.window.showInformationMessage("Z-Index values visualized!");
        console.log("Extension command executed!");
        console.log(zIndexes); // Log your parsed z-index values

        const outputChannel = vscode.window.createOutputChannel("Z-Index Logger");

        outputChannel.appendLine("Parsing Z-Index values...");
        outputChannel.appendLine(JSON.stringify(zIndexes, null, 2)); // Pretty print
        outputChannel.show(); // Opens the output channel

        createWebview(zIndexes, document);
        highlightZIndexDeclarations(zIndexes, document);
      } else {
        vscode.window.showWarningMessage("Please open a CSS file to parse z-index values.");
      }
    }
  });

  context.subscriptions.push(disposable);
}
