// Email notification utilities for vendor approval workflow

interface VendorApprovalEmailData {
  vendorEmail: string;
  vendorName: string;
  businessName: string;
  adminName: string;
  approvalDate: string;
  rejectionReason?: string;
}

interface AdminNotificationEmailData {
  adminEmail: string;
  adminName: string;
  vendorName: string;
  businessName: string;
  action: 'approved' | 'rejected';
  rejectionReason?: string;
}

export async function sendVendorApprovalEmail(data: VendorApprovalEmailData) {
  // TODO: Implement actual email sending logic
  // This would typically use a service like SendGrid, AWS SES, or similar
  
  const emailContent = {
    to: data.vendorEmail,
    subject: 'Your Reliance Vendor Account Has Been Approved!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">Welcome to Reliance!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your vendor account has been approved</p>
        </div>
        
        <div style="padding: 30px; background: #f8fafc;">
          <h2 style="color: #1e293b; margin-bottom: 20px;">Congratulations, ${data.vendorName}!</h2>
          
          <p style="color: #475569; line-height: 1.6; margin-bottom: 20px;">
            Great news! Your vendor account for <strong>${data.businessName}</strong> has been approved by our team. 
            You can now start accepting bookings and growing your business on Reliance.
          </p>
          
          <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0;">
            <h3 style="color: #065f46; margin: 0 0 10px 0;">What's Next?</h3>
            <ul style="color: #047857; margin: 0; padding-left: 20px;">
              <li>Complete your profile setup</li>
              <li>Add your services and pricing</li>
              <li>Upload photos of your work</li>
              <li>Set your availability schedule</li>
              <li>Start receiving booking requests</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/vendor/dashboard" 
               style="background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
              Access Your Dashboard
            </a>
          </div>
          
          <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
            If you have any questions, please don't hesitate to contact our support team.
          </p>
        </div>
        
        <div style="background: #1e293b; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p style="margin: 0;">© 2026 Reliance. All rights reserved.</p>
        </div>
      </div>
    `,
    text: `
      Welcome to Reliance!
      
      Congratulations, ${data.vendorName}!
      
      Great news! Your vendor account for ${data.businessName} has been approved by our team. 
      You can now start accepting bookings and growing your business on Reliance.
      
      What's Next?
      - Complete your profile setup
      - Add your services and pricing
      - Upload photos of your work
      - Set your availability schedule
      - Start receiving booking requests
      
      Access your dashboard: ${process.env.NEXT_PUBLIC_APP_URL}/vendor/dashboard
      
      If you have any questions, please don't hesitate to contact our support team.
      
      © 2026 Reliance. All rights reserved.
    `
  };

  console.log('Sending vendor approval email:', {
    to: data.vendorEmail,
    subject: emailContent.subject,
    businessName: data.businessName,
    approvedBy: data.adminName,
    approvalDate: data.approvalDate,
  });

  // TODO: Implement actual email sending
  // await emailService.send(emailContent);
  
  return { success: true, messageId: 'mock-email-id' };
}

export async function sendVendorRejectionEmail(data: VendorApprovalEmailData) {
  if (!data.rejectionReason) {
    throw new Error('Rejection reason is required for rejection emails');
  }

  const emailContent = {
    to: data.vendorEmail,
    subject: 'Update on Your Reliance Vendor Application',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">Application Update</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Important information about your vendor application</p>
        </div>
        
        <div style="padding: 30px; background: #f8fafc;">
          <h2 style="color: #1e293b; margin-bottom: 20px;">Hello ${data.vendorName},</h2>
          
          <p style="color: #475569; line-height: 1.6; margin-bottom: 20px;">
            Thank you for your interest in joining Reliance as a vendor. After careful review of your application 
            for <strong>${data.businessName}</strong>, we regret to inform you that we are unable to approve your 
            vendor account at this time.
          </p>
          
          <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0;">
            <h3 style="color: #991b1b; margin: 0 0 10px 0;">Reason for Rejection:</h3>
            <p style="color: #7f1d1d; margin: 0; line-height: 1.5;">
              ${data.rejectionReason}
            </p>
          </div>
          
          <div style="background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 20px; margin: 20px 0;">
            <h3 style="color: #0c4a6e; margin: 0 0 10px 0;">What You Can Do:</h3>
            <ul style="color: #0369a1; margin: 0; padding-left: 20px;">
              <li>Address the concerns mentioned above</li>
              <li>Update your application with additional information</li>
              <li>Reapply once you've made the necessary changes</li>
              <li>Contact our support team for clarification</li>
            </ul>
          </div>
          
          <p style="color: #64748b; line-height: 1.6; margin-top: 20px;">
            We encourage you to address the concerns mentioned and consider reapplying in the future. 
            Our team is here to help you succeed.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/auth/register" 
               style="background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
              Reapply for Vendor Account
            </a>
          </div>
          
          <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
            If you have any questions about this decision, please contact our support team.
          </p>
        </div>
        
        <div style="background: #1e293b; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p style="margin: 0;">© 2026 Reliance. All rights reserved.</p>
        </div>
      </div>
    `,
    text: `
      Application Update
      
      Hello ${data.vendorName},
      
      Thank you for your interest in joining Reliance as a vendor. After careful review of your application 
      for ${data.businessName}, we regret to inform you that we are unable to approve your vendor account at this time.
      
      Reason for Rejection:
      ${data.rejectionReason}
      
      What You Can Do:
      - Address the concerns mentioned above
      - Update your application with additional information
      - Reapply once you've made the necessary changes
      - Contact our support team for clarification
      
      We encourage you to address the concerns mentioned and consider reapplying in the future. 
      Our team is here to help you succeed.
      
      Reapply: ${process.env.NEXT_PUBLIC_APP_URL}/auth/register
      
      If you have any questions about this decision, please contact our support team.
      
      © 2026 Reliance. All rights reserved.
    `
  };

  console.log('Sending vendor rejection email:', {
    to: data.vendorEmail,
    subject: emailContent.subject,
    businessName: data.businessName,
    rejectedBy: data.adminName,
    rejectionDate: data.approvalDate,
    rejectionReason: data.rejectionReason,
  });

  // TODO: Implement actual email sending
  // await emailService.send(emailContent);
  
  return { success: true, messageId: 'mock-email-id' };
}

