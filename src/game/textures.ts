import * as THREE from 'three';

export interface ProceduralTextureSet {
  seaDiffuse: THREE.CanvasTexture;
  seaBump: THREE.CanvasTexture;
  grassDiffuse: THREE.CanvasTexture;
  grassBump: THREE.CanvasTexture;
  mossDiffuse: THREE.CanvasTexture;
  sandDiffuse: THREE.CanvasTexture;
  sandBump: THREE.CanvasTexture;
  dirtCliffDiffuse: THREE.CanvasTexture;
  dirtCliffBump: THREE.CanvasTexture;
  ruinStoneDiffuse: THREE.CanvasTexture;
  ruinStoneBump: THREE.CanvasTexture;
  basaltDiffuse: THREE.CanvasTexture;
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

function drawSoftRadialPatch(
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
    grad.addColorStop(0.55, innerRgba);
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

  // 1. Rich Glossy Sea Caustic Diffuse + Gentle Swell Bump (512x512, soft radial clouds only)
  const [seaC, seaCtx] = makeCanvas(512);
  const [seaBC, seaBCtx] = makeCanvas(512);
  if (seaCtx && seaBCtx) {
    seaCtx.fillStyle = '#1996c9';
    seaCtx.fillRect(0, 0, 512, 512);
    seaBCtx.fillStyle = '#808080';
    seaBCtx.fillRect(0, 0, 512, 512);

    // Deep azure & sunlit turquoise currents
    for (let i = 0; i < 42; i += 1) {
      const cx = (i * 113 + 29) % 512;
      const cy = (i * 181 + 47) % 512;
      const r = 55 + (i % 5) * 18;
      const light = i % 2 === 0;
      drawSoftRadialPatch(
        seaCtx,
        512,
        cx,
        cy,
        r,
        light ? 'rgba(72, 206, 240, 0.22)' : 'rgba(15, 114, 172, 0.24)',
        light ? 'rgba(72, 206, 240, 0)' : 'rgba(15, 114, 172, 0)'
      );
      drawSoftRadialPatch(
        seaBCtx,
        512,
        cx,
        cy,
        r * 0.85,
        light ? 'rgba(185, 185, 185, 0.24)' : 'rgba(78, 78, 78, 0.24)',
        light ? 'rgba(185, 185, 185, 0)' : 'rgba(78, 78, 78, 0)'
      );
    }

    // Subtle shimmering caustic highlights (soft glows, zero harsh lines)
    for (let i = 0; i < 55; i += 1) {
      const cx = (i * 157 + 19) % 512;
      const cy = (i * 89 + 73) % 512;
      const r = 16 + (i % 4) * 7;
      drawSoftRadialPatch(
        seaCtx,
        512,
        cx,
        cy,
        r,
        'rgba(176, 240, 255, 0.14)',
        'rgba(176, 240, 255, 0)'
      );
    }
  }
  const seaDiffuse = toTexture(seaC, 20, 20, true);
  const seaBump = toTexture(seaBC, 20, 20, false);
  all.push(seaDiffuse, seaBump);

  // 2. Natural Organic Meadow Grass (512x512, zero hard rings, world-space repeat 0.08)
  const [grassC, grassCtx] = makeCanvas(512);
  const [grassBC, grassBCtx] = makeCanvas(512);
  if (grassCtx && grassBCtx) {
    grassCtx.fillStyle = '#6ec045';
    grassCtx.fillRect(0, 0, 512, 512);
    grassBCtx.fillStyle = '#808080';
    grassBCtx.fillRect(0, 0, 512, 512);

    // Broad sunlit & mossy meadow patches via soft radial gradients
    for (let i = 0; i < 52; i += 1) {
      const x = (i * 131 + 17) % 512;
      const y = (i * 197 + 31) % 512;
      const r = 48 + (i % 5) * 18;
      const sunny = i % 3 !== 0;
      drawSoftRadialPatch(
        grassCtx,
        512,
        x,
        y,
        r,
        sunny ? 'rgba(154, 219, 86, 0.24)' : 'rgba(72, 152, 46, 0.22)',
        sunny ? 'rgba(154, 219, 86, 0)' : 'rgba(72, 152, 46, 0)'
      );
      drawSoftRadialPatch(
        grassBCtx,
        512,
        x,
        y,
        r * 0.75,
        sunny ? 'rgba(165, 165, 165, 0.2)' : 'rgba(95, 95, 95, 0.2)',
        sunny ? 'rgba(165, 165, 165, 0)' : 'rgba(95, 95, 95, 0)'
      );
    }

    // Fine scattered grass blade grain + tiny wildflowers
    for (let i = 0; i < 320; i += 1) {
      const x = (i * 73 + 23) % 512;
      const y = (i * 149 + 41) % 512;
      grassCtx.strokeStyle =
        i % 3 === 0 ? 'rgba(58, 128, 36, 0.32)' : 'rgba(176, 232, 108, 0.34)';
      grassCtx.lineWidth = 1.6;
      grassBCtx.strokeStyle = 'rgba(210, 210, 210, 0.3)';
      grassBCtx.lineWidth = 1.5;
      wrapDraw(512, (ox, oy) => {
        if (x + ox < -6 || x + ox > 518 || y + oy < -6 || y + oy > 518) return;
        grassCtx.beginPath();
        grassCtx.moveTo(x + ox, y + oy);
        grassCtx.lineTo(x + ox - 2, y + oy - 5);
        grassCtx.moveTo(x + ox + 2, y + oy);
        grassCtx.lineTo(x + ox + 4, y + oy - 4);
        grassCtx.stroke();

        grassBCtx.beginPath();
        grassBCtx.moveTo(x + ox, y + oy);
        grassBCtx.lineTo(x + ox, y + oy - 5);
        grassBCtx.stroke();
      });

      if (i % 26 === 0) {
        grassCtx.fillStyle = i % 52 === 0 ? 'rgba(255, 245, 168, 0.85)' : 'rgba(255, 255, 255, 0.82)';
        wrapDraw(512, (ox, oy) => {
          grassCtx.beginPath();
          grassCtx.arc(x + ox, y + oy, 2.2, 0, Math.PI * 2);
          grassCtx.fill();
        });
      }
    }
  }
  const grassDiffuse = toTexture(grassC, 0.085, 0.085, true);
  const grassBump = toTexture(grassBC, 0.085, 0.085, false);
  all.push(grassDiffuse, grassBump);

  // 3. Enchanted Mushroom Grove Moss (512x512, soft radial moss & glowing cyan spores)
  const [mossC, mossCtx] = makeCanvas(512);
  if (mossCtx) {
    mossCtx.fillStyle = '#438f5b';
    mossCtx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 48; i += 1) {
      const x = (i * 107 + 29) % 512;
      const y = (i * 173 + 13) % 512;
      const r = 42 + (i % 5) * 16;
      drawSoftRadialPatch(
        mossCtx,
        512,
        x,
        y,
        r,
        i % 2 === 0 ? 'rgba(98, 198, 134, 0.25)' : 'rgba(34, 96, 62, 0.28)',
        i % 2 === 0 ? 'rgba(98, 198, 134, 0)' : 'rgba(34, 96, 62, 0)'
      );
    }
    for (let i = 0; i < 48; i += 1) {
      const x = (i * 151 + 41) % 512;
      const y = (i * 97 + 67) % 512;
      drawSoftRadialPatch(
        mossCtx,
        512,
        x,
        y,
        7,
        'rgba(128, 252, 255, 0.55)',
        'rgba(128, 252, 255, 0)'
      );
    }
  }
  const mossDiffuse = toTexture(mossC, 0.095, 0.095, true);
  all.push(mossDiffuse);

