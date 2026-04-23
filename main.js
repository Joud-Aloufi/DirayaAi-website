/**
 * ============================================================================
 * DIRAYAAI - MAIN JAVASCRIPT (Full & Clean Version)
 * الوظيفة: إدارة الجلسات، المصادقة، الملف الشخصي، المنصة، الرفع، والبوت.
 * ============================================================================
 */

// المستمع الرئيسي: يتم تشغيل هذه الدوال بمجرد اكتمال تحميل شجرة عناصر الـ DOM بالكامل.
document.addEventListener('DOMContentLoaded', async () => {
    initLanguageSystem();           // تهيئة نظام اللغات
    initSessionManagement();        // تهيئة إدارة جلسة المستخدم (تسجيل الخروج التلقائي)
    await checkAuthStatus();        // التحقق من حالة تسجيل الدخول والصلاحيات
    initAuthForms();                // تهيئة نماذج تسجيل الدخول وإنشاء الحساب
    initPasswordStrengthMeter();    // تهيئة عداد قوة كلمة المرور
    initPasswordToggles();          // تهيئة زر إظهار/إخفاء كلمة المرور
    initProfile();                  // تهيئة صفحة الملف الشخصي
    initUploadSystem();             // تهيئة نظام رفع المحتوى (ملفات/روابط)
    initPlatform();                 // تهيئة منصة عرض المقررات والمحتوى
    initSmoothScrollAndSpy();       // تهيئة التمرير السلس وتتبع التمرير في القوائم
});

/**
 * ==========================================
 * 1. دوال مساعدة (Helper Functions)
 * ==========================================
 */

/**
 * دالة مركزية للاتصال بالسيرفر (API) لتقليل تكرار كود fetch في كل مكان.
 * تقوم بإرسال الطلبات وتحديد نوع الرد (JSON أو نص عادي).
 * * @param {string} url - مسار ملف الـ PHP أو الـ API المراد الاتصال به.
 * @param {object} options - إعدادات الطلب (مثل نوع POST والبيانات المرسلة body).
 * @returns {Promise<any>} - البيانات المسترجعة (بصيغة JSON أو Text).
 */
async function fetchAPI(url, options = {}) {
    try {
        const res = await fetch(url, options);
        const contentType = res.headers.get("content-type");
        
        // التحقق مما إذا كان الرد القادم من السيرفر بصيغة JSON
        if (contentType && contentType.includes("application/json")) {
            return await res.json();
        }
        // إذا لم يكن JSON، يتم إرجاعه كنص عادي
        return await res.text();
    } catch (error) {
        // التقاط الأخطاء في حال فشل الاتصال بالخادم
        console.error(`خطأ في الاتصال بـ ${url}:`, error);
        return { status: 'error', message: 'فشل الاتصال بالسيرفر.' };
    }
}

/**
 * دالة لعرض رسائل النجاح أو الخطأ للمستخدم في واجهة الاستخدام، مع دعم الترجمة التلقائية.
 * * @param {HTMLElement} element - عنصر الـ HTML المخصص لعرض الرسالة.
 * @param {string} msg - نص الرسالة أو مفتاح الترجمة الخاص بها.
 * @param {boolean} isSuccess - تحديد حالة الرسالة (true للنجاح/أخضر، false للخطأ/أحمر).
 */
function showMsg(element, msg, isSuccess = false) {
    if (!element) return; // التأكد من وجود العنصر قبل التعديل عليه
    
    // سحب اللغة الحالية من التخزين المحلي، واختيار العربية كافتراضي
    const lang = localStorage.getItem('diraya_lang') || 'ar';
    const t = typeof translations !== 'undefined' ? translations[lang] : null;
    
    // محاولة ترجمة الرسالة إذا كان لها مفتاح في ملف الترجمة، وإلا تُعرض كما هي
    const finalMsg = (t && t[msg]) ? t[msg] : msg;

    element.innerHTML = finalMsg; // استخدام innerHTML لدعم أي وسوم HTML داخل الرسالة
    element.style.display = 'block'; // إظهار العنصر
    element.style.color = isSuccess ? '#5cb85c' : '#d9534f'; // تلوين الرسالة بناءً على الحالة
}

/**
 * ==========================================
 * 2. إدارة الجلسات والحماية (Session & Security)
 * ==========================================
 */

/**
 * دالة لإدارة وقت خمول المستخدم (Idle Time).
 * تقوم بتسجيل خروج المستخدم تلقائياً إذا لم يقم بأي تفاعل لمدة 15 دقيقة.
 */
function initSessionManagement() {
    let idleTime = 0;
    
    // دالة لتصفير العداد عند أي تفاعل
    const resetIdle = () => idleTime = 0;
    
    // مراقبة أحداث حركة الفأرة، لوحة المفاتيح، النقر، والتمرير لتصفير العداد
    ['mousemove', 'keypress', 'click', 'scroll'].forEach(evt => document.addEventListener(evt, resetIdle));

    // مؤقت يعمل كل دقيقة لزيادة وقت الخمول
    setInterval(() => {
        idleTime++;
        if (idleTime >= 15) { // إذا وصل الخمول إلى 15 دقيقة
            const lang = localStorage.getItem('diraya_lang') || 'ar';
            const t = typeof translations !== 'undefined' ? translations[lang] : null;
            const alertMsg = t ? t.msg_session_expired : "انتهت الجلسة بسبب عدم النشاط لفترة طويلة.";
            
            alert(alertMsg);
            // توجيه المستخدم لصفحة تسجيل الخروج لإنهاء الجلسة من طرف السيرفر
            window.location.href = 'auth_handler.php?action=logout';
        }
    }, 60000); // 60000 ملي ثانية = 1 دقيقة
}

/**
 * دالة تتحقق من حالة تسجيل دخول المستخدم وصلاحياته من السيرفر.
 * تقوم بتعديل شكل القائمة العلوية (Navbar) بناءً على حالة المستخدم وتمنع الوصول للصفحات المحمية.
 */