export async function sendAdminNotificationEmail(data: AdminNotificationEmailData) {
  const actionText = data.action === 'approved' ? 'approved' : 'rejected';
  const actionColor = data.action === 'approved' ? '#10b981' : '#dc2626';
  
  const emailContent = {
    to: data.adminEmail,
    subject: `Vendor ${data.action === 'approved' ? 'Approved' : 'Rejected'}: ${data.businessName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">Vendor ${data.action === 'approved' ? 'Approved' : 'Rejected'}</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Action completed by ${data.adminName}</p>
        </div>
        
        <div style="padding: 30px; background: #f8fafc;">
          <h2 style="color: #1e293b; margin-bottom: 20px;">Vendor Action Completed</h2>
          
          <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 6px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #0c4a6e; margin: 0 0 10px 0;">Action Details:</h3>
            <ul style="color: #0369a1; margin: 0; padding-left: 20px;">
              <li><strong>Vendor:</strong> ${data.vendorName} (${data.businessName})</li>
              <li><strong>Action:</strong> ${actionText}</li>
              <li><strong>Admin:</strong> ${data.adminName}</li>
              <li><strong>Date:</strong> ${new Date().toLocaleDateString()}</li>
              ${data.rejectionReason ? `<li><strong>Reason:</strong> ${data.rejectionReason}</li>` : ''}
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/vendors" 
               style="background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
              View Vendor Management
            </a>
          </div>
        </div>
        
        <div style="background: #1e293b; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p style="margin: 0;">© 2026 Reliance. All rights reserved.</p>
        </div>
      </div>
    `,
    text: `
      Vendor ${data.action === 'approved' ? 'Approved' : 'Rejected'}
      
      Vendor Action Completed
      
      Action Details:
      - Vendor: ${data.vendorName} (${data.businessName})
      - Action: ${actionText}
      - Admin: ${data.adminName}
      - Date: ${new Date().toLocaleDateString()}
      ${data.rejectionReason ? `- Reason: ${data.rejectionReason}` : ''}
      
      View Vendor Management: ${process.env.NEXT_PUBLIC_APP_URL}/admin/vendors
      
      © 2026 Reliance. All rights reserved.
    `
  };

  console.log('Sending admin notification email:', {
    to: data.adminEmail,
    subject: emailContent.subject,
    vendorName: data.vendorName,
    businessName: data.businessName,
    action: data.action,
    adminName: data.adminName,
  });

  // TODO: Implement actual email sending
  // await emailService.send(emailContent);
  
  return { success: true, messageId: 'mock-email-id' };
}

