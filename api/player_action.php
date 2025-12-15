<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');

require_once 'db_connect.php';

$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? '';
$data = $input['data'] ?? [];

try {
    // INICIA TRANSAÇÃO PARA ATOMICIDADE
    $pdo->beginTransaction();

    // 1. Ler estado atual com BLOQUEIO (SELECT ... FOR UPDATE)
    // Isso impede que outros scripts leiam/escrevam enquanto processamos
    $stmt = $pdo->query("SELECT data FROM game_state WHERE id = 1 FOR UPDATE");
    $row = $stmt->fetch();
    
    if (!$row) throw new Exception("Game state not found");
    
    $state = json_decode($row['data'], true);
    
    // 2. Processar a ação (Lógica de Negócio)
    if ($action === 'join') {
        $name = $data['name'];
        if (!isset($state['players'][$name])) {
            $state['players'][$name] = [
                'score' => 0, 
                'votesReceived' => 0, 
                'roundScore' => 0
            ];
        }
    }
    elseif ($action === 'vote') {
        $votedPerson = $data['votedPerson'];
        
        // Votos da rodada
        if (!isset($state['currentVotes'][$votedPerson])) {
            $state['currentVotes'][$votedPerson] = 0;
        }
        $state['currentVotes'][$votedPerson]++;
        
        // Votos totais
        if (isset($state['players'][$votedPerson])) {
            if (!isset($state['players'][$votedPerson]['votesReceived'])) {
                $state['players'][$votedPerson]['votesReceived'] = 0;
            }
            $state['players'][$votedPerson]['votesReceived']++;
        }
    }
    elseif ($action === 'score') {
        $player = $data['player'];
        $points = $data['points'];
        
        if (isset($state['players'][$player])) {
            $state['players'][$player]['score'] += $points;
            $state['players'][$player]['roundScore'] = $points;
        }
    }

    // 3. Salvar Estado Atualizado
    $newStateJson = json_encode($state, JSON_UNESCAPED_UNICODE);
    
    $updateStmt = $pdo->prepare("UPDATE game_state SET data = ? WHERE id = 1");
    $updateStmt->execute([$newStateJson]);
    
    // Confirma transação
    $pdo->commit();
    
    echo json_encode(["success" => true, "newState" => $state]);

} catch (Exception $e) {
    // Se der erro, desfaz tudo
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>