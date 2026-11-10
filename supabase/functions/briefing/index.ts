// =====================================================================
//  Vida da Carol — briefing da manhã por e-mail
//
//  Roda sozinho todo dia (agendado pelo supabase/cron.sql). Lê os dados
//  do sistema, monta o resumo do dia e manda por e-mail pelo Resend.
//
//  Segredos (Supabase > Edge Functions > Secrets):
//    RESEND_API_KEY      chave grátis do resend.com
//    BRIEFING_SEGREDO    a mesma senha guardada no Vault como "briefing_segredo"
//    BRIEFING_PARA       (opcional) e-mail que recebe; sem ele, usa o e-mail do login
//    SITE_URL            (opcional) endereço do site, para o botão do e-mail
//
//  Ao publicar a função, desligue "Verify JWT": quem protege a função é o
//  BRIEFING_SEGREDO, que só o agendamento conhece.
// =====================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';

const FUSO = 'America/Sao_Paulo';
const MES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const DIA = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];

type Item = { colecao: string; id: string; dados: Record<string, any>; dono: string };

function hojeISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
const parse = (s: string) => { const [a, b, c] = s.split('-').map(Number); return new Date(Date.UTC(a, b - 1, c || 1)); };
const dias = (s: string, hoje: string) => Math.round((parse(s).getTime() - parse(hoje).getTime()) / 864e5);
const brl = (v: unknown) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const quando = (s: string, hoje: string) => { const n = dias(s, hoje); return n === 0 ? 'hoje' : n === 1 ? 'amanhã' : n < 0 ? `atrasado ${-n} d` : `em ${n} dias`; };

