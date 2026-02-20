
# Ajuste: Valor da Venda nos Relatorios Refletir o Valor Efetivamente Pago

## Problema
Quando uma venda de R$29 tem apenas R$28 pagos (com R$1 de saldo devedor), os relatorios exibem R$29. O correto e mostrar R$28 enquanto a divida estiver pendente, e so mostrar R$29 apos a quitacao.

## Solucao

### Abordagem: Mapa de Saldo Devedor por Venda

Criar um mapa `vendaId -> saldoDevedor` a partir dos registros de `contas_receber` com status `pendente`. Em todos os calculos de faturamento, subtrair o saldo devedor pendente do `venda.total`.

### Arquivo 1: `src/pages/Relatorios.tsx`

1. **Criar mapa de saldos pendentes** (novo `useMemo` apos carregar `contasPendentes`):
   - Gerar `Map<string, number>` mapeando `vendaId -> saldoDevedor` para todas as contas com status `pendente`
   - Criar funcao helper `getValorEfetivo(venda)` que retorna `venda.total - saldoPendente`

2. **Atualizar `faturamentoTotal`** (linha ~414):
   - Trocar `venda.total` por `getValorEfetivo(venda)`

3. **Atualizar `faturamentoMesAnterior`** (linha ~422):
   - Trocar `venda.total` por `getValorEfetivo(venda)`

4. **Atualizar `vendasPorBarbeiro`** (linha ~562):
   - Trocar `v.total` por `getValorEfetivo(v)`

5. **Atualizar `vendasPorMes`** (linhas ~612-613):
   - Trocar `venda.total` por `getValorEfetivo(venda)` no ramo sem filtro de mix

6. **Atualizar `vendasPorMesYTD`** (linha ~684):
   - Trocar `venda.total` por `getValorEfetivo(venda)` no ramo sem filtro de itens

7. **Atualizar `faturamentoFiltroPorMix`** (linha ~392):
   - Trocar `venda.total` por `getValorEfetivo(venda)` quando so filtro de cliente ativo

8. **Atualizar `custoProdutosPeriodo`, `totalComissoesPeriodo`** e demais calculos que usam `venda.total`

### Arquivo 2: `src/utils/vendaValores.ts`

Adicionar parametro opcional `saldoDevedor` a funcao `getVendaValores`:
- Quando informado, subtrair do valor liquido
- Isso faz com que o Detalhamento das Vendas tambem mostre o valor efetivamente pago

### Arquivo 3: `src/components/relatorios/DetalhamentoVendasPaginado.tsx`

- Receber o mapa de saldos pendentes como prop
- Passar o `saldoDevedor` para `getVendaValores` ao renderizar cada linha
- Opcionalmente, exibir um indicador visual (icone/badge) nas vendas com saldo pendente

### Impacto
- Todos os KPIs, graficos e tabelas refletirao o valor realmente recebido
- Ao quitar a divida no painel de Inadimplencia, o valor volta automaticamente ao total original (pois o registro em `contas_receber` muda para `quitado` e sai do mapa)
- Comissoes e custos de produtos continuam baseados nos itens vendidos (nao mudam com inadimplencia) -- apenas o faturamento muda
