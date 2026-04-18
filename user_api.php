<?php
/**
 * ============================================================================
 * DIRAYAAI - USER API
 * الوظيفة: إدارة الجلسات، جلب بيانات الملف الشخصي، وتحديثها (شاملاً كلمات المرور).
 * ============================================================================
 */
session_start();
require_once "connect.php";
header('Content-Type: application/json; charset=utf-8');

/**
 * --- نظام الحماية: طرد المستخدم إذا تجاوز وقت الخمول 15 دقيقة ---
 */
$timeout_duration = 900; 
if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity']) > $timeout_duration) {
    session_unset();
    session_destroy();
    echo json_encode(["status" => "error", "message" => "session_expired", "logged_in" => false]);
    exit();
}
if(isset($_SESSION['last_activity'])) {
    $_SESSION['last_activity'] = time(); // تحديث وقت النشاط
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {
    /**
     * التحقق من حالة الجلسة الحالية وإرجاع بيانات المستخدم للواجهة (Navbar/Routes)
     */
    case 'check_session':
        if (isset($_SESSION['user_id']) && isset($_SESSION['user_name'])) {
            echo json_encode(["logged_in" => true, "user_name" => $_SESSION['user_name'], "role" => $_SESSION['role'], "csrf_token" => $_SESSION['csrf_token']]);
        } else {
            echo json_encode(["logged_in" => false]);
        }
        break;

    /**
     * جلب بيانات الملف الشخصي للمستخدم لعرضها في صفحة البروفايل
     */
    case 'get_profile':
        if (!isset($_SESSION['user_id'])) {
            echo json_encode(['status' => 'error', 'message' => 'غير مصرح لك.']);
            exit();
        }
        try {
            $stmt = $pdo->prepare("SELECT * FROM Users WHERE User_ID = ?");
            $stmt->execute([$_SESSION['user_id']]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($user) {
                // أمان: إزالة كلمة المرور المشفرة من المصفوفة حتى لا يتم إرسالها للواجهة الأمامية أبداً
                unset($user['Password_Hash']); 
                echo json_encode(['status' => 'success'] + $user);
            } else {
                echo json_encode(['status' => 'error', 'message' => 'المستخدم غير موجود.']);
            }
        } catch (PDOException $e) {
            echo json_encode(['status' => 'error', 'message' => 'خطأ في قاعدة البيانات.']);
        }
        break;

    /**
     * تحديث بيانات المستخدم (الاسم، الإيميل، الجوال) وتغيير كلمة المرور إن طلب.
     */
    case 'update_profile':
        if (!isset($_SESSION['user_id'])) {
            echo json_encode(['status' => 'error', 'message' => 'غير مصرح لك.']);
            exit();
        }
        
        $user_id = $_SESSION['user_id'];
        $f_name = trim($_POST['first_name'] ?? '');
        $l_name = trim($_POST['last_name'] ?? '');
        $email = trim($_POST['email'] ?? '');
        $phone = trim($_POST['phone'] ?? '');
        
        // متغيرات تغيير كلمة المرور
        $current_pass = $_POST['current_pass'] ?? '';
        $new_pass = $_POST['new_pass'] ?? '';
        $confirm_pass = $_POST['confirm_pass'] ?? '';

        if (empty($f_name) || empty($l_name) || empty($email)) {
            echo json_encode(['status' => 'error', 'message' => 'الرجاء تعبئة الاسم والبريد الإلكتروني.']);
            exit();
        }
        
        // التحقق من أن البريد الإلكتروني الجديد غير مستخدم من قبل شخص آخر في النظام
        $checkEmail = $pdo->prepare("SELECT User_ID FROM Users WHERE email = ? AND User_ID != ?");
        $checkEmail->execute([$email, $user_id]);
        if ($checkEmail->fetch()) {
            echo json_encode(['status' => 'error', 'message' => 'هذا البريد الإلكتروني مسجل لحساب آخر!']);
            exit();
        }

        try {
            // 🌟 نظام التحقق وتغيير كلمة المرور 🌟
            if (!empty($new_pass)) {
                if (empty($current_pass) || empty($confirm_pass)) {
                    echo json_encode(['status' => 'error', 'message' => 'الرجاء تعبئة جميع حقول كلمة المرور.']);
                    exit();
                }
                if ($new_pass !== $confirm_pass) {
                    echo json_encode(['status' => 'error', 'message' => 'كلمات المرور الجديدة غير متطابقة.']);
                    exit();
                }
                
                // جلب كلمة المرور القديمة من الداتابيز لمطابقتها للتحقق من هوية المستخدم
                $stmt = $pdo->prepare("SELECT Password_Hash FROM Users WHERE User_ID = ?");
                $stmt->execute([$user_id]);
                $user = $stmt->fetch();
                
                // التحقق من الباسورد الحالي المدخل مقابل التشفير
                if (!password_verify($current_pass, $user['Password_Hash'])) {
                    echo json_encode(['status' => 'error', 'message' => 'كلمة المرور الحالية غير صحيحة.']);
                    exit();
                }
                
                // تشفير كلمة المرور الجديدة وتحديثها في القاعدة
                $new_hash = password_hash($new_pass, PASSWORD_DEFAULT);
                $update_pw = $pdo->prepare("UPDATE Users SET Password_Hash = ? WHERE User_ID = ?");
                $update_pw->execute([$new_hash, $user_id]);
            }

            // تحديث البيانات الأساسية (الاسم والإيميل والرقم)
            $update = $pdo->prepare("UPDATE Users SET first_name = ?, last_name = ?, email = ?, Phone_Number = ? WHERE User_ID = ?");
            $update->execute([$f_name, $l_name, $email, $phone, $user_id]);
            
            // تحديث الجلسة بالاسم الجديد
            $_SESSION['user_name'] = $f_name . ' ' . $l_name;
            
            echo json_encode(['status' => 'success', 'message' => 'تم الحفظ بنجاح!']);
        } catch (PDOException $e) {
            echo json_encode(['status' => 'error', 'message' => 'حدث خطأ أثناء التحديث.']);
        }
        break;

    /**
     * جلب إشعارات المستخدم الحالية (الخاصة بقبول أو رفض ملفاته)
     */
    case 'get_notifications':
        if (!isset($_SESSION['user_id'])) { echo json_encode(['status' => 'error']); exit(); }
        try {
            $stmt = $pdo->prepare("SELECT * FROM Notifications WHERE User_ID = ? ORDER BY Created_At DESC");
            $stmt->execute([$_SESSION['user_id']]);
            echo json_encode(['status' => 'success', 'notifications' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        } catch(PDOException $e) { echo json_encode(['status' => 'error']); }
        break;

    /**
     * جعل جميع إشعارات المستخدم "مقروءة" (Is_Read = 1) لإخفاء نقطة التنبيه الحمراء
     */
    case 'mark_notifications_read':
        if (!isset($_SESSION['user_id'])) { echo json_encode(['status' => 'error']); exit(); }
        try {
            $stmt = $pdo->prepare("UPDATE Notifications SET Is_Read = 1 WHERE User_ID = ?");
            $stmt->execute([$_SESSION['user_id']]);
            echo json_encode(['status' => 'success']);
        } catch(PDOException $e) { echo json_encode(['status' => 'error']); }
        break;
        
    default:
        echo json_encode(["status" => "error", "message" => "إجراء غير صالح."]);
        break;
}
exit();
?>
