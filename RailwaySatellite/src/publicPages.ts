import { Request, Response } from 'express';

/** Página do formulário (HTML mínimo + fetch à API pública) */
export function renderFormPage(req: Request, res: Response): void {
  const base = '';
  res.type('html').send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Chegada — ERP</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:560px;margin:24px auto;padding:0 16px;background:#f8fafc;color:#0f172a}
    h1{font-size:1.35rem}
    label{display:block;margin:12px 0 4px;font-weight:600}
    input,select,textarea{width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;box-sizing:border-box}
    button{margin-top:20px;width:100%;padding:12px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer}
    .err{color:#b91c1c;margin-top:8px}
    .desc{color:#64748b;font-size:0.95rem;margin-bottom:16px}
  </style>
</head>
<body>
  <div id="app"><p>Carregando formulário…</p></div>
  <script>
    const slug = ${JSON.stringify(req.params.publicSlug)};
    const app = document.getElementById('app');
    async function load() {
      const r = await fetch('${base}/api/public/form/' + encodeURIComponent(slug));
      if (!r.ok) {
        let detail = '';
        try { const j = await r.clone().json(); if (j && j.error) detail = String(j.error); } catch (e) {}
        const idHint = slug.indexOf('fd-') === 0 ? slug.replace(/^fd-/, '') : slug;
        app.innerHTML = '<p class="err">Não foi possível carregar o formulário' + (r.status ? ' (HTTP ' + r.status + ')' : '') + (detail ? ': ' + escape(detail) : '') + '.</p>' +
          '<p class="muted">O slug <code>' + escape(slug) + '</code> corresponde ao formulário de id <strong>' + escape(idHint) + '</strong> no ERP. Precisa estar <strong>publicado</strong> e o ERP precisa ter enviado o snapshot ao satélite (reinicie o backend após ~5s ou grave de novo o formulário).</p>';
        return;
      }
      const j = await r.json();
      const f = j.data.formulario;
      const forns = j.data.fornecedores || [];
      let html = '<h1>' + escape(f.title) + '</h1>';
      if (f.description) html += '<p class="desc">' + escape(f.description) + '</p>';
      html += '<form id="f">';
      html += '<label>Nome do motorista *</label><input name="driver_name" required />';
      html += '<label>Telefone</label><input name="phone_number" />';
      html += '<label>Fornecedor *</label><select id="fornecedor_id_select" name="fornecedor_id" required><option value="">Selecione</option>';
      forns.forEach(function(x) {
        html += '<option value="' + x.id + '">' + escape(x.name) + ' (' + escape(x.category) + ')</option>';
      });
      html += '</select>';
      (f.fields || []).forEach(function(field) {
        const req = field.required ? ' required' : '';
        html += '<label>' + escape(field.label) + (field.required ? ' *' : '') + '</label>';
        if (field.type === 'textarea') {
          html += '<textarea name="' + escAttr(field.name) + '"' + req + '></textarea>';
        } else if (field.type === 'select' && field.options) {
          html += '<select name="' + escAttr(field.name) + '"' + req + '><option value="">Selecione</option>';
          field.options.forEach(function(opt) {
            html += '<option value="' + escAttr(opt) + '">' + escape(opt) + '</option>';
          });
          html += '</select>';
        } else {
          const t = field.type === 'number' ? 'number' : 'text';
          html += '<input type="' + t + '" name="' + escAttr(field.name) + '"' + req + ' />';
        }
      });
      html += '<button type="submit">Registrar chegada</button></form>';
      app.innerHTML = html;
      document.getElementById('f').onsubmit = async function(ev) {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const responses = {};
        (f.fields || []).forEach(function(field) {
          const v = fd.get(field.name);
          if (field.type === 'number') responses[field.name] = v === '' ? '' : Number(v);
          else if (field.type === 'checkbox') responses[field.name] = fd.get(field.name) === 'on';
          else responses[field.name] = v === null ? '' : String(v);
        });
        const body = {
          driver_name: fd.get('driver_name'),
          phone_number: fd.get('phone_number') || undefined,
          fornecedor_id: Number(fd.get('fornecedor_id')),
          responses: responses
        };
        const sr = await fetch('${base}/api/public/form/' + encodeURIComponent(slug) + '/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const sj = await sr.json().catch(function() { return {}; });
        if (!sr.ok) { alert(sj.error || 'Erro ao enviar'); return; }
        const tok = sj.data && sj.data.tracking_token;
        if (tok) location.href = '/t/' + encodeURIComponent(tok);
        else alert('Registrado.');
      };
      if (window.__fornecedorPoll) clearInterval(window.__fornecedorPoll);
      window.__fornecedorPoll = setInterval(async function() {
        const formEl = document.getElementById('f');
        const sel = document.getElementById('fornecedor_id_select');
        if (!formEl || !sel) return;
        try {
          const pr = await fetch('${base}/api/public/form/' + encodeURIComponent(slug));
          if (!pr.ok) return;
          const pj = await pr.json();
          const list = (pj.data && pj.data.fornecedores) ? pj.data.fornecedores : [];
          const cur = sel.value;
          let opts = '<option value="">Selecione</option>';
          list.forEach(function(x) {
            opts += '<option value="' + x.id + '">' + escape(x.name) + ' (' + escape(x.category) + ')</option>';
          });
          sel.innerHTML = opts;
          if (cur && list.some(function(x) { return String(x.id) === cur; })) sel.value = cur;
        } catch (e) { /* silencioso */ }
      }, 20000);
    }
    function escape(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }
    function escAttr(s) { return String(s).replace(/"/g, '&quot;'); }
    load();
  </script>
</body>
</html>`);
}

export function renderTrackingPage(req: Request, res: Response): void {
  res.type('html').send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Acompanhamento</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:520px;margin:24px auto;padding:0 16px;background:#f8fafc;color:#0f172a}
    .card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-top:12px}
    .muted{color:#64748b;font-size:0.9rem}
  </style>
</head>
<body>
  <h1>Acompanhamento</h1>
  <div id="app"><p class="muted">Carregando…</p></div>
  <script>
    const token = ${JSON.stringify(req.params.trackingToken)};
    const app = document.getElementById('app');
    async function load() {
      const r = await fetch('/api/public/tracking/' + encodeURIComponent(token));
      if (!r.ok) { app.innerHTML = '<p>Não encontrado.</p>'; return; }
      const j = await r.json();
      const x = j.data.response;
      const phase = x.phase || 'submitted';
      let msg = '';
      if (phase === 'dock_released') msg = 'Você foi liberado para descarregar na doca.';
      else if (phase === 'completed') msg = 'Descarga concluída. Obrigado!';
      else msg = 'Aguarde a liberação para descarregamento.';
      app.innerHTML = '<div class="card"><p><strong>' + escape(x.driver_name) + '</strong></p><p class="muted">Código: ' + escape(x.tracking_code) + '</p><p>' + msg + '</p>' + (x.message ? '<p class="muted">' + escape(x.message) + '</p>' : '') + '</div>';
    }
    function escape(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
    load();
    setInterval(load, 15000);
  </script>
</body>
</html>`);
}
