export const ROLES = [
  {
    id: 'top',
    name: 'Topo',
    className: 'Samurai',
    kanji: '侍',
    lane: 'Rota superior',
    short: 'Duelo e pressão lateral',
    description:
      'Você segura a rota superior, controla a onda e vira a segunda linha de frente nas lutas por objetivo.',
    plan: [
      'Mantenha a onda perto da sua torre até saber onde o selva inimigo está.',
      'Empurre antes de girar para o rio: rotação sem onda é ouro perdido.',
      'Segure CC e fuga para o dive inimigo, não para acelerar o farm.',
      'Transforme vantagem em torre e pressão lateral, não em perseguição.',
      'No late, faça split push apenas com visão e pressão nas outras rotas.'
    ]
  },
  {
    id: 'jungle',
    name: 'Selva',
    className: 'Ninja',
    kanji: '忍',
    lane: 'Selva',
    short: 'Ritmo, ganks e objetivos',
    description:
      'Você dita o ritmo: limpa a selva, conecta ganks e chega antes do inimigo em cada objetivo.',
    plan: [
      'Compre Hunting Knife e leve Subdue desde o primeiro segundo.',
      'Comece pelo lado oposto da rota que pretende gankar primeiro.',
      'Depois do gank, não empurre a onda do aliado.',
      'Rastreie o selva inimigo e pingue o lado do mapa onde ele está.',
      'Esteja no rio 30 segundos antes do boss, com visão e lane empurrada.'
    ]
  },
  {
    id: 'mid',
    name: 'Meio',
    className: 'Mago',
    kanji: '法',
    lane: 'Rota central',
    short: 'Controle e rotações',
    description:
      'Você empurra o meio, abre espaço com controle e acompanha o selva nas disputas de rio.',
    plan: [
      'Empurre o meio antes de girar; onda empurrada compra tempo de rotação.',
      'Warde a entrada do rio antes de seguir o selva.',
      'Nunca facechecke arbusto sem visão: espere o tanque ou um aliado.',
      'Use a ultimate para pick ou objetivo, não para limpar onda.',
      'No late, fique atrás da linha de frente e descarregue o combo no carry.'
    ]
  },
  {
    id: 'adc',
    name: 'Atirador',
    className: 'Marksman',
    kanji: '弓',
    lane: 'Rota inferior (dupla)',
    short: 'Dano contínuo e torres',
    description:
      'Você é a condição de vitória no late: farma seguro, respeita o CC inimigo e derruba torres após cada pick.',
    plan: [
      'Farme atrás do suporte e só avance com visão.',
      'Espere o CC e o burst inimigo saírem antes de entrar na luta.',
      'Rotacione apenas com a onda empurrada.',
      'Depois de uma pick, pegue torre ou objetivo em vez de caçar mais kills.',
      'No late, ataque o alvo mais próximo — não o mais distante.'
    ]
  },
  {
    id: 'support',
    name: 'Suporte',
    className: 'Support',
    kanji: '守',
    lane: 'Rota inferior (dupla)',
    short: 'Visão e proteção',
    description:
      'Você protege o atirador, controla a visão do rio e transforma vantagem de lane em objetivo.',
    plan: [
      'Coloque visão antes do objetivo, nunca depois.',
      'Fique entre o seu atirador e a ameaça principal.',
      'Não deixe o atirador sozinho para fazer roam.',
      'Roame com o selva quando a onda estiver segura.',
      'Guarde o peel para o dive e aceite morrer para salvar o carry no late.'
    ]
  }
]

export const PHASES = [
  {
    id: 'prep',
    name: 'Preparação',
    start: 0,
    end: 30,
    tagline: 'Saída de base',
    description: 'Rota definida, item comprado e primeira onda a caminho.'
  },
  {
    id: 'lane',
    name: 'Laning',
    start: 30,
    end: 240,
    tagline: 'Farm e pressão',
    description: 'Ondas a cada 30s. Troque dano com propósito e não entregue ouro de graça.'
  },
  {
    id: 'river',
    name: 'Disputa do rio',
    start: 240,
    end: 480,
    tagline: 'Primeiro grande objetivo',
    description: 'Boss do rio no mapa. Visão e prioridade de onda valem mais que um kill isolado.'
  },
  {
    id: 'mid',
    name: 'Meio de jogo',
    start: 480,
    end: 720,
    tagline: 'Orochi e torres',
    description: 'Orochi muda o mapa. Agrupe, empurre as laterais e negue a visão inimiga.'
  },
  {
    id: 'late',
    name: 'Fim de jogo',
    start: 720,
    end: 1080,
    tagline: 'Pressão de base',
    description: 'Um erro custa a partida. Segure cooldowns, jogue com visão e converta picks.'
  },
  {
    id: 'end',
    name: 'Decisão',
    start: 1080,
    end: Infinity,
    tagline: 'Nen e base',
    description: 'Nen decide. Fique junto, controle a visão e force a luta com ultimates prontas.'
  }
]

export const OBJECTIVES = [
  {
    id: 'riverboss',
    name: 'Boss do rio',
    short: 'Rio',
    icon: 'wave',
    time: 240,
    respawn: 240,
    detail: 'Kraken, Namazu ou Shinkiro — o boss é sorteado por partida. O buff acumula até 3 stacks.'
  },
  {
    id: 'orochi',
    name: 'Orochi',
    short: 'Orochi',
    icon: 'serpent',
    time: 480,
    respawn: 300,
    detail: 'O objetivo que vira o mapa. Não faça 50/50: empurre as laterais e jogue com visão.'
  },
  {
    id: 'nen',
    name: 'Nen',
    short: 'Nen',
    icon: 'flame',
    time: 1080,
    respawn: null,
    detail: 'Objetivo de decisão. Fique agrupado, controle a área e force a luta com as ultimates prontas.'
  }
]

export const THREATS = [
  {
    id: 'cc',
    name: 'CC pesado',
    icon: 'chain',
    description: 'Stuns, slows e prisões em cadeia.',
    counter: 'Espere o CC-chave sair e guarde Purificação para a corrente principal.'
  },
  {
    id: 'burst',
    name: 'Burst',
    icon: 'spark',
    description: 'Explosão rápida em um único alvo.',
    counter: 'Fique perto do suporte, respeite cooldowns e não ande sozinho no rio.'
  },
  {
    id: 'sustain',
    name: 'Cura/Sustain',
    icon: 'leaf',
    description: 'Cura, escudo e regeneração.',
    counter: 'Compre anti-cura e concentre burst antes que o heal entre.'
  },
  {
    id: 'poke',
    name: 'Poke',
    icon: 'arrow',
    description: 'Dano à distância antes da luta.',
    counter: 'Engaje rápido, use a onda como escudo e não siege com vida baixa.'
  },
  {
    id: 'dive',
    name: 'Dive',
    icon: 'blade',
    description: 'Mergulha na sua linha para matar o carry.',
    counter: 'Guarde peel e fuga para o mergulho; não gaste tudo no poke.'
  },
  {
    id: 'tank',
    name: 'Tanque',
    icon: 'shield',
    description: 'Muita vida e resistência; luta longa.',
    counter: 'Ignore o tanque, ache o carry e invista em penetração de armadura/mágica.'
  }
]

