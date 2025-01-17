import * as vscode from "vscode";
import postcss from "postcss";

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
  context: vscode.ExtensionContext,
  zIndexData: { selector: string; value: string }[],
  cssDocument: vscode.TextDocument
) {
  const panel = vscode.window.createWebviewPanel(
    "zIndexVisualizer",
    "Z-Index Visualizer",
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    { enableScripts: true }
  );

  panel.webview.html = getWebviewContent(zIndexData);

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
function getWebviewContent(zIndexData: { selector: string; value: string }[]) {
  const labels = zIndexData.map((item) => item.selector);
  const data = zIndexData.map((item) => parseInt(item.value, 10));

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
        }
        canvas {
          max-width: 100%;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
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

        const zIndexes: { selector: string; value: string }[] = [];

        root.walkDecls("z-index", (decl) => {
          zIndexes.push({
            selector:
              decl.parent && "selector" in decl.parent ? (decl.parent as any).selector : "unknown",
            value: decl.value,
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

        createWebview(context, zIndexes, document);
        highlightZIndexDeclarations(zIndexes, document);
      } else {
        vscode.window.showWarningMessage("Please open a CSS file to parse z-index values.");
      }
    }
  });

  context.subscriptions.push(disposable);
}
