<?php
/**
 * ============================================================================
 * DIRAYAAI - FAQ API
 * الوظيفة: إدارة أسئلة وإجابات البوت (إضافة، حذف، وجلب الأسئلة)
 * ============================================================================
 */
session_start();
require_once "connect.php";
header('Content-Type: application/json; charset=utf-8');

// --- 1. حماية الجلسة: التأكد من الصلاحيات الإدارية ---
if (!isset($_SESSION['user_id']) || ($_SESSION['role'] !== 'مشرف' && $_SESSION['role'] !== 'مدير نظام')) {
    echo json_encode(["status" => "error", "message" => "غير مصرح لك بالوصول لهذه الصفحة."]);
    exit();
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$admin_id = $_SESSION['user_id'];
$admin_name = $_SESSION['user_name'] ?? 'مستخدم إداري';

switch ($action) {
    // --- 2. جلب قائمة الأسئلة لعرضها في الواجهة ---
    case 'get_faqs':
        try {
            $stmt = $pdo->prepare("SELECT FAQ_ID, Category, Question_Text, Answer_Text, Last_Updated FROM FAQ_Knowledge_Base ORDER BY Last_Updated DESC");
            $stmt->execute();
            $faqs = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(["status" => "success", "faqs" => $faqs]);
        } catch (PDOException $e) {
            echo json_encode(["status" => "error", "message" => "حدث خطأ في جلب البيانات من قاعدة البيانات."]);
        }
        break;

    // --- 3. إضافة سؤال جديد لقاعدة بيانات البوت ---
    case 'add_faq':
        $question = htmlspecialchars(trim($_POST['question'] ?? ''), ENT_QUOTES, 'UTF-8');
        $answer = htmlspecialchars(trim($_POST['answer'] ?? ''), ENT_QUOTES, 'UTF-8');
        $category = trim($_POST['category'] ?? 'عام');

        if (empty($question) || empty($answer)) {
            echo json_encode(["status" => "error", "message" => "يرجى تعبئة السؤال والإجابة."]);
            exit();
        }

        try {
            // التعديل هنا: شلنا Added_By من الاستعلام
            $stmt = $pdo->prepare("INSERT INTO FAQ_Knowledge_Base (Category, Question_Text, Answer_Text) VALUES (?, ?, ?)");
            $stmt->execute([$category, $question, $answer]);
            
            // تسجيل العملية الإدارية في السجل (هذا يكفي لمعرفة من أضاف السؤال)
            $log = $pdo->prepare("INSERT INTO Admin_Actions (Admin_ID, Action_Type, Target_Table, Action_Description) VALUES (?, 'Insert', 'FAQ_Knowledge_Base', ?)");
            $log->execute([$admin_id, "تم إضافة سؤال جديد للبوت بواسطة: $admin_name"]);

            echo json_encode(["status" => "success", "message" => "تم حفظ السؤال في قاعدة بيانات البوت بنجاح!"]);
        } catch (PDOException $e) {
            echo json_encode(["status" => "error", "message" => "خطأ SQL: " . $e->getMessage()]);
        }
        break;

    // --- 4. حذف سؤال من قاعدة البيانات ---
    case 'delete_faq':
        $faq_id = $_POST['faq_id'] ?? '';
        
        if (empty($faq_id)) {
            echo json_encode(["status" => "error", "message" => "رقم السؤال مفقود."]);
            exit();
        }

        try {
            $stmt = $pdo->prepare("DELETE FROM FAQ_Knowledge_Base WHERE FAQ_ID = ?");
            $stmt->execute([$faq_id]);
            
            // تسجيل عملية الحذف
            $log = $pdo->prepare("INSERT INTO Admin_Actions (Admin_ID, Action_Type, Target_Table, Action_Description) VALUES (?, 'Delete', 'FAQ_Knowledge_Base', ?)");
            $log->execute([$admin_id, "تم حذف سؤال من البوت برقم ($faq_id) بواسطة: $admin_name"]);

            echo json_encode(["status" => "success", "message" => "تم حذف السؤال بنجاح!"]);
        } catch (PDOException $e) {
            echo json_encode(["status" => "error", "message" => "فشل حذف السؤال."]);
        }
        break;

    default:
        echo json_encode(["status" => "error", "message" => "إجراء غير صالح."]);
        break;
}
exit();
?>