export const ROSTER = [
  { name: 'Aobozu', role: 'top', tags: ['sustain', 'tank'] },
  { name: 'Ibaraki Doji', role: 'top', tags: ['burst', 'cc'] },
  { name: 'Inosuke Hashibira', role: 'top', tags: ['dive', 'sustain'] },
  { name: 'Inuyasha', role: 'top', tags: ['dive', 'burst'] },
  { name: 'Kani Hime', role: 'top', tags: ['dive', 'sustain'] },
  { name: 'Karasu Tengu', role: 'top', tags: ['sustain'] },
  { name: 'Kuro Mujou', role: 'top', tags: ['sustain', 'tank'] },
  { name: 'Ryomen', role: 'top', tags: ['sustain'] },
  { name: 'Samurai X', role: 'top', tags: ['tank', 'cc'] },
  { name: 'Shishio', role: 'top', tags: ['dive', 'sustain'] },
  { name: 'Shuten Doji', role: 'top', tags: ['burst', 'cc'] },
  { name: 'Takiyasha Hime', role: 'top', tags: ['cc', 'sustain'] },
  { name: 'Tanjiro Kamado', role: 'top', tags: ['dive', 'burst'] },
  { name: 'Yoto Hime', role: 'top', tags: ['dive', 'burst'] },
  { name: 'Yuki', role: 'top', tags: ['sustain', 'cc'] },

  { name: 'Hone Onna', role: 'jungle', tags: ['dive', 'burst'] },
  { name: 'Ittan-momen', role: 'jungle', tags: ['dive', 'burst'] },
  { name: 'Kainin', role: 'jungle', tags: ['dive', 'burst'] },
  { name: 'Kamaitachi', role: 'jungle', tags: ['dive', 'cc'] },
  { name: 'Kosodenote', role: 'jungle', tags: ['burst', 'cc'] },
  { name: 'Kyonshi Imoto', role: 'jungle', tags: ['burst', 'dive'] },
  { name: 'Mannendake', role: 'jungle', tags: ['dive', 'burst'] },
  { name: 'Nekomata', role: 'jungle', tags: ['dive', 'burst'] },
  { name: 'Onikiri', role: 'jungle', tags: ['dive', 'burst'] },
  { name: 'Puppeteer', role: 'jungle', tags: ['burst', 'cc'] },
  { name: 'Sesshomaru', role: 'jungle', tags: ['dive', 'burst'] },
  { name: 'Shiro', role: 'jungle', tags: ['burst'] },
  { name: 'Ubume', role: 'jungle', tags: ['dive', 'sustain'] },
  { name: 'Yamakaze', role: 'jungle', tags: ['dive', 'burst'] },
  { name: 'Yasha', role: 'jungle', tags: ['dive', 'burst'] },

  { name: 'Aoandon', role: 'mid', tags: ['poke', 'burst'] },
  { name: 'Enenra', role: 'mid', tags: ['poke', 'burst'] },
  { name: 'Hangan', role: 'mid', tags: ['poke', 'cc'] },
  { name: 'Hannya', role: 'mid', tags: ['burst', 'cc'] },
  { name: 'Higanbana', role: 'mid', tags: ['burst', 'cc'] },
  { name: 'Izanami', role: 'mid', tags: ['burst', 'cc'] },
  { name: 'Kingyo', role: 'mid', tags: ['burst', 'cc'] },
  { name: 'Kisei', role: 'mid', tags: ['poke', 'burst'] },
  { name: 'Kiyohime', role: 'mid', tags: ['cc', 'poke'] },
  { name: 'Menreiki', role: 'mid', tags: ['poke', 'burst'] },
  { name: 'Oitsuki', role: 'mid', tags: ['cc', 'dive'] },
  { name: 'Ootengu', role: 'mid', tags: ['cc', 'burst'] },
  { name: 'Shiranui', role: 'mid', tags: ['burst', 'cc'] },
  { name: 'Shiro Mujou', role: 'mid', tags: ['cc', 'burst'] },
  { name: 'Susabi', role: 'mid', tags: ['burst', 'cc'] },
  { name: 'Tamamonomae', role: 'mid', tags: ['burst', 'poke'] },
  { name: 'Yuki Onna', role: 'mid', tags: ['cc', 'poke'] },
  { name: 'Zashiki', role: 'mid', tags: ['poke', 'sustain'] },

  { name: 'Chin', role: 'adc', tags: ['poke'] },
  { name: 'Enma', role: 'adc', tags: ['poke', 'burst'] },
  { name: 'Futakuchi', role: 'adc', tags: ['poke'] },
  { name: 'Hakuro', role: 'adc', tags: ['poke'] },
  { name: 'Kanko', role: 'adc', tags: ['poke'] },
  { name: 'Kikyo', role: 'adc', tags: ['poke'] },
  { name: 'Kinnara', role: 'adc', tags: ['poke'] },
  { name: 'Kubinashi', role: 'adc', tags: ['burst', 'poke'] },
  { name: 'Miketsu', role: 'adc', tags: ['poke', 'burst'] },
  { name: 'Suzuka Gozen', role: 'adc', tags: ['poke', 'burst'] },
  { name: 'Youko', role: 'adc', tags: ['burst', 'poke'] },

  { name: 'Bakekujira', role: 'support', tags: ['tank', 'cc'] },
  { name: 'Ebisu', role: 'support', tags: ['tank', 'sustain'] },
  { name: 'Enmusubi', role: 'support', tags: ['sustain'] },
  { name: 'Furi', role: 'support', tags: ['tank', 'sustain'] },
  { name: 'Hako Shoujo', role: 'support', tags: ['cc', 'poke'] },
  { name: 'Hana', role: 'support', tags: ['sustain', 'cc'] },
  { name: 'Hiyoribou', role: 'support', tags: ['sustain', 'cc'] },
  { name: 'Ichimokuren', role: 'support', tags: ['cc', 'sustain'] },
  { name: 'Kaguya', role: 'support', tags: ['cc', 'poke'] },
  { name: 'Kujira', role: 'support', tags: ['tank', 'sustain'] },
  { name: 'Kusa', role: 'support', tags: ['sustain'] },
  { name: 'Kyonshi Ani', role: 'support', tags: ['tank', 'cc'] },
  { name: 'Momo', role: 'support', tags: ['sustain'] },
  { name: 'Mouba', role: 'support', tags: ['tank', 'cc'] },
  { name: 'Mushishi', role: 'support', tags: ['sustain'] },
  { name: 'Nezuko Kamado', role: 'support', tags: ['tank', 'cc'] },
  { name: 'Shouzu', role: 'support', tags: ['cc', 'sustain'] },
  { name: 'Tanuki', role: 'support', tags: ['tank', 'cc'] },
  { name: 'Umibozu', role: 'support', tags: ['tank', 'cc'] },
  { name: 'Vampira', role: 'support', tags: ['tank', 'sustain'] },
  { name: 'Yamausagi', role: 'support', tags: ['cc'] },
  { name: 'Yamawaro', role: 'support', tags: ['tank', 'cc'] }
]

const ALL = []
const LANE = ['prep', 'lane']
const MIDGAME = ['river', 'mid']
const LATEGAME = ['late', 'end']

