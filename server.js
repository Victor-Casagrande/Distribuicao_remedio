const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

function registrarLog(acao, ip) {
  const agora = new Date();
  const dataHora =
    agora.toLocaleDateString("pt-BR") +
    " " +
    agora.toLocaleTimeString("pt-BR", { hour12: false });
  const logEntry = `[${dataHora}] IP: ${ip} - Ação: ${acao}\n`;
  fs.appendFile(path.join(__dirname, "conexoes.log"), logEntry, (err) => {
    if (err) console.error("Erro ao gravar log:", err);
  });
  console.log(logEntry.trim());
}

const bancoDeDadosEmMemoria = {
  estoqueGlobal: [
    { id: 1, nome: "Dipirona 500mg", quantidadeMatriz: 1000 },
    { id: 2, nome: "Amoxicilina 500mg", quantidadeMatriz: 500 },
    { id: 3, nome: "Ibuprofeno 400mg", quantidadeMatriz: 800 },
  ],
  pedidosFiliais: [],
  filiais: [
    { id: "videira", nome: "Videira", status: "Ativa" },
    { id: "trezetilias", nome: "Treze Tílias", status: "Ativa" },
    { id: "joacaba", nome: "Joaçaba", status: "Ativa" },
    { id: "fraiburgo", nome: "Fraiburgo", status: "Ativa" },
    { id: "cacador", nome: "Caçador", status: "Ativa" },
  ],
};

function fazerBroadcastGeral() {
  wss.clients.forEach((cliente) => {
    if (cliente.readyState === WebSocket.OPEN) {
      cliente.send(
        JSON.stringify({
          tipo: "ATUALIZACAO_GERAL",
          dados: bancoDeDadosEmMemoria,
        }),
      );
    }
  });
}

wss.on("connection", (ws, req) => {
  const ipCliente = req.socket.remoteAddress;
  registrarLog("NOVA_CONEXAO", ipCliente);

  ws.send(
    JSON.stringify({
      tipo: "ESTADO_INICIAL",
      dados: bancoDeDadosEmMemoria,
    }),
  );

  ws.on("message", (mensagemEmTexto) => {
    try {
      const mensagem = JSON.parse(mensagemEmTexto);

      if (mensagem.tipo === "NOVO_PEDIDO") {
        const novoPedido = {
          idPedido: Date.now(),
          filialId: mensagem.filialId,
          medicamentoId: mensagem.medicamentoId,
          quantidade: mensagem.quantidade,
          prioridade: mensagem.prioridade,
          status: "Pendente na Matriz",
        };
        bancoDeDadosEmMemoria.pedidosFiliais.push(novoPedido);

        wss.clients.forEach((cliente) => {
          if (cliente.readyState === WebSocket.OPEN) {
            cliente.send(
              JSON.stringify({
                tipo: "ALERTA_MAPA",
                filialId: mensagem.filialId,
              }),
            );
          }
        });
        fazerBroadcastGeral();
      }

      if (mensagem.tipo === "ATUALIZAR_STATUS_PEDIDO") {
        const pedidoIndex = bancoDeDadosEmMemoria.pedidosFiliais.findIndex(
          (p) => p.idPedido === mensagem.idPedido,
        );

        if (pedidoIndex !== -1) {
          const pedido = bancoDeDadosEmMemoria.pedidosFiliais[pedidoIndex];

          if (mensagem.novoStatus === "Aprovado e Em Trânsito") {
            const medIndex = bancoDeDadosEmMemoria.estoqueGlobal.findIndex(
              (m) => m.id === pedido.medicamentoId,
            );

            if (medIndex !== -1) {
              if (
                bancoDeDadosEmMemoria.estoqueGlobal[medIndex]
                  .quantidadeMatriz >= pedido.quantidade
              ) {
                bancoDeDadosEmMemoria.estoqueGlobal[
                  medIndex
                ].quantidadeMatriz -= pedido.quantidade;
                pedido.status = mensagem.novoStatus;
              } else {
                ws.send(
                  JSON.stringify({
                    tipo: "ERRO",
                    mensagem: "Estoque insuficiente para aprovar este pedido.",
                  }),
                );
                return;
              }
            }
          } else if (mensagem.novoStatus === "Entregue") {
            pedido.status = "Entregue";
          }
          fazerBroadcastGeral();
        }
      }

      if (mensagem.tipo === "COMPRAR_MEDICAMENTO") {
        const medIndex = bancoDeDadosEmMemoria.estoqueGlobal.findIndex(
          (m) => m.id === mensagem.medicamentoId,
        );
        if (medIndex !== -1) {
          bancoDeDadosEmMemoria.estoqueGlobal[medIndex].quantidadeMatriz +=
            mensagem.quantidade;
        } else {
          bancoDeDadosEmMemoria.estoqueGlobal.push({
            id: Date.now(),
            nome: mensagem.nomeNovoMedicamento,
            quantidadeMatriz: mensagem.quantidade,
          });
        }
        fazerBroadcastGeral();
      }

      if (mensagem.tipo === "GERENCIAR_FILIAL") {
        if (mensagem.acao === "ADICIONAR") {
          bancoDeDadosEmMemoria.filiais.push({
            id: mensagem.filialId,
            nome: mensagem.nome,
            status: "Ativa",
          });
        } else if (mensagem.acao === "ALTERAR_STATUS") {
          const fIndex = bancoDeDadosEmMemoria.filiais.findIndex(
            (f) => f.id === mensagem.filialId,
          );
          if (fIndex !== -1) {
            bancoDeDadosEmMemoria.filiais[fIndex].status = mensagem.novoStatus;
          }
        } else if (mensagem.acao === "EXCLUIR") {
          bancoDeDadosEmMemoria.filiais = bancoDeDadosEmMemoria.filiais.filter(
            (f) => f.id !== mensagem.filialId,
          );
        }
        fazerBroadcastGeral();
      }
    } catch (erro) {
      console.error("Erro ao processar a mensagem:", erro);
    }
  });

  ws.on("close", () => {
    registrarLog("DESCONEXAO", ipCliente);
  });
});

app.get("/api/status", (req, res) => {
  res.json({ status: "Online" });
});

const PORTA = 3000;
server.listen(PORTA, () => {
  console.log(`Servidor rodando na porta ${PORTA}`);
});
