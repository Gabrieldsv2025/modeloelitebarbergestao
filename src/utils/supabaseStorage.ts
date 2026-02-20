import { supabase } from '@/integrations/supabase/client';
import { 
  Cliente, 
  Barbeiro, 
  Servico, 
  Produto, 
  Fornecedor,
  MovimentacaoEstoque,
  Venda, 
  ItemVenda,
  HistoricoAtendimento,
  ConfiguracaoComissao 
} from '@/types';

// Validação e sanitização de valores numéricos
const MAX_NUMERIC_VALUE = 99999999.99; // Limite do NUMERIC(10,2)
const MIN_NUMERIC_VALUE = 0;

const sanitizeNumericValue = (value: number | undefined | null, allowNull = false): number | null => {
  // Se valor é undefined/null e null é permitido, retornar null
  if ((value === undefined || value === null) && allowNull) {
    return null;
  }
  
  // Converter para número
  const num = Number(value);
  
  // Validar se é número válido
  if (isNaN(num) || !isFinite(num)) {
    console.warn('⚠️ Valor numérico inválido detectado:', value, '→ convertido para 0');
    return 0;
  }
  
  // Aplicar limites min/max
  if (num > MAX_NUMERIC_VALUE) {
    console.warn('⚠️ Valor excede limite máximo:', num, '→ limitado a', MAX_NUMERIC_VALUE);
    return MAX_NUMERIC_VALUE;
  }
  
  if (num < MIN_NUMERIC_VALUE) {
    console.warn('⚠️ Valor abaixo do mínimo:', num, '→ ajustado para', MIN_NUMERIC_VALUE);
    return MIN_NUMERIC_VALUE;
  }
  
  // Arredondar para 2 casas decimais
  return Math.round(num * 100) / 100;
};

const validateVendaData = (venda: Venda): void => {
  // Validar total
  if (!venda.total || venda.total <= 0) {
    throw new Error('Total da venda deve ser maior que zero');
  }
  
  if (venda.total > MAX_NUMERIC_VALUE) {
    throw new Error(`Total da venda (R$ ${venda.total.toFixed(2)}) excede o limite máximo (R$ ${MAX_NUMERIC_VALUE.toFixed(2)})`);
  }
  
  // Validar itens
  if (!venda.itens || venda.itens.length === 0) {
    throw new Error('Venda deve ter pelo menos um item');
  }
  
  venda.itens.forEach((item, index) => {
    if (item.preco > MAX_NUMERIC_VALUE) {
      throw new Error(`Preço do item "${item.nome}" excede o limite máximo`);
    }
    if (item.subtotal > MAX_NUMERIC_VALUE) {
      throw new Error(`Subtotal do item "${item.nome}" excede o limite máximo`);
    }
    if (item.quantidade <= 0 || item.quantidade > 10000) {
      throw new Error(`Quantidade do item "${item.nome}" é inválida: ${item.quantidade}`);
    }
  });
};

// Utilitários para converter dados entre formato local e Supabase
const convertDateToISOString = (date: string | Date): string => {
  return new Date(date).toISOString();
};

