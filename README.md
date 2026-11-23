# Meu Painel

Sistema pessoal da Carol: resumo do dia, hábitos, agenda, metas, finanças, feira do mês, casa, Marina, Kiara e Diana.
Mesmo formato do Sistema Linéa: `index.html` publicado no Netlify, dados no Supabase, entrada com e-mail e senha.

## Montagem
1. Supabase: rodar `supabase/schema.sql` no SQL Editor.
2. Colar a Project URL e a Publishable key no topo do script do `index.html` (SUPABASE_URL / SUPABASE_KEY).
3. Authentication > Users > Add user (Auto Confirm) com o e-mail da Carol.
4. Netlify: publicar a pasta (sem build).
5. Briefing: publicar `supabase/functions/briefing` com Verify JWT desligado; secrets RESEND_API_KEY, BRIEFING_SEGREDO, SITE_URL;
   no SQL: `select vault.create_secret('<mesmo segredo>', 'briefing_segredo');` e depois rodar `supabase/cron.sql`.
