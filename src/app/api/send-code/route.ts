
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { email, code, type, details } = await req.json();

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    let subject = 'تنبيه أمني - REvive Fasel HD';
    let content = '';

    const now = new Date().toLocaleString('ar-EG', { timeZone: 'Asia/Riyadh' });

    switch (type) {
      case 'create_profile':
        subject = 'تنبيه: تم إنشاء ملف شخصي جديد';
        content = `
          <h2 style="color: #ffffff !important; margin-bottom: 20px;">تم إنشاء بروفايل جديد بنجاح!</h2>
          <p style="color: #cccccc !important; font-size: 16px; line-height: 1.6;">
            لقد تمت إضافة بروفايل جديد إلى حسابك. إليك التفاصيل:
          </p>
          <div style="background-color: #000000 !important; padding: 25px; border-radius: 12px; margin: 25px 0; text-align: center; border: 1px solid rgba(0,242,255,0.2);">
            <img src="${details?.avatar || ''}" width="120" height="120" style="border-radius: 15px; margin-bottom: 15px; border: 3px solid #00f2ff; display: block; margin-left: auto; margin-right: auto;" />
            <p style="color: #ffffff !important; margin: 10px 0; font-size: 24px; font-weight: bold;">${details?.name || 'بروفايل جديد'}</p>
            <p style="color: #00f2ff !important; margin: 8px 0; font-size: 14px;"><b>⏰ وقت العمليّة:</b> ${now}</p>
          </div>
          <p style="color: #888888 !important; font-size: 13px;">إذا لم تقم بإنشاء هذا البروفايل بنفسك، يرجى مراجعة إعدادات حسابك.</p>
        `;
        break;

      case 'welcome':
        subject = 'أهلاً بك في REvive Fasel HD';
        content = `
          <h2 style="color: #ffffff !important; margin-bottom: 20px;">مرحباً بك في عالم الترفيه!</h2>
          <p style="color: #cccccc !important; font-size: 16px; line-height: 1.6;">
            سعداء جداً بانضمامك إلينا. حسابك الآن جاهز لتبدأ رحلة مشاهدة استثنائية.
          </p>
          <div style="background-color: #000000 !important; padding: 25px; border-radius: 12px; margin: 25px 0; border: 1px solid rgba(0,242,255,0.1); text-align: right;">
            <p style="color: #00f2ff !important; font-weight: bold; margin: 0;">جاهز للبدء؟</p>
            <p style="color: #888888 !important; font-size: 14px; margin-top: 10px;">يمكنك الآن إنشاء ملفات شخصية مخصصة لأفراد عائلتك والاستمتاع بمشاهدة أفلامك ومسلسلاتك المفضلة بدقة عالية.</p>
          </div>
        `;
        break;

      case 'delete':
        subject = 'تأكيد حذف الحساب - رمز التحقق';
        content = `
          <h2 style="color: #ffffff !important; margin-bottom: 20px;">طلب حذف الحساب</h2>
          <p style="color: #cccccc !important; font-size: 16px; line-height: 1.6;">
            لقدت طلبت رمزاً لتأكيد حذف حسابك نهائياً. يرجى استخدام الرمز التالي للمتابعة (هذا الرمز صالح لمدة 5 دقائق فقط):
          </p>
          <div style="margin: 40px 0; padding: 20px; background-color: #000000 !important; border: 2px dashed rgba(0,242,255,0.3); border-radius: 10px;">
            <span style="font-size: 42px; font-weight: 900; color: #00f2ff !important; letter-spacing: 12px;">${code}</span>
          </div>
          <p style="color: #ff4444 !important; font-size: 14px; font-weight: bold;">تنتهي صلاحية هذا الرمز بعد 5 دقائق من الآن.</p>
        `;
        break;

      case 'login':
        subject = 'تنبيه أمني: تسجيل دخول جديد';
        content = `
          <h2 style="color: #ffffff !important; margin-bottom: 20px;">تنبيه تسجيل دخول جديد</h2>
          <p style="color: #cccccc !important; font-size: 16px; line-height: 1.6;">
            تم رصد عملية تسجيل دخول جديدة لحسابك. إليك التفاصيل:
          </p>
          <div style="background-color: #000000 !important; padding: 25px; border-radius: 12px; margin: 25px 0; text-align: right; border: 1px solid rgba(255,255,255,0.05);">
            <p style="color: #ffffff !important; margin: 8px 0;"><b>📅 التاريخ والوقت:</b> ${now}</p>
            <p style="color: #ffffff !important; margin: 8px 0;"><b>🌐 عنوان الـ IP:</b> <span style="color: #00f2ff !important; font-family: monospace;">${details?.ip || 'غير معروف'}</span></p>
            <p style="color: #ffffff !important; margin: 8px 0;"><b>📱 معرف الجهاز:</b> <span style="color: #00f2ff !important; font-family: monospace;">${details?.deviceId || 'غير معروف'}</span></p>
            <p style="color: #ffffff !important; margin: 8px 0;"><b>💻 نظام التشغيل:</b> ${details?.platform || 'غير معروف'}</p>
            <p style="color: #ffffff !important; margin: 8px 0;"><b>🧭 المتصفح:</b> ${details?.browser || 'غير معروف'}</p>
          </div>
        `;
        break;

      case 'change_email':
        subject = 'تم تغيير البريد الإلكتروني لحسابك';
        content = `
          <h2 style="color: #ffffff !important; margin-bottom: 20px;">تحديث البريد الإلكتروني</h2>
          <p style="color: #cccccc !important; font-size: 16px; line-height: 1.6;">
            لقد تم تغيير البريد الإلكتروني الخاص بحسابك بنجاح.
          </p>
          <div style="background-color: #000000 !important; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid rgba(0,242,255,0.1);">
            <p style="color: #00f2ff !important; font-weight: bold; margin: 0;">بريدك الإلكتروني الجديد هو: ${email}</p>
          </div>
        `;
        break;

      case 'change_password':
        subject = 'تم تغيير كلمة مرور حسابك';
        content = `
          <h2 style="color: #ffffff !important; margin-bottom: 20px;">تحديث كلمة المرور</h2>
          <p style="color: #cccccc !important; font-size: 16px; line-height: 1.6;">
            نحيطكم علماً بأنه قد تم تغيير كلمة المرور الخاصة بحسابكم بنجاح.
          </p>
          <div style="background-color: #000000 !important; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid rgba(255,255,255,0.05);">
            <p style="color: #ffffff !important; margin: 0;"><b>الوقت:</b> ${now}</p>
          </div>
        `;
        break;

      default:
        subject = 'رمز التحقق';
        content = `
          <h2 style="color: #ffffff !important; margin-bottom: 20px;">رمز التحقق</h2>
          <div style="margin: 40px 0; padding: 20px; background-color: #000000 !important; border: 2px dashed #00f2ff !important; border-radius: 10px;">
            <span style="font-size: 42px; font-weight: 900; color: #00f2ff !important; letter-spacing: 12px;">${code}</span>
          </div>
        `;
    }

    const mailOptions = {
        from: '"REvive Fasel HD" <noreply@revivefasel.com>',
        to: email,
        subject: subject,
        html: `
          <!DOCTYPE html>
          <html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="ar" dir="rtl">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta name="x-apple-disable-message-reformatting">
            <meta name="color-scheme" content="dark only">
            <meta name="supported-color-schemes" content="dark only">
            <!--[if mso]>
            <noscript>
              <xml>
                <o:OfficeDocumentSettings>
                  <o:PixelsPerInch>96</o:PixelsPerInch>
                </o:OfficeDocumentSettings>
              </xml>
            </noscript>
            <![endif]-->
            <style>
              :root { color-scheme: dark only; supported-color-schemes: dark only; }
              html, body { background-color: #000000 !important; color: #ffffff !important; margin: 0 !important; padding: 0 !important; height: 100% !important; width: 100% !important; }
              * { color: #ffffff !important; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important; }
              a { color: #00f2ff !important; text-decoration: none; }
              .main-table { background-color: #000000 !important; width: 100% !important; height: 100% !important; }
              .content-card { background-color: #050505 !important; border: 1px solid #1a1a1a !important; }
              @media (prefers-color-scheme: dark) {
                body, table { background-color: #000000 !important; }
              }
            </style>
          </head>
          <body bgcolor="#000000" style="background-color: #000000 !important; color: #ffffff !important; margin: 0; padding: 0; width: 100% !important; height: 100% !important;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" height="100%" bgcolor="#000000" class="main-table" style="background-color: #000000 !important; width: 100% !important; height: 100% !important;">
              <tr>
                <td align="center" valign="top" bgcolor="#000000" style="background-color: #000000 !important; padding: 40px 10px;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #050505 !important; border: 1px solid #111111 !important; border-radius: 24px; box-shadow: 0 30px 60px rgba(0,0,0,0.9);" bgcolor="#050505" class="content-card">
                    <tr>
                      <td style="padding: 50px 40px; text-align: center; direction: rtl; background-color: #050505 !important;" bgcolor="#050505">
                        
                        <!-- Header -->
                        <div style="margin-bottom: 35px; background-color: transparent !important;">
                          <h1 style="color: #00f2ff !important; margin: 0; font-size: 34px; letter-spacing: 2px; font-weight: 900; text-shadow: 0 0 15px rgba(0,242,255,0.3);">REvive Fasel HD</h1>
                          <div style="height: 3px; width: 60px; background-color: #00f2ff !important; margin: 15px auto; border-radius: 10px;"></div>
                        </div>

                        <!-- Main Content Wrapper -->
                        <div style="background-color: #000000 !important; padding: 35px; border-radius: 20px; border: 1px solid #1a1a1a !important; display: block;">
                          ${content}
                          
                          <!-- Security Badge -->
                          <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid #1a1a1a !important; background-color: transparent !important;">
                            <p style="color: #ff4444 !important; font-size: 13px; font-weight: 600; margin: 0; line-height: 1.5;">
                              ⚠️ إشعار أمني: نحن نهتم بخصوصيتك. لا تشارك هذا البريد أو أي رموز أمنية مع أي شخص آخر.
                            </p>
                          </div>
                        </div>

                        <!-- Footer -->
                        <div style="margin-top: 45px; text-align: center; background-color: transparent !important;">
                          <p style="color: #444444 !important; font-size: 12px; margin: 0; line-height: 1.4;">
                            © 2026 REvive Fasel HD Premium. جميع الحقوق محفوظة.
                          </p>
                          <p style="color: #222222 !important; font-size: 11px; margin-top: 10px; letter-spacing: 0.5px;">
                            SYSTEM_AUTO_NOTIFICATION_SECURE_CHANNEL
                          </p>
                        </div>

                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
    };

    await transporter.sendMail(mailOptions);
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Email Send Error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