const convertFromSupabase = {
  cliente: (data: any): Cliente => ({
    id: data.id,
    nome: data.nome,
    telefone: data.telefone,
    email: data.email,
    aniversario: data.aniversario,
    preferencias: data.preferencias || {},
    observacoes: data.observacoes,
    pontosFidelidade: data.pontos_fidelidade,
    dataCadastro: data.data_cadastro,
    ultimoAtendimento: data.ultimo_atendimento,
    status: data.status || 'ativo'
  }),

  barbeiro: (data: any): Barbeiro => ({
    id: data.id,
    nome: data.nome,
    usuario: data.usuario,
    senha: data.senha,
    telefone: data.telefone,
    email: data.email,
    horarioTrabalho: data.horario_trabalho || {},
    comissaoServicos: data.comissao_servicos,
    comissaoProdutos: data.comissao_produtos,
    dataCadastro: data.data_cadastro,
    ativo: data.ativo,
    nivel: data.nivel,
    isProprietario: data.is_proprietario,
    fotoPerfilUrl: data.foto_perfil_url,
    empresaId: data.empresa_id
  }),

  servico: (data: any): Servico => ({
    id: data.id,
    nome: data.nome,
    descricao: data.descricao,
    preco: data.preco,
    ativo: data.ativo,
    categoria: data.categoria,
    barbeiroIds: data.barbeiro_ids || [],
    comissaoPersonalizada: data.comissao_personalizada || {},
    duracaoMinutos: data.duracao_minutos,
    pacote: data.pacote,
    dataCadastro: data.data_cadastro
  }),

  produto: (data: any): Produto => ({
    id: data.id,
    nome: data.nome,
    descricao: data.descricao,
    precoCompra: data.preco_compra,
    precoVenda: data.preco_venda,
    estoque: data.estoque,
    estoqueMinimo: data.estoque_minimo,
    categoria: data.categoria,
    fornecedorId: data.fornecedor_id,
    ativo: data.ativo,
    dataCadastro: data.data_cadastro
  }),

  venda: (data: any): Venda => ({
    id: data.id,
    clienteId: data.cliente_id,
    barbeiroId: data.barbeiro_id,
    itens: data.itens || [],
    total: data.total,
    desconto: data.desconto || 0, // ✅ CORRIGIDO: mapear campo desconto do banco
    formaPagamento: data.forma_pagamento,
    status: data.status,
    observacoes: data.observacoes,
    dataVenda: data.data_venda,
    dataAtualizacao: data.data_atualizacao,
    horarioAtendimento: data.horario_atendimento
  })
};

const convertToSupabase = {
  cliente: (data: Cliente) => ({
    id: data.id,
    nome: data.nome,
    telefone: data.telefone,
    email: data.email,
    aniversario: data.aniversario,
    preferencias: data.preferencias || {},
    observacoes: data.observacoes,
    pontos_fidelidade: data.pontosFidelidade,
    data_cadastro: convertDateToISOString(data.dataCadastro),
    ultimo_atendimento: data.ultimoAtendimento ? convertDateToISOString(data.ultimoAtendimento) : null,
    status: data.status
  }),

  barbeiro: (data: Barbeiro) => ({
    id: data.id,
    nome: data.nome,
    usuario: data.usuario,
    senha: data.senha,
    telefone: data.telefone,
    email: data.email,
    horario_trabalho: data.horarioTrabalho || {},
    comissao_servicos: data.comissaoServicos,
    comissao_produtos: data.comissaoProdutos,
    data_cadastro: convertDateToISOString(data.dataCadastro),
    ativo: data.ativo,
    nivel: data.nivel,
    is_proprietario: data.isProprietario,
    empresa_id: data.empresaId
  }),

  servico: (data: Servico) => ({
    id: data.id,
    nome: data.nome,
    descricao: data.descricao,
    preco: data.preco,
    ativo: data.ativo,
    categoria: data.categoria,
    barbeiro_ids: data.barbeiroIds || [],
    comissao_personalizada: data.comissaoPersonalizada || {},
    duracao_minutos: data.duracaoMinutos,
    pacote: data.pacote,
    data_cadastro: convertDateToISOString(data.dataCadastro)
  }),

  produto: (data: Produto) => ({
    id: data.id,
    nome: data.nome,
    descricao: data.descricao,
    preco_compra: data.precoCompra,
    preco_venda: data.precoVenda,
    estoque: data.estoque,
    estoque_minimo: data.estoqueMinimo,
    categoria: data.categoria,
    fornecedor_id: data.fornecedorId,
    ativo: data.ativo,
    data_cadastro: convertDateToISOString(data.dataCadastro)
  }),

  venda: (data: Venda) => {
    // Validar dados antes de converter
    validateVendaData(data);
    
    return {
      id: data.id,
      cliente_id: data.clienteId,
      barbeiro_id: data.barbeiroId,
      total: sanitizeNumericValue(data.total, false),
      desconto: sanitizeNumericValue(data.desconto, true), // Permite null
      forma_pagamento: data.formaPagamento,
      status: data.status,
      observacoes: data.observacoes,
      data_venda: convertDateToISOString(data.dataVenda),
      data_atualizacao: convertDateToISOString(data.dataAtualizacao),
      horario_atendimento: convertDateToISOString(data.horarioAtendimento),
      empresa_id: data.empresaId
    };
  },

  itemVenda: (data: ItemVenda, vendaId: string) => ({
    id: data.id,
    venda_id: vendaId,
    tipo: data.tipo,
    item_id: data.itemId,
    nome: data.nome,
    preco: sanitizeNumericValue(data.preco, false),
    quantidade: Math.max(1, Math.floor(data.quantidade)), // Garantir inteiro positivo
    subtotal: sanitizeNumericValue(data.subtotal, false)
  })
};

