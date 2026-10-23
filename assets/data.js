(() => {
  const roles = {
    tanque: {
      id: 'tanque',
      name: 'Tanque',
      glyph: '盾',
      color: '#5fa892',
      description: 'Inicia confrontos, absorve pressão e protege a linha de frente.',
      prefs: { defesa: 1, suporte: 0.8, movimento: 0.55, ataque: 0.45, magia: 0.25 }
    },
    lutador: {
      id: 'lutador',
      name: 'Lutador',
      glyph: '闘',
      color: '#d9824f',
      description: 'Briga de perto, alterna entre dano e resistência.',
      prefs: { ataque: 0.9, defesa: 0.85, movimento: 0.6, suporte: 0.4, magia: 0.2 }
    },
    assassino: {
      id: 'assassino',
      name: 'Assassino',
      glyph: '刺',
      color: '#dd4f6d',
      description: 'Explora flancos, elimina alvos frágeis e controla o ritmo da selva.',
      prefs: { ataque: 1, movimento: 0.8, defesa: 0.5, suporte: 0.35, magia: 0.3 }
    },
    mago: {
      id: 'mago',
      name: 'Mago',
      glyph: '術',
      color: '#9574dc',
      description: 'Domina a distância média com controle e dano em área.',
      prefs: { magia: 1, movimento: 0.7, suporte: 0.5, defesa: 0.45, ataque: 0.3 }
    },
    atirador: {
      id: 'atirador',
      name: 'Atirador',
      glyph: '弓',
      color: '#d9ad55',
      description: 'Cresce com o tempo e converte posicionamento em dano contínuo.',
      prefs: { ataque: 1, movimento: 0.7, defesa: 0.45, suporte: 0.4, magia: 0.25 }
    },
    suporte: {
      id: 'suporte',
      name: 'Suporte',
      glyph: '癒',
      color: '#5f9fd6',
      description: 'Sustenta aliados, cria visão e decide lutas com utilidade.',
      prefs: { suporte: 1, defesa: 0.8, movimento: 0.6, magia: 0.5, ataque: 0.2 }
    }
  };

  const itemCategories = {
    ataque: { id: 'ataque', name: 'Ataque', glyph: '刃', color: '#dd5f5b' },
    magia: { id: 'magia', name: 'Magia', glyph: '術', color: '#9574dc' },
    defesa: { id: 'defesa', name: 'Defesa', glyph: '鎧', color: '#5fa892' },
    suporte: { id: 'suporte', name: 'Suporte', glyph: '鈴', color: '#5f9fd6' },
    movimento: { id: 'movimento', name: 'Movimento', glyph: '靴', color: '#d9ad55' }
  };

  const items = [
    { id: 'omoikane-bow', name: 'Arco de Omoikane', category: 'ataque', glyph: '弓', stats: { atk: 34, spd: 8, crit: 12 }, passive: 'Ataques básicos ganham dano extra conforme a velocidade de ataque.', tags: ['crítico', 'velocidade de ataque'] },
    { id: 'yasha-edge', name: 'Lâmina de Yasha', category: 'ataque', glyph: '刃', stats: { atk: 42, crit: 10 }, passive: 'Penetração de armadura crescente contra alvos já feridos.', tags: ['penetração', 'burst'] },
    { id: 'demon-blade-muramasa', name: 'Lâmina Demoníaca Muramasa', category: 'ataque', glyph: '村', stats: { atk: 45, util: 4 }, passive: 'Cura uma fração do dano físico causado.', tags: ['sustento', 'duelo'] },
    { id: 'kusanagi', name: 'Kusanagi', category: 'ataque', glyph: '草', stats: { atk: 38, hp: 10 }, passive: 'Parte do dano ignora escudos e reduções temporárias.', tags: ['anti-escudo', 'duelo'] },
    { id: 'shichiseiken', name: 'Shichiseiken', category: 'ataque', glyph: '七', stats: { atk: 40, crit: 15 }, passive: 'Acertos críticos acumulam dano adicional no próximo golpe.', tags: ['crítico', 'escala'] },
    { id: 'ame-no-habakiri', name: 'Ame-no-Habakiri', category: 'ataque', glyph: '天', stats: { atk: 48, spd: 6 }, passive: 'Executa alvos abaixo de um limiar de vida.', tags: ['execução', 'finalização'] },
    { id: 'soultaker', name: 'Alma Ceifadora', category: 'ataque', glyph: '魂', stats: { atk: 30, util: 10 }, passive: 'Abates e assistências concedem camadas permanentes de ataque.', tags: ['escala', 'selva'] },

    { id: 'mandala', name: 'Mandala', category: 'magia', glyph: '曼', stats: { mag: 42, util: 5 }, passive: 'Habilidades em área causam eco de dano reduzido.', tags: ['área', 'controle'] },
    { id: 'sessho-seki', name: 'Pedra Matadora', category: 'magia', glyph: '殺', stats: { mag: 46 }, passive: 'Aumenta a penetração mágica contra alvos com pouca resistência.', tags: ['penetração', 'burst'] },
    { id: 'eight-trigrams', name: 'Selo dos Oito Trigramas', category: 'magia', glyph: '卦', stats: { mag: 28, hp: 20, def: 10 }, passive: 'Concede resistência enquanto suas habilidades estão em recarga.', tags: ['híbrido', 'sobrevivência'] },
    { id: 'yata-mirror', name: 'Espelho Yata', category: 'magia', glyph: '鏡', stats: { mag: 30, def: 18 }, passive: 'Reflete uma fração do dano mágico recebido.', tags: ['reflexão', 'defesa'] },
    { id: 'banquet-nine', name: 'Banquete dos Nove', category: 'magia', glyph: '宴', stats: { mag: 44, util: 6 }, passive: 'Habilidades aplicam queimadura prolongada em vários alvos.', tags: ['dano contínuo', 'área'] },
    { id: 'tome-origin', name: 'Tomo da Origem', category: 'magia', glyph: '典', stats: { mag: 50, util: 4 }, passive: 'Aumenta o poder mágico após cada eliminação ou assistência.', tags: ['escala', 'burst'] },
    { id: 'celestial-sphere', name: 'Esfera Celestial', category: 'magia', glyph: '天', stats: { mag: 36, spd: 8 }, passive: 'Reduz recargas após acertar habilidades à longa distância.', tags: ['recarga', 'poke'] },
    { id: 'amanozako-bow', name: 'Arco de Amanozako', category: 'magia', glyph: '炎', stats: { mag: 34, util: 10 }, passive: 'Habilidades deixam uma marca que amplifica dano mágico seguinte.', tags: ['amplificação', 'combo'] },

    { id: 'soul-armor', name: 'Armadura de Almas', category: 'defesa', glyph: '鎧', stats: { def: 40, hp: 30 }, passive: 'Gera um escudo ao cair abaixo de metade da vida.', tags: ['escudo', 'linha de frente'] },
    { id: 'hachiman-armor', name: 'Armadura de Hachiman', category: 'defesa', glyph: '八', stats: { def: 35, hp: 35 }, passive: 'Aumenta a defesa ao ser atingido por ataques básicos.', tags: ['anti-atirador', 'resistência'] },
    { id: 'frostfire-robe', name: 'Manto de Gelo e Fogo', category: 'defesa', glyph: '霜', stats: { def: 30, hp: 25, util: 6 }, passive: 'Inimigos próximos sofrem lentidão e dano contínuo.', tags: ['controle', 'aura'] },
    { id: 'golden-pavilion', name: 'Pavilhão Dourado', category: 'defesa', glyph: '閣', stats: { hp: 55, def: 20 }, passive: 'Recupera vida fora de combate e reduz dano de torres.', tags: ['sustento', 'resistência'] },
    { id: 'spirit-guard', name: 'Guardião Espiritual', category: 'defesa', glyph: '霊', stats: { def: 32, util: 10 }, passive: 'Aplica barreira a um aliado próximo periodicamente.', tags: ['proteção', 'aliado'] },
    { id: 'ogre-mail', name: 'Malha do Oni', category: 'defesa', glyph: '鬼', stats: { hp: 48, def: 24 }, passive: 'Converte parte da vida máxima em resistência adicional.', tags: ['vida', 'resistência'] },

    { id: 'earthen-bells', name: 'Sinos de Argila', category: 'suporte', glyph: '鈴', stats: { util: 18, hp: 20 }, passive: 'Curas e escudos em aliados concedem velocidade de movimento.', tags: ['cura', 'mobilidade'] },
    { id: 'miracle-umbrella', name: 'Guarda-chuva Milagroso', category: 'suporte', glyph: '傘', stats: { util: 16, def: 12 }, passive: 'Reduz o dano recebido por aliados protegidos por suas habilidades.', tags: ['proteção', 'resistência'] },
    { id: 'juzu-beads', name: 'Contas de Juzu', category: 'suporte', glyph: '珠', stats: { util: 20, mag: 14 }, passive: 'Cada habilidade usada diminui a recarga da ultimate.', tags: ['recarga', 'sustento'] },
    { id: 'celestial-bell', name: 'Sino Celestial', category: 'suporte', glyph: '鐘', stats: { util: 22, spd: 8 }, passive: 'Elimina efeitos de controle de grupo ao curar um aliado.', tags: ['limpeza', 'cura'] },
    { id: 'soul-lantern', name: 'Lanterna de Almas', category: 'suporte', glyph: '灯', stats: { util: 18, hp: 18 }, passive: 'Revela inimigos próximos e amplia a visão da equipe.', tags: ['visão', 'utilidade'] },
    { id: 'fortune-charm', name: 'Talismã da Fortuna', category: 'suporte', glyph: '福', stats: { util: 15, atk: 10, mag: 10 }, passive: 'Aumenta a renda de ouro e a experiência compartilhada.', tags: ['economia', 'híbrido'] },

    { id: 'swiftfoot', name: 'Sandálias Ligeiras', category: 'movimento', glyph: '靴', stats: { spd: 24 }, passive: 'Aumenta a velocidade de movimento e reduz o tempo de retorno à base.', tags: ['rotação', 'mobilidade'] },
    { id: 'windwalker', name: 'Passos do Vento', category: 'movimento', glyph: '風', stats: { spd: 28, util: 6 }, passive: 'Ganha velocidade extra ao sair de combate.', tags: ['rotação', 'recuperação'] },
    { id: 'ninja-tabi', name: 'Tabi Ninja', category: 'movimento', glyph: '忍', stats: { spd: 22, atk: 8 }, passive: 'O próximo ataque básico após se mover causa dano extra.', tags: ['selva', 'emboscada'] },
    { id: 'moon-geta', name: 'Getas da Lua', category: 'movimento', glyph: '月', stats: { spd: 20, util: 8 }, passive: 'Reduz a duração de lentidão e enraizamento.', tags: ['resistência', 'mobilidade'] },
    { id: 'cloud-boots', name: 'Botas das Nuvens', category: 'movimento', glyph: '雲', stats: { spd: 26, hp: 12 }, passive: 'Acelera aliados próximos ao usar uma habilidade de deslocamento.', tags: ['equipe', 'mobilidade'] },
    { id: 'fox-sandals', name: 'Sandálias da Raposa', category: 'movimento', glyph: '狐', stats: { spd: 18, mag: 12 }, passive: 'Aumenta o alcance de habilidades após se mover por um instante.', tags: ['alcance', 'poke'] }
  ];

  const shikigami = [
    { id: 'kuro-mujou', name: 'Kuro Mujou', kanji: '黑无垢', title: 'O Ceifador', role: 'assassino', difficulty: 3, tier: 'S', summary: 'Burst físico e execução. Brilha entrando depois do primeiro controle da equipe.', tags: ['selva', 'burst'], coreItems: ['yasha-edge', 'omoikane-bow', 'demon-blade-muramasa'] },
    { id: 'yoto-hime', name: 'Yoto Hime', kanji: '妖刀姬', title: 'A Lâmina Dançante', role: 'assassino', difficulty: 4, tier: 'S', summary: 'Duelista de alta mobilidade, recompensada por acertar combos e isolar alvos.', tags: ['duelo', 'mobilidade'], coreItems: ['ame-no-habakiri', 'shichiseiken', 'demon-blade-muramasa'] },
    { id: 'hannya', name: 'Hannya', kanji: '般若', title: 'A Máscara Vingativa', role: 'assassino', difficulty: 4, tier: 'A', summary: 'Pressão constante com dano contínuo e reposicionamento agressivo.', tags: ['dano contínuo', 'flancos'], coreItems: ['yasha-edge', 'soultaker', 'frostfire-robe'] },
    { id: 'yamakaze', name: 'Yamakaze', kanji: '山風', title: 'O Vento Cortante', role: 'assassino', difficulty: 3, tier: 'A', summary: 'Caçador veloz que pune rotas abertas e alvos sem visão.', tags: ['selva', 'rotação'], coreItems: ['ninja-tabi', 'ame-no-habakiri', 'shichiseiken'] },
    { id: 'kyonshi-ani', name: 'Kyonshi Ani', kanji: '殭屍', title: 'O Morto-Vivo', role: 'assassino', difficulty: 2, tier: 'B', summary: 'Iniciador simples e resistente, bom para aprender o ritmo da selva.', tags: ['iniciação', 'resistência'], coreItems: ['yasha-edge', 'soul-armor', 'swiftfoot'] },
    { id: 'shiro-mujou', name: 'Shiro Mujou', kanji: '白无垢', title: 'O Luto Eterno', role: 'assassino', difficulty: 4, tier: 'A', summary: 'Assassino híbrido com controle de área e picos de dano mágico.', tags: ['híbrido', 'controle'], coreItems: ['sessho-seki', 'eight-trigrams', 'windwalker'] },
    { id: 'kisei', name: 'Kisei', kanji: '祈世', title: 'O Pintor de Almas', role: 'assassino', difficulty: 3, tier: 'B', summary: 'Marca alvos e explode o dano acumulado com entradas cirúrgicas.', tags: ['marcas', 'execução'], coreItems: ['shichiseiken', 'yasha-edge', 'ninja-tabi'] },
    { id: 'sesshomaru', name: 'Sesshomaru', kanji: '殺生丸', title: 'O Lorde do Oeste', role: 'assassino', difficulty: 4, tier: 'A', summary: 'Duelista de alcance médio com ferramentas para perseguir e finalizar.', tags: ['duelo', 'perseguição'], coreItems: ['ame-no-habakiri', 'demon-blade-muramasa', 'hachiman-armor'] },

    { id: 'ibaraki-doji', name: 'Ibaraki Doji', kanji: '茨木童子', title: 'O Braço Demoníaco', role: 'lutador', difficulty: 3, tier: 'S', summary: 'Brigão de escalação sólida, converte vida em dano e domina duelos longos.', tags: ['duelo', 'escala'], coreItems: ['demon-blade-muramasa', 'soul-armor', 'hachiman-armor'] },
    { id: 'shuten-doji', name: 'Shuten Doji', kanji: '酒吞童子', title: 'O Oni Bêbado', role: 'lutador', difficulty: 4, tier: 'S', summary: 'Tanque-lutador com sustain alto e presença forte em lutas de time.', tags: ['sustento', 'linha de frente'], coreItems: ['demon-blade-muramasa', 'ogre-mail', 'frostfire-robe'] },
    { id: 'aobozu', name: 'Aobozu', kanji: '青坊主', title: 'O Monge Errante', role: 'lutador', difficulty: 3, tier: 'A', summary: 'Controla a rota com trocas curtas e boa recuperação entre confrontos.', tags: ['rota', 'troca'], coreItems: ['yasha-edge', 'soul-armor', 'windwalker'] },
    { id: 'susanoo', name: 'Susanoo', kanji: '須佐之男', title: 'A Tempestade', role: 'lutador', difficulty: 4, tier: 'S', summary: 'Alto teto de dano e mobilidade; exige timing para não ser punido.', tags: ['burst', 'mobilidade'], coreItems: ['ame-no-habakiri', 'yasha-edge', 'shichiseiken'] },
    { id: 'asura', name: 'Asura', kanji: '阿修羅', title: 'A Fúria Divina', role: 'lutador', difficulty: 5, tier: 'S', summary: 'Duelista de execução difícil, recompensa leitura de luta e gestão de recursos.', tags: ['execução', 'duelo'], coreItems: ['demon-blade-muramasa', 'kusanagi', 'hachiman-armor'] },
    { id: 'yuki-doji', name: 'Yuki Doji', kanji: '雪童子', title: 'O Inverno Eterno', role: 'lutador', difficulty: 3, tier: 'B', summary: 'Controle por lentidão e resistência para segurar a linha de frente.', tags: ['controle', 'resistência'], coreItems: ['frostfire-robe', 'soul-armor', 'moon-geta'] },

    { id: 'ootengu', name: 'Ootengu', kanji: '大天狗', title: 'O Senhor dos Céus', role: 'mago', difficulty: 2, tier: 'S', summary: 'Dano em área confiável e ótimo controle de zona em lutas agrupadas.', tags: ['área', 'controle'], coreItems: ['mandala', 'banquet-nine', 'celestial-sphere'] },
    { id: 'enenra', name: 'Enenra', kanji: '煙煙羅', title: 'A Fumaça', role: 'mago', difficulty: 3, tier: 'A', summary: 'Poke e controle de movimento com boa segurança à distância.', tags: ['poke', 'controle'], coreItems: ['sessho-seki', 'amanozako-bow', 'cloud-boots'] },
    { id: 'aoandon', name: 'Aoandon', kanji: '青行燈', title: 'A Lâmpada Azul', role: 'mago', difficulty: 3, tier: 'A', summary: 'Escala com o tempo e pune posicionamentos ruins com dano sustentado.', tags: ['escala', 'dano contínuo'], coreItems: ['tome-origin', 'banquet-nine', 'yata-mirror'] },
    { id: 'kiyohime', name: 'Kiyohime', kanji: '清姫', title: 'A Serpente Apaixonada', role: 'mago', difficulty: 3, tier: 'B', summary: 'Controle de área e veneno para negar aproximação e objetivos.', tags: ['veneno', 'zona'], coreItems: ['banquet-nine', 'frostfire-robe', 'mandala'] },
    { id: 'menreiki', name: 'Menreiki', kanji: '面霊気', title: 'O Rosto Sem Face', role: 'mago', difficulty: 4, tier: 'A', summary: 'Mago de combo com ferramentas de reposicionamento e burst mágico.', tags: ['combo', 'mobilidade'], coreItems: ['sessho-seki', 'amanozako-bow', 'windwalker'] },
    { id: 'maestro', name: 'Maestro', kanji: '楽師', title: 'O Mestre da Música', role: 'mago', difficulty: 4, tier: 'A', summary: 'Utilidade sonora: acelera aliados e desorganiza a formação inimiga.', tags: ['utilidade', 'equipe'], coreItems: ['juzu-beads', 'celestial-sphere', 'cloud-boots'] },
    { id: 'kinnara', name: 'Kinnara', kanji: '緊那羅', title: 'A Melodia Celestial', role: 'mago', difficulty: 5, tier: 'S', summary: 'Poke de longo alcance com alto teto mecânico e presença em objetivos.', tags: ['poke', 'alcance'], coreItems: ['celestial-sphere', 'sessho-seki', 'fox-sandals'] },
    { id: 'hangan', name: 'Hangan', kanji: '判官', title: 'O Juiz do Submundo', role: 'mago', difficulty: 2, tier: 'B', summary: 'Mago de iniciação direta, simples de executar e forte em pick-offs.', tags: ['iniciação', 'pick-off'], coreItems: ['mandala', 'eight-trigrams', 'swiftfoot'] },
    { id: 'suzuka-gozen', name: 'Suzuka Gozen', kanji: '鈴鹿御前', title: 'A Espada do Céu', role: 'mago', difficulty: 4, tier: 'A', summary: 'Híbrida de alcance médio com controle e potencial de finalização.', tags: ['híbrido', 'controle'], coreItems: ['amanozako-bow', 'yata-mirror', 'moon-geta'] },

    { id: 'hakuro', name: 'Hakuro', kanji: '白狼', title: 'A Loba Branca', role: 'atirador', difficulty: 2, tier: 'S', summary: 'Dano físico consistente à distância e excelente pressão em torres.', tags: ['dano contínuo', 'torre'], coreItems: ['omoikane-bow', 'shichiseiken', 'ame-no-habakiri'] },
    { id: 'miketsu', name: 'Miketsu', kanji: '御饌津', title: 'A Deusa da Colheita', role: 'atirador', difficulty: 3, tier: 'S', summary: 'Marcas e dano amplificado; domina trocas longas com boa proteção.', tags: ['marcas', 'escala'], coreItems: ['omoikane-bow', 'yasha-edge', 'hachiman-armor'] },
    { id: 'kikyo', name: 'Kikyo', kanji: '桔梗', title: 'A Sacerdotisa', role: 'atirador', difficulty: 3, tier: 'A', summary: 'Controle e dano à distância com flechas que punem aglomeração.', tags: ['controle', 'poke'], coreItems: ['omoikane-bow', 'shichiseiken', 'moon-geta'] },
    { id: 'kubinashi', name: 'Kubinashi', kanji: '首無', title: 'O Decapitado', role: 'atirador', difficulty: 2, tier: 'B', summary: 'Atirador agressivo de curto alcance, forte em lutas de rota.', tags: ['agressão', 'rota'], coreItems: ['yasha-edge', 'omoikane-bow', 'demon-blade-muramasa'] },
    { id: 'youko', name: 'Youko', kanji: '妖狐', title: 'A Raposa de Nove Caudas', role: 'atirador', difficulty: 4, tier: 'A', summary: 'Alto teto de dano em rajada, dependente de posicionamento perfeito.', tags: ['burst', 'posicionamento'], coreItems: ['omoikane-bow', 'ame-no-habakiri', 'windwalker'] },
    { id: 'chochin', name: 'Chochin', kanji: '提灯', title: 'A Lanterna', role: 'atirador', difficulty: 3, tier: 'B', summary: 'Dano em área e utilidade de visão para controlar objetivos.', tags: ['área', 'visão'], coreItems: ['omoikane-bow', 'soul-lantern', 'swiftfoot'] },

    { id: 'umibozu', name: 'Umibozu', kanji: '海坊主', title: 'O Mestre dos Mares', role: 'tanque', difficulty: 3, tier: 'S', summary: 'Iniciação de área e resistência absurda; define a abertura das lutas.', tags: ['iniciação', 'resistência'], coreItems: ['soul-armor', 'hachiman-armor', 'golden-pavilion'] },
    { id: 'yamawaro', name: 'Yamawaro', kanji: '山童', title: 'O Filho da Montanha', role: 'tanque', difficulty: 2, tier: 'A', summary: 'Tanque de controle simples, ótimo para proteger carregadores.', tags: ['controle', 'proteção'], coreItems: ['soul-armor', 'frostfire-robe', 'moon-geta'] },
    { id: 'tanuki', name: 'Tanuki', kanji: '狸猫', title: 'O Guardião Folclórico', role: 'tanque', difficulty: 2, tier: 'B', summary: 'Iniciador divertido com sustain e presença de zona.', tags: ['iniciação', 'sustento'], coreItems: ['golden-pavilion', 'frostfire-robe', 'swiftfoot'] },
    { id: 'kujira', name: 'Kujira', kanji: '鯨', title: 'A Baleia', role: 'tanque', difficulty: 3, tier: 'A', summary: 'Linha de frente com controle de grupo e boa absorção de dano.', tags: ['controle', 'linha de frente'], coreItems: ['ogre-mail', 'spirit-guard', 'windwalker'] },

    { id: 'kusa', name: 'Kusa', kanji: '蛍草', title: 'A Erva Curadora', role: 'suporte', difficulty: 2, tier: 'S', summary: 'Cura constante e escudos; mantém o time vivo em lutas prolongadas.', tags: ['cura', 'sustento'], coreItems: ['earthen-bells', 'juzu-beads', 'celestial-bell'] },
    { id: 'momo', name: 'Momo', kanji: '桃花妖', title: 'A Flor de Pessegueiro', role: 'suporte', difficulty: 3, tier: 'S', summary: 'Cura em área e ressurreição; pilar de composições de teamfight.', tags: ['cura', 'teamfight'], coreItems: ['earthen-bells', 'miracle-umbrella', 'soul-lantern'] },
    { id: 'kaguya', name: 'Kaguya', kanji: '輝夜姫', title: 'A Princesa da Lua', role: 'suporte', difficulty: 3, tier: 'A', summary: 'Controle de zona e proteção com escudos que mudam o ritmo da luta.', tags: ['escudo', 'zona'], coreItems: ['miracle-umbrella', 'spirit-guard', 'moon-geta'] },
    { id: 'oitsuki', name: 'Oitsuki', kanji: '追月神', title: 'A Lua Perseguida', role: 'suporte', difficulty: 4, tier: 'A', summary: 'Aceleração e utilidade de rotação para composições agressivas.', tags: ['rotação', 'utilidade'], coreItems: ['celestial-bell', 'cloud-boots', 'juzu-beads'] },
    { id: 'hana', name: 'Hana', kanji: '花鳥風月', title: 'A Paisagem Viva', role: 'suporte', difficulty: 4, tier: 'A', summary: 'Cura e dano híbridos; exige gestão de posição e prioridade de alvo.', tags: ['híbrido', 'cura'], coreItems: ['earthen-bells', 'juzu-beads', 'fox-sandals'] },
    { id: 'ichimokuren', name: 'Ichimokuren', kanji: '一目連', title: 'O Olho do Vento', role: 'suporte', difficulty: 3, tier: 'S', summary: 'Escudos fortes e controle de área; protege mergulhos e objetivos.', tags: ['escudo', 'proteção'], coreItems: ['miracle-umbrella', 'spirit-guard', 'windwalker'] },
    { id: 'zashiki', name: 'Zashiki', kanji: '座敷童子', title: 'A Guardiã da Casa', role: 'suporte', difficulty: 2, tier: 'B', summary: 'Suporte de economia e aura defensiva, confortável para iniciantes.', tags: ['economia', 'aura'], coreItems: ['fortune-charm', 'earthen-bells', 'swiftfoot'] }
  ];

  const onmyoji = [
    { id: 'seimei', name: 'Seimei', glyph: '晴', title: 'Mestre do Yin-Yang', bonus: 'Aumenta o dano contra alvos sob controle de grupo.', tags: ['controle', 'dano'] },
    { id: 'kagura', name: 'Kagura', glyph: '神', title: 'Dança dos Espíritos', bonus: 'Concede mobilidade e cura ao se reposicionar.', tags: ['mobilidade', 'sustento'] },
    { id: 'hiromasa', name: 'Hiromasa', glyph: '雅', title: 'Flecha da Corte', bonus: 'Reforça dano à distância e pressão em objetivos.', tags: ['alcance', 'dano'] },
    { id: 'yao-bikuni', name: 'Yao Bikuni', glyph: '薬', title: 'Chama Purificadora', bonus: 'Amplia curas e limpa efeitos negativos.', tags: ['cura', 'limpeza'] }
  ];

  const spells = [
    { id: 'flash', name: 'Flash', glyph: '閃', tag: 'Mobilidade', description: 'Deslocamento instantâneo para reposicionar ou escapar.' },
    { id: 'heal', name: 'Cura', glyph: '癒', tag: 'Sustento', description: 'Recupera vida e reforça a sobrevivência em trocas.' },
    { id: 'purify', name: 'Purificar', glyph: '浄', tag: 'Limpeza', description: 'Remove controle de grupo e concede resistência breve.' },
    { id: 'exorcism', name: 'Exorcismo', glyph: '破', tag: 'Anti-cura', description: 'Aplica dano e reduz a cura recebida do alvo.' },
    { id: 'sprint', name: 'Impulso', glyph: '疾', tag: 'Rotação', description: 'Aumenta a velocidade de movimento para rotacionar ou engajar.' },
    { id: 'smite', name: 'Golpe Selvagem', glyph: '伐', tag: 'Selva', description: 'Dano verdadeiro contra monstros e objetivo; acelera a selva.' }
  ];

  const seedBuilds = [
    { id: 'seed-void-blade', name: 'Lâmina do Vazio', shikigamiId: 'kuro-mujou', author: 'OniKage', likes: 842, createdAt: '2026-10-18', items: ['yasha-edge', 'omoikane-bow', 'demon-blade-muramasa', 'soultaker', 'frostfire-robe', 'swiftfoot'], onmyoji: 'seimei', spells: ['flash', 'exorcism'], notes: 'Priorize Yasha e Omoikane. Entre somente depois do primeiro controle do tanque; troque Frostfire por Hachiman se estiver sendo focado.' },
    { id: 'seed-thousand-blades', name: 'Dança das Mil Lâminas', shikigamiId: 'yoto-hime', author: 'Hoshizora', likes: 731, createdAt: '2026-10-15', items: ['ame-no-habakiri', 'yasha-edge', 'shichiseiken', 'demon-blade-muramasa', 'hachiman-armor', 'windwalker'], onmyoji: 'kagura', spells: ['flash', 'purify'], notes: 'Combo curto e reposicionamento constante. Guarde Ame-no-Habakiri para alvos abaixo de 35% de vida.' },
    { id: 'seed-rift-flames', name: 'Chamas do Rift', shikigamiId: 'ootengu', author: 'Karasu', likes: 689, createdAt: '2026-10-12', items: ['mandala', 'banquet-nine', 'celestial-sphere', 'amanozako-bow', 'yata-mirror', 'cloud-boots'], onmyoji: 'seimei', spells: ['flash', 'sprint'], notes: 'Jogue atrás da linha. Mandala e Banquete garantem clear rápido e pressão em área nas lutas por objetivo.' },
    { id: 'seed-unbroken-wall', name: 'Muralha Inabalável', shikigamiId: 'umibozu', author: 'Tetsuya', likes: 512, createdAt: '2026-10-09', items: ['soul-armor', 'hachiman-armor', 'golden-pavilion', 'ogre-mail', 'earthen-bells', 'cloud-boots'], onmyoji: 'hiromasa', spells: ['flash', 'heal'], notes: 'Abra a luta apenas com a ultimate disponível. Spirit Guard é uma troca defensiva válida contra composições de burst mágico.' },
    { id: 'seed-blood-moon', name: 'Lua de Sangue', shikigamiId: 'hakuro', author: 'Yukari', likes: 968, createdAt: '2026-10-20', items: ['omoikane-bow', 'shichiseiken', 'ame-no-habakiri', 'yasha-edge', 'hachiman-armor', 'swiftfoot'], onmyoji: 'hiromasa', spells: ['flash', 'sprint'], notes: 'Build de escalação agressiva. Segure a primeira onda, farme seguro e domine a partir do segundo item completo.' },
    { id: 'seed-petals', name: 'Pétalas que Curam', shikigamiId: 'kusa', author: 'Sakura', likes: 803, createdAt: '2026-10-17', items: ['earthen-bells', 'juzu-beads', 'celestial-bell', 'miracle-umbrella', 'soul-lantern', 'windwalker'], onmyoji: 'yao-bikuni', spells: ['flash', 'heal'], notes: 'Fique no limite de alcance. Celestial Bell é a resposta para composições com muito controle de grupo.' },
    { id: 'seed-drunken-oni', name: 'O Oni Bêbado', shikigamiId: 'shuten-doji', author: 'Raijin', likes: 744, createdAt: '2026-10-11', items: ['demon-blade-muramasa', 'yasha-edge', 'soul-armor', 'hachiman-armor', 'ogre-mail', 'windwalker'], onmyoji: 'seimei', spells: ['flash', 'purify'], notes: 'Troque agressivamente no início e converta o sustain em vantagem de rota. Não use Purificar cedo demais.' },
    { id: 'seed-divine-storm', name: 'Tempestade Divina', shikigamiId: 'susanoo', author: 'Arashi', likes: 655, createdAt: '2026-10-16', items: ['ame-no-habakiri', 'yasha-edge', 'shichiseiken', 'soultaker', 'frostfire-robe', 'swiftfoot'], onmyoji: 'kagura', spells: ['flash', 'exorcism'], notes: 'Build de snowball. Procure lutas 1v1 e rotacione para objetivos; cada abate acelera ainda mais o seu próximo item.' },
    { id: 'seed-golden-harvest', name: 'Colheita Dourada', shikigamiId: 'miketsu', author: 'Inari', likes: 588, createdAt: '2026-10-08', items: ['omoikane-bow', 'shichiseiken', 'yasha-edge', 'ame-no-habakiri', 'soul-armor', 'windwalker'], onmyoji: 'hiromasa', spells: ['flash', 'purify'], notes: 'Marcas antes de comprometer. Use Purificar para manter a sequência de ataques básicos sem interrupção.' },
    { id: 'seed-smoke-veil', name: 'Véu de Fumaça', shikigamiId: 'enenra', author: 'Kemuri', likes: 476, createdAt: '2026-10-05', items: ['mandala', 'sessho-seki', 'banquet-nine', 'yata-mirror', 'celestial-sphere', 'cloud-boots'], onmyoji: 'seimei', spells: ['flash', 'sprint'], notes: 'Poke seguro até o meio do jogo. Evite gastar toda a recarga antes de uma luta por objetivo.' },
    { id: 'seed-peach-bloom', name: 'A Flor de Pessegueiro', shikigamiId: 'momo', author: 'Hina', likes: 690, createdAt: '2026-10-14', items: ['earthen-bells', 'juzu-beads', 'celestial-bell', 'miracle-umbrella', 'soul-lantern', 'moon-geta'], onmyoji: 'yao-bikuni', spells: ['flash', 'heal'], notes: 'Momo precisa sobreviver para curar. Posicione-se atrás do tanque e guarde a ressurreição para o carregador.' },
    { id: 'seed-underworld', name: 'Julgamento do Submundo', shikigamiId: 'hangan', author: 'Enma', likes: 432, createdAt: '2026-10-02', items: ['mandala', 'banquet-nine', 'tome-origin', 'yata-mirror', 'celestial-sphere', 'cloud-boots'], onmyoji: 'seimei', spells: ['flash', 'exorcism'], notes: 'Iniciação simples: controle o alvo prioritário e deixe o time converter. Tome fica melhor após o segundo item.' }
  ];

  window.ONMYO = { roles, itemCategories, items, shikigami, onmyoji, spells, seedBuilds };
})();
