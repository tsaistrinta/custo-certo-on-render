/**
 * Custo Certo — Frontend
 *
 * Toda a persistência foi migrada de localStorage para chamadas fetch à API.
 * O fluxo permanece o mesmo da versão anterior; o que mudou foi a fonte da verdade,
 * que agora é o servidor (e portanto compartilhada entre todos os dispositivos).
 *
 * A constante API_BASE em branco faz o fetch usar o mesmo origin da página —
 * funciona automaticamente quando o backend serve o index.html.
 * Para apontar para outro host (ex: dev local com frontend separado), edite aqui.
 */

const API_BASE = ''; // mesmo origin

// ======= LOGO (mantido como estava) =======
document.getElementById('sidebar-logo').src =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="%2300a86b"/><text x="32" y="40" font-size="24" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold">CC</text></svg>';

// ======= ESTADO =======
let estoque = [];
let historico = [];
let pesoAtual = 0;
let intervaloPeso = null;
let chartComp, chartStatus, chartCMV, chartEvolucao;
let evolucaoFiltro = 'todos';
let compraIdAtual = null;

// ======= HELPERS DE API =======
async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const data = await res.json();
      msg = data.erro || msg;
    } catch (_) {
      // resposta não-JSON
    }
    throw new Error(msg);
  }

  // 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

// ======= CARREGAMENTO INICIAL =======
async function carregarDados() {
  try {
    const [ings, hist] = await Promise.all([
      api('/ingredientes'),
      api('/ingredientes/historico'),
    ]);
    estoque = ings;
    historico = hist;
  } catch (err) {
    console.error('Falha ao carregar dados:', err);
    showToast('Erro ao conectar ao servidor: ' + err.message, true);
  }
}