async function checkAuthStatus() {
    const headerBtn = document.querySelector('.header .signup-btn') || document.querySelector('.signup-btn');
    const adminNavBtn = document.getElementById('adminNavBtn');
    const currentPath = window.location.pathname;

    // جلب حالة الجلسة من السيرفر
    const data = await fetchAPI('user_api.php?action=check_session');
    
    const lang = localStorage.getItem('diraya_lang') || 'ar';
    const t = typeof translations !== 'undefined' ? translations[lang] : null;

    // --- حالة: المستخدم غير مسجل دخول أو جلسته منتهية ---
    if (!data.logged_in || data.message === 'session_expired') {
        if (headerBtn) {
            headerBtn.textContent = t ? t.nav_login : 'تسجيل الدخول';
            headerBtn.onclick = (e) => { e.preventDefault(); window.location.href = 'signup.html'; };
        }
        
        // نظام حماية الصفحات (Route Guards): طرد الزوار غير المسجلين من الصفحات المحمية
        if (currentPath.includes('upload.html')) {
            const overlay = document.getElementById('loginOverlay');
            if (overlay) overlay.classList.remove('hidden'); // إظهار شاشة طلب تسجيل الدخول فوق المحتوى
        } else if (currentPath.includes('profile.html')) {
            window.location.href = 'signup.html';
        } else if (currentPath.includes('notifications.html')) {
            window.location.href = 'index.html'; // توجيه للرئيسية
        }
    } 
    // --- حالة: المستخدم مسجل دخول بنجاح ---
    else {
        if (headerBtn) {
            const welcomePrefix = lang === 'en' ? 'Hello' : 'مرحباً';
            let displayUserName = data.user_name;
            headerBtn.textContent = `${welcomePrefix}, ${displayUserName}`; // تغيير الزر ليعرض اسم المستخدم
            headerBtn.onclick = (e) => { e.preventDefault(); window.location.href = 'profile.html'; };
        }
        
        // إظهار زر الإدارة إذا كان المستخدم يملك الصلاحيات
        if ((data.role === 'مشرف' || data.role === 'مدير نظام') && adminNavBtn) {
            adminNavBtn.style.display = 'inline-block';
        }

        // إنشاء وإضافة أيقونة جرس الإشعارات للمسجلين فقط
        const controls = document.querySelector('.header-controls');
        if(controls && !document.getElementById('noti-bell-btn')) {
            const notiBtn = document.createElement('a');
            notiBtn.href = 'notifications.html';
            notiBtn.id = 'noti-bell-btn';
            notiBtn.className = 'noti-bell-btn';
            notiBtn.innerHTML = `
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                <span class="noti-badge hidden" id="noti-badge">0</span>
            `;
            controls.appendChild(notiBtn); // إضافتها في الواجهة

            // جلب الإشعارات غير المقروءة لتحديث العداد على الجرس
            const res = await fetchAPI('user_api.php?action=get_notifications');
            if(res.status === 'success') {
                const unread = res.notifications.filter(n => n.Is_Read == 0).length;
                if(unread > 0) {
                    const badge = document.getElementById('noti-badge');
                    badge.textContent = unread;
                    badge.classList.remove('hidden'); // إظهار النقطة الحمراء
                }
            }
        }
    }
}

/**
 * ==========================================
 * 3. المصادقة والنماذج (Authentication)
 * ==========================================
 */

/**
 * تهيئة نماذج تسجيل الدخول وإنشاء الحساب.
 * تتضمن التبديل بين النماذج، والتحقق المتقدم من صحة المدخلات قبل الإرسال للسيرفر.
 */
