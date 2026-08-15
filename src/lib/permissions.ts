import type { UserRole } from '@/types';

// Cada tela do CRM é uma chave marcável na tela de Equipe (migration 030).
export type PermissionKey =
  | 'inicio'
  | 'clientes'
  | 'ordens'
  | 'calendario'
  | 'vendas'
  | 'metas'
  | 'equipe'
  | 'configuracoes';

export const PERMISSION_KEYS: PermissionKey[] = [
  'inicio', 'clientes', 'ordens', 'calendario',
  'vendas', 'metas', 'equipe', 'configuracoes',
];

// O que a dona lê na lista de marcar. Nome da tela + o que muda na prática,
// para a escolha não depender de adivinhar o que cada palavra cobre.
export const PERMISSION_LABELS: Record<PermissionKey, { nome: string; ajuda: string }> = {
  inicio: { nome: 'Painel de início', ajuda: 'A tela de abertura, com os números do dia e as tarefas.' },
  clientes: { nome: 'Clientes', ajuda: 'Cadastro dos clientes da ótica, receita e grau.' },
  ordens: { nome: 'Ordem de Serviço', ajuda: 'Abrir e acompanhar O.S. Inclui o valor da própria O.S.' },
  calendario: { nome: 'Calendário e Tarefas', ajuda: 'Agenda de atendimentos e as tarefas do dia.' },
  vendas: { nome: 'Orçamentos', ajuda: 'Faturamento e orçamentos avulsos — o dinheiro da loja.' },
  metas: { nome: 'Metas', ajuda: 'Metas da equipe e quanto já foi batido.' },
  equipe: { nome: 'Equipe', ajuda: 'Só para administradora: criar acessos e mudar permissões.' },
  configuracoes: { nome: 'Configurações', ajuda: 'Só para administradora: ajustes do sistema.' },
};

// Telas que só fazem sentido para quem administra o sistema.
export const ADMIN_ONLY: PermissionKey[] = ['equipe', 'configuracoes'];

// Rota -> chave. O que não está aqui, todo mundo logado acessa.
export const ROUTE_PERMISSION: Record<string, PermissionKey> = {
  '/': 'inicio',
  '/clientes': 'clientes',
  '/ordens': 'ordens',
  '/calendario': 'calendario',
  '/vendas': 'vendas',
  '/metas': 'metas',
  '/equipe': 'equipe',
  '/configuracoes': 'configuracoes',
};

// Como era antes da 030: acesso decidido pelo cargo. Continua valendo
// enquanto a migration não roda no Supabase — sem isso o CRM ficaria sem
// nenhuma tela no intervalo entre publicar o código e rodar a migration.
export const ROUTE_ROLES: Record<string, UserRole[]> = {
  '/': ['admin', 'gestor', 'vendedor', 'consultor'],
  '/vendas': ['admin', 'gestor', 'vendedor', 'consultor'],
  '/equipe': ['admin'],
  '/configuracoes': ['admin'],
  '/metas': ['admin', 'gestor'],
};

// Para onde vai quem não pode ver o painel de início.
export const HOME_BY_ROLE: Partial<Record<UserRole, string>> = {
  funcionario: '/ordens',
};

/** O que o app sabe sobre o acesso de quem está logada. */
export interface AccessProfile {
  role: UserRole | null;
  /** `null` = a migration 030 ainda não rodou; cai na regra por cargo. */
  permissoes: PermissionKey[] | null;
  pode_excluir?: boolean;
  ve_tudo?: boolean;
}

const asAccess = (access: UserRole | AccessProfile | null): AccessProfile =>
  (access === null || typeof access === 'string')
    ? { role: access, permissoes: null }
    : access;

/** A rota casa exata ou é uma sub-rota? '/' precisa casar exato, senão
 *  prefixaria todas as outras. */
const routeMatches = (route: string, pathname: string) =>
  route === '/' ? pathname === '/' : pathname === route || pathname.startsWith(`${route}/`);

const routeKeyFor = (pathname: string) =>
  Object.keys(ROUTE_PERMISSION).find((route) => routeMatches(route, pathname));

export const canAccessRoute = (
  pathname: string,
  access: UserRole | AccessProfile | null,
) => {
  const { role, permissoes } = asAccess(access);

  // Administradora entra em tudo, marcação nenhuma tira isso dela: é o que
  // impede a loja de ficar sem ninguém capaz de corrigir um acesso.
  if (role === 'admin') return true;

  if (permissoes === null) {
    const route = Object.keys(ROUTE_ROLES).find((r) => routeMatches(r, pathname));
    const allowed = route ? ROUTE_ROLES[route] : undefined;
    return !allowed || Boolean(role && allowed.includes(role));
  }

  const route = routeKeyFor(pathname);
  if (!route) return true;
  const chave = ROUTE_PERMISSION[route];
  if (ADMIN_ONLY.includes(chave)) return false;
  return permissoes.includes(chave);
};

/** Primeira tela que a pessoa consegue abrir — usada logo depois do login,
 *  para ninguém cair num "acesso não autorizado" sem ter feito nada.
 *  `null` quando não sobrou tela nenhuma: aí o aviso na tela é a resposta
 *  certa, e não um redirecionamento para uma página que também barra. */
export const homeRouteFor = (access: UserRole | AccessProfile | null): string | null => {
  const normalized = asAccess(access);
  if (canAccessRoute('/', normalized)) return '/';

  if (normalized.permissoes === null) {
    return (normalized.role && HOME_BY_ROLE[normalized.role]) || null;
  }

  const ordem = ['/clientes', '/ordens', '/calendario', '/vendas', '/metas'];
  return ordem.find((rota) => canAccessRoute(rota, normalized)) || null;
};

/** Marcação padrão de um acesso novo: o balcão da ótica, que é o caso
 *  comum. A administradora ajusta na hora de criar. */
export const DEFAULT_PERMISSIONS: PermissionKey[] = ['clientes', 'ordens', 'calendario'];
