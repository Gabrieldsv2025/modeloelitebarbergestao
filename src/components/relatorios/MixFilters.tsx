import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Scissors, Package, X, ChevronDown, Search, Users } from "lucide-react";
import { Venda, Cliente } from '@/types';

interface ItemVendido {
  id: string;
  nome: string;
  tipo: 'servico' | 'produto';
  quantidade: number;
  receita: number;
}

interface ClienteVendido {
  id: string;
  nome: string;
  quantidade: number;
}

interface MixFiltersProps {
  vendasFiltradas: Venda[];
  servicosSelecionados: string[];
  produtosSelecionados: string[];
  onServicosChange: (servicos: string[]) => void;
  onProdutosChange: (produtos: string[]) => void;
  clientesSelecionados?: string[];
  onClientesChange?: (clientes: string[]) => void;
  clientes?: Cliente[];
}

export const MixFilters = ({
  vendasFiltradas,
  servicosSelecionados,
  produtosSelecionados,
  onServicosChange,
  onProdutosChange,
  clientesSelecionados = [],
  onClientesChange,
  clientes = []
}: MixFiltersProps) => {
  
  const [buscaServicos, setBuscaServicos] = useState('');
  const [buscaProdutos, setBuscaProdutos] = useState('');
  const [buscaClientes, setBuscaClientes] = useState('');

  // ========== CROSS-FILTERING LOGIC ==========
  // Vendas pagas base
  const vendasPagas = useMemo(() => 
    vendasFiltradas.filter(v => v.status === 'pago'),
    [vendasFiltradas]
  );

  // Para calcular serviços/produtos disponíveis: filtrar vendas pelos clientes selecionados
  const vendasParaItens = useMemo(() => {
    if (clientesSelecionados.length === 0) return vendasPagas;
    return vendasPagas.filter(v => clientesSelecionados.includes(v.clienteId));
  }, [vendasPagas, clientesSelecionados]);

  // Para calcular clientes disponíveis: filtrar vendas pelos itens selecionados
  const vendasParaClientes = useMemo(() => {
    if (servicosSelecionados.length === 0 && produtosSelecionados.length === 0) return vendasPagas;
    return vendasPagas.filter(venda =>
      venda.itens.some(item => {
        if (item.tipo === 'servico' && servicosSelecionados.includes(item.itemId)) return true;
        if (item.tipo === 'produto' && produtosSelecionados.includes(item.itemId)) return true;
        return false;
      })
    );
  }, [vendasPagas, servicosSelecionados, produtosSelecionados]);

  // Extrair itens vendidos (filtrado por clientes selecionados para cross-filtering)
  const itensVendidos = useMemo(() => {
    const mapa = new Map<string, ItemVendido>();
    vendasParaItens.forEach(venda => {
      venda.itens.forEach(item => {
        const key = `${item.tipo}-${item.itemId}`;
        if (mapa.has(key)) {
          const existing = mapa.get(key)!;
          existing.quantidade += item.quantidade;
          existing.receita += item.subtotal;
        } else {
          mapa.set(key, {
            id: item.itemId,
            nome: item.nome,
            tipo: item.tipo as 'servico' | 'produto',
            quantidade: item.quantidade,
            receita: item.subtotal
          });
        }
      });
    });
    return Array.from(mapa.values());
  }, [vendasParaItens]);

  // Extrair clientes que venderam (filtrado por itens selecionados para cross-filtering)
  const clientesVendidos = useMemo(() => {
    if (!onClientesChange) return [];
    const mapa = new Map<string, ClienteVendido>();
    vendasParaClientes.forEach(venda => {
      if (mapa.has(venda.clienteId)) {
        mapa.get(venda.clienteId)!.quantidade += 1;
      } else {
        const cliente = clientes.find(c => c.id === venda.clienteId);
        mapa.set(venda.clienteId, {
          id: venda.clienteId,
          nome: cliente?.nome || 'Cliente desconhecido',
          quantidade: 1
        });
      }
    });
    return Array.from(mapa.values()).sort((a, b) => b.quantidade - a.quantidade);
  }, [vendasParaClientes, clientes, onClientesChange]);

  // Serviços e produtos ordenados por quantidade
  const servicosVendidos = useMemo(() =>
    itensVendidos.filter(item => item.tipo === 'servico').sort((a, b) => b.quantidade - a.quantidade),
    [itensVendidos]
  );

  const produtosVendidos = useMemo(() =>
    itensVendidos.filter(item => item.tipo === 'produto').sort((a, b) => b.quantidade - a.quantidade),
    [itensVendidos]
  );

  // Filtrar por busca
  const servicosFiltrados = useMemo(() => {
    if (!buscaServicos.trim()) return servicosVendidos;
    const termo = buscaServicos.toLowerCase().trim();
    return servicosVendidos.filter(s => s.nome.toLowerCase().includes(termo));
  }, [servicosVendidos, buscaServicos]);

  const produtosFiltrados = useMemo(() => {
    if (!buscaProdutos.trim()) return produtosVendidos;
    const termo = buscaProdutos.toLowerCase().trim();
    return produtosVendidos.filter(p => p.nome.toLowerCase().includes(termo));
  }, [produtosVendidos, buscaProdutos]);

  const clientesFiltrados = useMemo(() => {
    if (!buscaClientes.trim()) return clientesVendidos;
    const termo = buscaClientes.toLowerCase().trim();
    return clientesVendidos.filter(c => c.nome.toLowerCase().includes(termo));
  }, [clientesVendidos, buscaClientes]);

  // Toggles
  const toggleServico = (servicoId: string) => {
    if (servicosSelecionados.includes(servicoId)) {
      onServicosChange(servicosSelecionados.filter(id => id !== servicoId));
    } else {
      onServicosChange([...servicosSelecionados, servicoId]);
    }
  };

  const toggleProduto = (produtoId: string) => {
    if (produtosSelecionados.includes(produtoId)) {
      onProdutosChange(produtosSelecionados.filter(id => id !== produtoId));
    } else {
      onProdutosChange([...produtosSelecionados, produtoId]);
    }
  };

  const toggleCliente = (clienteId: string) => {
    if (!onClientesChange) return;
    if (clientesSelecionados.includes(clienteId)) {
      onClientesChange(clientesSelecionados.filter(id => id !== clienteId));
    } else {
      onClientesChange([...clientesSelecionados, clienteId]);
    }
  };

  // Limpar filtros
  const limparServicos = () => onServicosChange([]);
  const limparProdutos = () => onProdutosChange([]);
  const limparClientes = () => onClientesChange?.([]);
  const limparTodos = () => {
    onServicosChange([]);
    onProdutosChange([]);
    onClientesChange?.([]);
  };

  // Selecionar todos (visíveis na busca)
  const selecionarTodosServicos = () => onServicosChange(servicosFiltrados.map(s => s.id));
  const selecionarTodosProdutos = () => onProdutosChange(produtosFiltrados.map(p => p.id));
  const selecionarTodosClientes = () => onClientesChange?.(clientesFiltrados.map(c => c.id));

  const totalSelecionados = servicosSelecionados.length + produtosSelecionados.length + clientesSelecionados.length;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Filtro de Serviços */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-[180px] justify-between">
            <div className="flex items-center gap-2 truncate">
              <Scissors className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {servicosSelecionados.length === 0 
                  ? 'Serviços' 
                  : `${servicosSelecionados.length} serviço(s)`}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <div className="p-3 border-b space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">Filtrar por Serviços</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selecionarTodosServicos} disabled={servicosFiltrados.length === 0}>
                  Todos
                </Button>
                {servicosSelecionados.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={limparServicos}>
                    Limpar
                  </Button>
                )}
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar serviço..." value={buscaServicos} onChange={(e) => setBuscaServicos(e.target.value)} className="pl-8 h-8 text-sm" />
            </div>
          </div>
          <ScrollArea className="h-[250px]">
            <div className="p-2 space-y-1">
              {servicosVendidos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum serviço vendido no período</p>
              ) : servicosFiltrados.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum serviço encontrado</p>
              ) : (
                servicosFiltrados.map(servico => (
                  <div key={servico.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer" onClick={() => toggleServico(servico.id)}>
                    <Checkbox checked={servicosSelecionados.includes(servico.id)} className="pointer-events-none" />
                    <span className="flex-1 text-sm truncate">{servico.nome}</span>
                    <Badge variant="secondary" className="text-xs shrink-0">{servico.quantidade}x</Badge>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Filtro de Produtos */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-[180px] justify-between">
            <div className="flex items-center gap-2 truncate">
              <Package className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {produtosSelecionados.length === 0 
                  ? 'Produtos' 
                  : `${produtosSelecionados.length} produto(s)`}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <div className="p-3 border-b space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">Filtrar por Produtos</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selecionarTodosProdutos} disabled={produtosFiltrados.length === 0}>
                  Todos
                </Button>
                {produtosSelecionados.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={limparProdutos}>
                    Limpar
                  </Button>
                )}
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar produto..." value={buscaProdutos} onChange={(e) => setBuscaProdutos(e.target.value)} className="pl-8 h-8 text-sm" />
            </div>
          </div>
          <ScrollArea className="h-[250px]">
            <div className="p-2 space-y-1">
              {produtosVendidos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto vendido no período</p>
              ) : produtosFiltrados.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto encontrado</p>
              ) : (
                produtosFiltrados.map(produto => (
                  <div key={produto.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer" onClick={() => toggleProduto(produto.id)}>
                    <Checkbox checked={produtosSelecionados.includes(produto.id)} className="pointer-events-none" />
                    <span className="flex-1 text-sm truncate">{produto.nome}</span>
                    <Badge variant="secondary" className="text-xs shrink-0">{produto.quantidade}x</Badge>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Filtro de Clientes (only shown when onClientesChange is provided) */}
      {onClientesChange && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[180px] justify-between">
              <div className="flex items-center gap-2 truncate">
                <Users className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {clientesSelecionados.length === 0 
                    ? 'Clientes' 
                    : `${clientesSelecionados.length} cliente(s)`}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <div className="p-3 border-b space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">Filtrar por Clientes</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selecionarTodosClientes} disabled={clientesFiltrados.length === 0}>
                    Todos
                  </Button>
                  {clientesSelecionados.length > 0 && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={limparClientes}>
                      Limpar
                    </Button>
                  )}
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar cliente..." value={buscaClientes} onChange={(e) => setBuscaClientes(e.target.value)} className="pl-8 h-8 text-sm" />
              </div>
            </div>
            <ScrollArea className="h-[250px]">
              <div className="p-2 space-y-1">
                {clientesVendidos.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente no período</p>
                ) : clientesFiltrados.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente encontrado</p>
                ) : (
                  clientesFiltrados.map(cliente => (
                    <div key={cliente.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer" onClick={() => toggleCliente(cliente.id)}>
                      <Checkbox checked={clientesSelecionados.includes(cliente.id)} className="pointer-events-none" />
                      <span className="flex-1 text-sm truncate">{cliente.nome}</span>
                      <Badge variant="secondary" className="text-xs shrink-0">{cliente.quantidade}x</Badge>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      )}

      {/* Badge de filtros ativos e botão limpar */}
      {totalSelecionados > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
            {totalSelecionados} item(s) filtrado(s)
          </Badge>
          <Button variant="ghost" size="sm" onClick={limparTodos} className="h-7 px-2">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default MixFilters;
