// Après `expo export --platform web` : ajoute à dist/index.html ce qu'il faut pour « Ajouter à l'écran d'accueil »
// (manifeste, icône Apple, barre d'état, plein écran sous l'encoche). Expo ne génère pas ces balises en mode « single ».
import fs from 'node:fs';
import path from 'node:path';

const file = path.join(process.cwd(), 'dist', 'index.html');
let html = fs.readFileSync(file, 'utf8');

const tags = [
  '<link rel="manifest" href="/manifest.webmanifest" />',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
  '<meta name="theme-color" content="#28614D" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-title" content="Hojo" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
].join('\n    ');

html = html
  .replace('<html lang="en">', '<html lang="fr">')
  .replace('shrink-to-fit=no"', 'shrink-to-fit=no, viewport-fit=cover"')
  .replace('</head>', `    ${tags}\n  </head>`);

fs.writeFileSync(file, html);
console.log('dist/index.html complété pour l’installation sur l’écran d’accueil');
