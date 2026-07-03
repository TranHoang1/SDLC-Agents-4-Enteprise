// Usage: node inject_error.js [path-to-extension.js]
const targetPath = process.argv[2] || 'C:\\Users\\ASUS\\.antigravity-ide\\extensions\\dnguyenminh.kiro-sdlc-agents-2.0.0\\out\\extension.js';
const fs = require('fs');

const content = fs.readFileSync(targetPath, 'utf8');
const logPath = targetPath.replace(/\\out\\extension\.js$/, '\\kiro_debug.log');

const modified = content.replace(
  'this.outputChannel.appendLine(`[MCP-InProcess] Failed to start: ${l}`),c}}',
  'this.outputChannel.appendLine(`[MCP-InProcess] Failed to start: ${l}`); require("fs").appendFileSync("' + logPath + '", "ERROR: " + (c.stack || c) + "\\n"); throw c}}'
);

fs.writeFileSync(targetPath, modified);
console.log('Modified extension.js to write errors to debug log');
