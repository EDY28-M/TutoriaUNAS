import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ref = 'a347af95478f989038cccbf085978865264c048a';
const origin = `https://raw.githubusercontent.com/microsoft/fluentui-system-icons/${ref}`;
const destination = resolve(root, 'frontend/src/assets/vendor/fluent-color');
await mkdir(destination, { recursive: true });
const catalogResponse = await fetch(`${origin}/icons_color.md`);
if (!catalogResponse.ok) throw new Error(`Catalog: ${catalogResponse.status}`);
const catalog = await catalogResponse.text();
const available = new Map([...catalog.matchAll(/^\|([^|]+)\|<img src="([^?"]+)/gm)].map(match => [match[1], match[2]]));
const selection = {
  'table-columns': 'Home', bell: 'Alert', user: 'Person', users: 'People Community',
  'user-group': 'People Team', 'user-check': 'Person Available', 'user-plus': 'Person Add', headset: 'Headset',
  'graduation-cap': 'Certificate', 'chalkboard-user': 'People Chat', 'book-open': 'Book Open',
  'clipboard-list': 'Clipboard', 'clipboard-check': 'Clipboard Task', 'list-check': 'Clipboard Task',
  'file-lines': 'Document Text', 'file-circle-check': 'Approvals App', 'clock-rotate-left': 'History',
  'file-csv': 'Table', 'folder-open': 'Document Folder', 'layer-group': 'Library', sliders: 'Settings',
  bullseye: 'Flag', award: 'Ribbon Star', 'circle-check': 'Checkmark Circle', scroll: 'Receipt',
  'scale-balanced': 'Building Government', percent: 'Gauge', 'chart-bar': 'Chart Multiple',
  'arrow-trend-up': 'Data Trending', 'wave-square': 'Data Line', 'id-card': 'Contact Card', key: 'Person Key',
  lock: 'Lock Closed', 'shield-halved': 'Shield Checkmark', 'user-lock': 'Person Warning', database: 'Database',
  server: 'Database', 'diagram-project': 'Org', plug: 'Link', 'calendar-days': 'Calendar',
  'calendar-check': 'Calendar Checkmark', 'calendar': 'Calendar Clock', 'calendar-week': 'Shifts', clock: 'Clock',
  'location-dot': 'Location Ripple', video: 'Video', 'hourglass-half': 'Clock Alarm', 'signs-post': 'Flag',
  'circle-nodes': 'Link Multiple', 'fingerprint': 'Scan Person', 'circle-exclamation': 'Error Circle',
  'triangle-exclamation': 'Warning', ban: 'Dismiss Circle', flag: 'Flag', 'paper-plane': 'Send',
  inbox: 'Mail Multiple', pen: 'Edit', envelope: 'Mail', 'envelope-circle-check': 'Mail Alert',
  'envelope-open': 'Drafts', 'envelope-open-text': 'Mail Multiple', bullhorn: 'Megaphone Loud', phone: 'Phone',
  utensils: 'Food', 'heart-pulse': 'Heart', 'hand-holding-heart': 'Person Heart', stethoscope: 'Patient',
  building: 'Building Government', briefcase: 'Briefcase', handshake: 'People Interwoven',
  download: 'Arrow Square Down', 'arrow-right-arrow-left': 'People Sync',
};
const assets = [...new Set(Object.values(selection))];
const manifest = [];
for (let offset = 0; offset < assets.length; offset += 6) {
  await Promise.all(assets.slice(offset, offset + 6).map(async name => {
    const path = available.get(name);
    if (!path) throw new Error(`No official color asset: ${name}`);
    const url = `${origin}/${path.split('/').map(encodeURIComponent).join('/')}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${name}: ${response.status}`);
    const svg = await response.text();
    if (!svg.includes('<svg') || /<script|<foreignObject|\bon[a-z]+=|(?:href|src)=["']https?:/i.test(svg)) throw new Error(`Unexpected SVG content: ${name}`);
    const file = `${name.toLowerCase().replaceAll(' ', '-')}.svg`;
    await writeFile(resolve(destination, file), svg);
    manifest.push({ name, file, source: url, sha256: createHash('sha256').update(svg).digest('hex') });
  }));
}
const license = await fetch(`${origin}/LICENSE`);
if (!license.ok) throw new Error(`License: ${license.status}`);
const licenseText = await license.text();
await writeFile(resolve(destination, 'LICENSE.txt'), licenseText);
const publicLicenses = resolve(root, 'frontend/public/assets/licenses');
await mkdir(publicLicenses, { recursive: true });
await writeFile(resolve(publicLicenses, 'Microsoft-Fluent-Color.txt'), licenseText);
manifest.sort((a,b)=>a.name.localeCompare(b.name));
await writeFile(resolve(destination, 'sources.json'), JSON.stringify({ library:'Microsoft Fluent UI System Icons · Color', ref, license:'MIT', assets:manifest }, null, 2));
const imports = assets.map((name,index)=>`import art${index} from './fluent-color/${name.toLowerCase().replaceAll(' ', '-')}.svg?url';`).join('\n');
const map = Object.entries(selection).map(([glyph,name])=>`  ${JSON.stringify(glyph)}: art${assets.indexOf(name)},`).join('\n');
await writeFile(resolve(root,'frontend/src/assets/vendor/fluent-color.ts'), `/** Official Microsoft Fluent Color SVG assets, MIT licensed.\n * Pinned source: https://github.com/microsoft/fluentui-system-icons/tree/${ref}\n * Regenerate with scripts/vendor-fluent-art.mjs. */\n${imports}\n\nexport const fluentColorArt: Record<string, string> = {\n${map}\n};\n`);
console.log(`Vendored ${assets.length} official illustrated SVGs for ${Object.keys(selection).length} semantic symbols.`);
