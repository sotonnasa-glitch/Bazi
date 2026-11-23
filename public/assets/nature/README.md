# Kenney Nature Kit — tree models

These two GLB models are included from Kenney's Nature Kit 2.1 and gzip-compressed to keep the web-game download small.

- `tree_palm.glb.gz` — palm trees used for the island's palm props
- `tree_default.glb.gz` — broadleaf trees used for jungle props

The game decompresses the files in the browser with the native `DecompressionStream('gzip')` API, then loads them with Three.js `GLTFLoader`. Tree instances are rendered with `THREE.InstancedMesh`.

**License:** CC0 1.0. Free for personal, educational and commercial projects. Attribution is optional.

**Source:** https://kenney.nl/assets/nature-kit
**Creator:** Kenney — https://kenney.nl
