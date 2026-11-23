import * as THREE from 'three';

export interface ProceduralTextureSet {
  terrainDetailDiffuse: THREE.CanvasTexture;
  terrainDetailBump: THREE.CanvasTexture;
  stoneColumnDiffuse: THREE.CanvasTexture;
  stoneColumnBump: THREE.CanvasTexture;
  woodDiffuse: THREE.CanvasTexture;
  woodBump: THREE.CanvasTexture;
  disposeAll: () => void;
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return [canvas, canvas.getContext('2d')];
}

function wrapDraw(size: number, draw: (ox: number, oy: number) => void) {
  for (const ox of [-size, 0, size]) {
    for (const oy of [-size, 0, size]) {
      draw(ox, oy);
    }
  }
}

function drawSoftMottle(
  ctx: CanvasRenderingContext2D,
  size: number,
  cx: number,
  cy: number,
  radius: number,
  innerRgba: string,
  outerRgba: string
) {
  wrapDraw(size, (ox, oy) => {
    const x = cx + ox;
    const y = cy + oy;
    if (x + radius < 0 || x - radius > size || y + radius < 0 || y - radius > size) return;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, innerRgba);
    grad.addColorStop(1, outerRgba);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function toTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  isColor = true
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  return tex;
}

export function createProceduralTextureSet(): ProceduralTextureSet {
  const all: THREE.CanvasTexture[] = [];

  // 1. Neutral Micro-Detail Grain + Bump for Continuous Biome Terrain (512x512)
  // Zero large circles so tiling across 172x172 shows crisp organic texture with no polka-dots!
  const [terrC, terrCtx] = makeCanvas(512);
  const [terrBC, terrBCtx] = makeCanvas(512);
  if (terrCtx && terrBCtx) {
    terrCtx.fillStyle = '#f6f6f6';
    terrCtx.fillRect(0, 0, 512, 512);
    terrBCtx.fillStyle = '#808080';
    terrBCtx.fillRect(0, 0, 512, 512);

    // Seamless low-contrast organic noise clouds using tiny overlapping varied ellipses
    for (let i = 0; i < 240; i += 1) {
      const x = (i * 173 + (i % 7) * 29) % 512;
      const y = (i * 251 + (i % 11) * 19) % 512;
      const r = 10 + (i % 5) * 4;
      const bright = i % 2 === 0;
      drawSoftMottle(
        terrCtx,
        512,
        x,
        y,
        r,
        bright ? 'rgba(255, 255, 255, 0.14)' : 'rgba(230, 230, 230, 0.12)',
        bright ? 'rgba(255, 255, 255, 0)' : 'rgba(230, 230, 230, 0)'
      );
      drawSoftMottle(
        terrBCtx,
        512,
        x,
        y,
        r * 0.9,
        bright ? 'rgba(154, 154, 154, 0.18)' : 'rgba(104, 104, 104, 0.18)',
        bright ? 'rgba(154, 154, 154, 0)' : 'rgba(104, 104, 104, 0)'
      );
    }

    // Fine organic sand grains, grass blade flecks, and soil micro-speckles
    for (let i = 0; i < 1100; i += 1) {
      const x = (i * 97 + (i % 13) * 17) % 512;
      const y = (i * 199 + (i % 17) * 23) % 512;
      const w = 1 + (i % 2);
      const h = 2 + (i % 4);
      terrCtx.fillStyle =
        i % 3 === 0 ? 'rgba(218, 218, 218, 0.36)' : 'rgba(255, 255, 255, 0.42)';
      terrBCtx.fillStyle =
        i % 3 === 0 ? 'rgba(72, 72, 72, 0.42)' : 'rgba(198, 198, 198, 0.38)';
      wrapDraw(512, (ox, oy) => {
        if (x + ox < -4 || x + ox > 516 || y + oy < -4 || y + oy > 516) return;
        terrCtx.fillRect(x + ox, y + oy, w, h);
        terrBCtx.fillRect(x + ox, y + oy, w, h);
      });
    }
  }
  const terrainDetailDiffuse = toTexture(terrC, 34, 34, true);
  const terrainDetailBump = toTexture(terrBC, 34, 34, false);
  all.push(terrainDetailDiffuse, terrainDetailBump);

  // 2. Carved Ancient Temple Stone + Moss Crevices (256x256)
  const [stC, stCtx] = makeCanvas(256);
  const [stBC, stBCtx] = makeCanvas(256);
  if (stCtx && stBCtx) {
    stCtx.fillStyle = '#9aa3ad';
    stCtx.fillRect(0, 0, 256, 256);
    stBCtx.fillStyle = '#9a9a9a';
    stBCtx.fillRect(0, 0, 256, 256);

    const tile = 64;
    for (let row = 0; row < 4; row += 1) {
      const offset = (row % 2) * 32;
      for (let col = -1; col < 5; col += 1) {
        const bx = col * tile + offset;
        const by = row * tile;
        stCtx.fillStyle = (row + col) % 2 === 0 ? '#aeb7c2' : '#949ea9';
        stCtx.fillRect(bx + 2, by + 2, tile - 4, tile - 4);
        stCtx.strokeStyle = '#5a6b5d';
        stCtx.lineWidth = 3;
        stCtx.strokeRect(bx + 1, by + 1, tile - 2, tile - 2);

        stBCtx.fillStyle = '#d4d4d4';
        stBCtx.fillRect(bx + 3, by + 3, tile - 6, tile - 6);
        stBCtx.strokeStyle = '#3a3a3a';
        stBCtx.lineWidth = 3;
        stBCtx.strokeRect(bx + 1, by + 1, tile - 2, tile - 2);
      }
    }
  }
  const stoneColumnDiffuse = toTexture(stC, 2, 2, true);
  const stoneColumnBump = toTexture(stBC, 2, 2, false);
  all.push(stoneColumnDiffuse, stoneColumnBump);

  // 3. Weathered Wood Plank Texture + Bump (256x256)
  const [woodC, woodCtx] = makeCanvas(256);
  const [woodBC, woodBCtx] = makeCanvas(256);
  if (woodCtx && woodBCtx) {
    woodCtx.fillStyle = '#a86b38';
    woodCtx.fillRect(0, 0, 256, 256);
    woodBCtx.fillStyle = '#969696';
    woodBCtx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 8; i += 1) {
      const y = i * 32;
      woodCtx.fillStyle = i % 2 === 0 ? '#b4753f' : '#9e6232';
      woodCtx.fillRect(0, y + 1, 256, 30);
      woodCtx.fillStyle = '#5c3314';
      woodCtx.fillRect(0, y, 256, 2);
      woodBCtx.fillStyle = '#b4b4b4';
      woodBCtx.fillRect(0, y + 2, 256, 28);
      woodBCtx.fillStyle = '#383838';
      woodBCtx.fillRect(0, y, 256, 2);
    }
    for (let i = 0; i < 42; i += 1) {
      const y = (i * 19 + 7) % 256;
      const x = (i * 47) % 220;
      woodCtx.fillStyle = 'rgba(72, 36, 12, 0.2)';
      woodCtx.fillRect(x, y, 36, 2);
    }
  }
  const woodDiffuse = toTexture(woodC, 1, 1, true);
  const woodBump = toTexture(woodBC, 1, 1, false);
  all.push(woodDiffuse, woodBump);

  return {
    terrainDetailDiffuse,
    terrainDetailBump,
    stoneColumnDiffuse,
    stoneColumnBump,
    woodDiffuse,
    woodBump,
    disposeAll: () => {
      for (const tex of all) {
        tex.dispose();
      }
    },
  };
}
