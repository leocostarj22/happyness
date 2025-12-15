// --- CONFIGURAÇÃO GLOBAL ---
// Detecta a URL base automaticamente para evitar problemas de caminho relativo (ex: /happyness/dashboard.html -> /happyness/api/)
const API_BASE = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
const API_URL = API_BASE + 'api/'; 

let cachedState = null; // Estado em memória sincronizado com o servidor
let serverTimeOffset = 0; // Sincronização de relógio (Server Time - Local Time)
let connectionErrorCount = 0;

// Cria elemento de status de conexão
const connectionStatusEl = document.createElement('div');
connectionStatusEl.style.cssText = 'position:fixed; bottom:5px; right:5px; font-size:10px; color:white; background:rgba(0,0,0,0.5); padding:2px 5px; border-radius:3px; z-index:9999; pointer-events:none;';
document.body.appendChild(connectionStatusEl);

function updateConnectionStatus(status, msg) {
    if (status === 'ok') {
        connectionStatusEl.style.color = '#00ff88';
        connectionStatusEl.innerText = '● Conectado';
        connectionErrorCount = 0;
    } else {
        connectionStatusEl.style.color = '#ff4444';
        connectionStatusEl.innerText = '● Desconectado (' + msg + ')';
    }
}

const votingQuestionsList = [
    "Quem é um Emoji Humano (quem tem as expressões mais icónicas)?",
    "Quem tem o riso mais carismático do Grupo?",
    "Quem é a “água com açúcar” da Equipa (aquele/a que acalma qualquer tempestade)?",
    "Quem é o Spotify andante (vive a cantarolar)?",
    "Quem é o/a mais guloso/a e que por isso merecia um bolo-rei extra?",
    "Quem nunca deixaria o sino de Natal parar de tocar (quem está sempre animado)?",
    "Quem é o/a mais fanático/a por futebol?",
    "Quem é o/a mais influencer?",
    "Quem é o/a mais menino/a do papá ou mamã?",
    "Quem é/a mister fobias?",
    "Em quem votavas para primeiro/a ministro/a?",
    "Quem é o/a melhor a inventar desculpas?",
    "Quem escolherias para te defender em tribunal?",
    "Quem é o/a mister/miss instagram?",
    "Quem é que escolherias para ser o teu companheiro de trabalho?",
    "Quem é o/a mais quadrilheiro/a?",
    "Quem é o/a melhor a guardar segredos?",
    "Quem é que passa mais tempo no telemóvel?",
    "Com quem é que planearias um assalto?"
];

// Estado Inicial do Jogo (Fallback)
const initialGameState = {
    status: 'setup', // setup, lobby, question, result, finished
    mode: 'quiz', // 'quiz' or 'voting'
    leaderboardType: 'general', // 'round' or 'general'
    currentQuestionIndex: 0,
    questionStartTime: 0,
    questions: [], // Será preenchido pelo admin
    currentVotes: {}, // { "NomeVotado": count }
    players: {}, // { "nome": { score: 0, votesReceived: 0 } }
    settings: {
        logo: '',
        background: '',
        welcomeMsg: '🎉 BEM-VINDO À FESTA! 🎉'
    }
};

// Inicializa o cache com o estado padrão
cachedState = JSON.parse(JSON.stringify(initialGameState));

// --- FUNÇÕES DE COMUNICAÇÃO COM O SERVIDOR (API) ---