export const TIPS = [
  {
    id: 'do-last-hit',
    kind: 'do',
    title: 'Last hit, não empurre de graça',
    body: 'Deixe a onda perto da sua torre e avance só para pegar o ouro do abate. Onda empurrada sem visão é convite para gank.',
    why: 'Ouro de abate constrói seu item spike; empurrar sem visão entrega espaço para o selva inimigo.',
    roles: ALL,
    phases: LANE,
    priority: 72,
    tags: ['farm', 'onda']
  },
  {
    id: 'dont-cross-river',
    kind: 'dont',
    title: 'Não atravesse o rio sem visão',
    body: 'Se você não sabe onde o selva inimigo está, não avance além da metade da rota. Espere a onda voltar ou um aliado aparecer no mapa.',
    why: 'A maioria das mortes no laning vem de rotação sem informação.',
    roles: ALL,
    phases: ['lane', 'river'],
    threats: ['dive', 'burst'],
    priority: 76,
    tags: ['visão', 'segurança']
  },
  {
    id: 'do-wave-first',
    kind: 'do',
    title: 'Onda primeiro, rotação depois',
    body: 'Antes de recuar, girar ou disputar rio, empurre a onda até a torre inimiga. Assim você volta com a wave a seu favor e não perde ouro.',
    why: 'A onda empurrada prende o laner inimigo e compra 20–30 segundos de liberdade.',
    roles: ALL,
    phases: ['lane', 'river', 'mid'],
    priority: 66,
    tags: ['onda', 'macro']
  },
  {
    id: 'dont-chase-fog',
    kind: 'dont',
    title: 'Não persiga kill para dentro do fog',
    body: 'Se o alvo entrou no arbusto ou no rio sem visão, pare. Troque a perseguição por torre, wave ou visão do objetivo.',
    why: 'Perseguir no escuro é como entrar sozinho na selva inimiga.',
    roles: ALL,
    phases: ['lane', 'river', 'mid', 'late'],
    threats: ['cc', 'dive', 'burst'],
    priority: 82,
    tags: ['segurança', 'decisão']
  },
  {
    id: 'do-ping-missing',
    kind: 'do',
    title: 'Pingue o inimigo sumido',
    body: 'Marque o "sumiu" e acompanhe o lado do mapa. Um ping vale mais que uma kill perdida por falta de aviso.',
    why: 'Informação compartilhada evita gank em duas rotas ao mesmo tempo.',
    roles: ALL,
    phases: ['lane', 'river', 'mid', 'late'],
    priority: 80,
    tags: ['visão', 'comunicação']
  },
  {
    id: 'do-spend-gold',
    kind: 'do',
    title: 'Recue com ouro e volte com item',
    body: 'Depois de empurrar a onda ou pegar objetivo, resete. Ouro parado no bolso não ganha luta.',
    why: 'Item spike antecipado muda o resultado da próxima disputa.',
    roles: ALL,
    phases: ['lane', 'river', 'mid'],
    priority: 62,
    tags: ['farm', 'reset']
  },

  {
    id: 'top-freeze',
    kind: 'do',
    title: 'Congele perto da torre contra ranged',
    body: 'Contra poke ou atirador no topo, segure a onda perto da sua torre. Force o inimigo a se expor para farmar.',
    why: 'Você nega farm e cria ângulo para o seu selva.',
    roles: ['top'],
    phases: LANE,
    threats: ['poke'],
    priority: 70,
    tags: ['topo', 'onda']
  },
  {
    id: 'top-big-wave',
    kind: 'dont',
    title: 'Não brigue com wave grande contra você',
    body: 'Se a onda inimiga está maior, recue. Trocar dano com minions batendo em você perde a luta antes de começar.',
    why: 'No early, a wave vale mais dano que muitos shikigami.',
    roles: ['top'],
    phases: LANE,
    priority: 68,
    tags: ['topo', 'duelo']
  },
  {
    id: 'top-punish-cooldown',
    kind: 'do',
    title: 'Puna o cooldown errado',
    body: 'Quando o inimigo usar a habilidade de controle ou fuga para farmar, avance e force a troca. A janela dura poucos segundos.',
    why: 'Sem a habilidade principal, o laner perde a negociação.',
    roles: ['top'],
    phases: LANE,
    minLevel: 2,
    priority: 56,
    tags: ['topo', 'duelo']
  },
  {
    id: 'top-rotate-river',
    kind: 'do',
    title: 'Rotacione ao rio com a wave empurrada',
    body: 'Empurre o topo, coloque visão na entrada do rio e chegue antes do boss. Se a wave estiver voltando, resolva a wave primeiro.',
    why: 'Chegar 10 segundos antes muda quem inicia a disputa.',
    roles: ['top'],
    phases: MIDGAME,
    priority: 68,
    tags: ['topo', 'objetivo']
  },
  {
    id: 'top-dont-farm-escape',
    kind: 'dont',
    title: 'Não use a fuga para farmar',
    body: 'Guarde a mobilidade para o gank ou para o dive. Sem fuga, você não pode pressionar a torre nem sobreviver a uma colisão.',
    why: 'O selva inimigo marca jogadores sem mobilidade.',
    roles: ['top'],
    phases: ['lane', 'river', 'mid'],
    priority: 62,
    tags: ['topo', 'segurança']
  },
  {
    id: 'top-hold-cc',
    kind: 'do',
    title: 'Segure o CC para o dive',
    body: 'Contra times com dive, não abra o CC no primeiro contato. Espere o assassino entrar e então trave a entrada.',
    why: 'Um CC no carry inimigo vale menos que um CC no assassino que salta no seu.',
    roles: ['top'],
    phases: ['mid', 'late'],
    threats: ['dive', 'burst'],
    priority: 64,
    tags: ['topo', 'luta']
  },
  {
    id: 'top-split-vision',
    kind: 'do',
    title: 'Split push só com visão',
    body: 'Pressione a lateral apenas quando o time inimigo estiver visível longe e suas outras rotas estiverem empurradas.',
    why: 'Split sem informação vira 4v5 e entrega objetivo.',
    roles: ['top'],
    phases: LATEGAME,
    minLevel: 2,
    priority: 58,
    tags: ['topo', 'macro']
  },
  {
    id: 'top-dont-split-baron',
    kind: 'dont',
    title: 'Não split quando o Nen está no mapa',
    body: 'No late, o objetivo decide. Se o time está disputando Nen ou Orochi, largue a lateral e agrupe.',
    why: 'Trocar uma torre por um objetivo de decisão não compensa.',
    roles: ['top'],
    phases: ['end'],
    priority: 84,
    tags: ['topo', 'objetivo']
  },

  {
    id: 'jungle-knife',
    kind: 'do',
    title: 'Hunting Knife + Subdue desde o início',
    body: 'A faca de caça acelera a limpeza e sustenta sua vida. Subdue reduz o tempo de clear e deve ser usado assim que estiver disponível.',
    why: 'Sem os dois, você fica atrasado e chega tarde no primeiro objetivo.',
    roles: ['jungle'],
    phases: ['prep', 'lane'],
    priority: 90,
    tags: ['selva', 'farm']
  },
  {
    id: 'jungle-opposite-start',
    kind: 'do',
    title: 'Comece no lado oposto do primeiro gank',
    body: 'Limpe o lado contrário à rota que pretende atacar e chegue nela no nível 3. Evite começar pelo lado que você vai gankar.',
    why: 'Isso reduz o caminho até a janela de gank e mantém seu clear eficiente.',
    roles: ['jungle'],
    phases: ['prep', 'lane'],
    priority: 82,
    tags: ['selva', 'rota']
  },
  {
    id: 'jungle-dont-shove',
    kind: 'dont',
    title: 'Não empurre a lane depois do gank',
    body: 'Depois do gank, ajude só a estabilizar a wave. Empurrar a onda do aliado tira o farm dele e abre espaço para o inimigo.',
    why: 'Você rouba recursos da lane e ainda perde a próxima janela de gank.',
    roles: ['jungle'],
    phases: ['lane', 'river'],
    priority: 78,
    tags: ['selva', 'onda']
  },
  {
    id: 'jungle-track',
    kind: 'do',
    title: 'Rastreie o selva inimigo',
    body: 'O primeiro acampamento inimigo revela o lado dele. Se ele limpou o topo, sua rota inferior está segura por cerca de 90 segundos.',
    why: 'Informação de pathing permite pressionar sem medo e preparar counter-gank.',
    roles: ['jungle'],
    phases: ['lane', 'river'],
    minLevel: 2,
    priority: 64,
    tags: ['selva', 'visão']
  },
  {
    id: 'jungle-gank-priority',
    kind: 'do',
    title: 'Ganke a lane com prioridade, não a perdida',
    body: 'Prefira a rota com wave boa e cooldowns inimigos gastos. Ajudar a lane que já perdeu costuma custar mais que render.',
    why: 'Gank bom cria objetivo; gank em lane perdida vira 2 mortes.',
    roles: ['jungle'],
    phases: ['lane', 'river'],
    minLevel: 2,
    priority: 66,
    tags: ['selva', 'decisão']
  },
  {
    id: 'jungle-no-ult-gank',
    kind: 'dont',
    title: 'Não force gank sem CC ou ultimate',
    body: 'Sem ferramenta de controle ou dano suficiente, o gank só entrega sua posição. Volte a farmar e espere a próxima janela.',
    why: 'Tempo perdido em gank ruim é tempo que o outro selva usa para crescer.',
    roles: ['jungle'],
    phases: ['lane', 'river'],
    priority: 68,
    tags: ['selva', 'decisão']
  },
  {
    id: 'jungle-countergank',
    kind: 'do',
    title: 'Counter-ganke quando o inimigo aparecer',
    body: 'Se o selva inimigo mostrar no mapa e sua rota estiver por perto, entre imediatamente. O counter-gank chega antes do dano dele acabar.',
    why: 'Virar uma luta 2v2 é a forma mais rápida de punir um gank previsível.',
    roles: ['jungle'],
    phases: ['lane', 'river', 'mid'],
    minLevel: 2,
    priority: 60,
    tags: ['selva', 'luta']
  },
  {
    id: 'jungle-ward-objective',
    kind: 'do',
    title: 'Garanta visão antes do boss do rio',
    body: 'Por volta de 3:30, coloque visão nas entradas do rio e no pit. Diga ao time para empurrar as laterais antes de iniciar.',
    why: 'Boss sem visão é 50/50; boss com visão é objetivo.',
    roles: ['jungle'],
    phases: ['river'],
    priority: 86,
    tags: ['selva', 'objetivo']
  },
  {
    id: 'jungle-dont-die-farm',
    kind: 'dont',
    title: 'Não morra farmando antes do objetivo',
    body: 'Se o timer do rio está perto, não entre em acampamento profundo sem visão. Vivo e atrasado vale mais que morto e farmado.',
    why: 'Sua morte entrega o objetivo e a próxima rotação.',
    roles: ['jungle'],
    phases: MIDGAME,
    priority: 74,
    tags: ['selva', 'segurança']
  },

  {
    id: 'mid-shove-roam',
    kind: 'do',
    title: 'Empurre o meio e siga o selva',
    body: 'Limpe a onda com segurança e ande pelo lado do selva. O meio não é uma ilha: é a segunda selva.',
    why: 'Roam com informação cria números iguais ou maiores no rio.',
    roles: ['mid'],
    phases: ['lane', 'river'],
    priority: 76,
    tags: ['meio', 'rotação']
  },
  {
    id: 'mid-facecheck',
    kind: 'dont',
    title: 'Não facechecke arbusto sem visão',
    body: 'Deixe o tanque ou o selva entrar primeiro. Espere a visão ou use uma habilidade de longo alcance para checar.',
    why: 'Mago tem o kit mais frágil da rotação; o primeiro hit decide.',
    roles: ['mid'],
    phases: ['lane', 'river', 'mid', 'late'],
    threats: ['burst', 'cc', 'dive'],
    priority: 78,
    tags: ['meio', 'segurança']
  },
  {
    id: 'mid-roam-objective',
    kind: 'do',
    title: 'Roame para o lado do próximo objetivo',
    body: 'Se o rio está perto de nascer, empurre o meio para o lado do pit e acompanhe seu selva. Não gire para o lado oposto.',
    why: 'Sua presença transforma a disputa de 5v5 em 5v4.',
    roles: ['mid'],
    phases: MIDGAME,
    priority: 70,
    tags: ['meio', 'objetivo']
  },
  {
    id: 'mid-ult-farm',
    kind: 'dont',
    title: 'Não use a ultimate para farmar',
    body: 'Guarde a ultimate para pick, luta por objetivo ou defesa de torre. Limpar onda com ela deixa o time sem dano na próxima disputa.',
    why: 'A janela de cooldown da ultimate define quem inicia a luta.',
    roles: ['mid'],
    phases: ['river', 'mid', 'late'],
    priority: 60,
    tags: ['meio', 'cooldown']
  },
  {
    id: 'mid-control-river',
    kind: 'do',
    title: 'Controle o rio com visão, não com dano',
    body: 'Antes do objetivo, use habilidades de zona para negar a entrada. Dano em tanque não ganha rio; visão e controle ganham.',
    why: 'Negar a aproximação evita o 50/50 do boss.',
    roles: ['mid'],
    phases: MIDGAME,
    minLevel: 2,
    priority: 62,
    tags: ['meio', 'visão']
  },
  {
    id: 'mid-late-position',
    kind: 'do',
    title: 'Fique atrás e burst o carry',
    body: 'No late, espere a linha de frente travar a luta e descarregue o combo no atirador ou no mago inimigo.',
    why: 'Seu dano em área perde valor se você morre antes de soltar o segundo round.',
    roles: ['mid'],
    phases: LATEGAME,
    priority: 68,
    tags: ['meio', 'luta']
  },
  {
    id: 'mid-ult-tank',
    kind: 'dont',
    title: 'Não gaste tudo no tanque',
    body: 'Se o tank está na frente, ignore-o. Espere o carry se expor ou use o CC para quebrar a linha e chegar nele.',
    why: 'Dano em tanque raramente vence a luta; o carry continua livre.',
    roles: ['mid'],
    phases: LATEGAME,
    threats: ['tank'],
    priority: 66,
    tags: ['meio', 'foco']
  },

  {
    id: 'adc-safe-farm',
    kind: 'do',
    title: 'Farme atrás do suporte e só avance com visão',
    body: 'Sua função no early é chegar ao item spike. Fique atrás da linha, pegue a onda e não cruze o rio sem saber onde o selva está.',
    why: 'Atirador farmado vale mais que atirador com 2 kills e 6 mortes.',
    roles: ['adc'],
    phases: ['lane', 'river'],
    priority: 86,
    tags: ['atirador', 'farm']
  },
  {
    id: 'adc-frontline',
    kind: 'dont',
    title: 'Não fique na frente da linha de frente',
    body: 'Se você está na frente, o dive inimigo tem alvo fácil. Fique atrás do suporte e do tanque, dentro do alcance do seu ataque.',
    why: 'Um atirador morto cedo perde a luta mesmo com o time vivo.',
    roles: ['adc'],
    phases: ['river', 'mid', 'late', 'end'],
    threats: ['dive', 'burst', 'cc'],
    priority: 92,
    tags: ['atirador', 'posição']
  },
  {
    id: 'adc-wait-cc',
    kind: 'do',
    title: 'Espere o CC inimigo sair',
    body: 'Entre na luta depois que a habilidade de controle principal for usada. Se ela ainda está disponível, ataque de longe e mantenha distância.',
    why: 'O atirador não tem margem para ser pego pela primeira CC.',
    roles: ['adc'],
    phases: ['river', 'mid', 'late'],
    threats: ['cc'],
    priority: 80,
    tags: ['atirador', 'luta']
  },
  {
    id: 'adc-rotate-wave',
    kind: 'dont',
    title: 'Não rotacione sem empurrar a wave',
    body: 'Se você sair da rota com a onda inimiga viva, perde ouro e torre. Empurre primeiro, ou não rotacione.',
    why: 'Rotação sem onda é troca de farm por nada.',
    roles: ['adc'],
    phases: ['lane', 'river', 'mid'],
    priority: 68,
    tags: ['atirador', 'onda']
  },
  {
    id: 'adc-tower',
    kind: 'do',
    title: 'Depois de uma pick, pegue torre',
    body: 'Com um inimigo morto, use a vantagem numérica para derrubar torre ou iniciar objetivo. Não volte para a selva.',
    why: 'Torre abre o mapa e aumenta a pressão de todas as rotas.',
    roles: ['adc'],
    phases: ['river', 'mid', 'late'],
    priority: 64,
    tags: ['atirador', 'objetivo']
  },
  {
    id: 'adc-dont-chase',
    kind: 'dont',
    title: 'Não cace kill com vida baixa',
    body: 'Com pouca vida, recue e resete. Um kill extra não vale entregar shutdown e perder o objetivo seguinte.',
    why: 'Atirador morto não derruba torre.',
    roles: ['adc'],
    phases: ['river', 'mid', 'late'],
    priority: 82,
    tags: ['atirador', 'segurança']
  },
  {
    id: 'adc-late-target',
    kind: 'do',
    title: 'Ataque o alvo mais próximo, não o mais distante',
    body: 'No late, priorize o alvo que você consegue atingir sem sair da posição segura. Perseguir o carry atrás do tanque expõe você.',
    why: 'Dano contínuo vence a luta; caçar alvo errado perde ela.',
    roles: ['adc'],
    phases: LATEGAME,
    priority: 72,
    tags: ['atirador', 'foco']
  },
  {
    id: 'adc-dont-solo-farm',
    kind: 'dont',
    title: 'Não farme sozinho no late',
    body: 'No late, wave lateral longe do time é isca. Farme com visão e perto de um aliado, ou deixe o farm e agrupe.',
    why: 'Uma pick no atirador entrega o objetivo e a partida.',
    roles: ['adc'],
    phases: LATEGAME,
    threats: ['dive', 'burst'],
    priority: 84,
    tags: ['atirador', 'segurança']
  },

  {
    id: 'support-ward',
    kind: 'do',
    title: 'Visão antes do objetivo, nunca depois',
    body: 'Trinta segundos antes do rio ou do Orochi, coloque visão nas entradas e no pit. Warde o caminho que o inimigo precisa usar, não só o pit.',
    why: 'A visão de aproximação evita a pick que ganha a luta antes dela começar.',
    roles: ['support'],
    phases: ['lane', 'river', 'mid', 'end'],
    priority: 90,
    tags: ['suporte', 'visão']
  },
  {
    id: 'support-bodyblock',
    kind: 'do',
    title: 'Fique entre o atirador e a ameaça',
    body: 'Sua posição padrão é na frente do carry, mas atrás do tanque. Bloqueie o caminho do assassino e use seu CC no mergulho.',
    why: 'O atirador precisa de um segundo a mais para soltar dano.',
    roles: ['support'],
    phases: ['lane', 'river', 'mid', 'late'],
    threats: ['dive', 'burst'],
    priority: 84,
    tags: ['suporte', 'proteção']
  },
  {
    id: 'support-dont-leave',
    kind: 'dont',
    title: 'Não deixe o atirador sozinho para roam',
    body: 'Se você sair, avise e só vá quando a wave estiver segura. Roam com o atirador exposto entrega farm e torre.',
    why: 'A dupla precisa de um jogador para segurar a wave e outro para criar pressão.',
    roles: ['support'],
    phases: ['lane', 'river'],
    priority: 78,
    tags: ['suporte', 'dupla']
  },
  {
    id: 'support-roam-jungle',
    kind: 'do',
    title: 'Roame com o selva quando a wave estiver segura',
    body: 'Com a onda empurrada, acompanhe o selva até o rio. Dois jogadores criam visão e pressão sem perder a dupla.',
    why: 'O roam coordenado transforma o suporte em segundo selva.',
    roles: ['support'],
    phases: ['lane', 'river'],
    minLevel: 2,
    priority: 66,
    tags: ['suporte', 'rotação']
  },
  {
    id: 'support-cc-initiative',
    kind: 'dont',
    title: 'Não gaste todo o CC na iniciação',
    body: 'Contra dive, guarde pelo menos uma ferramenta de peel para o assassino. Iniciar com tudo deixa o carry sem proteção.',
    why: 'O dive espera exatamente o momento em que seu CC acaba.',
    roles: ['support'],
    phases: ['mid', 'late'],
    threats: ['dive'],
    priority: 74,
    tags: ['suporte', 'luta']
  },
  {
    id: 'support-sacrifice',
    kind: 'do',
    title: 'No late, sacrifique-se pelo carry',
    body: 'Se a luta está perdida, segure o inimigo e dê tempo para o atirador recuar. Sua vida vale menos que a dele no late.',
    why: 'O carry vivo ainda pode defender base e ganhar a próxima luta.',
    roles: ['support'],
    phases: LATEGAME,
    priority: 70,
    tags: ['suporte', 'decisão']
  },
  {
    id: 'support-dont-engage-alone',
    kind: 'dont',
    title: 'Não inicie luta sem o time perto',
    body: 'Um CC inicial sozinho vira morte e objetivo para o inimigo. Espere a linha de frente e o dano estarem no alcance.',
    why: 'Iniciação sozinha só funciona quando o time já está atrás de você.',
    roles: ['support'],
    phases: ['mid', 'late', 'end'],
    priority: 80,
    tags: ['suporte', 'luta']
  },

  {
    id: 'obj-push-waves',
    kind: 'do',
    title: 'Empurre as lanes antes de disputar o boss',
    body: 'Antes do rio ou do Orochi, deixe as laterais pressionando. O inimigo precisa escolher entre defender a onda e contestar o objetivo.',
    why: 'Prioridade de onda é o que permite iniciar o objetivo sem 50/50.',
    roles: ALL,
    phases: ['lane', 'river', 'mid'],
    objective: 'riverboss',
    window: 'soon',
    priority: 88,
    tags: ['objetivo', 'onda']
  },
  {
    id: 'obj-no-vision-start',
    kind: 'dont',
    title: 'Não comece o boss sem visão e vantagem',
    body: 'Se o rio está escuro ou o time está atrás, não inicie. Coloque visão, empurre uma lateral ou troque o objetivo por torre.',
    why: 'Iniciar sem informação entrega o boss e a luta de graça.',
    roles: ALL,
    phases: ['river', 'mid'],
    objective: 'riverboss',
    window: 'live',
    priority: 94,
    tags: ['objetivo', 'visão']
  },
  {
    id: 'obj-trade',
    kind: 'do',
    title: 'Se não puder contestar, troque por torre',
    body: 'Quando o inimigo inicia o objetivo e você está atrasado, pressione a torre oposta. Trocar um objetivo por outro é melhor que morrer no 50/50.',
    why: 'Não existe obrigação de contestar toda disputa.',
    roles: ALL,
    phases: ['river', 'mid', 'late'],
    priority: 76,
    tags: ['objetivo', 'macro']
  },
  {
    id: 'obj-dont-5050-orochi',
    kind: 'dont',
    title: 'Não faça 50/50 no Orochi',
    body: 'Orochi não é objetivo para iniciar sem visão, sem vantagem ou sem as laterais empurradas. Se não tiver condições, negue a visão e espere.',
    why: 'Perder o 50/50 do Orochi costuma custar a partida.',
    roles: ALL,
    phases: ['mid', 'late'],
    objective: 'orochi',
    window: 'live',
    priority: 96,
    tags: ['objetivo', 'orochi']
  },
  {
    id: 'obj-after-orochi',
    kind: 'do',
    title: 'Depois de um objetivo, agrupe e pressione',
    body: 'Com um buff importante, ande junto com as ondas empoderadas. Não se espalhe pela selva: o objetivo é derrubar torre e inibidor.',
    why: 'O valor de um objetivo está na pressão imediata, não no farm.',
    roles: ALL,
    phases: ['mid', 'late'],
    priority: 66,
    tags: ['objetivo', 'macro']
  },
  {
    id: 'obj-boss-stacks',
    kind: 'do',
    title: 'Aproveite o buff de 3 stacks do boss',
    body: 'O boss do rio acumula buffs por time. Com 3 stacks, force a luta: o poder extra muda o resultado.',
    why: 'O terceiro abate é uma janela de vitória, não só mais um buff.',
    roles: ALL,
    phases: ['mid', 'late'],
    minLevel: 2,
    priority: 64,
    tags: ['objetivo', 'buff']
  },
  {
    id: 'obj-dont-disperse',
    kind: 'dont',
    title: 'Não disperse depois de pegar um objetivo',
    body: 'Depois de vencer uma luta ou pegar um buff, use a janela para torre, visão ou outro objetivo. Recuar para farmar desperdiça a vantagem.',
    why: 'Objetivos abrem uma janela curta que o inimigo vai tentar esperar.',
    roles: ALL,
    phases: ['river', 'mid', 'late'],
    priority: 70,
    tags: ['objetivo', 'decisão']
  },
  {
    id: 'obj-track-timer',
    kind: 'do',
    title: 'Marque o timer do próximo objetivo',
    body: 'Use o botão de abate do app para registrar o respawn. Informe o time e comece a preparar a wave 30 segundos antes.',
    why: 'Quem chega primeiro escolhe a posição da luta.',
    roles: ALL,
    phases: ['river', 'mid', 'late'],
    minLevel: 2,
    priority: 54,
    tags: ['objetivo', 'timer']
  },
  {
    id: 'obj-nen-group',
    kind: 'do',
    title: 'Nen é decisão: agrupe, warde e force',
    body: 'No Nen, fique com o time, coloque visão ao redor e force a luta com as ultimates prontas. O objetivo decide a partida.',
    why: 'Não existe split push seguro quando o Nen está no mapa.',
    roles: ALL,
    phases: ['end'],
    objective: 'nen',
    window: 'any',
    priority: 90,
    tags: ['objetivo', 'nen']
  },
  {
    id: 'obj-dont-split-nen',
    kind: 'dont',
    title: 'Não divida o time com o Nen no mapa',
    body: 'Se o Nen nasceu, todos devem estar perto. Um jogador isolado perde a luta e o objetivo.',
    why: 'O Nen pune qualquer 4v5.',
    roles: ALL,
    phases: ['end'],
    priority: 92,
    tags: ['objetivo', 'nen']
  },

  {
    id: 'threat-cc-wait',
    kind: 'do',
    title: 'Espere o CC-chave antes de entrar',
    body: 'Contra CC pesado, deixe o tanque absorver a primeira onda. Guarde Purificação para a corrente principal e entre depois.',
    why: 'Uma CC bem usada decide a luta antes do dano começar.',
    roles: ALL,
    phases: ['river', 'mid', 'late'],
    threats: ['cc'],
    priority: 80,
    tags: ['ameaça', 'luta']
  },
  {
    id: 'threat-cc-spread',
    kind: 'dont',
    title: 'Não agrupe em corredor contra CC em área',
    body: 'Espalhe o time em volta do objetivo. Se todos estão no mesmo arbusto, um CC em área pega cinco.',
    why: 'Formação importa mais que números contra controle em área.',
    roles: ALL,
    phases: ['river', 'mid', 'late'],
    threats: ['cc'],
    priority: 74,
    tags: ['ameaça', 'posição']
  },
  {
    id: 'threat-burst-respect',
    kind: 'do',
    title: 'Respeite o burst e fique perto do suporte',
    body: 'Contra assassinos e magos de burst, não ande sozinho. Mantenha o peel por perto e espere o cooldown inimigo antes de avançar.',
    why: 'Se você não vê o assassino, ele está esperando você aparecer.',
    roles: ['adc', 'mid', 'support'],
    phases: ['river', 'mid', 'late'],
    threats: ['burst'],
    priority: 84,
    tags: ['ameaça', 'posição']
  },
  {
    id: 'threat-burst-river',
    kind: 'dont',
    title: 'Não ande sozinho no rio escuro',
    body: 'Vá em dupla para colocar visão. Burst mata antes de você conseguir reagir; a melhor defesa é não ser encontrado.',
    why: 'O rio sem visão pertence a quem tem burst.',
    roles: ALL,
    phases: ['river', 'mid', 'late'],
    threats: ['burst', 'dive'],
    priority: 88,
    tags: ['ameaça', 'segurança']
  },
  {
    id: 'threat-sustain-antiheal',
    kind: 'do',
    title: 'Compre anti-cura contra sustain',
    body: 'Se o time inimigo tem duas fontes de cura ou escudo, priorize anti-cura. Concentre o burst em um alvo antes do heal entrar.',
    why: 'Sem anti-cura, a luta longa é sempre do time com sustain.',
    roles: ALL,
    phases: ['mid', 'late'],
    threats: ['sustain'],
    minLevel: 2,
    priority: 72,
    tags: ['ameaça', 'build']
  },
  {
    id: 'threat-sustain-short',
    kind: 'dont',
    title: 'Não prolongue a luta contra cura',
    body: 'Troque rápido ou recue. Lutas longas contra sustain acabam com seu time sem vida e o inimigo cheio.',
    why: 'O tempo joga contra você quando o inimigo se cura.',
    roles: ALL,
    phases: ['river', 'mid', 'late'],
    threats: ['sustain'],
    priority: 68,
    tags: ['ameaça', 'luta']
  },
  {
    id: 'threat-poke-engage',
    kind: 'do',
    title: 'Engaje rápido contra poke',
    body: 'Use a onda como escudo e feche a distância com uma iniciação limpa. Não fique trocando dano de longe com quem foi feito para isso.',
    why: 'Poke vence a espera; engage vence o poke.',
    roles: ALL,
    phases: ['lane', 'river', 'mid'],
    threats: ['poke'],
    priority: 70,
    tags: ['ameaça', 'luta']
  },
  {
    id: 'threat-poke-low-hp',
    kind: 'dont',
    title: 'Não siege objetivo com vida baixa',
    body: 'Recue e cure antes de voltar. Se você está a um hit de morrer, o poke ganha a disputa sem luta.',
    why: 'Vida baixa transforma qualquer objetivo em 4v5.',
    roles: ALL,
    phases: ['river', 'mid', 'late'],
    threats: ['poke'],
    priority: 74,
    tags: ['ameaça', 'segurança']
  },
  {
    id: 'threat-dive-peel',
    kind: 'do',
    title: 'Guarde peel para o dive',
    body: 'Contra dive, não gaste o CC no poke. Espere o assassino entrar e trave a entrada; seu carry precisa de um segundo.',
    why: 'O dive depende de matar antes do peel; negue esse segundo.',
    roles: ['support', 'top', 'jungle'],
    phases: ['river', 'mid', 'late'],
    threats: ['dive'],
    priority: 82,
    tags: ['ameaça', 'proteção']
  },
  {
    id: 'threat-tank-ignore',
    kind: 'do',
    title: 'Ignore o tanque e ache o carry',
    body: 'Contra composição tanque, não gaste todo o dano no front. Force o carry a se expor ou flanqueie com o selva.',
    why: 'Vencer a luta é matar quem causa dano, não quem absorve.',
    roles: ['mid', 'adc'],
    phases: ['mid', 'late'],
    threats: ['tank'],
    priority: 64,
    tags: ['ameaça', 'foco']
  },
  {
    id: 'threat-tank-pen',
    kind: 'dont',
    title: 'Não ignore penetração contra tanque',
    body: 'Ajuste a build: penetração de armadura contra físico e mágica contra tanques de MR. Dano bruto sem penetração não resolve.',
    why: 'Tanque existe para forçar você a gastar item certo.',
    roles: ALL,
    phases: ['mid', 'late'],
    threats: ['tank'],
    minLevel: 2,
    priority: 58,
    tags: ['ameaça', 'build']
  },

  {
    id: 'sit-behind-fight',
    kind: 'dont',
    title: 'Não dispute objetivo atrás no placar',
    body: 'Se você está atrás, não entre no 4v5. Entregue o objetivo, defenda a torre e espere o erro inimigo.',
    why: 'Lutar atrás acelera a derrota; defender alto a reduz.',
    roles: ALL,
    phases: ['river', 'mid', 'late'],
    conditions: ['behind'],
    priority: 92,
    tags: ['situação', 'decisão']
  },
  {
    id: 'sit-behind-farm',
    kind: 'do',
    title: 'Farme seguro e espere o item spike',
    body: 'Contra time à frente, pegue waves seguras e acampamentos perto da base. Force a luta só quando tiver item ou número.',
    why: 'Tempo trabalhando a favor é como você volta ao jogo sem 50/50.',
    roles: ALL,
    phases: ['mid', 'late'],
    conditions: ['behind'],
    priority: 76,
    tags: ['situação', 'farm']
  },
  {
    id: 'sit-behind-high-ground',
    kind: 'do',
    title: 'Defenda alto e puna o dive',
    body: 'Recue para as torres internas, empurre a wave para fora e espere o inimigo mergulhar. A torre é sua quinta fonte de dano.',
    why: 'Times à frente se frustram e forçam dive em base.',
    roles: ALL,
    phases: ['late', 'end'],
    conditions: ['behind'],
    minLevel: 2,
    priority: 70,
    tags: ['situação', 'defesa']
  },
  {
    id: 'sit-ahead-convert',
    kind: 'do',
    title: 'Converta vantagem em torre e objetivo',
    body: 'Com vantagem, pegue visão, empurre as três rotas e force objetivo. Não troque sua vantagem por perseguição de kill.',
    why: 'Vantagem só vira vitória quando vira torre e objetivo.',
    roles: ALL,
    phases: ['mid', 'late'],
    conditions: ['ahead'],
    priority: 72,
    tags: ['situação', 'macro']
  },
  {
    id: 'sit-ahead-dive',
    kind: 'dont',
    title: 'Não dive a base sem necessidade',
    body: 'Com vantagem, não force dive em torre da base sem minions e sem cooldown. Um erro devolve o jogo.',
    why: 'A base é o lugar onde a desvantagem inimiga mais importa.',
    roles: ALL,
    phases: ['late', 'end'],
    conditions: ['ahead'],
    priority: 78,
    tags: ['situação', 'decisão']
  },
  {
    id: 'sit-novision-facecheck',
    kind: 'dont',
    title: 'Não facechecke sem visão',
    body: 'Se o mapa está escuro, use habilidade de longo alcance ou espere o tanque entrar primeiro. Não dê o primeiro passo no escuro.',
    why: 'O primeiro hit decide a luta; quem não vê leva o hit.',
    roles: ALL,
    phases: ['lane', 'river', 'mid', 'late'],
    conditions: ['noVision'],
    priority: 94,
    tags: ['situação', 'visão']
  },
  {
    id: 'sit-novision-ward',
    kind: 'do',
    title: 'Warde as entradas do rio e do pit',
    body: 'Coloque visão no caminho de aproximação, não só no objetivo. Duas wards nas entradas valem mais que uma no pit.',
    why: 'Visão antecipada evita a pick antes da luta.',
    roles: ALL,
    phases: ['lane', 'river', 'mid'],
    conditions: ['noVision'],
    priority: 78,
    tags: ['situação', 'visão']
  },
  {
    id: 'sit-missing-advance',
    kind: 'dont',
    title: 'Não avance sem saber onde o selva está',
    body: 'Se o selva inimigo sumiu, jogue perto da torre e prepare o ping. Não inicie troca longa sem informação.',
    why: 'A gank vem justamente quando você está mais exposto.',
    roles: ALL,
    phases: ['lane', 'river'],
    conditions: ['enemyMissing'],
    priority: 86,
    tags: ['situação', 'segurança']
  },
  {
    id: 'sit-missing-ping',
    kind: 'do',
    title: 'Avise o lado provável e recue',
    body: 'Pingue o caminho provável do inimigo e ajuste sua posição. Um ping cedo salva duas rotas.',
    why: 'Informação vale mais que dano quando o inimigo está fora do mapa.',
    roles: ALL,
    phases: ['lane', 'river', 'mid'],
    conditions: ['enemyMissing'],
    priority: 82,
    tags: ['situação', 'comunicação']
  },
  {
    id: 'sit-ult-pick',
    kind: 'do',
    title: 'Com ultimate pronta, procure pick',
    body: 'Use a ultimate para pegar um alvo isolado, iniciar objetivo ou defender. Não espere a luta perfeita se a janela está aberta.',
    why: 'A ultimate é uma janela de pressão, não um troféu.',
    roles: ALL,
    phases: ['river', 'mid', 'late'],
    conditions: ['ultReady'],
    priority: 72,
    tags: ['situação', 'cooldown']
  },
  {
    id: 'sit-ally-dead-fight',
    kind: 'dont',
    title: 'Não comece luta com aliado morto',
    body: 'Com um aliado fora, recue, segure torre e farme. Force luta só se o inimigo entregar um erro claro.',
    why: '4v5 raramente é vencível contra um time atento.',
    roles: ALL,
    phases: ['river', 'mid', 'late', 'end'],
    conditions: ['allyDead'],
    priority: 94,
    tags: ['situação', 'decisão']
  },
  {
    id: 'sit-ally-dead-hold',
    kind: 'do',
    title: 'Segure a torre até o aliado voltar',
    body: 'Limpe a wave antes que ela bata na torre e não dê dive. O tempo de respawn do aliado é o objetivo.',
    why: 'Defender alto compra o tempo que falta para o 5v5.',
    roles: ALL,
    phases: ['late', 'end'],
    conditions: ['allyDead'],
    priority: 80,
    tags: ['situação', 'defesa']
  },

  {
    id: 'macro-tower',
    kind: 'do',
    title: 'Torre > kill',
    body: 'Sempre que puder escolher entre caçar um kill e derrubar uma torre, escolha a torre. O mapa aberto vale mais que o placar.',
    why: 'Torres dão ouro global e abrem a selva inimiga.',
    roles: ALL,
    phases: ['river', 'mid', 'late'],
    priority: 58,
    tags: ['macro', 'objetivo']
  },
  {
    id: 'macro-minimap',
    kind: 'do',
    title: 'Cheque o minimapa a cada 3–5 segundos',
    body: 'Antes de cada ação, olhe o minimapa. Se você não sabe onde dois inimigos estão, a ação provavelmente é arriscada.',
    why: 'A diferença entre bom e ótimo é informação, não mecânica.',
    roles: ALL,
    phases: ['lane', 'river', 'mid', 'late', 'end'],
    priority: 50,
    tags: ['macro', 'visão']
  },
  {
    id: 'macro-tilt',
    kind: 'dont',
    title: 'Não tilte no chat; mute e jogue o próximo objetivo',
    body: 'Discussão não ganha partida. Silencie o jogador, respire e foque na próxima ação possível.',
    why: 'Decisão emocional é pior que qualquer desvantagem de ouro.',
    roles: ALL,
    phases: ['lane', 'river', 'mid', 'late', 'end'],
    priority: 42,
    tags: ['mental', 'macro']
  },
  {
    id: 'macro-build',
    kind: 'do',
    title: 'Monte a build contra o time, não no automático',
    body: 'Veja se o dano inimigo é físico, mágico ou misto. Armadura contra físico, resistência mágica contra burst e anti-cura contra sustain.',
    why: 'Item certo vale mais que item caro.',
    roles: ALL,
    phases: ['lane', 'river', 'mid', 'late'],
    minLevel: 2,
    priority: 52,
    tags: ['build', 'macro']
  },
  {
    id: 'macro-flash-farm',
    kind: 'dont',
    title: 'Não use Flash para farmar ou andar',
    body: 'Guarde Flash para escapar, iniciar ou finalizar. O cooldown longo cria uma janela que o inimigo vai explorar.',
    why: 'Sem Flash, sua posição fica previsível.',
    roles: ALL,
    phases: ['lane', 'river', 'mid', 'late'],
    priority: 56,
    tags: ['cooldown', 'segurança']
  },
  {
    id: 'prep-base',
    kind: 'do',
    title: 'Saia da base com item e rota definidos',
    body: 'Compre antes de sair e siga a rota combinada. Atrasar a primeira wave por indecisão custa nível e ouro.',
    why: 'Os primeiros 30 segundos definem quem chega primeiro ao nível 2.',
    roles: ALL,
    phases: ['prep'],
    priority: 84,
    tags: ['prep', 'rota']
  },
  {
    id: 'prep-invade',
    kind: 'dont',
    title: 'Não invada sozinho no nível 1',
    body: 'Invasão só com o time e com rota de fuga. Sozinho, você entrega primeira morte e buff de graça.',
    why: 'No nível 1, números valem mais que qualquer plano individual.',
    roles: ALL,
    phases: ['prep'],
    priority: 80,
    tags: ['prep', 'segurança']
  },
  {
    id: 'prep-lane-assign',
    kind: 'do',
    title: 'Confirme sua rota antes da onda chegar',
    body: 'Selva define o lado do primeiro clear; dupla inferior não divide farm; meio e topo seguram suas rotas.',
    why: 'Rota errada no início atrasa duas lanes.',
    roles: ALL,
    phases: ['prep'],
    priority: 76,
    tags: ['prep', 'rota']
  },
  {
    id: 'adv-slow-push',
    kind: 'do',
    title: 'Slow push antes do Orochi',
    body: 'Acumule uma wave grande na lateral antes do Orochi. Ela prende o laner inimigo enquanto o seu time inicia o objetivo.',
    why: 'A wave vira um 5v4 temporário no pit.',
    roles: ALL,
    phases: ['river', 'mid'],
    objective: 'orochi',
    window: 'soon',
    minLevel: 3,
    priority: 86,
    tags: ['avançado', 'onda']
  },
  {
    id: 'adv-flash-window',
    kind: 'do',
    title: 'Jogue pelo cooldown de Flash e Purificação',
    body: 'Registre quando o inimigo usa Flash ou Purificação. Nos 90 segundos seguintes, force luta naquele alvo.',
    why: 'Cooldown de summoner spell é uma das maiores janelas do jogo.',
    roles: ALL,
    phases: ['river', 'mid', 'late'],
    minLevel: 3,
    priority: 68,
    tags: ['avançado', 'cooldown']
  },
  {
    id: 'adv-ward-denial',
    kind: 'do',
    title: 'Negue a visão inimiga do pit',
    body: 'Coloque visão de controle na entrada e remova a ward inimiga do pit antes de iniciar. Visão negada é objetivo negado.',
    why: 'O time sem visão não pode contestar com segurança.',
    roles: ALL,
    phases: ['mid', 'late'],
    minLevel: 3,
    priority: 66,
    tags: ['avançado', 'visão']
  },
  {
    id: 'adv-recall-bait',
    kind: 'do',
    title: 'Use o recall como isca',
    body: 'Finja o recall perto da wave para atrair habilidades, cancele e puna o cooldown gasto. Só faça isso com visão do selva inimigo.',
    why: 'Bait de recall transforma a pressão da wave em kill.',
    roles: ['top', 'mid', 'adc'],
    phases: ['lane'],
    minLevel: 3,
    priority: 54,
    tags: ['avançado', 'duelo']
  },
  {
    id: 'adv-aa-reset',
    kind: 'do',
    title: 'Cancele o wind-up do ataque com movimento',
    body: 'Depois que o dano do ataque registra, mova imediatamente para cancelar a animação e atacar de novo mais rápido.',
    why: 'O reset limpo adiciona 10–15% de DPS efetivo em trocas longas.',
    roles: ['adc', 'top'],
    phases: ['lane', 'river', 'mid', 'late'],
    minLevel: 3,
    priority: 56,
    tags: ['avançado', 'mecânica']
  }
]

export const KEYBOARD_HINTS = 'Espaço inicia/pausa · R reinicia · 1–5 troca o papel'

export const FACT_STRIP = [
  'Ondas de minions nascem a cada 30s.',
  'O boss do rio nasce aos 4:00 e renasce a cada 4 min.',
  'Orochi abre a janela de pressão do meio de jogo.',
  'Nen nasce aos 18:00 e decide a partida.',
  '3 stacks do boss do rio mudam a luta.'
]
