<?php
/**
 * ============================================================================
 * DIRAYAAI - AUTHENTICATION HANDLER
 * الوظيفة: معالجة طلبات إنشاء الحساب، تسجيل الدخول، وتسجيل الخروج
 * ============================================================================
 */
session_start();
require_once "connect.php";

// جلب نوع العملية المطلوبة (Action)
$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {
    case 'signup':
        handleSignup($pdo);
        break;
    case 'login':
        handleLogin($pdo);
        break;
    case 'logout':
        handleLogout();
        break;
    case 'forgot_password':
        handleForgotPassword($pdo);
        break;
    default:
        exit("invalid_action");
}

/**
 * ==========================================
 * 1. قسم إنشاء الحساب (Signup)
 * ==========================================
 */
function handleSignup($pdo) {
    // تنظيف المدخلات من الفراغات
    $first_name = trim($_POST['f_name'] ?? '');
    $last_name  = trim($_POST['l_name'] ?? '');
    $id_number  = trim($_POST['uni_id'] ?? '');
    $email      = trim($_POST['user_email'] ?? '');
    $phone      = trim($_POST['user_phone'] ?? '');
    $password   = $_POST['user_pass'] ?? '';

    // التحقق من الحقول الفارغة
    if (empty($first_name) || empty($last_name) || empty($id_number) || empty($email) || empty($password)) {
        exit("invalid_empty_fields");
    }

    // التحقق من صحة صيغ المدخلات (Validation)
    if (!preg_match('/^[\p{Arabic}a-zA-Z\s]+$/u', $first_name) || !preg_match('/^[\p{Arabic}a-zA-Z\s]+$/u', $last_name)) {
        exit("invalid_name");
    }
    if (!preg_match('/^[0-9]{8}$/', $id_number)) { exit("invalid_id_format"); }
    if (!empty($phone) && !preg_match('/^[0-9]{10}$/', $phone)) { exit("invalid_phone_format"); }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { exit("invalid_email_format"); }
    
    // قوة كلمة المرور (8 أحرف، حرف كبير وصغير، رقم، ورمز خاص)
    if (!preg_match('/^(?=.*[a-z])(?=.*[A-Z])[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};\':"\\\\|,.<>\/?]{8,}$/', $password)) {
        exit("invalid_password_strength");
    }

    // التحقق من عدم تكرار البريد الإلكتروني
    $checkEmail = $pdo->prepare("SELECT email FROM users WHERE email = ?");
    $checkEmail->execute([$email]);
    if ($checkEmail->fetch()) { exit("email_exists"); }

    // التحقق من عدم تكرار الرقم الجامعي
    $checkId = $pdo->prepare("SELECT id_number FROM users WHERE id_number = ?");
    $checkId->execute([$id_number]);
    if ($checkId->fetch()) { exit("id_exists"); }

    // إدخال البيانات في قاعدة البيانات
    try {
        $hashed_password = password_hash($password, PASSWORD_DEFAULT);
        
        // 🌟 التعديل هنا: شلنا الـ role تماماً عشان قاعدة البيانات تحط الديفولت (طالب) تلقائياً 🌟
        $query = "INSERT INTO users (id_number, first_name, last_name, email, Password_Hash, Phone_Number) 
                  VALUES (?, ?, ?, ?, ?, ?)";
        $stmt = $pdo->prepare($query);
        $stmt->execute([$id_number, $first_name, $last_name, $email, $hashed_password, $phone]);
        
        exit("success");
    } catch (PDOException $e) {
        exit("Database Error"); // تم إخفاء تفاصيل الخطأ لدواعي أمنية
    }
}

/**
 * ==========================================
 * 2. قسم تسجيل الدخول (Login)
 * ==========================================
 */
function handleLogin($pdo) {
    $email = trim($_POST['login_email'] ?? '');
    $password = $_POST['login_pass'] ?? '';

    // البحث عن المستخدم بالبريد الإلكتروني
    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // التحقق من وجود المستخدم وصلاحية الحساب وكلمة المرور
    if (!$user) { exit("invalid_credentials"); }
    if (!$user['Is_Active']) { exit("account_disabled"); }
    if (!password_verify($password, $user['Password_Hash'])) { exit("invalid_credentials"); }

    // تحديث إحصائيات تسجيل الدخول
    $update = $pdo->prepare("UPDATE users SET Login_Count = Login_Count + 1, Last_Login = NOW() WHERE User_ID = ?");
    $update->execute([$user['User_ID']]);

    // حفظ بيانات الجلسة (Session)
    $_SESSION['user_id'] = $user['User_ID'];
    $_SESSION['user_name'] = $user['first_name'] . ' ' . $user['last_name'];
    $_SESSION['role'] = $user['role'];
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    $_SESSION['last_activity'] = time(); 

    // توجيه المستخدم حسب الرتبة
    if ($user['role'] === 'مشرف' || $user['role'] === 'مدير نظام') {
        exit("success_admin");
    } else {
        exit("success_student");
    }
}

/**
 * ==========================================
 * 3. قسم تسجيل الخروج (Logout)
 * ==========================================
 */
function handleLogout() {
    session_unset();
    session_destroy();
    header("Location: index.html");
    exit();
}

/**
 * ==========================================
 * 4. نظام استعادة كلمة المرور عبر الإيميل
 * ==========================================
 */
function handleForgotPassword($pdo) {
    try {
        $email = trim($_POST['forgot_email'] ?? '');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { exit("invalid_email_format"); }

        // التحقق من وجود الحساب (تأكدي من مطابقة حالة أحرف الأعمدة في قاعدة بياناتك)
        $stmt = $pdo->prepare("SELECT User_ID, First_Name FROM users WHERE Email = ? AND Is_Active = 1");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if ($user) {
            $token = bin2hex(random_bytes(32));
            $expiry = date("Y-m-d H:i:s", strtotime("+1 hour"));

            $update = $pdo->prepare("UPDATE users SET Reset_Token = ?, Token_Expiry = ? WHERE User_ID = ?");
            $update->execute([$token, $expiry, $user['User_ID']]);

            $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http";
            $domain = $_SERVER['HTTP_HOST'];
            $resetLink = $protocol . "://" . $domain . "/reset_password.php?token=" . $token;
            
            $to = $email;
            $subject = "استعادة كلمة المرور - DirayaAI";
            $message = "مرحباً " . $user['First_Name'] . "،\n\nلقد طلبتِ استعادة كلمة المرور لحسابك في منصة DirayaAI.\nالرجاء الضغط على الرابط التالي لتعيين كلمة مرور جديدة:\n" . $resetLink . "\n\nفريق DirayaAI";
            
            $headers = "From: noreply@" . $domain . "\r\n" . "Content-Type: text/plain; charset=UTF-8\r\n";
//Presentation Mode
            if (@mail($to, $subject, $message, $headers)) {
                echo "success_email_sent"; 
            } else {
                echo "success_link|" . $resetLink;
            }

        } else {
            exit("email_not_found");
        }
    } catch (PDOException $e) {
        exit("database_error"); 
    }
}
?>