// ======= RELÓGIO =======
function updateClock() {
  const n = new Date();
  document.getElementById('clock').textContent = n.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
setInterval(updateClock, 1000);
updateClock();

// ======= NAVEGAÇÃO =======
const pageTitles = {
  dashboard: 'Dashboard',
  balanca: 'Balança Inteligente',
  estoque: 'Estoque',
  evolucao: 'Evolução de Preços',
};

async function showPage(page, btn) {
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  btn.classList.add('active');
  document.getElementById('topbar-title').textContent = pageTitles[page];

  // Recarrega antes de renderizar para refletir mudanças de outras abas/dispositivos
  await carregarDados();

  if (page === 'balanca') popularSelect();
  if (page === 'estoque') renderEstoque();
  if (page === 'dashboard') renderDashboard();
  if (page === 'evolucao') renderEvolucao();
}
window.showPage = showPage;

// ======= UTILITÁRIOS =======
function safeDestroy(chart) {
  try {
    if (chart) chart.destroy();
  } catch (e) {
    /* ignore */
  }
}

const COLORS = ['#00a86b', '#3a86ff', '#f4a435', '#e63946', '#7b5ea7', '#2ec4b6', '#ff6b6b'];

function fmtQtd(v, u) {
  return u === 'g' || u === 'ml'
    ? Math.round(v).toString()
    : parseFloat(v.toFixed(3)).toString();
}

function formatDate(d) {
  if (!d) return '—';
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
}

function getExpiryInfo(d) {
  if (!d) return { cls: 'expiry-ok', label: 'sem validade' };
  const diff = Math.ceil((new Date(d) - new Date()) / 86400000);
  if (diff < 0) return { cls: 'expiry-bad', label: 'VENCIDO' };
  if (diff <= 7) return { cls: 'expiry-warn', label: `vence em ${diff}d` };
  return { cls: 'expiry-ok', label: `${diff} dias restantes` };
}

// ======= DASHBOARD =======
function renderDashboard() {
  const totalVal = estoque.reduce((s, i) => s + i.preco * i.qtd, 0);
  const alertas = estoque.filter((i) => i.qtdMax > 0 && i.qtd / i.qtdMax < 0.25).length;
  const vencendo = estoque.filter((i) => {
    if (!i.validade) return false;
    const diff = Math.ceil((new Date(i.validade) - new Date()) / 86400000);
    return diff >= 0 && diff <= 7;
  }).length;

  document.getElementById('kpi-estoque').textContent =
    'R$ ' +
    totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  document.getElementById('kpi-itens').textContent =
    estoque.length + ' itens cadastrados';
  document.getElementById('kpi-alerta').textContent = alertas;
  document.getElementById('kpi-alerta-sub').textContent =
    alertas > 0 ? alertas + ' abaixo de 25% do estoque' : 'Todos dentro do limite';
  document.getElementById('kpi-vencendo').textContent = vencendo;

  const receitaEst = totalVal * 3.5;
  const cmvPct = receitaEst > 0 ? (totalVal / receitaEst) * 100 : 0;
  const cmvClass = cmvPct <= 31 ? 'ok' : cmvPct <= 35 ? 'warn' : 'bad';
  document.getElementById('kpi-cmv').textContent = cmvPct.toFixed(1) + '%';

  document.getElementById('g-custo').textContent =
    'R$ ' + totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  document.getElementById('g-receita').textContent =
    'R$ ' + receitaEst.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  document.getElementById('g-cmv').textContent = cmvPct.toFixed(1) + '%';
  document.getElementById('g-cmv').className = 'val ' + cmvClass;
  document.getElementById('g-class').textContent =
    cmvClass === 'ok' ? '✓ Dentro do ideal' : cmvClass === 'warn' ? '⚠ Levemente alto' : '✗ Acima do limite';
  document.getElementById('g-class').className = 'val ' + cmvClass;

  // Rotatividade (DOM puro)
  const rl = document.getElementById('rotate-list');
  if (rl) {
    rl.innerHTML = estoque
      .map((i) => {
        const pct = i.qtdMax > 0 ? Math.min(100, Math.round((i.qtd / i.qtdMax) * 100)) : 0;
        const cls = pct > 50 ? 'bar-ok' : pct > 25 ? 'bar-mid' : 'bar-low';
        return `<div class="rotate-item">
          <div class="rotate-header"><span>${i.nome}</span><span style="font-weight:700;font-family:'Syne',sans-serif">${pct}%</span></div>
          <div class="rotate-bar-bg"><div class="rotate-bar-fill ${cls}" style="width:${pct}%"></div></div>
        </div>`;
      })
      .join('');
  }

  // Charts (mantidos como o original)
  renderDashboardCharts(estoque);
}

function renderDashboardCharts(estoque) {
  // Composição
  const ctxComp = document.getElementById('chart-composicao');
  if (ctxComp) {
    safeDestroy(chartComp);
    chartComp = new Chart(ctxComp, {
      type: 'doughnut',
      data: {
        labels: estoque.map((i) => i.nome),
        datasets: [
          {
            data: estoque.map((i) => i.preco * i.qtd),
            backgroundColor: estoque.map((_, idx) => COLORS[idx % COLORS.length]),
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: 'DM Sans', size: 11 } } },
        },
      },
    });
  }

  // Status do estoque
  const ctxStatus = document.getElementById('chart-status');
  if (ctxStatus) {
    safeDestroy(chartStatus);
    chartStatus = new Chart(ctxStatus, {
      type: 'bar',
      data: {
        labels: estoque.map((i) => i.nome),
        datasets: [
          {
            label: '% do estoque',
            data: estoque.map((i) =>
              i.qtdMax > 0 ? Math.min(100, Math.round((i.qtd / i.qtdMax) * 100)) : 0,
            ),
            backgroundColor: estoque.map((i) => {
              const p = i.qtdMax > 0 ? i.qtd / i.qtdMax : 0;
              return p > 0.5
                ? 'rgba(0,168,107,0.75)'
                : p > 0.25
                ? 'rgba(244,164,53,0.75)'
                : 'rgba(230,57,70,0.75)';
            }),
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + '%' } },
        },
      },
    });
  }

  // CMV histórico (placeholder)
  const ctxCMV = document.getElementById('chart-cmv');
  if (ctxCMV) {
    safeDestroy(chartCMV);
    chartCMV = new Chart(ctxCMV, {
      type: 'line',
      data: {
        labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
        datasets: [
          {
            label: 'CMV %',
            data: [32, 31, 30, 33, 29, 28],
            borderColor: '#00a86b',
            backgroundColor: 'rgba(0,168,107,0.1)',
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
      },
    });
  }
}

// ======= EVOLUÇÃO DE PREÇOS =======
function renderEvolucao() {
  const ctx = document.getElementById('chart-evolucao');
  if (!ctx) return;

  // Agrupa histórico por produto e ordena por data
  const porProduto = {};
  historico.forEach((h) => {
    if (!porProduto[h.produtoId]) {
      porProduto[h.produtoId] = { nome: h.nome, unidade: h.unidade, pontos: [] };
    }
    porProduto[h.produtoId].pontos.push({ data: h.data, preco: h.preco });
  });

  const datasetsTodos = Object.entries(porProduto).map(([pid, info], idx) => {
    info.pontos.sort((a, b) => a.data.localeCompare(b.data));
    return {
      label: info.nome,
      data: info.pontos.map((p) => ({ x: p.data, y: p.preco })),
      borderColor: COLORS[idx % COLORS.length],
      backgroundColor: COLORS[idx % COLORS.length] + '33',
      tension: 0.3,
      fill: false,
    };
  });

  const datasets =
    evolucaoFiltro === 'todos'
      ? datasetsTodos
      : datasetsTodos.filter((d) => d.label === evolucaoFiltro);

  safeDestroy(chartEvolucao);
  chartEvolucao = new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'DM Sans', size: 11 } } },
        tooltip: {
          callbacks: {
            title: (items) => 'Data: ' + items[0].label,
            label: (item) => `${item.dataset.label}: R$ ${item.parsed.y.toFixed(2)}/un`,
          },
          backgroundColor: '#fff',
          titleColor: '#1a1d2e',
          bodyColor: '#1a1d2e',
          borderColor: '#e8eaf0',
          borderWidth: 1,
          padding: 10,
        },
      },
      scales: {
        x: { type: 'category', ticks: { font: { family: 'DM Sans', size: 11 } }, grid: { color: '#f0f2f8' } },
        y: {
          ticks: { callback: (v) => 'R$ ' + v.toFixed(2), font: { family: 'DM Sans', size: 11 } },
          grid: { color: '#f0f2f8' },
        },
      },
    },
  });

  // Tabela histórico
  const tbody = document.getElementById('historico-tbody');
  if (tbody) {
    const sortedH = [...historico].sort((a, b) => b.data.localeCompare(a.data));
    tbody.innerHTML = sortedH
      .map(
        (h) => `
        <tr>
          <td>${formatDate(h.data)}</td>
          <td style="font-weight:600">${h.nome}</td>
          <td>${h.unidade}</td>
          <td>${h.qtd} ${h.unidade}</td>
          <td class="val-col">R$ ${h.preco.toFixed(2)}</td>
          <td class="val-col">R$ ${(h.preco * h.qtd).toFixed(2)}</td>
        </tr>`,
      )
      .join('');
  }
}

