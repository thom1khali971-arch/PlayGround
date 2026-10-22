export const MATERIALS = {
  carvalho: {
    label: 'Carvalho',
    price: 560,
    density: 750,
    board: [3000, 600],
    boardLabel: 'prancha',
    base: '#b08154',
    grainDark: '#7a5330',
    grainLight: '#d3a878',
    knots: 2,
  },
  freijo: {
    label: 'Freijó',
    price: 430,
    density: 650,
    board: [3000, 600],
    boardLabel: 'prancha',
    base: '#9b6b3f',
    grainDark: '#69452a',
    grainLight: '#c48f5c',
    knots: 3,
  },
  pinus: {
    label: 'Pinus',
    price: 190,
    density: 500,
    board: [3000, 600],
    boardLabel: 'prancha',
    base: '#d3b083',
    grainDark: '#a37c50',
    grainLight: '#efd3a5',
    knots: 4,
  },
  mdf: {
    label: 'MDF',
    price: 140,
    density: 720,
    board: [2750, 1850],
    boardLabel: 'chapa',
    base: '#a88d70',
    grainDark: '#8d7359',
    grainLight: '#c2a887',
    knots: 0,
  },
  compensado: {
    label: 'Compensado',
    price: 240,
    density: 600,
    board: [2750, 1850],
    boardLabel: 'chapa',
    base: '#b99161',
    grainDark: '#8f6c44',
    grainLight: '#d8b382',
    knots: 1,
  },
}

export const FINISHES = {
  natural: { label: 'Natural', price: 0, tint: '#ffffff', roughness: 0.62, sheen: false },
  oleo: { label: 'Óleo', price: 25, tint: '#f0d8b8', roughness: 0.5, sheen: false },
  verniz: { label: 'Verniz', price: 45, tint: '#fff3df', roughness: 0.24, sheen: true },
  areia: { label: 'Laca areia', price: 90, paint: '#ded3c3', roughness: 0.58, sheen: false },
  grafite: { label: 'Laca grafite', price: 90, paint: '#3e4348', roughness: 0.52, sheen: false },
}

export const METALS = {
  latao: { label: 'Latão', color: '#c9a25c', roughness: 0.28 },
  inox: { label: 'Inox', color: '#c8cdd2', roughness: 0.2 },
  preto: { label: 'Preto', color: '#26231f', roughness: 0.42 },
}

const HARDWARE_PRICES = {
  'Dobradiça 35 mm': 14,
  'Corrediça telescópica': 48,
  'Puxador': 22,
  'Pé regulável': 9,
  'Cantoneira de reforço': 6,
  'Kit fixação na parede': 18,
  'Cabideiro (tubo + suportes)': 42,
  'Batente / par de pinos': 2,
}

function piece(name, group, size, pos, extra = {}) {
  return {
    name,
    group,
    size,
    pos,
    rot: [0, 0, 0],
    cut: true,
    material: 'wood',
    ...extra,
  }
}

function hardware(name, qty) {
  return { name, qty }
}

function handleParts(positions, metal = true) {
  return positions.map((pos, index) =>
    piece('Puxador', 'Ferragens', [16, 140, 16], pos, {
      cut: false,
      material: 'metal',
      id: `handle-${index}`,
    }),
  )
}

const TYPES = {}

