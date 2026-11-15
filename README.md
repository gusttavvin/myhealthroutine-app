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

## Rodar localmente

```bash
npm install
npm run dev
```

Feito com Next.js, React e TypeScript. Os dados ficam no navegador (sem servidor); o site é publicado de graça no GitHub Pages pela Action em `.github/workflows/deploy.yml`.

Projeto acadêmico. Não substitui orientação médica ou farmacêutica.
