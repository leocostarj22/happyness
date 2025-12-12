<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');

$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? '';
$data = $input['data'] ?? [];

$file = 'data.json';

clearstatcache();

// Abre para leitura e escrita
$fp = fopen($file, 'r+');

if (flock($fp, LOCK_EX)) {
    // 1. Ler estado atual
    $currentJson = stream_get_contents($fp);
    $state = json_decode($currentJson, true);
    
    // 2. Processar a ação
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

    // 3. Salvar
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($state, JSON_PRETTY_PRINT));
    
    flock($fp, LOCK_UN);
    echo json_encode(["success" => true, "newState" => $state]);

} else {
    http_response_code(500);
    echo json_encode(["error" => "Server Busy"]);
}

fclose($fp);
?>