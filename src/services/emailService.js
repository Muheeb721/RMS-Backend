import nodemailer from 'nodemailer';
import EmailLog from '../models/EmailLog.js';

const normalizeBoolean = (value) => value === true || value === 'true' || value === 1 || value === '1';

const getTransportConfig = () => {
  const host = process.env.SMTP_HOST || '';
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASSWORD || '';
  const secure = normalizeBoolean(process.env.SMTP_SECURE || false);

  if (!host || !user || !pass) {
    return null;
  }

  return {
    host,
    port,
    secure,
    auth: { user, pass },
  };
};

const getFromAddress = () => process.env.SMTP_FROM || process.env.RMS_SUPPORT_EMAIL || 'no-reply@rms.local';
const getSupportAddress = () => process.env.RMS_SUPPORT_EMAIL || 'support@rms.local';

const buildHtmlTemplate = ({ title, intro, userName, bodyLines = [], footerText = '', highlight = '' }) => {
  const safeName = String(userName || 'RMS User').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const linesHtml = bodyLines
    .map((line) => `<p style="margin:0 0 12px; font-size:14px; line-height:1.6; color:#243244;">${line}</p>`)
    .join('');

  return `
    <div style="font-family: Arial, sans-serif; background:#f3f6fb; padding:30px 0; color:#1d2430;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #dfe7f1; border-radius:12px; overflow:hidden;">
        <div style="background:linear-gradient(135deg,#0f172a,#1f3a5f); padding:20px 28px; color:#fff;">
          <div style="font-size:26px; font-weight:700; letter-spacing:0.4px;">RMS</div>
          <div style="font-size:12px; letter-spacing:1.5px; text-transform:uppercase; opacity:0.8; margin-top:6px;">Rental Management System</div>
        </div>
        <div style="padding:28px;">
          <h2 style="margin:0 0 12px; font-size:24px; color:#0f172a;">${title}</h2>
          <p style="margin:0 0 20px; font-size:15px; color:#3b485d;">Dear <strong>${safeName}</strong>,</p>
          <p style="margin:0 0 16px; font-size:15px; line-height:1.7; color:#243244;">${intro}</p>
          ${highlight ? `<div style="background:#eef5ff; border-left:4px solid #2d6cdf; padding:12px 14px; margin:18px 0; border-radius:6px; color:#183866; font-weight:600;">${highlight}</div>` : ''}
          ${linesHtml}
          <div style="margin-top:20px; padding-top:18px; border-top:1px solid #e7edf5; color:#475467; font-size:13px; line-height:1.7;">
            If you have any issue regarding your profile, rental booking, payment, or property, please contact RMS support through your RMS account or the support section.
          </div>
        </div>
        <div style="background:#f8fafc; border-top:1px solid #e7edf5; padding:18px 28px; color:#475467; font-size:12px; line-height:1.7;">
          ${footerText || 'Thank you for choosing RMS. We are happy to have you with us.'}
          <div style="margin-top:10px;">Best Regards,<br />RMS Rental Management System</div>
        </div>
      </div>
    </div>
  `;
};

const buildTextVersion = ({ title, intro, userName, bodyLines = [], footerText = '' }) => {
  const lines = [
    `Dear ${userName || 'RMS User'},`,
    '',
    title,
    '',
    intro,
    '',
    ...bodyLines,
    '',
    footerText || 'Thank you for choosing RMS.',
    '',
    'Best Regards,',
    'RMS Rental Management System',
  ];
  return lines.join('\n');
};

export const sendEmail = async ({
  to,
  type,
  subject,
  html,
  text,
  bookingId = '',
  userId = '',
  metadata = {},
  dedupeKey = '',
}) => {
  const recipient = String(to || '').trim();
  if (!recipient) {
    throw new Error('Missing email recipient');
  }

  const safeDedupeKey = dedupeKey || `${type}:${userId || 'anon'}:${bookingId || 'no-booking'}:${recipient}`;

  const existing = await EmailLog.findOne({ dedupeKey: safeDedupeKey }).lean();
  if (existing && existing.status === 'sent') {
    return { success: true, skipped: true, log: existing, message: 'Duplicate email suppressed.' };
  }

  const log = await EmailLog.create({
    userId: userId || '',
    email: recipient,
    type,
    subject,
    bookingId: bookingId || '',
    status: 'pending',
    sentAt: null,
    error: '',
    metadata,
    dedupeKey: safeDedupeKey,
  });

  try {
    const transportConfig = getTransportConfig();
    if (!transportConfig) {
      await EmailLog.findByIdAndUpdate(log._id, {
        status: 'skipped',
        error: 'SMTP configuration missing. Email not sent.',
        sentAt: new Date(),
      });
      return { success: false, skipped: true, log, message: 'SMTP configuration missing; email not sent.' };
    }

    const transporter = nodemailer.createTransport(transportConfig);
    await transporter.sendMail({
      from: getFromAddress(),
      to: recipient,
      subject,
      text: text || 'RMS email',
      html: html || '<p>RMS email</p>',
    });

    await EmailLog.findByIdAndUpdate(log._id, {
      status: 'sent',
      sentAt: new Date(),
      error: '',
    });

    return { success: true, skipped: false, log, message: 'Email sent successfully.' };
  } catch (err) {
    const message = err && err.message ? err.message : 'Email delivery failed';
    await EmailLog.findByIdAndUpdate(log._id, {
      status: 'failed',
      error: message,
      sentAt: new Date(),
    });
    return { success: false, skipped: false, log, message };
  }
};

