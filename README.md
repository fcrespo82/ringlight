# Ringlight

PWA simples, sem framework, backend ou dependências de execução. Use a tela como iluminação em anel, tela inteira ou faixas laterais, ajuste cor e intensidade e salve predefinições no navegador.

## Executar

Na pasta do projeto:

```sh
python3 -m http.server 8000
```

Abra **http://localhost:8000**. Não abra o HTML diretamente com `file://`: câmera e modo offline precisam de um contexto seguro. Para acessar pelo celular ou publicar, sirva os arquivos por **HTTPS**; acessar um IP da rede por HTTP não habilita esses recursos.

## Usar e instalar

- Escolha **Anel**, **Luz inteira** ou **Laterais**, a cor e a intensidade. No anel, escolha círculo, coração, estrela, quadrado arredondado, losango, triângulo, hexágono, octógono ou flor ou importe um SVG personalizado. A iluminação acompanha o contorno e a câmera é recortada na mesma forma.
- No modo anel ou laterais, ative a câmera frontal se quiser. A prévia é espelhada, não usa microfone e não é gravada ou transmitida. Luz inteira oculta a câmera, mantendo a captura e a preferência; ao voltar para anel ou laterais, a prévia reaparece.
- O anel circular ocupa 100% do menor lado da tela, sem folga externa, mantendo a proporção circular.
- O slider **Espessura do anel** ajusta o contorno (5–70% do raio externo); em **Laterais**, ele controla a largura de cada faixa (5–40% da tela). Cada modo mantém seu próprio valor e as predefinições salvam ambos.
- **Laterais** ilumina duas faixas verticais de altura inteira, cada uma inicialmente com 20% da largura da tela. O centro permanece preto, com câmera opcional. A cor ou o gradiente é aplicado continuamente às duas faixas; os controles podem ser ocultados para liberar toda a iluminação.
- Cada seleção de cor oferece sua própria paleta de círculos, com até oito cores recentes independentes e salvas no navegador. Ao confirmar uma cor no seletor ou clicar num círculo, ela vai para o início da paleta. Sem histórico, aparecem sugestões de branco, neutro, quente médio, frio e cores vivas; elas também completam espaços enquanto há poucas cores recentes.
- Escolha **Cor única** ou **Gradiente**. No gradiente, ajuste a primeira cor, a segunda cor e a direção (0–360°). A intensidade afeta ambas as cores, tanto nas formas quanto na luz inteira.
- Oculte os controles com **✕** e reabra com **Ajustar luz**. **Tela cheia** fica no cabeçalho e aparece quando o navegador permite. Arraste qualquer parte da barra superior (fora dos botões) para mover a janela; com o título focado, use as setas (Shift move em passos maiores). O painel mantém-se dentro da tela e tem rolagem interna. Ao minimizar, o próprio painel recolhe-se ao cabeçalho na mesma posição, sem fade ou troca de componente; use a seta para expandir novamente. A preferência de movimento reduzido desativa a animação.
- Pressione **Salvar** com um nome opcional; se vazio, o aplicativo gera um nome aleatório. Cada predefinição guarda modo, forma (incluindo o SVG importado), cores, tipo de cor, direção do gradiente, intensidade e se a câmera estava ligada. O padrão é **Visual**, com dois cartões por linha. Use **Resumo** para os cartões com informações ou **Visual** para transformar o cartão inteiro em uma miniatura da iluminação salva (modo, forma, espessura/largura, cores e intensidade). A preferência de visualização fica salva. A câmera na miniatura é representada por um ícone, sem capturar imagens. Cada cartão mostra uma amostra das cores, modo, forma/espessura ou largura, intensidade, câmera e data/hora de salvamento antes de aplicar. Clique numa predefinição para aplicar (ativando ou desligando a câmera conforme salvo), ou em **✕** ao lado dela para excluir.
- Instale pelo menu do navegador quando disponível. No Safari do iPhone, use **Compartilhar → Adicionar à Tela de Início**. O suporte varia entre navegadores.