TYPES.estante = {
  key: 'estante',
  label: 'Estante',
  short: 'Estante',
  defaults: {
    largura: 1600,
    altura: 2100,
    profundidade: 340,
    prateleiras: 6,
    portas: 0,
    espessura: 18,
    rodape: true,
  },
  controls: [
    { id: 'largura', label: 'Largura', kind: 'range', min: 600, max: 1800, step: 10, unit: 'mm' },
    { id: 'altura', label: 'Altura', kind: 'range', min: 900, max: 2400, step: 10, unit: 'mm' },
    { id: 'profundidade', label: 'Profundidade', kind: 'range', min: 240, max: 450, step: 10, unit: 'mm' },
    { id: 'prateleiras', label: 'Prateleiras internas', kind: 'range', min: 1, max: 8, step: 1, unit: 'un' },
    {
      id: 'espessura',
      label: 'Espessura da chapa',
      kind: 'choice',
      options: [
        { value: 15, label: '15 mm' },
        { value: 18, label: '18 mm' },
        { value: 25, label: '25 mm' },
      ],
    },
    {
      id: 'portas',
      label: 'Portas',
      kind: 'choice',
      options: [
        { value: 0, label: 'Aberta' },
        { value: 1, label: '1 porta' },
        { value: 2, label: '2 portas' },
      ],
    },
    { id: 'rodape', label: 'Rodapé embutido', kind: 'toggle', hint: 'Recuo de 70 mm na base' },
  ],
  presets: [
    { name: 'Biblioteca', values: { largura: 1600, altura: 2100, profundidade: 340, prateleiras: 6, portas: 0, rodape: true, espessura: 18 } },
    { name: 'Compacta', values: { largura: 700, altura: 1200, profundidade: 280, prateleiras: 3, portas: 0, rodape: true, espessura: 18 } },
    { name: 'Fechada', values: { largura: 1000, altura: 1800, profundidade: 350, prateleiras: 2, portas: 2, rodape: true, espessura: 18 } },
  ],
  build(c) {
    const W = c.largura
    const H = c.altura
    const D = c.profundidade
    const T = c.espessura
    const baseH = c.rodape ? 70 : 0
    const parts = []
    const hw = []
    const xSide = (W - T) / 2

    parts.push(piece('Lateral', 'Estrutura', [T, H, D], [-xSide, H / 2, 0]))
    parts.push(piece('Lateral', 'Estrutura', [T, H, D], [xSide, H / 2, 0]))
    parts.push(piece('Tampo superior', 'Estrutura', [W - 2 * T, T, D], [0, H - T / 2, 0]))
    parts.push(piece('Base', 'Estrutura', [W - 2 * T, T, D], [0, baseH + T / 2, 0]))

    if (baseH > 0) {
      parts.push(piece('Rodapé', 'Estrutura', [W - 2 * T, baseH, T], [0, baseH / 2, D / 2 - 30]))
    }

    const innerH = H - baseH - 2 * T
    parts.push(
      piece('Fundo', 'Fundo', [W - 2 * T - 1, innerH, 6], [0, baseH + T + innerH / 2, -D / 2 + 3], {
        material: 'back',
      }),
    )

    const shelfSpan = H - baseH - 2 * T
    for (let i = 1; i <= c.prateleiras; i += 1) {
      const y = baseH + T + (shelfSpan * i) / (c.prateleiras + 1)
      parts.push(piece('Prateleira', 'Prateleiras', [W - 2 * T - 2, T, D - 24], [0, y, 0]))
    }

    if (c.portas > 0) {
      const doorH = H - baseH - 4
      const doorW = c.portas === 2 ? (W - 6) / 2 : W - 6
      const yDoor = baseH + doorH / 2
      for (let i = 0; i < c.portas; i += 1) {
        const x = c.portas === 2 ? (i === 0 ? -doorW / 2 - 1.5 : doorW / 2 + 1.5) : 0
        parts.push(piece('Porta', 'Portas', [doorW, doorH, T], [x, yDoor, D / 2 + T / 2 + 2]))
        hw.push(hardware('Dobradiça 35 mm', H > 1700 ? 3 : 2))
        hw.push(hardware('Puxador', 1))
      }
      const handleY = baseH + doorH * 0.56
      const handleX = c.portas === 2 ? [-34, 34] : [0]
      parts.push(
        ...handleParts(
          handleX.map((x) => [x, handleY, D / 2 + T + 16]),
        ),
      )
    }

    hw.push(hardware('Pé regulável', 4))
    hw.push(hardware('Kit fixação na parede', 1))
    if (c.prateleiras > 0) hw.push(hardware('Batente / par de pinos', c.prateleiras * 4))
    hw.push(hardware('Cantoneira de reforço', 4))

    return { parts, hardware: hw, footprint: [W, H, D] }
  },
}

