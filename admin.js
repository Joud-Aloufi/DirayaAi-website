/**
 * ============================================================================
 * DIRAYAAI - ADMIN JAVASCRIPT
 * Description: Handles admin panel functionalities (User management, Content review, Subjects, FAQ).
 * ============================================================================
 */

// متغير عام (Global Variable) لتخزين صلاحية المستخدم الحالي (مشرف أو مدير نظام)
let currentUserRole = ''; 

// المستمع الرئيسي: يتم تشغيل الدوال الأساسية للوحة التحكم بمجرد تحميل شجرة الـ DOM بالكامل.
document.addEventListener('DOMContentLoaded', async () => {
    await verifyAdminAccess(); // أولاً: التحقق من الصلاحيات قبل أي شيء
    initAddUser();             // تهيئة نظام إضافة المستخدمين (للمدراء فقط)
    initReviewSystem();        // تهيئة نظام مراجعة طلبات الرفع (المحتوى)
    initSubjectsSystem();      // تهيئة نظام إدارة المقررات والمواد الدراسية
    initAdminFAQ();            // تهيئة نظام إدارة أسئلة وأجوبة البوت (FAQ)
});

/**
 * ==========================================
 * 1. ADMIN ACCESS VERIFICATION
 * ==========================================
 */

/**
 * دالة للتحقق من صلاحيات وصول المستخدم للوحة التحكم.
 * تضمن أن الأدوار المصرح لها فقط ('مشرف', 'مدير نظام') يمكنها البقاء في الصفحة.
 * يتم طرد أي مستخدم آخر وتوجيهه للصفحة الرئيسية.
 */
async function verifyAdminAccess() {
    try {
        // الاتصال بالخادم للتحقق من الجلسة الحالية
        const response = await fetch('user_api.php?action=check_session');
        const data = await response.json();
        
        // التحقق مما إذا كان المستخدم غير مسجل دخول، أو أن دوره لا يخول له الدخول
        if (!data.logged_in || (data.role !== 'مشرف' && data.role !== 'مدير نظام')) {
            window.location.href = 'index.html'; // طرد المستخدم للرئيسية
            return;
        }
        // حفظ دور المستخدم في المتغير العام لاستخدامه في باقي الدوال (مثل إخفاء نماذج معينة)
        currentUserRole = data.role; 
    } catch (error) { 
        // في حال فشل الاتصال بالسيرفر، يتم توجيه المستخدم للرئيسية كإجراء أمني
        window.location.href = 'index.html'; 
    }
}

/**
 * ==========================================
 * 2. USER MANAGEMENT (System Admin Only)
 * ==========================================
 */

/**
 * دالة تهيئة نموذج إضافة مستخدم جديد.
 * هذه الميزة مخصصة حصرياً لـ 'مدير نظام'. إذا كان المستخدم 'مشرف'، يتم إخفاء النموذج.
 */
function initAddUser() {
    const adminForm = document.getElementById('adminAddUserForm');
    const addUserCard = document.getElementById('addUserCard');
    
    // إخفاء كارت ونموذج إضافة المستخدم إذا لم يكن الشخص "مدير نظام"
    if (currentUserRole !== 'مدير نظام') {
        if (adminForm) adminForm.style.display = 'none'; 
        if (addUserCard) addUserCard.style.display = 'none';
        return; // إيقاف التنفيذ
    }

    if (!adminForm) return;

    const msgDiv = document.getElementById('admin-msg');
    const btn = document.getElementById('btn-add-user');

    // إزالة التنسيق الأحمر (الخطأ) بمجرد بدء الكتابة في الحقول
    adminForm.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('input', () => input.classList.remove('input-error'));
    });

    // معالجة إرسال نموذج إضافة المستخدم
    adminForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // منع إعادة تحميل الصفحة
        msgDiv.style.display = 'none'; // إخفاء أي رسائل سابقة
        let hasError = false;

        // التحقق من الحقول الإلزامية الفارغة وتحديدها باللون الأحمر
        adminForm.querySelectorAll('input[required], select[required]').forEach(input => {
            if (!input.value.trim()) { 
                input.classList.add('input-error'); 
                hasError = true; 
            }
        });

        if (hasError) { 
            showMsg(msgDiv, "يرجى تعبئة الحقول المطلوبة", false); 
            return; // إيقاف العملية إذا كان هناك حقول فارغة
        }

        // تغيير حالة الزر أثناء المعالجة لمنع الإرسال المزدوج
        btn.textContent = 'جاري الإنشاء...'; 
        btn.disabled = true;

        try {
            // إرسال البيانات للسيرفر عبر FormData
            const response = await fetch('admin_api.php?action=add_user', { 
                method: 'POST', 
                body: new FormData(adminForm) 
            });
            const result = (await response.text()).trim();

            if (result === 'success') { 
                showMsg(msgDiv, 'تم إنشاء الحساب بنجاح!', true); 
                adminForm.reset(); // تفريغ النموذج بعد النجاح
            } else { 
                showMsg(msgDiv, 'حدث خطأ: ' + result, false);
            }
        } catch (err) { 
            showMsg(msgDiv, 'حدث خطأ في الاتصال.', false);
        } finally { 
            // إعادة الزر لحالته الطبيعية
            btn.textContent = 'إنشاء حساب';
            btn.disabled = false; 
        }
    });
}