function initAuthForms() {
    const getT = () => {
        const lang = localStorage.getItem('diraya_lang') || 'ar';
        return typeof translations !== 'undefined' ? translations[lang] : null;
    };

    //  1. التبديل بين نموذج الدخول، التسجيل، والاستعادة  
    const showLoginBtn = document.getElementById('showLoginBtn');
    const showSignupBtn = document.getElementById('showSignupBtn');
    const showForgotBtn = document.getElementById('showForgotBtn');
    const backToLoginBtn = document.getElementById('backToLoginBtn');
    
    const signupWrapper = document.getElementById('signupWrapper');
    const loginWrapper = document.getElementById('loginWrapper');
    const forgotWrapper = document.getElementById('forgotWrapper');

    const switchForm = (show, hide1, hide2) => {
        if(show) show.classList.remove('hidden');
        if(hide1) hide1.classList.add('hidden');
        if(hide2) hide2.classList.add('hidden');
    };

    if (showLoginBtn) showLoginBtn.onclick = (e) => { e.preventDefault(); switchForm(loginWrapper, signupWrapper, forgotWrapper); };
    if (showSignupBtn) showSignupBtn.onclick = (e) => { e.preventDefault(); switchForm(signupWrapper, loginWrapper, forgotWrapper); };
    if (showForgotBtn) showForgotBtn.onclick = (e) => { e.preventDefault(); switchForm(forgotWrapper, loginWrapper, signupWrapper); };
    if (backToLoginBtn) backToLoginBtn.onclick = (e) => { e.preventDefault(); switchForm(loginWrapper, forgotWrapper, signupWrapper); };

    //  2. معالجة نموذج إنشاء حساب (Signup) 
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        const pass = document.getElementById('password');
        const confirmPass = document.getElementById('confirm_pass');
        const passError = document.getElementById('pass-error');
        const emailError = document.getElementById('email-error');
        const generalError = document.getElementById('general-error');
        const responseMsg = document.getElementById('response-msg');
		
        // إزالة تنسيق الخطأ (اللون الأحمر) عند بدء الكتابة في أي حقل
        signupForm.querySelectorAll('input').forEach(input => input.addEventListener('input', () => input.classList.remove('input-error')));

        signupForm.onsubmit = async (e) => {
            e.preventDefault(); // منع إعادة تحميل الصفحة
            const t = getT();
            // إخفاء جميع رسائل الخطأ السابقة
            [passError, emailError, generalError, responseMsg].forEach(el => { if(el) el.style.display = 'none'; });
            
            let hasEmptyFields = false;
            // التحقق من الحقول الإلزامية الفارغة
            signupForm.querySelectorAll('input[required]').forEach(input => { 
                if (!input.value.trim()) { 
                    input.classList.add('input-error'); 
                    hasEmptyFields = true; 
                } 
            });

            if (hasEmptyFields) {
                showMsg(generalError, t ? t.auth_err_empty_fields : 'يرجى تعبئة جميع الحقول المطلوبة.', false);
                return; 
            }
			
             // التحقق من أن الاسم الأول والأخير يحتويان على نصوص فقط
            const fNameField = document.getElementById('f_name');
            const lNameField = document.getElementById('l_name');
            const nameRegex = /^[\u0600-\u06FFa-zA-Z\s]+$/; 

            if (fNameField && !nameRegex.test(fNameField.value.trim())) {
                fNameField.classList.add('input-error');
                showMsg(generalError, t ? t.invalid_name : 'عذراً، يجب أن يحتوي الاسم على أحرف فقط.', false);
                return;
            }
            if (lNameField && !nameRegex.test(lNameField.value.trim())) {
                lNameField.classList.add('input-error');
                showMsg(generalError, t ? t.invalid_name : 'عذراً، يجب أن يحتوي الاسم على أحرف فقط.', false);
                return;
            }
			
            // التحقق من صحة الرقم الجامعي (أرقام فقط وطول لا يقل عن 8)
            const uniIdField = document.getElementById('uni_id');
            const uniIdVal = uniIdField ? uniIdField.value.trim() : '';
            if (uniIdVal) {
                if (!/^\d+$/.test(uniIdVal)) { 
                    uniIdField.classList.add('input-error');
                    showMsg(generalError, t ? t.auth_err_id_numbers_only : 'عذراً، الرقم الجامعي يجب أن يحتوي على أرقام فقط.', false);
                    return; 
                }
                if (uniIdVal.length < 8) { 
                    uniIdField.classList.add('input-error');
                    showMsg(generalError, t ? t.auth_err_id_length : 'عذراً، الرقم الجامعي يجب أن يكون 8 أرقام على الأقل.', false);
                    return; 
                }
            }
			
             // التحقق من صحة صيغة البريد الإلكتروني
            const emailField = document.getElementById('user_email');
            const emailVal = emailField ? emailField.value.trim() : '';
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (emailField && !emailRegex.test(emailVal)) {
                emailField.classList.add('input-error');
                showMsg(generalError, t ? t.invalid_email_format : 'صيغة البريد الإلكتروني غير صحيحة.', false);
                return;
            }
			
            // التحقق من تطابق كلمتي المرور
            let hasError = false;
            if (pass.value !== confirmPass.value) { 
                pass.classList.add('input-error'); confirmPass.classList.add('input-error'); 
                if(passError) { passError.textContent = t ? t.auth_err_pass_match : "كلمات المرور غير متطابقة."; passError.style.display = 'block'; }
                hasError = true; 
            }

            let score = 0;
            if (pass.value.length >= 8) score += 25; 
            if (/[a-z]/.test(pass.value) && /[A-Z]/.test(pass.value)) score += 25; 
            if (/[0-9]/.test(pass.value)) score += 25; 
            if (/[!@#$%^&*()]/.test(pass.value)) score += 25; 
			
            // تقييم قوة كلمة المرور برمجياً
            if (score < 75) {
                pass.classList.add('input-error');
                showMsg(generalError, t ? t.auth_err_pass_weak_req : 'عذراً، يجب أن تكون كلمة المرور (قوية) أو (قوية جداً).', false);
                return; 
            }

            if (hasError) { 
                showMsg(generalError, t ? t.auth_err_inputs : "الرجاء التأكد من المدخلات.", false); 
                return; 
            }
			
            // نافذة منبثقة لتأكيد الرقم الجامعي لأنه لا يمكن تغييره لاحقاً
            const confirmMsg = t ? (t.auth_confirm_uni_id_1 + uniIdVal + t.auth_confirm_uni_id_2) : `هل أنت متأكد من الرقم الجامعي (${uniIdVal})؟\nالرجاء التأكد، لأنه لا يمكن تعديله لاحقاً.`;
            
            if (!confirm(confirmMsg)) { return; }
			
            // تغيير حالة الزر أثناء المعالجة لمنع الإرسال المزدوج
            const submitBtn = signupForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;
            submitBtn.textContent = t ? t.upload_btn_processing : 'جاري المعالجة...';
            submitBtn.disabled = true;
			
            // إرسال البيانات للسيرفر
            try {
                const result = await fetchAPI('auth_handler.php?action=signup', { method: 'POST', body: new FormData(signupForm) });
				
                // التعامل مع الردود المختلفة من السيرفر
                if (typeof result === 'string') {
                    if (result.includes("email_exists")) { 
                        document.getElementById('user_email').classList.add('input-error'); 
                        if(emailError) { emailError.textContent = t ? t.auth_err_email_exists : "البريد الإلكتروني مسجل مسبقاً."; emailError.style.display = 'block'; }
                    } else if (result.includes("id_exists")) { 
                        document.getElementById('uni_id').classList.add('input-error');
                        showMsg(generalError, t ? t.auth_err_id_exists : "الرقم الجامعي مسجل مسبقاً.", false); 
                    } else if (result.includes("invalid_id_format")) {
                        document.getElementById('uni_id').classList.add('input-error');
                        showMsg(generalError, t ? t.invalid_id_format : "صيغة الرقم الجامعي غير صحيحة.", false);
                    } else if (result.includes("invalid_name")) { 
                        document.getElementById('f_name').classList.add('input-error');
                        document.getElementById('l_name').classList.add('input-error');
                        showMsg(generalError, t ? t.invalid_name : "عذراً، يجب أن يحتوي الاسم على أحرف فقط.", false);
                    } else if (result.includes("invalid_email_format")) {
                        document.getElementById('user_email').classList.add('input-error');
                        showMsg(generalError, t ? t.invalid_email_format : "صيغة البريد الإلكتروني غير صحيحة.", false);
                    } else if (result.includes("success")) { 
                        showMsg(responseMsg, t ? t.auth_success_signup : "تم إنشاء الحساب بنجاح!", true); 
                        signupForm.reset(); 
                        document.querySelectorAll('#signupForm .password-segment').forEach(s => s.classList.remove('filled'));
                        const meterContainer = document.querySelector('#signupForm .password-meter-container');
                        if (meterContainer) { meterContainer.className = 'password-meter-container'; meterContainer.style.display = 'none'; }
                        const passText = document.getElementById('password-text');
                        if (passText) { passText.textContent = t ? t.auth_pass_meter : "قوة كلمة المرور"; passText.style.display = 'none'; }
                    } else { showMsg(generalError, result, false); }
                }
            } catch (err) {
                showMsg(generalError, t ? t.auth_err_unexpected : "حدث خطأ غير متوقع.", false);
            } finally {
                // إعادة الزر لحالته الطبيعية
                submitBtn.textContent = originalBtnText;
                submitBtn.disabled = false;
            }
        };
    }

    //  3. معالجة نموذج تسجيل الدخول (Login) 
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        const loginError = document.getElementById('login-error');
        // إزالة علامة الخطأ عند بدء الكتابة
        loginForm.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => { input.classList.remove('input-error'); if (loginError) loginError.style.display = 'none'; });
        });

        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const t = getT();
            if (loginError) loginError.style.display = 'none';
            let hasError = false;

            loginForm.querySelectorAll('input[required]').forEach(input => {
                if (!input.value.trim()) { input.classList.add('input-error'); hasError = true; }
            });

            const loginEmailInput = document.getElementById('login_email');
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!hasError && loginEmailInput && !emailRegex.test(loginEmailInput.value.trim())) {
                loginEmailInput.classList.add('input-error'); hasError = true;
                showMsg(loginError, t ? t.auth_err_email_format : "الرجاء إدخال بريد إلكتروني بصيغة صحيحة.", false);
            }

            if (hasError) return;

            const submitBtn = loginForm.querySelector('.submit-btn');
            submitBtn.textContent = t ? t.auth_btn_logging_in : 'جاري الدخول...';
            submitBtn.disabled = true;

            const result = await fetchAPI('auth_handler.php?action=login', { method: 'POST', body: new FormData(loginForm) });

            if (result === 'success_admin') { window.location.href = 'admin_dashboard.html'; 
            } else if (result === 'success_student') { window.location.href = 'index.html'; 
            } else if (result === 'invalid_credentials') {
                showMsg(loginError, t ? t.auth_err_invalid_creds : "البريد الإلكتروني أو كلمة المرور غير صحيحة.", false);
                document.getElementById('login_email').classList.add('input-error'); document.getElementById('login_pass').classList.add('input-error');
            } else if (result === 'account_disabled') { showMsg(loginError, t ? t.auth_err_disabled : "هذا الحساب معطل، يرجى التواصل مع الإدارة.", false);
            } else { showMsg(loginError, t ? t.auth_err_unexpected : "حدث خطأ غير متوقع.", false); }

            submitBtn.textContent = t ? t.auth_login_btn : 'تسجيل الدخول'; 
            submitBtn.disabled = false;
        };
    }

    //  4. معالجة نموذج استعادة كلمة المرور  
    const forgotForm = document.getElementById('forgotForm');
    if (forgotForm) {
        forgotForm.onsubmit = async (e) => {
            e.preventDefault();
            const t = getT();
            const msg = document.getElementById('forgot-msg');
            const btn = forgotForm.querySelector('button');

            btn.disabled = true;
            btn.textContent = (t && t.upload_btn_processing) ? t.upload_btn_processing : 'جاري التحقق...';

            try {
                const res = await fetchAPI('auth_handler.php?action=forgot_password', { method: 'POST', body: new FormData(forgotForm) });

                if (res === 'success_email_sent') {
                    showMsg(msg, "تم إرسال الرابط لإيميلك بنجاح!", true);
                } else if (typeof res === 'string' && res.startsWith("success_link")) {
                    const link = res.split('|')[1];
                    // 🌟 رسالة ذكية توضح للجنة إن النظام شغال بس الاستضافة مقيدة 🌟
                    showMsg(msg, "تم التحقق! (لأغراض العرض: <a href='"+link+"' style='color:blue; text-decoration:underline;'>اضغطي هنا لإعادة التعيين</a>)", true);
                } else if (res === 'email_not_found') {
                    showMsg(msg, 'عذراً، هذا البريد غير مسجل لدينا.', false);
                } else {
                    showMsg(msg, "حدث خطأ غير متوقع.", false);
                }
            } catch (err) {
                showMsg(msg, "حدث خطأ في الاتصال بالخادم.", false);
            } finally {
                btn.disabled = false;
                btn.textContent = (t && t.auth_forgot_btn) ? t.auth_forgot_btn : 'تحقق من الحساب';
            }
        };
    }
}
/**
 * دالة لتشغيل وتحديث العداد المرئي الذي يقيس قوة كلمة المرور المدخلة.
 * يتفاعل مع المستخدم أثناء الكتابة (Real-time).
 */