TYPES.mesa = {
  key: 'mesa',
  label: 'Mesa',
  short: 'Mesa',
  defaults: {
    comprimento: 2000,
    largura: 950,
    altura: 750,
    tampo: 35,
    estilo: 'reta',
    saia: true,
  },
  controls: [
    { id: 'comprimento', label: 'Comprimento', kind: 'range', min: 1000, max: 2600, step: 20, unit: 'mm' },
    { id: 'largura', label: 'Largura', kind: 'range', min: 600, max: 1200, step: 20, unit: 'mm' },
    { id: 'altura', label: 'Altura', kind: 'range', min: 700, max: 800, step: 5, unit: 'mm' },
    { id: 'tampo', label: 'Espessura do tampo', kind: 'range', min: 25, max: 60, step: 5, unit: 'mm' },
    {
      id: 'estilo',
      label: 'Pernas',
      kind: 'choice',
      options: [
        { value: 'reta', label: 'Retas' },
        { value: 'inclinada', label: 'Inclinadas' },
        { value: 'painel', label: 'Painel' },
      ],
    },
    { id: 'saia', label: 'Saia de reforço', kind: 'toggle', hint: 'Travessas sob o tampo' },
  ],
  presets: [
    { name: 'Jantar', values: { comprimento: 2000, largura: 950, altura: 750, tampo: 35, estilo: 'reta', saia: true } },
    { name: 'Bistrô', values: { comprimento: 1100, largura: 700, altura: 760, tampo: 30, estilo: 'inclinada', saia: false } },
    { name: 'Escritório', values: { comprimento: 1500, largura: 750, altura: 750, tampo: 30, estilo: 'painel', saia: true } },
  ],
  build(c) {
    const L = c.comprimento
    const W = c.largura
    const H = c.altura
    const topT = c.tampo
    const legH = H - topT
    const parts = []
    const hw = []

    parts.push(piece('Tampo', 'Estrutura', [L, topT, W], [0, H - topT / 2, 0]))

    if (c.estilo === 'painel') {
      const panelW = W - 140
      parts.push(piece('Perna painel', 'Estrutura', [40, legH, panelW], [-(L / 2 - 70), legH / 2, 0]))
      parts.push(piece('Perna painel', 'Estrutura', [40, legH, panelW], [L / 2 - 70, legH / 2, 0]))
      parts.push(piece('Travessa central', 'Estrutura', [L - 180, 60, 18], [0, legH * 0.34, 0]))
    } else {
      const inset = 80
      const legSize = 70
      const tilt = c.estilo === 'inclinada' ? 0.055 : 0
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const x = sx * (L / 2 - inset)
          const z = sz * (W / 2 - inset)
          const len = legH / Math.cos(tilt)
          parts.push(
            piece('Perna', 'Estrutura', [legSize, len, legSize], [x, legH / 2, z], {
              rot: [sz * -tilt, 0, sx * tilt],
            }),
          )
        }
      }
      if (c.saia) {
        const apronY = H - topT - 42
        parts.push(piece('Saia longitudinal', 'Estrutura', [L - 2 * inset, 82, 18], [0, apronY, W / 2 - inset + 20]))
        parts.push(piece('Saia longitudinal', 'Estrutura', [L - 2 * inset, 82, 18], [0, apronY, -(W / 2 - inset + 20)]))
        parts.push(piece('Saia transversal', 'Estrutura', [18, 82, W - 2 * inset - 40], [L / 2 - inset + 20, apronY, 0]))
        parts.push(piece('Saia transversal', 'Estrutura', [18, 82, W - 2 * inset - 40], [-(L / 2 - inset + 20), apronY, 0]))
      }
    }

    hw.push(hardware('Cantoneira de reforço', 4))
    hw.push(hardware('Pé regulável', 4))
    return { parts, hardware: hw, footprint: [L, H, W] }
  },
}

