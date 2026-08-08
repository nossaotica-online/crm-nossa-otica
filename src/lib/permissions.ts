import type { UserRole } from '@/types';

// Telas com dono. O que não está aqui, todo mundo logado acessa.
// O balcão ('funcionario') fica de fora do painel de início e de tudo que
// mostra dinheiro — o menu esconde, e as policies do banco (migration 029)
// é que barram de verdade.
export const ROUTE_ROLES: Record<string, UserRole[]> = {
  '/': ['admin', 'gestor', 'vendedor', 'consultor'],
  '/vendas': ['admin', 'gestor', 'vendedor', 'consultor'],
  '/leads': ['admin', 'gestor', 'vendedor', 'consultor'],
  '/equipe': ['admin'],
  '/configuracoes': ['admin'],
  '/metas': ['admin', 'gestor'],
};

// Para onde vai quem não pode ver o painel de início.
export const HOME_BY_ROLE: Partial<Record<UserRole, string>> = {
  funcionario: '/ordens',
};

export const canAccessRoute = (pathname: string, role: UserRole | null) => {
  // '/' é o painel: casa exato, senão prefixaria todas as rotas.
  const allowed = pathname === '/'
    ? ROUTE_ROLES['/']
    : Object.entries(ROUTE_ROLES)
      .find(([route]) => route !== '/' && pathname.startsWith(route))?.[1];
  return !allowed || Boolean(role && allowed.includes(role));
};
