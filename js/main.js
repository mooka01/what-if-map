// Entry point. Kept out of index.html so the page works under a strict
// Content-Security-Policy (no inline scripts).
import { boot } from './app.js';

boot({ root: document.getElementById('app') });