function initPasswordStrengthMeter() {
    const passwordInput = document.getElementById('password') || document.getElementById('new-pass-input');
    const meterContainer = document.querySelector('.password-meter-container');
    const segments = document.querySelectorAll('.password-segment');
    const passText = document.getElementById('password-text') || document.getElementById('profile-password-text');

    const getT = () => {
        const lang = localStorage.getItem('diraya_lang') || 'ar';
        return typeof translations !== 'undefined' ? translations[lang] : null;
    };

    // 1. إخفاء العداد والنص مبدئياً عند تحميل الصفحة 
    if (meterContainer) meterContainer.style.display = 'none';
    if (passText) passText.style.display = 'none';

    if (passwordInput && meterContainer) {
        passwordInput.addEventListener('input', () => {
            const val = passwordInput.value; 
            const t = getT();
            
            // 2. إذا مسح المستخدم الباسورد وصار الحقل فارغاً، نخفي العداد 
            if (val.length === 0) {
                meterContainer.style.display = 'none';
                if (passText) passText.style.display = 'none';
                segments.forEach(s => s.classList.remove('filled'));
                meterContainer.className = 'password-meter-container';
                return; // إيقاف التنفيذ
            }

            // 3. إذا بدأ بالكتابة، نظهر العداد 
            meterContainer.style.display = 'flex';
            if (passText) passText.style.display = 'block';

            // حساب النقاط بناءً على معايير التعقيد
            let score = 0;
            if (val.length >= 8) score += 25; 
            if (/[a-z]/.test(val) && /[A-Z]/.test(val)) score += 25; 
            if (/[0-9]/.test(val)) score += 25; 
            if (/[!@#$%^&*()]/.test(val)) score += 25; 
            
            // إعادة ضبط الشرائح
            segments.forEach(s => s.classList.remove('filled'));
            meterContainer.className = 'password-meter-container'; 
            
            let count = 0;
            // تحديد حالة القوة وتلوين الشرائح وتحديث النص
            if (score <= 25) {
                count = 1; meterContainer.classList.add('strength-weak'); if (passText) passText.textContent = t ? t.auth_pass_weak : "ضعيفة جداً";
            } else if (score === 50) {
                count = 2; meterContainer.classList.add('strength-medium'); if (passText) passText.textContent = t ? t.auth_pass_medium : "متوسطة";
            } else if (score === 75) {
                count = 3; meterContainer.classList.add('strength-strong'); if (passText) passText.textContent = t ? t.auth_pass_strong : "قوية";
            } else {
                count = 5; meterContainer.classList.add('strength-very-strong'); if (passText) passText.textContent = t ? t.auth_pass_very_strong : "قوية جداً";
            }
            
            // تعبئة الشرائح حسب القوة
            for (let i = 0; i < count; i++) {
                if (segments[i]) segments[i].classList.add('filled');
            }
        });
    }
}

/**
 * دالة لتشغيل أيقونة "العين" التي تبدل إظهار وإخفاء كلمة المرور المدخلة في الحقول.
 */
function initPasswordToggles() {
    // تعريف أيقونات الـ SVG
    const iconEye = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    const iconEyeOff = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

    document.querySelectorAll('.toggle-pass-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault(); 
            const input = this.parentElement.querySelector('input'); // استهداف حقل الإدخال المجاور للأيقونة
            if (input) {
                // التبديل بين نوع الإدخال (نص مرئي أو باسورد مخفي) وتغيير الأيقونة
                if (input.type === 'password') {
                    input.type = 'text'; 
                    this.innerHTML = iconEyeOff; 
                    this.querySelector('svg').style.stroke = '#b39972'; // تغيير اللون لتوضيح التفعيل
                } else {
                    input.type = 'password'; 
                    this.innerHTML = iconEye; 
                    this.querySelector('svg').style.stroke = '#888'; 
                }
            }
        });
    });
}

/**
 * ==========================================
 * 4. إدارة الملف الشخصي (Profile)
 * ==========================================
 */

