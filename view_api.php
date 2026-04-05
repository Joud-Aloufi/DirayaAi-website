<?php
/**
 * ============================================================================
 * DIRAYAAI - VIEW MATERIAL API
 * الوظيفة: جلب تفاصيل مادة معينة وعرضها، وإدارة نظام التعليقات والتقييمات عليها.
 * ============================================================================
 */
session_start();
require_once "connect.php";
header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {
    /**
     * جلب بيانات المادة التعليمة، تقييمها، والتعليقات الخاصة بها.
     */
    case 'get_material':
        $resource_id = $_GET['id'] ?? '';

        if (empty($resource_id)) {
            echo json_encode(["status" => "error", "message" => "رقم المادة مفقود."]);
            exit();
        }

        try {
            // جلب بيانات المادة مع ربطها ببيانات الكاتب (صاحب الرفع) واسم المادة الدراسية
            $stmt = $pdo->prepare("
                SELECT r.*, u.first_name, u.last_name, u.Full_Name, u.email, s.Subject_Name 
                FROM Academic_Resources r
                JOIN Users u ON r.User_ID = u.User_ID
                JOIN Subjects s ON r.Subject_ID = s.Subject_ID
                WHERE r.Resource_ID = ? AND r.Status = 'Approved'
            ");
            $stmt->execute([$resource_id]);
            $material = $stmt->fetch(PDO::FETCH_ASSOC);

            // التحقق من وجود المادة أو إذا كانت قيد المراجعة
            if (!$material) {
                echo json_encode(["status" => "error", "message" => "المادة غير موجودة أو قيد المراجعة."]);
                exit();
            }

            // جلب جميع التعليقات الخاصة بهذه المادة مع بيانات أصحابها
            $comments_stmt = $pdo->prepare("
                SELECT c.*, u.first_name, u.last_name, u.Full_Name, u.email 
                FROM Rating_Comments c
                JOIN Users u ON c.User_ID = u.User_ID
                WHERE c.Resource_ID = ?
                ORDER BY c.Created_At DESC
            ");
            $comments_stmt->execute([$resource_id]);
            $comments = $comments_stmt->fetchAll(PDO::FETCH_ASSOC);

            // حساب متوسط التقييم العام (النجوم) وعدد التقييمات
            $rating_calc = $pdo->prepare("SELECT AVG(Rating_Value) as avg_rating, COUNT(*) as rating_count FROM Rating_Comments WHERE Resource_ID = ? AND Rating_Value > 0");
            $rating_calc->execute([$resource_id]);
            $rating_stats = $rating_calc->fetch(PDO::FETCH_ASSOC);

            // إضافة الحسابات لمصفوفة المادة لإرسالها للواجهة
            $material['avg_rating'] = $rating_stats['avg_rating'] ?? 0;
            $material['rating_count'] = $rating_stats['rating_count'] ?? 0;

            echo json_encode(["status" => "success", "material" => $material, "comments" => $comments]);
        } catch (PDOException $e) {
            echo json_encode(["status" => "error", "message" => "حدث خطأ في الاتصال بقاعدة البيانات."]);
        }
        break;

    /**
     * معالجة إضافة تعليق وتقييم جديد للمادة من قبل المستخدم.
     */
    case 'add_comment':
        // حماية: يمنع التعليق لغير المسجلين
        if (!isset($_SESSION['user_id'])) {
            echo json_encode(["status" => "error", "message" => "يجب تسجيل الدخول لإضافة تعليق."]);
            exit();
        }

        $resource_id = $_POST['resource_id'] ?? '';
        $comment_text = trim($_POST['comment_text'] ?? '');
        $rating_value = $_POST['rating_value'] ?? 0;
        $user_id = $_SESSION['user_id'];

        // التأكد من استلام التقييم والنص
        if (empty($resource_id) || empty($comment_text) || $rating_value == 0) {
            echo json_encode(["status" => "error", "message" => "يرجى اختيار التقييم بالنجوم وكتابة التعليق."]);
            exit();
        }

        try {
            $stmt = $pdo->prepare("INSERT INTO Rating_Comments (Resource_ID, User_ID, Rating_Value, Comment_Text) VALUES (?, ?, ?, ?)");
            $stmt->execute([$resource_id, $user_id, $rating_value, $comment_text]);
            echo json_encode(["status" => "success", "message" => "تمت إضافة التعليق بنجاح."]);
        } catch (PDOException $e) {
            echo json_encode(["status" => "error", "message" => "حدث خطأ أثناء حفظ التعليق."]);
        }
        break;

    /**
     * معالجة حذف تعليق (محمي بنظام الصلاحيات RBAC).
     */
    case 'delete_comment':
        if (!isset($_SESSION['user_id'])) {
            echo json_encode(["status" => "error", "message" => "يجب تسجيل الدخول."]);
            exit();
        }

        $rating_id = $_POST['rating_id'] ?? '';
        $current_user_id = $_SESSION['user_id'];
        $user_role = $_SESSION['role'] ?? '';
        
        // التحقق مما إذا كان المستخدم يملك صلاحية إدارية عليا
        $is_admin = ($user_role === 'مشرف' || $user_role === 'مدير نظام');

        if (empty($rating_id)) {
            echo json_encode(["status" => "error", "message" => "معرف التعليق مفقود."]);
            exit();
        }

        try {
            // جلب صاحب التعليق للتحقق من هويته
            $stmt = $pdo->prepare("SELECT User_ID FROM Rating_Comments WHERE Rating_ID = ?");
            $stmt->execute([$rating_id]);
            $comment = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$comment) {
                echo json_encode(["status" => "error", "message" => "التعليق غير موجود."]);
                exit();
            }

            // منطق الحذف (RBAC): يُسمح بالحذف إذا كان المستخدم هو صاحب التعليق أو كان مدير/مشرف.
            if ($is_admin || $comment['User_ID'] == $current_user_id) {
                $del_stmt = $pdo->prepare("DELETE FROM Rating_Comments WHERE Rating_ID = ?");
                $del_stmt->execute([$rating_id]);
                echo json_encode(["status" => "success"]);
            } else {
                // رفض العملية إذا حاول مستخدم عادي حذف تعليق شخص آخر
                echo json_encode(["status" => "error", "message" => "غير مصرح لك بحذف هذا التعليق."]);
            }
        } catch (PDOException $e) {
            echo json_encode(["status" => "error", "message" => "حدث خطأ أثناء محاولة الحذف."]);
        }
        break;

    default:
        echo json_encode(["status" => "error", "message" => "إجراء غير صالح."]);
        break;
}
exit();
?>