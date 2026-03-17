/**
 * Seed: Messaging Services, Templates, and Event Mappings
 *
 * Run: npm run seed:messaging
 *
 * This seeds:
 * 1. Three placeholder messaging services (WhatsApp Meta, SMS MSG91, Email SMTP)
 * 2. Eleven message templates (buyer / agent / admin for key events)
 * 3. Event → template mappings for:
 *      lead_created           → buyer + agent + admin
 *      lead_status_updated    → buyer + agent
 *      inquiry_created        → agent + admin
 *      property_approved      → owner
 *      site_visit_scheduled   → buyer + agent
 *
 * All API credentials are left as empty strings — fill them in from Admin → Messaging → Services.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import { MessageService, MessageChannel, MessageProvider } from '../../modules/messaging/entities/message-service.entity';
import { MessageTemplate } from '../../modules/messaging/entities/message-template.entity';
import { EventTemplateMapping, SystemEvent, RecipientType } from '../../modules/messaging/entities/event-template-mapping.entity';
import { MessageLog } from '../../modules/messaging/entities/message-log.entity';

const dataSource = new DataSource({
  type: 'mysql',
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'realestate_db',
  entities: [MessageService, MessageTemplate, EventTemplateMapping, MessageLog],
  synchronize: true,
});

async function seedMessaging() {
  await dataSource.initialize();
  console.log('✅ DB connected');

  const svcRepo     = dataSource.getRepository(MessageService);
  const tplRepo     = dataSource.getRepository(MessageTemplate);
  const mapRepo     = dataSource.getRepository(EventTemplateMapping);

  // ── STEP 1: Clear existing seed data (idempotent) ────────────────────────

  console.log('🧹 Clearing existing messaging seed data…');
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
  await dataSource.query('TRUNCATE TABLE `event_template_mappings`');
  await dataSource.query('TRUNCATE TABLE `message_templates`');
  await dataSource.query('TRUNCATE TABLE `message_services`');
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('   Cleared event_template_mappings, message_templates, message_services');

  // ── STEP 2: Messaging Services ────────────────────────────────────────────

  console.log('\n📡 Seeding messaging services…');

  const [wa, sms, email] = await svcRepo.save([
    {
      name:     'WhatsApp Meta (Business API)',
      channel:  MessageChannel.WHATSAPP,
      provider: MessageProvider.META,
      isActive: false, // set to true after adding real API key in Admin
      config: {
        apiKey:             '',   // Fill in: Bearer token from Meta Developer Console
        phoneNumberId:      '',   // Fill in: Phone Number ID from WhatsApp Business Account
        templateNamespace:  '',   // Optional: namespace for template-based messages
      },
    },
    {
      name:     'SMS MSG91',
      channel:  MessageChannel.SMS,
      provider: MessageProvider.MSG91,
      isActive: false,
      config: {
        type:       'msg91',
        authKey:    '',   // Fill in: MSG91 Auth Key
        senderId:   'THINKB',
        templateId: '',   // Fill in: DLT approved template ID
      },
    },
    {
      name:     'Email SMTP (Gmail / Custom)',
      channel:  MessageChannel.EMAIL,
      provider: MessageProvider.SMTP,
      isActive: false,
      config: {
        type:   'smtp',
        host:   'smtp.gmail.com',
        port:   '587',
        secure: 'false',
        user:   '',  // Fill in: SMTP username / Gmail address
        pass:   '',  // Fill in: App password
        from:   'no-reply@think4buysale.com',
      },
    },
  ]);

  console.log(`   ✓ WhatsApp Meta  (id: ${wa.id})`);
  console.log(`   ✓ SMS MSG91      (id: ${sms.id})`);
  console.log(`   ✓ Email SMTP     (id: ${email.id})`);

  // ── STEP 3: Message Templates ─────────────────────────────────────────────

  console.log('\n📝 Seeding message templates…');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EVENT: lead_created
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const tpl_buyer_lead_wa = await tplRepo.save({
    name:                'buyer_lead_created_whatsapp',
    description:         'Sent to buyer via WhatsApp immediately after inquiry is captured',
    channel:             MessageChannel.WHATSAPP,
    providerTemplateName: 'buyer_inquiry_received', // Pre-approve this name on Meta Business Manager
    body: `Hi {{name}},

Thank you for your inquiry! 🏠

We've received your request and our property expert will contact you within 24 hours.

📋 *Details we received:*
• Source: {{source}}
• Your phone: {{phone}}

Stay tuned — great properties are waiting for you!

— Think4BuySale Team`,
    variables: ['name', 'source', 'phone'],
    serviceId: wa.id,
    isActive:  true,
  });

  const tpl_buyer_lead_sms = await tplRepo.save({
    name:        'buyer_lead_created_sms',
    description: 'Sent to buyer via SMS after inquiry captured',
    channel:     MessageChannel.SMS,
    body:        `Hi {{name}}, your property inquiry has been received. Our agent will call you shortly. - Think4BuySale`,
    variables:   ['name'],
    serviceId:   sms.id,
    isActive:    true,
  });

  const tpl_agent_lead_wa = await tplRepo.save({
    name:                'agent_lead_created_whatsapp',
    description:         'Notifies agent via WhatsApp when a new lead is assigned to them',
    channel:             MessageChannel.WHATSAPP,
    providerTemplateName: 'agent_new_lead_alert',
    body: `🔔 *New Lead Assigned!*

Hello Agent,

A new {{temperature}} lead has been assigned to you.

👤 *Buyer Details:*
• Name: {{name}}
• Phone: {{phone}}
• Email: {{email}}

📍 *Source:* {{source}}
🏠 *Property ID:* {{property_title}}

Please follow up within 2 hours for best conversion.

Login to dashboard to view full details.
— Think4BuySale CRM`,
    variables: ['temperature', 'name', 'phone', 'email', 'source', 'property_title'],
    serviceId: wa.id,
    isActive:  true,
  });

  const tpl_agent_lead_sms = await tplRepo.save({
    name:        'agent_lead_created_sms',
    description: 'Notifies agent via SMS when new lead arrives',
    channel:     MessageChannel.SMS,
    body:        `New lead alert! {{name}} ({{phone}}) enquired about a property. Login to CRM to follow up. - Think4BuySale`,
    variables:   ['name', 'phone'],
    serviceId:   sms.id,
    isActive:    true,
  });

  const tpl_agent_lead_email = await tplRepo.save({
    name:        'agent_lead_created_email',
    description: 'Detailed email to agent on new lead',
    channel:     MessageChannel.EMAIL,
    subject:     'New Lead Assigned: {{name}} ({{source}})',
    body: `Hello,

A new lead has been assigned to you on Think4BuySale CRM.

━━━━━━━━━━━━━━━━━━━━━━━━
LEAD DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━
Buyer Name  : {{name}}
Phone       : {{phone}}
Email       : {{email}}
Source      : {{source}}
Temperature : {{temperature}}
Property ID : {{property_title}}
Lead Score  : {{lead_id}}

━━━━━━━━━━━━━━━━━━━━━━━━
ACTION REQUIRED
━━━━━━━━━━━━━━━━━━━━━━━━
Please follow up within 2 hours.
Early response = higher conversion!

Login to CRM → https://think4buysale.com/agent/leads

Best regards,
Think4BuySale Team`,
    variables: ['name', 'phone', 'email', 'source', 'temperature', 'property_title', 'lead_id'],
    serviceId: email.id,
    isActive:  true,
  });

  const tpl_admin_lead_email = await tplRepo.save({
    name:        'admin_lead_created_email',
    description: 'Email alert to admin when a new lead is captured',
    channel:     MessageChannel.EMAIL,
    subject:     '[New Lead] {{name}} via {{source}}',
    body: `New lead captured on Think4BuySale.

Buyer : {{name}}
Phone : {{phone}}
Source: {{source}}
Score : (auto-scored)

View in Admin: https://think4buysale.com/admin/leads`,
    variables: ['name', 'phone', 'source'],
    serviceId: email.id,
    isActive:  true,
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EVENT: lead_status_updated
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const tpl_buyer_status_wa = await tplRepo.save({
    name:                'buyer_lead_status_updated_whatsapp',
    description:         'WhatsApp update to buyer when agent changes their lead status',
    channel:             MessageChannel.WHATSAPP,
    providerTemplateName: 'buyer_status_update',
    body: `Hi {{name}},

Your property inquiry has been updated! 📬

*Status:* {{new_status}}

{{notes}}

If you have any questions, reply to this message or call us.

— Think4BuySale Team`,
    variables: ['name', 'new_status', 'notes'],
    serviceId: wa.id,
    isActive:  true,
  });

  const tpl_agent_status_sms = await tplRepo.save({
    name:        'agent_lead_status_updated_sms',
    description: 'SMS reminder to agent to follow up after status change',
    channel:     MessageChannel.SMS,
    body:        `Lead update: {{name}}'s status changed to {{new_status}}. Login to add notes. - Think4BuySale`,
    variables:   ['name', 'new_status'],
    serviceId:   sms.id,
    isActive:    true,
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EVENT: inquiry_created
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const tpl_agent_inquiry_wa = await tplRepo.save({
    name:                'agent_inquiry_created_whatsapp',
    description:         'Notifies agent via WhatsApp when a direct inquiry is submitted to them',
    channel:             MessageChannel.WHATSAPP,
    providerTemplateName: 'agent_inquiry_received',
    body: `📬 *New Inquiry — Action Required!*

Hello,

{{name}} just submitted a direct inquiry to you.

📞 Phone: {{phone}}
📧 Email: {{email}}

Reply directly or login to CRM.
— Think4BuySale`,
    variables: ['name', 'phone', 'email'],
    serviceId: wa.id,
    isActive:  true,
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EVENT: property_approved
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const tpl_owner_approved_wa = await tplRepo.save({
    name:                'owner_property_approved_whatsapp',
    description:         'WhatsApp message to property owner when their listing goes live',
    channel:             MessageChannel.WHATSAPP,
    providerTemplateName: 'property_approved_owner',
    body: `🎉 *Your Property is Now LIVE!*

Hi {{name}},

Great news! Your property listing has been approved and is now visible to buyers on Think4BuySale.

🏠 Property: {{property_title}}
🔗 Share your listing and get more leads!

Login: https://think4buysale.com/owner/properties

— Think4BuySale Team`,
    variables: ['name', 'property_title'],
    serviceId: wa.id,
    isActive:  true,
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EVENT: site_visit_scheduled
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const tpl_buyer_visit_wa = await tplRepo.save({
    name:                'buyer_site_visit_scheduled_whatsapp',
    description:         'WhatsApp confirmation to buyer when site visit is scheduled',
    channel:             MessageChannel.WHATSAPP,
    providerTemplateName: 'site_visit_confirmation_buyer',
    body: `✅ *Site Visit Confirmed!*

Hi {{name}},

Your site visit has been scheduled.

📅 Date: {{visit_date}}
⏰ Time: {{visit_time}}
📍 Property: {{property_title}}

Our agent will meet you there. Save their number: {{agent_phone}}

— Think4BuySale`,
    variables: ['name', 'visit_date', 'visit_time', 'property_title', 'agent_phone'],
    serviceId: wa.id,
    isActive:  true,
  });

  const tpl_agent_visit_sms = await tplRepo.save({
    name:        'agent_site_visit_scheduled_sms',
    description: 'SMS reminder to agent about upcoming site visit',
    channel:     MessageChannel.SMS,
    body:        `Site visit scheduled: {{name}} on {{visit_date}} at {{visit_time}} for {{property_title}}. Be on time! - Think4BuySale`,
    variables:   ['name', 'visit_date', 'visit_time', 'property_title'],
    serviceId:   sms.id,
    isActive:    true,
  });

  console.log(`   ✓ buyer_lead_created_whatsapp       (id: ${tpl_buyer_lead_wa.id})`);
  console.log(`   ✓ buyer_lead_created_sms             (id: ${tpl_buyer_lead_sms.id})`);
  console.log(`   ✓ agent_lead_created_whatsapp        (id: ${tpl_agent_lead_wa.id})`);
  console.log(`   ✓ agent_lead_created_sms             (id: ${tpl_agent_lead_sms.id})`);
  console.log(`   ✓ agent_lead_created_email           (id: ${tpl_agent_lead_email.id})`);
  console.log(`   ✓ admin_lead_created_email           (id: ${tpl_admin_lead_email.id})`);
  console.log(`   ✓ buyer_lead_status_updated_whatsapp (id: ${tpl_buyer_status_wa.id})`);
  console.log(`   ✓ agent_lead_status_updated_sms      (id: ${tpl_agent_status_sms.id})`);
  console.log(`   ✓ agent_inquiry_created_whatsapp     (id: ${tpl_agent_inquiry_wa.id})`);
  console.log(`   ✓ owner_property_approved_whatsapp   (id: ${tpl_owner_approved_wa.id})`);
  console.log(`   ✓ buyer_site_visit_scheduled_whatsapp(id: ${tpl_buyer_visit_wa.id})`);
  console.log(`   ✓ agent_site_visit_scheduled_sms     (id: ${tpl_agent_visit_sms.id})`);

  // ── STEP 4: Event → Template Mappings ────────────────────────────────────

  console.log('\n🔗 Seeding event → template mappings…');

  const mappings = await mapRepo.save([
    // ── lead_created ─────────────────────────────────
    {
      event:         SystemEvent.LEAD_CREATED,
      recipientType: RecipientType.BUYER,
      templateId:    tpl_buyer_lead_wa.id,
      description:   'WhatsApp confirmation to buyer on lead capture',
      isActive:      true,
    },
    {
      event:         SystemEvent.LEAD_CREATED,
      recipientType: RecipientType.AGENT,
      templateId:    tpl_agent_lead_wa.id,
      description:   'WhatsApp alert to assigned agent on new lead',
      isActive:      true,
    },
    {
      event:         SystemEvent.LEAD_CREATED,
      recipientType: RecipientType.AGENT,
      templateId:    tpl_agent_lead_email.id,
      description:   'Detailed email to agent on new lead (full context)',
      isActive:      true,
    },
    {
      event:         SystemEvent.LEAD_CREATED,
      recipientType: RecipientType.ADMIN,
      templateId:    tpl_admin_lead_email.id,
      description:   'Admin email alert on every new lead',
      isActive:      false, // disabled by default — enable for high-volume admins
    },

    // ── lead_status_updated ───────────────────────────
    {
      event:         SystemEvent.LEAD_STATUS_UPDATED,
      recipientType: RecipientType.BUYER,
      templateId:    tpl_buyer_status_wa.id,
      description:   'Keep buyer informed when agent updates status',
      isActive:      true,
    },
    {
      event:         SystemEvent.LEAD_STATUS_UPDATED,
      recipientType: RecipientType.AGENT,
      templateId:    tpl_agent_status_sms.id,
      description:   'SMS nudge to agent after status change',
      isActive:      false, // optional — enable if agents need reminders
    },

    // ── inquiry_created ───────────────────────────────
    {
      event:         SystemEvent.INQUIRY_CREATED,
      recipientType: RecipientType.AGENT,
      templateId:    tpl_agent_inquiry_wa.id,
      description:   'WhatsApp alert to agent on direct inquiry',
      isActive:      true,
    },

    // ── property_approved ─────────────────────────────
    {
      event:         SystemEvent.PROPERTY_APPROVED,
      recipientType: RecipientType.OWNER,
      templateId:    tpl_owner_approved_wa.id,
      description:   'Notify property owner when listing is approved and goes live',
      isActive:      true,
    },

    // ── site_visit_scheduled ──────────────────────────
    {
      event:         SystemEvent.SITE_VISIT_SCHEDULED,
      recipientType: RecipientType.BUYER,
      templateId:    tpl_buyer_visit_wa.id,
      description:   'WhatsApp visit confirmation to buyer',
      isActive:      true,
    },
    {
      event:         SystemEvent.SITE_VISIT_SCHEDULED,
      recipientType: RecipientType.AGENT,
      templateId:    tpl_agent_visit_sms.id,
      description:   'SMS reminder to agent about visit',
      isActive:      true,
    },
  ]);

  console.log(`   ✓ ${mappings.length} event mappings created`);

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log(`
╔════════════════════════════════════════════════════╗
║         MESSAGING SEED COMPLETE                    ║
╠════════════════════════════════════════════════════╣
║  Services  : 3 (WhatsApp, SMS, Email)              ║
║  Templates : 12 templates across all channels      ║
║  Mappings  : 10 event → recipient → template rules ║
╠════════════════════════════════════════════════════╣
║  ⚠️  IMPORTANT: Services are disabled by default.  ║
║  Go to Admin → Messaging → Services                ║
║  Add your API keys and set isActive = true          ║
╚════════════════════════════════════════════════════╝

Events wired:
  lead_created          → buyer (WA) + agent (WA + Email) + admin (Email, disabled)
  lead_status_updated   → buyer (WA) + agent (SMS, disabled)
  inquiry_created       → agent (WA)
  property_approved     → owner (WA)
  site_visit_scheduled  → buyer (WA) + agent (SMS)
`);

  await dataSource.destroy();
}

seedMessaging().catch(e => {
  console.error('Seed failed:', e);
  process.exit(1);
});
