<?php
/**
 * ============================================================================
 * DIRAYAAI - PLATFORM API
 * الوظيفة: جلب قائمة المواد والمحتوى الأكاديمي المعتمد لعرضه في واجهة المنصة.
 * ============================================================================
 */
session_start();
require_once "connect.php"; // استدعاء الاتصال بقاعدة البيانات
header('Content-Type: application/json; charset=utf-8'); // تحديد نوع الاستجابة كـ JSON

// استقبال الإجراء المطلوب من الواجهة الأمامية
$action = $_GET['action'] ?? '';

switch ($action) {
    /**
     * --- 1. جلب قائمة المواد لفلتر البحث ---
     * تقوم هذه الدالة بجلب المواد النشطة فقط لعرضها في القائمة المنسدلة للبحث.
     */
    case 'get_courses':
        try {
            $stmt = $pdo->prepare("SELECT Subject_ID, Subject_Name, Subject_Code FROM Subjects WHERE Is_Active = 1 ORDER BY Subject_Name ASC");
            $stmt->execute();
            $courses = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(["status" => "success", "courses" => $courses]);
        } catch (PDOException $e) {
            echo json_encode(["status" => "error", "message" => "فشل الاتصال بقاعدة البيانات"]);
        }
        break;

    /**
     * --- 2. جلب المرفقات والمحتوى الأكاديمي المعتمد ---
     * تجلب جميع الملفات التي تمت الموافقة عليها (Approved)، مع حساب متوسط التقييمات.
     */
    case 'get_materials':
        header('Content-Type: application/json; charset=utf-8');
        try {
            // استخدام LEFT JOIN لجلب التقييمات من جدول Rating_Comments وحساب المتوسط (AVG)
            $stmt = $pdo->query("
                SELECT r.*, s.Subject_Name, s.Subject_Code,
                       COALESCE(AVG(rc.Rating_Value), 0) as Average_Rating,
                       COUNT(rc.Rating_ID) as Total_Ratings
                FROM Academic_Resources r
                JOIN Subjects s ON r.Subject_ID = s.Subject_ID
                LEFT JOIN Rating_Comments rc ON r.Resource_ID = rc.Resource_ID
                WHERE r.Status = 'Approved'
                GROUP BY r.Resource_ID
                ORDER BY r.Upload_Date DESC
            ");
            echo json_encode(['status' => 'success', 'materials' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        } catch (PDOException $e) {
            echo json_encode(['status' => 'error']);
        }
        break;
}
exit();
?>