/**
 * ==========================================
 * 3. SUBMISSIONS REVIEW SYSTEM
 * ==========================================
 */

/**
 * دالة تهيئة نظام مراجعة المحتوى المرفوع من قبل الطلاب.
 * تقوم بجلب الطلبات وعرضها، وتوفر إمكانيات الموافقة، الرفض، أو الحذف.
 */
function initReviewSystem() {
    const listContainer = document.getElementById('admin-submissions-list');
    if (!listContainer) return;

    fetchSubmissions(); // جلب الطلبات عند تحميل الصفحة

    // دالة مساعدة داخلية لجلب قاموس الترجمة
    const getT = () => {
        const lang = localStorage.getItem('diraya_lang') || 'ar';
        return typeof translations !== 'undefined' ? translations[lang] : null;
    };

    /**
     * دالة لتحديث حالة الطلب (مقبول / مرفوض).
     * تم إرفاقها بـ window لتكون عامة (Global) بحيث يمكن استدعاؤها من أزرار الـ HTML مباشرة عبر onclick.
     * @param {number} resourceId - رقم المعرف الخاص بالطلب.
     * @param {string} newStatus - الحالة الجديدة (Approved / Rejected).
     */
    window.updateStatus = async (resourceId, newStatus) => {
        const t = getT();
        // تحديد رسالة التأكيد بناءً على الحالة المختارة مع دعم الترجمة
        const confirmMsg = newStatus === 'Approved'
            ? ((t && t.admin_rev_confirm_approve) ? t.admin_rev_confirm_approve : 'هل أنت متأكد من الموافقة؟')
            : ((t && t.admin_rev_confirm_reject) ? t.admin_rev_confirm_reject : 'هل أنت متأكد من الرفض؟');

        if (!confirm(confirmMsg)) return; // التوقف إذا ضغط "إلغاء"
        
        const formData = new FormData(); 
        formData.append('resource_id', resourceId); 
        formData.append('new_status', newStatus);
        
        try {
            const res = await fetch('admin_api.php?action=update_status', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.status === 'success') fetchSubmissions(); // تحديث القائمة بعد النجاح
        } catch (err) { 
            const errMsg = (t && t.admin_rev_alert_error) ? t.admin_rev_alert_error : "خطأ في الاتصال.";
            alert(errMsg); 
        }
    };

    /**
     * دالة لحذف الطلب المرفوع نهائياً من قاعدة البيانات.
     * متاحة عامة ليتم استدعاؤها من كروت الطلبات.
     * @param {number} resourceId - المعرف الخاص بالطلب المراد حذفه.
     */
    window.deleteSubmission = async (resourceId) => {
        const t = getT();
        const confirmMsg = (t && t.admin_rev_confirm_delete) ? t.admin_rev_confirm_delete : 'هل أنت متأكد من حذف هذا المحتوى نهائياً؟';
        if (!confirm(confirmMsg)) return;
        
        const formData = new FormData();
        formData.append('resource_id', resourceId);

        try {
            const res = await fetch('admin_api.php?action=delete_submission', { method: 'POST', body: formData });
            const result = await res.json();
            if (result.status === 'success') {
                const successMsg = (t && t.admin_rev_alert_deleted) ? t.admin_rev_alert_deleted : "تم الحذف.";
                alert(successMsg);
                // تحديث القائمة ديناميكياً إذا كنا في نفس الصفحة، وإلا إعادة تحميلها
                if(document.getElementById('admin-submissions-list')) {
                    fetchSubmissions();
                } else {
                    location.reload(); 
                }
            } else {
                const errPrefix = (t && t.admin_rev_alert_error_prefix) ? t.admin_rev_alert_error_prefix : "خطأ: ";
                alert(errPrefix + result.message);
            }
        } catch (err) { 
            const errMsg = (t && t.admin_rev_alert_error) ? t.admin_rev_alert_error : "خطأ في الاتصال.";
            alert(errMsg); 
        }
    };

    /**
     * دالة داخلية لجلب جميع الطلبات من قاعدة البيانات وعرضها وتحديث الإحصائيات في الصفحة.
     */
    async function fetchSubmissions() {
        try {
            const res = await fetch('admin_api.php?action=get_all_submissions');
            const data = await res.json();
            
            if (data.status === 'success') {
                updateReviewStats(data.stats, data.submissions.length); // تحديث عدادات الأرقام بالأعلى

                if (data.submissions.length === 0) { 
                    listContainer.innerHTML = '<p class="empty-submissions">لا توجد طلبات مرفوعة حالياً.</p>'; 
                    return; 
                }

                // بناء واجهة الكروت للطلبات المجلوبة
                listContainer.innerHTML = data.submissions.map(sub => createSubmissionHTML(sub)).join('');
            }
        } catch (err) { 
            listContainer.innerHTML = '<p class="error-submissions">حدث خطأ في عرض البيانات.</p>'; 
        }
    }
}

