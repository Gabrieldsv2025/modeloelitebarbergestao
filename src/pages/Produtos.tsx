import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Plus, Edit, Trash2, Package, TrendingUp, BarChart3, Search } from 'lucide-react';
import { Produto } from '@/types';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { supabaseProdutoStorage } from '@/utils/supabaseStorage';
import { useToast } from '@/hooks/use-toast';
import { ResponsiveLayout } from '@/components/layout/ResponsiveLayout';
export default function Produtos() {
  const {
    produtos,
    refreshData
  } = useSupabaseData();
  const [produtoDialogOpen, setProdutoDialogOpen] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [filteredProdutos, setFilteredProdutos] = useState<Produto[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const {
    toast
  } = useToast();
  const [produtoForm, setProdutoForm] = useState({
    nome: '',
    descricao: '',
    precoCompra: '',
    precoVenda: '',
    estoque: '',
    estoqueMinimo: '',
    categoria: '',
    fornecedorId: '',
    ativo: true
  });
  const resetProdutoForm = () => {
    setProdutoForm({
      nome: '',
      descricao: '',
      precoCompra: '',
      precoVenda: '',
      estoque: '',
      estoqueMinimo: '',
      categoria: '',
      fornecedorId: '',
      ativo: true
    });
    setEditingProduto(null);
  };
  const handleEditProduto = (produto: Produto) => {
    setEditingProduto(produto);
    setProdutoForm({
      nome: produto.nome,
      descricao: produto.descricao || '',
      precoCompra: produto.precoCompra.toString(),
      precoVenda: produto.precoVenda.toString(),
      estoque: produto.estoque.toString(),
      estoqueMinimo: produto.estoqueMinimo.toString(),
      categoria: produto.categoria,
      fornecedorId: produto.fornecedorId || '',
      ativo: produto.ativo
    });
    setProdutoDialogOpen(true);
  };
  const handleSaveProduto = async () => {
    if (!produtoForm.nome || !produtoForm.categoria) {
      toast({
        title: "Erro",
        description: "Nome e categoria são obrigatórios",
        variant: "destructive"
      });
      return;
    }
    const produto: Produto = {
      id: editingProduto?.id || crypto.randomUUID(),
      nome: produtoForm.nome,
      descricao: produtoForm.descricao,
      precoCompra: parseFloat(produtoForm.precoCompra) || 0,
      precoVenda: parseFloat(produtoForm.precoVenda) || 0,
      estoque: parseInt(produtoForm.estoque) || 0,
      estoqueMinimo: parseInt(produtoForm.estoqueMinimo) || 0,
      categoria: produtoForm.categoria,
      fornecedorId: produtoForm.fornecedorId || undefined,
      ativo: produtoForm.ativo,
      dataCadastro: editingProduto?.dataCadastro || new Date().toISOString()
    };
    try {
      if (editingProduto) {
        await supabaseProdutoStorage.update(produto);
        toast({
          title: "Produto atualizado",
          description: "Produto atualizado com sucesso"
        });
      } else {
        await supabaseProdutoStorage.add(produto);
        toast({
          title: "Produto salvo",
          description: "Produto cadastrado com sucesso"
        });
      }
      await refreshData();
      setProdutoDialogOpen(false);
      resetProdutoForm();
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar produto",
        variant: "destructive"
      });
    }
  };
  const handleDeleteProduto = async (id: string) => {
    try {
      await supabaseProdutoStorage.delete(id);
      await refreshData();
      toast({
        title: "Produto removido",
        description: "Produto removido com sucesso"
      });
    } catch (error) {
      console.error('Erro ao deletar produto:', error);
      toast({
        title: "Erro",
        description: "Erro ao remover produto",
        variant: "destructive"
      });
    }
  };

  // Effect para filtrar produtos baseado na busca
  useEffect(() => {
    let filtered = produtos;
    if (searchTerm.trim()) {
      const normalizedSearch = searchTerm.toLowerCase().trim();
      filtered = produtos.filter(produto => produto.nome.toLowerCase().includes(normalizedSearch) || produto.descricao?.toLowerCase().includes(normalizedSearch) || produto.categoria.toLowerCase().includes(normalizedSearch));
    }
    setFilteredProdutos(filtered);
  }, [produtos, searchTerm]);
  const produtosComEstoqueBaixo = produtos.filter(p => p.estoque <= p.estoqueMinimo);
  const valorTotalEstoque = produtos.reduce((total, p) => total + p.estoque * p.precoCompra, 0);

  // Cálculos de margem
  const margemTotalValor = produtos.reduce((total, p) => total + (p.precoVenda - p.precoCompra), 0);
  const margemTotalPercentual = produtos.length > 0 ? produtos.reduce((total, p) => {
    const margem = p.precoCompra > 0 ? (p.precoVenda - p.precoCompra) / p.precoCompra * 100 : 0;
    return total + margem;
  }, 0) / produtos.length : 0;

  // Mostrar mensagem quando não há produtos filtrados
  const showEmptyMessage = filteredProdutos.length === 0 && (searchTerm.trim() !== '' || produtos.length > 0);
  return <ResponsiveLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Cadastro de Produtos</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Gerencie produtos e controle de estoque</p>
          </div>
        </div>

        <Tabs defaultValue="produtos" className="space-y-4">
          <TabsList>
            <TabsTrigger value="produtos">Produtos</TabsTrigger>
          </TabsList>

          <TabsContent value="produtos" className="space-y-4">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{produtos.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Produtos Ativos</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{produtos.filter(p => p.ativo).length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Margem Total</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(margemTotalValor)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Margem Média %</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {margemTotalPercentual.toFixed(1)}%
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h3 className="text-lg font-semibold">Lista de Produtos</h3>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1 sm:max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar produtos..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
                </div>
                
                <Dialog open={produtoDialogOpen} onOpenChange={setProdutoDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetProdutoForm} className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Produto
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingProduto ? 'Editar Produto' : 'Cadastrar Produto'}
                    </DialogTitle>
                    <DialogDescription>
                      Preencha as informações do produto
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="nome">Nome *</Label>
                        <Input id="nome" value={produtoForm.nome} onChange={e => setProdutoForm({
                          ...produtoForm,
                          nome: e.target.value
                        })} placeholder="Nome do produto" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="categoria">Categoria *</Label>
                        <Select value={produtoForm.categoria} onValueChange={value => setProdutoForm({
                          ...produtoForm,
                          categoria: value
                        })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pomada">Pomada</SelectItem>
                            <SelectItem value="shampoo">Shampoo</SelectItem>
                            <SelectItem value="oleo">Óleo</SelectItem>
                            <SelectItem value="cera">Cera</SelectItem>
                            <SelectItem value="acessorio">Acessório</SelectItem>
                            <SelectItem value="outros">Outros</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="descricao">Descrição</Label>
                      <Textarea id="descricao" value={produtoForm.descricao} onChange={e => setProdutoForm({
                        ...produtoForm,
                        descricao: e.target.value
                      })} placeholder="Descrição do produto" rows={3} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="precoCompra">Preço de Compra</Label>
                        <Input id="precoCompra" type="number" step="0.01" value={produtoForm.precoCompra} onChange={e => setProdutoForm({
                          ...produtoForm,
                          precoCompra: e.target.value
                        })} placeholder="0,00" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="precoVenda">Preço de Venda</Label>
                        <Input id="precoVenda" type="number" step="0.01" value={produtoForm.precoVenda} onChange={e => setProdutoForm({
                          ...produtoForm,
                          precoVenda: e.target.value
                        })} placeholder="0,00" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="estoque">Estoque Atual</Label>
                        <Input id="estoque" type="number" value={produtoForm.estoque} onChange={e => setProdutoForm({
                          ...produtoForm,
                          estoque: e.target.value
                        })} placeholder="0" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="estoqueMinimo">Estoque Mínimo</Label>
                        <Input id="estoqueMinimo" type="number" value={produtoForm.estoqueMinimo} onChange={e => setProdutoForm({
                          ...produtoForm,
                          estoqueMinimo: e.target.value
                        })} placeholder="0" />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setProdutoDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSaveProduto}>
                      {editingProduto ? 'Atualizar' : 'Salvar'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              </div>
            </div>

            {showEmptyMessage ? <div className="text-center py-12">
                <div className="text-muted-foreground text-lg">
                  Nenhum produto encontrado com os filtros aplicados
                </div>
              </div> : <Card className="bg-card/80 backdrop-blur-sm border-border/30 shadow-lg">
                <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Preço Compra</TableHead>
                    <TableHead>Preço Venda</TableHead>
                    <TableHead>Margem (R$)</TableHead>
                    <TableHead>Margem (%)</TableHead>
                    <TableHead>Estoque</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProdutos.map(produto => <TableRow key={produto.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{produto.nome}</p>
                          {produto.descricao && <p className="text-sm text-muted-foreground">{produto.descricao}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{produto.categoria}</Badge>
                      </TableCell>
                      <TableCell>
                        {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }).format(produto.precoCompra)}
                      </TableCell>
                      <TableCell>
                        {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }).format(produto.precoVenda)}
                      </TableCell>
                      <TableCell className="text-green-600 font-medium">
                        {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }).format(produto.precoVenda - produto.precoCompra)}
                      </TableCell>
                      <TableCell className="text-green-600 font-medium">
                        {produto.precoCompra > 0 ? `${((produto.precoVenda - produto.precoCompra) / produto.precoCompra * 100).toFixed(1)}%` : '0.0%'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span>{produto.estoque}</span>
                          {produto.estoque <= produto.estoqueMinimo && <AlertTriangle className="h-4 w-4 text-red-500" />}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={produto.ativo ? "default" : "secondary"}>
                          {produto.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm" onClick={() => handleEditProduto(produto)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDeleteProduto(produto.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>)}
                </TableBody>
                </Table>
              </Card>}
          </TabsContent>
        </Tabs>
      </div>
    </ResponsiveLayout>;
}