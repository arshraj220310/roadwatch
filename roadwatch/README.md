# roadwatch

Road Asset Monitoring dashboard — map, routes list, analytics, and public reporting.

## Data

- **NH:** Generated from the Wikipedia national highways catalog (`scripts/nh-wikipedia.md`).
- **SH / MDR / City:** Catalog-style estimates for demo monitoring (`node scripts/generate-roads.mjs`).

Regenerate after editing the generator:

```bash
cd roadwatch
node scripts/generate-roads.mjs
```