/**
 * ==========================================
 * 4. SUBJECTS MANAGEMENT
 * ==========================================
 */

/**
 * دالة تهيئة نظام إدارة المواد الدراسية (المقررات).
 * مسؤولة عن إضافة مواد جديدة، تعديل بيانات المواد الحالية، فلترتها، وحذفها.
 */
function initSubjectsSystem() {
    const subjectForm = document.getElementById('adminAddSubjectForm');
    const subjectsListContainer = document.getElementById('admin-subjects-list');
    if (!subjectForm || !subjectsListContainer) return;

    const getT = () => {
        const lang = localStorage.getItem('diraya_lang') || 'ar';
        return typeof translations !== 'undefined' ? translations[lang] : null;
    };

    const searchInput = document.getElementById('search_subject');
    const deptFilter = document.getElementById('filter_department');
    const levelFilter = document.getElementById('filter_level');
    const collegeSelect = document.getElementById('college-select');
    const departmentSelect = document.getElementById('department-select');
    
    let allSubjectsData = []; // مصفوفة لتخزين بيانات المواد واستخدامها في الفلترة المحلية

    // كائن (Object) يحتوي على بيانات الكليات والأقسام التابعة لها ديناميكياً
    const departmentsData = {
        "كلية الحاسبات": ["تقنية المعلومات", "علوم الحاسب", "هندسة الحاسب", "الكل"],
        "كلية العلوم": ["قسم الرياضيات", "قسم الفيزياء", "قسم الأحياء", "قسم الكيمياء","الكل"],
        "متطلب جامعة عام": ["عام"]
    };

    // مستمع حدث لتغيير قائمة "القسم" ديناميكياً بناءً على "الكلية" المختارة
    if (collegeSelect && departmentSelect) {
        collegeSelect.addEventListener('change', function() {
            const t = getT();
            const selectedCollege = this.value;
            const defTxt = t ? t.admin_sub_dep_select : 'اختر القسم...';
            // تفريغ الأقسام السابقة ووضع الخيار الافتراضي
            departmentSelect.innerHTML = `<option value="" disabled selected>${defTxt}</option>`;
            
            // تعبئة الأقسام الجديدة حسب الكلية
            if (departmentsData[selectedCollege]) {
                departmentSelect.disabled = false;
                departmentsData[selectedCollege].forEach(dept => {
                    const optText = (t && t[dept]) ? t[dept] : dept;
                    const option = document.createElement('option');
                    option.value = dept; option.textContent = optText;
                    departmentSelect.appendChild(option);
                });
            } else {
                departmentSelect.disabled = true; // تعطيلها إذا لم يتم اختيار كلية صحيحة
            }
        });
    }

    // معالجة إرسال نموذج حفظ أو تعديل المادة
    subjectForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const t = getT();
        const msgDiv = document.getElementById('subject-msg');
        const btn = subjectForm.querySelector('.submit-approval-btn');
        
        msgDiv.style.display = 'none';
        btn.textContent = t ? t.admin_sub_btn_processing : 'جاري المعالجة...';
        btn.disabled = true;

        if (departmentSelect) departmentSelect.disabled = false; // تفعيل القائمة لإرسال قيمتها
        
        const formData = new FormData(subjectForm);

        try {
            const res = await fetch('admin_api.php?action=add_subject', { method: 'POST', body: formData });
            const result = await res.json();
            
            if (result.status === 'success') {
                const successTxt = t && t.admin_sub_msg_success ? t.admin_sub_msg_success : 'تم حفظ بيانات المادة بنجاح!';
                msgDiv.innerHTML = `<div style="color: #155724; background-color: #d4edda; padding: 12px; border-radius: 8px; text-align: center; border: 1px solid #c3e6cb; margin-bottom: 15px; font-weight: bold;">${successTxt}</div>`;
                msgDiv.style.display = 'block';

                subjectForm.reset(); // تفريغ النموذج
                if(departmentSelect) departmentSelect.disabled = true; 
                
                // إزالة حقل المعرف المخفي (ID) بعد الانتهاء من التعديل ليعود النموذج لوضع الإضافة
                const hiddenIdField = document.getElementById('edit_subject_id');
                if (hiddenIdField) hiddenIdField.remove(); 
                
                btn.textContent = t ? t.admin_sub_btn_add : 'إضافة المادة للنظام';
                
                fetchAdminSubjects(); // تحديث القائمة بالأسفل
            } else {
                // عرض رسالة الخطأ من السيرفر
                msgDiv.innerHTML = `<div style="color: #721c24; background-color: #f8d7da; padding: 12px; border-radius: 8px; text-align: center; border: 1px solid #f5c6cb; margin-bottom: 15px; font-weight: bold;">${result.message}</div>`;
                msgDiv.style.display = 'block';
            }
        } catch (err) {
            const errMsg = t ? t.admin_sub_alert_err : 'حدث خطأ في الاتصال بالسيرفر.';
            msgDiv.innerHTML = `<div style="color: #721c24; background-color: #f8d7da; padding: 12px; border-radius: 8px; text-align: center; border: 1px solid #f5c6cb; margin-bottom: 15px; font-weight: bold;">${errMsg}</div>`;
            msgDiv.style.display = 'block';
        } finally {
            btn.disabled = false;
            // التأكد من استعادة نص الزر الصحيح إذا لم نكن في وضع التعديل
            if(!document.getElementById('edit_subject_id')) {
                btn.textContent = (getT() && getT().admin_sub_btn_add) ? getT().admin_sub_btn_add : 'إضافة المادة للنظام';
            }
        }
    });

    /**
     * دالة داخلية لفلترة المقررات المعروضة حسب نص البحث، القسم، أو المستوى.
     */
    const filterSubjects = () => {
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const selectedDept = deptFilter ? deptFilter.value : 'all';
        const selectedLevel = levelFilter ? levelFilter.value : 'all';

        const filteredList = allSubjectsData.filter(sub => {
            const matchSearch = sub.Subject_Name.toLowerCase().includes(searchTerm) || sub.Subject_Code.toLowerCase().includes(searchTerm);
            const matchDept = selectedDept === 'all' || sub.Department === selectedDept;
            const matchLevel = selectedLevel === 'all' || sub.Level.toString() === selectedLevel;
            return matchSearch && matchDept && matchLevel;
        });
        renderSubjects(filteredList, subjectsListContainer); // إعادة رسم القائمة
    };

    // ربط الحقول بدالة الفلترة لتعمل بشكل فوري (Real-time)
    if (searchInput) searchInput.addEventListener('input', filterSubjects);
    if (deptFilter) deptFilter.addEventListener('change', filterSubjects);
    if (levelFilter) levelFilter.addEventListener('change', filterSubjects);

    /**
     * جلب جميع المواد من السيرفر.
     * وضعنا باراميتر وقت (t=getTime) لمنع المتصفح من تخزين النتيجة كاش (Cache bypassing).
     */
    async function fetchAdminSubjects() {
        try {
            const res = await fetch(`admin_api.php?action=get_all_subjects&t=${new Date().getTime()}`);
            const data = await res.json();
            if (data.status === 'success') {
                allSubjectsData = data.subjects; 
                populateDepartmentFilter(allSubjectsData, deptFilter); // تعبئة فلتر الأقسام
                renderSubjects(allSubjectsData, subjectsListContainer); // عرض المواد
            }
        } catch (err) {
            const t = getT();
            const errMsg = t ? t.admin_sub_alert_err : 'فشل في تحميل قائمة المواد.';
            subjectsListContainer.innerHTML = `<p class="error-submissions">${errMsg}</p>`;
        }
    }

    /**
     * دالة عامة لتبديل إظهار أزرار التحكم المخفية الخاصة بتعديل وحذف المادة في الواجهة.
     * @param {HTMLElement} btn - الزر الذي تم النقر عليه.
     */
    window.toggleControlButtons = (btn) => {
        const t = getT();
        const controls = btn.nextElementSibling; // استهداف الحاوية المخفية للأزرار
        
        const msgDiv = document.getElementById('subject-msg');
        if(msgDiv) msgDiv.style.display = 'none';

        if (controls.style.display === "none") {
            // إظهار أزرار (تعديل / حذف) وتغيير شكل الزر الرئيسي لـ (إلغاء)
            controls.style.display = "flex";
            controls.style.gap = "10px";
            btn.textContent = t ? t.admin_sub_btn_cancel : "إلغاء";
            btn.classList.add('cancel-btn'); 
            btn.style.background = ""; 
        } else {
            // إخفاء الأزرار وإعادة الزر لشكله الطبيعي
            controls.style.display = "none";
            btn.textContent = t ? t.admin_sub_btn_edit : "تعديل المادة";
            btn.classList.remove('cancel-btn');
            btn.style.background = "#b39972"; 

            // تصفير النموذج ليلغي وضع التعديل (Edit Mode)
            if (subjectForm) {
                subjectForm.reset();
                if (departmentSelect) departmentSelect.disabled = true;
                const hiddenIdField = document.getElementById('edit_subject_id');
                if (hiddenIdField) hiddenIdField.remove(); 
                const submitBtn = subjectForm.querySelector('.submit-approval-btn');
                if (submitBtn) submitBtn.textContent = t ? t.admin_sub_btn_add : 'إضافة المادة للنظام'; 
            }
        }
    };

    /**
     * دالة عامة لحذف مادة دراسية.
     * @param {number} subjectId - معرف المادة المراد حذفها.
     */
    window.deleteSubject = async (subjectId) => {
        const t = getT();
        const confirmMsg = t ? t.admin_sub_confirm_del : 'هل أنت متأكد من حذف هذه المادة نهائياً؟';
        if (!confirm(confirmMsg)) return;
        try {
            const res = await fetch(`admin_api.php?action=delete_subject&id=${subjectId}`, { method: 'POST' });
            const result = await res.json();
            if (result.status === 'success') {
                fetchAdminSubjects(); // تحديث القائمة
            } else {
                alert('Error: ' + result.message);
            }
        } catch (err) { 
            const errMsg = t ? t.admin_sub_alert_err : 'حدث خطأ في الاتصال بالسيرفر.';
            alert(errMsg); 
        }
    };

    /**
     * دالة لفتح نموذج إضافة المادة ولكن بوضعية التعديل وتعبئة الحقول ببيانات المادة المختارة.
     * @param {Object} sub - كائن يحتوي على بيانات المادة (كود، اسم، ساعات، قسم ...).
     */
    window.openEditModal = (sub) => {
        const msgDiv = document.getElementById('subject-msg');
        if(msgDiv) msgDiv.style.display = 'none';

        // تعبئة حقول النموذج الأساسية
        document.getElementById('subject_code_input').value = sub.Subject_Code;
        document.getElementById('subject_name_input').value = sub.Subject_Name;
        document.getElementById('credit_hours_input').value = sub.Credit_Hours;
        document.getElementById('level_input').value = sub.Level;
        document.getElementById('description_input').value = sub.Description;
        
        // معالجة ذكية لاختيار الكلية والقسم المناسب في القوائم المنسدلة
        if (sub.Department) {
            let col = "", dep = "";
            // استخراج الكلية والقسم من النص المخزن بالسيرفر
            if (sub.Department === "متطلب جامعة عام") {
                col = "متطلب جامعة عام"; dep = "عام";
            } else if (sub.Department.includes(" - ")) {
                const parts = sub.Department.split(" - ");
                col = parts[0].trim(); dep = parts[1].trim();
            }

            // تفعيل التحديد في الـ Select
            if (col && collegeSelect.querySelector(`option[value="${col}"]`)) {
                collegeSelect.value = col;
                collegeSelect.dispatchEvent(new Event('change')); // إجبار الحدث على العمل لتحديث قائمة الأقسام
                if (dep && departmentSelect.querySelector(`option[value="${dep}"]`)) {
                    departmentSelect.value = dep;
                }
            }
        }
        
        // تعديل نص الزر ليناسب وضع التعديل
        const submitBtn = subjectForm.querySelector('.submit-approval-btn');
        const t = getT();
        submitBtn.textContent = t ? t.admin_sub_btn_update : 'تحديث بيانات المادة';
        
        // إنشاء حقل مخفي (Hidden Input) يحمل رقم الـ ID للمادة ليتم تحديثها بدل إنشاء واحدة جديدة
        let idInput = document.getElementById('edit_subject_id');
        if (!idInput) {
            idInput = document.createElement('input');
            idInput.type = 'hidden';
            idInput.id = 'edit_subject_id';
            idInput.name = 'subject_id';
            subjectForm.appendChild(idInput);
        }
        idInput.value = sub.Subject_ID || sub.id;
        
        // التمرير التلقائي للأعلى للوصول للنموذج
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    fetchAdminSubjects(); // بدء جلب المواد
}