  // 4. Warm Sunlit Wind-Swept Sand (512x512)
  const [sandC, sandCtx] = makeCanvas(512);
  const [sandBC, sandBCtx] = makeCanvas(512);
  if (sandCtx && sandBCtx) {
    sandCtx.fillStyle = '#ebd498';
    sandCtx.fillRect(0, 0, 512, 512);
    sandBCtx.fillStyle = '#808080';
    sandBCtx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 36; i += 1) {
      const x = (i * 139 + 11) % 512;
      const y = (i * 181 + 37) % 512;
      const r = 56 + (i % 4) * 20;
      drawSoftRadialPatch(
        sandCtx,
        512,
        x,
        y,
        r,
        i % 2 === 0 ? 'rgba(252, 240, 200, 0.24)' : 'rgba(214, 180, 108, 0.2)',
        i % 2 === 0 ? 'rgba(252, 240, 200, 0)' : 'rgba(214, 180, 108, 0)'
      );
    }

    for (let row = 0; row < 14; row += 1) {
      const yBase = row * 36.5;
      sandCtx.strokeStyle =
        row % 2 === 0 ? 'rgba(255, 248, 224, 0.22)' : 'rgba(206, 168, 96, 0.16)';
      sandCtx.lineWidth = 8;
      sandBCtx.strokeStyle =
        row % 2 === 0 ? 'rgba(155, 155, 155, 0.28)' : 'rgba(105, 105, 105, 0.26)';
      sandBCtx.lineWidth = 8;

      sandCtx.beginPath();
      sandBCtx.beginPath();
      for (let x = 0; x <= 512; x += 24) {
        const y = yBase + Math.sin((x / 512) * Math.PI * 2) * 7;
        if (x === 0) {
          sandCtx.moveTo(x, y);
          sandBCtx.moveTo(x, y);
        } else {
          sandCtx.lineTo(x, y);
          sandBCtx.lineTo(x, y);
        }
      }
      sandCtx.stroke();
      sandBCtx.stroke();
    }

