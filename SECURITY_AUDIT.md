# Auditoria de segurança — CRM Nossa Ótica

Data da auditoria: 2026-07-18

## Resumo executivo

A aplicação tinha RLS habilitado nas tabelas principais, mas a maior parte das
policies de `authenticated` usava `USING (true)`. Portanto, qualquer conta com
login — inclusive vendedor, consultor ou conta marcada como inativa — podia ler
ou alterar quase todos os dados. Havia ainda quatro falhas importantes:

1. As três policies de `notifications` foram criadas sem cláusula `TO`; no
   PostgreSQL isso significa `TO PUBLIC`, incluindo o role `anon`.
2. O RPC `create_team_member` podia ser executado por qualquer usuário
   autenticado e aceitava `p_role = 'admin'`: um vendedor podia criar outro
   administrador.
3. `profiles_update_own` não bloqueava mudanças nos campos `role` e `ativo`.
4. A checagem de `profiles.ativo` existia somente no layout React. Um JWT ainda
   válido continuava autorizado pelas policies do banco.

A migration
[`025_security_hardening_rls.sql`](supabase/migrations/025_security_hardening_rls.sql)
remove todas as policies anteriores, revoga grants de `anon`, exige conta ativa
no banco e recria o acesso por função/atribuição.

> Importante: o código do repositório está corrigido, mas o banco hospedado só
> muda depois que a migration 025 for aplicada. GET anônimo retornou
> `HTTP 200 []` nas 15 tabelas, porém a suíte completa falhou 31 verificações:
> PATCH/DELETE chegaram ao PostgREST com `204` e POST em `notifications`
> chegou à validação de campos (`400`) em vez de ser negado. Nenhuma linha
> válida foi enviada ou criada. Isso confirma que o banco hospedado ainda está
> com grants/policy antigos e que a migration 025 continua pendente.

## Estado encontrado antes da migration 025

Este é o estado final determinístico produzido pelas migrations 001–024,
aplicadas em ordem:

| Tabela | RLS | Policies efetivas antes da correção |
|---|---:|---|
| `profiles` | sim (009) | `profiles_select_authenticated`, `profiles_update_own`, `profiles_insert_admin`, `profiles_update_admin`, `profiles_delete_admin`, `profiles_select_own` (015) |
| `leads` | sim (009) | quatro policies `*_authenticated`; `leads_insert_anon` (011) foi removida pela 018 |
| `bookings` | sim (009) | quatro policies `*_authenticated`; `bookings_select_anon` e `bookings_insert_anon` (011) foram removidas pela 018 |
| `sales` | sim (009) | `sales_select_authenticated`, `sales_insert_authenticated`, `sales_update_authenticated`, `sales_delete_admin` |
| `goals` | sim (009) | `goals_select_authenticated` e três policies de escrita para admin/gestor |
| `tasks` | sim (013) | quatro policies `tasks_*_authenticated`, todas com expressão `true` |
| `clients` | sim (016) | quatro policies `clients_*_authenticated`, todas com expressão `true` |
| `service_orders` | sim (021) | quatro policies `service_orders_*_authenticated`, todas com expressão `true` |
| `activities` | sim (009) | select/insert para qualquer authenticated e delete para admin |
| `notifications` | sim (010) | `Enable read access for all users`, `Enable insert for all users`, `Enable update for all users`; todas `TO PUBLIC` |
| `schedule_config` | sim (009) | select para qualquer authenticated; escrita própria ou admin |
| `services` | sim (009) | leitura de serviços ativos; escrita de admin |
| `family_groups` | sim (016) | quatro policies authenticated com expressão `true` |
| `family_relationships` | sim (016) | quatro policies authenticated com expressão `true` |
| `client_prescriptions` | sim (017) | quatro policies authenticated com expressão `true` |

### Efeito exato das migrations destacadas

- `009_rls_policies.sql`: habilitou RLS nas tabelas existentes, mas concedeu
  acesso horizontal amplo a qualquer `authenticated`. As helpers
  `get_user_role`, `is_admin` e `is_admin_or_gestor` eram `SECURITY DEFINER` sem
  `search_path` fixo e sem considerar `ativo`.