/**
 * ==========================================
 * 5. ADMIN FAQ MANAGEMENT
 * ==========================================
 */

/**
 * دالة لتهيئة نظام إدارة الأسئلة الشائعة وتدريب البوت (FAQ).
 * تسمح بإضافة سؤال وجواب جديد لقاعدة المعرفة، أو حذف أسئلة حالية.
 */
function initAdminFAQ() {
    const faqForm = document.getElementById('addFaqForm');
    if (!faqForm) return;

    const faqList = document.getElementById('faq-list');

    const getT = () => {
        const lang = localStorage.getItem('diraya_lang') || 'ar';
        return typeof translations !== 'undefined' ? translations[lang] : null;
    };

    // جلب قائمة الأسئلة الموجودة حالياً من قاعدة بيانات البوت
    async function loadFAQs() {
        const t = getT();
        const loadingTxt = t ? t.admin_faq_loading : 'جاري تحميل أسئلة البوت...';
        faqList.innerHTML = `<p style="text-align:center; color:#666;">${loadingTxt}</p>`;
        
        // يفترض وجود دالة fetchAPI عامة تم تعريفها في ملف main.js
        const data = await fetchAPI('faq_api.php?action=get_faqs');

        if (data.status === 'success') {
            if (data.faqs.length > 0) {
                const catPrefix = t ? t.admin_faq_cat_prefix : 'التصنيف: ';
                const catDefault = t ? t.admin_faq_cat_default : 'عام';
                const datePrefix = t ? t.admin_faq_date_prefix : ' | آخر تحديث: ';
                const delBtnTxt = t ? t.admin_faq_btn_del : 'حذف';
                
                const currentLang = localStorage.getItem('diraya_lang') || 'ar';

                // رسم الكروت لأسئلة البوت
                faqList.innerHTML = data.faqs.map(faq => {
                    const dateObj = new Date(faq.Last_Updated);
                    const formattedDate = currentLang === 'en' ? dateObj.toLocaleDateString('en-US') : dateObj.toLocaleDateString('ar-SA');
                    
                    return `
                    <div class="faq-item">
                        <div class="faq-content">
                            <h3 class="faq-q">س: ${faq.Question_Text}</h3>
                            <p class="faq-a">ج: ${faq.Answer_Text}</p>
                            <small style="color:#999; font-size:11px;">
                                ${catPrefix}${faq.Category || catDefault}${datePrefix}${formattedDate}
                            </small>
                        </div>
                        <div class="faq-actions">
                            <button class="faq-delete-btn" data-id="${faq.FAQ_ID}">${delBtnTxt}</button>
                        </div>
                    </div>`;
                }).join('');
            } else {
                const noDataTxt = t ? t.admin_faq_no_data : 'لا توجد أسئلة حالياً. أضف سؤالك الأول للبوت!';
                faqList.innerHTML = `<p style="text-align:center; color:#666;">${noDataTxt}</p>`;
            }
        } else {
            faqList.innerHTML = `<p style="text-align:center; color:#d9534f;">${data.message || 'حدث خطأ في الاتصال.'}</p>`;
        }
    }

    loadFAQs();

    // معالجة إرسال سؤال جديد للبوت
    faqForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const t = getT();
        const submitBtn = faqForm.querySelector('button[type="submit"]');
        
        submitBtn.textContent = t ? t.admin_faq_saving : 'جاري الحفظ...'; 
        submitBtn.disabled = true;

        const data = await fetchAPI('faq_api.php?action=add_faq', { method: 'POST', body: new FormData(faqForm) });

        if (data.status === 'success') {
            // استدعاء رسالة النجاح من القاموس بناءً على اللغة الحالية
            const successMsg = t && t.admin_faq_add_success ? t.admin_faq_add_success : 'تمت إضافة السؤال إلى قاعدة البيانات بنجاح!';
            alert(successMsg);
        
            faqForm.reset(); 
            loadFAQs(); 
        } else {
            alert('خطأ: ' + data.message);
        }
        submitBtn.textContent = t ? t.admin_faq_btn_save : 'حفظ في قاعدة البيانات'; 
        submitBtn.disabled = false;
    });

    // استخدام تفويض الأحداث (Event Delegation) للاستماع لأزرار الحذف الديناميكية
    faqList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('faq-delete-btn')) {
            const t = getT();
            const confirmMsg = t ? t.admin_faq_confirm_del : 'هل أنت متأكد من حذف هذا السؤال نهائياً من قاعدة بيانات البوت؟';
            
            const faqId = e.target.getAttribute('data-id'); // جلب الـ ID من الزر
            if (confirm(confirmMsg)) {
                const originalText = e.target.textContent;
                e.target.textContent = t ? t.admin_faq_deleting : 'جاري...'; 
                e.target.disabled = true;

                const fd = new FormData(); fd.append('faq_id', faqId);
                const data = await fetchAPI('faq_api.php?action=delete_faq', { method: 'POST', body: fd });

                if (data.status === 'success') { loadFAQs(); } 
                else { alert('خطأ: ' + data.message); e.target.textContent = originalText; e.target.disabled = false; }
            }
        }
    });
}

