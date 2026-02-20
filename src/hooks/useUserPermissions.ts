import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from './useSupabaseAuth';

// Sub-permissões para o módulo de Relatórios
export const RELATORIOS_TABS = [
  { key: 'vendas_mes', label: 'Vendas/Mês' },
  { key: 'detalhamento', label: 'Detalhamento' },
  { key: 'categorias', label: 'Categorias' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'barbeiros', label: 'Barbeiros' },
  { key: 'rankings', label: 'Rankings' },
  { key: 'financeiro', label: 'Financeiro' },
] as const;

export type RelatorioTabKey = typeof RELATORIOS_TABS[number]['key'];

interface UserPermissions {
  clientes: boolean;
  servicos: boolean;
  produtos: boolean;
  vendas: boolean;
  comissoes: boolean;
  relatorios: boolean;
  despesas: boolean;
  configuracoes: boolean;
  // Sub-permissões para Relatórios
  relatorios_vendas_mes: boolean;
  relatorios_detalhamento: boolean;
  relatorios_categorias: boolean;
  relatorios_clientes: boolean;
  relatorios_barbeiros: boolean;
  relatorios_rankings: boolean;
  relatorios_financeiro: boolean;
}

// Chaves de sub-permissões de relatórios
const RELATORIOS_SUB_PERMISSIONS: (keyof UserPermissions)[] = [
  'relatorios_vendas_mes',
  'relatorios_detalhamento',
  'relatorios_categorias',
  'relatorios_clientes',
  'relatorios_barbeiros',
  'relatorios_rankings',
  'relatorios_financeiro',
];