// 1. Buscar estado do servidor (Polling)
async function fetchServerState() {
    try {
        // Adiciona timestamp e random para evitar cache do navegador e proxies agressivos
        const unique = Date.now() + '_' + Math.random();
        const res = await fetch(`${API_URL}get.php?t=${unique}`, {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        if (res.ok) {
            const text = await res.text();
            try {
                const data = JSON.parse(text);
                if (data && !data.error) {
                    // Sincroniza relógio se o servidor enviar o tempo
                    if (data.serverTime) {
                        serverTimeOffset = data.serverTime - Date.now();
                        delete data.serverTime; // Remove para não poluir o estado e permitir comparação
                    }
                    
                    // DEEP COMPARE: Só dispara atualização se o estado REALMENTE mudou
                    // Isso corrige o problema do dropdown fechando e melhora performance no mobile
                    if (JSON.stringify(data) !== JSON.stringify(cachedState)) {
                        cachedState = data;
                        window.dispatchEvent(new Event('server_update'));
                        console.log("Estado sincronizado e atualizado!");
                    }
                    
                    updateConnectionStatus('ok');
                    
                    // Feedback visual de "pulso" para indicar que o servidor respondeu
                    connectionStatusEl.style.textShadow = '0 0 10px #fff';
                    setTimeout(() => connectionStatusEl.style.textShadow = 'none', 200);

                } else {
                    console.error("Dados inválidos do servidor:", data);
                }
            } catch (e) {
                console.error("Erro JSON:", e, text);
                updateConnectionStatus('error', 'JSON Inválido');
            }
        } else {
            updateConnectionStatus('error', 'HTTP ' + res.status);
        }
    } catch (e) {
        console.error("Erro de conexão:", e);
        connectionErrorCount++;
        updateConnectionStatus('error', 'Sem rede');
        
        // Se falhar muitas vezes, alerta o usuário (apenas player)
        if (connectionErrorCount === 5 && !document.getElementById('admin-container')) {
            alert("Perda de conexão com o servidor! Verifique sua internet.");
        }
    }
}

// Inicia o loop de sincronização (1 segundo)
setInterval(fetchServerState, 1000);

// Retorna o estado instantâneo (do cache)
function getGameState() {
    return cachedState || initialGameState;
}

// 2. Salvar estado (Apenas ADMIN usa isso para controlar o jogo)
async function saveGameState(state) {
    // Atualiza cache local imediatamente para feedback rápido
    cachedState = state;
    window.dispatchEvent(new Event('server_update'));

    try {
        const res = await fetch(`${API_URL}admin_update.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state)
        });
        if (!res.ok) throw new Error("Falha na escrita do arquivo");
    } catch (e) {
        console.error("Erro ao salvar:", e);
        alert("ERRO AO SALVAR NO SERVIDOR! Verifique a conexão ou permissões.");
    }
}

// 3. Ações do Jogador (Atômicas para evitar conflitos)
async function sendPlayerAction(action, data) {
    try {
        const res = await fetch(`${API_URL}player_action.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, data })
        });
        const json = await res.json();
        if (json.success && json.newState) {
            cachedState = json.newState;
            window.dispatchEvent(new Event('server_update'));
            return true;
        }
    } catch (e) {
        console.error("Erro na ação do jogador:", e);
    }
    return false;
}

// Resetar Jogo (Admin)
async function resetGame() {
    if (!confirm("ATENÇÃO: Isso apagará TODOS os dados, jogadores, perguntas e placar.\n\nO sistema voltará ao estado original de fábrica.\n\nDeseja continuar?")) return;

    const btn = document.getElementById('btn-reset');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "Apagando Sistema...";
    }

    const state = JSON.parse(JSON.stringify(initialGameState)); // Clone do estado limpo
    state.status = 'setup';
    
    try {
        await saveGameState(state);
        // Aguarda um pouco mais para garantir que todos os clientes recebam o sinal antes do admin recarregar
        setTimeout(() => location.reload(), 1000);
    } catch (error) {
        console.error("Erro ao resetar:", error);
        alert("Erro ao resetar o sistema. Tente novamente.");
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Resetar Tudo (CUIDADO)";
        }
    }
}

