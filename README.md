# Interface web NEXUS CLAW Builder AI

## Início
Abra `index-5.html` em um navegador atual. Para uso local, pode ser usado um servidor web estático simples.

## Incluído
- Painel responsivo com seis áreas
- Importação do contexto do projeto
- Ciclo de desenvolvimento simulado com iniciar/pausar/parar
- 20 casos de teste de jogo em duas fases
- Registros ao vivo com filtro e exportação TXT
- Modos do agente: planejamento, codificação, análise e reparo
- Teste opcional de conexão com Ollama `/api/tags`
- Configurações locais do navegador
- Avisos de segurança para backend/sandbox

## Limites importantes
Esta versão é um protótipo de frontend. Arquivos do projeto, Git, builds, instalação de APK, automação real de gameplay, métricas do sistema e reparos autônomos NÃO estão implementados. Os botões correspondentes registram a chamada ou mostram um aviso, em vez de executar ações externas sem aviso.

## Próximo passo de arquitetura
Um backend local (por exemplo, Python/FastAPI) deve ser conectado ao frontend por meio de endpoints bem definidos. Operações de arquivo e execução de código pertencem a uma sandbox/cópia de trabalho limitada; Git push, instalação de APK e outras ações externas ou irreversíveis exigem aprovação explícita.

---

Criado por Thom
