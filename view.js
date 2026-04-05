/**
 * ============================================================================
 * DIRAYAAI - VIEW MATERIAL JAVASCRIPT (Multilingual Ready)
 * الوظيفة: إدارة صفحة عرض المحتوى الأكاديمي، مشغل الملفات، نظام التقييم، والتعليقات.
 * ============================================================================
 */

// المستمع الرئيسي: يبدأ التنفيذ فور اكتمال تحميل شجرة عناصر الصفحة (DOM)
document.addEventListener('DOMContentLoaded', async () => {
    // 1. استخراج رقم المادة (ID) من رابط الصفحة (URL Parameters)
    const urlParams = new URLSearchParams(window.location.search);
    const resourceId = urlParams.get('id');
    
    // 2. إعداد وإحضار نظام الترجمة حسب اللغة المخزنة
    const lang = localStorage.getItem('diraya_lang') || 'ar';
    const t = typeof translations !== 'undefined' ? translations[lang] : null;

    // 3. التحقق من وجود رقم المادة في الرابط، وإذا لم يوجد نعرض رسالة خطأ ونوقف التنفيذ
    if (!resourceId) {
        const playerBox = document.getElementById('content-player-box');
        const errMsg = t ? t.view_err_missing_id : 'خطأ: لم يتم تحديد المادة المطلوبة.';
        if(playerBox) playerBox.innerHTML = `<p style="color:red; text-align:center;">${errMsg}</p>`;
        return;
    }

    // متغيرات عامة (State Variables) لتخزين حالة المستخدم والتقييم الحالي
    let currentRating = 0; 
    let isLoggedIn = false;
    let isAdmin = false;
    let currentUserId = null;

    // تشغيل الدوال الأساسية بالترتيب
    await checkViewAuth();       // التحقق من صلاحيات المستخدم وجلسته
    await loadMaterialData();    // جلب بيانات المادة وعرضها
    initRatingSystem();          // تهيئة نظام التقييم بالنجوم
    initCommentSystem();         // تهيئة نظام كتابة وإرسال التعليقات

    /**
     * دالة للتحقق من حالة تسجيل الدخول وصلاحيات المستخدم (طالب / مشرف).
     * إذا لم يكن المستخدم مسجلاً، يتم استبدال صندوق التعليق برسالة تطلب منه تسجيل الدخول.
     */
    async function checkViewAuth() {
        try {
            // التحقق من توفر الدالة المساعدة للاتصال بالسيرفر
            if (typeof fetchAPI === 'undefined') {
                console.error('خطأ: دالة fetchAPI غير موجودة.');
                return;
            }
            
            // جلب بيانات الجلسة من السيرفر
            const sessionData = await fetchAPI('user_api.php?action=check_session');
            isLoggedIn = sessionData.logged_in;
            isAdmin = (sessionData.role === 'مشرف' || sessionData.role === 'مدير نظام');
            
            if (isLoggedIn) {
                // إذا كان مسجلاً، نجلب بيانات ملفه الشخصي لمعرفة المعرف الخاص به (User_ID)
                const profile = await fetchAPI('user_api.php?action=get_profile');
                if (profile.status === 'success') currentUserId = profile.User_ID;
            } else {
                // إذا كان زائراً غير مسجل، نخفي صندوق التعليق ونعرض رسالة تنبيهية جذابة
                const addBox = document.querySelector('.add-comment-box');
                const reqMsg = t ? t.view_login_required : `يجب <a href="signup.html" style="color: #b39972; text-decoration: underline; font-weight: bold;">تسجيل الدخول</a> لتتمكن من إضافة تعليق وتقييم.`;
                
                if (addBox) {
                    addBox.innerHTML = `
                        <div style="text-align: center; padding: 30px 20px; background: #fdfaf5; border: 1px dashed #b39972; border-radius: 12px; margin: 20px auto; width: 100%; box-sizing: border-box;">
                            <p style="color: #555; margin: 0; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#b39972" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
                                <span>${reqMsg}</span>
                            </p>
                        </div>
                    `;
                }
            }
        } catch(e) { console.error('خطأ في التحقق من الجلسة:', e); }
    }

    /**
     * دالة مسؤولة عن جلب بيانات المادة التعليمة من قاعدة البيانات.
     * وتوجيه البيانات للدوال المختصة بعرضها (المشغل، التفاصيل، التعليقات).
     */
    async function loadMaterialData() {
        try {
            const data = await fetchAPI(`view_api.php?action=get_material&id=${resourceId}`);
            
            // في حال عدم وجود المادة (محذوفة أو قيد المراجعة)
            if (data.status !== 'success') {
                const playerBox = document.getElementById('content-player-box');
                const errMsg = t ? t.view_err_not_found : (data.message || 'المادة غير موجودة أو قيد المراجعة.');
                if(playerBox) playerBox.innerHTML = `<p style="color:red; text-align:center;">${errMsg}</p>`;
                return;
            }

            // استخراج كائن المادة وتمريره لدوال العرض
            const mat = data.material;
            renderMaterialPlayer(mat);        // عرض المشغل (فيديو/PDF/رابط)
            renderMaterialDetails(mat);       // عرض تفاصيل المادة (عنوان، وصف، كاتب)
            renderComments(data.comments);    // عرض التعليقات والتقييمات
        } catch(e) { console.error('خطأ في جلب المادة:', e); }
    }

    /**
     * دالة بناء مشغل المحتوى بناءً على نوع الملف المسترجع من السيرفر.
     * @param {Object} mat - كائن يحتوي على بيانات المادة (بما فيها نوع الملف ورابطه).
     */
    function renderMaterialPlayer(mat) {
        const playerBox = document.getElementById('content-player-box');
        if (!playerBox) return;

        const resType = (mat.Resource_Type || '').toUpperCase();
        let playerHtml = '';

        // بناء كود الـ HTML بناءً على نوع الملف
        if (resType === 'VIDEO' || resType === 'MP4') {
            // مشغل فيديو مدمج مع منع التحميل (nodownload)
            const vidFallback = t ? t.view_no_desc : 'متصفحك لا يدعم مشغل الفيديو.';
            playerHtml = `<video controls controlsList="nodownload" style="width:100%; height:100%;"><source src="${mat.File_URL}" type="video/mp4">${vidFallback}</video>`;
        } else if (resType === 'PDF') {
            // مشغل PDF باستخدام Iframe مع إخفاء شريط الأدوات العلوي
            playerHtml = `<iframe src="${mat.File_URL}#toolbar=0" type="application/pdf" style="width:100%; height:100%; border:none;"></iframe>`;
        } else {
            // حالة الروابط الخارجية أو الملفات غير المدعومة للعرض المباشر
            const extLinkMsg = t ? t.view_ext_link_msg : 'هذا المحتوى عبارة عن رابط خارجي';
            const openLinkBtn = t ? t.view_open_link : 'فتح الرابط';
            playerHtml = `
                <div class="link-placeholder" style="text-align:center; padding:40px;">
                    <p>${extLinkMsg}</p>
                    <a href="${mat.File_URL}" target="_blank" class="submit-approval-btn" style="text-decoration:none; display:inline-block; margin-top:15px; width:auto; padding:10px 30px;">${openLinkBtn}</a>
                </div>`;
        }
        playerBox.innerHTML = playerHtml;
    }

    /**
     * دالة مساعدة لتحديث النصوص في عناصر الـ HTML بأمان.
     * تتأكد من وجود العنصر قبل محاولة تغيير نصه لتجنب أخطاء (Null Reference).
     * @param {string} id - المعرف (ID) الخاص بالعنصر.
     * @param {string} text - النص المراد إدراجه.
     */
    function safeSetText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    /**
     * دالة لتعبئة تفاصيل المادة (عنوان، وصف، ناشر، تاريخ، متوسط التقييم).
     * @param {Object} mat - كائن بيانات المادة.
     */
    function renderMaterialDetails(mat) {
        const lang = localStorage.getItem('diraya_lang') || 'ar';
        const t = typeof translations !== 'undefined' ? translations[lang] : null;

        safeSetText('view-title', mat.Title);
        safeSetText('view-desc', mat.Description || (t ? t.view_no_desc : 'لا يوجد وصف.'));
     
        // تحديد اسم الناشر: إما الاسم الكامل المخزن، أو تركيب الاسم الأول والأخير، أو قيمة افتراضية
        const authorName = mat.Full_Name || (mat.first_name + ' ' + mat.last_name) || 'مستخدم';
        const authorPrefix = t ? t.view_author_prefix : 'بواسطة: ';
        safeSetText('view-author', `${authorPrefix}${authorName}`);
        
        // تنسيق التاريخ بناءً على لغة واجهة المستخدم الحالية
        if(mat.Upload_Date) {
            const dateObj = new Date(mat.Upload_Date);
            const datePrefix = t ? t.view_date_prefix : 'التاريخ: ';
            const formattedDate = lang === 'en' ? dateObj.toLocaleDateString('en-US') : dateObj.toLocaleDateString('ar-SA');
            safeSetText('view-date', `${datePrefix}${formattedDate}`);
        }

        // حساب وعرض متوسط التقييمات وعددها الكلي
        const ratingScoreEl = document.querySelector('.rating-score');
        if (ratingScoreEl) {
            const avg = parseFloat(mat.avg_rating) || 0;
            const count = parseInt(mat.rating_count) || 0;
            const ratCountTxt = t ? t.view_ratings_count : 'تقييمات';
            ratingScoreEl.textContent = `${avg.toFixed(1)} (${count} ${ratCountTxt})`;
        }
    }

    /**
     * دالة لتهيئة التفاعل البصري مع نظام التقييم بالنجوم (تظليل النجوم عند التمرير والنقر).
     */
    function initRatingSystem() {
        const stars = document.querySelectorAll('.star');
        const starsContainer = document.querySelector('.stars'); 
        if (!stars.length) return;

        stars.forEach(star => {
            // 1. عند تمرير الفأرة (Hover): تلوين النجوم المؤشر عليها وما قبلها باللون الأصفر
            star.addEventListener('mouseover', function() {
                if (!isLoggedIn) return; // منع التفاعل لغير المسجلين
                const val = parseInt(this.getAttribute('data-value'));
                stars.forEach(s => s.style.color = parseInt(s.getAttribute('data-value')) <= val ? '#ffc107' : '#ccc');
            });

            // 2. عند إبعاد الفأرة (Mouseout): إعادة النجوم לחالتها المحفوظة (أو إطفائها إذا لم يتم التقييم)
            star.addEventListener('mouseout', function() {
                if (!isLoggedIn) return;
                updateStarsUI(currentRating);
            });

            // 3. عند النقر (Click): حفظ التقييم المختار
            star.addEventListener('click', function() {
                if (!isLoggedIn) {
                    const reqMsg = t ? t.view_login_required : 'يجب تسجيل الدخول لتقييم المادة.';
                    alert(reqMsg);
                    return;
                }
                currentRating = parseInt(this.getAttribute('data-value'));
                updateStarsUI(currentRating);
                
                // إزالة أي تأثيرات خطأ (لون أحمر) تم وضعها سابقاً إذا حاول المستخدم الإرسال بدون تقييم
                if (starsContainer) {
                    starsContainer.style.backgroundColor = 'transparent';
                    starsContainer.style.border = 'none';
                    starsContainer.style.padding = '0';
                }
            });
        });

        // دالة داخلية مساعدة لتحديث الواجهة الرسومية للنجوم (ممتلئة/فارغة)
        function updateStarsUI(ratingValue) {
            stars.forEach(s => {
                s.textContent = parseInt(s.getAttribute('data-value')) <= ratingValue ? '★' : '☆';
                s.style.color = parseInt(s.getAttribute('data-value')) <= ratingValue ? '#ffc107' : '#ccc';
            });
        }
    }

    /**
     * دالة لتهيئة نظام معالجة وإرسال التعليقات والتقييمات إلى السيرفر.
     */
    function initCommentSystem() {
        const submitBtn = document.querySelector('.comment-btn');
        const textarea = document.querySelector('.add-comment-box textarea');
        const starsContainer = document.querySelector('.stars'); 
        const commentsTitle = document.querySelector('.comments-section h3'); 

        if (submitBtn && textarea) {
            submitBtn.addEventListener('click', async () => {
                const text = textarea.value.trim();
                
                // تأثير حركي (Animation) بسيط للفت انتباه المستخدم عند وجود خطأ
                const highlightTitle = () => {
                    if (commentsTitle) {
                        commentsTitle.style.color = '#d9534f';
                        commentsTitle.style.transition = 'all 0.3s ease';
                        commentsTitle.style.transform = 'scale(1.05)';
                        setTimeout(() => commentsTitle.style.transform = 'scale(1)', 300);
                    }
                };
                
                // التحقق من أن المستخدم قام باختيار عدد النجوم
                if (currentRating === 0) {
                    // إبراز صندوق النجوم باللون الأحمر للتنبيه
                    if (starsContainer) {
                        starsContainer.style.backgroundColor = '#ffebee';
                        starsContainer.style.border = '1px solid #d9534f';
                        starsContainer.style.borderRadius = '10px';
                        starsContainer.style.padding = '5px 15px';
                        starsContainer.style.transition = 'all 0.3s ease';
                        starsContainer.style.transform = 'scale(1.05)';
                        setTimeout(() => starsContainer.style.transform = 'scale(1)', 300);
                    }
                    const rateAlert = t ? t.view_alert_rate_first : 'يرجى تقييم المادة بالنجوم أولاً قبل إرسال التعليق!';
                    alert(rateAlert);
                    return;
                }

                // التحقق من أن حقل النص ليس فارغاً
                if (!text) {
                    textarea.style.borderColor = '#d9534f'; 
                    textarea.style.boxShadow = '0 0 10px rgba(217, 83, 79, 0.2)'; 
                    
                    highlightTitle(); 
                    const writeAlert = t ? t.view_alert_write_comment : 'يرجى كتابة تعليق.';
                    alert(writeAlert);
                    return;
                }
                
                // إزالة علامات الخطأ إذا كانت البيانات صحيحة
                textarea.style.borderColor = '#ddd'; 
                textarea.style.boxShadow = 'none';
                if (commentsTitle) commentsTitle.style.color = '#333';

                // تعطيل الزر أثناء عملية الإرسال لمنع التكرار
                submitBtn.disabled = true;
                const sendingTxt = t ? t.view_btn_sending : 'جاري الإرسال...';
                submitBtn.textContent = sendingTxt;

                // تجميع البيانات للإرسال
                const fd = new FormData();
                fd.append('resource_id', resourceId);
                fd.append('comment_text', text);
                fd.append('rating_value', currentRating);

                try {
                    const res = await fetchAPI('view_api.php?action=add_comment', { method: 'POST', body: fd });
                    
                    if (res.status === 'success') {
                        // تفريغ الحقول وإعادة تصفير النجوم بعد النجاح
                        textarea.value = ''; 
                        currentRating = 0; 
                        document.querySelectorAll('.star').forEach(s => { 
                            s.textContent = '☆'; 
                            s.style.color = '#ccc'; 
                        });
                        // إعادة تحميل البيانات لتحديث قائمة التعليقات والمتوسط الحسابي للنجوم
                        await loadMaterialData(); 
                    } else { 
                        alert(res.message || 'حدث خطأ أثناء إضافة التعليق.'); 
                    }
                } catch(e) {
                    alert('فشل الاتصال بالسيرفر.');
                }
                
                // إعادة الزر لحالته الطبيعية
                submitBtn.disabled = false;
                submitBtn.textContent = t ? t.view_submit_comment : 'إرسال التعليق';
            });
        }
    }

    /**
     * دالة مسؤولة عن رسم وعرض قائمة التعليقات السابقة في الواجهة.
     * @param {Array} commentsList - مصفوفة تحتوي على بيانات التعليقات المجلوبة من السيرفر.
     */
    function renderComments(commentsList) {
        const listContainer = document.querySelector('.comments-list');
        if (!listContainer) return;

        // حالة: لا توجد تعليقات
        if (!commentsList || commentsList.length === 0) {
            const noComTxt = t ? t.view_no_comments : 'لا توجد تعليقات حتى الآن. كن الأول!';
            listContainer.innerHTML = `<p class="empty-submissions" style="text-align:center; padding:20px;">${noComTxt}</p>`;
            return;
        }

        // بناء كروت (Cards) التعليقات
        listContainer.innerHTML = commentsList.map(c => {
            // تنسيق التاريخ
            const dateObj = new Date(c.Created_At);
            const dateStr = lang === 'en' ? dateObj.toLocaleDateString('en-US') : dateObj.toLocaleDateString('ar-SA');
            
            // توليد الـ HTML الخاص بالنجوم لكل تعليق حسب تقييم المستخدم
            let starsHtml = '';
            for (let i = 1; i <= 5; i++) {
                starsHtml += i <= c.Rating_Value ? '<span style="color:#ffc107;">★</span>' : '<span style="color:#ccc;">☆</span>';
            }

            // تحديد صلاحية الحذف: مسموح للمدير، أو لصاحب التعليق نفسه
            const canDelete = isAdmin || (currentUserId && c.User_ID === currentUserId);
            const delBtnTxt = t ? t.view_btn_delete : 'حذف';
            const deleteBtn = canDelete ? `<button class="delete-comment-btn" onclick="deleteComment(${c.Rating_ID})">${delBtnTxt}</button>` : '';
            
            const authorName = c.Full_Name || (c.first_name + ' ' + c.last_name) || 'مستخدم';
            // ضبط هامش التاريخ ليناسب اتجاه اللغة (RTL/LTR)
            const dateMargin = lang === 'en' ? 'margin-left: 10px;' : 'margin-right: 10px;';

            return `
            <div class="comment-item">
                <div class="comment-avatar">${authorName.charAt(0)}</div>
                <div class="comment-body">
                    <div class="comment-header">
                        <div class="comment-meta">
                            <strong class="comment-name">${authorName}</strong>
                            <span class="comment-time" style="${dateMargin}">${dateStr}</span>
                        </div>
                        <div class="comment-rating-stars">${starsHtml}</div>
                    </div>
                    <p class="comment-text">${c.Comment_Text}</p>
                    <div style="text-align:left; margin-top:5px;">${deleteBtn}</div>
                </div>
            </div>`;
        }).join('');
    }

    /**
     * دالة عامة (Global) لحذف تعليق محدد.
     * تم إضافتها لكائن window ليتمكن زر الحذف (المبني بـ innerHTML) من استدعائها مباشرة عبر onclick.
     * @param {number} ratingId - المعرف الخاص بالتقييم/التعليق.
     */
    window.deleteComment = async (ratingId) => {
        // رسالة تأكيد الحذف
        const confirmMsg = t ? t.view_confirm_delete : 'هل أنت متأكد من حذف هذا التعليق؟';
        if (!confirm(confirmMsg)) return;

        const fd = new FormData();
        fd.append('rating_id', ratingId);

        // إرسال طلب الحذف للسيرفر
        const res = await fetchAPI('view_api.php?action=delete_comment', { method: 'POST', body: fd });
        
        if (res.status === 'success') {
            await loadMaterialData(); // إعادة تحميل البيانات لتحديث القائمة والمتوسط حسابي
        } else {
            alert(res.message || 'فشل الحذف.');
        }
    };
});