import { installSeaDemo } from './sea-demo.js';

// The sea renderer hook must exist before app.js constructs its renderer and
// performs the first terrain render. One bootstrap module makes that ordering
// explicit instead of relying on sibling module-script scheduling.
installSeaDemo();
await import('./app.js');
