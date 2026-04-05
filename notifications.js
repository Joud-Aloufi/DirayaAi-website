/**
 * ============================================================================
 * DIRAYAAI - NOTIFICATIONS SYSTEM
 * الوظيفة: إدارة وعرض الإشعارات الخاصة بالمستخدم (مثل قبول أو رفض المحتوى المرفوع).
 * ============================================================================
 */

// المستمع الرئيسي: يتم التنفيذ بمجرد اكتمال تحميل عناصر الصفحة (DOM)
document.addEventListener('DOMContentLoaded', async () => {
    // استهداف حاوية قائمة الإشعارات في واجهة المستخدم
    const list = document.getElementById('notifications-list');
    
    // التحقق من وجود دالة الاتصال بالسيرفر الأساسية، وإيقاف التنفيذ لتجنب الأخطاء إن لم تكن موجودة
    if (typeof fetchAPI === 'undefined') return;
    
    // جلب قائمة الإشعارات الخاصة بالمستخدم من قاعدة البيانات
    const res = await fetchAPI('user_api.php?action=get_notifications');
    
    // إعداد نظام الترجمة وجلب لغة المستخدم الحالية
    const lang = localStorage.getItem('diraya_lang') || 'ar';
    const t = typeof translations !== 'undefined' ? translations[lang] : null;

    // التحقق من نجاح طلب الاتصال ووجود إشعارات للعرض
    if(res.status === 'success' && res.notifications.length > 0) {
        
        // المرور على مصفوفة الإشعارات وتحويلها إلى عناصر HTML (كروت)
        list.innerHTML = res.notifications.map(n => {
            let displayTitle = n.Title;
            let displayMsg = n.Message;

            // معالجة الترجمة الفورية للإشعارات (لأنها تُخزن باللغة العربية في قاعدة البيانات)
            if (lang === 'en') {
                // ترجمة العناوين الأساسية
                if (displayTitle.includes('تم قبول')) displayTitle = 'Request Approved! 🎉';
                if (displayTitle.includes('تم رفض')) displayTitle = 'Request Rejected ❌';

                // ترجمة تفاصيل رسالة "الموافقة"
                if (displayMsg.includes('تمت الموافقة')) {
                    // استخراج اسم المادة من النص العربي
                    let sub = displayMsg.replace('تمت الموافقة على المحتوى الذي رفعته لمادة: ', '').replace('، وأصبح متاحاً للجميع الآن.', '');
                    // ترجمة اسم المادة إذا كان لها ترجمة في القاموس
                    sub = (t && t[sub]) ? t[sub] : sub; 
                    // تركيب الرسالة الإنجليزية
                    displayMsg = `Your uploaded content for: <strong>${sub}</strong> has been approved and is now available to everyone.`;
                } 
                // ترجمة تفاصيل رسالة "الرفض"
                else if (displayMsg.includes('تم رفض')) {
                    // استخراج اسم المادة من النص العربي
                    let sub = displayMsg.replace('نأسف، تم رفض المحتوى المرفوع لمادة: ', '').replace(' لمخالفته الشروط أو لوجود محتوى مشابه.', '');
                    // ترجمة اسم المادة إذا كان لها ترجمة في القاموس
                    sub = (t && t[sub]) ? t[sub] : sub;
                    // تركيب الرسالة الإنجليزية
                    displayMsg = `Sorry, the content you uploaded for: <strong>${sub}</strong> has been rejected for violating terms or being a duplicate.`;
                }
            }

            // تنسيق تاريخ ووقت الإشعار ليتناسب مع لغة وتنسيق منطقة المستخدم
            const dateStr = new Date(n.Created_At).toLocaleString(lang === 'en' ? 'en-US' : 'ar-SA');

            // إرجاع كود الـ HTML الخاص بكل إشعار
            // ملاحظة: يتم إضافة كلاس 'unread' إذا كان الإشعار غير مقروء (Is_Read == 0) ليتم تظليله
            return `
                <div class="noti-item ${n.Is_Read == 0 ? 'unread' : ''}">
                    <div class="noti-title">${displayTitle}</div>
                    <div class="noti-msg">${displayMsg}</div>
                    <div class="noti-time" dir="ltr">${dateStr}</div>
                </div>
            `;
        }).join(''); // دمج الكروت في نص HTML واحد
        
        // بعد عرض الإشعارات للمستخدم، نرسل طلباً صامتاً للسيرفر لتحديث حالتها إلى "مقروءة"
        fetchAPI('user_api.php?action=mark_notifications_read');
        
    } else {
        // عرض رسالة تنبيهية في حال كان صندوق الإشعارات فارغاً
        const emptyMsg = (lang === 'en') ? 'No notifications available at the moment.' : 'لا توجد إشعارات حالياً.';
        list.innerHTML = `<p class="noti-empty-msg">${emptyMsg}</p>`;
    }
});