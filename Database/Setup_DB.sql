-- 1. تنظيف شامل
DROP DATABASE IF EXISTS DirayaAI_DB;
CREATE DATABASE DirayaAI_DB;
USE DirayaAI_DB;

-- 2. جدول المستخدمين الموحد (يخدم الطالبات والمشرفات بنفس الأعمدة)
CREATE TABLE Users (
    User_ID INT AUTO_INCREMENT PRIMARY KEY,          
    id_number VARCHAR(20) UNIQUE NOT NULL,           -- الرقم الجامعي للطالبات / الوظيفي للمشرفات
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    Full_Name VARCHAR(150) GENERATED ALWAYS AS (CONCAT(first_name, ' ', last_name)) STORED,
    email VARCHAR(100) UNIQUE NOT NULL,              
    Password_Hash VARCHAR(255) NOT NULL,             
    role ENUM('طالبة', 'مشرفة') NOT NULL,             
    Phone_Number VARCHAR(15) NULL,                   
    Is_Active BOOLEAN DEFAULT TRUE,                  
    Login_Count INT DEFAULT 0,                       
    Last_Login DATETIME DEFAULT NULL,                
    Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3. جدول المواد
CREATE TABLE Subjects (
    Subject_ID INT AUTO_INCREMENT PRIMARY KEY,
    Subject_Code VARCHAR(20) UNIQUE NOT NULL,
    Subject_Name VARCHAR(100) NOT NULL,
    Description TEXT,
    Credit_Hours INT,
    Department VARCHAR(100) DEFAULT 'Information Technology',
    Level INT,
    Is_Active BOOLEAN DEFAULT TRUE,
    Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4. جدول الأسئلة الشائعة (FAQ)
CREATE TABLE FAQ_Knowledge_Base (
    FAQ_ID INT AUTO_INCREMENT PRIMARY KEY,
    Subject_ID INT NOT NULL,
    Category VARCHAR(100),
    Question_Text TEXT NOT NULL,
    Answer_Text TEXT NOT NULL,
    Keywords TEXT,
    Is_Approved BOOLEAN DEFAULT FALSE,
    Approved_By INT NULL,
    Last_Updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (Subject_ID) REFERENCES Subjects(Subject_ID) ON DELETE CASCADE,
    FOREIGN KEY (Approved_By) REFERENCES Users(User_ID) ON DELETE SET NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 5. إدخال الطالبات الـ 9 (كامل البيانات)
INSERT INTO Users (id_number, first_name, last_name, email, Password_Hash, role, Phone_Number) VALUES 
('44202652', 'أريام', 'طارق جشان', 'S44202652@students.tu.edu.sa', 'pass_44202652', 'طالبة', '0551111111'),
('44206814', 'جود', 'سعد العوفي', 'S44206814@students.tu.edu.sa', 'pass_44206814', 'طالبة', '0552222222'),
('44201827', 'منيرة', 'سعد الغامدي', 'S44201827@students.tu.edu.sa', 'pass_44201827', 'طالبة', '0553333333'),
('44201778', 'فوز', 'عبدالله العتيبي', 'S44201778@students.tu.edu.sa', 'pass_44201778', 'طالبة', '0554444444'),
('44205921', 'أمل', 'حسين المالكي', 'S44205921@students.tu.edu.sa', 'pass_44205921', 'طالبة', '0555555555'),
('44106628', 'شهد', 'سفر العتيبي', 'S44106628@students.tu.edu.sa', 'pass_44106628', 'طالبة', '0556666666'),
('44200573', 'منار', 'محسن السفياني', 'S44200573@students.tu.edu.sa', 'pass_44200573', 'طالبة', '0557777777'),
('44200626', 'وجد', 'محمد السلمي', 'S44200626@students.tu.edu.sa', 'pass_44200626', 'طالبة', '0558888888'),
('44118635', 'نوران', 'شاكر النمري', 'S44118635@students.tu.edu.sa', 'pass_44118635', 'طالبة', '0559999999');

-- 6. إدخال المشرفات الـ 7 (بنفس تفاصيل الطالبات: إيميل، باسورد، رقم جوال)
INSERT INTO Users (id_number, first_name, last_name, email, Password_Hash, role, Phone_Number) VALUES 
('1001', 'أريج', 'محجب', 'areej@tu.edu.sa', 'admin_pass_1', 'مشرفة', '0560000001'),
('1002', 'مريم', 'خالد', 'a112345@admin.com', 'admin_pass_2', 'مشرفة', '0560000002'),
('1003', 'نوال', 'أحمد', 'a234567@admin.com', 'admin_pass_3', 'مشرفة', '0560000003'),
('1004', 'سارة', 'محمد', 'a334567@admin.com', 'admin_pass_4', 'مشرفة', '0560000004'),
('1005', 'خديجة', 'حسن', 'a445469@admin.com', 'admin_pass_5', 'مشرفة', '0560000005'),
('1006', 'رنيم', 'عبدالله', 'a998765@admin.com', 'admin_pass_6', 'مشرفة', '0560000006'),
('1007', 'ود', 'سعد', 'a823498@admin.com', 'admin_pass_7', 'مشرفة', '0560000007');

-- 7. إدخال مادة إدارية
INSERT INTO Subjects (Subject_Code, Subject_Name, Level) VALUES ('ADM-001', 'الشؤون الأكاديمية', 0);

-- 8. إدخال الأسئلة (التواريخ)
INSERT INTO FAQ_Knowledge_Base (Subject_ID, Category, Question_Text, Answer_Text, Is_Approved, Approved_By) VALUES 
(1, 'Holidays', 'متى تبدأ إجازة عيد الفطر؟', 'تبدأ إجازة عيد الفطر المبارك من يوم 09/09/1447 هـ.', TRUE, 10),
(1, 'Admission', 'ما هو موعد الاعتذار عن الدراسة؟', 'آخر موعد هو 15/08/1447 هـ.', TRUE, 10),
(1, 'Holidays', 'متى إجازة يوم التأسيس؟', 'في يوم 05/09/1447 هـ.', TRUE, 10),
(1, 'Academic', 'متى تبدأ الدراسة بعد إجازة عيد الفطر؟', 'في يوم 10/10/1447 هـ.', TRUE, 10),
(1, 'Academic', 'ما هو موعد الاعتذار عن مقرر دراسي؟', 'حتى موعد أقصاه 16/11/1447 هـ.', TRUE, 10);

-- 9. عرض النتائج (كل المستخدمين مع بياناتهم كاملة)
SELECT 
    id_number AS 'رقم الهوية/الجامعي', 
    Full_Name AS 'الاسم الكامل', 
    email AS 'البريد', 
    role AS 'الدور', 
    Phone_Number AS 'الجوال',
    Password_Hash AS 'كلمة المرور'
FROM Users;
USE DirayaAI_DB;

-- إضافة مواد متنوعة لجدول المواد
INSERT INTO Subjects (Subject_Code, Subject_Name, Description, Credit_Hours, Level) VALUES 
('MAT-101', 'الرياضيات المتقطعة', 'دراسة الهياكل الرياضية المتقطعة والمنطق', 3, 2),
('CS-203', 'برمجة الحاسب 2', 'البرمجة الكائنية المتقدمة (OOP) باستخدام C++', 4, 4),
('IT-301', 'هندسة البرمجيات', 'مبادئ تصميم وتطوير الأنظمة البرمجية الكبيرة', 3, 5),
('NET-201', 'أساسيات الشبكات', 'مقدمة في بروتوكولات الشبكات وطبقات الاتصال', 3, 4),
('IS-401', 'نظم المعلومات الإدارية', 'دور التقنية في إدارة المنظمات واتخاذ القرار', 3, 6),
('HCI-302', 'تفاعل الإنسان والحاسب', 'تصميم واجهات المستخدم وتجربة المستخدم (UX/UI)', 3, 5),
('DS-204', 'تراكيب البيانات', 'دراسة الخوارزميات وطرق تنظيم البيانات في الذاكرة', 3, 3);

-- عرض الجدول بعد الإضافة للتأكد
SELECT 
    Subject_Code AS 'رمز المادة', 
    Subject_Name AS 'اسم المادة', 
    Level AS 'المستوى', 
    Credit_Hours AS 'الساعات'
FROM Subjects 
ORDER BY Level ASC;

USE DirayaAI_DB;

-- إضافة 6 مواد جديدة إلى الصفوف الموجودة مسبقاً
INSERT INTO Subjects (Subject_Code, Subject_Name, Description, Credit_Hours, Level) VALUES 
('IT-312', 'أمن الشبكات', 'طرق حماية البيانات والاتصالات الشبكية', 3, 6),
('CS-441', 'نظم التشغيل', 'دراسة معمارية النظم وإدارة العمليات والذاكرة', 3, 5),
('IS-230', 'تحليل وتصميم النظم', 'منهجيات بناء الأنظمة وتحليل المتطلبات', 3, 4),
('IT-480', 'إدارة مشاريع التقنية', 'أساسيات إدارة مشاريع البرمجيات والجودة', 2, 7),
('CS-352', 'هندسة البيانات', 'مبادئ استخراج وتجهيز البيانات الضخمة', 3, 6),
('AI-490', 'تعلم الآلة', 'خوارزميات التنبؤ وتحليل البيانات الذكي', 3, 8);

-- عرض الجدول للتأكد من انضمام المواد الجديدة للقديمة
SELECT 
    Subject_Code AS 'رمز المادة', 
    Subject_Name AS 'اسم المادة', 
    Level AS 'المستوى', 
    Description AS 'الوصف'
FROM Subjects 
ORDER BY Level ASC;

USE DirayaAI_DB;

-- 1. أولاً: نتأكد أن مادة قواعد البيانات موجودة (إذا لم تكن موجودة سيضيفها)
INSERT IGNORE INTO Subjects (Subject_Code, Subject_Name, Description, Credit_Hours, Level) 
VALUES ('DB-303', 'نظم قواعد البيانات', 'تصميم وإدارة قواعد البيانات SQL', 3, 5);

INSERT IGNORE INTO Subjects (Subject_Code, Subject_Name, Description, Credit_Hours, Level) 
VALUES ('CS-202', 'برمجة الحاسب 1', 'البرمجة بلغة C++', 4, 3);


-- 2. حذف وإعادة إنشاء جدول الموارد لضمان النظافة
DROP TABLE IF EXISTS Academic_Resources;

CREATE TABLE Academic_Resources (
    Resource_ID INT AUTO_INCREMENT PRIMARY KEY,
    User_ID INT NOT NULL,
    Subject_ID INT NOT NULL,
    Title VARCHAR(255) NOT NULL,
    Description TEXT,
    Resource_Type ENUM('PDF', 'Video', 'Link', 'Image') DEFAULT 'PDF',
    File_URL VARCHAR(255) NOT NULL,
    Status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
    Upload_Date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_user_res FOREIGN KEY (User_ID) REFERENCES Users(User_ID) ON DELETE CASCADE,
    CONSTRAINT fk_sub_res FOREIGN KEY (Subject_ID) REFERENCES Subjects(Subject_ID) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- 3. الإدخال باستخدام استعلام يضمن عدم وجود قيم فارغة (NULL)
-- سنبحث عن الطالبة بإيميلها والمادة بكودها
INSERT INTO Academic_Resources (User_ID, Subject_ID, Title, Description, Resource_Type, File_URL, Status)
SELECT 
    (SELECT User_ID FROM Users WHERE email = 'S44202652@students.tu.edu.sa' LIMIT 1),
    (SELECT Subject_ID FROM Subjects WHERE Subject_Code = 'DB-303' LIMIT 1),
    'ملخص استعلامات SQL',
    'شرح مفصل لجمل الربط والبحث',
    'PDF',
    'files/sql_aryam.pdf',
    'Approved'
WHERE EXISTS (SELECT 1 FROM Users WHERE email = 'S44202652@students.tu.edu.sa') 
  AND EXISTS (SELECT 1 FROM Subjects WHERE Subject_Code = 'DB-303');

-- مادة أخرى لجود
INSERT INTO Academic_Resources (User_ID, Subject_ID, Title, Description, Resource_Type, File_URL, Status)
SELECT 
    (SELECT User_ID FROM Users WHERE email = 'S44206814@students.tu.edu.sa' LIMIT 1),
    (SELECT Subject_ID FROM Subjects WHERE Subject_Code = 'CS-202' LIMIT 1),
    'أساسيات البرمجة C++',
    'مذكرة شاملة للمفاهيم الأساسية',
    'PDF',
    'files/cpp_joud.pdf',
    'Approved'
WHERE EXISTS (SELECT 1 FROM Users WHERE email = 'S44206814@students.tu.edu.sa') 
  AND EXISTS (SELECT 1 FROM Subjects WHERE Subject_Code = 'CS-202');

-- 4. العرض النهائي
SELECT r.Title, u.Full_Name, s.Subject_Name 
FROM Academic_Resources r
JOIN Users u ON r.User_ID = u.User_ID
JOIN Subjects s ON r.Subject_ID = s.Subject_ID;


USE DirayaAI_DB;

-- 1. تعطيل التحقق من المفاتيح الخارجية مؤقتاً لتجنب أخطاء الحذف
SET FOREIGN_KEY_CHECKS = 0;

-- 2. حذف الجدول لإعادة بنائه بالشكل الصحيح
DROP TABLE IF EXISTS Chatbot_Logs;

-- 3. إنشاء الجدول مع FAQ_ID و Timestamp
CREATE TABLE Chatbot_Logs (
    Log_ID INT AUTO_INCREMENT PRIMARY KEY,
    User_ID INT NULL,                                 
    FAQ_ID INT NULL,                                  
    Question_Text TEXT NOT NULL,                      
    Bot_Response TEXT NOT NULL,                       
    Confidence_Score DECIMAL(5,2),                    
    Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,    -- عمود الـ Timestamp
    
    CONSTRAINT fk_user_log FOREIGN KEY (User_ID) REFERENCES Users(User_ID) ON DELETE SET NULL,
    CONSTRAINT fk_faq_log FOREIGN KEY (FAQ_ID) REFERENCES FAQ_Knowledge_Base(FAQ_ID) ON DELETE SET NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4. إعادة تفعيل التحقق من المفاتيح الخارجية
SET FOREIGN_KEY_CHECKS = 1;

USE DirayaAI_DB;

-- إدخال 4 سجلات محادثات جديدة
INSERT INTO Chatbot_Logs (User_ID, FAQ_ID, Question_Text, Bot_Response, Confidence_Score)
VALUES 
-- محادثة 1: سؤال أكاديمي (موجود في الـ FAQ)
(
    (SELECT User_ID FROM Users WHERE email = 'S44201827@students.tu.edu.sa' LIMIT 1), -- الطالبة منيرة
    2, -- فرضاً رقم الـ FAQ للسؤال عن الاعتذار
    'ما هو موعد الاعتذار عن الدراسة؟',
    'آخر موعد للاعتذار هو 15/08/1447 هـ.',
    0.98
),
-- محادثة 2: سؤال أكاديمي (موجود في الـ FAQ)
(
    (SELECT User_ID FROM Users WHERE email = 'S44205921@students.tu.edu.sa' LIMIT 1), -- الطالبة أمل
    3, -- فرضاً رقم الـ FAQ للسؤال عن يوم التأسيس
    'متى إجازة يوم التأسيس؟',
    'يوم التأسيس سيكون في يوم 05/09/1447 هـ.',
    1.00
),
-- محادثة 3: سؤال عام (غير موجود في الـ FAQ - FAQ_ID يكون NULL)
(
    (SELECT User_ID FROM Users WHERE email = 'S44106628@students.tu.edu.sa' LIMIT 1), -- الطالبة شهد
    NULL, 
    'شكراً لك يا دراية',
    'العفو! أنا هنا دائماً لمساعدتك.',
    0.90
),
-- محادثة 4: سؤال أكاديمي (موجود في الـ FAQ)
(
    (SELECT User_ID FROM Users WHERE email = 'S44200573@students.tu.edu.sa' LIMIT 1), -- الطالبة منار
    4, -- فرضاً رقم الـ FAQ للسؤال عن العودة بعد العيد
    'متى تبدأ الدراسة بعد العيد؟',
    'تستأنف الدراسة في يوم 10/10/1447 هـ.',
    0.99
);

-- عرض السجلات الجديدة مع التوقيت للتأكد
SELECT 
    l.Log_ID AS 'رقم السجل',
    u.Full_Name AS 'اسم الطالبة',
    l.Question_Text AS 'السؤال',
    l.Created_At AS 'وقت العملية (Timestamp)'
FROM Chatbot_Logs l
JOIN Users u ON l.User_ID = u.User_ID
ORDER BY l.Created_At DESC;

USE DirayaAI_DB;

-- 1. تعطيل القيود مؤقتاً لضمان عمل الكود بدون أخطاء
SET FOREIGN_KEY_CHECKS = 0;

-- 2. حذف الجدول لإعادة إنشائه من جديد
DROP TABLE IF EXISTS Admin_Actions;

-- 3. إنشاء الجدول
CREATE TABLE Admin_Actions (
    Action_ID INT AUTO_INCREMENT PRIMARY KEY,
    Admin_ID INT NOT NULL,                            
    Action_Type ENUM('Insert', 'Update', 'Delete', 'Approval', 'Login') NOT NULL, 
    Target_Table VARCHAR(50),                        
    Action_Description TEXT NOT NULL,                
    Performed_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_admin_user FOREIGN KEY (Admin_ID) REFERENCES Users(User_ID) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4. إعادة تفعيل القيود
SET FOREIGN_KEY_CHECKS = 1;

-- 5. إدخال بيانات تجريبية (تأكدي أن لديكِ مستخدمين في جدول Users برتبة مشرفة)
-- هذا الكود سيبحث عن أول مستخدم رتبته 'مشرفة' ويضيف العمليات باسمه تلقائياً
INSERT INTO Admin_Actions (Admin_ID, Action_Type, Target_Table, Action_Description)
SELECT 
    User_ID, 
    'Approval', 
    'Academic_Resources', 
    'تمت الموافقة على ملف ملخص قواعد البيانات'
FROM Users 
WHERE role = 'مشرفة' 
LIMIT 1;

-- إضافة عملية أخرى لمشرفة ثانية (إن وجدت)
INSERT INTO Admin_Actions (Admin_ID, Action_Type, Target_Table, Action_Description)
SELECT 
    User_ID, 
    'Update', 
    'FAQ_Knowledge_Base', 
    'تعديل مواعيد الإجازات الرسمية'
FROM Users 
WHERE role = 'مشرفة' 
ORDER BY User_ID DESC 
LIMIT 1;

-- 6. عرض النتائج النهائية
SELECT 
    a.Action_ID AS 'الرقم',
    u.Full_Name AS 'المشرفة',
    a.Action_Type AS 'نوع الإجراء',
    a.Action_Description AS 'التفاصيل',
    a.Performed_At AS 'الوقت'
FROM Admin_Actions a
JOIN Users u ON a.Admin_ID = u.User_ID;

USE DirayaAI_DB;

-- 1. تعطيل القيود مؤقتاً لحل مشكلة "مو راضي يشتغل"
SET FOREIGN_KEY_CHECKS = 0;

-- 2. حذف الجدول لإعادة بنائه
DROP TABLE IF EXISTS Rating_Comments;

-- 3. إنشاء جدول التقييمات والتعليقات
CREATE TABLE Rating_Comments (
    Rating_ID INT AUTO_INCREMENT PRIMARY KEY,
    User_ID INT NOT NULL,                             
    Resource_ID INT NOT NULL,                         
    Rating_Value INT CHECK (Rating_Value BETWEEN 1 AND 5), 
    Comment_Text TEXT,                                
    Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,    
    
    CONSTRAINT fk_rat_user FOREIGN KEY (User_ID) REFERENCES Users(User_ID) ON DELETE CASCADE,
    CONSTRAINT fk_rat_res FOREIGN KEY (Resource_ID) REFERENCES Academic_Resources(Resource_ID) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4. إعادة تفعيل القيود
SET FOREIGN_KEY_CHECKS = 1;

-- 5. إدخال بيانات تجريبية بطريقة ذكية (تلقائية)
-- سيبحث الكود عن أول طالبة وأول مورد أكاديمي موجودين فعلياً في قاعدة بياناتك
INSERT INTO Rating_Comments (User_ID, Resource_ID, Rating_Value, Comment_Text)
SELECT 
    (SELECT User_ID FROM Users WHERE role = 'طالبة' LIMIT 1),
    (SELECT Resource_ID FROM Academic_Resources LIMIT 1),
    5, 
    'محتوى مفيد جداً وشرح واضح، شكراً جزيلاً!'
WHERE EXISTS (SELECT 1 FROM Users WHERE role = 'طالبة') 
  AND EXISTS (SELECT 1 FROM Academic_Resources);

-- إضافة تقييم ثانٍ
INSERT INTO Rating_Comments (User_ID, Resource_ID, Rating_Value, Comment_Text)
SELECT 
    (SELECT User_ID FROM Users WHERE role = 'طالبة' ORDER BY User_ID DESC LIMIT 1),
    (SELECT Resource_ID FROM Academic_Resources LIMIT 1),
    4, 
    'الملخص ممتاز ومنظم، ساعدني في المذاكرة.'
WHERE EXISTS (SELECT 1 FROM Users WHERE role = 'طالبة') 
  AND EXISTS (SELECT 1 FROM Academic_Resources);

-- 6. عرض النتائج النهائية
SELECT 
    rc.Rating_ID AS 'رقم التقييم',
    u.Full_Name AS 'اسم الطالبة',
    r.Title AS 'اسم المورد',
    rc.Rating_Value AS 'النجوم',
    rc.Comment_Text AS 'التعليق'
FROM Rating_Comments rc
JOIN Users u ON rc.User_ID = u.User_ID
JOIN Academic_Resources r ON rc.Resource_ID = r.Resource_ID;

USE DirayaAI_DB;

-- 1. تعطيل التحقق من المفاتيح الخارجية مؤقتاً لضمان عدم توقف الكود
SET FOREIGN_KEY_CHECKS = 0;

-- 2. حذف الجدول القديم لضمان البدء من جديد
DROP TABLE IF EXISTS Notifications;

-- 3. إنشاء الجدول بالمواصفات الصحيحة
CREATE TABLE Notifications (
    Notification_ID INT AUTO_INCREMENT PRIMARY KEY,
    User_ID INT NOT NULL,                             
    Title VARCHAR(150) NOT NULL,                      
    Message TEXT NOT NULL,                            
    Is_Read BOOLEAN DEFAULT FALSE,                    
    Notification_Type ENUM('System', 'Approval', 'Academic', 'Reminder') DEFAULT 'System',
    Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,    
    
    CONSTRAINT fk_notif_user_id FOREIGN KEY (User_ID) REFERENCES Users(User_ID) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4. إعادة تفعيل القيود بعد إنشاء الجدول
SET FOREIGN_KEY_CHECKS = 1;
