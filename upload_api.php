<?php
/**
 * ============================================================================
 * DIRAYAAI - UPLOAD API
 * الوظيفة: معالجة رفع الملفات والروابط، وجلب قائمة المواد والطلبات السابقة للمستخدم.
 * ============================================================================
 */
session_start();
require_once "connect.php";
header('Content-Type: application/json; charset=utf-8');

/**
 * --- 1. حماية الجلسة والتحقق من تسجيل الدخول ---
 * طرد المستخدم إذا تجاوز 15 دقيقة (900 ثانية) من الخمول.
 */
$timeout_duration = 900; 
if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity']) > $timeout_duration) {
    session_unset();
    session_destroy();
    echo json_encode(["status" => "error", "message" => "session_expired"]);
    exit();
}
$_SESSION['last_activity'] = time(); // تحديث وقت النشاط

// منع الوصول لغير المسجلين
if (!isset($_SESSION['user_id'])) {
    echo json_encode(["status" => "error", "message" => "not_logged_in"]);
    exit();
}

// تخزين بيانات المستخدم الحالي
$user_id = $_SESSION['user_id'];
$user_role = $_SESSION['role'] ?? 'طالب'; // تعديل الصياغة لتكون عامة للجنسين
$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {
    /**
     * جلب المواد لصفحة الرفع (مرتبة حسب المستوى)
     */
    case 'get_subjects':
        try {
            $stmt = $pdo->prepare("SELECT Subject_ID, Subject_Name, Subject_Code FROM subjects WHERE Is_Active = 1 ORDER BY Level ASC");
            $stmt->execute();
            $subjects = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(["status" => "success", "subjects" => $subjects]);
        } catch (PDOException $e) {
            echo json_encode(["status" => "error", "message" => "فشل جلب المواد"]);
        }
        break;

    /**
     * جلب قائمة الطلبات السابقة الخاصة بالمستخدم الحالي (لعرضها في سجل الرفع)
     */
    case 'get_submissions':
        try {
            $stmt = $pdo->prepare("
                SELECT r.Resource_ID, r.Description, r.Resource_Type, r.File_URL, r.Status, r.Upload_Date, s.Subject_Name 
                FROM academic_resources r
                JOIN subjects s ON r.Subject_ID = s.Subject_ID
                WHERE r.User_ID = ?
                ORDER BY r.Upload_Date DESC
            ");
            $stmt->execute([$user_id]);
            $submissions = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(["status" => "success", "submissions" => $submissions]);
        } catch (PDOException $e) {
            echo json_encode(["status" => "error", "message" => "فشل جلب الطلبات"]);
        }
        break;

    /**
     * حذف طلب رفع (يُسمح فقط للطلبات التي لا تزال قيد المراجعة 'Pending')
     */
    case 'delete_submission':
        $resource_id = $_POST['resource_id'] ?? '';
        try {
            // التأكد من أن الطلب يخص المستخدم نفسه وأنه قيد المراجعة فقط لمنع حذف مواد معتمدة
            $stmt = $pdo->prepare("DELETE FROM academic_resources WHERE Resource_ID = ? AND User_ID = ? AND Status = 'Pending'");
            $stmt->execute([$resource_id, $user_id]);
            
            if ($stmt->rowCount() > 0) {
                echo json_encode(["status" => "success", "message" => "تم إلغاء الطلب بنجاح."]);
            } else {
                echo json_encode(["status" => "error", "message" => "لا يمكن حذف هذا الطلب (قد يكون معتمداً أو غير موجود)."]);
            }
        } catch (PDOException $e) {
            echo json_encode(["status" => "error", "message" => "حدث خطأ أثناء الحذف."]);
        }
        break;

    /**
     * معالجة استقبال الملف أو الرابط المرفوع من المستخدم وحفظه في السيرفر
     */
    case 'upload_resource':
        $upload_type = $_POST['upload_type'] ?? 'file';
        $subject_id = $_POST['subject_id'] ?? '';
        $description = htmlspecialchars(trim($_POST['description'] ?? ''), ENT_QUOTES, 'UTF-8');
        $resource_url = trim($_POST['resource_url'] ?? '');

        // تحقق من الحقول الأساسية
        if (empty($subject_id) || empty($description)) {
            echo json_encode(["status" => "error", "message" => "يرجى تعبئة جميع الحقول المطلوبة."]);
            exit();
        }

        $resource_type = '';
        $final_file_url = '';
        $title = '';

        // --- مسار رفع الملفات (Files) ---
        if ($upload_type === 'file') {
            // التأكد من وجود ملف وأنه تم رفعه بدون أخطاء
            if (!isset($_FILES['upload_file']) || $_FILES['upload_file']['error'] !== UPLOAD_ERR_OK) {
                echo json_encode(["status" => "error", "message" => "يرجى اختيار ملف صالح للرفع."]);
                exit();
            }

            $file_tmp_path = $_FILES['upload_file']['tmp_name'];
            $file_name = $_FILES['upload_file']['name'];
            $file_extension = strtolower(pathinfo($file_name, PATHINFO_EXTENSION));

            // تحديد الامتدادات المسموحة للأمان
            $allowed_file = ['pdf','ppt','pptx','docx','doc'];
            $allowed_video = ['mp4', 'mov', 'avi', 'mkv'];

            // تصنيف نوع الملف
            if (in_array($file_extension, $allowed_file)) {
                $resource_type = strtoupper($file_extension);
            } elseif (in_array($file_extension, $allowed_video)) {
                $resource_type = 'Video';
            } else {
                echo json_encode(["status" => "error", "message" => "عذراً، الصيغة المدعومة هي 'PDF' , 'PPTX' , 'PPT' , 'DOCX' , 'DOC' أو فيديو فقط." ]);
                exit();
            }

            // إنشاء مجلد الرفع إذا لم يكن موجوداً
            $upload_dir = 'uploads/';
            if (!is_dir($upload_dir)) mkdir($upload_dir, 0777, true);

            // إنشاء اسم فريد للملف لتجنب استبدال ملفات بنفس الاسم
            $new_file_name = uniqid('res_', true) . '.' . $file_extension;
            $dest_path = $upload_dir . $new_file_name;

            // نقل الملف من المسار المؤقت إلى المجلد النهائي
            if (move_uploaded_file($file_tmp_path, $dest_path)) {
                $final_file_url = $dest_path;
                $title = $file_name;
            } else {
                echo json_encode(["status" => "error", "message" => "فشل في حفظ الملف على السيرفر."]);
                exit();
            }
        } 
        // --- مسار إضافة الروابط (Links) ---
        else {
            // التحقق من صحة الرابط المدخل
            if (empty($resource_url) || !filter_var($resource_url, FILTER_VALIDATE_URL)) {
                echo json_encode(["status" => "error", "message" => "يرجى إدخال رابط صحيح."]);
                exit();
            }
            $resource_type = 'Link';
            $final_file_url = $resource_url;
            $title = 'رابط محتوى تعليمي';
        }

        // تحديد الحالة: الاعتماد التلقائي لمدير النظام والمشرفين (Approved)، وللطلاب (Pending)
        $status = ($user_role === 'مشرف' || $user_role === 'مدير نظام') ? 'Approved' : 'Pending';

        try {
            // إدخال بيانات الملف في قاعدة البيانات
            $stmt = $pdo->prepare("INSERT INTO academic_resources (User_ID, Subject_ID, Title, Description, Resource_Type, File_URL, Status) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$user_id, $subject_id, $title, $description, $resource_type, $final_file_url, $status]);
            
            // تسجيل العملية الإدارية (Audit Log) في حال كان الرفع من قبل مدير واعتمد تلقائياً
            if ($status === 'Approved') {
                $log_action = $pdo->prepare("INSERT INTO admin_actions (Admin_ID, Action_Type, Target_Table, Action_Description) VALUES (?, 'Insert', 'academic_resources', ?)");
                $desc = "قام المشرف/المدير برفع محتوى أكاديمي معتمَد مباشرة: $title";
                $log_action->execute([$user_id, $desc]);
            }

            // تجهيز رسالة الرد بناءً على دور المستخدم
            $msg = ($status === 'Approved') ? "تم رفع واعتماد المحتوى بنجاح!" : "تم إرسال المحتوى بنجاح! وهو الآن قيد المراجعة.";
            echo json_encode(["status" => "success", "message" => $msg]);

        } catch (PDOException $e) {
            echo json_encode(["status" => "error", "message" => "حدث خطأ في قاعدة البيانات أثناء حفظ الطلب."]);
        }
        break;

    default:
        echo json_encode(["status" => "error", "message" => "إجراء غير صالح."]);
        break;
}
exit();
?>
