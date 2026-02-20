import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { IndicadorFinanceiro } from '@/types';
import { toast } from 'sonner';

export const useIndicadoresFinanceiros = () => {
  const [indicadores, setIndicadores] = useState<IndicadorFinanceiro[]>([]);
  const [loading, setLoading] = useState(true);

  const loadIndicadores = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('indicadores_financeiros')
        .select('*')
        .order('ano_referencia', { ascending: false })
        .order('mes_referencia', { ascending: false });

      if (error) throw error;

      const indicadoresFormatados = (data || []).map(ind => ({
        id: ind.id,
        mesReferencia: ind.mes_referencia,
        anoReferencia: ind.ano_referencia,
        faturamentoBruto: Number(ind.faturamento_bruto),
        faturamentoLiquido: Number(ind.faturamento_liquido),
        totalDespesas: Number(ind.total_despesas),
        custoProdutos: Number(ind.custo_produtos),
        lucroBruto: Number(ind.lucro_bruto),
        lucroLiquido: Number(ind.lucro_liquido),
        margemBruta: Number(ind.margem_bruta),
        margemLiquida: Number(ind.margem_liquida),
        totalComissoes: Number(ind.total_comissoes),
        numeroVendas: ind.numero_vendas,
        ticketMedio: Number(ind.ticket_medio),
        createdAt: ind.created_at,
        updatedAt: ind.updated_at,
      }));

      setIndicadores(indicadoresFormatados);
    } catch (error) {
      console.error('Erro ao carregar indicadores:', error);
      toast.error('Erro ao carregar indicadores financeiros');
    } finally {
      setLoading(false);
    }
  };

  const getIndicadorPorPeriodo = (mes: number, ano: number): IndicadorFinanceiro | undefined => {
    return indicadores.find(
      ind => ind.mesReferencia === mes && ind.anoReferencia === ano
    );
  };

  const recalcularIndicadores = async (mes: number, ano: number) => {
    try {
      const { error } = await supabase.rpc('recalcular_indicadores_mensais', {
        p_mes: mes,
        p_ano: ano
      });

      if (error) throw error;

      toast.success('Indicadores recalculados com sucesso!');
      await loadIndicadores();
      return true;
    } catch (error) {
      console.error('Erro ao recalcular indicadores:', error);
      toast.error('Erro ao recalcular indicadores');
      return false;
    }
  };

  useEffect(() => {
    loadIndicadores();

    const channel = supabase
      .channel('indicadores-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'indicadores_financeiros' }, () => {
        loadIndicadores();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    indicadores,
    loading,
    getIndicadorPorPeriodo,
    recalcularIndicadores,
    refreshIndicadores: loadIndicadores
  };
};
