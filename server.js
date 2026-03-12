const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

function registrarLog(acao, ip) {
    const agora = new Date();
    const dataHora = agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', { hour12: false });
    const logEntry = `[${dataHora}] IP: ${ip} - Ação: ${acao}\n`;
    fs.appendFile(path.join(__dirname, 'conexoes.log'), logEntry, (err) => {
        if (err) console.error('Erro ao gravar log:', err);
    });
    console.log(logEntry.trim());
}

// Banco de dados em memória expandido
const bancoDeDadosEmMemoria = {
    estoqueGlobal: [
        { id: 1, nome: 'Dipirona 500mg', quantidadeMatriz: 1000 },
        { id: 2, nome: 'Amoxicilina 500mg', quantidadeMatriz: 500 },
        { id: 3, nome: 'Ibuprofeno 400mg', quantidadeMatriz: 800 }
    ],
    pedidosFiliais: [],
    filiais: [
        { id: 'videira', nome: 'Videira', status: 'Ativa' },
        { id: 'trezetilias', nome: 'Treze Tílias', status: 'Ativa' },
        { id: 'joacaba', nome: 'Joaçaba', status: 'Ativa' },
        { id: 'fraiburgo', nome: 'Fraiburgo', status: 'Ativa' },
        { id: 'cacador', nome: 'Caçador', status: 'Ativa' }
    ]
};

function fazerBroadcastGeral() {
    wss.clients.forEach((cliente) => {
        if (cliente.readyState === WebSocket.OPEN) {
            cliente.send(JSON.stringify({
                tipo: 'ATUALIZACAO_GERAL',
                dados: bancoDeDadosEmMemoria
            }));
        }
    });
}

wss.on('connection', (ws, req) => {
    const ipCliente = req.socket.remoteAddress;
    registrarLog('NOVA_CONEXAO', ipCliente);

    // Envia o estado inicial para o novo cliente
    ws.send(JSON.stringify({
        tipo: 'ESTADO_INICIAL',
        dados: bancoDeDadosEmMemoria
    }));

    ws.on('message', (mensagemEmTexto) => {
        try {
            const mensagem = JSON.parse(mensagemEmTexto);

            // 1. Lógica de Novo Pedido (agora com prioridade)
            if (mensagem.tipo === 'NOVO_PEDIDO') {
                const novoPedido = {
                    idPedido: Date.now(),
                    filialId: mensagem.filialId,
                    medicamentoId: mensagem.medicamentoId,
                    quantidade: mensagem.quantidade,
                    prioridade: mensagem.prioridade, // 'Urgente' ou 'Normal'
                    status: 'Pendente na Matriz'
                };
                bancoDeDadosEmMemoria.pedidosFiliais.push(novoPedido);
                
                // Emite um alerta específico para a Matriz piscar o mapa
                wss.clients.forEach((cliente) => {
                    if (cliente.readyState === WebSocket.OPEN) {
                        cliente.send(JSON.stringify({
                            tipo: 'ALERTA_MAPA',
                            filialId: mensagem.filialId
                        }));
                    }
                });
                fazerBroadcastGeral();
            }

            // 2. Lógica de Atualização de Status (Matriz e Filial)
            if (mensagem.tipo === 'ATUALIZAR_STATUS_PEDIDO') {
                const pedidoIndex = bancoDeDadosEmMemoria.pedidosFiliais.findIndex(p => p.idPedido === mensagem.idPedido);

                if (pedidoIndex !== -1) {
                    const pedido = bancoDeDadosEmMemoria.pedidosFiliais[pedidoIndex];

                    // Se a matriz tentar aprovar, verifica o estoque (Impede estoque negativo)
                    if (mensagem.novoStatus === 'Aprovado e Em Trânsito') {
                        const medIndex = bancoDeDadosEmMemoria.estoqueGlobal.findIndex(m => m.id === pedido.medicamentoId);
                        
                        if (medIndex !== -1) {
                            if (bancoDeDadosEmMemoria.estoqueGlobal[medIndex].quantidadeMatriz >= pedido.quantidade) {
                                bancoDeDadosEmMemoria.estoqueGlobal[medIndex].quantidadeMatriz -= pedido.quantidade;
                                pedido.status = mensagem.novoStatus;
                            } else {
                                // Envia erro apenas para quem tentou aprovar
                                ws.send(JSON.stringify({ tipo: 'ERRO', mensagem: 'Estoque insuficiente para aprovar este pedido.' }));
                                return; // Trava a execução, não faz broadcast
                            }
                        }
                    } else if (mensagem.novoStatus === 'Entregue') {
                        // Filial confirma o recebimento
                        pedido.status = 'Entregue';
                    }
                    fazerBroadcastGeral();
                }
            }

            // 3. Lógica de Compra de Remédios (Matriz reabastece)
            if (mensagem.tipo === 'COMPRAR_MEDICAMENTO') {
                const medIndex = bancoDeDadosEmMemoria.estoqueGlobal.findIndex(m => m.id === mensagem.medicamentoId);
                if (medIndex !== -1) {
                    bancoDeDadosEmMemoria.estoqueGlobal[medIndex].quantidadeMatriz += mensagem.quantidade;
                } else {
                    // Se for um remédio totalmente novo
                    bancoDeDadosEmMemoria.estoqueGlobal.push({
                        id: Date.now(),
                        nome: mensagem.nomeNovoMedicamento,
                        quantidadeMatriz: mensagem.quantidade
                    });
                }
                fazerBroadcastGeral();
            }

            // 4. Lógica de Gerenciamento de Filiais (Matriz adiciona/suspende/exclui)
            if (mensagem.tipo === 'GERENCIAR_FILIAL') {
                if (mensagem.acao === 'ADICIONAR') {
                    bancoDeDadosEmMemoria.filiais.push({
                        id: mensagem.filialId,
                        nome: mensagem.nome,
                        status: 'Ativa'
                    });
                } else if (mensagem.acao === 'ALTERAR_STATUS') {
                    const fIndex = bancoDeDadosEmMemoria.filiais.findIndex(f => f.id === mensagem.filialId);
                    if (fIndex !== -1) {
                        bancoDeDadosEmMemoria.filiais[fIndex].status = mensagem.novoStatus;
                    }
                } else if (mensagem.acao === 'EXCLUIR') {
                    bancoDeDadosEmMemoria.filiais = bancoDeDadosEmMemoria.filiais.filter(f => f.id !== mensagem.filialId);
                }
                fazerBroadcastGeral();
            }

        } catch (erro) {
            console.error('Erro ao processar a mensagem:', erro);
        }
    });

    ws.on('close', () => {
        registrarLog('DESCONEXAO', ipCliente);
    });
});

app.get('/api/status', (req, res) => {
    res.json({ status: 'Online' });
});

const PORTA = 3000;
server.listen(PORTA, () => {
    console.log(`Servidor rodando na porta ${PORTA}`);
});