export async function sendNewVendorNotificationEmail(vendorData: any, adminEmails: string[]) {
  const emailContent = {
    to: adminEmails,
    subject: `New Vendor Registration: ${vendorData.businessName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%); color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">New Vendor Registration</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Requires admin review</p>
        </div>
        
        <div style="padding: 30px; background: #f8fafc;">
          <h2 style="color: #1e293b; margin-bottom: 20px;">New Vendor Application</h2>
          
          <div style="background: #fffbeb; border: 1px solid #f59e0b; border-radius: 6px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #92400e; margin: 0 0 15px 0;">Vendor Information:</h3>
            <div style="color: #78350f; line-height: 1.6;">
              <p><strong>Business Name:</strong> ${vendorData.businessName}</p>
              <p><strong>Contact Person:</strong> ${vendorData.firstName} ${vendorData.lastName}</p>
              <p><strong>Email:</strong> ${vendorData.email}</p>
              <p><strong>Phone:</strong> ${vendorData.phone}</p>
              <p><strong>Category:</strong> ${vendorData.category}</p>
              <p><strong>Business Type:</strong> ${vendorData.businessType}</p>
              <p><strong>Years in Business:</strong> ${vendorData.yearsInBusiness}</p>
              <p><strong>Employees:</strong> ${vendorData.totalEmployees}</p>
              <p><strong>Location:</strong> ${vendorData.city}, ${vendorData.state}</p>
            </div>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/vendors/approval-queue" 
               style="background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
              Review Application
            </a>
          </div>
          
          <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
            This vendor application requires your review and approval before they can access the platform.
          </p>
        </div>
        
        <div style="background: #1e293b; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p style="margin: 0;">© 2026 Reliance. All rights reserved.</p>
        </div>
      </div>
    `,
    text: `
      New Vendor Registration
      
      New Vendor Application
      
      Vendor Information:
      - Business Name: ${vendorData.businessName}
      - Contact Person: ${vendorData.firstName} ${vendorData.lastName}
      - Email: ${vendorData.email}
      - Phone: ${vendorData.phone}
      - Category: ${vendorData.category}
      - Business Type: ${vendorData.businessType}
      - Years in Business: ${vendorData.yearsInBusiness}
      - Employees: ${vendorData.totalEmployees}
      - Location: ${vendorData.city}, ${vendorData.state}
      
      Review Application: ${process.env.NEXT_PUBLIC_APP_URL}/admin/vendors/approval-queue
      
      This vendor application requires your review and approval before they can access the platform.
      
      © 2026 Reliance. All rights reserved.
    `
  };

  console.log('Sending new vendor notification email:', {
    to: adminEmails,
    subject: emailContent.subject,
    businessName: vendorData.businessName,
    vendorEmail: vendorData.email,
  });

  // TODO: Implement actual email sending
  // await emailService.send(emailContent);
  
  return { success: true, messageId: 'mock-email-id' };
} 