// --- LÓGICA DO ADMIN ---
function initAdmin() {
    const loginContainer = document.getElementById('login-container');
    const adminContainer = document.getElementById('admin-container');
    const questionList = document.getElementById('question-list');
    const statusText = document.getElementById('game-status');

    // --- AUTENTICAÇÃO ---
    function checkAuth() {
        if (sessionStorage.getItem('admin_logged_in') === 'true') {
            loginContainer.classList.add('hidden');
            adminContainer.classList.remove('hidden');
        } else {
            loginContainer.classList.remove('hidden');
            adminContainer.classList.add('hidden');
        }
    }

    document.getElementById('btn-login').addEventListener('click', () => {
        const user = document.getElementById('admin-user').value;
        const pass = document.getElementById('admin-pass').value;

        if (user === 'admin' && pass === 'admin') {
            sessionStorage.setItem('admin_logged_in', 'true');
            checkAuth();
        } else {
            alert("Credenciais Inválidas!");
        }
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
        sessionStorage.removeItem('admin_logged_in');
        checkAuth();
    });

    checkAuth();
    // -------------------
    
    function renderQuestions() {
        const state = getGameState();
        questionList.innerHTML = '';
        
        // Configuração do formulário de adição
        const form = document.getElementById('add-question-form');
        const optionsDiv = form.querySelector('div'); // A div grid com as opções
        const correctSelect = document.getElementById('new-correct');
        const qInput = document.getElementById('new-q-text');

        form.classList.remove('hidden'); // Sempre mostra o container

        if (state.mode === 'voting') {
            // No modo votação, esconde opções e select de resposta correta
            optionsDiv.classList.add('hidden');
            correctSelect.classList.add('hidden');
            qInput.placeholder = "Digite a pergunta da votação...";
        } else {
            // No modo quiz, mostra tudo
            optionsDiv.classList.remove('hidden');
            correctSelect.classList.remove('hidden');
            qInput.placeholder = "Digite a pergunta do quiz...";
        }

        state.questions.forEach((q, index) => {
            const div = document.createElement('div');
            div.className = 'question-item';
            
            // Botão de remover comum aos dois modos
            const removeBtn = `<button onclick="removeQuestion(${index})" style="padding:5px; margin-left:10px; background:#555">X</button>`;

            if (state.mode === 'quiz') {
                div.innerHTML = `
                    <strong>Q${index + 1}: ${q.question}</strong>
                    <span>Resp: ${q.options[q.correct]}</span>
                    ${removeBtn}
                `;
            } else {
                div.innerHTML = `
                    <strong>${index + 1}. ${q.question || q}</strong>
                    ${removeBtn}
                `;
            }
            questionList.appendChild(div);
        });
        statusText.innerText = `Modo: ${state.mode.toUpperCase()} | Status: ${state.status.toUpperCase()} | Q: ${state.currentQuestionIndex + 1}/${state.questions.length}`;
    }

    // Iniciar Modo Quiz
    document.getElementById('btn-mode-quiz').addEventListener('click', () => {
        const state = getGameState();
        state.mode = 'quiz';
        state.questions = [
            { question: "Qual o ano de fundação da empresa?", options: ["2010", "2015", "2020", "1999"], correct: 1 },
            { question: "Quem é conhecido como o 'Rei do Café' no escritório?", options: ["João", "Maria", "Carlos", "Ana"], correct: 2 }
        ];
        state.status = 'setup';
        saveGameState(state);
        renderQuestions();
        alert("Modo Quiz Ativado!");
    });

    // Iniciar Modo Votação
    document.getElementById('btn-mode-voting').addEventListener('click', () => {
        const state = getGameState();
        state.mode = 'voting';
        // Converter lista de strings para objetos de pergunta
        state.questions = votingQuestionsList.map(q => ({ question: q }));
        state.status = 'setup';
        saveGameState(state);
        renderQuestions();
        alert("Modo Votação Ativado!");
    });

    // --- LOGICA DE PERSONALIZAÇÃO ---
    const confLogo = document.getElementById('conf-logo');
    const confBg = document.getElementById('conf-bg');
    const confTitle = document.getElementById('conf-title');

    // Carregar valores atuais
    const currentState = getGameState();
    if (currentState.settings) {
        confLogo.value = currentState.settings.logo || '';
        confBg.value = currentState.settings.background || '';
        confTitle.value = currentState.settings.welcomeMsg || '';
    }

    document.getElementById('btn-save-conf').addEventListener('click', () => {
        const state = getGameState();
        state.settings = {
            logo: confLogo.value,
            background: confBg.value,
            welcomeMsg: confTitle.value || '🎉 BEM-VINDO À FESTA! 🎉'
        };
        saveGameState(state);
        alert("Configurações Salvas!");
    });
    // -------------------------------

    // Adicionar Nova Pergunta (Quiz ou Votação)
    document.getElementById('btn-add-q').addEventListener('click', () => {
        const state = getGameState();
        const qText = document.getElementById('new-q-text').value;

        if (state.mode === 'voting') {
            if(!qText) return alert("Digite a pergunta!");
            
            state.questions.push({ question: qText });
            saveGameState(state);
            
            document.getElementById('new-q-text').value = '';
            renderQuestions();
            return;
        }

        // Lógica Quiz (precisa de opções)
        const opt1 = document.getElementById('new-opt-1').value;
        const opt2 = document.getElementById('new-opt-2').value;
        const opt3 = document.getElementById('new-opt-3').value;
        const opt4 = document.getElementById('new-opt-4').value;
        const correctIdx = parseInt(document.getElementById('new-correct').value);

        if(!qText || !opt1 || !opt2 || !opt3 || !opt4) return alert("Preencha tudo!");

        state.questions.push({
            question: qText,
            options: [opt1, opt2, opt3, opt4],
            correct: correctIdx
        });
        saveGameState(state);
        
        // Limpar form
        document.getElementById('new-q-text').value = '';
        renderQuestions();
    });

    // Controles do Jogo
    document.getElementById('btn-start-lobby').addEventListener('click', () => {
        const state = getGameState();
        state.status = 'lobby';
        state.players = {}; // Limpa jogadores antigos
        saveGameState(state);
        renderQuestions();
    });

    document.getElementById('btn-next-q').addEventListener('click', () => {
        const state = getGameState();
        if (state.status === 'finished') return alert("Jogo acabou!");
        
        // Se estava em Result ou Question (pulando resultado), vai para a próxima
        if (state.status === 'result' || state.status === 'question') {
            state.currentQuestionIndex++;
        }
        
        if (state.currentQuestionIndex >= state.questions.length) {
            state.status = 'finished';
            saveGameState(state);
            renderQuestions();
            return;
        }

        state.status = 'question';
        state.questionStartTime = Date.now() + serverTimeOffset; // Usa tempo sincronizado
        state.currentVotes = {}; // Resetar votos da rodada
        // Resetar roundScore de todos os players
        Object.values(state.players).forEach(p => p.roundScore = 0);
        
        saveGameState(state);
        renderQuestions();
    });

    document.getElementById('btn-show-round-results').addEventListener('click', () => {
        const state = getGameState();
        state.status = 'result';
        state.leaderboardType = 'round';
        saveGameState(state);
        renderQuestions();
    });

    document.getElementById('btn-show-general-results').addEventListener('click', () => {
        const state = getGameState();
        state.status = 'result';
        state.leaderboardType = 'general';
        saveGameState(state);
        renderQuestions();
    });

    document.getElementById('btn-reset').addEventListener('click', resetGame);

    window.removeQuestion = (index) => {
        const state = getGameState();
        state.questions.splice(index, 1);
        saveGameState(state);
        renderQuestions();
    };

    renderQuestions();
    // Substitui 'storage' por 'server_update'
    window.addEventListener('server_update', renderQuestions);
}

