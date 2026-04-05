<?php
/**
 * ============================================================================
 * DIRAYAAI - ADMIN API (Backend)
 * الوظيفة: معالجة العمليات الإدارية (إضافة مستخدمين، إدارة المواد، مراجعة الطلبات).
 * يعتمد على PDO للاتصال بقاعدة البيانات بشكل آمن.
 * ============================================================================
 */
session_start();
require_once "connect.php"; // استدعاء ملف الاتصال بقاعدة البيانات

/**
 * ----------------------------------------------------------------------------
 * 1. نظام الحماية وإدارة الجلسات (Session Security & Timeout)
 * ----------------------------------------------------------------------------
 * يتم التحقق من وقت خمول المستخدم. إذا تجاوز 15 دقيقة (900 ثانية) بدون نشاط،
 * يتم تدمير الجلسة وطرد المستخدم لحماية النظام.
 */
$timeout_duration = 900; 
if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity']) > $timeout_duration) {
    session_unset();     // تفريغ متغيرات الجلسة
    session_destroy();   // تدمير الجلسة بالكامل
    die("session_expired"); // إيقاف التنفيذ وإرسال حالة انتهاء الجلسة للواجهة
}
// تحديث وقت آخر نشاط إذا كان المستخدم لا يزال متفاعلاً
if(isset($_SESSION['last_activity'])) {
    $_SESSION['last_activity'] = time();
}

/**
 * ----------------------------------------------------------------------------
 * 2. نظام التحكم بالوصول (Role-Based Access Control - RBAC)
 * ----------------------------------------------------------------------------
 * حماية صارمة للمسار: التحقق من أن المستخدم مسجل دخول، وأن صلاحيته (Role)
 * هي إما 'مشرف' أو 'مدير نظام'. أي محاولة وصول غير مصرح بها يتم رفضها فوراً.
 */
if (!isset($_SESSION['user_id']) || ($_SESSION['role'] !== 'مشرف' && $_SESSION['role'] !== 'مدير نظام')) {
    die(json_encode(["status" => "error", "message" => "unauthorized"]));
}

// استقبال نوع العملية (Action) سواء جاءت عبر GET أو POST
$action = $_GET['action'] ?? $_POST['action'] ?? '';

