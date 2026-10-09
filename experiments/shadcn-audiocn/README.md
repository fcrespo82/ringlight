# Ringlight · shadcn + audiocn

Versão experimental independente da PWA original. Os controles usam componentes oficiais do [shadcn/ui](https://ui.shadcn.com) e knobs do [audiocn](https://audiocn.dev). O desenho da iluminação e a câmera continuam sendo renderizados pela aplicação.

## Executar

Requer Node 24 e npm. Nesta pasta:

```sh
npm ci
npm run dev
```

Abra http://localhost:5173. Se usar mise, execute os comandos com `mise x node@24.15.0 -- npm ...`.

```sh
npm test        # testes de configuração e interação em DOM
npm run build  # TypeScript, bundle e service worker
npm run preview # abre o build em localhost:4173
```

O modo offline e a instalação PWA estão disponíveis no build de produção. Câmera exige localhost ou HTTPS e permissão do navegador.

## Comparar

- shadcn: botões, cartões, seletores, switches, inputs, tooltips, alertas e painel recolhível.
- audiocn: knobs para intensidade, espessura/largura e direção do gradiente, ao lado dos valores digitáveis, sem sliders duplicados. Arraste ou use as setas; Shift permite ajuste fino e duplo clique restaura o padrão.
- Anel com formas e SVG personalizado, tela inteira e faixas laterais; gradiente forte com históricos de cores independentes.
- Câmera preservada entre modos, com prévia pequena central no modo luz inteira e controle disponível nos três modos, predefinições com miniaturas em duas colunas e nomes automáticos.
- Painel arrastável pelo cabeçalho, minimizado no mesmo componente sem fade; valores digitáveis, unidades fora do input e rótulos que restauram os padrões.
- Atalhos: F tela cheia, P painel, C câmera, G gradiente, 1/2/3 modos e +/− intensidade.

Os dados usam a chave `ringlight.lab.v1`, sem alterar os ajustes da versão original. As predefinições não são compartilhadas entre as versões. A intensidade modifica a cor renderizada, não o brilho físico da tela. Não há gravação, transmissão de vídeo nem uso do microfone.

## Organização

`src/App.tsx` compõe a interface; `src/components/ui/` contém componentes instalados pelos registros oficiais. `src/lib/model.mjs` mantém configurações e armazenamento; `src/lib/shapes.js` é uma cópia das formas e sanitização da versão original. `src/stage.css` cuida da iluminação e posição do painel. Os testes ficam em `tests/`.

Para avaliação manual, confira câmera autorizada/negada, arraste e recolhimento do painel, formas, valores editáveis, recarga com a última configuração, presets, telas pequenas e instalação/recarga offline. Os testes automatizados não substituem a avaliação visual no navegador.

O painel tem dois blocos independentes, **Configurações** e **Predefinições**. Clique no cabeçalho de cada bloco para recolher ou expandir; ambos começam abertos. Recolher preserva valores, campos em edição e câmera. A minimização geral mantém o estado dos blocos durante a sessão.

## Publicação no GitHub Pages

Repositório: https://github.com/fcrespo82/ringlight. Somente esta versão é publicada; a aplicação original permanece disponível como código-fonte. O Pages publica o build na branch `gh-pages`, na raiz. O código-fonte fica em `main`.

Para atualizar, autentique a CLI do GitHub com `gh auth login`, execute `npm test` e `npm run deploy` nesta pasta. O comando gera o build, envia os arquivos para `gh-pages`, mantém o domínio configurado e ativa o HTTPS quando o certificado do GitHub está disponível. Ele requer Node 24 e a CLI `gh`; não grava credenciais no projeto. As alterações do código-fonte devem ser commitadas e enviadas para `main` separadamente.

Na Cloudflare, use um registro **CNAME**, nome **ringlight**, destino **fcrespo82.github.io**, com proxy desativado (DNS only). Ative **Enforce HTTPS** no Pages após a emissão do certificado. O domínio personalizado precisa estar configurado no Pages; o arquivo CNAME sozinho não faz isso.

Em **Luz inteira**, ajuste **Tamanho da câmera** de 10 a 80% do menor lado da tela, com largura padrão de 32% e proporção 4:3. O ajuste é salvo automaticamente e nas predefinições, aparece nas miniaturas e permanece ao trocar de modo. Clique no rótulo ou dê duplo clique no valor para restaurar 32%.