- `011_allow_anon_inserts.sql`: adicionou INSERT anônimo irrestrito em `leads`,
  SELECT anônimo de todos os `bookings` e INSERT anônimo irrestrito em
  `bookings`.
- `015_add_profile_select_policy.sql`: permitiu que o usuário selecionasse o
  próprio profile mesmo inativo. Isso ajudava o front-end a detectar a
  desativação, mas não revogava acesso às demais tabelas.
- `018_remove_anon_access.sql`: removeu exatamente as três policies da 011.
  Não tocou nas três policies `PUBLIC` de `notifications`. Portanto essas eram
  as policies anônimas remanescentes e não intencionais.

Não foi encontrado formulário público direto no app atual. A tela de
configurações apenas documenta uma Edge Function `webhook-leads`; logo não há
justificativa atual para policy `anon` em tabelas. Uma futura captação pública
deve entrar por Edge Function com validação de schema, rate limit, CAPTCHA e
service role somente no ambiente secreto da função.

## Estado final definido pela migration 025

Toda policy abaixo é `TO authenticated`; nenhuma policy é criada para `anon`:

| Tabela | Usuário ativo comum | Admin/gestor |
|---|---|---|
| `profiles` | diretório de perfis ativos; atualiza o próprio perfil sem poder mudar `role`, `ativo`, `email` ou `id` | admin vê/gerencia todos; gestor não administra perfis |
| `leads` | próprios e não atribuídos; precisa assumir um lead para editá-lo | acesso total |
| `bookings` | somente `consultor_id = auth.uid()` | acesso total |
| `sales` | somente `vendedor_id = auth.uid()` | acesso total |
| `goals` | lê/atualiza a própria meta | acesso total |
| `tasks` | somente `responsavel_id = auth.uid()` | acesso total |
| `clients` | somente `responsavel_id = auth.uid()` | acesso total |
| `service_orders` | somente `vendedor_id = auth.uid()` | acesso total |
| `activities` | somente `user_id = auth.uid()` | acesso total |
| `notifications` | lê somente mensagens com `recipient_user_id = auth.uid()` | acesso total |
| `schedule_config` | lê disponibilidade da equipe; altera a própria agenda | acesso total |
| `services` | lê catálogo ativo | somente admin administra |
| tabelas auxiliares de clientes | somente dados ligados aos próprios clientes | acesso total |

As helpers `is_active_user`, `get_user_role`, `is_admin`,
`is_admin_or_gestor` e `can_access_client` consultam `profiles.ativo` em cada
requisição RLS. Assim, desativar uma conta passa a bloquear REST e operações no
banco mesmo enquanto o JWT ainda não expirou. Para desligamento completo,
também revogue as sessões/refresh tokens no Supabase Auth e force o cliente a
reconectar ao Realtime.

Todos os grants de tabela e sequência foram revogados de `anon` e `PUBLIC`.
As policies antigas são removidas por um bloco que lê `pg_policies`, evitando
que uma policy esquecida continue sendo combinada por `OR`.

### Dados antigos sem responsável

A migration adiciona `clients.responsavel_id` e `family_groups.created_by`.
Linhas antigas com `NULL` ficam visíveis somente a admin/gestor até a
atribuição. O mesmo vale para linhas antigas de tabelas que já tinham coluna de
responsável, mas estavam nulas.

Exemplo de inventário/backfill no SQL Editor:

```sql
SELECT id, nome, role FROM public.profiles WHERE ativo IS TRUE;

SELECT id, name FROM public.clients WHERE responsavel_id IS NULL;
UPDATE public.clients
SET responsavel_id = '<uuid-do-responsavel>'
WHERE responsavel_id IS NULL;

SELECT id, os_number, client_name
FROM public.service_orders
WHERE vendedor_id IS NULL;
UPDATE public.service_orders
SET vendedor_id = '<uuid-do-vendedor>'
WHERE vendedor_id IS NULL;
```

## Sessão Supabase em site estático

O projeto usava `createBrowserClient` de `@supabase/ssr`. Em GitHub Pages não
há servidor para emitir ou renovar um cookie HttpOnly; um cookie
`sb-*-auth-token` criado pelo JavaScript continua legível por JavaScript. Com
XSS, o atacante pode roubar o access token e o refresh token. `Secure` e
`SameSite` ajudam contra transporte/CSRF, mas não contra leitura por XSS quando
falta `HttpOnly`.