/**
 * دالة مسؤولة عن جلب بيانات الملف الشخصي للمستخدم من السيرفر وعرضها في الحقول المناسبة،
 * بالإضافة إلى معالجة طلب تحديث البيانات وتغيير كلمة المرور.
 */
async function initProfile() {
    if(!document.getElementById('profile-avatar')) return; // التأكد أننا في صفحة الملف الشخصي

    // جلب البيانات الحالية للمستخدم
    const data = await fetchAPI('user_api.php?action=get_profile');
    if (data.status === 'success') {
        const lang = localStorage.getItem('diraya_lang') || 'ar';
        const t = typeof translations !== 'undefined' ? translations[lang] : null;

        // وضع أول حرف من الاسم في الصورة الرمزية
        document.getElementById('profile-avatar').textContent = data.first_name.charAt(0);
        
        // رسالة الترحيب
        const welcomePrefix = lang === 'en' ? 'Welcome, ' : 'مرحباً بك، ';
        document.getElementById('welcome-name').textContent = welcomePrefix + data.first_name + ' ' + data.last_name;
        
        // تعبئة الحقول بالبيانات المجلوبة
        ['first-name', 'last-name', 'email', 'phone'].forEach(f => { 
            if(document.getElementById(`${f}-input`)) document.getElementById(`${f}-input`).value = data[f.replace('-','_')] || ''; 
        });
        document.getElementById('uni-id-input').value = data.id_number; 
        
        const userRole = data.role;
        document.getElementById('role-input').value = (t && t[userRole]) ? t[userRole] : userRole;
    }

    // معالجة حفظ التعديلات
    const saveBtn = document.getElementById('save-profile-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const lang = localStorage.getItem('diraya_lang') || 'ar';
            const t = typeof translations !== 'undefined' ? translations[lang] : null;
            const msg = document.getElementById('update-msg');
            
            // جلب كلمات المرور للتحقق في حال أراد المستخدم التغيير
            const currentPass = document.getElementById('current-pass-input') ? document.getElementById('current-pass-input').value : '';
            const newPass = document.getElementById('new-pass-input') ? document.getElementById('new-pass-input').value : '';
            const confirmPass = document.getElementById('confirm-pass-input') ? document.getElementById('confirm-pass-input').value : '';
            
            //  التحقق من صحة وقوة كلمة المرور الجديدة 
            if (newPass) {
                if (newPass !== confirmPass) {
                    const errMatch = t ? t.auth_err_pass_match : 'كلمات المرور الجديدة غير متطابقة.';
                    showMsg(msg, errMatch, false);
                    return; // إيقاف الحفظ
                }

                // حساب قوة كلمة المرور الجديدة
                let score = 0;
                if (newPass.length >= 8) score += 25; 
                if (/[a-z]/.test(newPass) && /[A-Z]/.test(newPass)) score += 25; 
                if (/[0-9]/.test(newPass)) score += 25; 
                if (/[!@#$%^&*()]/.test(newPass)) score += 25; 

                if (score < 75) {
                    const errWeak = t ? t.auth_err_pass_weak_req : 'عذراً، يجب أن تكون كلمة المرور الجديدة (قوية) أو (قوية جداً).';
                    showMsg(msg, errWeak, false);
                    return; // إيقاف الحفظ
                }
            }

            // بدء عملية الإرسال وتغيير حالة الزر
            saveBtn.disabled = true;
            saveBtn.textContent = t ? t.upload_btn_processing : 'جاري الحفظ...';

            // تجميع البيانات لإرسالها
            const fd = new FormData(); 
            ['first-name', 'last-name', 'email', 'phone'].forEach(f => fd.append(f.replace('-','_'), document.getElementById(`${f}-input`).value));
            
            fd.append('current_pass', currentPass);
            fd.append('new_pass', newPass);
            fd.append('confirm_pass', confirmPass);

            // إرسال طلب التحديث
            const res = await fetchAPI('user_api.php?action=update_profile', { method: 'POST', body: fd });
            
            showMsg(msg, res.status === 'success' ? 'تم الحفظ بنجاح!' : res.message, res.status === 'success');
            
            // 🌟 تصفير العداد وتفريغ حقول كلمات المرور وإخفائها بعد الحفظ بنجاح 🌟
            if (res.status === 'success' && newPass) {
                document.getElementById('current-pass-input').value = '';
                document.getElementById('new-pass-input').value = '';
                document.getElementById('confirm-pass-input').value = '';

                document.querySelectorAll('.password-segment').forEach(s => s.classList.remove('filled'));
                const meterContainer = document.querySelector('.password-meter-container');
                if (meterContainer) {
                    meterContainer.className = 'password-meter-container';
                    meterContainer.style.display = 'none'; // إخفاء العداد
                }
                const passText = document.getElementById('profile-password-text');
                if (passText) {
                    passText.textContent = t ? t.auth_pass_meter : "قوة كلمة المرور";
                    passText.style.display = 'none'; // إخفاء النص
                }
            }
            
            // إعادة الزر لحالته الأصلية
            saveBtn.disabled = false;
            saveBtn.textContent = t ? t.profile_btn_save : 'حفظ التعديلات';
        });
    }
}

/**
 * ==========================================
 * 5. نظام رفع المحتوى (Upload Content)
 * ==========================================
 */

/**
 * دالة لتهيئة صفحة رفع المحتوى للمشرفين والطلاب.
 * تدير التبويبات (ملف أو رابط)، جلب المقررات، وعرض الطلبات السابقة للمستخدم.
 */