Após o primeiro acesso e a ativação do service worker, os arquivos do aplicativo ficam disponíveis offline. A câmera depende também das permissões e do suporte do aparelho.

A intensidade altera a cor renderizada, não o brilho físico da tela. O último ajuste é salvo automaticamente, incluindo o estado da câmera. Ao reabrir, a câmera é reativada se estava ligada, com a permissão do navegador. Predefinições antigas sem estado de câmera são tratadas como câmera desligada. Ajustes e predefinições ficam apenas no `localStorage` deste navegador; limpar os dados do site apaga-os. Nomes repetidos são permitidos e criam entradas independentes.

Clique no **rótulo do ajuste** para restaurar seu padrão; o tooltip informa essa ação. Também dê **duplo clique no valor** para restaurar seu padrão: intensidade 100%, espessura 29%, largura 20%, direção 90°, primeira cor branca e segunda azul-ciano. Clique no valor para digitá-lo: Enter ou sair do campo confirma, Esc cancela. Cores aceitam seis dígitos hexadecimais, com ou sem #. O ajuste restaurado fica salvo automaticamente.

## Atalhos

**F**: tela cheia; **P**: mostrar/ocultar painel; **C**: câmera; **G**: cor única/gradiente; **1/2/3**: anel/tela inteira/laterais; **+/−**: intensidade em passos de 5%. Os atalhos não atuam durante digitação nem ao usar inputs, seletores ou combinações com Ctrl/Alt/Meta.

## SVG personalizado

Use um SVG com `viewBox` e formas preenchidas (`path`, `polygon`, `rect`, `circle`, `ellipse` e grupos `g`), até 200 KB e 500 formas. O desenho é centralizado e convertido em uma silhueta; as cores originais são substituídas pela cor da luz. Imagens, textos, estilos, filtros, referências e scripts não são suportados. O arquivo é processado localmente e fica salvo nas predefinições, sem upload.

## Estrutura e manutenção

- `index.html`, `styles.css`, `shapes.js`, `app.js`, `ui.js`: interface, iluminação, câmera e armazenamento.
- `manifest.webmanifest`, `sw.js`, `icons/`: instalação e cache offline.
- `tests/`: testes de comportamento com o executor nativo do Node, sem dependências.

Não há etapa de build. Para executar os testes automatizados com Node 24: `node --test tests/*.test.cjs`. Os testes usam uma simulação do DOM e da câmera; instalação, visual e offline precisam da verificação manual abaixo. Para verificar a sintaxe: `node --check app.js` e `node --check sw.js`. Ao publicar alterações, aumente a versão de `CACHE` em `sw.js`. A atualização será usada depois que as abas da versão anterior forem fechadas e o aplicativo for reaberto.

## Verificação manual

Confira que o anel tem contorno circular iluminado, centro preto e exterior preto. Teste os dois modos e intensidades 0/50/100%; salve, aplique e exclua predefinições e recarregue. Confira câmera autorizada/negada, preservação da câmera ao passar por luz inteira e cancelamento durante a solicitação de permissão. Verifique teclado, celular em ambas as orientações, tela cheia e recarga offline após a ativação do service worker.

## Versão experimental shadcn + audiocn

Uma versão paralela com React, componentes shadcn e knobs audiocn está em [`experiments/shadcn-audiocn`](experiments/shadcn-audiocn/README.md). Ela tem build e armazenamento próprios. Para testar com Node 24:

```sh
cd experiments/shadcn-audiocn
npm ci
npm run dev
```

Abra http://localhost:5173. A versão original continua sendo executada conforme as instruções acima.

O painel tem dois blocos independentes, **Configurações** e **Predefinições**. Clique no cabeçalho de cada bloco para recolher ou expandir; ambos começam abertos. Recolher preserva valores, campos em edição e câmera. A minimização geral mantém o estado dos blocos durante a sessão.