/**
 * ==========================================
 * 6. UI HELPERS
 * ==========================================
 */

/**
 * تحديث الأرقام والإحصائيات الخاصة بطلبات المراجعة أعلى الصفحة.
 * @param {Object} stats - كائن يحتوي على الأرقام (Pending, Approved, Rejected).
 * @param {number} total - إجمالي عدد الطلبات.
 */
function updateReviewStats(stats, total) {
    if(document.getElementById('count-pending')) document.getElementById('count-pending').textContent = stats.Pending || 0;
    if(document.getElementById('count-approved')) document.getElementById('count-approved').textContent = stats.Approved || 0;
    if(document.getElementById('count-rejected')) document.getElementById('count-rejected').textContent = stats.Rejected || 0;
    
    const lang = localStorage.getItem('diraya_lang') || 'ar';
    const t = typeof translations !== 'undefined' ? translations[lang] : null;
    const totalTxt = t ? t.admin_rev_total_suffix : ' إجمالي الطلبات';
    
    if(document.getElementById('total-submissions-text')) {
        document.getElementById('total-submissions-text').textContent = `${total}${totalTxt}`;
    }
}

/**
 * دالة لتوليد كود الـ HTML الخاص بكل كارت في قائمة طلبات المراجعة.
 * @param {Object} sub - بيانات الطلب الواحد.
 * @returns {string} كود HTML للكارت.
 */