// Cliente Storage
export const supabaseClienteStorage = {
  getAll: async (): Promise<Cliente[]> => {
    const { data, error } = await supabase.from('clientes').select('*').order('nome');
    if (error) throw error;
    return data?.map(convertFromSupabase.cliente) || [];
  },

  add: async (cliente: Cliente): Promise<void> => {
    const { error } = await supabase.from('clientes').insert(convertToSupabase.cliente(cliente));
    if (error) throw error;
  },

  update: async (cliente: Cliente): Promise<void> => {
    const { error } = await supabase
      .from('clientes')
      .update(convertToSupabase.cliente(cliente))
      .eq('id', cliente.id);
    if (error) throw error;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (error) throw error;
  },

  getById: async (id: string): Promise<Cliente | null> => {
    const { data, error } = await supabase.from('clientes').select('*').eq('id', id).single();
    if (error) return null;
    return data ? convertFromSupabase.cliente(data) : null;
  }
};

// Barbeiro Storage
export const supabaseBarbeiroStorage = {
  getAll: async (): Promise<Barbeiro[]> => {
    const { data, error } = await supabase.from('barbeiros').select('*').order('nome');
    if (error) throw error;
    return data?.map(convertFromSupabase.barbeiro) || [];
  },

  add: async (barbeiro: Barbeiro): Promise<void> => {
    const { error } = await supabase.from('barbeiros').insert(convertToSupabase.barbeiro(barbeiro));
    if (error) throw error;
  },

  update: async (barbeiro: Barbeiro): Promise<void> => {
    const { error } = await supabase
      .from('barbeiros')
      .update(convertToSupabase.barbeiro(barbeiro))
      .eq('id', barbeiro.id);
    if (error) throw error;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('barbeiros').delete().eq('id', id);
    if (error) throw error;
  },

  getById: async (id: string): Promise<Barbeiro | null> => {
    const { data, error } = await supabase.from('barbeiros').select('*').eq('id', id).single();
    if (error) return null;
    return data ? convertFromSupabase.barbeiro(data) : null;
  }
};

// Serviço Storage
export const supabaseServicoStorage = {
  getAll: async (): Promise<Servico[]> => {
    const { data, error } = await supabase.from('servicos').select('*').order('nome');
    if (error) throw error;
    return data?.map(convertFromSupabase.servico) || [];
  },

  add: async (servico: Servico): Promise<void> => {
    const { error } = await supabase.from('servicos').insert(convertToSupabase.servico(servico));
    if (error) throw error;
  },

  update: async (servico: Servico): Promise<void> => {
    const { error } = await supabase
      .from('servicos')
      .update(convertToSupabase.servico(servico))
      .eq('id', servico.id);
    if (error) throw error;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('servicos').delete().eq('id', id);
    if (error) throw error;
  },

  getById: async (id: string): Promise<Servico | null> => {
    const { data, error } = await supabase.from('servicos').select('*').eq('id', id).single();
    if (error) return null;
    return data ? convertFromSupabase.servico(data) : null;
  }
};

