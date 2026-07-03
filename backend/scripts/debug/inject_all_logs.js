// Usage: node inject_all_logs.js [path-to-extension.js]
const targetPath = process.argv[2] || 'C:\\Users\\ASUS\\.antigravity-ide\\extensions\\dnguyenminh.kiro-sdlc-agents-2.0.0\\out\\extension.js';

const fs = require('fs');
const content = fs.readFileSync(targetPath, 'utf8');

let modified = content;

modified = modified.replace(
  /this\.outputChannel\.appendLine\((.*?)\)/g,
  'this.outputChannel.appendLine($1); require("fs").appendFileSync("' + targetPath.replace('out\\extension.js', 'kiro_debug.log') + '", $1 + "\\n")'
);

fs.writeFileSync(targetPath, modified);
console.log('Modified extension.js to mirror outputChannel to debug log');
