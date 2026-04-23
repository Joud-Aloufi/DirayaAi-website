<?php
/**
 * ============================================================================
 * DIRAYAAI - RESET PASSWORD PAGE
 * الوظيفة: التحقق من رمز الاستعادة وتغيير كلمة المرور
 * ============================================================================
 */
require_once "connect.php";

$token = $_GET['token'] ?? '';
$error = '';
$success = false;

// 1. التحقق من الرمز وصلاحيته فور فتح الصفحة
if (empty($token)) {
    $error = "رابط غير صالح.";
} else {
    $stmt = $pdo->prepare("SELECT User_ID FROM users WHERE Reset_Token = ? AND Token_Expiry > NOW()");
    $stmt->execute([$token]);
    $user = $stmt->fetch();

    if (!$user) {
        $error = "عذراً، الرابط غير صالح أو انتهت صلاحيته (الروابط صالحة لمدة ساعة واحدة فقط).";
    }
}

// 2. معالجة طلب تغيير كلمة المرور عند ضغط الزر
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$error) {
    $new_pass = $_POST['new_pass'] ?? '';
    $confirm_pass = $_POST['confirm_pass'] ?? '';

    if (strlen($new_pass) < 8) {
        $error = "يجب أن تكون كلمة المرور 8 خانات على الأقل.";
    } elseif ($new_pass !== $confirm_pass) {
        $error = "كلمات المرور غير متطابقة.";
    } else {
        // تشفير الباسورد وتحديثه وحذف الـ Token للأمان
        $hashed_password = password_hash($new_pass, PASSWORD_DEFAULT);
        $update = $pdo->prepare("UPDATE users SET Password_Hash = ?, Reset_Token = NULL, Token_Expiry = NULL WHERE User_ID = ?");
        $update->execute([$hashed_password, $user['User_ID']]);
        $success = true;
    }
}
?>

<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>DirayaAI | تعيين كلمة المرور</title>
    <link rel="stylesheet" href="style.css">
    <style>
        /* تنسيق إضافي بسيط لمركزية الصفحة */
        .reset-main { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #FFF7E4; padding: 20px; }
        .reset-card { background: white; padding: 40px; border-radius: 20px; box-shadow: 0 15px 35px rgba(179, 153, 114, 0.18); width: 100%; max-width: 450px; text-align: center; }
        .status-icon { font-size: 50px; margin-bottom: 20px; display: block; }
    </style>
</head>
<body class="reset-main">
    <div class="reset-card">
        <div class="login-brand">
            <div class="brand-circle"><img src="./assets/robot.png" alt="Logo" align-items: center;  width="60"></div>
            <h1 class="brand-title" style="font-size: 24px; margin-bottom: 20px;">DirayaAI</h1>
        </div>

        <?php if ($success): ?>
            <span class="status-icon">✅</span>
            <h2 style="color: #2e7d32; margin-bottom: 15px;">تم تغيير كلمة المرور!</h2>
            <p style="color: #666; margin-bottom: 25px;">يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.</p>
            <a href="signup.html" class="submit-btn" style="text-decoration: none; display: block;">العودة لتسجيل الدخول</a>

        <?php elseif ($error): ?>
            <span class="status-icon">⚠️</span>
            <h2 style="color: #d32f2f; margin-bottom: 15px;">خطأ في الطلب</h2>
            <p style="color: #666; margin-bottom: 25px;"><?php echo $error; ?></p>
            <a href="signup.html" class="link-btn">العودة للموقع</a>

        <?php else: ?>
            <div class="form-header">
                <h2>تعيين كلمة مرور جديدة</h2>
                <p style="color: #666; font-size: 14px; margin-bottom: 20px;">الرجاء إدخال كلمة مرور قوية يسهل عليك تذكرها.</p>
            </div>

            <form method="POST" class="auth-form">
                <div class="input-group">
                    <label>كلمة المرور الجديدة</label>
                    <input type="password" name="new_pass" id="password" class="standard-input" placeholder="8 خانات على الأقل" required>
                </div>
                
                <div class="input-group">
                    <label>تأكيد كلمة المرور</label>
                    <input type="password" name="confirm_pass" class="standard-input" placeholder="أعد إدخال كلمة المرور" required>
                </div>

                <button type="submit" class="submit-btn">تحديث كلمة المرور</button>
            </form>
        <?php endif; ?>
    </div>

    <script src="translations.js"></script>
    <script src="main.js"></script>
    <script>
        // تشغيل عداد القوة يدوياً لهذا الملف
        document.addEventListener('DOMContentLoaded', () => {
            if(typeof initPasswordStrengthMeter === 'function') initPasswordStrengthMeter();
        });
    </script>
</body>
</html>