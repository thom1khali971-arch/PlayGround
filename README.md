# Gás Solidário

Uma campanha de doação de gás de cozinha feita para rodar no navegador. O site reúne um mural de pedidos, contato direto por WhatsApp, cartaz A4 e panfleto A5 prontos para imprimir.

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://omgithub.com).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://omgithub.com/thom1khali971-arch/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/thom1khali971-arch/PlayGround)

- 🎮 [Open the project](https://omgithub.com/thom1khali971-arch/PlayGround).
- ✨ [Remix this project](https://omgithub.com/?remix=thom1khali971-arch%2FPlayGround).
- 💻 [Explore the source](https://github.com/thom1khali971-arch/PlayGround).
- 🛠️ [Check build runs](https://github.com/thom1khali971-arch/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/thom1khali971-arch/PlayGround/issues).
- 👤 [Explore the creator's projects](https://omgithub.com/thom1khali971-arch).
- 🌍 [Create with OMGithub](https://omgithub.com).
<!-- omgithub:readme:end -->

## O que tem

- **Mural de pedidos** com filtros por urgência, busca por bairro/cidade, marcação de pedido atendido e remoção.
- **Contato direto no WhatsApp**: cada pedido gera uma mensagem pronta para a pessoa doadora falar com a família.
- **Pedido próprio**: formulário com validação, consentimento e link compartilhável que funciona em outros aparelhos.
- **Materiais de campanha**: cartaz A4 e panfleto A5 com QR Code e telefone atualizados a partir da configuração.
- **Configuração local**: nome da campanha, cidade, WhatsApp e uma chave PIX opcional.
- **Acessibilidade e responsividade**: navegação por teclado, textos alternativos, foco visível e layout para celular.
- **Sem dependências externas em tempo de execução**: fontes e biblioteca de QR Code estão no repositório, então o site funciona offline (o WhatsApp abre quando houver conexão).

## Como rodar

Não há etapa de build. Basta servir a pasta como arquivos estáticos:

```bash
python3 -m http.server 3002 --bind 127.0.0.1
```

Abra <http://127.0.0.1:3002/>.

Também é possível usar `npx serve .` ou qualquer servidor estático. Evite abrir o `index.html` diretamente pelo protocolo `file://`, pois alguns navegadores bloqueiam o carregamento de fontes e o compartilhamento por link.

## Configurar a campanha

1. Clique em **Configurar campanha** no rodapé.
2. Informe o nome, a cidade, o WhatsApp com DDI e DDD (ex.: `5511999999999`) e, se quiser, uma chave PIX.
3. Salve. O cabeçalho, o rodapé, os botões de WhatsApp, o QR Code e os dois materiais impressos são atualizados na hora.

As configurações ficam no `localStorage` deste navegador. Para uma campanha real, cada pessoa que for administrar o site deve configurar o próprio aparelho — ou você pode trocar os valores padrão em `DEFAULT_CONFIG`, no início de `app.js`.

## Publicar e compartilhar um pedido

O formulário **Pedir um botijão** salva o pedido localmente e gera um link com os dados codificados no endereço. Quem receber o link consegue abrir o pedido em outro celular e chamar a família no WhatsApp, mesmo sem um servidor.

Ao publicar, aparecem duas opções:

- **Copiar** o link para enviar em grupos e conversas.
- **Ver meu pedido na lista** para conferir como ele aparece no mural.

O pedido pode ser marcado como atendido ou apagado pelo cartão. Apagar o pedido local **não invalida** os links já compartilhados: eles carregam uma cópia dos dados no próprio endereço.

## Imprimir ou salvar em PDF

Na seção **Materiais da campanha**, escolha **Cartaz A4** ou **Panfleto A5** e clique em **Imprimir cartaz/panfleto** (ou **Salvar em PDF**). O botão abre a caixa de impressão do navegador.

Para um resultado fiel:

- Ative **Gráficos de segundo plano / Background graphics**.
- Defina as margens como **Nenhuma** e use o tamanho de papel indicado (A4 ou A5).
- Confira a prévia antes de imprimir. O layout já reserva as medidas corretas de cada folha.

## Dados e privacidade

Este é um projeto estático, sem backend e sem cadastro. Pedidos, configurações e o estado de “atendido” ficam no armazenamento local do navegador (`localStorage`). O link compartilhado usa o hash da URL, então os dados viajam no próprio endereço.

Em um card público, o telefone aparece mascarado. O número completo só é usado no link do WhatsApp quando alguém clica em **Ajudar**. Ainda assim, trate links compartilhados como informação pública e combine a entrega em local seguro.

Os pedidos de exemplo (`EX01`–`EX04`) usam nomes e números fictícios. Ao clicar em ajudar em um deles, o site mostra um aviso em vez de abrir o WhatsApp.

## Estrutura

```text
index.html          Página, materiais impressos, diálogos e ícones SVG
styles.css          Design responsivo e regras de impressão A4/A5
app.js              Pedidos, WhatsApp, links, QR Code e configuração
assets/fonts/       Archivo Black, Inter e Caveat (licenças incluídas)
vendor/             qrcode-generator e licença MIT
CREDITS.md          Atribuições e licenças
```

## Créditos

Tipografia e biblioteca de QR Code têm licenças abertas. Consulte [CREDITS.md](CREDITS.md) para os autores, licenças e caminhos dos textos completos.
