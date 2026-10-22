## Ciclo de vida de processos

- Execute servidores e watchers de longa duração em uma sessão persistente, como tmux.
- Não os coloque em segundo plano em comandos limitados sem desanexação e limpeza explícitas.
- Após um timeout, inspecione o processo e o endpoint antes de tentar novamente ou declarar falha.

## Navegador Linux e captura WebGPU

- Use o executável `playwright-cli` pré-instalado do Actions ou SSH.
- Use seu Chromium com interface, display Xvfb persistente e configuração SwiftShader.
- Execute `playwright-cli open http://localhost:3002` para o servidor de desenvolvimento Pascal.
- Carregue uma cena salva. Aguarde a geometria real e o renderizador WebGPU ativo.
- Execute `playwright-cli screenshot --filename=screenshots/linux.png` após criar o diretório de saída.
- Inspecione a imagem. Rejeite telas de carregamento, grades vazias e canvases em branco.
- Informe o SwiftShader como renderização por software em CPU. Não afirme aceleração de GPU por hardware.
- Inspecione `$HOME/.local/share/omgithub-playwright/linux.json` para as configurações de lançamento.
- Use `playwright-cli --help` para comandos e sessões nomeadas. Passe a configuração somente para `open`.
