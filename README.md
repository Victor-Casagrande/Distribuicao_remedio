# Como Executar o Projeto

 ## Pré-requisitos:
Certifique-se de ter o Node.js instalado na sua máquina.

 ## Instalação das Dependências
npm install express ws cors

 ## Iniciando o Servidor
 node server.js

 ## Mantenha o terminal aberto

# Acessando a Aplicação
Painel da Matriz: http://localhost:3000/matriz.html
Painel da Filial: http://localhost:3000/filial.html


# Sistema de Controle de Estoque e Logística em Tempo Real

Este projeto é uma aplicação web desenvolvida para a Atividade Prática de Comunicação Cliente-Servidor
Ele simula um sistema de gestão de estoque e acompanhamento de entregas entre uma Matriz e diversas Filiais farmacêuticas localizadas no Meio-Oeste Catarinense.

A arquitetura utiliza a estratégia de **WebSocket** para garantir comunicação bidirecional e atualizações instantâneas no painel de pedidos e no mapa interativo de rotas.

## Tecnologias e Estrutura

- **Backend:** Node.js com Express e a biblioteca `ws` (WebSocket).
- **Frontend:** HTML5, CSS3, JavaScript.
- **Mapas:** Integração com a biblioteca Leaflet e dados do OpenStreetMap.
- **Armazenamento:** Variável em memória no servidor Node.js.

## Funcionalidades

- **Comunicação em Tempo Real:** Solicitações de filiais aparecem instantaneamente no painel da matriz.
- **Aprovação e Baixa de Estoque:** A matriz aprova pedidos, o que reduz automaticamente o estoque central e notifica a filial correspondente.
- **Confirmação de Recebimento:** Filiais confirmam a chegada do caminhão, movendo o pedido para o histórico de concluídos.
- **Radar Geográfico:** Mapa interativo do Meio-Oeste Catarinense que pisca em vermelho a localização exata da cidade que realizou um pedido.
- **Múltiplos Clientes:** Suporte para múltiplas abas e diferentes máquinas conectadas simultaneamente como filiais distintas.
- **Logs de Conexão:** Registro persistente (em arquivo `.log`) de todas as entradas e saídas de clientes no sistema com data e horário no formato de 24 horas.
- **Indicador de Status:** Sinalização visual na interface do usuário mostrando se o sistema está conectado ou desconectado do servidor WebSocket.

## Estrutura de Diretórios

O projeto busca seguir boas práticas de separação de responsabilidades (HTML, CSS e JS):

```text
/
├── server.js              # Servidor Node.js (API Express + WebSocket Server)
├── conexoes.log           # Arquivo gerado automaticamente contendo os logs de rede
├── README.md              # Documentação do projeto
└── public/                # Diretório de arquivos estáticos servidos pelo Express
    ├── matriz.html        # Interface da Matriz
    ├── filial.html        # Interface da Filial
    ├── css/
    │   └── style.css      # Folha de estilos unificada
    └── js/
        ├── matriz.js      # Lógica e comunicação WebSocket da Matriz
        └── filial.js      # Lógica e comunicação WebSocket da Filial
```
