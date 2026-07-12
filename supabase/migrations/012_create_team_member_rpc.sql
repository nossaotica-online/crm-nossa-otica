-- ============================================================
-- CRM Vittus - Migration 012: RPC function to create team members
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_team_member(
  p_email TEXT,
  p_password TEXT,
  p_nome TEXT,
  p_cargo TEXT,
  p_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_encrypted_pw TEXT;
BEGIN
  -- Verificar se já existe na tabela de usuários auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário com este e-mail já existe.');
  END IF;

  -- Encriptar a senha usando bcrypt
  v_encrypted_pw := crypt(p_password, gen_salt('bf'));

  -- Inserir em auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    v_encrypted_pw,
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('nome', p_nome),
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO v_user_id;

  -- Inserir em auth.identities
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_user_id,
    jsonb_build_object('sub', v_user_id, 'email', p_email),
    'email',
    now(),
    now(),
    now()
  );

  -- Atualizar ou inserir o profile
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
    UPDATE public.profiles
    SET 
      nome = p_nome,
      cargo = p_cargo,
      role = p_role
    WHERE id = v_user_id;
  ELSE
    INSERT INTO public.profiles (id, nome, email, cargo, role, ativo)
    VALUES (v_user_id, p_nome, p_email, p_cargo, p_role, true);
  END IF;

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execution to authenticated users (admins/vendedores)
REVOKE EXECUTE ON FUNCTION public.create_team_member FROM public;
GRANT EXECUTE ON FUNCTION public.create_team_member TO authenticated;
