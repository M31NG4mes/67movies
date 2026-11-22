import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  get isConfigured(): boolean {
    const resendKey = this.configService.get<string>('RESEND_API_KEY');
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');
    return Boolean(resendKey || (smtpHost && smtpUser && smtpPass));
  }

  /**
   * Sends a branded 67movies password recovery email with a 6-digit code.
   * Returns true if delivered via Resend or SMTP, false if mail is not configured.
   */
  async sendPasswordResetCode(toEmail: string, code: string): Promise<boolean> {
    const subject = 'Код восстановления пароля — 67movies';
    const html = this.buildResetEmailHtml(code);
    const text = `Ваш код восстановления пароля для 67movies: ${code}\nКод действителен 15 минут. Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.`;

    const resendKey = this.configService.get<string>('RESEND_API_KEY');
    const mailFrom =
      this.configService.get<string>('MAIL_FROM') ||
      this.configService.get<string>('SMTP_USER') ||
      '67movies <onboarding@resend.dev>';

    // 1. Resend HTTPS API (if RESEND_API_KEY is set)
    if (resendKey) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: mailFrom,
            to: [toEmail],
            subject,
            html,
            text,
          }),
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Resend HTTP ${res.status}: ${body}`);
        }
        this.logger.log(`Password reset email sent via Resend to ${toEmail}`);
        return true;
      } catch (err: any) {
        this.logger.error(`Resend email delivery failed: ${err?.message}`);
        throw err;
      }
    }

    // 2. SMTP via Nodemailer (Gmail / Yandex / Mail.ru / custom SMTP)
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = Number(this.configService.get<string>('SMTP_PORT', '465'));
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');

    if (smtpHost && smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: mailFrom,
        to: toEmail,
        subject,
        text,
        html,
      });

      this.logger.log(`Password reset email sent via SMTP (${smtpHost}) to ${toEmail}`);
      return true;
    }

    return false;
  }

  private buildResetEmailHtml(code: string): string {
    return `
      <div style="background:#09090D;padding:36px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#FFFFFF;">
        <div style="max-width:460px;margin:0 auto;background:#111119;border:1px solid #292936;border-radius:20px;padding:32px;text-align:center;">
          <div style="display:inline-block;background:linear-gradient(135deg,#8065FF,#A18BFF);color:#FFFFFF;font-weight:900;font-size:20px;padding:10px 16px;border-radius:14px;letter-spacing:-0.5px;">
            67movies
          </div>
          <h2 style="margin:24px 0 8px;font-size:22px;font-weight:800;color:#FFFFFF;">
            Восстановление пароля
          </h2>
          <p style="margin:0 0 24px;font-size:14px;color:#92929F;line-height:1.5;">
            Введите этот одноразовый код на странице восстановления пароля. Код действителен 15 минут.
          </p>
          <div style="background:#09090D;border:1px solid #8065FF;border-radius:14px;padding:18px;font-size:32px;font-weight:900;letter-spacing:8px;color:#A18BFF;font-family:monospace;">
            ${code}
          </div>
          <p style="margin:24px 0 0;font-size:12px;color:#6E6E80;">
            Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.
          </p>
        </div>
      </div>
    `;
  }
}