function setFiltroEvolucao(val, btn) {
  evolucaoFiltro = val;
  document.querySelectorAll('.evolucao-filtro-btn').forEach((b) => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderEvolucao();
}
window.setFiltroEvolucao = setFiltroEvolucao;

// ======= BALANÇA =======
function iniciarLeituraPeso() {
  if (intervaloPeso) return;

  intervaloPeso = setInterval(async () => {
    try {
      const data = await api('/balanca/peso');
      if (typeof data.peso === 'number') {
        pesoAtual = data.peso;
        atualizarDisplay();
      }
    } catch (err) {
      console.error('Erro ao buscar peso:', err);
    }
  }, 500);
}

function getIngredienteSelecionado() {
  const id = Number(document.getElementById('select-ingrediente').value);
  return estoque.find((i) => i.id === id) || null;
}

function atualizarDisplay() {
  const ing = getIngredienteSelecionado();
  let peso = Math.max(0, pesoAtual);
  let valor = peso.toFixed(3);
  let unidade = 'kg';

  if (ing) {
    if (ing.unidade === 'g') {
      valor = (peso * 1000).toFixed(1);
      unidade = 'g';
    } else if (ing.unidade === 'ml') {
      valor = (peso * 1000).toFixed(0);
      unidade = 'ml';
    } else if (ing.unidade === 'un') {
      valor = Math.round(peso * 10);
      unidade = 'un';
    } else {
      unidade = ing.unidade;
    }
  }

  document.getElementById('peso-display').textContent = valor;
  document.getElementById('unidade-display').textContent = unidade;

  document.getElementById('btn-confirmar').disabled = !(ing && peso > 0.001);

  if (ing) atualizarTabelaCusto(ing, peso);
}

function atualizarTabelaCusto(ing, peso) {
  const el = document.getElementById('tabela-custo');
  if (!el) return;

  let consumoUnidade = peso;
  if (ing.unidade === 'g' || ing.unidade === 'ml') consumoUnidade = peso * 1000;

  const custo = consumoUnidade * ing.preco;
  el.innerHTML = `
    <div><strong>${ing.nome}</strong></div>
    <div>Quantidade: ${fmtQtd(consumoUnidade, ing.unidade)} ${ing.unidade}</div>
    <div>Preço unitário: R$ ${ing.preco.toFixed(2)}/${ing.unidade}</div>
    <div style="margin-top:8px;font-size:1.2em"><strong>Custo: R$ ${custo.toFixed(2)}</strong></div>
  `;
}

function popularSelect() {
  iniciarLeituraPeso();

  const sel = document.getElementById('select-ingrediente');
  if (!sel) return;
  const atual = sel.value;
  sel.innerHTML = '<option value="">— Selecione —</option>';

  estoque.forEach((item) => {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = `${item.nome} (${item.unidade})`;
    sel.appendChild(opt);
  });

  if (atual) sel.value = atual;
  atualizarDisplay();
}

function onIngredientChange() {
  atualizarDisplay();
}
window.onIngredientChange = onIngredientChange;

async function tararBalanca() {
  try {
    await api('/balanca/tara', { method: 'POST' });
    showToast('Balança tarada');
  } catch (err) {
    showToast('Erro ao tarar: ' + err.message, true);
  }
}
window.tararBalanca = tararBalanca;

async function confirmarPeso() {
  const ing = getIngredienteSelecionado();
  if (!ing || pesoAtual <= 0.001) return;

  // Calcula consumo na unidade do ingrediente
  let consumo = pesoAtual;
  if (ing.unidade === 'g' || ing.unidade === 'ml') {
    consumo = pesoAtual * 1000;
  }

  if (consumo > ing.qtd) {
    showToast('⚠ Estoque insuficiente!', true);
    return;
  }

  try {
    const data = await api('/balanca/confirmar', {
      method: 'POST',
      body: JSON.stringify({
        ingredienteId: ing.id,
        quantidadeConsumida: consumo,
      }),
    });

    if (!data.ok) {
      showToast(data.erro || 'Erro na confirmação', true);
      return;
    }

    showToast(`✓ ${consumo.toFixed(3)} ${ing.unidade} abatidos`);
    await carregarDados();
    popularSelect();
  } catch (err) {
    showToast(err.message, true);
  }
}
window.confirmarPeso = confirmarPeso;

// ======= ESTOQUE =======
function renderEstoque() {
  document.getElementById('estoque-count').textContent =
    estoque.length + ' ingrediente(s) cadastrado(s)';
  const grid = document.getElementById('stock-grid');
  if (!estoque.length) {
    grid.innerHTML = `<div style="color:var(--muted);padding:40px;text-align:center;grid-column:1/-1">Nenhum ingrediente cadastrado.</div>`;
    return;
  }
  grid.innerHTML = estoque
    .map((item) => {
      const pct =
        item.qtdMax > 0 ? Math.max(0, Math.min(100, (item.qtd / item.qtdMax) * 100)) : 0;
      const barCls = pct > 50 ? 'bar-ok' : pct > 25 ? 'bar-mid' : 'bar-low';
      const exp = getExpiryInfo(item.validade);
      return `<div class="stock-card">
        <button class="btn-del-stock" onclick="deletarItem(${item.id})"><i class="fas fa-trash-alt"></i></button>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div class="stock-name">${item.nome}</div>
          <div class="stock-unit-badge">${item.unidade}</div>
        </div>
        <div class="stock-qty">${fmtQtd(item.qtd, item.unidade)} <span>${item.unidade}</span></div>
        <div class="stock-meta"><span>R$ ${item.preco.toFixed(2)}/${item.unidade}</span><span>${pct.toFixed(0)}% do estoque</span></div>
        <div class="stock-bar-bg"><div class="stock-bar-fill ${barCls}" style="width:${pct}%"></div></div>
        <div class="stock-bar-label"><span>0</span><span>${fmtQtd(item.qtdMax, item.unidade)} ${item.unidade} máx.</span></div>
        <div class="stock-expiry ${exp.cls}"><i class="fas fa-calendar-alt"></i> Validade: ${formatDate(item.validade)} · ${exp.label}</div>
        <button class="btn-compra" onclick="abrirModalCompra(${item.id})"><i class="fas fa-cart-plus"></i> Nova Compra</button>
      </div>`;
    })
    .join('');
}

async function deletarItem(id) {
  if (!confirm('Tem certeza que deseja remover este ingrediente?')) return;
  try {
    await api(`/ingredientes/${id}`, { method: 'DELETE' });
    showToast('Ingrediente removido.');
    await carregarDados();
    renderEstoque();
    popularSelect();
  } catch (err) {
    showToast('Erro: ' + err.message, true);
  }
}
window.deletarItem = deletarItem;

// ======= MODAL CADASTRO =======
function abrirModal() {
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('f-nome').focus();
}
window.abrirModal = abrirModal;

function fecharModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  ['f-nome', 'f-preco', 'f-qtd', 'f-validade'].forEach(
    (id) => (document.getElementById(id).value = ''),
  );
  document.getElementById('f-unidade').value = 'kg';
}
window.fecharModal = fecharModal;