// Produto Storage
export const supabaseProdutoStorage = {
  getAll: async (): Promise<Produto[]> => {
    const { data, error } = await supabase.from('produtos').select('*').order('nome');
    if (error) throw error;
    return data?.map(convertFromSupabase.produto) || [];
  },

  add: async (produto: Produto): Promise<void> => {
    const { error } = await supabase.from('produtos').insert(convertToSupabase.produto(produto));
    if (error) throw error;
  },

  update: async (produto: Produto): Promise<void> => {
    const { error } = await supabase
      .from('produtos')
      .update(convertToSupabase.produto(produto))
      .eq('id', produto.id);
    if (error) throw error;
  },

  delete: async (id: string): Promise<void> => {
    // Primeiro, remover todas as configurações de comissão relacionadas ao produto
    const { error: comissaoError } = await supabase
      .from('configuracoes_comissao')
      .delete()
      .eq('produto_id', id);
    
    if (comissaoError) throw comissaoError;

    // Depois, remover o produto
    const { error } = await supabase.from('produtos').delete().eq('id', id);
    if (error) throw error;
  },

  getById: async (id: string): Promise<Produto | null> => {
    const { data, error } = await supabase.from('produtos').select('*').eq('id', id).single();
    if (error) return null;
    return data ? convertFromSupabase.produto(data) : null;
  }
};

// Venda Storage
export const supabaseVendaStorage = {
  getAll: async (): Promise<Venda[]> => {
    // ⚡ CORREÇÃO: Paginação para carregar TODAS as vendas (limite padrão do Supabase é 1000)
    const PAGE_SIZE = 1000;
    let allVendas: any[] = [];
    let hasMore = true;
    let page = 0;

    const startTime = performance.now();
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('vendas')
        .select(`
          *,
          itens_venda (
            id,
            tipo,
            item_id,
            nome,
            preco,
            quantidade,
            subtotal
          )
        `)
        .order('data_venda', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      
      if (error) throw error;

      if (data && data.length > 0) {
        allVendas = [...allVendas, ...data];
      }

      // Verificar se há mais páginas
      hasMore = data?.length === PAGE_SIZE;
      page++;
    }

    const endTime = performance.now();
    console.log(`⚡ [VENDAS] Carregadas ${allVendas.length} vendas em ${page} página(s) - ${(endTime - startTime).toFixed(0)}ms`);

    // Converter e estruturar os dados
    const vendasComItens: Venda[] = allVendas.map(venda => {
      const itensConvertidos: ItemVenda[] = (venda.itens_venda || []).map((item: any) => ({
        id: item.id,
        tipo: item.tipo as 'servico' | 'produto',
        itemId: item.item_id,
        nome: item.nome,
        preco: item.preco,
        quantidade: item.quantidade,
        subtotal: item.subtotal
      }));

      return {
        ...convertFromSupabase.venda(venda),
        itens: itensConvertidos
      };
    });

    return vendasComItens;
  },

  add: async (venda: Venda): Promise<void> => {
    console.log('📊 [VENDA] Dados originais recebidos:', {
      total: venda.total,
      desconto: venda.desconto,
      tipo_total: typeof venda.total,
      tipo_desconto: typeof venda.desconto,
      valor_total: venda.total,
      valor_desconto: venda.desconto,
      qtdItens: venda.itens.length
    });
    
    console.log('📦 [ITENS] Detalhes dos itens originais:', venda.itens.map(i => ({
      nome: i.nome,
      preco: i.preco,
      quantidade: i.quantidade,
      subtotal: i.subtotal,
      tipo_preco: typeof i.preco,
      tipo_subtotal: typeof i.subtotal
    })));
    
    // Preparar dados da venda para RPC
    const vendaData = convertToSupabase.venda(venda);
    
    console.log('📤 [VENDA] Dados convertidos para RPC:', {
      ...vendaData,
      tipo_total: typeof vendaData.total,
      tipo_desconto: typeof vendaData.desconto,
      json_total: JSON.stringify(vendaData.total),
      json_desconto: JSON.stringify(vendaData.desconto)
    });
    
    // Usar RPC para inserir venda (contorna RLS)
    const { data: vendaId, error: vendaError } = await supabase
      .rpc('inserir_venda', {
        p_venda_data: vendaData,
        p_barbeiro_id: venda.barbeiroId
      });
    
    if (vendaError) {
      console.error('❌ Erro ao inserir venda via RPC:', vendaError);
      throw vendaError;
    }

    console.log('✅ Venda inserida com sucesso via RPC:', vendaId);

    // Inserir itens da venda
    const itensConvertidos = venda.itens.map(item => convertToSupabase.itemVenda(item, venda.id));
    
    console.log('📦 [ITENS] Dados convertidos para inserção:', itensConvertidos.map(i => ({
      nome: i.nome,
      preco: i.preco,
      quantidade: i.quantidade,
      subtotal: i.subtotal,
      tipo_preco: typeof i.preco,
      tipo_subtotal: typeof i.subtotal,
      tipo_quantidade: typeof i.quantidade
    })));
    
    console.log('🔍 [DEBUG] Valores exatos antes do RPC:', {
      itensJSON: JSON.stringify(itensConvertidos),
      totalItens: itensConvertidos.length
    });

    // ✅ USAR RPC PARA SANITIZAR VALORES
    const { error: itensError } = await supabase.rpc('inserir_itens_venda', {
      p_itens: itensConvertidos
    });
    
    if (itensError) {
      console.error('❌ Erro ao inserir itens da venda:', itensError);
      throw itensError;
    }

    console.log('✅ Itens inseridos com sucesso via RPC');

    // Atualizar estoque automaticamente para produtos vendidos
    for (const item of venda.itens) {
      if (item.tipo === 'produto') {
        const { data: produto, error: produtoError } = await supabase
          .from('produtos')
          .select('estoque')
          .eq('id', item.itemId)
          .single();

        if (!produtoError && produto) {
          const novoEstoque = Math.max(0, produto.estoque - item.quantidade);
          await supabase
            .from('produtos')
            .update({ estoque: novoEstoque })
            .eq('id', item.itemId);

          // Registrar movimentação de estoque
          await supabase
            .from('movimentacoes_estoque')
            .insert({
              produto_id: item.itemId,
              tipo: 'saida',
              quantidade: item.quantidade,
              motivo: `Venda ${venda.id}`,
              data_movimento: venda.dataVenda
            });
        }
      }
    }
  },

  update: async (venda: Venda): Promise<void> => {
    const { error } = await supabase
      .from('vendas')
      .update(convertToSupabase.venda(venda))
      .eq('id', venda.id);
    if (error) throw error;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('vendas').delete().eq('id', id);
    if (error) throw error;
  },

  getById: async (id: string): Promise<Venda | null> => {
    const { data, error } = await supabase.from('vendas').select('*').eq('id', id).single();
    if (error) return null;
    return data ? convertFromSupabase.venda(data) : null;
  }
};

