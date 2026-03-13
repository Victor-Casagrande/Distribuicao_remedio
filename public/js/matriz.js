const map = L.map("mapa-regiao").setView([-27.05, -51.25], 10);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

const cidadesDisponiveis = {
  videira: { nome: "Videira", coords: [-27.0086, -51.1519] },
  trezetilias: { nome: "Treze Tílias", coords: [-26.9983, -51.4136] },
  joacaba: { nome: "Joaçaba", coords: [-27.1742, -51.5036] },
  fraiburgo: { nome: "Fraiburgo", coords: [-27.0263, -50.9213] },
  cacador: { nome: "Caçador", coords: [-26.7752, -51.0121] },
  tangara: { nome: "Tangará", coords: [-27.1052, -51.2472] },
  pinheiropreto: { nome: "Pinheiro Preto", coords: [-27.0522, -51.2225] },
  saltoveloso: { nome: "Salto Veloso", coords: [-26.9041, -51.4055] },
  iomere: { nome: "Iomerê", coords: [-27.0069, -51.2405] },
  luzerna: { nome: "Luzerna", coords: [-27.1325, -51.4644] },
  herval: { nome: "Herval d'Oeste", coords: [-27.1788, -51.4938] },
  capinzal: { nome: "Capinzal", coords: [-27.3427, -51.6119] },
};

const marcadoresMapa = {};
let filiaisComAlerta = new Set();
let dadosAtuais = null;

const statusConexao = document.getElementById("status-conexao");

document
  .getElementById("compra-medicamento")
  .addEventListener("change", function () {
    document.getElementById("compra-nome").style.display =
      this.value === "novo" ? "block" : "none";
  });

const ws = new WebSocket("ws://localhost:3000");

ws.onopen = () => {
  statusConexao.textContent = "Conectado ao Servidor WebSocket";
  statusConexao.style.backgroundColor = "#2ecc71";
};

ws.onclose = () => {
  statusConexao.textContent =
    "Desconectado do Servidor. Tentando reconectar...";
  statusConexao.style.backgroundColor = "#e74c3c";
};

ws.onmessage = (event) => {
  const resposta = JSON.parse(event.data);

  if (
    resposta.tipo === "ESTADO_INICIAL" ||
    resposta.tipo === "ATUALIZACAO_GERAL"
  ) {
    dadosAtuais = resposta.dados;
    renderizarEstoque();
    renderizarPedidos();
    renderizarFiliais();
    atualizarDropdownCidades();
    atualizarMarcadoresNoMapa();
  }

  if (resposta.tipo === "ALERTA_MAPA") {
    filiaisComAlerta.add(resposta.filialId);
    atualizarMarcadoresNoMapa();
  }

  if (resposta.tipo === "ERRO") {
    alert(resposta.mensagem);
  }
};

function atualizarMarcadoresNoMapa() {
  Object.values(marcadoresMapa).forEach((marker) => map.removeLayer(marker));

  dadosAtuais.filiais.forEach((f) => {
    const cidade = cidadesDisponiveis[f.id];
    if (f.status === "Ativa" && cidade) {
      const classeAlerta = filiaisComAlerta.has(f.id) ? "alerta-ativo" : "";

      const iconeCustomizado = L.divIcon({
        className: "custom-marker",
        html: `<div id="ponto-${f.id}" class="ponto-mapa ${classeAlerta}">${f.nome}</div>`,
        iconSize: [100, 30],
        iconAnchor: [50, 15],
      });

      const marker = L.marker(cidade.coords, { icon: iconeCustomizado }).addTo(
        map,
      );
      marcadoresMapa[f.id] = marker;
    }
  });
}

function atualizarDropdownCidades() {
  const select = document.getElementById("select-nova-filial");
  select.innerHTML = '<option value="">Escolha uma cidade...</option>';

  const filiaisAtivasIds = dadosAtuais.filiais.map((f) => f.id);

  for (const [id, dados] of Object.entries(cidadesDisponiveis)) {
    if (!filiaisAtivasIds.includes(id)) {
      select.innerHTML += `<option value="${id}">${dados.nome}</option>`;
    }
  }
}

function renderizarEstoque() {
  const tab = document.getElementById("tabela-estoque");
  const sel = document.getElementById("compra-medicamento");
  tab.innerHTML = "";
  sel.innerHTML = '<option value="novo">+ Cadastrar Novo</option>';

  dadosAtuais.estoqueGlobal.forEach((med) => {
    tab.innerHTML += `<tr><td>${med.nome}</td><td><strong>${med.quantidadeMatriz}</strong></td></tr>`;
    sel.innerHTML += `<option value="${med.id}">${med.nome}</option>`;
  });
}