function createSubmissionHTML(sub) {
    const lang = localStorage.getItem('diraya_lang') || 'ar';
    const t = typeof translations !== 'undefined' ? translations[lang] : null;

    let badgeHtml = '', actionButtonsHtml = '';
    
    // نصوص الحالات مترجمة
    const pendingTxt = t ? t.admin_rev_stat_pending : 'قيد المراجعة';
    const approvedTxt = t ? t.admin_rev_stat_approved : 'مقبولة';
    const rejectedTxt = t ? t.admin_rev_stat_rejected : 'مرفوضة';
    
    // أزرار التحكم مترجمة
    const btnApproveTxt = t ? t.admin_rev_btn_approve : 'قبول';
    const btnRejectTxt = t ? t.admin_rev_btn_reject : 'رفض';
    const btnDeleteTxt = t ? t.admin_rev_btn_delete : 'حذف الطلب';

    // تحديد شكل الوسام (Badge) وأزرار الإجراءات حسب حالة الطلب
    if (sub.Status === 'Pending') {
        badgeHtml = `<span class="badge badge-pending">${pendingTxt}</span>`;
        actionButtonsHtml = `<div class="review-actions"><button class="action-btn btn-approve" onclick="updateStatus(${sub.Resource_ID}, 'Approved')">${btnApproveTxt}</button><button class="action-btn btn-reject" onclick="updateStatus(${sub.Resource_ID}, 'Rejected')">${btnRejectTxt}</button></div>`;
    } else if (sub.Status === 'Approved') { 
        badgeHtml = `<span class="badge badge-accepted">${approvedTxt}</span>`; 
        actionButtonsHtml = `<div class="review-actions"><button class="action-btn btn-reject" onclick="deleteSubmission(${sub.Resource_ID})">${btnDeleteTxt}</button></div>`;
    } else { 
        badgeHtml = `<span class="badge badge-rejected">${rejectedTxt}</span>`; 
        // لا يوجد أزرار للطلبات المرفوضة
    }

    const openLinkTxt = t ? t.admin_rev_link_open : 'فتح الرابط';
    const viewFileTxt = t ? t.admin_rev_file_view : 'عرض ملف الـ ';

    // تمييز الروابط عن الملفات بأيقونة ونص مختلف
    const linkOrFile = sub.Resource_Type === 'Link' || sub.Resource_Type === 'url' 
    ? `<a href="${sub.File_URL}" target="_blank" class="detail-link file-link">${openLinkTxt} <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; margin-left: 4px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg></a>` 
    : `<a href="${sub.File_URL}" target="_blank" class="detail-link file-link">${viewFileTxt} ${sub.Resource_Type} <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; margin-left: 4px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg></a>`;
    
    const dateTxt = t ? t.admin_rev_date : 'تاريخ الرفع: ';
    const byTxt = t ? t.admin_rev_by : ' | بواسطة: ';
    
    // تنسيق التاريخ ليتوافق مع لغة واجهة المستخدم
    const dateObj = new Date(sub.Upload_Date);
    const formattedDate = lang === 'en' ? dateObj.toLocaleDateString('en-US') : dateObj.toLocaleDateString('en-GB');

    const sName = (t && t[sub.Subject_Name]) ? t[sub.Subject_Name] : sub.Subject_Name;
    const noDescTxt = t ? t.view_no_desc : 'لا يوجد وصف متاح';

    return `
    <div class="review-item">
        <div class="submission-header"><h3>${sName}</h3>${badgeHtml}</div>
        <p class="submission-desc">${sub.Description || noDescTxt}</p>
        <div class="submission-details-row">
            <span class="upload-date">${dateTxt}${formattedDate}</span>
            <span class="upload-date">${byTxt}${sub.email}</span>
            ${linkOrFile}
            ${actionButtonsHtml}
        </div>
    </div>`;
}