async function salvarIngrediente() {
  const nome = document.getElementById('f-nome').value.trim();
  const unidade = document.getElementById('f-unidade').value;
  const preco = parseFloat(document.getElementById('f-preco').value);
  const qtd = parseFloat(document.getElementById('f-qtd').value);
  const validade = document.getElementById('f-validade').value || null;

  if (!nome || isNaN(preco) || isNaN(qtd)) {
    showToast('Preencha todos os campos!', true);
    return;
  }

  try {
    await api('/ingredientes', {
      method: 'POST',
      body: JSON.stringify({ nome, unidade, preco, qtd, qtdMax: qtd, validade }),
    });
    showToast(`"${nome}" adicionado ao estoque!`);
    fecharModal();
    await carregarDados();
    renderEstoque();
    popularSelect();
  } catch (err) {
    showToast('Erro: ' + err.message, true);
  }
}
window.salvarIngrediente = salvarIngrediente;

// ======= MODAL NOVA COMPRA =======
function abrirModalCompra(id) {
  const ing = estoque.find((i) => i.id === id);
  if (!ing) return;
  compraIdAtual = id;
  document.getElementById('mc-nome-titulo').textContent = ing.nome;
  document.getElementById('mc-unidade-label').textContent = ing.unidade;
  document.getElementById('mc-estoque-atual').textContent =
    `Estoque atual: ${fmtQtd(ing.qtd, ing.unidade)} ${ing.unidade}  ·  Último preço: R$ ${ing.preco.toFixed(2)}/${ing.unidade}`;
  document.getElementById('mc-preco').value = ing.preco.toFixed(2);
  document.getElementById('mc-qtd').value = '';
  document.getElementById('mc-validade').value = ing.validade || '';
  document.getElementById('modal-compra-overlay').classList.add('open');
  document.getElementById('mc-qtd').focus();
}
window.abrirModalCompra = abrirModalCompra;