function renderizarPedidos() {
  const tabAtivos = document.getElementById("tabela-pedidos-ativos");
  const tabHistorico = document.getElementById("tabela-pedidos-historico");
  tabAtivos.innerHTML = "";
  tabHistorico.innerHTML = "";

  const mapaFiliais = {};
  dadosAtuais.filiais.forEach((f) => (mapaFiliais[f.id] = f.nome));

  const mapaMed = {};
  dadosAtuais.estoqueGlobal.forEach((m) => (mapaMed[m.id] = m.nome));

  [...dadosAtuais.pedidosFiliais].reverse().forEach((p) => {
    const hora = new Date(p.idPedido).toLocaleTimeString("pt-BR", {
      hour12: false,
    });
    const nomeFilial = mapaFiliais[p.filialId] || p.filialId;
    const nomeMed = mapaMed[p.medicamentoId] || `Med ${p.medicamentoId}`;

    if (p.status === "Entregue") {
      tabHistorico.innerHTML += `
                <tr>
                    <td>${hora}</td>
                    <td>${nomeFilial}</td>
                    <td>${p.quantidade}x ${nomeMed}</td>
                    <td><span class="status-badge status-Entregue">Concluído</span></td>
                </tr>
            `;
    } else {
      const isPendente = p.status === "Pendente na Matriz";
      const classeStatus = isPendente ? "status-Pendente" : "status-Trânsito";

      if (isPendente) {
        filiaisComAlerta.add(p.filialId);
      }

      tabAtivos.innerHTML += `
                <tr>
                    <td>${hora}</td>
                    <td>${nomeFilial}</td>
                    <td>${p.quantidade}x ${nomeMed}</td>
                    <td class="prioridade-${p.prioridade}">${p.prioridade}</td>
                    <td><span class="status-badge ${classeStatus}">${p.status.split(" ")[0]}</span></td>
                    <td>
                        <button class="btn-success" onclick="aprovarPedido(${p.idPedido}, '${p.filialId}')" ${!isPendente ? "disabled" : ""}>
                            ${isPendente ? "Aprovar" : "Aguardando"}
                        </button>
                    </td>
                </tr>
            `;
    }
  });
  atualizarMarcadoresNoMapa();
}

function renderizarFiliais() {
  const tab = document.getElementById("tabela-filiais");
  tab.innerHTML = "";
  dadosAtuais.filiais.forEach((f) => {
    tab.innerHTML += `
            <tr>
                <td>${f.nome}</td>
                <td>${f.status}</td>
                <td>
                    <button class="btn-warning" onclick="alterarStatusFilial('${f.id}', '${f.status === "Ativa" ? "Suspensa" : "Ativa"}')">
                        ${f.status === "Ativa" ? "Suspender" : "Ativar"}
                    </button>
                    <button class="btn-danger" onclick="excluirFilial('${f.id}')">X</button>
                </td>
            </tr>
        `;
  });
}

function aprovarPedido(idPedido, filialId) {
  ws.send(
    JSON.stringify({
      tipo: "ATUALIZAR_STATUS_PEDIDO",
      idPedido: idPedido,
      novoStatus: "Aprovado e Em Trânsito",
    }),
  );

  filiaisComAlerta.delete(filialId);
  atualizarMarcadoresNoMapa();
}

function comprarEstoque() {
  const medId = document.getElementById("compra-medicamento").value;
  const qtd = parseInt(document.getElementById("compra-qtd").value);
  const nomeNovo = document.getElementById("compra-nome").value;

  if (!qtd) return alert("Insira uma quantidade válida.");

  ws.send(
    JSON.stringify({
      tipo: "COMPRAR_MEDICAMENTO",
      medicamentoId: medId === "novo" ? null : parseInt(medId),
      nomeNovoMedicamento: nomeNovo,
      quantidade: qtd,
    }),
  );

  document.getElementById("compra-qtd").value = "";
  document.getElementById("compra-nome").value = "";
}

function adicionarFilial() {
  const select = document.getElementById("select-nova-filial");
  const id = select.value;

  if (id) {
    const nome = cidadesDisponiveis[id].nome;
    ws.send(
      JSON.stringify({
        tipo: "GERENCIAR_FILIAL",
        acao: "ADICIONAR",
        filialId: id,
        nome: nome,
      }),
    );
  } else {
    alert("Selecione uma cidade da lista.");
  }
}

function alterarStatusFilial(id, novoStatus) {
  ws.send(
    JSON.stringify({
      tipo: "GERENCIAR_FILIAL",
      acao: "ALTERAR_STATUS",
      filialId: id,
      novoStatus: novoStatus,
    }),
  );
}

function excluirFilial(id) {
  if (confirm("Tem certeza que deseja excluir esta filial?")) {
    ws.send(
      JSON.stringify({
        tipo: "GERENCIAR_FILIAL",
        acao: "EXCLUIR",
        filialId: id,
      }),
    );
  }
}