    // Fine mineral & shell flecks
    for (let i = 0; i < 160; i += 1) {
      const x = (i * 97 + 19) % 512;
      const y = (i * 163 + 29) % 512;
      sandCtx.fillStyle =
        i % 5 === 0 ? 'rgba(255, 252, 244, 0.55)' : 'rgba(182, 144, 80, 0.28)';
      sandCtx.beginPath();
      sandCtx.arc(x, y, 1.4 + (i % 2) * 0.7, 0, Math.PI * 2);
      sandCtx.fill();
    }
  }
  const sandDiffuse = toTexture(sandC, 0.085, 0.085, true);
  const sandBump = toTexture(sandBC, 0.085, 0.085, false);
  all.push(sandDiffuse, sandBump);

  // 5. Natural Warm Earth Sandstone Cliff (256x256, earthy ochre-umber, NOT bright red!)
  const [dirtC, dirtCtx] = makeCanvas(256);
  const [dirtBC, dirtBCtx] = makeCanvas(256);
  if (dirtCtx && dirtBCtx) {
    dirtCtx.fillStyle = '#a57348';
    dirtCtx.fillRect(0, 0, 256, 256);
    dirtBCtx.fillStyle = '#808080';
    dirtBCtx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 16; i += 1) {
      const y = i * 16;
      dirtCtx.fillStyle =
        i % 2 === 0 ? 'rgba(122, 80, 46, 0.34)' : 'rgba(202, 152, 102, 0.26)';
      dirtCtx.fillRect(0, y, 256, 8);
      dirtBCtx.fillStyle =
        i % 2 === 0 ? 'rgba(85, 85, 85, 0.42)' : 'rgba(175, 175, 175, 0.38)';
      dirtBCtx.fillRect(0, y, 256, 8);
    }

    for (let i = 0; i < 28; i += 1) {
      const x = (i * 61) % 256;
      const y = (i * 89) % 256;
      drawSoftRadialPatch(
        dirtCtx,
        256,
        x,
        y,
        18,
        'rgba(92, 60, 36, 0.18)',
        'rgba(92, 60, 36, 0)'
      );
    }
  }
  const dirtCliffDiffuse = toTexture(dirtC, 0.2, 0.28, true);
  const dirtCliffBump = toTexture(dirtBC, 0.2, 0.28, false);
  all.push(dirtCliffDiffuse, dirtCliffBump);

  // 6. Carved Ancient Ruin Flagstone + Moss Crevices (512x512)
  const [stoneC, stoneCtx] = makeCanvas(512);
  const [stoneBC, stoneBCtx] = makeCanvas(512);
  if (stoneCtx && stoneBCtx) {
    stoneCtx.fillStyle = '#8e98a3';
    stoneCtx.fillRect(0, 0, 512, 512);
    stoneBCtx.fillStyle = '#b8b8b8';
    stoneBCtx.fillRect(0, 0, 512, 512);

    const tile = 128;
    for (let row = 0; row < 4; row += 1) {
      const offset = (row % 2) * 64;
      for (let col = -1; col < 5; col += 1) {
        const bx = col * tile + offset;
        const by = row * tile;
        stoneCtx.fillStyle = (row + col) % 2 === 0 ? '#9ca6b3' : '#858f9c';
        stoneCtx.fillRect(bx + 4, by + 4, tile - 8, tile - 8);
        stoneCtx.strokeStyle = '#586958';
        stoneCtx.lineWidth = 5;
        stoneCtx.strokeRect(bx + 2, by + 2, tile - 4, tile - 4);

        stoneBCtx.fillStyle = '#d8d8d8';
        stoneBCtx.fillRect(bx + 6, by + 6, tile - 12, tile - 12);
        stoneBCtx.strokeStyle = '#404040';
        stoneBCtx.lineWidth = 6;
        stoneBCtx.strokeRect(bx + 2, by + 2, tile - 4, tile - 4);
      }
    }

    for (let i = 0; i < 40; i += 1) {
      const x = (i * 119 + 23) % 512;
      const y = (i * 179 + 37) % 512;
      drawSoftRadialPatch(
        stoneCtx,
        512,
        x,
        y,
        18 + (i % 4) * 6,
        'rgba(86, 158, 84, 0.28)',
        'rgba(86, 158, 84, 0)'
      );
    }
  }
  const ruinStoneDiffuse = toTexture(stoneC, 0.09, 0.09, true);
  const ruinStoneBump = toTexture(stoneBC, 0.09, 0.09, false);
  all.push(ruinStoneDiffuse, ruinStoneBump);

  // 7. Dark Volcanic Basalt & Warm Ember Veins (512x512, organic mineral cracks)
  const [basC, basCtx] = makeCanvas(512);
  if (basCtx) {
    basCtx.fillStyle = '#3f3947';
    basCtx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 55; i += 1) {
      const x = (i * 137 + 17) % 512;
      const y = (i * 193 + 31) % 512;
      const r = 24 + (i % 5) * 14;
      drawSoftRadialPatch(
        basCtx,
        512,
        x,
        y,
        r,
        i % 2 === 0 ? 'rgba(78, 70, 88, 0.34)' : 'rgba(24, 20, 30, 0.42)',
        i % 2 === 0 ? 'rgba(78, 70, 88, 0)' : 'rgba(24, 20, 30, 0)'
      );
    }
    for (let i = 0; i < 14; i += 1) {
      const x = (i * 113 + 39) % 512;
      const y = (i * 167 + 23) % 512;
      drawSoftRadialPatch(
        basCtx,
        512,
        x,
        y,
        16 + (i % 3) * 6,
        'rgba(255, 110, 36, 0.18)',
        'rgba(255, 110, 36, 0)'
      );
    }
  }
  const basaltDiffuse = toTexture(basC, 0.09, 0.09, true);
  all.push(basaltDiffuse);

  // 8. Weathered Warm Wood Grain + Bump (256x256)
  const [woodC, woodCtx] = makeCanvas(256);
  const [woodBC, woodBCtx] = makeCanvas(256);
  if (woodCtx && woodBCtx) {
    woodCtx.fillStyle = '#b47743';
    woodCtx.fillRect(0, 0, 256, 256);
    woodBCtx.fillStyle = '#999999';
    woodBCtx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 24; i += 1) {
      const y = i * 10.6;
      woodCtx.fillStyle =
        i % 2 === 0 ? 'rgba(130, 74, 32, 0.25)' : 'rgba(216, 158, 102, 0.2)';
      woodCtx.fillRect(0, y, 256, 4);
      woodBCtx.fillStyle =
        i % 2 === 0 ? 'rgba(92, 92, 92, 0.34)' : 'rgba(170, 170, 170, 0.3)';
      woodBCtx.fillRect(0, y, 256, 4);
    }
  }
  const woodDiffuse = toTexture(woodC, 1, 1, true);
  const woodBump = toTexture(woodBC, 1, 1, false);
  all.push(woodDiffuse, woodBump);

  return {
    seaDiffuse,
    seaBump,
    grassDiffuse,
    grassBump,
    mossDiffuse,
    sandDiffuse,
    sandBump,
    dirtCliffDiffuse,
    dirtCliffBump,
    ruinStoneDiffuse,
    ruinStoneBump,
    basaltDiffuse,
    woodDiffuse,
    woodBump,
    disposeAll: () => {
      for (const tex of all) {
        tex.dispose();
      }
    },
  };
}
