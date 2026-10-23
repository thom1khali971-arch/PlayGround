# Coach ao Vivo — Onmyoji Arena

Painel tático em português para consultar durante a partida: o que fazer, o que evitar, quando disputar objetivos e como adaptar o plano ao draft.

## Recursos

- Relógio de partida com iniciar/pausar, reiniciar e velocidades 1x, 2x e 4x.
- Linha de fases clicável (Preparação, Saída, Rio, Orochi, Torres, Nen).
- Timers de objetivos com alerta 45 segundos antes e ao nascer, além de marcação de abate.
- Recomendações priorizadas de "faça" e "não faça" conforme papel, fase, nível, estado do time, situações e ameaças do inimigo.
- Draft com roster de shikigami, detecção de ameaças e ajuste manual.
- Biblioteca de dicas com busca e filtros por fase e tipo.
- Checklist por papel com progresso salvo no navegador.
- Alertas visuais, sonoros e por voz (opcionais).
- Layout responsivo para desktop e celular.

## Como usar

1. Abra `index.html` por um servidor local.
2. Escolha seu papel, seu nível e o estado do time.
3. Selecione os inimigos e as ameaças do draft.
4. Clique em **Iniciar** e marque cada objetivo quando ele for abatido.
5. Acompanhe o painel **Plano de agora** e o checklist do seu papel.

Atalhos: `1` a `5` trocam o papel, `Espaço` inicia/pausa e `R` reinicia a partida.

## Executar

```bash
python3 -m http.server 3002
```

Depois acesse `http://localhost:3002`.

## Android (APK com bolha flutuante)

O APK empacota o painel e adiciona uma bolha que fica por cima do jogo, além de um painel compacto sincronizado com o app.

- **Baixar APK:** [onmyoji-live-coach-1.0.0.apk](https://github.com/thom1khali971-arch/PlayGround/releases/download/onmyoji-live-coach-android-1.0.0/onmyoji-live-coach-1.0.0.apk)
- Página da versão: [Coach ao Vivo — Android 1.0.0](https://github.com/thom1khali971-arch/PlayGround/releases/tag/onmyoji-live-coach-android-1.0.0)
- APK local gerado pelo build: `dist/onmyoji-live-coach.apk` (assinatura de debug).
- Requisitos: Android 8.0 ou superior.
- Pacote: `com.onmyoji.livecoach`.
- SHA-256: `0495e73e4616590923eac84bb19a5c400412e254123a167028af9737af6f3f90`

### Instalar

Com o aparelho conectado e depuração USB ativa:

```bash
adb install -r dist/onmyoji-live-coach.apk
```

Também é possível copiar o APK para o celular e abrir pelo gerenciador de arquivos, autorizando a instalação de fontes desconhecidas.

### Usar a bolha

1. Abra o app e toque em **Bolha**.
2. Autorize **Sobrepor outros apps** e, no Android 13+, as notificações.
3. A bolha mostra o relógio da partida, pode ser arrastada e gruda na borda.
4. Toque na bolha para abrir o painel compacto; use **Recolher** para voltar à bolha.
5. No painel, dá para iniciar/pausar, trocar papel e velocidade, marcar objetivos, alternar som/voz e abrir o app.
6. Na notificação do serviço, use **Painel** para abrir/fechar o painel e **Encerrar** para parar a bolha; tocar na notificação abre o app.

As mudanças feitas no app ou no painel são sincronizadas nos dois sentidos. O relógio continua andando com a bolha recolhida, e os alertas de objetivo (45 segundos antes e ao nascer) aparecem como aviso nativo, som e voz.

### Compilar

Requisitos: JDK 11+, Android SDK com `build-tools/35.0.0` e `platforms/android-35`.

```bash
./android/build.sh
```

O script usa `aapt2`, `javac`, `d8`, `zipalign` e `apksigner` diretamente, sem Gradle. A saída é `dist/onmyoji-live-coach.apk`. Se o keystore de debug não existir, ele é criado em `android/keystore/debug.keystore`.

Para gerar uma versão de release, troque o keystore e as senhas no script; a assinatura atual é apenas para testes e instalação local.

## Testes

```bash
node --test tests/engine.test.mjs
```

## Aviso

Projeto de fã, sem vínculo com a NetEase. Não existe API oficial em tempo real: o relógio e os abates são informados manualmente. Os tempos de objetivos servem como referência e podem mudar conforme o patch.

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
