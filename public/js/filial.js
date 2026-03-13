const ws = new WebSocket("ws://localhost:3000");

const statusConexao = document.getElementById("status-conexao");
const selectFilial = document.getElementById("select-filial");
const selectMedicamento = document.getElementById("select-medicamento");
const tabelaMeusPedidos = document.getElementById("tabela-meus-pedidos");

let dadosAtuais = null;

ws.onopen = () => {
  statusConexao.textContent = "Conectado à Matriz (Sistema Online)";
  statusConexao.style.backgroundColor = "#2ecc71";
};

ws.onclose = () => {
  statusConexao.textContent = "Desconectado da Matriz. Tentando reconectar...";
  statusConexao.style.backgroundColor = "#e74c3c";
};

ws.onmessage = (event) => {
  const resposta = JSON.parse(event.data);

  if (
    resposta.tipo === "ESTADO_INICIAL" ||
    resposta.tipo === "ATUALIZACAO_GERAL"
  ) {
    dadosAtuais = resposta.dados;
    atualizarDropdownFiliais();
    atualizarDropdownMedicamentos();
    atualizarTabelaPedidos();
  }

  if (resposta.tipo === "ERRO") {
    alert("Aviso da Matriz: " + resposta.mensagem);
  }
};

function atualizarDropdownFiliais() {
  const valorAtual = selectFilial.value;
  selectFilial.innerHTML =
    '<option value="">Selecione a sua cidade...</option>';

  const filiaisAtivas = dadosAtuais.filiais.filter((f) => f.status === "Ativa");

  filiaisAtivas.forEach((f) => {
    selectFilial.innerHTML += `<option value="${f.id}">${f.nome}</option>`;
  });

  if (valorAtual && filiaisAtivas.find((f) => f.id === valorAtual)) {
    selectFilial.value = valorAtual;
  }
}

function atualizarDropdownMedicamentos() {
  const valorAtual = selectMedicamento.value;
  selectMedicamento.innerHTML =
    '<option value="">Selecione o medicamento...</option>';

  dadosAtuais.estoqueGlobal.forEach((med) => {
    selectMedicamento.innerHTML += `<option value="${med.id}">${med.nome}</option>`;
  });

  if (valorAtual) selectMedicamento.value = valorAtual;
}

function atualizarTabelaPedidos() {
  tabelaMeusPedidos.innerHTML = "";

  const mapaFiliais = {};
  dadosAtuais.filiais.forEach((f) => (mapaFiliais[f.id] = f.nome));

  const mapaMed = {};
  dadosAtuais.estoqueGlobal.forEach((m) => (mapaMed[m.id] = m.nome));

  const pedidosReversos = [...dadosAtuais.pedidosFiliais].reverse();

  pedidosReversos.forEach((pedido) => {
    const horaFormatada = new Date(pedido.idPedido).toLocaleTimeString(
      "pt-BR",
      { hour12: false },
    );
    const nomeFilial = mapaFiliais[pedido.filialId] || pedido.filialId;
    const nomeMed =
      mapaMed[pedido.medicamentoId] || `Med ID: ${pedido.medicamentoId}`;

    let classeStatus = "status-Entregue";
    if (pedido.status === "Pendente na Matriz")
      classeStatus = "status-Pendente";
    else if (pedido.status === "Aprovado e Em Trânsito")
      classeStatus = "status-Trânsito";

    const podeConfirmar = pedido.status === "Aprovado e Em Trânsito";
    const jaEntregue = pedido.status === "Entregue";

    let botaoAcao = "-";
    if (podeConfirmar) {
      botaoAcao = `<button class="btn-success" onclick="confirmarChegada(${pedido.idPedido})">Confirmar Recebimento</button>`;
    } else if (jaEntregue) {
      botaoAcao = `<strong>OK</strong>`;
    } else {
      botaoAcao = `<small>Aguardando Matriz</small>`;
    }

    tabelaMeusPedidos.innerHTML += `
            <tr>
                <td>${horaFormatada}</td>
                <td>${nomeFilial}</td>
                <td><strong>${nomeMed}</strong></td>
                <td>${pedido.quantidade}</td>
                <td class="prioridade-${pedido.prioridade}">${pedido.prioridade}</td>
                <td><span class="status-badge ${classeStatus}">${pedido.status.split(" ")[0]}</span></td>
                <td>${botaoAcao}</td>
            </tr>
        `;
  });
}

function enviarPedido(event) {
  event.preventDefault();

  const filialId = selectFilial.value;
  const prioridade = document.getElementById("select-prioridade").value;
  const medicamentoId = parseInt(selectMedicamento.value);
  const quantidade = parseInt(document.getElementById("quantidade").value);

  if (!filialId || !medicamentoId || quantidade <= 0) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  ws.send(
    JSON.stringify({
      tipo: "NOVO_PEDIDO",
      filialId: filialId,
      medicamentoId: medicamentoId,
      quantidade: quantidade,
      prioridade: prioridade,
    }),
  );

  document.getElementById("quantidade").value = "";
  document.getElementById("select-prioridade").value = "Normal";
}

function confirmarChegada(idPedido) {
  if (
    confirm(
      "Confirmar que o caminhão chegou e os medicamentos estão no seu estoque local?",
    )
  ) {
    ws.send(
      JSON.stringify({
        tipo: "ATUALIZAR_STATUS_PEDIDO",
        idPedido: idPedido,
        novoStatus: "Entregue",
      }),
    );
  }
}
