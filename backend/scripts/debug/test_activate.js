// WARNING: This script monkey-patches Module.prototype.require to mock the 'vscode' module.
// This is required because the extension bundle imports 'vscode' which is not available outside VS Code.
// Keep this script isolated in scripts/debug/ to avoid affecting other tests.

// Usage: node test_activate.js [path-to-extension.js]
const extensionPath = process.argv[2] || 'C:\\Users\\ASUS\\.antigravity-ide\\extensions\\dnguyenminh.kiro-sdlc-agents-2.0.0\\out\\extension.js';

const Module = require('module');
const originalRequire = Module.prototype.require;

// Only intercept 'vscode' requires; pass everything else through unchanged.
Module.prototype.require = function(id) {
  if (id === 'vscode') {
    return createVscodeMock();
  }
  return originalRequire.apply(this, arguments);
};

function createVscodeMock() {
  class DummyClass {}
  class EventEmitter {
    constructor() { this.events = {}; }
    event(fn) { return fn; }
    fire() {}
    dispose() {}
  }
  return {
    workspace: {
      getConfiguration: () => ({ get: () => ({}) }),
      onDidChangeConfiguration: () => ({ dispose: () => {} }),
      workspaceFolders: [{ uri: { fsPath: 'C:\\tmp\\workspace' } }],
      findFiles: async () => [],
      openTextDocument: async () => ({ getText: () => '' }),
      showTextDocument: async () => {},
      fs: {
        readFile: async () => Buffer.from(''),
        writeFile: async () => {},
        delete: async () => {},
        readDirectory: async () => []
      },
      asRelativePath: (p) => p,
      getDiagnostics: () => new Map(),
      onDidChangeWorkspaceFolders: () => ({ dispose: () => {} })
    },
    window: {
      createOutputChannel: () => ({ appendLine: () => {}, show: () => {} }),
      registerWebviewViewProvider: () => ({ dispose: () => {} }),
      createTreeView: () => ({
        dispose: () => {},
        onDidChangeSelection: () => ({ dispose: () => {} })
      }),
      createWebviewPanel: () => ({
        webview: {
          html: '',
          onDidReceiveMessage: () => ({ dispose: () => {} }),
          options: {},
          asWebviewUri: (u) => u
        },
        onDidDispose: () => ({ dispose: () => {} }),
        dispose: () => {},
        reveal: () => {}
      }),
      showInformationMessage: () => Promise.resolve(),
      showErrorMessage: () => Promise.resolve(),
      showWarningMessage: () => Promise.resolve(),
      showQuickPick: async () => null,
      showOpenDialog: async () => null,
      showInputBox: async () => null,
      activeTextEditor: null,
      activeTerminal: null,
      tabGroups: { all: [] },
      commands: {
        registerCommand: () => ({ dispose: () => {} }),
        executeCommand: async () => {}
      },
      createStatusBarItem: () => ({
        text: '', tooltip: '', command: '', show: () => {}, dispose: () => {}
      }),
      StatusBarAlignment: { Right: 1 }
    },
    Uri: {
      file: (f) => ({ fsPath: f, path: f }),
      joinPath: (...parts) => ({ fsPath: parts.join('/') })
    },
    ExtensionContext: DummyClass,
    TreeItem: DummyClass,
    EventEmitter: DummyClass,
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    ThemeIcon: DummyClass,
    Disposable: { from: () => ({ dispose: () => {} }) },
    ConfigurationTarget: { Workspace: 2, Global: 1 },
    DiagnosticSeverity: { Error: 1, Warning: 2, Information: 3, Hint: 4 },
    TabInputText: DummyClass,
    WebviewView: DummyClass,
    WebviewViewResolveContext: DummyClass,
    CancellationTokenSource: class {
      get token() { return { isCancellationRequested: false }; }
    },
    SecretStorage: {
      get: async () => null,
      store: async () => {},
      delete: async () => {}
    },
    Memento: class {
      get = () => undefined;
      update = async () => {}
    },
    QuickPickItemKind: { Separator: 0 },
    ViewColumn: { One: 1, Two: 2, Three: 3 }
  };
}

const ext = require(extensionPath);
console.log('Successfully required extension.js');

const mockContext = {
  subscriptions: [],
  extensionPath,
  globalState: { get: () => {}, update: () => {} },
  workspaceState: { get: () => undefined, update: async () => {} },
  secrets: {
    get: async () => null,
    store: async () => {},
    delete: async () => {}
  },
  extensionUri: { fsPath: extensionPath }
};

ext.activate(mockContext);
console.log('Successfully called activate()');
