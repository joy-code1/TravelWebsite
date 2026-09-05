#!/usr/bin/env node
/* ==========================================================================
   Regenerate assets/js/data.js from server/data/content.json.
   Zero dependencies.  Run via `npm run sync` (or automatically whenever
   content is saved through PUT /api/content).
   ========================================================================== */
'use strict';

const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const app = require(path.join(ROOT, 'server', 'server.js'));

try {
  const target = app.mirrorContentToFrontend();
  const content = app.getContent();
  console.log('[sync] assets/js/data.js regenerated from server/data/content.json');
  console.log('[sync] destinations: ' + content.destinations.length +
    ', features: ' + content.features.length +
    ', testimonials: ' + content.testimonials.length +
    ', posts: ' + content.posts.length);
  console.log('[sync] wrote: ' + path.relative(process.cwd(), target));
} catch (err) {
  console.error('[sync] failed: ' + (err && err.message ? err.message : err));
  process.exit(1);
}