// --- LÓGICA DO JOGADOR (PLAYER) ---
function initPlayer() {
    let currentPlayer = localStorage.getItem('player_name');
    let doublePoints = false;
    // Rastreia o índice da última pergunta respondida para saber se deve bloquear ou liberar a tela
    let lastAnsweredQuestionIndex = parseInt(sessionStorage.getItem('last_answered_index') || '-1');

    const screens = {
        login: document.getElementById('login-screen'),
        lobby: document.getElementById('lobby-wait'),
        game: document.getElementById('game-screen'),
        feedback: document.getElementById('feedback-screen'),
        finished: document.getElementById('finished-screen')
    };

    function showScreen(name) {
        Object.values(screens).forEach(s => s.classList.add('hidden'));
        screens[name].classList.remove('hidden');

        // Garante que o botão de sincronização exista sempre que a tela de lobby aparecer
        if (name === 'lobby') {
            let resyncBtn = document.getElementById('btn-resync');
            if (!resyncBtn) {
                resyncBtn = document.createElement('button');
                resyncBtn.id = 'btn-resync';
                resyncBtn.innerText = '↻ FORÇAR ATUALIZAÇÃO';
                resyncBtn.style.cssText = "display:block; width:90%; max-width:300px; margin:30px auto; padding:15px; background:#ff4757; color:white; border:none; border-radius:50px; font-size:14px; font-weight:bold; box-shadow: 0 5px 15px rgba(255, 71, 87, 0.4); cursor:pointer; text-transform: uppercase;";
                resyncBtn.onclick = () => {
                    cachedState = null;
                    resyncBtn.innerText = 'Atualizando...';
                    resyncBtn.style.opacity = '0.7';
                    fetchServerState().then(() => {
                        setTimeout(() => {
                            resyncBtn.innerText = '↻ FORÇAR ATUALIZAÇÃO';
                            resyncBtn.style.opacity = '1';
                        }, 500);
                    });
                };
                document.getElementById('lobby-wait').appendChild(resyncBtn);
            }
        }
    }

    // Login
    if (currentPlayer) {
        document.getElementById('username').value = currentPlayer;
    }

    // Aplicar Personalização (Player)
    function applyCustomization() {
        const state = getGameState();
        if (state.settings) {
            // Background
            if (state.settings.background) {
                document.body.style.background = `linear-gradient(rgba(15, 15, 26, 0.85), rgba(15, 15, 26, 0.95)), url('${state.settings.background}')`;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center';
                document.body.style.backgroundAttachment = 'fixed';
            }
            
            // Logo na tela de login
            const loginScreen = document.getElementById('login-screen');
            let logoImg = document.getElementById('player-custom-logo');
            if (state.settings.logo) {
                if (!logoImg) {
                    logoImg = document.createElement('img');
                    logoImg.id = 'player-custom-logo';
                    logoImg.style.maxWidth = '150px';
                    logoImg.style.marginBottom = '20px';
                    loginScreen.insertBefore(logoImg, loginScreen.firstChild);
                }
                logoImg.src = state.settings.logo;
            } else if (logoImg) {
                logoImg.remove();
            }
        }
    }
    applyCustomization();
    window.addEventListener('server_update', applyCustomization);

    document.getElementById('btn-join').addEventListener('click', async () => {
        const name = document.getElementById('username').value.trim();
        if (!name) return alert("Nome obrigatório!");
        
        // Bloqueia botão
        const btn = document.getElementById('btn-join');
        btn.disabled = true;
        btn.innerText = "Entrando...";

        // Envia ação para o servidor
        await sendPlayerAction('join', { name: name });

        currentPlayer = name;
        localStorage.setItem('player_name', name);
        
        checkGameState();
    });

    // Power-up
    document.getElementById('btn-powerup').addEventListener('click', (e) => {
        doublePoints = true;
        e.target.style.background = '#00ff88';
        e.target.innerText = 'DOBRO ATIVADO!';
        e.target.disabled = true;
    });

    // Variável para controlar o último estado renderizado e evitar loops desnecessários,
    // mas permitindo atualizações críticas
    let lastRenderedStateJSON = '';

    function checkGameState() {
        if (!currentPlayer) return showScreen('login');

        const state = getGameState();
        
        // Verifica se o tempo acabou (10s Quiz / 30s Votação)
        const limitTime = state.mode === 'voting' ? 30 : 10;
        const now = Date.now() + serverTimeOffset; 
        // Adiciona uma tolerância de 2 segundos para latência
        const elapsed = Math.max(0, (now - state.questionStartTime) / 1000);
        const timeIsUp = state.status === 'question' && elapsed >= (limitTime + 2);

        // Criamos uma assinatura do estado atual focada no que impacta a UI
        // Removemos questionStartTime para evitar re-render só pelo timer (se houvesse lógica de timer aqui)
        const currentStateSignature = JSON.stringify({
            status: state.status, 
            qIndex: state.currentQuestionIndex,
            mode: state.mode,
            timeIsUp: timeIsUp,
            // Só importa se o numero de jogadores mudar quando estamos no lobby ou votação
            playersCount: (state.status === 'lobby' || (state.status === 'question' && state.mode === 'voting')) ? Object.keys(state.players).length : 0,
            // Importante: se o jogador já respondeu, a tela muda para lobby
            hasAnswered: state.currentQuestionIndex === lastAnsweredQuestionIndex
        });

        // SE o estado visual crítico é idêntico ao último renderizado, PARE AQUI.
        // Isso impede que o dropdown feche na cara do usuário.
        if (currentStateSignature === lastRenderedStateJSON) {
             return;
        }
        
        lastRenderedStateJSON = currentStateSignature;
        
        if (state.status === 'setup' || state.status === 'lobby') {
            // DETECÇÃO DE RESET:
            // Se o status é setup/lobby, mas meu nome NÃO está na lista de jogadores do servidor,
            // significa que o Admin resetou o jogo. Precisamos forçar relogin.
            if (currentPlayer && !state.players[currentPlayer]) {
                alert("O jogo foi reiniciado pelo Administrador. Por favor, entre novamente.");
                localStorage.removeItem('player_name');
                currentPlayer = null;
                lastRenderedStateJSON = ''; // Força re-render
                location.reload(); // Recarrega a página para limpar tudo
                return;
            }

            showScreen('lobby');
            document.getElementById('lobby-msg').innerText = "Aguardando o início...";
            
            // Forçar limpeza visual se vier de um estado anterior
            if (lastRenderedStateJSON.includes('question')) {
                 lastRenderedStateJSON = ''; // Força re-render completo
            }
        } 
        else if (state.status === 'question') {
            // Se o tempo acabou, mostra mensagem de bloqueio
            if (timeIsUp) {
                showScreen('lobby');
                document.getElementById('lobby-msg').innerText = "Tempo encerrado. Aguarde a próxima pergunta.";
                return;
            }

            // Se já respondeu a pergunta ATUAL (pelo índice), mostra espera
            if (state.currentQuestionIndex === lastAnsweredQuestionIndex) {
                showScreen('lobby');
                document.getElementById('lobby-msg').innerText = "Resposta enviada! Aguarde...";
                return;
            }

            showScreen('game');
            const q = state.questions[state.currentQuestionIndex];
            document.getElementById('question-text').innerText = q.question;
            const optsDiv = document.getElementById('options-container');
            optsDiv.innerHTML = '';
            
            // Lógica para Votação vs Quiz
            if (state.mode === 'voting') {
                document.getElementById('btn-powerup').classList.add('hidden');
                
                // Dropdown com lista de jogadores (Re-lendo estado para garantir lista atualizada)
                // Importante: Ler o estado mais recente direto do localStorage para garantir
                const freshState = getGameState();
                
                const select = document.createElement('select');
                select.id = 'vote-select';
                select.innerHTML = '<option value="">-- Escolha alguém --</option>';
                
                // Ordenar nomes para facilitar a busca
                const playerNames = Object.keys(freshState.players).sort();
                
                if (playerNames.length === 0) {
                     select.innerHTML += `<option disabled>Nenhum jogador encontrado</option>`;
                }

                playerNames.forEach(pName => {
                    select.innerHTML += `<option value="${pName}">${pName}</option>`;
                });

                const btn = document.createElement('button');
                btn.innerText = "VOTAR AGORA";
                btn.onclick = () => {
                    const selected = select.value;
                    if (!selected) return alert("Escolha alguém!");
                    
                    // Feedback visual imediato antes de processar
                    btn.innerText = "Enviando...";
                    btn.disabled = true;
                    
                    submitAnswer(selected);
                };

                optsDiv.appendChild(select);
                optsDiv.appendChild(btn);

            } else {
                // Lógica Quiz
                document.getElementById('btn-powerup').classList.remove('hidden');
                q.options.forEach((opt, idx) => {
                    const btn = document.createElement('button');
                    btn.className = 'option-btn';
                    btn.innerText = opt;
                    btn.onclick = () => submitAnswer(idx);
                    optsDiv.appendChild(btn);
                });
            }
        }
        else if (state.status === 'result') {
            showScreen('feedback');
            
            if (state.mode === 'voting') {
                // Mostra quem ganhou a votação (calculado no client, mas idealmente viria do server)
                // Para simplificar, mostra apenas mensagem de sucesso
                document.getElementById('feedback-screen').innerHTML = `
                    <h1>Voto Registrado!</h1>
                    <p>Olhe para o telão para ver o vencedor!</p>
                `;
            } else {
                const myData = state.players[currentPlayer];
                document.getElementById('feedback-screen').innerHTML = `
                    <h1>Pontuação Atual</h1>
                    <div class="score-gain" id="my-score">${myData ? myData.score : 0}</div>
                    <p>Aguarde a próxima pergunta...</p>
                `;
            }
        }
        else if (state.status === 'finished') {
            showScreen('finished');
        }
    }

    function submitAnswer(answerData) {
        const state = getGameState();
        
        // Validação extra: Só aceita votos se estiver no status 'question'
        if (state.status !== 'question') return;

        if (state.mode === 'voting') {
            // answerData é o nome do jogador votado
            const votedPerson = answerData;
            
            // Envia Voto via API
            sendPlayerAction('vote', { votedPerson: votedPerson });

            // Marca como respondido na sessão usando o índice
            lastAnsweredQuestionIndex = state.currentQuestionIndex;
            sessionStorage.setItem('last_answered_index', lastAnsweredQuestionIndex);
            
            // Força atualização imediata da tela para mostrar feedback
            // (O polling vai confirmar depois, mas o feedback visual é imediato)
            checkGameState();
            return;
        }

        // Lógica Quiz (answerData é index)
        const idx = answerData;
        const q = state.questions[state.currentQuestionIndex];
        const now = Date.now() + serverTimeOffset;
        
        // Cálculo de Pontos (Velocidade)
        // Máximo 10s para bônus total.
        const timeTaken = (now - state.questionStartTime) / 1000;
        let points = 0;
        let isCorrect = false;

        if (idx === q.correct) {
            isCorrect = true;
            const basePoints = 100;
            const timeBonus = Math.max(0, (10 - timeTaken) * 10); // Max 100 bonus
            points = Math.floor(basePoints + timeBonus);
            
            if (doublePoints) {
                points *= 2;
                doublePoints = false; // Consome o powerup
                document.getElementById('btn-powerup').innerText = 'Power-up Usado';
            }
        }

        // Envia Pontuação via API
        if (points > 0) {
            sendPlayerAction('score', { player: currentPlayer, points: points });
        }

        lastAnsweredQuestionIndex = state.currentQuestionIndex;
        sessionStorage.setItem('last_answered_index', lastAnsweredQuestionIndex);
        
        // Feedback Imediato
        if (isCorrect) {
            alert(`CERTO! +${points} PONTOS!`);
        } else {
            alert("ERRADO!");
        }
        
        checkGameState();
    }

    window.addEventListener('server_update', checkGameState);
    // setInterval(checkGameState, 1000); // Polling de segurança já é feito pelo fetchServerState global
    checkGameState();
}