function initUploadSystem() {
    const uploadForm = document.getElementById('uploadContentForm');
    if (!uploadForm) return; // التأكد أننا في صفحة الرفع

    // دالة مساعدة لجلب قاموس الترجمة
    const getT = () => {
        const lang = localStorage.getItem('diraya_lang') || 'ar';
        return typeof translations !== 'undefined' ? translations[lang] : null;
    };

    // إدارة التبويبات للتبديل بين رفع "ملف" أو إضافة "رابط"
    const tabFile = document.getElementById('tab-file'), tabUrl = document.getElementById('tab-url');
    tabFile.addEventListener('click', () => { 
        tabFile.classList.add('active'); tabUrl.classList.remove('active'); 
        document.getElementById('file-input-group').classList.remove('hidden'); 
        document.getElementById('url-input-group').classList.add('hidden'); 
        document.getElementById('upload_type').value = 'file'; 
    });
    tabUrl.addEventListener('click', () => { 
        tabUrl.classList.add('active'); tabFile.classList.remove('active'); 
        document.getElementById('url-input-group').classList.remove('hidden'); 
        document.getElementById('file-input-group').classList.add('hidden'); 
        document.getElementById('upload_type').value = 'url'; 
    });

    // تحديث اسم الملف المعروض عند اختياره من الجهاز
    const fileInput = document.getElementById('upload_file');
    if(fileInput) {
        fileInput.addEventListener('change', function() { 
            const t = getT();
            const noFileTxt = t ? t.upload_no_file : 'لم يتم اختيار ملف';
            document.getElementById('file-name-display').textContent = this.files.length > 0 ? this.files[0].name : noFileTxt; 
        });
    }

    // دالة داخلية لجلب المقررات وقائمة طلبات الرفع الخاصة بالمستخدم
    async function loadUploadData() {
        const t = getT();
        
        // جلب المقررات لتعبئة القائمة المنسدلة (Dropdown)
        const subRes = await fetchAPI('upload_api.php?action=get_subjects');
        if (subRes.status === 'success') {
            const defaultOptTxt = t ? t.upload_course_opt : 'يرجى اختيار المقرر...';
            document.getElementById('course_title').innerHTML = `<option value="" disabled selected>${defaultOptTxt}</option>` + 
            subRes.subjects.map(s => {
                // ترجمة اسم المقرر إذا توفر
                const sName = (t && t[s.Subject_Name]) ? t[s.Subject_Name] : s.Subject_Name;
                return `<option value="${s.Subject_ID}">${s.Subject_Code} - ${sName}</option>`;
            }).join('');
        }
        
        // جلب الطلبات السابقة للمستخدم لعرضها في القائمة
        const listRes = await fetchAPI('upload_api.php?action=get_submissions');
        const list = document.getElementById('submissions-list');
        
        if (listRes.status === 'success') {
            if (listRes.submissions.length > 0) {
                // إنشاء كروت (Cards) للطلبات السابقة
                list.innerHTML = listRes.submissions.map(s => {
                    let badgeClass = '', displayStatus = '';
                    
                    // تحديد لون حالة الطلب
                    if (s.Status === 'Pending') { badgeClass = 'badge-pending'; displayStatus = t ? t.upload_status_pending : 'قيد المراجعة'; } 
                    else if (s.Status === 'Approved') { badgeClass = 'badge-accepted'; displayStatus = t ? t.upload_status_approved : 'مقبول'; } 
                    else { badgeClass = 'badge-rejected'; displayStatus = t ? t.upload_status_rejected : 'مرفوض'; }

                    const isLink = s.Resource_Type === 'Link' || s.Resource_Type === 'url';
                    const openLinkTxt = t ? t.upload_link_open : 'فتح الرابط';
                    const viewFileTxt = t ? t.upload_file_view : 'عرض ملف الـ ';
                    
                    // إعداد زر العرض بناءً على نوع المحتوى (ملف أو رابط)
                    const linkOrFile = isLink 
                        ? `<a href="${s.File_URL}" target="_blank" class="detail-link file-link">${openLinkTxt} <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; margin-left: 4px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg></a>` 
                        : `<a href="${s.File_URL}" target="_blank" class="detail-link file-link">${viewFileTxt} ${s.Resource_Type || 'مرفق'} <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; margin-left: 4px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg></a>`;

                    // تنسيق التاريخ بناءً على اللغة
                    const lang = localStorage.getItem('diraya_lang') || 'ar';
                    const dateObj = s.Upload_Date ? new Date(s.Upload_Date) : null;
                    const uploadDate = dateObj ? (lang === 'en' ? dateObj.toLocaleDateString('en-US') : dateObj.toLocaleDateString('ar-SA')) : 'غير محدد';
                    
                    const upDateTxt = t ? t.upload_date_prefix : 'تاريخ الرفع: ';
                    const delReqTxt = t ? t.upload_delete_req : 'حذف الطلب';
                    
                    // زر الحذف: يظهر فقط إذا كان الطلب قيد المراجعة
                    const deleteBtn = s.Status === 'Pending' 
                        ? `<button class="action-btn btn-reject" style="margin-right: auto; margin-left: 0;" onclick="deleteStudentSubmission(${s.Resource_ID})">${delReqTxt}</button>` 
                        : '';

                    const noDescTxt = t ? t.view_no_desc : 'لا يوجد وصف';
                    const sName = (t && t[s.Subject_Name]) ? t[s.Subject_Name] : s.Subject_Name;

                    // إرجاع كود الـ HTML الخاص بالكارت
                    return `
                    <div class="submission-item">
                        <div class="submission-header">
                            <h3>${sName}</h3>
                            <span class="badge ${badgeClass}">${displayStatus}</span>
                        </div>
                        <p class="submission-desc">${s.Description || noDescTxt}</p>
                        <div class="submission-footer">
                            <span class="upload-date">${upDateTxt}${uploadDate}</span>
                            ${linkOrFile}
                            ${deleteBtn} 
                        </div>
                    </div>`;
                }).join('');
            } else {
                // رسالة في حال عدم وجود طلبات
                const noReqsTxt = t ? t.upload_no_reqs : 'لا توجد طلبات مرفوعة حالياً.';
                list.innerHTML = `<p class="empty-submissions">${noReqsTxt}</p>`;
            }
        }
    }
    
    // تشغيل جلب البيانات عند بدء الصفحة
    loadUploadData();

    // دالة متاحة عالمياً (Global) لحذف طلب الطالب
    // جعلناها بـ window لكي تتمكن أزرار الـ HTML من الوصول إليها
    window.deleteStudentSubmission = async function(resourceId) {
        const t = getT();
        const confirmMsg = t ? t.upload_confirm_delete : 'هل أنت متأكد من إلغاء هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.';
        if (!confirm(confirmMsg)) return; // نافذة تأكيد الإلغاء
        
        const fd = new FormData(); fd.append('resource_id', resourceId);
        const res = await fetchAPI('upload_api.php?action=delete_submission', { method: 'POST', body: fd });
        
        if (res.status === 'success') { loadUploadData(); } // إعادة تحميل القائمة لتحديث الواجهة
        else { alert(res.message || 'حدث خطأ أثناء إلغاء الطلب.'); }
    };
        
    // معالجة إرسال طلب الرفع الجديد
    uploadForm.addEventListener('submit', async e => {
        e.preventDefault(); 
        const t = getT();
        const btn = document.getElementById('submit-upload-btn'), msg = document.getElementById('upload-msg');
        
        // تعطيل الزر مؤقتاً أثناء المعالجة
        btn.textContent = t ? t.upload_btn_processing : 'جاري المعالجة...'; 
        btn.disabled = true;
        
        // إرسال البيانات (الملف أو الرابط) للسيرفر
        const res = await fetchAPI('upload_api.php?action=upload_resource', { method: 'POST', body: new FormData(uploadForm) });
        const finalMsg = (t && t[res.message]) ? t[res.message] : res.message;
        showMsg(msg, finalMsg, res.status === 'success');
        
        if (res.status === 'success') { 
            // تفريغ النموذج وإعادة تعيين الحقول بعد الرفع بنجاح
            uploadForm.reset(); 
            document.getElementById('file-name-display').textContent = t ? t.upload_no_file : 'لم يتم اختيار ملف'; 
            loadUploadData(); // تحديث قائمة الطلبات السابقة
        }
        
        // إعادة الزر لحالته
        btn.textContent = t ? t.upload_submit_btn : 'إرسال للمراجعة'; 
        btn.disabled = false; 
    });
}

