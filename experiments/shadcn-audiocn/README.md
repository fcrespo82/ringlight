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
- Câmera preservada entre modos, predefinições com miniaturas em duas colunas e nomes automáticos.
- Painel arrastável pelo cabeçalho, minimizado no mesmo componente sem fade; valores digitáveis, unidades fora do input e rótulos que restauram os padrões.
- Atalhos: F tela cheia, P painel, C câmera, G gradiente, 1/2/3 modos e +/− intensidade.

Os dados usam a chave `ringlight.lab.v1`, sem alterar os ajustes da versão original. As predefinições não são compartilhadas entre as versões. A intensidade modifica a cor renderizada, não o brilho físico da tela. Não há gravação, transmissão de vídeo nem uso do microfone.

## Organização

`src/App.tsx` compõe a interface; `src/components/ui/` contém componentes instalados pelos registros oficiais. `src/lib/model.mjs` mantém configurações e armazenamento; `src/lib/shapes.js` é uma cópia das formas e sanitização da versão original. `src/stage.css` cuida da iluminação e posição do painel. Os testes ficam em `tests/`.

Para avaliação manual, confira câmera autorizada/negada, arraste e recolhimento do painel, formas, valores editáveis, recarga com a última configuração, presets, telas pequenas e instalação/recarga offline. Os testes automatizados não substituem a avaliação visual no navegador.

O painel tem dois blocos independentes, **Configurações** e **Predefinições**. Clique no cabeçalho de cada bloco para recolher ou expandir; ambos começam abertos. Recolher preserva valores, campos em edição e câmera. A minimização geral mantém o estado dos blocos durante a sessão.

## Publicação no GitHub Pages

O workflow `/.github/workflows/pages.yml` instala dependências, executa os testes e publica somente o build desta versão. Ele roda em pushes para `main` ou manualmente pelo GitHub Actions. No repositório, selecione **Settings → Pages → Source: GitHub Actions** e configure o domínio **ringlight.crespo.com.br**.

Na Cloudflare, use um registro **CNAME**, nome **ringlight**, destino **fcrespo82.github.io**, com proxy desativado (DNS only). Ative **Enforce HTTPS** no Pages após a emissão do certificado. O domínio personalizado também precisa ser configurado no Pages; o arquivo CNAME sozinho não faz isso em uma publicação por Actions.
