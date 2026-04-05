<?php
/**
 * ============================================================================
 * DIRAYAAI - DATABASE CONNECTION
 * الوظيفة: إنشاء اتصال آمن بقاعدة البيانات باستخدام تقنية PDO
 * ============================================================================
 */

$host = "localhost";
$dbname = "your_database_name"; 
$dbusername = "root";
$dbpassword = "";

try {
    // إنشاء الاتصال مع دعم اللغة العربية (utf8mb4)
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $dbusername, $dbpassword);
    
    // تفعيل وضع التنبيهات للأخطاء (مهم جداً لاكتشاف المشاكل أثناء التطوير)
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

} catch (PDOException $e) {
    // إيقاف التنفيذ في حال فشل الاتصال بقاعدة البيانات
    die("Connection failed. Please contact admin."); 
}
?>