/**
 * ==========================================
 * 7. المنصة والمقررات (Platform & Materials)
 * ==========================================
 */

/**
 * دالة مسؤولة عن جلب وعرض المحتوى الأكاديمي (المنصة).
 * تدير عملية البحث، والفلترة (حسب المادة وحسب النوع)، وعرض كروت المواد.
 */
function initPlatform() {
    const materialsGrid = document.getElementById('materials-grid');
    if (!materialsGrid) return; // التأكد أننا في صفحة المنصة

    let allMaterials = []; // مصفوفة لتخزين جميع المواد لتسهيل عملية البحث محلياً

    // دالة داخلية لعرض المواد في الواجهة
    function renderMaterials(materials) {
        // تحديث عداد النتائج فقط دون التأثير على نص الترجمة المجاور له
        const countSpan = document.getElementById('results-count-num');
        if(countSpan) countSpan.textContent = materials.length;

        const lang = localStorage.getItem('diraya_lang') || 'ar';
        const t = typeof translations !== 'undefined' ? translations[lang] : null;

        if (materials.length > 0) {
            // توليد كروت الـ HTML لكل مادة
            materialsGrid.innerHTML = materials.map(mat => {
                let typeClass = 'blue', iconSvg = '';
                let resType = (mat.Resource_Type || '').toUpperCase();
                let displayType = resType;

                // تحديد الأيقونة واللون بناءً على نوع الملف
                if (resType === 'PDF') {
                    typeClass = 'red';
                    iconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#cc0000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
                } else if (resType === 'VIDEO') {
                    typeClass = 'green';
                    iconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#009900" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>`;
                } else if (resType === 'LINK' || resType === 'URL') {
                    displayType = 'URL'; typeClass = 'blue';
                    iconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0066cc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
                } else { // نوع ملف افتراضي
                    displayType = 'FILE';
                    iconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;
                }

                // تنسيق التاريخ
                const dateObj = new Date(mat.Upload_Date);
                const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const viewBtnText = t ? t.plat_view_btn : '← عرض المحتوى';

                const subjectName = (t && t[mat.Subject_Name]) ? t[mat.Subject_Name] : mat.Subject_Name;

                // ---  نظام تقييم النجمة الواحدة  ---
                const avgRating = mat.Average_Rating ? parseFloat(mat.Average_Rating).toFixed(1) : "0.0";
                const totalRatings = mat.Total_Ratings ? mat.Total_Ratings : 0;
                
                // كود أيقونة النجمة ✨
                const singleStarHtml = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;

                return `
                <div class="material-card">
                    <div class="card-top">
                        <div class="icon-box ${typeClass}-bg">${iconSvg}</div>
                        <span class="type-badge ${typeClass}-badge">${displayType}</span>
                    </div>
                    
                    <h3 class="material-title" style="margin-bottom: 10px;">${subjectName}</h3>
                    
                    <p class="material-desc">
                        <strong class="material-file-name">${mat.Title}</strong><br>
                        ${mat.Description || ''} 
                    </p>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        
                        <div class="material-date" style="margin-bottom: 0;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            ${formattedDate}
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 4px; direction: ltr;">
                            <span style="font-size: 11px; color: #888;">(${totalRatings})</span>
                            <span style="font-size: 13px; color: #888; font-weight: bold;">${avgRating}</span>
                            ${singleStarHtml}
                        </div>
                        
                    </div>
                    
                    <a href="view_material.html?id=${mat.Resource_ID}" class="view-material-btn" data-i18n="plat_view_btn">${viewBtnText}</a>
                </div>`;
            }).join('');
        } else {
            // رسالة عدم توفر نتائج
            const noResText = t ? t.plat_no_results : 'لا توجد نتائج مطابقة لبحثك.';
            materialsGrid.innerHTML = `<p class="grid-system-msg msg-neutral" data-i18n="plat_no_results">${noResText}</p>`;
        }
    }

    // دالة جلب البيانات الأساسية من السيرفر
    async function loadData() {
        const lang = localStorage.getItem('diraya_lang') || 'ar';
        const t = typeof translations !== 'undefined' ? translations[lang] : null;

        // 1. جلب المقررات لتعبئة فلتر التصفية (Dropdown)
        const courseData = await fetchAPI('platform_api.php?action=get_courses');
        if (courseData.status === 'success') {
            const courseFilter = document.getElementById('filter-course');
            if(courseFilter) {
                courseData.courses.forEach(course => {
                    // استخدام الترجمة إذا توفرت لاسم المقرر
                    const cName = (t && t[course.Subject_Name]) ? t[course.Subject_Name] : course.Subject_Name;
                    courseFilter.innerHTML += `<option value="${course.Subject_Name}">${course.Subject_Code} - ${cName}</option>`;
                });
            }
        }
        
        // عرض رسالة "جاري التحميل" مؤقتاً
        const loadingText = t ? t.plat_loading : 'جاري تحميل المحتوى الأكاديمي...';
        materialsGrid.innerHTML = `<p class="grid-system-msg msg-neutral" data-i18n="plat_loading">${loadingText}</p>`;
        
        // 2. جلب محتويات المنصة (المواد العلمية)
        const matData = await fetchAPI('platform_api.php?action=get_materials');
        if (matData.status === 'success') {
            allMaterials = matData.materials; // حفظها محلياً للبحث والفلترة بدون الحاجة لإعادة طلبها من السيرفر
            renderMaterials(allMaterials);
        } else {
            // معالجة خطأ السيرفر
            const errText = t ? t.plat_error_db : 'فشل الاتصال بقاعدة البيانات.';
            materialsGrid.innerHTML = `<p class="grid-system-msg msg-error" data-i18n="plat_error_db">${errText}</p>`;
        }
    }

    // تجهيز مستمعات الأحداث لعملية البحث والفلترة
    const searchInput = document.getElementById('search-input');
    const courseFilter = document.getElementById('filter-course');
    const typeFilter = document.getElementById('filter-type');

    // دالة الفلترة الديناميكية (Dynamic Filtering)
    function applyFilters() {
        const searchText = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const selectedCourse = courseFilter ? courseFilter.value : 'all';
        const selectedType = typeFilter ? typeFilter.value.toUpperCase() : 'ALL';

        const lang = localStorage.getItem('diraya_lang') || 'ar';
        const t = typeof translations !== 'undefined' ? translations[lang] : null;

        const filteredMaterials = allMaterials.filter(mat => {
            // جلب اسم المادة المترجم لدعم البحث باللغتين
            const translatedSubjectName = (t && t[mat.Subject_Name]) ? t[mat.Subject_Name].toLowerCase() : mat.Subject_Name.toLowerCase();

            // 1. فلترة البحث النصي: يشمل العنوان، الوصف، كود المقرر، واسم المقرر بلغتين
            const matchesSearch = mat.Title.toLowerCase().includes(searchText) || 
                                  (mat.Description && mat.Description.toLowerCase().includes(searchText)) ||
                                  mat.Subject_Code.toLowerCase().includes(searchText) ||
                                  mat.Subject_Name.toLowerCase().includes(searchText) || 
                                  translatedSubjectName.includes(searchText);

            // 2. فلترة حسب اسم المادة (Dropdown)
            const matchesCourse = (selectedCourse === 'all') || (mat.Subject_Name === selectedCourse);

            // 3. فلترة حسب نوع المحتوى (PDF, Video, Link)
            let matchesType = true;
            if (selectedType !== 'ALL') {
                const resType = (mat.Resource_Type || '').toUpperCase();
                if (selectedType === 'VIDEO') matchesType = ['MP4', 'VIDEO', 'MOV'].includes(resType);
                else if (selectedType === 'LINK') matchesType = ['LINK', 'URL'].includes(resType);
                else matchesType = (resType === selectedType);
            }

            // إرجاع العنصر فقط إذا تطابقت فيه كل الشروط الثلاثة
            return matchesSearch && matchesCourse && matchesType;
        });

        // إعادة رسم الكروت بناءً على النتائج المفلترة
        renderMaterials(filteredMaterials);
    }

    // ربط الحقول بدالة الفلترة للتحديث الفوري (Real-time Filtering)
    if(searchInput) searchInput.addEventListener('input', applyFilters);
    if(courseFilter) courseFilter.addEventListener('change', applyFilters);
    if(typeFilter) typeFilter.addEventListener('change', applyFilters);

    loadData(); // بدء التنفيذ
}