TYPES.armario = {
  key: 'armario',
  label: 'Armário',
  short: 'Armário',
  defaults: {
    largura: 1600,
    altura: 2100,
    profundidade: 580,
    portas: 2,
    gavetas: 2,
    prateleiras: 2,
    espessura: 18,
    cabideiro: true,
  },
  controls: [
    { id: 'largura', label: 'Largura', kind: 'range', min: 800, max: 2000, step: 20, unit: 'mm' },
    { id: 'altura', label: 'Altura', kind: 'range', min: 1400, max: 2400, step: 20, unit: 'mm' },
    { id: 'profundidade', label: 'Profundidade', kind: 'range', min: 400, max: 650, step: 10, unit: 'mm' },
    { id: 'gavetas', label: 'Gavetas', kind: 'range', min: 0, max: 3, step: 1, unit: 'un' },
    { id: 'prateleiras', label: 'Prateleiras', kind: 'range', min: 0, max: 4, step: 1, unit: 'un' },
    {
      id: 'portas',
      label: 'Portas',
      kind: 'choice',
      options: [
        { value: 0, label: 'Aberta' },
        { value: 2, label: '2 portas' },
        { value: 3, label: '3 portas' },
        { value: 4, label: '4 portas' },
      ],
    },
    {
      id: 'espessura',
      label: 'Espessura da chapa',
      kind: 'choice',
      options: [
        { value: 15, label: '15 mm' },
        { value: 18, label: '18 mm' },
        { value: 25, label: '25 mm' },
      ],
    },
    { id: 'cabideiro', label: 'Cabideiro', kind: 'toggle', hint: 'Tubo metálico sob o tampo' },
  ],
  presets: [
    { name: 'Guarda-roupa', values: { largura: 1800, altura: 2200, profundidade: 600, portas: 4, gavetas: 2, prateleiras: 2, espessura: 18, cabideiro: true } },
    { name: 'Despensa', values: { largura: 900, altura: 2000, profundidade: 450, portas: 2, gavetas: 0, prateleiras: 4, espessura: 18, cabideiro: false } },
    { name: 'Cômoda', values: { largura: 1200, altura: 1100, profundidade: 500, portas: 0, gavetas: 3, prateleiras: 0, espessura: 18, cabideiro: false } },
  ],
  build(c) {
    const W = c.largura
    const H = c.altura
    const D = c.profundidade
    const T = c.espessura
    const baseH = 80
    const parts = []
    const hw = []
    const xSide = (W - T) / 2
    const drawerH = c.gavetas > 0 ? Math.min(180, Math.max(120, (H - baseH - 2 * T - 80) / Math.max(c.gavetas, 1))) : 0
    const drawerTop = baseH + T + c.gavetas * drawerH
    const doorBottom = drawerTop
    const doorTop = H - T
    const doorH = Math.max(180, doorTop - doorBottom)

    parts.push(piece('Lateral', 'Estrutura', [T, H, D], [-xSide, H / 2, 0]))
    parts.push(piece('Lateral', 'Estrutura', [T, H, D], [xSide, H / 2, 0]))
    parts.push(piece('Tampo superior', 'Estrutura', [W - 2 * T, T, D], [0, H - T / 2, 0]))
    parts.push(piece('Base', 'Estrutura', [W - 2 * T, T, D], [0, baseH + T / 2, 0]))
    parts.push(piece('Rodapé', 'Estrutura', [W - 2 * T, baseH, T], [0, baseH / 2, D / 2 - 30]))

    parts.push(
      piece('Fundo', 'Fundo', [W - 2 * T - 1, H - baseH - 2 * T, 6], [0, baseH + T + (H - baseH - 2 * T) / 2, -D / 2 + 3], {
        material: 'back',
      }),
    )

    if (c.prateleiras > 0) {
      const shelfZone = Math.max(160, doorH - 60)
      for (let i = 1; i <= c.prateleiras; i += 1) {
        const y = doorBottom + 30 + (shelfZone * i) / (c.prateleiras + 1)
        parts.push(piece('Prateleira', 'Prateleiras', [W - 2 * T - 2, T, D - 30], [0, y, 0]))
      }
    }

    if (c.cabideiro) {
      parts.push(
        piece('Cabideiro', 'Ferragens', [W - 2 * T - 30, 24, 24], [0, doorTop - 110, 0], {
          cut: false,
          material: 'metal',
        }),
      )
      hw.push(hardware('Cabideiro (tubo + suportes)', 1))
    }

    if (c.gavetas > 0) {
      for (let i = 0; i < c.gavetas; i += 1) {
        const y = baseH + T + drawerH * i + drawerH / 2
        parts.push(piece('Frente de gaveta', 'Gavetas', [W - 8, drawerH - 8, T], [0, y, D / 2 + T / 2 + 2]))
        parts.push(
          piece('Puxador', 'Ferragens', [140, 14, 14], [0, y, D / 2 + T + 16], {
            cut: false,
            material: 'metal',
          }),
        )
        hw.push(hardware('Corrediça telescópica', 2))
        hw.push(hardware('Puxador', 1))
      }
    }

    if (c.portas > 0) {
      const doorW = (W - 6) / c.portas
      const yDoor = doorBottom + doorH / 2
      for (let i = 0; i < c.portas; i += 1) {
        const x = -W / 2 + 3 + doorW / 2 + i * doorW
        parts.push(piece('Porta', 'Portas', [doorW - 3, doorH - 4, T], [x, yDoor, D / 2 + T / 2 + 2]))
        const nearCenter = i < c.portas / 2 ? 1 : -1
        parts.push(
          piece('Puxador', 'Ferragens', [16, 150, 16], [x + nearCenter * (doorW / 2 - 55), yDoor + doorH * 0.08, D / 2 + T + 16], {
            cut: false,
            material: 'metal',
          }),
        )
        hw.push(hardware('Dobradiça 35 mm', H > 1800 ? 3 : 2))
        hw.push(hardware('Puxador', 1))
      }
    }

    hw.push(hardware('Pé regulável', 4))
    hw.push(hardware('Kit fixação na parede', 1))
    hw.push(hardware('Cantoneira de reforço', 4))

    return { parts, hardware: hw, footprint: [W, H, D] }
  },
}

