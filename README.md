# MyHealthRoutine — Protótipo interativo

Protótipo do TP3 (Geração do Protótipo) da disciplina **Introdução à Interação Humano-Computador** (DCC/ICEx/UFMG, Profa. Raquel O. Prates).

## Integrantes

| Nome | GitHub |
|---|---|
| Erick Pedrosa Barreto | [@ErickPedrosa](https://github.com/ErickPedrosa) |
| Guilherme Augusto Pires Lopes | [@guilhermeapl2](https://github.com/guilhermeapl2) |
| Gustavo Antonio Mendes Coelho | [@gusttavvin](https://github.com/gusttavvin) |
| Thiago Amorim Bastos | [@amorim027](https://github.com/amorim027) |

## Sobre

**MyHealthRoutine** apoia a gestão autônoma de medicamentos por pessoas da terceira idade. São dois modos no mesmo aplicativo:

- **Modo Idoso** — aviso no horário, reconhecimento da caixa pela cor e pelo ícone da etiqueta, confirmação pela câmera com voz e vibração, lembrete reforçado (20 min), aviso silencioso ao contato de confiança (40 min) e pedido de ajuda.
- **Modo Familiar / Cuidador** — identificação, vínculo por código rápido, painel do dia, cadastro e edição de prescrições, associação de etiquetas com leitura de teste, adesão (pontualidade, histórico e relatório) e estoque com aviso de reposição.

**Protótipo publicado:** https://gusttavvin.github.io/myhealthroutine-app/

## Como usar o protótipo

- A tela mostra o celular e, ao lado, os **Controles do protótipo**. No celular, os controles ficam no botão **Controles**, na barra de cima. Eles simulam o relógio (+5 min, +20 min, próxima dose), a falta de internet e uma leitura com falha. **Não fazem parte da interface avaliada.**
- A câmera é simulada: toque na caixa (ou na etiqueta) que a pessoa estaria aproximando da câmera.
- Senha do Modo Familiar no protótipo: **1234**. Código de vínculo: **4829**.
- Os dados são fictícios e ficam só no navegador de quem usa. O botão **Recomeçar do zero** volta ao estado inicial (terça-feira, 08:00).

## Versão funcional

**Aplicativo funcional:** https://myhealthroutine.myhealthroutine.workers.dev

O mesmo código gera uma segunda versão, com servidor e banco de dados de verdade, publicada no plano gratuito do Cloudflare:

- **Celular do idoso:** entra sem senha. Na primeira vez mostra um código de 6 números, que o familiar digita para vincular os aparelhos. A câmera lê o QR code da etiqueta e confirma a dose.
- **Familiar ou cuidador:** conta com e-mail e senha. Cadastra prescrições, imprime as etiquetas coloridas com QR code, associa cada etiqueta à caixa pela câmera e acompanha adesão e estoque.
- **Avisos:** uma tarefa agendada roda a cada minuto. Ela avisa o idoso no horário da dose, reforça o aviso aos 20 minutos e avisa o contato de confiança aos 40 minutos, por notificação no celular. No iPhone, os avisos só funcionam com o app adicionado à Tela de Início.

| Parte | Onde fica |
|---|---|
| Telas | `src/real/` (versão funcional) e `src/components/` (protótipo) |
| Servidor | `worker/` (Cloudflare Workers) |
| Banco de dados | `migrations/` (Cloudflare D1) |
| Avisos com o app fechado | `public/sw.js` |

## Rodar localmente

Protótipo:

```bash
npm install
npm run dev
```

Versão funcional:

```bash
node scripts/gerar-chaves-push.mjs   # uma vez; copie a chave privada para .dev.vars
npm run db:local
npm run dev:cf
```

Publicar a versão funcional (precisa de `npx wrangler login`): `npm run deploy:cf`.

Feito com Next.js, React e TypeScript. O protótipo é publicado de graça no GitHub Pages pela Action em `.github/workflows/deploy.yml`; a versão funcional, no Cloudflare (Workers + D1).

Projeto acadêmico. Não substitui orientação médica ou farmacêutica.
