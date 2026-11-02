const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = path.join(__dirname, 'plugins/english/zLibGd.ts');
const result = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  fileName: source,
  reportDiagnostics: true,
});
const errors = (result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
if (errors.length) {
  for (const error of errors) console.error(ts.flattenDiagnosticMessageText(error.messageText, '\n'));
  process.exit(1);
}
fs.writeFileSync(path.join(__dirname, 'zLibGd.js'), result.outputText);
console.log('Built zLibGd.js. Dependencies are supplied by LNReader at runtime.');