TYPES.criado = {
  key: 'criado',
  label: 'Criado-mudo',
  short: 'Criado-mudo',
  defaults: {
    largura: 500,
    altura: 600,
    profundidade: 400,
    gavetas: 2,
    prateleira: false,
    espessura: 18,
  },
  controls: [
    { id: 'largura', label: 'Largura', kind: 'range', min: 400, max: 700, step: 10, unit: 'mm' },
    { id: 'altura', label: 'Altura', kind: 'range', min: 480, max: 750, step: 10, unit: 'mm' },
    { id: 'profundidade', label: 'Profundidade', kind: 'range', min: 350, max: 500, step: 10, unit: 'mm' },
    { id: 'gavetas', label: 'Gavetas', kind: 'range', min: 1, max: 3, step: 1, unit: 'un' },
    {
      id: 'espessura',
      label: 'Espessura da chapa',
      kind: 'choice',
      options: [
        { value: 15, label: '15 mm' },
        { value: 18, label: '18 mm' },
        { value: 25, label: '25 mm' },
      ],
    },
    { id: 'prateleira', label: 'Prateleira no nicho', kind: 'toggle', hint: 'Divisão do espaço aberto' },
  ],
  presets: [
    { name: 'Clássico', values: { largura: 500, altura: 600, profundidade: 400, gavetas: 2, prateleira: false, espessura: 18 } },
    { name: 'Ampla', values: { largura: 600, altura: 650, profundidade: 450, gavetas: 3, prateleira: false, espessura: 18 } },
    { name: 'Nicho', values: { largura: 450, altura: 520, profundidade: 350, gavetas: 1, prateleira: true, espessura: 18 } },
  ],
  build(c) {
    const W = c.largura
    const H = c.altura
    const D = c.profundidade
    const T = c.espessura
    const baseH = 40
    const parts = []
    const hw = []
    const xSide = (W - T) / 2
    const innerH = H - baseH - 2 * T
    const drawerH = Math.min(170, Math.max(90, (innerH - (c.prateleira ? 180 : 40)) / c.gavetas))
    const drawerTop = baseH + T + c.gavetas * drawerH

    parts.push(piece('Lateral', 'Estrutura', [T, H - baseH, D], [-xSide, baseH + (H - baseH) / 2, 0]))
    parts.push(piece('Lateral', 'Estrutura', [T, H - baseH, D], [xSide, baseH + (H - baseH) / 2, 0]))
    parts.push(piece('Tampo', 'Estrutura', [W, T, D], [0, H - T / 2, 0]))
    parts.push(piece('Base', 'Estrutura', [W - 2 * T, T, D], [0, baseH + T / 2, 0]))
    parts.push(piece('Rodapé', 'Estrutura', [W - 2 * T, baseH, T], [0, baseH / 2, D / 2 - 24]))
    parts.push(
      piece('Fundo', 'Fundo', [W - 2 * T - 1, innerH, 6], [0, baseH + T + innerH / 2, -D / 2 + 3], {
        material: 'back',
      }),
    )

    for (let i = 0; i < c.gavetas; i += 1) {
      const y = baseH + T + drawerH * i + drawerH / 2
      parts.push(piece('Frente de gaveta', 'Gavetas', [W - 8, drawerH - 8, T], [0, y, D / 2 + T / 2 + 2]))
      parts.push(
        piece('Puxador', 'Ferragens', [120, 14, 14], [0, y, D / 2 + T + 16], {
          cut: false,
          material: 'metal',
        }),
      )
      hw.push(hardware('Corrediça telescópica', 2))
      hw.push(hardware('Puxador', 1))
    }

    const nicheBottom = drawerTop
    const nicheH = H - T - nicheBottom
    if (nicheH > 180) {
      if (c.prateleira) {
        parts.push(piece('Prateleira', 'Prateleiras', [W - 2 * T - 2, T, D - 24], [0, nicheBottom + nicheH / 2, 0]))
      }
      parts.push(piece('Divisória', 'Estrutura', [W - 2 * T - 2, T, D - 24], [0, nicheBottom + T / 2, 0]))
    }

    hw.push(hardware('Pé regulável', 4))
    hw.push(hardware('Cantoneira de reforço', 4))
    return { parts, hardware: hw, footprint: [W, H, D] }
  },
}

