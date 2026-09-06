-- ═══════════════════════════════════════════════════════════════
-- 公众号成长日志 · Supabase 一次性部署脚本
-- ───────────────────────────────────────────────────────────────
-- 使用方法：
--   1. 登录 https://supabase.com → 进入你的项目
--   2. 左侧菜单 SQL Editor → New query
--   3. 【先把下方第 ② 步中的口令改成你自己的】再整段粘贴运行
--   4. 运行成功后，把 Project URL 和 anon key 填入 config.js
--
-- 安全设计：
--   · log_data / app_config 两张表开启了 RLS 且未放行任何策略，
--     anon key 无法直接读写表 —— 数据只能通过下方两个 RPC 函数访问
--   · RPC 函数内部校验口令的 bcrypt 哈希，口令本身不以明文入库
--   · config.js 中的 anon key 本来就是公开密钥，泄露无风险
-- ═══════════════════════════════════════════════════════════════

-- ① 启用加密扩展（用于口令哈希）
create extension if not exists pgcrypto;

-- ② 设置你的访问口令（★ 把 '改成你的口令' 换掉，建议 8 位以上 ★）
--    以后想改口令，重新运行这一段 insert ... on conflict 即可。
create table if not exists public.app_config (
  id            int  primary key default 1,
  passcode_hash text not null
);
insert into public.app_config (id, passcode_hash)
values (1, crypt('改成你的口令', gen_salt('bf')))
on conflict (id) do update set passcode_hash = excluded.passcode_hash;

-- ③ 数据表（单行整包存储，payload 为 JSON）
create table if not exists public.log_data (
  id         int         primary key default 1,
  payload    jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ④ 锁死两张表：开启 RLS 且不放行任何策略，并收回直接权限
alter table public.log_data  enable row level security;
alter table public.app_config enable row level security;
revoke all on public.log_data   from anon, authenticated;
revoke all on public.app_config from anon, authenticated;

-- ⑤ RPC：校验口令 → 读取数据
create or replace function public.sync_get(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions   -- Supabase 默认把 pgcrypto 装在 extensions schema
as $$
declare
  result jsonb;
begin
  if not exists (
    select 1 from app_config
    where id = 1 and passcode_hash = crypt(p_code, passcode_hash)
  ) then
    raise exception 'ACCESS_DENIED';
  end if;
  select payload into result from log_data where id = 1;
  return coalesce(result, '{}'::jsonb);
end;
$$;

-- ⑥ RPC：校验口令 → 保存数据（整包覆盖）
create or replace function public.sync_save(p_code text, p_payload jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = public, extensions   -- Supabase 默认把 pgcrypto 装在 extensions schema
as $$
declare
  new_ts timestamptz;
begin
  if not exists (
    select 1 from app_config
    where id = 1 and passcode_hash = crypt(p_code, passcode_hash)
  ) then
    raise exception 'ACCESS_DENIED';
  end if;
  insert into log_data (id, payload, updated_at)
  values (1, p_payload, now())
  on conflict (id) do update
    set payload = excluded.payload,
        updated_at = now();
  select updated_at into new_ts from log_data where id = 1;
  return new_ts;
end;
$$;

-- ⑦ 只放行这两个函数的执行权限
grant execute on function public.sync_get(text)              to anon;
grant execute on function public.sync_save(text, jsonb)      to anon;

-- 完成！接下来把 Project URL 和 anon key 填入 config.js，
-- 然后访问你的网站，输入刚才设置的口令即可开始云端同步。
