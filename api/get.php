<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');

require_once 'db_connect.php';

try {
    $stmt = $pdo->query("SELECT data FROM game_state WHERE id = 1");
    $row = $stmt->fetch();

    if ($row) {
        $data = json_decode($row['data'], true);
        if ($data) {
            // Adiciona o tempo atual do servidor (em ms) para sincronização
            $data['serverTime'] = round(microtime(true) * 1000);
            echo json_encode($data);
        } else {
             // Fallback se JSON estiver corrompido
             echo $row['data'];
        }
    } else {
        // Se a tabela estiver vazia (caso raro após criação), retorna erro ou cria
        echo json_encode(["error" => "No game state found"]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>