TYPES.banco = {
  key: 'banco',
  label: 'Banco',
  short: 'Banco',
  defaults: {
    comprimento: 1200,
    largura: 350,
    altura: 450,
    estilo: 'reta',
    prateleira: true,
    espessura: 40,
  },
  controls: [
    { id: 'comprimento', label: 'Comprimento', kind: 'range', min: 800, max: 1800, step: 20, unit: 'mm' },
    { id: 'largura', label: 'Largura', kind: 'range', min: 300, max: 500, step: 10, unit: 'mm' },
    { id: 'altura', label: 'Altura do assento', kind: 'range', min: 400, max: 520, step: 5, unit: 'mm' },
    {
      id: 'estilo',
      label: 'Pernas',
      kind: 'choice',
      options: [
        { value: 'reta', label: 'Retas' },
        { value: 'painel', label: 'Painel' },
      ],
    },
    {
      id: 'espessura',
      label: 'Espessura do assento',
      kind: 'choice',
      options: [
        { value: 30, label: '30 mm' },
        { value: 40, label: '40 mm' },
        { value: 50, label: '50 mm' },
      ],
    },
    { id: 'prateleira', label: 'Prateleira inferior', kind: 'toggle', hint: 'Para calçados ou apoio' },
  ],
  presets: [
    { name: 'Entrada', values: { comprimento: 1200, largura: 350, altura: 450, estilo: 'reta', prateleira: true, espessura: 40 } },
    { name: 'Jantar', values: { comprimento: 1600, largura: 380, altura: 460, estilo: 'painel', prateleira: false, espessura: 40 } },
    { name: 'Oficina', values: { comprimento: 1000, largura: 300, altura: 440, estilo: 'reta', prateleira: true, espessura: 50 } },
  ],
  build(c) {
    const L = c.comprimento
    const W = c.largura
    const H = c.altura
    const T = c.espessura
    const legH = H - T
    const parts = []
    const hw = []

    parts.push(piece('Assento', 'Estrutura', [L, T, W], [0, H - T / 2, 0]))

    if (c.estilo === 'painel') {
      const panelW = W - 70
      parts.push(piece('Perna painel', 'Estrutura', [36, legH, panelW], [-(L / 2 - 60), legH / 2, 0]))
      parts.push(piece('Perna painel', 'Estrutura', [36, legH, panelW], [L / 2 - 60, legH / 2, 0]))
      if (c.prateleira) parts.push(piece('Prateleira inferior', 'Prateleiras', [L - 160, 18, panelW - 20], [0, 140, 0]))
    } else {
      const inset = 70
      const leg = 58
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          parts.push(
            piece('Perna', 'Estrutura', [leg, legH, leg], [sx * (L / 2 - inset), legH / 2, sz * (W / 2 - inset)]),
          )
        }
      }
      const apronY = H - T - 36
      parts.push(piece('Travessa', 'Estrutura', [L - 2 * inset + 38, 62, 18], [0, apronY, W / 2 - inset + 18]))
      parts.push(piece('Travessa', 'Estrutura', [L - 2 * inset + 38, 62, 18], [0, apronY, -(W / 2 - inset + 18)]))
      if (c.prateleira) {
        parts.push(piece('Prateleira inferior', 'Estrutura', [L - 2 * inset, 18, W - 2 * inset + 20], [0, 140, 0]))
      }
    }

    hw.push(hardware('Pé regulável', 4))
    hw.push(hardware('Cantoneira de reforço', 4))
    return { parts, hardware: hw, footprint: [L, H, W] }
  },
}

export const TYPE_LIST = Object.values(TYPES)
export { TYPES }

export function buildModel(typeKey, config) {
  const type = TYPES[typeKey]
  const result = type.build(config)
  const merged = new Map()
  for (const item of result.hardware) {
    merged.set(item.name, (merged.get(item.name) || 0) + item.qty)
  }
  return {
    ...result,
    hardware: [...merged.entries()].map(([name, qty]) => ({ name, qty })),
    typeKey,
    label: type.label,
    config: { ...config },
  }
}