O cliente agora usa `@supabase/supabase-js` diretamente e persiste a sessão no
`localStorage` sob a chave `nossa-otica-auth`. Isso não torna o token imune a
XSS; apenas remove a falsa expectativa de proteção SSR/cookie e usa o fluxo
suportado para SPA estática.

A opção realmente mais forte exige migrar para hospedagem com servidor/BFF
(por exemplo Next.js SSR em Vercel/Netlify/Cloudflare Workers), manter sessão em
cookie `HttpOnly; Secure; SameSite=Lax/Strict` e fazer operações sensíveis no
servidor. Se o browser continuar precisando ler o token para falar diretamente
com Supabase, HttpOnly real não é possível.

## XSS, CSP e logs

- React já escapa strings interpoladas em JSX. O único
  `dangerouslySetInnerHTML` foi removido.
- URLs de reunião agora aceitam apenas HTTPS em Zoom, Google Meet ou Teams.
  Links de WhatsApp são construídos somente após normalização numérica.
- CSV recebeu proteção contra Formula Injection (`=`, `+`, `-`, `@`, tab/CR).
- A URL iCal secreta não é mais salva em `localStorage`; valores antigos são
  removidos. Essa integração deve ficar em Edge Function/backend.
- Foi adicionada CSP via `<meta http-equiv>` com `default-src 'self'`,
  `object-src 'none'`, `base-uri 'self'`, `frame-src 'none'` e `connect-src`
  limitado ao Supabase configurado.
- O build de produção usa `compiler.removeConsole`, removendo `console.*` do
  bundle.

Limitação: GitHub Pages não permite definir headers HTTP por repositório. A CSP
em `<meta>` não protege `frame-ancestors`, e o Next estático/estilos inline
exigem atualmente `'unsafe-inline'` em `script-src` e `style-src`. Para CSP com
nonce/hash, HSTS, `Permissions-Policy` e proteção de clickjacking via header,
use uma hospedagem que permita headers/SSR.

## Dependências

O projeto usava Next.js 14.2.21. `npm audit` encontrou uma vulnerabilidade
crítica direta no pacote `next` e uma moderada no `postcss` transitivo. O
projeto foi atualizado para Next.js 16.2.10, React/React DOM 19.2.7 e PostCSS
8.5.10 (override fixado). Depois da atualização:

```text
npm audit --omit=dev: 0 vulnerabilities
npm run lint: passou
npm run build: passou (13 páginas estáticas)
```

O workflow já usa Node 20; Next 16 exige Node 20.9 ou superior.

## Verificação do checklist “SaaS feito com vibe coding”

O checklist anexado mistura vulnerabilidades aplicáveis, riscos de produto e
módulos que este CRM não possui. O resultado objetivo é:

