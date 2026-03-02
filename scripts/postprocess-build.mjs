import { promises as fs } from 'node:fs';
import path from 'node:path';

export function stripTypeModuleAttribute(html) {
  return html.replace(/ type=module/g, '');
}

export function stripParcelExportPrelude(js) {
  return js.replace(/let\{[^}]*\}=parcelRequire[^;]*;export\{[^}]*\};/g, '');
}

async function processFile(filePath, transform) {
  const content = await fs.readFile(filePath, 'utf8');
  const next = transform(content);
  if (next !== content) {
    await fs.writeFile(filePath, next, 'utf8');
  }
}

export async function postProcessDistUi(
  distUiDir = path.join(process.cwd(), 'dist', 'ui'),
) {
  const entries = await fs.readdir(distUiDir, { withFileTypes: true });
  const uiDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

  for (const dirName of uiDirs) {
    const dirPath = path.join(distUiDir, dirName);
    const htmlPath = path.join(dirPath, 'index.html');

    try {
      await fs.access(htmlPath);
      await processFile(htmlPath, stripTypeModuleAttribute);
    } catch {
      // ignore missing index.html in a target directory
    }

    const files = await fs.readdir(dirPath, { withFileTypes: true });
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith('.js')) continue;
      await processFile(path.join(dirPath, file.name), stripParcelExportPrelude);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  postProcessDistUi().catch((error) => {
    console.error('[postprocess-build] Failed to post-process dist/ui:', error);
    process.exit(1);
  });
}