const GROUP_ORDER = ['Estrutura', 'Prateleiras', 'Portas', 'Gavetas', 'Fundo', 'Ferragens']

export function buildCutList(parts) {
  const groups = new Map()
  for (const part of parts) {
    if (!part.cut) continue
    const dims = [...part.size].sort((a, b) => b - a).map((n) => Math.round(n))
    const key = `${part.name}|${dims.join('x')}`
    if (!groups.has(part.group)) groups.set(part.group, new Map())
    const bucket = groups.get(part.group)
    const existing = bucket.get(key)
    if (existing) existing.qty += 1
    else bucket.set(key, { name: part.name, dims, qty: 1, group: part.group })
  }
  return [...groups.entries()]
    .sort((a, b) => GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0]))
    .map(([group, rows]) => ({
      group,
      rows: [...rows.values()].sort((a, b) => b.dims[0] * b.dims[1] - a.dims[0] * a.dims[1]),
    }))
}

export function computeEstimate(model, materialKey, finishKey) {
  const material = MATERIALS[materialKey]
  const finish = FINISHES[finishKey]
  let area = 0
  let volume = 0
  let pieces = 0
  for (const part of model.parts) {
    if (!part.cut) continue
    pieces += 1
    const [x, y, z] = part.size
    const dims = [x, y, z].sort((a, b) => b - a)
    area += (dims[0] * dims[1]) / 1e6
    volume += (x * y * z) / 1e9
  }

  let hardwareCost = 0
  const hardwareRows = []
  for (const item of model.hardware) {
    const unit = HARDWARE_PRICES[item.name] || 10
    const total = unit * item.qty
    hardwareCost += total
    hardwareRows.push({ ...item, unit, total })
  }

  const wood = area * 1.16 * material.price
  const finishCost = area * finish.price
  const labor = (wood + hardwareCost + finishCost) * 0.52
  const total = wood + finishCost + hardwareCost + labor
  const weight = volume * material.density

  const rows = buildCutList(model.parts)
  const flat = rows.flatMap((group) => group.rows)
  const pack = packBoards(flat, material.board[0], material.board[1])

  return {
    area,
    pieces,
    wood,
    finishCost,
    hardwareCost,
    hardwareRows,
    labor,
    total,
    weight,
    rows,
    pack,
    material,
    finish,
  }
}

export function packBoards(rows, boardW, boardH, kerf = 4) {
  const items = []
  for (const row of rows) {
    const comp = row.dims[0]
    const larg = row.dims[1]
    for (let i = 0; i < row.qty; i += 1) {
      items.push({ name: row.name, w: comp, h: larg, group: row.group })
    }
  }
  items.sort((a, b) => b.h - a.h || b.w - a.w)
  const boards = []
  const oversized = []

  for (const item of items) {
    let placed = false
    for (const board of boards) {
      for (const shelf of board.shelves) {
        if (item.h <= shelf.h && shelf.x + item.w <= boardW) {
          shelf.items.push({ ...item, x: shelf.x, y: shelf.y })
          shelf.x += item.w + kerf
          board.placedArea += item.w * item.h
          placed = true
          break
        }
      }
      if (placed) break
      const usedH = board.shelves.reduce((max, shelf) => Math.max(max, shelf.y + shelf.h), 0)
      if (item.h <= boardH - usedH && item.w <= boardW) {
        const shelf = { y: usedH, h: item.h, x: item.w + kerf, items: [{ ...item, x: 0, y: usedH }] }
        board.shelves.push(shelf)
        board.placedArea += item.w * item.h
        placed = true
        break
      }
    }
    if (!placed) {
      if (item.w > boardW || item.h > boardH) {
        oversized.push(item)
        continue
      }
      boards.push({
        shelves: [{ y: 0, h: item.h, x: item.w + kerf, items: [{ ...item, x: 0, y: 0 }] }],
        placedArea: item.w * item.h,
      })
    }
  }

  const boardArea = boardW * boardH
  const used = boards.reduce((sum, board) => sum + board.placedArea, 0)
  return {
    boards,
    oversized,
    count: boards.length,
    boardW,
    boardH,
    utilization: boards.length ? used / (boards.length * boardArea) : 0,
  }
}