function montar(itens: Item[], hoje: string, site: string) {
  const col = (c: string) => itens.filter((i) => i.colecao === c).map((i) => ({ id: i.id, ...i.dados }));
  const d = parse(hoje);
  const titulo = `${DIA[d.getUTCDay()]}, ${d.getUTCDate()} de ${MES[d.getUTCMonth()]}`;

  const agenda = col('compromissos').filter((c) => c.data === hoje).sort((a, b) => String(a.hora || '99').localeCompare(String(b.hora || '99')));
  const habitos = col('habitos').sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const lembretes: { q: string; t: string; d: string }[] = [];
  col('contas').forEach((c) => { if (!c.pago && c.vencimento && dias(c.vencimento, hoje) <= 3) lembretes.push({ q: 'Conta', t: `${c.descricao}${c.valor ? ' · ' + brl(c.valor) : ''}`, d: c.vencimento }); });
  col('marina').forEach((r) => { if (r.proxima && dias(r.proxima, hoje) <= 7) lembretes.push({ q: 'Marina', t: r.titulo, d: r.proxima }); });
  col('pets').forEach((r) => { if (r.proxima && dias(r.proxima, hoje) <= 7) lembretes.push({ q: r.pet, t: `${r.tipo}: ${r.titulo}`, d: r.proxima }); });
  lembretes.sort((a, b) => a.d.localeCompare(b.d));
  const metas = col('metas').map((m) => { const ms = m.marcos || []; return { ...m, p: ms.length ? ms.filter((x: any) => x.feito).length / ms.length : 0, prox: ms.find((x: any) => !x.feito) }; }).sort((a, b) => a.p - b.p);
  const meta = metas[0];
  const mes = hoje.slice(0, 7);
  const lanc = col('lancamentos').filter((l) => String(l.data || '').startsWith(mes));
  const rec = lanc.filter((l) => l.tipo === 'receita').reduce((s, l) => s + (+l.valor || 0), 0);
  const desp = lanc.filter((l) => l.tipo !== 'receita').reduce((s, l) => s + (+l.valor || 0), 0);
  const feira = col('feira').filter((f) => !f.comprado).length;

  const C = { creme: '#F5EFE6', bege: '#E6D5C3', areia: '#C9A98B', caramelo: '#A47551', cafe: '#5C3D2E', bordo: '#6D1A36', marsala: '#955251' };
  const sec = (t: string, corpo: string) => `<tr><td style="padding:18px 28px 4px"><div style="font-family:Georgia,serif;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:${C.bordo};font-weight:bold">${t}</div>${corpo}</td></tr>`;
  const li = (s: string) => `<div style="padding:7px 0;border-bottom:1px solid ${C.bege};font-size:15px">${s}</div>`;
  const vazio = (s: string) => `<div style="padding:7px 0;color:${C.caramelo};font-style:italic;font-size:14px">${s}</div>`;

  const html = `<!doctype html><html><body style="margin:0;background:${C.creme};font-family:Georgia,'Times New Roman',serif;color:${C.cafe}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.creme}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFDF9;border:1px solid ${C.bege};border-radius:12px">
<tr><td style="padding:28px 28px 12px;border-bottom:1px solid ${C.areia}">
<div style="font-size:30px;color:${C.bordo}">Bom dia, Carol</div>
<div style="font-style:italic;color:${C.caramelo};font-size:17px">${esc(titulo)}</div></td></tr>
${sec('Agenda de hoje', agenda.length ? agenda.map((c) => li(`${c.hora ? `<b>${esc(c.hora)}</b> · ` : ''}${esc(c.titulo)}`)).join('') : vazio('Nada marcado para hoje.'))}
${sec('Lembretes', lembretes.length ? lembretes.map((l) => li(`<span style="color:${C.caramelo}">${esc(l.q)}</span> · ${esc(l.t)} <span style="color:${C.marsala}">(${quando(l.d, hoje)})</span>`)).join('') : vazio('Nenhuma conta, vacina ou cuidado vencendo nos próximos dias.'))}
${sec('Hábitos de hoje', habitos.length ? habitos.map((h) => li(`☐ ${esc(h.nome)}`)).join('') : vazio('Nenhum hábito cadastrado.'))}
${meta ? sec('Meta em destaque', li(`<b>${esc(meta.titulo)}</b> · ${Math.round(meta.p * 100)}% feito${meta.prox ? `<br><span style="color:${C.caramelo}">Próxima etapa: ${esc(meta.prox.t)}</span>` : ''}`)) : ''}
${sec('Dinheiro no mês', li(`Gasto até agora: <b>${brl(desp)}</b> · Sobra: <b>${brl(rec - desp)}</b>`))}
${feira ? sec('Feira do mês', li(`Faltam ${feira} ${feira === 1 ? 'item' : 'itens'} na lista.`)) : ''}
<tr><td style="padding:22px 28px 28px">${site ? `<a href="${esc(site)}" style="display:inline-block;background:${C.bordo};color:${C.creme};text-decoration:none;padding:10px 20px;border-radius:999px;font-size:15px">Abrir a Vida da Carol</a>` : ''}</td></tr>
</table></td></tr></table></body></html>`;
  return { assunto: `Bom dia, Carol · ${titulo}`, html };
}

Deno.serve(async (req) => {
  const segredo = Deno.env.get('BRIEFING_SEGREDO');
  if (!segredo || req.headers.get('x-briefing-segredo') !== segredo) return new Response('não autorizado', { status: 401 });
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) return new Response('falta RESEND_API_KEY', { status: 500 });

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await sb.from('itens').select('colecao,id,dados,dono');
  if (error) return new Response('erro ao ler: ' + error.message, { status: 500 });

  const hoje = hojeISO();
  const site = Deno.env.get('SITE_URL') || '';
  const porDono = new Map<string, Item[]>();
  (data as Item[]).forEach((i) => { if (!porDono.has(i.dono)) porDono.set(i.dono, []); porDono.get(i.dono)!.push(i); });

  const enviados: string[] = [];
  for (const [dono, itens] of porDono) {
    let para = Deno.env.get('BRIEFING_PARA') || '';
    if (!para) { const u = await sb.auth.admin.getUserById(dono); para = u.data.user?.email || ''; }
    if (!para) continue;
    const { assunto, html } = montar(itens, hoje, site);
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Vida da Carol <onboarding@resend.dev>', to: [para], subject: assunto, html }),
    });
    if (!r.ok) return new Response('erro no envio: ' + (await r.text()), { status: 502 });
    enviados.push(para);
    if (Deno.env.get('BRIEFING_PARA')) break; // um e-mail só quando o destino é fixo
  }
  return new Response(JSON.stringify({ hoje, enviados }), { headers: { 'Content-Type': 'application/json' } });
});