export const createProfileCompletedEmail = ({ userName, userEmail }) => {
  const intro = 'Congratulations and welcome to RMS! Your RMS tenant profile has been successfully completed and your account is now ready for the rental process.';
  const bodyLines = [
    `Your registered email: ${userEmail || 'Not available'}`,
    'You can now log in to your RMS account and continue exploring available rental properties.',
    'Thank you for choosing RMS – Rental Management System.',
    'We are happy to have you with us.',
  ];

  return {
    subject: 'Welcome to RMS – Your Account/Profile Has Been Successfully Created',
    html: buildHtmlTemplate({
      title: 'Welcome to RMS',
      intro,
      userName,
      bodyLines,
      footerText: 'Thank you for choosing RMS – Rental Management System. We are happy to have you with us.',
      highlight: 'Tenant profile completed successfully',
    }),
    text: buildTextVersion({
      title: 'Welcome to RMS',
      intro,
      userName,
      bodyLines,
      footerText: 'Thank you for choosing RMS – Rental Management System. We are happy to have you with us.',
    }),
  };
};

export const createBookingSubmittedEmail = ({ userName, userEmail, propertyName, propertyType, location, monthlyRent, moveInDate, rentalDuration, bookingId, bookingStatus, bookingDate }) => {
  const bodyLines = [
    `Property: ${propertyName || 'N/A'}`,
    `Property Type: ${propertyType || 'N/A'}`,
    `Location: ${location || 'N/A'}`,
    `Monthly Rent: ${monthlyRent ? `PKR ${Number(monthlyRent).toLocaleString()}` : 'N/A'}`,
    `Move-in Date: ${moveInDate || 'N/A'}`,
    `Rental Duration: ${rentalDuration || 'N/A'}`,
    `Booking ID: ${bookingId || 'N/A'}`,
    `Current Status: ${bookingStatus || 'Pending Confirmation'}`,
    `Booking Date: ${bookingDate || new Date().toISOString().slice(0, 10)}`,
    `Support: ${getSupportAddress()}`,
  ];

  return {
    subject: 'Congratulations! Your Rental Booking Has Been Successfully Submitted – RMS',
    html: buildHtmlTemplate({
      title: 'Booking Submitted Successfully',
      intro: 'We are delighted to inform you that your rental booking request has been successfully submitted on the RMS Rental Management System.',
      userName,
      bodyLines: [
        `Your registered email: ${userEmail || 'Not available'}`,
        ...bodyLines,
      ],
      footerText: 'Thank you for choosing RMS. We truly appreciate your trust in our Rental Management System.',
      highlight: 'Booking Status: Pending Confirmation',
    }),
    text: buildTextVersion({
      title: 'Congratulations! Your Rental Booking Has Been Successfully Submitted – RMS',
      intro: 'We are delighted to inform you that your rental booking request has been successfully submitted on the RMS Rental Management System.',
      userName,
      bodyLines: [
        `Your registered email: ${userEmail || 'Not available'}`,
        ...bodyLines,
      ],
      footerText: 'Thank you for choosing RMS. We truly appreciate your trust in our Rental Management System.',
    }),
  };
};

