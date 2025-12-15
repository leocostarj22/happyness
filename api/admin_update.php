<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');

require_once 'db_connect.php';

// 1. Recebe os novos dados do Admin
$json = file_get_contents('php://input');
$newData = json_decode($json, true);

if (!$newData) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid JSON"]);
    exit;
}

try {
    // 2. Salva no Banco de Dados
    // O ID é sempre 1 pois é um jogo single-instance
    $stmt = $pdo->prepare("UPDATE game_state SET data = ? WHERE id = 1");
    $stmt->execute([json_encode($newData, JSON_UNESCAPED_UNICODE)]);
    
    echo json_encode(["success" => true]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => "Database Error: " . $e->getMessage()]);
}
?>