function fecharModalCompra() {
  document.getElementById('modal-compra-overlay').classList.remove('open');
  compraIdAtual = null;
}
window.fecharModalCompra = fecharModalCompra;

async function confirmarNovaCompra() {
  if (!compraIdAtual) return;
  const ing = estoque.find((i) => i.id === compraIdAtual);
  if (!ing) return;

  const qtdNova = parseFloat(document.getElementById('mc-qtd').value);
  const precoNovo = parseFloat(document.getElementById('mc-preco').value);
  const validadeNova = document.getElementById('mc-validade').value || null;

  if (isNaN(qtdNova) || qtdNova <= 0 || isNaN(precoNovo) || precoNovo <= 0) {
    showToast('Preencha quantidade e custo corretamente!', true);
    return;
  }

  try {
    await api(`/ingredientes/${compraIdAtual}/compras`, {
      method: 'POST',
      body: JSON.stringify({
        quantidade: qtdNova,
        precoUnitario: precoNovo,
        validade: validadeNova,
      }),
    });
    showToast(`✓ +${fmtQtd(qtdNova, ing.unidade)} ${ing.unidade} adicionados a "${ing.nome}"`);
    fecharModalCompra();
    await carregarDados();
    renderEstoque();
    popularSelect();
  } catch (err) {
    showToast('Erro: ' + err.message, true);
  }
}
window.confirmarNovaCompra = confirmarNovaCompra;

// ======= TOAST =======
let toastTimer;
function showToast(msg, err = false) {
  const el = document.getElementById('toast');
  if (!el) {
    console.log(msg);
    return;
  }
  const ic = el.querySelector('i');
  document.getElementById('toast-msg').textContent = msg;
  el.style.borderColor = err ? 'var(--red)' : 'var(--green)';
  ic.style.color = err ? 'var(--red)' : 'var(--green)';
  ic.className = err ? 'fas fa-exclamation-circle' : 'fas fa-check-circle';
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ======= INIT =======
(async function init() {
  await carregarDados();
  popularSelect();
  renderEstoque();
  renderDashboard();
})();