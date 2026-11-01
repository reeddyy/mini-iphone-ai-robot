# Third-party notices

## MediaPipe Face Mesh

Pinned npm package: `@mediapipe/face_mesh@0.4.1633559619`, by Google/MediaPipe contributors, Apache-2.0. JavaScript, graph, packed model assets and SIMD/non-SIMD WebAssembly runtimes are vendored under `public/vendor/mediapipe/face-mesh-0.4.1633559619-mini1/`. The upstream [license](public/vendor/mediapipe/face-mesh-0.4.1633559619-mini1/LICENSE) includes its additional notices.

Sources:

- https://registry.npmjs.org/@mediapipe/face_mesh/-/face_mesh-0.4.1633559619.tgz
- https://github.com/google-ai-edge/mediapipe
- License copied from https://raw.githubusercontent.com/google-ai-edge/mediapipe/master/LICENSE

Original package archive SHA-256: `a65c9a7509560f29e574c026dc6a667d2154617eb3ba0c287db02350de0c116f`.

Mini modifies `face_mesh.js` in one place: immediately after the worker calls `d.h.GL.makeContextCurrent(k)`, it assigns `d.D=d.h.GL.getContext(k).GLctx`. Upstream initializes its worker canvas/context but does not retain the JS WebGL context used for later input texture uploads; this fixes that worker path. A modification comment is added at the top. No other upstream runtime/model asset is modified. File SHA-256 values, including the modified file and license, are recorded in [the asset manifest](docs/face-mesh-assets.sha256.json). The `-mini1` versioned URL distinguishes this local modification for immutable caching.

To reproduce: download/extract the exact npm archive, copy only `face_mesh*` assets into the versioned directory, apply the single assignment above and top-of-file notice, and copy the upstream license. Check the resulting hashes. Load everything from the Mini server; never replace the assets with unpinned CDN URLs.

## Camera test fixture

Browser inference was checked using the public-domain NASA astronaut Eileen Collins photo distributed as scikit-image's `astronaut.png`. The photo is not bundled in the app and never goes to an AI provider in these tests. Source: https://github.com/scikit-image/scikit-image/blob/v0.25.2/skimage/data/astronaut.png . This adult fixture is not evidence of cue accuracy for children.