/**
 * ==========================================
 * 9. التمرير السلس وتتبع التمرير (Scroll Spy)
 * ==========================================
 */

/**
 * دالة لتسهيل التنقل داخل الصفحة (التمرير السلس للروابط الداخلية)
 * ومراقبة مكان تمرير الشاشة (Scroll Spy) لتظليل الرابط النشط في القائمة العلوية.
 */
function initSmoothScrollAndSpy() {
    // إعداد التمرير السلس لأي رابط يبدأ بـ #
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === "#") return; 
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                e.preventDefault(); 
                // التنقل بانسيابية للعنصر المطلوب
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // مراقب التمرير (Scroll Spy) للصفحة الرئيسية لتمييز الروابط (Home / About)
    const aboutSection = document.getElementById('about');
    const homeLink = document.querySelector('.nav a[href="index.html"]');
    const aboutLink = document.querySelector('.nav a[href="index.html#about"]');

    if (aboutSection && homeLink && aboutLink) {
        window.addEventListener('scroll', () => {
            const aboutTop = aboutSection.offsetTop - 150; // هامش 150 بكسل قبل الوصول للقسم الفعلي
            if (window.scrollY >= aboutTop) {
                // إذا نزلنا لقسم "من نحن"
                homeLink.classList.remove('active'); aboutLink.classList.add('active');
            } else {
                // إذا كنا في الأعلى (الرئيسية)
                aboutLink.classList.remove('active'); homeLink.classList.add('active');
            }
        });
    }
}

/**
 * ==========================================
 * نظام تعدد اللغات (Multi-language System)
 * ==========================================
 */

/**
 * دالة تهيئة نظام اللغات (العربية / الإنجليزية).
 * تقوم بقراءة ملف الترجمة، وتغيير اتجاه الصفحة (RTL / LTR)، وتحديث النصوص.
 */
function initLanguageSystem() {
    // التحقق من وجود المتغير العالمي للترجمات (عادة يأتي من ملف translations.js)
    if (typeof translations === 'undefined') {
        console.warn("ملف translations.js غير موجود.");
        return;
    }

    // 1. قراءة اللغة الحالية من الذاكرة المحلية (تخزين المتصفح)
    let currentLang = localStorage.getItem('diraya_lang') || 'ar';

    // 2. دالة داخلية لترجمة الصفحة (تُنفذ مرة واحدة عند التحميل)
    function applyTranslations(lang) {
        // تغيير إعدادات الـ HTML الأساسية للاتجاه (RTL للعربية، LTR للإنجليزية)
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        
        // تعديل اتجاه القوائم العلوية
        document.querySelectorAll('.nav').forEach(nav => {
            nav.dir = lang === 'ar' ? 'rtl' : 'ltr';
        });

        // المرور على كل العناصر التي تمتلك الخاصية [data-i18n] وتغيير نصها
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n'); // سحب مفتاح الترجمة
            if (translations[lang] && translations[lang][key]) {
                // إذا كان العنصر عبارة عن حقل إدخال، نقوم بتغيير النص الإرشادي (Placeholder)
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    element.placeholder = translations[lang][key];
                } else {
                    // لباقي العناصر، نقوم بتغيير المحتوى الداخلي
                    element.innerHTML = translations[lang][key];
                }
            }
        });

        // تغيير نص زر التبديل نفسه ليعرض اللغة الأخرى المتاحة
        const toggleBtn = document.getElementById('langToggleBtn');
        if (toggleBtn) {
            toggleBtn.textContent = lang === 'ar' ? 'English' : 'العربية';
        }
    }

    // 3. تطبيق الترجمة فوراً عند فتح الموقع حسب اللغة المخزنة
    applyTranslations(currentLang);

    // 4. إعداد مستمع الحدث لزر تغيير اللغة
    const toggleBtn = document.getElementById('langToggleBtn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // عكس اللغة (إذا كانت عربي تصبح إنجليزي والعكس)
            const newLang = currentLang === 'ar' ? 'en' : 'ar';
            // حفظها في المتصفح لتظل ثابتة حتى بعد إغلاقه
            localStorage.setItem('diraya_lang', newLang);
            // إعادة تحميل الصفحة لتطبيق التغييرات الجديدة كلياً
            window.location.reload();
        });
    }
}

/**
 * ============================================================================
 * التهيئة العامة للصفحات (Global Initialization)
 * ============================================================================
 */
document.addEventListener('DOMContentLoaded', () => {
    // تشغيل عداد قوة كلمة المرور تلقائياً في أي صفحة تحتوي على حقل كلمة مرور
    if (typeof initPasswordStrengthMeter === 'function') {
        initPasswordStrengthMeter();
    }
});