export const createBookingApprovedEmail = ({ userName, propertyName, location, monthlyRent, moveInDate, bookingId, status }) => {
  const bodyLines = [
    `Property: ${propertyName || 'N/A'}`,
    `Location: ${location || 'N/A'}`,
    `Monthly Rent: ${monthlyRent ? `PKR ${Number(monthlyRent).toLocaleString()}` : 'N/A'}`,
    `Move-in Date: ${moveInDate || 'N/A'}`,
    `Booking ID: ${bookingId || 'N/A'}`,
    `Status: ${status || 'Approved'}`,
    `Support: ${getSupportAddress()}`,
  ];

  return {
    subject: 'RMS – Your Rental Booking Has Been Approved 🎉',
    html: buildHtmlTemplate({
      title: 'Booking Approved',
      intro: 'Congratulations! Your rental booking for the selected property has been approved by the RMS management team.',
      userName,
      bodyLines,
      footerText: 'Thank you for choosing RMS. If you have any questions or face any issue regarding your rental, please contact us through your RMS account or support.',
      highlight: 'Status: Approved',
    }),
    text: buildTextVersion({
      title: 'RMS – Your Rental Booking Has Been Approved 🎉',
      intro: 'Congratulations! Your rental booking for the selected property has been approved by the RMS management team.',
      userName,
      bodyLines,
      footerText: 'Thank you for choosing RMS. If you have any questions or face any issue regarding your rental, please contact us through your RMS account or support.',
    }),
  };
};

export const createBookingRejectedEmail = ({ userName, propertyName, bookingId, reason }) => {
  const bodyLines = [
    `Property: ${propertyName || 'N/A'}`,
    `Booking ID: ${bookingId || 'N/A'}`,
    `Rejection Reason: ${reason || 'No reason provided.'}`,
    'If you have any questions, please contact RMS support through your account or support section.',
    `Support: ${getSupportAddress()}`,
  ];

  return {
    subject: 'RMS – Update Regarding Your Rental Booking',
    html: buildHtmlTemplate({
      title: 'Rental Booking Update',
      intro: 'We would like to inform you that your rental booking request has been reviewed by the RMS management team and has not been approved at this time.',
      userName,
      bodyLines,
      footerText: 'Thank you for your understanding. If you would like to discuss your rental options, please contact RMS support.',
      highlight: 'Status: Rejected',
    }),
    text: buildTextVersion({
      title: 'RMS – Update Regarding Your Rental Booking',
      intro: 'We would like to inform you that your rental booking request has been reviewed by the RMS management team and has not been approved at this time.',
      userName,
      bodyLines,
      footerText: 'Thank you for your understanding. If you would like to discuss your rental options, please contact RMS support.',
    }),
  };
};

export const sendProfileCompletedEmail = async ({ userName, userEmail, userId }) => {
  const template = createProfileCompletedEmail({ userName, userEmail });
  return sendEmail({
    to: userEmail,
    userId,
    type: 'PROFILE_COMPLETED',
    subject: template.subject,
    html: template.html,
    text: template.text,
    metadata: { userName, userEmail },
    dedupeKey: `PROFILE_COMPLETED:${userId || userEmail}`,
  });
};

export const sendBookingSubmittedEmail = async ({
  userName,
  userEmail,
  userId,
  bookingId,
  propertyName,
  propertyType,
  location,
  monthlyRent,
  moveInDate,
  rentalDuration,
  bookingStatus,
  bookingDate,
}) => {
  const template = createBookingSubmittedEmail({
    userName,
    userEmail,
    propertyName,
    propertyType,
    location,
    monthlyRent,
    moveInDate,
    rentalDuration,
    bookingId,
    bookingStatus,
    bookingDate,
  });

  return sendEmail({
    to: userEmail,
    userId,
    type: 'BOOKING_SUBMITTED',
    subject: template.subject,
    html: template.html,
    text: template.text,
    bookingId,
    metadata: { propertyName, propertyType, location, monthlyRent, moveInDate, rentalDuration, bookingStatus },
    dedupeKey: `BOOKING_SUBMITTED:${bookingId || userId || userEmail}`,
  });
};

export const sendBookingApprovedEmail = async ({ userName, userEmail, userId, bookingId, propertyName, location, monthlyRent, moveInDate, status }) => {
  const template = createBookingApprovedEmail({ userName, propertyName, location, monthlyRent, moveInDate, bookingId, status });
  return sendEmail({
    to: userEmail,
    userId,
    type: 'BOOKING_APPROVED',
    subject: template.subject,
    html: template.html,
    text: template.text,
    bookingId,
    metadata: { propertyName, location, monthlyRent, moveInDate, bookingId },
    dedupeKey: `BOOKING_APPROVED:${bookingId || userId || userEmail}`,
  });
};

export const sendBookingRejectedEmail = async ({ userName, userEmail, userId, bookingId, propertyName, reason }) => {
  const template = createBookingRejectedEmail({ userName, propertyName, bookingId, reason });
  return sendEmail({
    to: userEmail,
    userId,
    type: 'BOOKING_REJECTED',
    subject: template.subject,
    html: template.html,
    text: template.text,
    bookingId,
    metadata: { propertyName, bookingId, reason },
    dedupeKey: `BOOKING_REJECTED:${bookingId || userId || userEmail}`,
  });
};