/**
 * دالة لتعبئة قائمة الفلترة بالأقسام الموجودة في المواد المعروضة (بدون تكرار).
 * @param {Array} data - مصفوفة المواد.
 * @param {HTMLElement} deptFilter - القائمة المنسدلة للفلترة.
 */
function populateDepartmentFilter(data, deptFilter) {
    if (!deptFilter) return;
    const lang = localStorage.getItem('diraya_lang') || 'ar';
    const t = typeof translations !== 'undefined' ? translations[lang] : null;

    // استخراج الأقسام بدون تكرار باستخدام Set
    const uniqueDepts = [...new Set(data.map(sub => sub.Department).filter(d => d))];
    const allDeptsTxt = t ? t.admin_sub_fdep_opt : 'جميع الأقسام';
    deptFilter.innerHTML = `<option value="all">${allDeptsTxt}</option>`;
    
    uniqueDepts.forEach(dept => {
        let optText = dept;
        // التعامل مع صيغة القسم المركبة (الكلية - القسم) للترجمة
        if (dept.includes(' - ')) {
            let parts = dept.split(' - ');
            let c = (t && t[parts[0]]) ? t[parts[0]] : parts[0];
            let d = (t && t[parts[1]]) ? t[parts[1]] : parts[1];
            optText = `${c} - ${d}`;
        } else {
            optText = (t && t[dept]) ? t[dept] : dept;
        }
        const opt = document.createElement('option');
        opt.value = dept; opt.textContent = optText;
        deptFilter.appendChild(opt);
    });
}