export const useUserPermissions = () => {
  const { usuario } = useSupabaseAuth();
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  // Permissões padrão completas (usado para admins)
  const getFullPermissions = (): UserPermissions => ({
    clientes: true,
    servicos: true,
    produtos: true,
    vendas: true,
    comissoes: true,
    relatorios: true,
    despesas: true,
    configuracoes: true,
    relatorios_vendas_mes: true,
    relatorios_detalhamento: true,
    relatorios_categorias: true,
    relatorios_clientes: true,
    relatorios_barbeiros: true,
    relatorios_rankings: true,
    relatorios_financeiro: true,
  });

  // Permissões padrão vazias (usado para colaboradores)
  const getEmptyPermissions = (): UserPermissions => ({
    clientes: false,
    servicos: false,
    produtos: false,
    vendas: false,
    comissoes: false,
    relatorios: false,
    despesas: false,
    configuracoes: false,
    relatorios_vendas_mes: false,
    relatorios_detalhamento: false,
    relatorios_categorias: false,
    relatorios_clientes: false,
    relatorios_barbeiros: false,
    relatorios_rankings: false,
    relatorios_financeiro: false,
  });

  // Carregar permissões do usuário atual
  const loadCurrentUserPermissions = async () => {
    if (!usuario) {
      setPermissions(null);
      setLoading(false);
      return;
    }

    // Para administradores e proprietários, dar todas as permissões IMEDIATAMENTE
    if (usuario.tipo === 'administrador' || usuario.isProprietario) {
      setPermissions(getFullPermissions());
      setLoading(false);
      return;
    }

    // Apenas colaboradores fazem consulta ao banco
    try {
      setLoading(true);
      
      const { data: userPermissionsData, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', usuario.id);

      if (error) {
        console.error('Erro ao carregar permissões:', error);
        setPermissions(null);
        setLoading(false);
        return;
      }

      const userPermissions = getEmptyPermissions();

      if (userPermissionsData && userPermissionsData.length > 0) {
        userPermissionsData.forEach(permission => {
          const module = permission.module_name as keyof UserPermissions;
          const hasAccess = Boolean(permission.has_access);
          
          if (module in userPermissions) {
            userPermissions[module] = hasAccess;
          }
        });
      }

      // Se o módulo pai 'relatorios' está desativado, desativar todas as sub-permissões
      if (!userPermissions.relatorios) {
        RELATORIOS_SUB_PERMISSIONS.forEach(subPerm => {
          userPermissions[subPerm] = false;
        });
      }

      setPermissions(userPermissions);
    } catch (error) {
      console.error('Erro ao carregar permissões:', error);
      setPermissions(null);
    } finally {
      setLoading(false);
    }
  };

  // Verificar se usuário atual tem permissão para um módulo
  const hasCurrentUserPermission = (module: string): boolean => {
    if (!usuario || loading || !permissions) {
      return false;
    }
    
    return permissions[module as keyof UserPermissions] || false;
  };

  // Verificar se usuário tem permissão para uma aba específica de relatórios
  const hasReportTabPermission = useCallback((tabKey: RelatorioTabKey): boolean => {
    if (!usuario || loading) return false;
    
    // Administradores e proprietários têm acesso a todas as abas
    if (usuario.tipo === 'administrador' || usuario.isProprietario) {
      return true;
    }
    
    if (!permissions) return false;

    // Verificar se tem permissão no módulo pai
    if (!permissions.relatorios) return false;
    
    // Verificar sub-permissão específica
    const subPermissionKey = `relatorios_${tabKey}` as keyof UserPermissions;
    
    // Se a sub-permissão não existe no banco, assume true (comportamento retrocompatível)
    const hasSubPermission = permissions[subPermissionKey];
    return hasSubPermission !== false; // true se undefined ou true
  }, [usuario, loading, permissions]);

  // Atualizar permissão de um módulo específico
  const updateModulePermission = async (userId: string, module: string, hasAccess: boolean) => {
    try {
      console.log(`🔄 Atualizando permissão: usuário ${userId}, módulo ${module}, acesso ${hasAccess}`);

      // Verifica se já existe um registro para (userId, module)
      const { data: existing, error: selectError } = await supabase
        .from('user_permissions')
        .select('id')
        .eq('user_id', userId)
        .eq('module_name', module)
        .maybeSingle();

      if (selectError) {
        console.warn('⚠️ Erro ao verificar permissão existente (seguindo com upsert manual):', selectError);
      }

      let error = null as any;

      if (existing?.id) {
        // Atualiza registro existente
        ({ error } = await supabase
          .from('user_permissions')
          .update({ has_access: hasAccess })
          .eq('id', existing.id));
      } else {
        // Cria novo registro
        ({ error } = await supabase
          .from('user_permissions')
          .insert({
            user_id: userId,
            module_name: module,
            has_access: hasAccess
          }));
      }

      if (error) {
        console.error('Erro ao atualizar permissão:', error);
        return false;
      }

      console.log('✅ Permissão atualizada com sucesso no banco de dados');
      await loadCurrentUserPermissions();
      return true;
    } catch (error) {
      console.error('Erro ao atualizar permissão:', error);
      return false;
    }
  };

  // Atualizar todas as permissões de um usuário
  const updateAllPermissions = async (userId: string, hasAccess: boolean) => {
    try {
      const modules = [
        'clientes', 'servicos', 'produtos', 'vendas', 'comissoes', 'relatorios', 'despesas', 'configuracoes',
        // Incluir sub-permissões de relatórios
        ...RELATORIOS_TABS.map(tab => `relatorios_${tab.key}`)
      ];

      // Atualiza/cria permissões módulo a módulo (evita dependência de índice único)
      const results = await Promise.all(
        modules.map((module) => updateModulePermission(userId, module, hasAccess))
      );

      const success = results.every((r) => r === true);
      if (success) {
        await loadCurrentUserPermissions();
      }
      return success;
    } catch (error) {
      console.error('Erro ao atualizar todas as permissões:', error);
      return false;
    }
  };

  // Atualizar todas as sub-permissões de relatórios de um usuário
  const updateAllReportTabPermissions = async (userId: string, hasAccess: boolean) => {
    try {
      const subModules = RELATORIOS_TABS.map(tab => `relatorios_${tab.key}`);

      const results = await Promise.all(
        subModules.map((module) => updateModulePermission(userId, module, hasAccess))
      );

      return results.every((r) => r === true);
    } catch (error) {
      console.error('Erro ao atualizar sub-permissões de relatórios:', error);
      return false;
    }
  };

  // Carregar permissões quando usuário muda
  useEffect(() => {
    loadCurrentUserPermissions();
  }, [usuario?.id]);

  // Configurar listener para mudanças em tempo real
  useEffect(() => {
    if (!usuario) return;

    const permissionsChannel = supabase
      .channel('user_permissions_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_permissions',
          filter: `user_id=eq.${usuario.id}`
        },
        (payload) => {
          console.log('🔄 TEMPO REAL - Permissão alterada:', payload);
          // Recarregar permissões quando houver mudanças para o usuário atual
          loadCurrentUserPermissions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(permissionsChannel);
    };
  }, [usuario?.id]);

  return {
    permissions,
    loading,
    updateModulePermission,
    updateAllPermissions,
    updateAllReportTabPermissions,
    hasCurrentUserPermission,
    hasReportTabPermission,
    loadPermissions: loadCurrentUserPermissions,
    RELATORIOS_TABS,
  };
};