// Configuração de Comissão Storage
export const supabaseComissaoStorage = {
  getAll: async (): Promise<ConfiguracaoComissao[]> => {
    const { data, error } = await supabase
      .from('configuracoes_comissao')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data || []).map(item => ({
      id: item.id,
      barbeiroId: item.barbeiro_id,
      tipo: item.tipo as 'servico' | 'produto',
      servicoId: item.servico_id,
      produtoId: item.produto_id,
      percentual: item.percentual,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));
  },

  getByBarbeiro: async (barbeiroId: string): Promise<ConfiguracaoComissao[]> => {
    const { data, error } = await supabase
      .from('configuracoes_comissao')
      .select('*')
      .eq('barbeiro_id', barbeiroId);
    
    if (error) throw error;
    return (data || []).map(item => ({
      id: item.id,
      barbeiroId: item.barbeiro_id,
      tipo: item.tipo as 'servico' | 'produto',
      servicoId: item.servico_id,
      produtoId: item.produto_id,
      percentual: item.percentual,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));
  },

  upsertComissao: async (barbeiroId: string, tipo: 'servico' | 'produto', itemId: string, percentual: number): Promise<void> => {
    const column = tipo === 'servico' ? 'servico_id' : 'produto_id';
    
    console.log(`💰 Upsert comissão: ${tipo} ${itemId} para barbeiro ${barbeiroId} com ${percentual}%`);
    
    // Garantir que o percentual seja um número válido
    const percentualNumerico = typeof percentual === 'string' ? parseFloat(percentual) : percentual;
    if (isNaN(percentualNumerico)) {
      console.error('❌ Percentual inválido:', percentual);
      throw new Error('Percentual deve ser um número válido');
    }
    
    console.log(`🔍 Verificando se já existe configuração para barbeiro ${barbeiroId} e ${tipo} ${itemId}`);
    
    // Verificar se já existe uma configuração para este barbeiro e item
    const { data: existing, error: searchError } = await supabase
      .from('configuracoes_comissao')
      .select('id')
      .eq('barbeiro_id', barbeiroId)
      .eq(column, itemId)
      .eq('tipo', tipo)
      .maybeSingle();

    if (searchError) {
      console.error('❌ Erro ao buscar configuração existente:', searchError);
      throw searchError;
    }

    const configData = {
      barbeiro_id: barbeiroId,
      tipo,
      [column]: itemId,
      percentual: percentualNumerico,
      updated_at: new Date().toISOString()
    };

    if (existing) {
      console.log(`🔄 Atualizando configuração existente ID: ${existing.id}`);
      // Atualizar existente
      const { error } = await supabase
        .from('configuracoes_comissao')
        .update(configData)
        .eq('id', existing.id);
      
      if (error) {
        console.error('❌ Erro ao atualizar configuração:', error);
        throw error;
      }
      console.log(`✅ Configuração atualizada com sucesso`);
    } else {
      console.log(`➕ Criando nova configuração`);
      // Criar novo
      const { error } = await supabase
        .from('configuracoes_comissao')
        .insert({
          ...configData,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString()
        });
      
      if (error) {
        console.error('❌ Erro ao criar nova configuração:', error);
        throw error;
      }
      console.log(`✅ Nova configuração criada com sucesso`);
    }
  },

  deleteComissao: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('configuracoes_comissao')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Salvar múltiplas comissões em lote - versão melhorada
  saveComissoesBarbeiro: async (
    barbeiroId: string, 
    servicos: { [servicoId: string]: number }, 
    produtos: { [produtoId: string]: number }
  ): Promise<void> => {
    console.log('💰 Salvando comissões do barbeiro:', { barbeiroId, servicos, produtos });
    
    // Primeiro, remover todas as configurações existentes do barbeiro
    console.log('🗑️ Removendo configurações existentes...');
    const { error: deleteError } = await supabase
      .from('configuracoes_comissao')
      .delete()
      .eq('barbeiro_id', barbeiroId);
    
    if (deleteError) {
      console.error('❌ Erro ao remover configurações existentes:', deleteError);
      throw deleteError;
    }
    
    // Preparar dados para inserção em lote
    const configuracoesParaInserir = [];
    
    // Adicionar comissões de serviços
    for (const [servicoId, percentual] of Object.entries(servicos)) {
      configuracoesParaInserir.push({
        id: crypto.randomUUID(),
        barbeiro_id: barbeiroId,
        tipo: 'servico',
        servico_id: servicoId,
        produto_id: null,
        percentual: percentual,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    // Adicionar comissões de produtos  
    for (const [produtoId, percentual] of Object.entries(produtos)) {
      configuracoesParaInserir.push({
        id: crypto.randomUUID(),
        barbeiro_id: barbeiroId,
        tipo: 'produto',
        servico_id: null,
        produto_id: produtoId,
        percentual: percentual,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    // Inserir todas as configurações de uma vez
    if (configuracoesParaInserir.length > 0) {
      console.log(`📝 Inserindo ${configuracoesParaInserir.length} configurações...`);
      const { error: insertError } = await supabase
        .from('configuracoes_comissao')
        .insert(configuracoesParaInserir);
      
      if (insertError) {
        console.error('❌ Erro ao inserir configurações:', insertError);
        throw insertError;
      }
    }

    console.log('✅ Todas as comissões foram salvas com sucesso');
  }
};