// توجيه الطلب بناءً على العملية المطلوبة (Routing)
switch ($action) {
    
    /**
     * ==========================================
     * القسم الأول: إدارة المستخدمين (للمدير فقط)
     * ==========================================
     */
    case 'add_user':
        // تنظيف المدخلات (Sanitization) لإزالة المسافات الزائدة
        $first_name = trim($_POST['f_name'] ?? '');
        $last_name  = trim($_POST['l_name'] ?? '');
        $id_number  = trim($_POST['uni_id'] ?? '');
        $email      = trim($_POST['user_email'] ?? '');
        $phone      = trim($_POST['user_phone'] ?? '');
        $password   = $_POST['user_pass'] ?? '';
        $role       = $_POST['user_role'] ?? ''; 

        // التحقق من أن الحقول الأساسية غير فارغة
        if (empty($first_name) || empty($last_name) || empty($id_number) || empty($email) || empty($password) || empty($role)) { 
            die("يرجى تعبئة جميع الحقول المطلوبة."); 
        }
        
        try {
            // 1. التحقق من عدم تكرار البريد أو الرقم الجامعي (لمنع خطأ قاعدة البيانات)
            $check_stmt = $pdo->prepare("SELECT id_number, email FROM Users WHERE id_number = ? OR email = ?");
            $check_stmt->execute([$id_number, $email]);
            $existing_user = $check_stmt->fetch(PDO::FETCH_ASSOC);

            if ($existing_user) {
                if ($existing_user['email'] === $email) {
                    die("البريد الإلكتروني مسجل مسبقاً لحساب آخر.");
                }
                if ($existing_user['id_number'] === $id_number) {
                    die("الرقم الجامعي أو الوظيفي مسجل مسبقاً في النظام.");
                }
            }

            // 2. معالجة رقم الجوال (إذا كان فارغاً نجعله NULL لتجنب أخطاء الداتابيز)
            $phone_val = empty($phone) ? null : $phone;

            // 3. تشفير كلمة المرور والإدخال الآمن
            $hashed_password = password_hash($password, PASSWORD_DEFAULT);
            $query = "INSERT INTO Users (id_number, first_name, last_name, email, Password_Hash, role, Phone_Number) VALUES (?, ?, ?, ?, ?, ?, ?)";
            $stmt = $pdo->prepare($query); 
            $stmt->execute([$id_number, $first_name, $last_name, $email, $hashed_password, $role, $phone_val]);

            echo "success";
        } catch (PDOException $e) { 
            // طباعة رسالة الخطأ الدقيقة من الداتابيز لتسهيل اكتشاف أي خطأ مستقبلاً
            echo "تفاصيل الخطأ: " . $e->getMessage(); 
        }
        break;

    /**
     * ==========================================
     * القسم الثاني: مراجعة الطلبات المرفوعة
     * ==========================================
     */
    
    // جلب جميع الطلبات مع إحصائياتها
    case 'get_all_submissions':
        header('Content-Type: application/json; charset=utf-8');
        try {
            // 1. جلب الإحصائيات (قيد المراجعة، مقبول، مرفوض) لتحديث العدادات في لوحة التحكم
            $stats_stmt = $pdo->query("SELECT Status, COUNT(*) as count FROM Academic_Resources GROUP BY Status");
            $stats = ['Pending' => 0, 'Approved' => 0, 'Rejected' => 0];
            while ($row = $stats_stmt->fetch(PDO::FETCH_ASSOC)) { 
                $stats[$row['Status']] = $row['count']; 
            }

            // 2. جلب تفاصيل الطلبات مع ربط الجداول (JOIN) لجلب إيميل الطالب واسم المادة
            $sub_stmt = $pdo->query("
                SELECT r.Resource_ID, r.Description, r.Resource_Type, r.File_URL, r.Status, r.Upload_Date, 
                       u.email, s.Subject_Name 
                FROM Academic_Resources r
                JOIN Users u ON r.User_ID = u.User_ID
                JOIN Subjects s ON r.Subject_ID = s.Subject_ID
                ORDER BY r.Upload_Date DESC
            ");
            $submissions = $sub_stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode(["status" => "success", "stats" => $stats, "submissions" => $submissions]);
        } catch (PDOException $e) { 
            echo json_encode(["status" => "error", "message" => "Database Error"]); 
        }
        break;

    // تحديث حالة الطلب (قبول/رفض) وإرسال إشعار للطالب
    case 'update_status':
        header('Content-Type: application/json; charset=utf-8');
        $resource_id = $_POST['resource_id'] ?? '';
        $new_status = $_POST['new_status'] ?? '';
        try {
            // 1. تحديث حالة الطلب في قاعدة البيانات
            $update = $pdo->prepare("UPDATE Academic_Resources SET Status = ? WHERE Resource_ID = ?");
            $update->execute([$new_status, $resource_id]);

            // 2. جلب بيانات الطلب لمعرفة من هو الطالب (User_ID) واسم المادة لإرسال الإشعار
            $stmt = $pdo->prepare("
                SELECT r.User_ID, s.Subject_Name 
                FROM Academic_Resources r 
                JOIN Subjects s ON r.Subject_ID = s.Subject_ID 
                WHERE r.Resource_ID = ?
            ");
            $stmt->execute([$resource_id]);
            $resource = $stmt->fetch(PDO::FETCH_ASSOC);

            // 3. إنشاء الإشعار (Notification) وإضافته في قاعدة البيانات بناءً على الحالة الجديدة
            if ($resource) {
                // إزالة الايموجي من رسائل التنبيه
                $title = ($new_status === 'Approved') ? 'تم قبول طلبك!' : 'عذراً، تم رفض طلبك';
                $message = ($new_status === 'Approved') 
                    ? "تمت الموافقة على المحتوى الذي رفعته لمادة: " . $resource['Subject_Name'] . "، وأصبح متاحاً للجميع الآن." 
                    : "نأسف، تم رفض المحتوى المرفوع لمادة: " . $resource['Subject_Name'] . " لمخالفته الشروط أو لوجود محتوى مشابه.";
                
                $notify = $pdo->prepare("INSERT INTO Notifications (User_ID, Title, Message) VALUES (?, ?, ?)");
                $notify->execute([$resource['User_ID'], $title, $message]);
            }

            echo json_encode(["status" => "success"]);
        } catch (PDOException $e) { 
            echo json_encode(["status" => "error", "message" => "Update Failed"]); 
        }
        break;

    // حذف طلب الرفع (مع تسجيل العملية في سجلات النظام - Audit Log)
    case 'delete_submission':
        header('Content-Type: application/json; charset=utf-8');
        $resource_id = $_POST['resource_id'] ?? '';

        // التحقق من إرسال رقم المورد
        if (empty($resource_id)) {
            echo json_encode(["status" => "error", "message" => "معرف المورد مفقود."]);
            exit();
        }

        try {
            // 1. حذف المورد من قاعدة البيانات
            $stmt = $pdo->prepare("DELETE FROM Academic_Resources WHERE Resource_ID = ?");
            $stmt->execute([$resource_id]);

            // 2. تسجيل العملية (Audit Trail) لأغراض المراقبة الأمنية والتحليل
            $log = $pdo->prepare("INSERT INTO Admin_Actions (Admin_ID, Action_Type, Target_Table, Action_Description) VALUES (?, 'Delete', 'Academic_Resources', ?)");
            $desc = "حذف مورد برقم ($resource_id) بواسطة: " . $_SESSION['user_name'];
            $log->execute([$_SESSION['user_id'], $desc]);

            echo json_encode(["status" => "success"]);
        } catch (PDOException $e) {
            echo json_encode(["status" => "error", "message" => "فشل الحذف. قد يكون الملف مرتبطاً ببيانات أخرى."]);
        }
        break;

    /**
     * ==========================================
     * القسم الثالث: إدارة المواد الأكاديمية (Subjects)
     * ==========================================
     */
    
    // إضافة مادة جديدة أو تحديث بيانات مادة حالية
    case 'add_subject':
        header('Content-Type: application/json; charset=utf-8');
        // استقبال البيانات الأساسية للمادة
        $subject_id = $_POST['subject_id'] ?? null; 
        $sub_code = trim($_POST['subject_code'] ?? '');
        $sub_name = trim($_POST['subject_name'] ?? '');
        $college  = trim($_POST['college'] ?? '');
        $dept     = trim($_POST['department'] ?? '');
        $credit_hours = trim($_POST['credit_hours'] ?? '');
        $level = trim($_POST['level'] ?? '');
        $description = trim($_POST['description'] ?? '');
        
        // دمج اسم الكلية والقسم إذا لم تكن متطلب جامعة عام
        $full_department = ($college === 'متطلب جامعة عام') ? $college : $college . ' - ' . $dept;

        try {
            // إذا تم إرسال subject_id، فهذا يعني أن العملية هي "تحديث" (Update)
            if ($subject_id) {
                $stmt = $pdo->prepare("UPDATE Subjects SET Subject_Code = ?, Subject_Name = ?, Department = ?, Credit_Hours = ?, Level = ?, Description = ? WHERE Subject_ID = ?");
                $stmt->execute([$sub_code, $sub_name, $full_department, $credit_hours, $level, $description, $subject_id]);
            } 
            // إذا لم يتم إرسال subject_id، فهذا يعني أن العملية هي "إضافة جديدة" (Insert)
            else {
                $stmt = $pdo->prepare("INSERT INTO Subjects (Subject_Code, Subject_Name, Department, Credit_Hours, Level, Description) VALUES (?, ?, ?, ?, ?, ?)");
                $stmt->execute([$sub_code, $sub_name, $full_department, $credit_hours, $level, $description]);
            }
            echo json_encode(['status' => 'success', 'message' => 'تمت العملية بنجاح!']);
        } catch (PDOException $e) { 
            echo json_encode(['status' => 'error', 'message' => 'DB Error']); 
        }
        break;

    // حذف مادة أكاديمية نهائياً
    case 'delete_subject':
        header('Content-Type: application/json; charset=utf-8');
        $id = $_GET['id'] ?? null;
        try {
            $stmt = $pdo->prepare("DELETE FROM Subjects WHERE Subject_ID = ?");
            $stmt->execute([$id]);
            echo json_encode(['status' => 'success', 'message' => 'تم الحذف.']);
        } catch (PDOException $e) { 
            // في حال كانت المادة مرتبطة بملفات أخرى في قاعدة البيانات، سيتم التقاط الخطأ هنا
            echo json_encode(['status' => 'error', 'message' => 'Delete Failed']); 
        }
        break;

    // جلب جميع المواد لعرضها في المنصة أو لوحة التحكم
    case 'get_all_subjects':
        header('Content-Type: application/json; charset=utf-8');
        try {
            $stmt = $pdo->query("SELECT * FROM Subjects ORDER BY Subject_Code ASC");
            echo json_encode(['status' => 'success', 'subjects' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        } catch (PDOException $e) { 
            echo json_encode(['status' => 'error']); 
        }
        break;

    // معالجة الأخطاء في حال تم استدعاء Action غير موجود
    default:
        echo json_encode(["status" => "error", "message" => "invalid_action"]);
        break;
}
exit();
?>