/**
 * دالة لرسم كروت عرض المواد الدراسية في صفحة الإدارة.
 * @param {Array} subjectsToRender - مصفوفة المواد المراد عرضها.
 * @param {HTMLElement} container - العنصر الذي سيتم وضع الكروت بداخله.
 */
function renderSubjects(subjectsToRender, container) {
    const lang = localStorage.getItem('diraya_lang') || 'ar';
    const t = typeof translations !== 'undefined' ? translations[lang] : null;

    // التحقق من عدم وجود مواد
    if (subjectsToRender.length === 0) {
        const emptyTxt = t ? t.admin_sub_empty : 'لا توجد مواد مضافة حالياً.';
        container.innerHTML = `<p class="empty-submissions">${emptyTxt}</p>`;
        return;
    }

    const lvlPrefix = t ? t.admin_sub_level_prefix : 'مستوى ';
    const noLvlTxt = t ? t.admin_sub_no_level : 'غير محدد';
    const noDescTxt = t ? t.admin_sub_no_desc : 'لا يوجد وصف متاح';
    const deptPrefix = t ? t.admin_sub_dept_prefix : 'القسم: ';
    const hoursPrefix = t ? t.admin_sub_hours_prefix : 'الساعات: ';
    const btnEditTxt = t ? t.admin_sub_btn_edit : 'تعديل المادة';
    const btnUpdateTxt = t ? t.admin_sub_btn_update : 'تعديل البيانات';
    const btnDelTxt = t ? t.admin_sub_btn_del_perm : 'حذف نهائي';

    container.innerHTML = subjectsToRender.map(sub => {
        let levelText = sub.Level ? `${lvlPrefix}${sub.Level}` : noLvlTxt;
        // تلوين وسام المستوى حسب الرقم
        let levelClass = sub.Level ? (sub.Level > 10 ? 'badge-level-10' : `badge-level-${sub.Level}`) : 'badge-level-0';
        let descText = sub.Description ? sub.Description : `<span style="color:#aaa; font-style:italic;">${noDescTxt}</span>`;
        let hoursText = sub.Credit_Hours ? sub.Credit_Hours : '-';
        
        let rawDept = sub.Department ? sub.Department : 'غير محدد';
        let deptText = '';
        if (rawDept.includes(' - ')) {
            let parts = rawDept.split(' - ');
            let c = (t && t[parts[0]]) ? t[parts[0]] : parts[0];
            let d = (t && t[parts[1]]) ? t[parts[1]] : parts[1];
            deptText = `${c} - ${d}`;
        } else {
            deptText = (t && t[rawDept]) ? t[rawDept] : rawDept;
        }

        const sName = (t && t[sub.Subject_Name]) ? t[sub.Subject_Name] : sub.Subject_Name;

        return `
        <div class="review-item" style="text-align: start;">
            <div class="submission-header" style="width: 100%;">
                <h3 style="text-align: start;">${sub.Subject_Code} - ${sName}</h3>
                <span class="badge ${levelClass}">${levelText}</span>
            </div>
            
            <p class="submission-desc" style="text-align: start;" dir="auto">${descText}</p>
            
            <div class="submission-meta" style="display: block; width: 100%; text-align: start; margin-bottom: 15px;">
                <div class="dept-text" style="display: block; white-space: normal !important; word-break: break-word; line-height: 1.5; margin-bottom: 8px;">${deptPrefix}${deptText}</div>
                <div class="hours-text" style="display: block;">${hoursPrefix}${hoursText}</div>
            </div>
            
            <div class="subject-card-actions" style="width: 100%;">
                <button class="manage-btn" onclick="toggleControlButtons(this)">${btnEditTxt}</button>
                <div class="hidden-controls" style="display: none;">
                    <button class="action-btn btn-approve" onclick='openEditModal(${JSON.stringify(sub).replace(/"/g, '&quot;')})'>${btnUpdateTxt}</button>
                    <button class="action-btn btn-reject" onclick="deleteSubject(${sub.Subject_ID || sub.id})">${btnDelTxt}</button>
                </div>
            </div>
        </div>`;
    }).join('');
}