// --- LÓGICA DO TELÃO (DASHBOARD) ---
function initDashboard() {
    let lastLeaderboardData = ''; // Controle para evitar piscar a tela
    const screens = {
        lobby: document.getElementById('dashboard-lobby'),
        question: document.getElementById('dashboard-question'),
        leaderboard: document.getElementById('dashboard-leaderboard')
    };

    function showScreen(name) {
        Object.values(screens).forEach(s => s && s.classList.add('hidden'));
        if(screens[name]) screens[name].classList.remove('hidden');
    }

    function renderLeaderboard(limit = 10) {
        const state = getGameState();
        const list = document.getElementById('leaderboard-list');
        
        let sorted = [];
        let label = "Pontos";
        let title = "🏆 RANKING 🏆";

        if (state.mode === 'voting') {
             label = "Votos";
             if (state.leaderboardType === 'round') {
                 title = "📊 RESULTADO DA RODADA 📊";
                 // No modo round, usamos currentVotes
                 // Precisamos mapear para array {name, score}
                 sorted = Object.entries(state.currentVotes || {})
                    .map(([name, count]) => ({ name, score: count }))
                    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
             } else {
                 title = state.status === 'finished' ? "⭐ RESULTADO FINAL ⭐" : "🏆 RANKING GERAL (VOTOS) 🏆";
                 sorted = Object.entries(state.players)
                    .map(([name, data]) => ({ name, score: data.votesReceived || 0 }))
                    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
             }

        } else {
            // QUIZ MODE
            if (state.leaderboardType === 'round') {
                title = "⚡ PONTUAÇÃO DA RODADA ⚡";
                label = "Pontos (+Rápido)";
                sorted = Object.entries(state.players)
                    .map(([name, data]) => ({ name, score: data.roundScore || 0 }))
                    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
            } else {
                title = "🏆 RANKING GERAL 🏆";
                sorted = Object.entries(state.players)
                    .map(([name, data]) => ({ name, score: data.score }))
                    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
            }
        }
             
        document.querySelector('#dashboard-leaderboard h1').innerText = title;

        sorted = sorted.slice(0, limit);
        const maxScore = sorted.length ? Math.max(sorted[0].score, 1) : 1;

        // --- ANTI-FLICKER CHECK ---
        // Se a assinatura dos dados for igual à anterior, NÃO FAZ NADA.
        // Isso impede que o DOM seja tocado, evitando piscar e reflows.
        const currentSignature = JSON.stringify(sorted.map(p => ({ n: p.name, s: p.score }))) + label;
        if (currentSignature === lastLeaderboardData) return;
        lastLeaderboardData = currentSignature;
        // ---------------------------

        // Limpar apenas se não houver dados (ou exibir msg vazia)
        if (sorted.length === 0) {
            list.innerHTML = '<h2 style="color:#666">Aguardando dados...</h2>';
            return;
        }

        // Remover mensagem de "Aguardando..." se existir e houver dados
        if (list.querySelector('h2')) list.innerHTML = '';

        // Conjunto de nomes para controle de remoção
        const activeNames = new Set(sorted.map(p => p.name));

        // 1. Remover elementos que não estão mais na lista
        Array.from(list.children).forEach(child => {
            if (child.dataset.player && !activeNames.has(child.dataset.player)) {
                child.remove();
            }
        });

        // 2. Atualizar ou Criar elementos
        sorted.forEach((p, index) => {
            const percent = (p.score / maxScore) * 100;
            let el = document.getElementById(`rank-item-${p.name}`);
            
            // Se não existe, cria
            if (!el) {
                el = document.createElement('div');
                el.id = `rank-item-${p.name}`;
                el.className = 'player-bar-container';
                el.dataset.player = p.name;
                // Animação só na entrada
                el.style.animation = `slideIn 0.5s ease forwards ${index * 0.1}s`;
                
                el.innerHTML = `
                    <div class="player-rank"></div>
                    <div class="player-name">${p.name}</div>
                    <div class="bar-track">
                        <div class="bar-fill" style="width: 0%"></div>
                    </div>
                `;
                list.appendChild(el);
            }

            // Atualiza dados
            el.querySelector('.player-rank').innerText = `#${index + 1}`;
            
            const barFill = el.querySelector('.bar-fill');
            barFill.style.width = `${percent}%`;
            barFill.innerText = `${p.score} ${label}`;

            // Reordenar no DOM (appendChild move o elemento existente para o final)
            // Isso garante que a ordem visual corresponda ao sorted
            list.appendChild(el);
        });
    }

    function updateDashboard() {
        const state = getGameState();

        // Aplicar Personalização (Dashboard)
        if (state.settings) {
            // Background
            if (state.settings.background) {
                document.body.style.background = `linear-gradient(rgba(15, 15, 26, 0.85), rgba(15, 15, 26, 0.95)), url('${state.settings.background}')`;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center';
                document.body.style.backgroundAttachment = 'fixed';
            }

            // Mensagem de Boas-vindas
            const lobbyTitle = document.querySelector('#dashboard-lobby h1');
            if (lobbyTitle) lobbyTitle.innerText = state.settings.welcomeMsg || "🎉 BEM-VINDO À FESTA! 🎉";

            // Logo
            const lobbyDiv = document.getElementById('dashboard-lobby');
            let logoImg = document.getElementById('dash-custom-logo');
            
            if (state.settings.logo) {
                if (!logoImg) {
                    logoImg = document.createElement('img');
                    logoImg.id = 'dash-custom-logo';
                    logoImg.style.maxWidth = '300px';
                    logoImg.style.marginBottom = '30px';
                    logoImg.style.display = 'block';
                    logoImg.style.margin = '0 auto 30px auto';
                    // Insere antes do título
                    lobbyDiv.insertBefore(logoImg, lobbyTitle);
                }
                // Evita reload da imagem se for a mesma
                if (!logoImg.src.includes(state.settings.logo)) {
                    logoImg.src = state.settings.logo;
                }
            } else if (logoImg) {
                logoImg.remove();
            }
        }

        // QR Code Logic
        const qrImg = document.getElementById('qr-code-img');
        if (qrImg && !qrImg.src.includes('api.qrserver')) {
            // Tenta pegar a URL atual e trocar dashboard.html por player.html
            const playerUrl = window.location.href.replace('dashboard.html', 'player.html');
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(playerUrl)}`;
        }

        if (state.status === 'setup' || state.status === 'lobby') {
            showScreen('lobby');
            document.getElementById('player-count').innerText = Object.keys(state.players).length + " Jogadores Prontos";
        }
        else if (state.status === 'question') {
            showScreen('question');
            const q = state.questions[state.currentQuestionIndex];
            document.getElementById('big-q-text').innerText = q.question || q;
            
            // Timer Visual
            const limitTime = state.mode === 'voting' ? 30 : 10;
            const now = Date.now() + serverTimeOffset;
            const elapsed = Math.floor((now - state.questionStartTime) / 1000);
            const remaining = Math.max(0, limitTime - elapsed);
            
            document.getElementById('timer').innerText = remaining + "s";
            
            if (state.mode === 'voting') {
                document.querySelector('#dashboard-question p').innerText = "Vote agora no seu celular!";
            } else {
                document.querySelector('#dashboard-question p').innerText = "Responda rápido para ganhar mais pontos!";
            }
        }
        else if (state.status === 'result' || state.status === 'finished') {
            showScreen('leaderboard');
            renderLeaderboard(state.status === 'finished' ? 100 : 5);
        }
    }

    window.addEventListener('server_update', updateDashboard);
    setInterval(updateDashboard, 500); // Atualização mais rápida para timer
    updateDashboard();
}

// ROTEADOR
if (document.getElementById('admin-container')) initAdmin();
else if (document.getElementById('dashboard-container')) initDashboard();
else if (document.getElementById('player-container')) initPlayer();