| Área | Resultado depois das correções | Risco/ação remanescente |
|---|---|---|
| Rotas e área administrativa | menu e acesso direto a `/equipe` e `/configuracoes` limitados a admin; `/metas` a admin/gestor | proteção real continua sendo RLS/RPC, não o React |
| Acesso horizontal | policies por `auth.uid()`, função e responsável | dados legados sem responsável exigem backfill |
| Conta inativa | verificada dentro de toda policy/RPC | revogue sessões ao desligar alguém para encerramento imediato do Realtime |
| Cadastro e e-mail | novos signups nascem `ativo = false`; recuperação de senha implementada | desative também “Allow new users to sign up” no painel Auth |
| Sessão | expiração local por 30 min de inatividade e limite de 12 h | em SPA, XSS ainda pode capturar o refresh token; SSR/BFF é a solução forte |
| Tentativas de login | Supabase Auth aplica limites da plataforma | habilite CAPTCHA se o login sofrer abuso direcionado |
| Exclusão administrativa | exclusão de profile pela API foi negada; equipe é desativada | definir política LGPD de retenção/anonimização e processo de revogação no Auth |
| Duplicidade | constraints/índices existentes para WhatsApp, família, agendamento e venda por O.S. | operações de integração futuras precisam chave de idempotência |
| Validação | limites de texto e valores não negativos adicionados no banco; URLs externas em allowlist | validar/sanear dados legados antes de marcar constraints como `VALID` |
| XSS | JSX escapa texto, caracteres de controle são removidos nos formulários centrais, URLs e CSV são tratados, CSP foi adicionada | CSP de GitHub Pages ainda precisa de `unsafe-inline`; migre de host para headers/nonces fortes |
| Erros | calendário preserva formulário em falha e mostra erro; página global permite retry | adotar observabilidade externa com remoção de PII; hoje não há coletor central |
| Auditoria | triggers registram ator, ação, tabela, registro e campos alterados, sem copiar valores pessoais | definir retenção e revisão periódica de `audit_logs` |
| Performance | Realtime recarrega só a tabela alterada; clientes já usam paginação visual | carga inicial ainda consulta tabelas inteiras; implementar paginação no servidor antes de escala |
| Datas | datas civis passaram a ser formatadas no fuso local, sem conversão acidental para UTC | padronizar horários de eventos como UTC + timezone se houver múltiplas regiões |
| Backup | não pode ser confirmado pelo repositório | confirmar backup recente/PITR no painel antes da aplicação em produção |
| Multiempresa | **não existe `organization_id` no schema** | o projeto está protegido como CRM de uma única ótica; não vender como multi-tenant antes de introduzir organização em todas as tabelas, policies, convites e Storage |
| Pagamentos/planos | não aplicável: não há cobrança, plano, cupom ou webhook de pagamento no repositório | deve passar por auditoria própria se esse módulo for criado |
| Uploads/arquivos | não há fluxo de upload nem bucket usado pelo app | criar buckets privados, RLS de Storage, limite e verificação de tipo antes de adicionar |
| Integrações | webhook público documentado mas inexistente foi removido da interface; segredo iCal saiu do browser | futuras Edge Functions precisam autenticação, rate limit, idempotência e logs sem PII |
| LGPD | logs novos não gravam conteúdo dos campos; exclusão direta de profile bloqueada | faltam política/termos, consentimento de comunicação, exportação, anonimização e procedimento de titular |
| Ambiente de teste | há teste REST anônimo e verificação SQL; CI executa tipo, audit, RLS e build | ainda não existe projeto Supabase de staging nem testes com dois usuários/roles |

### Limites que não devem ser mascarados

Este hardening não transforma o sistema em um SaaS multi-tenant, não cria
backup e não implementa governança LGPD por si só. Essas três frentes exigem
decisões de produto e infraestrutura. Também não há módulo de pagamentos a
testar; declarar cobrança “segura” seria incorreto.

## Chaves, `.gitignore` e histórico Git

- O front-end e o workflow usam somente
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, com prefixo `sb_publishable_`.
- Não foi encontrada referência ou valor de `service_role`/`sb_secret_` em
  nenhum arquivo rastreado ou em qualquer commit alcançável.
- O histórico contém apenas `.env.example`; não há `.env` real, PEM ou chave
  privada commitida.
- Existia uma `SUPABASE_SERVICE_ROLE_KEY` real no `.env.local` ignorado. Ela
  não estava no Git e foi removida do workspace. Não há evidência de exposição
  pelo repositório; se a origem/uso dessa chave for incerto, rotacione-a no
  painel do Supabase por precaução.
- `.gitignore` agora ignora `.env` e qualquer `.env.*`, exceto
  `.env.example`.

## Aplicação e verificação

Com Supabase CLI já configurada:

```bash
supabase link --project-ref ebulzypbvbdprztnhitf
supabase db push
```

Alternativamente, abra o SQL Editor do projeto e execute todo o conteúdo de:

```text
supabase/migrations/025_security_hardening_rls.sql
```

Depois execute:

```text
supabase/tests/verify_security.sql
```

E, no repositório:

```bash
npm run security:test-anon
```

O teste envia GET, POST inválido, PATCH sem correspondência e DELETE sem
correspondência, usando apenas a publishable key e nenhuma sessão de usuário.
Após a migration, leituras devem retornar `401/403` (ou `200 []`) e todas as
escritas devem retornar `401/403`.
