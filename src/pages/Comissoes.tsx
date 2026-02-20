import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { Calculator, TrendingUp, Eye, Calendar as CalendarIcon, Download, FileText, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { ResponsiveLayout } from '@/components/layout/ResponsiveLayout';
import { useComissoes } from '@/hooks/useComissoes';
import { DetalhesComissaoBarbeiro } from '@/components/comissoes/DetalhesComissaoBarbeiro';
import { ComissoesChart } from '@/components/comissoes/ComissoesChart';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
export default function Comissoes() {
  const {
    canViewAllData,
    getCurrentUserId
  } = useSupabaseAuth();
  const {
    barbeiros,
    vendas,
    servicos,
    produtos,
    clientes,
    loading: dataLoading
  } = useSupabaseData();
  const {
    calcularComissoesBarbeiro,
    getComissoesBarbeiro
  } = useComissoes();
  const [dataInicio, setDataInicio] = useState<Date>(startOfDay(startOfMonth(new Date())));
  const [dataFim, setDataFim] = useState<Date>(endOfDay(new Date()));
  const [periodoSelecionado, setPeriodoSelecionado] = useState<string>('mes_atual');
  const [vendaSelecionada, setVendaSelecionada] = useState<string | null>(null);
  const [barbeiroSelecionado, setBarbeiroSelecionado] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  
  // ⚡ PAGINAÇÃO: Estado para paginar vendas
  const [paginaVendas, setPaginaVendas] = useState(1);
  const VENDAS_POR_PAGINA = 15;

  // Handler para mudança de período
  const handlePeriodoChange = (value: string) => {
    setPeriodoSelecionado(value);
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    switch (value) {
      case 'mes_atual':
        setDataInicio(startOfDay(startOfMonth(hoje)));
        setDataFim(endOfDay(hoje));
        break;
      case 'mes_passado':
        setDataInicio(startOfDay(startOfMonth(subMonths(hoje, 1))));
        setDataFim(endOfDay(endOfMonth(subMonths(hoje, 1))));
        break;
      case 'janeiro':
        setDataInicio(new Date(anoAtual, 0, 1));
        setDataFim(endOfDay(new Date(anoAtual, 0, 31)));
        break;
      case 'fevereiro':
        setDataInicio(new Date(anoAtual, 1, 1));
        setDataFim(endOfDay(new Date(anoAtual, 1, 28)));
        break;
      case 'marco':
        setDataInicio(new Date(anoAtual, 2, 1));
        setDataFim(endOfDay(new Date(anoAtual, 2, 31)));
        break;
      case 'abril':
        setDataInicio(new Date(anoAtual, 3, 1));
        setDataFim(endOfDay(new Date(anoAtual, 3, 30)));
        break;
      case 'maio':
        setDataInicio(new Date(anoAtual, 4, 1));
        setDataFim(endOfDay(new Date(anoAtual, 4, 31)));
        break;
      case 'junho':
        setDataInicio(new Date(anoAtual, 5, 1));
        setDataFim(endOfDay(new Date(anoAtual, 5, 30)));
        break;
      case 'julho':
        setDataInicio(new Date(anoAtual, 6, 1));
        setDataFim(endOfDay(new Date(anoAtual, 6, 31)));
        break;
      case 'agosto':
        setDataInicio(new Date(anoAtual, 7, 1));
        setDataFim(endOfDay(new Date(anoAtual, 7, 31)));
        break;
      case 'setembro':
        setDataInicio(new Date(anoAtual, 8, 1));
        setDataFim(endOfDay(new Date(anoAtual, 8, 30)));
        break;
      case 'outubro':
        setDataInicio(new Date(anoAtual, 9, 1));
        setDataFim(endOfDay(new Date(anoAtual, 9, 31)));
        break;
      case 'novembro':
        setDataInicio(new Date(anoAtual, 10, 1));
        setDataFim(endOfDay(new Date(anoAtual, 10, 30)));
        break;
      case 'dezembro':
        setDataInicio(new Date(anoAtual, 11, 1));
        setDataFim(endOfDay(new Date(anoAtual, 11, 31)));
        break;
      case 'custom':
      default:
        // Mantém as datas atuais para seleção manual
        break;
    }
  };

  // Filtrar vendas por usuário se não for admin
  const vendasFiltradas = useMemo(() => {
    const userId = getCurrentUserId();
    return canViewAllData() ? vendas : vendas.filter(v => v.barbeiroId === userId);
  }, [vendas, canViewAllData, getCurrentUserId]);

  // Filtrar vendas por período
  // ✅ CORREÇÃO: Filtrar por status 'pago' para consistência com gráfico
  const vendasDoPeriodo = useMemo(() => {
    return vendasFiltradas.filter(venda => {
      const dataVenda = new Date(venda.dataVenda);
      const dataInicioAjustada = startOfDay(dataInicio);
      const dataFimAjustada = endOfDay(dataFim);
      return dataVenda >= dataInicioAjustada 
        && dataVenda <= dataFimAjustada
        && venda.status === 'pago';  // ✅ FILTRO DE STATUS PARA CONSISTÊNCIA COM GRÁFICO
    });
  }, [vendasFiltradas, dataInicio, dataFim]);

  // ⚡ PAGINAÇÃO: Calcular vendas paginadas
  const paginacaoVendas = useMemo(() => {
    const total = vendasDoPeriodo.length;
    const totalPaginas = Math.ceil(total / VENDAS_POR_PAGINA);
    const indiceInicio = (paginaVendas - 1) * VENDAS_POR_PAGINA;
    const indiceFim = indiceInicio + VENDAS_POR_PAGINA;
    const vendasPaginadas = vendasDoPeriodo.slice(indiceInicio, indiceFim);
    return { total, totalPaginas, indiceInicio, indiceFim, vendasPaginadas };
  }, [vendasDoPeriodo, paginaVendas]);

  const irParaPaginaVendas = useCallback((pagina: number) => {
    setPaginaVendas(Math.max(1, Math.min(pagina, paginacaoVendas.totalPaginas)));
  }, [paginacaoVendas.totalPaginas]);

  // ⚡ PAGINAÇÃO: Reset página quando período mudar
  useEffect(() => {
    setPaginaVendas(1);
  }, [dataInicio, dataFim]);

  // ⚡ OTIMIZAÇÃO: Maps para lookup O(1)
  const barbeirosMap = useMemo(() => 
    new Map(barbeiros.map(b => [b.id, b])), 
    [barbeiros]
  );

  const clientesMap = useMemo(() => 
    new Map(clientes.map(c => [c.id, c])), 
    [clientes]
  );

  // ⚡ OTIMIZAÇÃO: Cache de histórico de comissões
  const [historicoCache, setHistoricoCache] = useState<Map<string, number>>(new Map());
  const [historicoDetalhesCache, setHistoricoDetalhesCache] = useState<Map<string, any>>(new Map());

  // Calcular comissões por barbeiro com otimização de performance
  const [comissoesPorBarbeiro, setComissoesPorBarbeiro] = useState<{
    [barbeiroId: string]: number;
  }>({});
  const [vendasComComissao, setVendasComComissao] = useState<{
    [vendaId: string]: number;
  }>({});
  const calcularComissoes = useCallback(async () => {
    if (dataLoading || vendasDoPeriodo.length === 0) {
      setComissoesPorBarbeiro({});
      setVendasComComissao({});
      setIsCalculating(false);
      return;
    }
    setIsCalculating(true);
    const startTime = performance.now();
    try {
      // ⚡ OTIMIZAÇÃO 1: Buscar TODOS os históricos de comissões de uma vez (batch query)
      const vendasIds = vendasDoPeriodo.map(v => v.id);
      const {
        data: todosHistoricos,
        error: historicoError
      } = await supabase.from('comissoes_historico').select('venda_id, item_id, valor_comissao, percentual_comissao').in('venda_id', vendasIds);
      if (historicoError) {
        console.error('Erro ao buscar históricos:', historicoError);
      }

      // ⚡ OTIMIZAÇÃO 2: Criar cache de históricos por venda
      const cacheHistorico = new Map<string, number>();
      const cacheDetalhes = new Map<string, any>();
      if (todosHistoricos) {
        // Agrupar por venda_id
        const historicosPorVenda = todosHistoricos.reduce((acc, h) => {
          if (!acc[h.venda_id]) acc[h.venda_id] = [];
          acc[h.venda_id].push(h);
          return acc;
        }, {} as {
          [vendaId: string]: typeof todosHistoricos;
        });

        // Calcular total por venda
        Object.entries(historicosPorVenda).forEach(([vendaId, historicos]) => {
          const total = historicos.reduce((sum, h) => sum + Number(h.valor_comissao), 0);
          cacheHistorico.set(vendaId, total);

          // Cache de detalhes por item
          historicos.forEach(h => {
            const key = `${vendaId}_${h.item_id}`;
            cacheDetalhes.set(key, {
              valor_comissao: Number(h.valor_comissao),
              percentual_comissao: Number(h.percentual_comissao)
            });
          });
        });
      }
      setHistoricoCache(cacheHistorico);
      setHistoricoDetalhesCache(cacheDetalhes);

      // ⚡ OTIMIZAÇÃO 3: Buscar configurações de comissão de todos barbeiros de uma vez
      const barbeirosIds = [...new Set(vendasDoPeriodo.map(v => v.barbeiroId))];
      const {
        data: configsComissao
      } = await supabase.from('configuracoes_comissao').select('*').in('barbeiro_id', barbeirosIds);

      // Cache de configurações por barbeiro
      const configsPorBarbeiro = new Map<string, any[]>();
      if (configsComissao) {
        configsComissao.forEach(config => {
          if (!configsPorBarbeiro.has(config.barbeiro_id)) {
            configsPorBarbeiro.set(config.barbeiro_id, []);
          }
          configsPorBarbeiro.get(config.barbeiro_id)!.push(config);
        });
      }

      // ⚡ OTIMIZAÇÃO 4: Calcular comissões usando dados em cache (sem queries adicionais)
      const comissoes: {
        [barbeiroId: string]: number;
      } = {};
      const vendasComissao: {
        [vendaId: string]: number;
      } = {};

      // Agrupar vendas por barbeiro
      const vendasPorBarbeiro = vendasDoPeriodo.reduce((acc, venda) => {
        if (!acc[venda.barbeiroId]) acc[venda.barbeiroId] = [];
        acc[venda.barbeiroId].push(venda);
        return acc;
      }, {} as {
        [barbeiroId: string]: typeof vendasDoPeriodo;
      });

      // Processar cada barbeiro
      Object.entries(vendasPorBarbeiro).forEach(([barbeiroId, vendasDoBarbeiro]) => {
        const barbeiro = barbeiros.find(b => b.id === barbeiroId);
        if (!barbeiro) return;
        const configs = configsPorBarbeiro.get(barbeiroId) || [];
        let totalBarbeiro = 0;
        vendasDoBarbeiro.forEach(venda => {
          // Usar histórico se disponível
          const comissaoHistorica = cacheHistorico.get(venda.id);
          if (comissaoHistorica !== undefined && comissaoHistorica > 0) {
            vendasComissao[venda.id] = comissaoHistorica;
            totalBarbeiro += comissaoHistorica;
          } else {
            // Calcular usando configurações atuais (síncrono, sem await)
            let comissaoVenda = 0;
            venda.itens.forEach(item => {
              const comissaoPadrao = item.tipo === 'servico' ? barbeiro.comissaoServicos : barbeiro.comissaoProdutos;

              // Buscar configuração específica
              const configEspecifica = configs.find(c => c.tipo === item.tipo && (item.tipo === 'servico' ? c.servico_id === item.itemId : c.produto_id === item.itemId));
              const percentual = configEspecifica ? configEspecifica.percentual : comissaoPadrao;
              comissaoVenda += item.subtotal * percentual / 100;
            });
            vendasComissao[venda.id] = comissaoVenda;
            totalBarbeiro += comissaoVenda;
          }
        });
        comissoes[barbeiroId] = totalBarbeiro;
      });
      setComissoesPorBarbeiro(comissoes);
      setVendasComComissao(vendasComissao);
      const endTime = performance.now();
      console.log(`⚡ Cálculo otimizado concluído em ${(endTime - startTime).toFixed(0)}ms`);
    } catch (error) {
      console.error('Erro ao calcular comissões:', error);
    } finally {
      setIsCalculating(false);
    }
  }, [vendasDoPeriodo, barbeiros, dataLoading]);
  useEffect(() => {
    calcularComissoes();
  }, [calcularComissoes]);

  // Calcular total de comissões
  const totalComissoes = Object.values(comissoesPorBarbeiro).reduce((total, valor) => total + valor, 0);

  // ⚡ OTIMIZAÇÃO: Detalhes da venda usando cache (sem queries adicionais)
  const [detalheVendaSelecionada, setDetalheVendaSelecionada] = useState<any>(null);
  useEffect(() => {
    const calcularDetalhes = async () => {
      if (!vendaSelecionada) {
        setDetalheVendaSelecionada(null);
        return;
      }
      const venda = vendasDoPeriodo.find(v => v.id === vendaSelecionada);
      if (!venda) {
        setDetalheVendaSelecionada(null);
        return;
      }
      const barbeiro = barbeiros.find(b => b.id === venda.barbeiroId);
      if (!barbeiro) {
        setDetalheVendaSelecionada(null);
        return;
      }

      // ⚡ Buscar configurações de comissão deste barbeiro (uma query apenas)
      const {
        data: configs
      } = await supabase.from('configuracoes_comissao').select('*').eq('barbeiro_id', venda.barbeiroId);

      // ⚡ Usar cache de histórico já carregado
      const detalhes = venda.itens.map(item => {
        const comissaoPadrao = item.tipo === 'servico' ? barbeiro.comissaoServicos : barbeiro.comissaoProdutos;

        // Verificar cache de histórico
        const key = `${venda.id}_${item.itemId}`;
        const historicoCache = historicoDetalhesCache.get(key);
        let comissaoItem: number;
        let percentualUsado: number;
        if (historicoCache) {
          // Usar dados históricos do cache
          comissaoItem = historicoCache.valor_comissao;
          percentualUsado = historicoCache.percentual_comissao;
        } else {
          // Buscar configuração específica
          const configEspecifica = configs?.find(c => c.tipo === item.tipo && (item.tipo === 'servico' ? c.servico_id === item.itemId : c.produto_id === item.itemId));
          percentualUsado = configEspecifica ? configEspecifica.percentual : comissaoPadrao;
          comissaoItem = item.subtotal * percentualUsado / 100;
        }
        return {
          ...item,
          percentual: percentualUsado,
          comissaoItem
        };
      });
      const comissaoTotal = detalhes.reduce((total, item) => total + item.comissaoItem, 0);
      setDetalheVendaSelecionada({
        venda,
        barbeiro,
        detalhes,
        comissaoTotal
      });
    };
    calcularDetalhes();
  }, [vendaSelecionada, vendasDoPeriodo, barbeiros, historicoDetalhesCache]);
  const exportarRelatorioPDF = async () => {
    const element = document.getElementById('relatorio-comissoes');
    if (!element) return;
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = canvas.height * imgWidth / canvas.width;
      let position = 0;

      // Cabeçalho do PDF
      pdf.setFontSize(16);
      pdf.text('Relatório de Comissões', 20, 20);
      pdf.setFontSize(12);
      pdf.text(`Período: ${format(dataInicio, 'dd/MM/yyyy')} a ${format(dataFim, 'dd/MM/yyyy')}`, 20, 30);
      pdf.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 20, 40);
      position = 50;

      // Resumo
      pdf.setFontSize(14);
      pdf.text('RESUMO GERAL', 20, position);
      position += 10;
      pdf.setFontSize(10);
      pdf.text(`Total de Comissões: R$ ${totalComissoes.toFixed(2)}`, 20, position);
      position += 6;
      pdf.text(`Total de Vendas: ${vendasDoPeriodo.length}`, 20, position);
      position += 6;
      pdf.text(`Barbeiros Ativos: ${Object.keys(comissoesPorBarbeiro).length}`, 20, position);
      position += 15;

      // Comissões por barbeiro
      pdf.setFontSize(14);
      pdf.text('COMISSÕES POR BARBEIRO', 20, position);
      position += 10;
      Object.entries(comissoesPorBarbeiro).forEach(([barbeiroId, comissao]) => {
        const barbeiro = barbeiros.find(b => b.id === barbeiroId);
        if (barbeiro && position < pageHeight - 20) {
          pdf.setFontSize(10);
          pdf.text(`${barbeiro.nome}: R$ ${comissao.toFixed(2)} (${(comissao / totalComissoes * 100).toFixed(1)}%)`, 20, position);
          position += 6;
        } else if (position >= pageHeight - 20) {
          pdf.addPage();
          position = 20;
          pdf.setFontSize(10);
          if (barbeiro) {
            pdf.text(`${barbeiro.nome}: R$ ${comissao.toFixed(2)} (${(comissao / totalComissoes * 100).toFixed(1)}%)`, 20, position);
            position += 6;
          }
        }
      });

      // Detalhes das vendas
      if (vendasDoPeriodo.length > 0) {
        position += 10;
        pdf.setFontSize(14);
        pdf.text('DETALHES DAS VENDAS', 20, position);
        position += 10;
        vendasDoPeriodo.forEach(venda => {
          const barbeiro = barbeiros.find(b => b.id === venda.barbeiroId);
          if (!barbeiro) return;

          // Para o PDF, usar comissão padrão para simplificar
          const comissaoVenda = venda.itens.reduce((total, item) => {
            const percentual = item.tipo === 'servico' ? barbeiro.comissaoServicos : barbeiro.comissaoProdutos;
            return total + item.subtotal * percentual / 100;
          }, 0);
          if (position > pageHeight - 30) {
            pdf.addPage();
            position = 20;
          }
          pdf.setFontSize(10);
          pdf.text(`Venda #${venda.id.slice(-8)} - ${barbeiro.nome}`, 20, position);
          position += 5;
          pdf.text(`Data: ${format(new Date(venda.dataVenda), 'dd/MM/yyyy HH:mm')} | Total: R$ ${venda.total.toFixed(2)} | Comissão: R$ ${comissaoVenda.toFixed(2)}`, 20, position);
          position += 8;
        });
      }

      // Salvar PDF
      pdf.save(`relatorio-comissoes-${format(dataInicio, 'dd-MM-yyyy')}-a-${format(dataFim, 'dd-MM-yyyy')}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar relatório PDF. Tente novamente.');
    }
  };
  return <ResponsiveLayout>
      <div id="relatorio-comissoes" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              Comissões {isCalculating && <span className="text-sm text-muted-foreground">(Carregando...)</span>}
            </h1>
            <p className="text-muted-foreground">Acompanhe as comissões dos barbeiros</p>
          </div>
          <div className="flex flex-wrap gap-2">
            
            
            {/* Seletor de Período */}
            <Select value={periodoSelecionado} onValueChange={handlePeriodoChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Selecionar período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">📅 Personalizado</SelectItem>
                <SelectItem value="mes_atual">📆 Mês Atual</SelectItem>
                <SelectItem value="mes_passado">⏪ Mês Passado</SelectItem>
                <Separator className="my-1" />
                <SelectItem value="janeiro">Janeiro</SelectItem>
                <SelectItem value="fevereiro">Fevereiro</SelectItem>
                <SelectItem value="marco">Março</SelectItem>
                <SelectItem value="abril">Abril</SelectItem>
                <SelectItem value="maio">Maio</SelectItem>
                <SelectItem value="junho">Junho</SelectItem>
                <SelectItem value="julho">Julho</SelectItem>
                <SelectItem value="agosto">Agosto</SelectItem>
                <SelectItem value="setembro">Setembro</SelectItem>
                <SelectItem value="outubro">Outubro</SelectItem>
                <SelectItem value="novembro">Novembro</SelectItem>
                <SelectItem value="dezembro">Dezembro</SelectItem>
              </SelectContent>
            </Select>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:w-[180px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataInicio ? format(dataInicio, "dd/MM/yyyy", {
                  locale: ptBR
                }) : "Data início"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataInicio} onSelect={date => {
                if (date) {
                  setDataInicio(date);
                  setPeriodoSelecionado('custom');
                }
              }} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:w-[180px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataFim ? format(dataFim, "dd/MM/yyyy", {
                  locale: ptBR
                }) : "Data fim"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataFim} onSelect={date => {
                if (date) {
                  setDataFim(date);
                  setPeriodoSelecionado('custom');
                }
              }} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            
            <Button onClick={exportarRelatorioPDF} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
          </div>
        </div>

        {/* Resumo das Comissões */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Comissões</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">R$ {totalComissoes.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                {format(dataInicio, 'dd/MM', {
                locale: ptBR
              })} a {format(dataFim, 'dd/MM', {
                locale: ptBR
              })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vendas do Mês</CardTitle>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{vendasDoPeriodo.length}</div>
              <p className="text-xs text-muted-foreground">
                Total de vendas realizadas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Barbeiros Ativos</CardTitle>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Object.keys(comissoesPorBarbeiro).length}</div>
              <p className="text-xs text-muted-foreground">
                Com vendas no período
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico de Evolução Mensal - Respeita o período selecionado */}
        <ComissoesChart barbeiros={barbeiros} dataInicio={dataInicio} dataFim={dataFim} />

        {/* Comissões por Barbeiro */}
        <Card>
          <CardHeader>
            <CardTitle>Comissões por Barbeiro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(comissoesPorBarbeiro).map(([barbeiroId, comissao]) => {
              const barbeiro = barbeiros.find(b => b.id === barbeiroId);
              if (!barbeiro) return null;
              const vendasDoBarbeiro = vendasDoPeriodo.filter(v => v.barbeiroId === barbeiroId);
              return <div key={barbeiroId} className="flex justify-between items-center p-4 bg-muted rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{barbeiro.nome}</div>
                      <div className="text-sm text-muted-foreground">
                        {vendasDoBarbeiro.length} vendas
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">R$ {comissao.toFixed(2)}</div>
                        <Badge variant="secondary">{(comissao / totalComissoes * 100).toFixed(1)}%</Badge>
                      </div>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => setBarbeiroSelecionado(barbeiroId)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Detalhes das Comissões - {barbeiro.nome}</DialogTitle>
                          </DialogHeader>
                          <DetalhesComissaoBarbeiro barbeiroId={barbeiroId} barbeiro={barbeiro} vendasDoPeriodo={vendasDoBarbeiro} servicos={servicos} produtos={produtos} clientes={clientes} />
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>;
            })}

              {Object.keys(comissoesPorBarbeiro).length === 0 && <div className="text-center py-8 text-muted-foreground">
                  Nenhuma comissão registrada no período selecionado
                </div>}
            </div>
          </CardContent>
        </Card>

        {/* Vendas do Mês - COM PAGINAÇÃO */}
        <Card>
          <CardHeader>
            <CardTitle>Detalhes das Vendas</CardTitle>
            <CardDescription>
              {paginacaoVendas.total > 0 
                ? `Mostrando ${paginacaoVendas.indiceInicio + 1} a ${Math.min(paginacaoVendas.indiceFim, paginacaoVendas.total)} de ${paginacaoVendas.total} vendas`
                : 'Nenhuma venda no período'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {paginacaoVendas.vendasPaginadas.map(venda => {
                // ⚡ OTIMIZAÇÃO: Usar Maps para lookup O(1) em vez de find() O(n)
                const barbeiro = barbeirosMap.get(venda.barbeiroId);
                const cliente = clientesMap.get(venda.clienteId);
                if (!barbeiro) return null;

                const comissaoVenda = vendasComComissao[venda.id] || 0;
                return <div key={venda.id} className="flex justify-between items-center p-3 bg-muted rounded">
                      <div className="flex-1">
                        <div className="font-medium">Venda #{venda.id.slice(-8)}</div>
                        <div className="text-sm text-muted-foreground">
                          {barbeiro.nome} • {cliente?.nome || 'Cliente não encontrado'} • {format(new Date(venda.dataVenda), 'dd/MM/yyyy HH:mm')}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {venda.itens.length} itens • Total: R$ {venda.total.toFixed(2)}
                          {venda.desconto && venda.desconto > 0 && <span className="text-red-600"> • Desconto: R$ {venda.desconto.toFixed(2)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-sm text-green-600 font-medium">R$ {comissaoVenda.toFixed(2)}</div>
                          <div className="text-xs text-muted-foreground">comissão</div>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => setVendaSelecionada(venda.id)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Detalhes da Comissão - Venda #{venda.id.slice(-8)}</DialogTitle>
                            </DialogHeader>
                            {detalheVendaSelecionada && <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <strong>Barbeiro:</strong> {detalheVendaSelecionada.barbeiro.nome}
                                  </div>
                                  <div>
                                    <strong>Data:</strong> {format(new Date(detalheVendaSelecionada.venda.dataVenda), 'dd/MM/yyyy HH:mm')}
                                  </div>
                                  <div>
                                    <strong>Total da Venda:</strong> R$ {detalheVendaSelecionada.venda.total.toFixed(2)}
                                  </div>
                                  {detalheVendaSelecionada.venda.desconto && detalheVendaSelecionada.venda.desconto > 0 && <div>
                                      <strong>Desconto Aplicado:</strong> <span className="text-red-600">R$ {detalheVendaSelecionada.venda.desconto.toFixed(2)}</span>
                                    </div>}
                                  <div>
                                    <strong>Comissão Total:</strong> <span className="text-green-600 font-medium">R$ {detalheVendaSelecionada.comissaoTotal.toFixed(2)}</span>
                                  </div>
                                </div>

                                <Separator />

                                <div>
                                  <h4 className="font-medium mb-3">Memória de Cálculo</h4>
                                  <div className="space-y-2">
                                    {detalheVendaSelecionada.detalhes.map((item, index) => {
                                const valorOriginal = item.precoOriginal || item.preco;
                                const valorVendido = item.subtotal / item.quantidade;
                                const descontoConcedido = (valorOriginal - valorVendido) * item.quantidade;
                                return <div key={index} className="p-3 bg-muted rounded space-y-2">
                                          <div className="flex justify-between items-center">
                                            <div className="font-medium">{item.nome}</div>
                                            <div className="text-green-600 text-sm font-medium">
                                              {item.percentual}% = R$ {item.comissaoItem.toFixed(2)}
                                            </div>
                                          </div>
                                          
                                          <div className="grid grid-cols-4 gap-2 text-xs">
                                            <div className="text-center">
                                              <div className="font-medium text-muted-foreground">Qtd</div>
                                              <div>{item.quantidade}</div>
                                            </div>
                                            <div className="text-center">
                                              <div className="font-medium text-muted-foreground">Valor Original</div>
                                              <div>R$ {valorOriginal.toFixed(2)}</div>
                                            </div>
                                            <div className="text-center">
                                              <div className="font-medium text-muted-foreground">Desconto</div>
                                              <div className="text-red-600">
                                                {descontoConcedido > 0.01 ? `-R$ ${descontoConcedido.toFixed(2)}` : '-'}
                                              </div>
                                            </div>
                                            <div className="text-center">
                                              <div className="font-medium text-muted-foreground">Valor Vendido</div>
                                              <div className="font-medium">R$ {item.subtotal.toFixed(2)}</div>
                                            </div>
                                          </div>
                                        </div>;
                              })}
                                  </div>
                                </div>
                              </div>}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>;
              })}

              {paginacaoVendas.total === 0 && <div className="text-center py-8 text-muted-foreground">
                  Nenhuma venda registrada no período selecionado
                </div>}
            </div>

            {/* Controles de Paginação */}
            {paginacaoVendas.totalPaginas > 1 && (
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Página {paginaVendas} de {paginacaoVendas.totalPaginas}
                </div>
                
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => irParaPaginaVendas(1)} disabled={paginaVendas === 1}>
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => irParaPaginaVendas(paginaVendas - 1)} disabled={paginaVendas === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => irParaPaginaVendas(paginaVendas + 1)} disabled={paginaVendas === paginacaoVendas.totalPaginas}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => irParaPaginaVendas(paginacaoVendas.totalPaginas)} disabled={paginaVendas === paginacaoVendas.totalPaginas}>
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>;
}