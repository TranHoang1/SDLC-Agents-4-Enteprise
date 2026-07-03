// Usage: node inject_debug.js [path-to-extension.js]
const targetPath = process.argv[2] || 'C:\\Users\\ASUS\\.antigravity-ide\\extensions\\dnguyenminh.kiro-sdlc-agents-2.0.0\\out\\extension.js';
const fs = require('fs');

const content = fs.readFileSync(targetPath, 'utf8');
const logPath = targetPath.replace(/\\out\\extension\.js$/, '\\kiro_debug.log');

const modified = content.replace(
  'this.outputChannel.appendLine(`[MCP-InProcess] Server running in-process on port ${this._port} (PID: ${process.pid})`),this.updateMcpJson()',
  'this.outputChannel.appendLine(`[MCP-InProcess] Server running in-process on port ${this._port} (PID: ${process.pid})`),this.updateMcpJson(); require("fs").appendFileSync("' + logPath + '", "SERVER STARTED ON " + this._port + "\\n");'
);

fs.writeFileSync(targetPath, modified);
console.log('Modified extension.js to write debug logs');
