import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { CryptoService } from "../../common/crypto/crypto.service.js";
import { AiService } from "./ai.service.js";
import { PropertyService } from "../property/property.service.js";
import { BuildingService, type UnitUse } from "../property/building.service.js";
import { TenancyService } from "../tenancy/tenancy.service.js";
import { OriginationService } from "../tenancy/origination.service.js";
import { CloseoutService } from "../tenancy/closeout.service.js";
import { RenewalService } from "../tenancy/renewal.service.js";
import { ConditionService } from "../condition/condition.service.js";
import { ScopeService } from "../scope/scope.service.js";
import { NdpaService } from "../ndpa/ndpa.service.js";
import { StatementService } from "../information/statement.service.js";
import { ActionService } from "../action/action.service.js";
import { ControlsService } from "../../common/controls/controls.service.js";
import { NoticesService } from "../notices/notices.service.js";
import { MaintenanceService } from "../maintenance/maintenance.service.js";
import { PaymentsService } from "../payments/payments.service.js";
import { DocumentsService } from "../documents/documents.service.js";
import { env } from "../../common/config/env.js";
import { readAmount, readContact, normalizePhone, displayPhone } from "./chat-input.util.js";
import type { NotifyResult } from "../tenancy/tenancy.service.js";

export type OutMsg =
  | { type: "text"; text: string }
  | { type: "buttons"; text: string; buttons: { id: string; title: string }[] }
  | { type: "list"; text: string; button: string; items: { id: string; title: string; description?: string }[] };

interface Inbound {
  text?: string;
  replyId?: string;
}

/**
 * WhatsApp conversation engine (PRD §24, Phase 2). Landlords run their properties by chat:
 * the AI understands plain language, the engine runs guided flows and calls the same API
 * commands as the app. The AI converses; it never decides (BP-11, SECU-13). Signing, payee
 * changes and higher-risk approvals hand off to a secure page (not built into this flow yet).
 */
@Injectable()
export class ConversationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly ai: AiService,
    private readonly properties: PropertyService,
    private readonly buildings: BuildingService,
    private readonly tenancies: TenancyService,
    private readonly origination: OriginationService,
    private readonly closeout: CloseoutService,
    private readonly renewals: RenewalService,
    private readonly condition: ConditionService,
    private readonly scope: ScopeService,
    private readonly ndpa: NdpaService,
    private readonly statements: StatementService,
    private readonly actions: ActionService,
    private readonly controls: ControlsService,
    private readonly notices: NoticesService,
    private readonly maintenance: MaintenanceService,
    private readonly payments: PaymentsService,
    private readonly documents: DocumentsService,
  ) {}

  async handle(address: string, input: Inbound): Promise<{ messages: OutMsg[] }> {
    await this.log(address, "in", input.text ?? `[${input.replyId}]`);

    // The whole channel fails closed behind its control (BP-08). Nothing runs when it's off.
    if (!(await this.controls.isEnabled("channel.whatsapp"))) {
      const text = "Kiataker on WhatsApp is temporarily unavailable. Please try again shortly.";
      await this.log(address, "out", text);
      return { messages: [{ type: "text", text }] };
    }

    const { participant, isNew } = await this.resolveParticipant(address);
    const session = await this.loadSession(address, participant.id);

    const messages: OutMsg[] = [];
    if (isNew) {
      messages.push({
        type: "text",
        text: `Hello 👋 I'm Kiataker. Welcome ${participant.displayName}. Your account is ready and your details are confirmed.`,
      });
    }

    const command = input.replyId ?? "";
    const text = input.text ?? "";

    // Global commands always available.
    if (command === "menu" || /^menu$/i.test(text) || command === "cancel") {
      await this.setSession(address, participant.id, null, null, {});
      messages.push(this.menu());
      return this.finish(address, messages);
    }

    // Continue an active flow.
    if (session.flow) {
      const out = await this.continueFlow(address, participant.id, session, input);
      messages.push(...out);
      return this.finish(address, messages);
    }

    // No active flow: understand the intent and start one. Free text goes through the AI
    // (a constrained LLM when configured, deterministic rules otherwise); a button id is used as-is.
    const intent = command || (await this.ai.classifyMessage(text));
    switch (intent) {
      case "greeting":
        if (!isNew) messages.push({ type: "text", text: `Welcome back, ${participant.displayName}.` });
        messages.push(this.menu());
        break;
      case "add_property":
        await this.setSession(address, participant.id, "add_property", "address", {});
        messages.push({ type: "text", text: "Let's add a property. What is the property address?" });
        break;
      case "record_tenancy":
        return this.finish(address, [...messages, ...(await this.startRecordTenancy(address, participant.id))]);
      case "send_notice":
        return this.finish(address, [...messages, ...(await this.startSendNotice(address, participant.id))]);
      case "new_tenancy":
        return this.finish(address, [...messages, ...(await this.startNewTenancy(address, participant.id))]);
      case "my_originations":
        return this.finish(address, [...messages, ...(await this.startMyOriginations(address, participant.id))]);
      case "draft_agreement":
        return this.finish(address, [...messages, ...(await this.startDraftAgreement(address, participant.id))]);
      case "end_tenancy":
        return this.finish(address, [...messages, ...(await this.startEndTenancy(address, participant.id))]);
      case "my_closeouts":
        return this.finish(address, [...messages, ...(await this.startMyCloseouts(address, participant.id))]);
      case "condition_check":
        return this.finish(address, [...messages, ...(await this.startConditionCheck(address, participant.id))]);
      case "renewals":
        return this.finish(address, [...messages, ...(await this.startRenewals(address, participant.id))]);
      case "scope":
        return this.finish(address, [...messages, ...(await this.startScope(address, participant.id))]);
      case "my_data":
        return this.finish(address, [...messages, ...(await this.startMyData(address, participant.id))]);
      case "buildings":
        return this.finish(address, [...messages, ...(await this.startBuildings(address, participant.id))]);
      case "my_statement":
        messages.push(...(await this.showStatement(participant.id)));
        break;
      case "report_issue":
        return this.finish(address, [...messages, ...(await this.startReportIssue(address, participant.id))]);
      case "my_issues":
        return this.finish(address, [...messages, ...(await this.startMyIssues(address, participant.id))]);
      case "collect_rent":
        return this.finish(address, [...messages, ...(await this.startCollectRent(address, participant.id))]);
      case "my_actions":
        messages.push(...(await this.showActions(participant.id)));
        break;
      case "my_properties":
        messages.push(...(await this.showProperties(participant.id)));
        break;
      case "human":
        messages.push({ type: "text", text: "No problem. I'm connecting you to our Customer Support team, a person will reach out to you shortly." });
        break;
      case "help":
        messages.push({ type: "text", text: "I can help you add a property, record a tenancy, see what needs your decision, and more. Tap Menu to begin." });
        messages.push(this.menu());
        break;
      default:
        messages.push({ type: "text", text: "I'm not sure I got that, but I can help. Here is what I can do:" });
        messages.push(this.menu());
    }
    return this.finish(address, messages);
  }

  // ---- Flows ----

  private async continueFlow(address: string, participantId: string, session: { flow: string | null; step: string | null; data: any }, input: Inbound): Promise<OutMsg[]> {
    const data = session.data ?? {};
    const text = (input.text ?? "").trim();
    const reply = input.replyId ?? "";

    if (session.flow === "add_property") {
      if (session.step === "address") {
        if (!text) return [{ type: "text", text: "Please send the property address." }];
        data.addressRaw = text;
        await this.setSession(address, participantId, "add_property", "use", data);
        return [{
          type: "buttons",
          text: `Got it: "${text}". Is it residential, commercial or mixed use?`,
          buttons: [
            { id: "use:RESIDENTIAL", title: "Residential" },
            { id: "use:COMMERCIAL", title: "Commercial" },
            { id: "use:MIXED_USE", title: "Mixed use" },
          ],
        }];
      }
      if (session.step === "use") {
        const use = reply.startsWith("use:") ? reply.slice(4) : this.ai.extractBuildingUse(text);
        if (!use) return [{ type: "text", text: "Please choose residential, commercial or mixed use." }];
        const prop = await this.properties.create(participantId, { addressRaw: data.addressRaw, buildingUse: use, acceptMandate: true });
        await this.setSession(address, participantId, null, null, {});
        return [
          { type: "text", text: `✅ Property File created (${prop.reference}). Management has started. You're all set.` },
          this.menu(),
        ];
      }
    }

    if (session.flow === "record_tenancy") {
      if (session.step === "property") {
        const propId = reply.startsWith("prop:") ? reply.slice(5) : null;
        if (!propId) return [{ type: "text", text: "Please choose a property from the list." }];
        data.propertyId = propId;
        await this.setSession(address, participantId, "record_tenancy", "tenant", data);
        return [{ type: "text", text: "Who is the tenant? Send their full name." }];
      }
      if (session.step === "tenant") {
        if (!text) return [{ type: "text", text: "Please send the tenant's name." }];
        data.tenantName = text;
        await this.setSession(address, participantId, "record_tenancy", "contact", data);
        return [{ type: "text", text: `What is ${text}'s WhatsApp number? I'll message them to confirm the details. For example 0803 123 4567. If they don't use WhatsApp, send their email address instead.` }];
      }
      if (session.step === "contact") {
        const contact = readContact(text);
        if (!contact) return [{ type: "text", text: "Please send the tenant's WhatsApp number, for example 0803 123 4567, or their email address." }];
        if ("whatsapp" in contact && contact.whatsapp === normalizePhone(address)) {
          return [{ type: "text", text: "That's your own number. Please send the tenant's WhatsApp number, so they can confirm the details themselves." }];
        }
        data.tenantWhatsapp = "whatsapp" in contact ? contact.whatsapp : "";
        data.tenantEmail = "email" in contact ? contact.email : "";
        await this.setSession(address, participantId, "record_tenancy", "rent", data);
        return [{ type: "text", text: "What is the annual rent? Send the amount in naira, for example 1500000 or 1.5m." }];
      }
      if (session.step === "rent") {
        const amount = readAmount(text);
        if ("problem" in amount) return [{ type: "text", text: amount.problem }];
        const naira = amount.naira;
        data.rentKobo = String(naira * 100);
        await this.setSession(address, participantId, "record_tenancy", "confirm", data);
        const reach = data.tenantWhatsapp ? `on WhatsApp at ${displayPhone(data.tenantWhatsapp)}` : `by email at ${data.tenantEmail}`;
        return [{
          type: "buttons",
          text: `Please check: tenant ${data.tenantName}, annual rent ₦${naira.toLocaleString("en-NG")}. Kiataker records this as you state it, then asks the tenant ${reach} to confirm. Shall I record it?`,
          buttons: [
            { id: "confirm", title: "Yes, record it" },
            { id: "cancel", title: "Cancel" },
          ],
        }];
      }
      if (session.step === "confirm") {
        if (reply !== "confirm" && !this.isYes(text)) {
          await this.setSession(address, participantId, null, null, {});
          return [{ type: "text", text: "No problem, I have not recorded anything." }, this.menu()];
        }
        const now = new Date();
        const expiry = new Date(now.getTime());
        expiry.setFullYear(expiry.getFullYear() + 1);
        const tenancy = await this.tenancies.recordExisting(participantId, {
          propertyId: data.propertyId,
          tenant: {
            name: data.tenantName,
            ...(data.tenantWhatsapp ? { whatsapp: data.tenantWhatsapp } : {}),
            ...(data.tenantEmail ? { email: data.tenantEmail } : {}),
          },
          terms: { rentKobo: data.rentKobo, frequency: "annual", commencementDate: now.toISOString(), expiryDate: expiry.toISOString() },
          accuracyAcknowledged: true,
        });
        const out = await this.tenancies.notify(participantId, tenancy.id);
        await this.setSession(address, participantId, null, null, {});
        return [{ type: "text", text: this.tenantAskedText(data.tenantName, out.delivery, out.secureTaskToken) }, this.menu()];
      }
    }

    if (session.flow === "send_notice") {
      if (session.step === "tenancy") {
        const id = reply.startsWith("nten:") ? reply.slice(5) : null;
        if (!id) return [{ type: "text", text: "Please choose a tenancy from the list." }];
        data.tenancyId = id;
        const templates = await this.notices.listTemplates();
        await this.setSession(address, participantId, "send_notice", "template", data);
        return [{
          type: "list",
          text: "Which notice would you like to send?",
          button: "Choose notice",
          items: templates.map((t) => ({ id: `ntpl:${t.templateVersionId}`, title: t.name })),
        }];
      }
      if (session.step === "template") {
        const id = reply.startsWith("ntpl:") ? reply.slice(5) : null;
        if (!id) return [{ type: "text", text: "Please choose a notice type from the list." }];
        data.templateVersionId = id;
        await this.setSession(address, participantId, "send_notice", "confirm", data);
        return [{
          type: "buttons",
          text: "I'll prepare this notice. Authorising it is a higher-risk step, so I'll send a secure link for you to approve. Shall I prepare it?",
          buttons: [{ id: "confirm", title: "Yes, prepare it" }, { id: "cancel", title: "Cancel" }],
        }];
      }
      if (session.step === "confirm") {
        if (reply !== "confirm" && !this.isYes(text)) {
          await this.setSession(address, participantId, null, null, {});
          return [{ type: "text", text: "No problem, I have not prepared anything." }, this.menu()];
        }
        const out = await this.notices.instruct(participantId, { tenancyId: data.tenancyId, templateVersionId: data.templateVersionId });
        await this.setSession(address, participantId, null, null, {});
        const link = `${env.WEB_BASE_URL}/t/${out.secureTaskToken}`;
        return [
          { type: "text", text: `Notice prepared. To authorise it, open this secure link and approve:\n\n${link}\n\nOnce you approve, I'll dispatch it and record delivery. If electronic delivery is not confirmed, ask me for physical service.` },
          this.menu(),
        ];
      }
    }

    if (session.flow === "report_issue") {
      if (session.step === "property") {
        const propId = reply.startsWith("rprop:") ? reply.slice(6) : null;
        if (!propId) return [{ type: "text", text: "Please choose a property from the list." }];
        data.propertyId = propId;
        await this.setSession(address, participantId, "report_issue", "category", data);
        return [{
          type: "buttons",
          text: "What kind of problem is it?",
          buttons: [
            { id: "rcat:Plumbing", title: "Plumbing" },
            { id: "rcat:Electrical", title: "Electrical" },
            { id: "rcat:Other", title: "Something else" },
          ],
        }];
      }
      if (session.step === "category") {
        data.category = reply.startsWith("rcat:") ? reply.slice(5) : (text || "Other");
        await this.setSession(address, participantId, "report_issue", "description", data);
        return [{ type: "text", text: `Got it, a ${data.category.toLowerCase()} issue. Please describe what's wrong.` }];
      }
      if (session.step === "description") {
        if (!text) return [{ type: "text", text: "Please describe the problem so our team can scope it." }];
        data.description = text;
        await this.setSession(address, participantId, "report_issue", "confirm", data);
        return [{
          type: "buttons",
          text: `I'll log a ${data.category.toLowerCase()} issue: "${text}". Our team will source Quotes for you to compare. Shall I log it?`,
          buttons: [{ id: "confirm", title: "Yes, log it" }, { id: "cancel", title: "Cancel" }],
        }];
      }
      if (session.step === "confirm") {
        if (reply !== "confirm" && !this.isYes(text)) {
          await this.setSession(address, participantId, null, null, {});
          return [{ type: "text", text: "No problem, I haven't logged anything." }, this.menu()];
        }
        await this.maintenance.report(participantId, { propertyId: data.propertyId, category: data.category, description: data.description, urgency: "NORMAL" });
        await this.setSession(address, participantId, null, null, {});
        return [
          { type: "text", text: "✅ Issue logged. Our team will source Quotes and I'll bring them to you here to compare and accept. You decide; nothing goes ahead without you." },
          this.menu(),
        ];
      }
    }

    if (session.flow === "my_issues") {
      if (session.step === "select") {
        const id = reply.startsWith("issue:") ? reply.slice(6) : null;
        if (!id) return [{ type: "text", text: "Please choose an issue from the list." }];
        const issue = await this.maintenance.getIssue(participantId, id);
        data.issueId = id;
        // Work awaiting the landlord's acceptance (BP-12: only you close it).
        if (issue.work && issue.work.status === "COMPLETION_SUBMITTED") {
          data.workId = issue.work.id;
          await this.setSession(address, participantId, "my_issues", "action", data);
          return [{
            type: "buttons",
            text: `${issue.category}: ${issue.work.providerName} has completed the Work and submitted evidence. Accepting it marks it done.`,
            buttons: [{ id: `acceptw:${issue.work.id}`, title: "Accept the Work" }, { id: "cancel", title: "Not yet" }],
          }];
        }
        const open = issue.quotes.filter((q) => q.status === "SUBMITTED");
        if (open.length > 0) {
          await this.setSession(address, participantId, "my_issues", "action", data);
          return [{
            type: "buttons",
            text: `${issue.category}: ${open.length} Quote(s) to compare. Accepting one starts the Work.`,
            buttons: open.slice(0, 3).map((q) => ({ id: `acceptq:${id}:${q.id}`, title: `${q.providerName} ₦${(Number(q.amountKobo) / 100).toLocaleString()}` })),
          }];
        }
        await this.setSession(address, participantId, null, null, {});
        return [{ type: "text", text: `${issue.category}: status ${issue.status}. Nothing needs your decision on this one yet.` }, this.menu()];
      }
      if (session.step === "action") {
        if (reply.startsWith("acceptq:")) {
          const [, issueId, quoteId] = reply.split(":");
          if (!issueId || !quoteId) return [this.menu()];
          await this.maintenance.acceptQuote(participantId, issueId, quoteId);
          await this.setSession(address, participantId, null, null, {});
          return [{ type: "text", text: "✅ Quote accepted. The Work is now in progress. I'll bring you the completion to accept when it's done." }, this.menu()];
        }
        if (reply.startsWith("acceptw:")) {
          const workId = reply.slice(8);
          await this.maintenance.acceptWork(participantId, workId);
          await this.setSession(address, participantId, null, null, {});
          return [{ type: "text", text: "✅ Work accepted and closed. Thank you." }, this.menu()];
        }
        await this.setSession(address, participantId, null, null, {});
        return [{ type: "text", text: "No problem, nothing changed." }, this.menu()];
      }
    }

    if (session.flow === "collect_rent") {
      if (session.step === "tenancy") {
        const id = reply.startsWith("crten:") ? reply.slice(6) : null;
        if (!id) return [{ type: "text", text: "Please choose a tenancy from the list." }];
        await this.setSession(address, participantId, null, null, {});
        try {
          const checkout = await this.payments.createCheckout(participantId, { tenancyId: id });
          const amount = (Number(checkout.amountKobo) / 100).toLocaleString();
          const net = (Number(checkout.netKobo) / 100).toLocaleString();
          const fee = (Number(checkout.feeKobo) / 100).toLocaleString();
          return [
            { type: "text", text: `Here's a secure payment link for your tenant to pay ₦${amount}:\n\n${checkout.authorizationUrl}\n\nForward it to them. When they pay, ₦${net} settles directly to you and our ₦${fee} coordination fee comes out of the split. Kiataker never holds your money. I'll confirm once it's paid.` },
            this.menu(),
          ];
        } catch {
          return [{ type: "text", text: "There's no rent due on that tenancy right now, so there's nothing to collect." }, this.menu()];
        }
      }
    }

    if (session.flow === "new_tenancy") {
      if (session.step === "property") {
        const id = reply.startsWith("nprop:") ? reply.slice(6) : null;
        if (!id) return [{ type: "text", text: "Please choose a property from the list." }];
        data.propertyId = id;
        await this.setSession(address, participantId, "new_tenancy", "tenant", data);
        return [{ type: "text", text: "Who is the new tenant? Send their full name." }];
      }
      if (session.step === "tenant") {
        if (!text) return [{ type: "text", text: "Please send the tenant's name." }];
        data.tenantName = text;
        await this.setSession(address, participantId, "new_tenancy", "rent", data);
        return [{ type: "text", text: "What is the annual rent? Send the amount in naira, for example 1500000 or 1.5m." }];
      }
      if (session.step === "rent") {
        const amount = readAmount(text);
        if ("problem" in amount) return [{ type: "text", text: amount.problem }];
        const naira = amount.naira;
        data.rentKobo = String(naira * 100);
        await this.setSession(address, participantId, "new_tenancy", "confirm", data);
        return [{
          type: "buttons",
          text: `New tenancy for ${data.tenantName}, annual rent ₦${naira.toLocaleString()}. I'll send the tenant a link to accept the terms. Once they accept, you activate the tenancy. Shall I set it up?`,
          buttons: [{ id: "confirm", title: "Yes, set it up" }, { id: "cancel", title: "Cancel" }],
        }];
      }
      if (session.step === "confirm") {
        if (reply !== "confirm" && !this.isYes(text)) {
          await this.setSession(address, participantId, null, null, {});
          return [{ type: "text", text: "No problem, I haven't set anything up." }, this.menu()];
        }
        const now = new Date();
        const expiry = new Date(now);
        expiry.setFullYear(expiry.getFullYear() + 1);
        const out = await this.origination.start(participantId, {
          propertyId: data.propertyId,
          tenant: { name: data.tenantName },
          terms: { rentKobo: data.rentKobo, frequency: "annual", commencementDate: now.toISOString(), expiryDate: expiry.toISOString() },
        });
        await this.setSession(address, participantId, null, null, {});
        return [
          { type: "text", text: `Set up. Send your tenant this link to review and accept the terms:\n\n${out.acceptUrl}\n\nOnce they accept, open "New tenancies in progress" to activate the tenancy. Nothing goes live until you activate it.` },
          this.menu(),
        ];
      }
    }

    if (session.flow === "my_originations") {
      if (session.step === "select") {
        const id = reply.startsWith("orig:") ? reply.slice(5) : null;
        if (!id) return [{ type: "text", text: "Please choose one from the list." }];
        data.originationId = id;
        return this.showOriginationGates(address, participantId, id, data);
      }
      if (session.step === "action") {
        if (reply.startsWith("activate:")) {
          const id = reply.slice(9);
          try {
            await this.origination.activate(participantId, id);
            await this.setSession(address, participantId, null, null, {});
            return [{ type: "text", text: "✅ Tenancy activated. Occupancy has started and the rent schedule is running." }, this.menu()];
          } catch {
            return [{ type: "text", text: "That tenancy isn't ready to activate yet. The tenant still needs to accept, or the caution fee needs settling." }, this.menu()];
          }
        }
        if (reply.startsWith("waivecf:")) {
          const id = reply.slice(8);
          await this.origination.settleCautionFee(participantId, id, { waived: true });
          return this.showOriginationGates(address, participantId, id, data);
        }
        await this.setSession(address, participantId, null, null, {});
        return [this.menu()];
      }
    }

    if (session.flow === "draft_agreement") {
      if (session.step === "tenancy") {
        const id = reply.startsWith("dten:") ? reply.slice(5) : null;
        if (!id) return [{ type: "text", text: "Please choose a tenancy from the list." }];
        await this.setSession(address, participantId, null, null, {});
        const out = await this.documents.generateTenancyAgreement(participantId, id);
        return [
          { type: "text", text: `Tenancy agreement drafted and sealed (${out.reference}).\n\nYour sign link:\n${out.landlordSignUrl}\n\nTenant sign link to forward:\n${out.tenantSignUrl}\n\nAnyone can verify it here:\n${out.verifyUrl}` },
          this.menu(),
        ];
      }
    }

    if (session.flow === "end_tenancy") {
      if (session.step === "tenancy") {
        const id = reply.startsWith("eten:") ? reply.slice(5) : null;
        if (!id) return [{ type: "text", text: "Please choose a tenancy from the list." }];
        data.tenancyId = id;
        await this.setSession(address, participantId, "end_tenancy", "confirm", data);
        return [{
          type: "buttons",
          text: "This ends the tenancy and starts the caution-fee close-out. The tenant should have vacated. Shall I proceed?",
          buttons: [{ id: "confirm", title: "Yes, end it" }, { id: "cancel", title: "Cancel" }],
        }];
      }
      if (session.step === "confirm") {
        if (reply !== "confirm" && !this.isYes(text)) {
          await this.setSession(address, participantId, null, null, {});
          return [{ type: "text", text: "No problem, nothing has changed." }, this.menu()];
        }
        const c = await this.closeout.start(participantId, data.tenancyId);
        await this.setSession(address, participantId, null, null, {});
        return [
          { type: "text", text: `Tenancy ended and close-out started. Caution fee held: ₦${(Number(c.cautionFeeKobo) / 100).toLocaleString()}. Open "Close-outs in progress" to record any deductions and settle the caution fee.` },
          this.menu(),
        ];
      }
    }

    if (session.flow === "my_closeouts") {
      if (session.step === "select") {
        const id = reply.startsWith("close:") ? reply.slice(6) : null;
        if (!id) return [{ type: "text", text: "Please choose one from the list." }];
        data.closeoutId = id;
        return this.showCloseout(address, participantId, id, data);
      }
      if (session.step === "action") {
        if (reply.startsWith("settle:")) {
          const r = await this.closeout.settle(participantId, reply.slice(7));
          await this.setSession(address, participantId, null, null, {});
          const refund = (Number(r.refundKobo) / 100).toLocaleString();
          const line = r.outcome === "FORFEIT" ? "The caution fee is forfeited in full." : r.outcome === "NO_DEPOSIT" ? "There was no caution fee to settle." : `Refund due to the tenant: ₦${refund}. Return it to them directly; I've recorded it.`;
          return [{ type: "text", text: `✅ Close-out settled (${r.outcome}). ${line}` }, this.menu()];
        }
        if (reply.startsWith("deduct:")) {
          data.closeoutId = reply.slice(7);
          await this.setSession(address, participantId, "my_closeouts", "deduct_amount", data);
          return [{ type: "text", text: "How much is the deduction, in naira? For example 50000. Send 0 to go back." }];
        }
        await this.setSession(address, participantId, null, null, {});
        return [this.menu()];
      }
      if (session.step === "deduct_amount") {
        if (text.trim() === "0") return this.showCloseout(address, participantId, data.closeoutId, data);
        const amount = readAmount(text, { min: 1 });
        if ("problem" in amount) return [{ type: "text", text: `${amount.problem} Send 0 to go back.` }];
        const naira = amount.naira;
        await this.closeout.addDeduction(participantId, data.closeoutId, { reason: "Deduction", amountKobo: String(naira * 100) });
        return this.showCloseout(address, participantId, data.closeoutId, data);
      }
    }

    if (session.flow === "condition_check") {
      if (session.step === "tenancy") {
        const id = reply.startsWith("cc:") ? reply.slice(3) : null;
        if (!id) return [{ type: "text", text: "Please choose a tenancy from the list." }];
        data.tenancyId = id;
        await this.setSession(address, participantId, "condition_check", "describe", data);
        return [{ type: "text", text: "Describe the property's condition at handover in one message (you can add photos in the app later)." }];
      }
      if (session.step === "describe") {
        if (!text) return [{ type: "text", text: "Please describe the condition so the tenant can confirm it." }];
        const check = await this.condition.create(participantId, data.tenancyId, "BASELINE", [{ area: "Property", condition: "as described at handover", note: text }]);
        const sent = await this.condition.sendToTenant(participantId, check.id);
        await this.setSession(address, participantId, null, null, {});
        return [
          { type: "text", text: `Handover baseline captured. Send your tenant this link to confirm it:\n\n${sent.confirmUrl}\n\nOnce they confirm, it's the agreed baseline for move-out.` },
          this.menu(),
        ];
      }
    }

    if (session.flow === "renewals") {
      if (session.step === "select") {
        const id = reply.startsWith("rnw:") ? reply.slice(4) : null;
        if (!id) return [{ type: "text", text: "Please choose a tenancy from the list." }];
        data.tenancyId = id;
        const r = await this.renewals.runway(participantId, id);
        await this.setSession(address, participantId, "renewals", "decide", data);
        const safe = r.lastSafeNoticeDate ? new Date(r.lastSafeNoticeDate).toDateString() : "soon";
        return [{
          type: "buttons",
          text: `This tenancy expires ${r.expiryDate ? new Date(r.expiryDate).toDateString() : "soon"}. To recover possession you must serve notice by ${safe}. Renew for another year, or decline?`,
          buttons: [{ id: `renew:${id}`, title: "Renew 12 months" }, { id: `decline:${id}`, title: "Don't renew" }, { id: "cancel", title: "Later" }],
        }];
      }
      if (session.step === "decide") {
        if (reply.startsWith("renew:")) {
          const r = await this.renewals.renew(participantId, reply.slice(6), {});
          await this.setSession(address, participantId, null, null, {});
          return [{ type: "text", text: `✅ Renewed. The tenancy now runs to ${new Date(r.newExpiry).toDateString()}.` }, this.menu()];
        }
        if (reply.startsWith("decline:")) {
          const r = await this.renewals.notRenew(participantId, reply.slice(8));
          await this.setSession(address, participantId, null, null, {});
          const safe = r.lastSafeNoticeDate ? new Date(r.lastSafeNoticeDate).toDateString() : "the required date";
          return [{ type: "text", text: `Noted: not renewing. I've opened the Notice to Quit runway. Serve a notice to quit by ${safe} (tap Menu, then Send a notice). I'll track the runway to possession.` }, this.menu()];
        }
        await this.setSession(address, participantId, null, null, {});
        return [this.menu()];
      }
    }

    if (session.flow === "scope") {
      if (session.step === "property") {
        const id = reply.startsWith("scop:") ? reply.slice(5) : null;
        if (!id) return [{ type: "text", text: "Please choose a property from the list." }];
        data.propertyId = id;
        const s = await this.scope.get(participantId, id);
        const inScope = Object.entries(s.services).filter(([, on]) => on).map(([k]) => k).join(", ");
        await this.setSession(address, participantId, "scope", "preset", data);
        return [{
          type: "buttons",
          text: `Currently in scope: ${inScope || "none"}. Choose what Kiataker manages for this property.`,
          buttons: [{ id: `somfull:${id}`, title: "Full management" }, { id: `somrent:${id}`, title: "Rent only" }, { id: "cancel", title: "Leave as is" }],
        }];
      }
      if (session.step === "preset") {
        if (reply.startsWith("somfull:")) {
          await this.scope.set(participantId, reply.slice(8), { rentCollection: true, maintenance: true, notices: true, inspections: true, renewals: true });
          await this.setSession(address, participantId, null, null, {});
          return [{ type: "text", text: "✅ Scope set to full management: rent, maintenance, notices, inspections and renewals." }, this.menu()];
        }
        if (reply.startsWith("somrent:")) {
          await this.scope.set(participantId, reply.slice(8), { rentCollection: true, maintenance: false, notices: false, inspections: false, renewals: false });
          await this.setSession(address, participantId, null, null, {});
          return [{ type: "text", text: "✅ Scope set to rent collection only. I won't coordinate maintenance, notices, inspections or renewals for this property." }, this.menu()];
        }
        await this.setSession(address, participantId, null, null, {});
        return [{ type: "text", text: "No change made." }, this.menu()];
      }
    }

    if (session.flow === "my_data") {
      if (session.step === "choose") {
        if (reply === "dsr_access" || reply === "dsr_erase") {
          const kind = reply === "dsr_erase" ? "ERASURE" : "ACCESS";
          let res;
          try {
            res = await this.ndpa.raise(participantId, kind, participantId);
          } catch {
            await this.setSession(address, participantId, null, null, {});
            return [{ type: "text", text: "Data requests are temporarily unavailable. Please try again shortly, or tap Talk to a person." }, this.menu()];
          }
          await this.setSession(address, participantId, null, null, {});
          const link = res.token ? `${res.confirmUrl}\n\n(dev token: ${res.token})` : res.confirmUrl;
          const lead =
            kind === "ERASURE"
              ? `I've logged your erasure request (${res.reference}). To protect your data, open this secure link to confirm it is really you. Erasure cannot be undone.`
              : `I've logged your access request (${res.reference}). Open this secure link to confirm it is really you, then your copy appears there.`;
          return [{ type: "text", text: `${lead}\n\n${link}` }, this.menu()];
        }
        await this.setSession(address, participantId, null, null, {});
        return [{ type: "text", text: "No problem, no request made." }, this.menu()];
      }
    }

    if (session.flow === "building") {
      if (session.step === "address") {
        if (!text?.trim() || text.trim().length < 5) return [{ type: "text", text: "Please send the full building address." }];
        const b = await this.buildings.create(participantId, text.trim());
        data.buildingId = b.id;
        await this.setSession(address, participantId, "building", "unit", data);
        return [this.unitButtons(`Building ${b.reference} created. Add its units one at a time.`)];
      }
      if (session.step === "unit") {
        if (reply.startsWith("bunit:")) {
          const use = reply.slice(6) as UnitUse;
          const res = await this.buildings.addUnit(participantId, data.buildingId, { unitUse: use });
          const b = res.building;
          const mix = b.mixedUse ? "This building is now mixed-use (residential and commercial)." : `This building is ${b.use.toLowerCase()}.`;
          await this.setSession(address, participantId, "building", "unit", data);
          return [this.unitButtons(`Added ${res.unit.unitUse} unit. ${b.unitCount} unit(s): ${b.residentialCount} residential, ${b.commercialCount} commercial. ${mix}`)];
        }
        if (reply === "bfinish") {
          const b = await this.buildings.view(participantId, data.buildingId);
          await this.setSession(address, participantId, null, null, {});
          const lines = b.units.map((u) => `• ${u.label}: ${u.unitUse} (${u.regime.toLowerCase()} regime)`).join("\n");
          const mix = b.mixedUse ? "\n\nThis is a mixed-use building. Flats follow residential rules; shops and offices follow their commercial lease." : "";
          return [{ type: "text", text: `${b.reference} · ${b.addressRaw}\nUse: ${b.use}\n\n${lines || "No units added."}${mix}` }, this.menu()];
        }
        return [this.unitButtons("Add another unit, or tap Finish.")];
      }
    }

    // Unknown state: reset.
    await this.setSession(address, participantId, null, null, {});
    return [this.menu()];
  }

  private unitButtons(text: string): OutMsg {
    return {
      type: "buttons",
      text,
      buttons: [{ id: "bunit:RESIDENTIAL", title: "Add a flat" }, { id: "bunit:SHOP", title: "Add a shop" }, { id: "bfinish", title: "Finish" }],
    };
  }

  private async startBuildings(address: string, participantId: string): Promise<OutMsg[]> {
    const existing = await this.buildings.listForLandlord(participantId);
    await this.setSession(address, participantId, "building", "address", {});
    const lead =
      existing.length > 0
        ? `You have ${existing.length} building(s). Let's set up another one with more than one unit, for example flats and shops together. What is the building address?`
        : "Let's set up a building with more than one unit, for example flats and shops together. What is the building address?";
    return [{ type: "text", text: lead }];
  }

  private async startMyData(address: string, participantId: string): Promise<OutMsg[]> {
    await this.setSession(address, participantId, "my_data", "choose", {});
    return [{
      type: "buttons",
      text: "Your data rights under the NDPA. You can get a copy of the data Kiataker holds about you, or ask us to erase it. We confirm your identity on a secure link first.",
      buttons: [{ id: "dsr_access", title: "Get my data" }, { id: "dsr_erase", title: "Erase my data" }, { id: "cancel", title: "Not now" }],
    }];
  }

  private async startScope(address: string, participantId: string): Promise<OutMsg[]> {
    const props = await this.properties.listForLandlord(participantId);
    if (props.length === 0) {
      return [{ type: "text", text: "You don't have a property yet. Add one, then you can set what Kiataker manages for it." }, this.menu()];
    }
    await this.setSession(address, participantId, "scope", "property", {});
    return [{
      type: "list",
      text: "Which property's scope of management?",
      button: "Choose property",
      items: props.slice(0, 10).map((p) => ({ id: `scop:${p.id}`, title: p.reference, description: p.addressRaw })),
    }];
  }

  private async startRenewals(address: string, participantId: string): Promise<OutMsg[]> {
    const window = await this.renewals.window(participantId);
    if (window.length === 0) {
      return [{ type: "text", text: "No tenancies are due for a renewal decision right now. I'll flag them as expiry approaches." }, this.menu()];
    }
    await this.setSession(address, participantId, "renewals", "select", {});
    return [{
      type: "list",
      text: "Tenancies with a renewal decision due. Choose one.",
      button: "Choose tenancy",
      items: window.slice(0, 10).map((w) => ({ id: `rnw:${w.tenancyId}`, title: w.tenant ?? "Tenant", description: `expires ${w.expiryDate ? new Date(w.expiryDate).toLocaleDateString() : "soon"}` })),
    }];
  }

  private async startConditionCheck(address: string, participantId: string): Promise<OutMsg[]> {
    const tenancies = await this.listLandlordTenancies(participantId);
    if (tenancies.length === 0) {
      return [{ type: "text", text: "You don't have a tenancy on record yet. Record or set one up first, then I can capture its handover condition." }, this.menu()];
    }
    await this.setSession(address, participantId, "condition_check", "tenancy", {});
    return [{
      type: "list",
      text: "Which tenancy is the condition check for?",
      button: "Choose tenancy",
      items: tenancies.map((t) => ({ id: `cc:${t.id}`, title: t.tenantName, description: t.address })),
    }];
  }

  private async showCloseout(address: string, participantId: string, id: string, data: any): Promise<OutMsg[]> {
    const c = await this.closeout.view(participantId, id);
    if (c.status === "SETTLED") {
      await this.setSession(address, participantId, null, null, {});
      return [{ type: "text", text: `This close-out is settled (${c.outcome}).` }, this.menu()];
    }
    await this.setSession(address, participantId, "my_closeouts", "action", data);
    const caution = (Number(c.cautionFeeKobo) / 100).toLocaleString();
    const ded = (Number(c.deductionsKobo) / 100).toLocaleString();
    const refund = (Number(c.refundKobo) / 100).toLocaleString();
    return [{
      type: "buttons",
      text: `Caution fee ₦${caution}, deductions ₦${ded}. Outcome if settled now: ${c.outcome} (refund ₦${refund}).`,
      buttons: [{ id: `settle:${id}`, title: "Settle now" }, { id: `deduct:${id}`, title: "Add a deduction" }, { id: "cancel", title: "Later" }],
    }];
  }

  private async startEndTenancy(address: string, participantId: string): Promise<OutMsg[]> {
    const tenancies = await this.listLandlordTenancies(participantId);
    if (tenancies.length === 0) {
      return [{ type: "text", text: "You don't have a tenancy on record to end." }, this.menu()];
    }
    await this.setSession(address, participantId, "end_tenancy", "tenancy", {});
    return [{
      type: "list",
      text: "Which tenancy is ending?",
      button: "Choose tenancy",
      items: tenancies.map((t) => ({ id: `eten:${t.id}`, title: t.tenantName, description: t.address })),
    }];
  }

  private async startMyCloseouts(address: string, participantId: string): Promise<OutMsg[]> {
    const list = await this.closeout.listForOwner(participantId);
    const open = list.filter((c) => c.status === "OPEN");
    if (open.length === 0) {
      return [{ type: "text", text: "You have no close-outs in progress. Tap Menu, then End a tenancy." }, this.menu()];
    }
    await this.setSession(address, participantId, "my_closeouts", "select", {});
    return [{
      type: "list",
      text: "Close-outs in progress. Choose one to record deductions or settle.",
      button: "Choose close-out",
      items: open.map((c) => ({ id: `close:${c.id}`, title: c.tenant ?? "Tenant", description: c.property ?? "" })),
    }];
  }

  private async startDraftAgreement(address: string, participantId: string): Promise<OutMsg[]> {
    const tenancies = await this.listLandlordTenancies(participantId);
    if (tenancies.length === 0) {
      return [{ type: "text", text: "You don't have a tenancy on record yet. Record or set one up first, then I can draft its agreement." }, this.menu()];
    }
    await this.setSession(address, participantId, "draft_agreement", "tenancy", {});
    return [{
      type: "list",
      text: "Which tenancy is the agreement for?",
      button: "Choose tenancy",
      items: tenancies.map((t) => ({ id: `dten:${t.id}`, title: t.tenantName, description: t.address })),
    }];
  }

  private async showOriginationGates(address: string, participantId: string, id: string, data: any): Promise<OutMsg[]> {
    const g = await this.origination.gates(participantId, id);
    if (g.status === "ACTIVATED") {
      await this.setSession(address, participantId, null, null, {});
      return [{ type: "text", text: "This tenancy is already active." }, this.menu()];
    }
    const pending: string[] = [];
    if (!g.gates.tenantAccepted) pending.push("the tenant hasn't accepted yet");
    if (!g.gates.cautionFeeSettled) pending.push("the caution fee isn't settled");
    await this.setSession(address, participantId, "my_originations", "action", data);
    if (g.ready) {
      return [{
        type: "buttons",
        text: "Every gate is green. You can activate this tenancy now.",
        buttons: [{ id: `activate:${id}`, title: "Activate tenancy" }, { id: "cancel", title: "Not yet" }],
      }];
    }
    const buttons = [{ id: "cancel", title: "Back" }];
    if (!g.gates.cautionFeeSettled) buttons.unshift({ id: `waivecf:${id}`, title: "Waive caution fee" });
    return [{ type: "buttons", text: `Not ready yet: ${pending.join(", ")}.`, buttons }];
  }

  private async startSendNotice(address: string, participantId: string): Promise<OutMsg[]> {
    const tenancies = await this.listLandlordTenancies(participantId);
    if (tenancies.length === 0) {
      return [{ type: "text", text: "You don't have a tenancy on record yet. Add a property and record a tenancy first, then I can send a notice." }, this.menu()];
    }
    await this.setSession(address, participantId, "send_notice", "tenancy", {});
    return [{
      type: "list",
      text: "Which tenancy is the notice for?",
      button: "Choose tenancy",
      items: tenancies.map((t) => ({ id: `nten:${t.id}`, title: t.tenantName, description: t.address })),
    }];
  }

  private async listLandlordTenancies(participantId: string): Promise<{ id: string; tenantName: string; address: string }[]> {
    const props = await this.properties.listForLandlord(participantId);
    const propIds = props.map((p) => p.id);
    if (propIds.length === 0) return [];
    const tenancies = await this.prisma.tenancy.findMany({
      where: { propertyId: { in: propIds } },
      include: { participants: { include: { tenantProfile: true } }, property: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    return tenancies.map((t) => ({
      id: t.id,
      tenantName: t.participants[0]?.tenantProfile.name ?? "Tenant",
      address: t.property.addressRaw,
    }));
  }

  private async startNewTenancy(address: string, participantId: string): Promise<OutMsg[]> {
    const props = await this.properties.listForLandlord(participantId);
    if (props.length === 0) {
      return [{ type: "text", text: "You'll need a property first. Add one, then I can set up a new tenancy on it." }, this.menu()];
    }
    await this.setSession(address, participantId, "new_tenancy", "property", {});
    return [{
      type: "list",
      text: "Which property is the new tenancy for?",
      button: "Choose property",
      items: props.slice(0, 10).map((p) => ({ id: `nprop:${p.id}`, title: p.reference, description: p.addressRaw })),
    }];
  }

  private async startMyOriginations(address: string, participantId: string): Promise<OutMsg[]> {
    const list = await this.origination.listForOwner(participantId);
    const open = list.filter((o) => o.status !== "ACTIVATED");
    if (open.length === 0) {
      return [{ type: "text", text: "You have no new tenancies in progress. Tap Menu, then Set up a new tenancy." }, this.menu()];
    }
    await this.setSession(address, participantId, "my_originations", "select", {});
    return [{
      type: "list",
      text: "New tenancies in progress. Choose one to see what's left or to activate it.",
      button: "Choose tenancy",
      items: open.map((o) => ({ id: `orig:${o.id}`, title: o.tenant ?? "New tenant", description: o.ready ? "Ready to activate" : "Waiting on gates" })),
    }];
  }

  private async startReportIssue(address: string, participantId: string): Promise<OutMsg[]> {
    const props = await this.properties.listForLandlord(participantId);
    if (props.length === 0) {
      return [{ type: "text", text: "You don't have a property on record yet. Add one first, then I can log an issue against it." }, this.menu()];
    }
    await this.setSession(address, participantId, "report_issue", "property", {});
    return [{
      type: "list",
      text: "Which property has the problem?",
      button: "Choose property",
      items: props.slice(0, 10).map((p) => ({ id: `rprop:${p.id}`, title: p.reference, description: p.addressRaw })),
    }];
  }

  private async startMyIssues(address: string, participantId: string): Promise<OutMsg[]> {
    const issues = await this.maintenance.listForOwner(participantId);
    if (issues.length === 0) {
      return [{ type: "text", text: "You have no reported issues. If something needs fixing, tap Menu, then Report a problem." }, this.menu()];
    }
    await this.setSession(address, participantId, "my_issues", "select", {});
    return [{
      type: "list",
      text: "Your issues. Choose one to see Quotes or accept completed Work.",
      button: "Choose issue",
      items: issues.map((i) => {
        const needs = i.work?.status === "COMPLETION_SUBMITTED" ? "Work to accept" : i.quotes.some((q) => q.status === "SUBMITTED") ? "Quotes to compare" : i.status;
        return { id: `issue:${i.id}`, title: i.category, description: needs };
      }),
    }];
  }

  private async startCollectRent(address: string, participantId: string): Promise<OutMsg[]> {
    // Arrears actions on WhatsApp are gated by their own HIGH-risk control (GJ-16, BP-10).
    if (!(await this.controls.isEnabled("channel.whatsapp.arrears"))) {
      return [{ type: "text", text: "Collecting rent over WhatsApp isn't switched on for your account yet. Our team can enable it for you, or you can record a payment another way." }, this.menu()];
    }
    const tenancies = await this.listLandlordTenancies(participantId);
    if (tenancies.length === 0) {
      return [{ type: "text", text: "You don't have a tenancy on record yet. Record one first, then I can raise a payment link." }, this.menu()];
    }
    await this.setSession(address, participantId, "collect_rent", "tenancy", {});
    return [{
      type: "list",
      text: "Which tenancy is the rent for?",
      button: "Choose tenancy",
      items: tenancies.map((t) => ({ id: `crten:${t.id}`, title: t.tenantName, description: t.address })),
    }];
  }

  private async startRecordTenancy(address: string, participantId: string): Promise<OutMsg[]> {
    const props = await this.properties.listForLandlord(participantId);
    if (props.length === 0) {
      return [{ type: "text", text: "You don't have a property yet. Let's add one first, then we can record its tenancy. Send the property address." }, await this.startAddProperty(address, participantId)];
    }
    await this.setSession(address, participantId, "record_tenancy", "property", {});
    return [{
      type: "list",
      text: "Which property is this tenancy for?",
      button: "Choose property",
      items: props.slice(0, 10).map((p) => ({ id: `prop:${p.id}`, title: p.reference, description: p.addressRaw })),
    }];
  }

  private async startAddProperty(address: string, participantId: string): Promise<OutMsg> {
    await this.setSession(address, participantId, "add_property", "address", {});
    return { type: "text", text: "What is the property address?" };
  }

  private async showActions(participantId: string): Promise<OutMsg[]> {
    const summary = await this.actions.summary(participantId);
    if (summary.allClear) return [{ type: "text", text: "All clear ✅ Nothing needs your decision right now." }];
    const list = await this.actions.list(participantId, "act");
    const lines = list.items.map((a) => `• ${a.title}`).join("\n");
    return [{ type: "text", text: `You have ${summary.act} item(s) that need your decision:\n\n${lines}` }];
  }

  private async showProperties(participantId: string): Promise<OutMsg[]> {
    const props = await this.properties.listForLandlord(participantId);
    if (props.length === 0) return [{ type: "text", text: "You don't have any properties yet. Tap Menu, then Add a property." }];
    const lines = props.map((p) => `• ${p.reference} — ${p.addressRaw} (${p.state})`).join("\n");
    return [{ type: "text", text: `Your properties:\n\n${lines}` }];
  }

  private async showStatement(participantId: string): Promise<OutMsg[]> {
    const s = await this.statements.forLandlord(participantId);
    const naira = (k: string) => `NGN ${(BigInt(k) / 100n).toLocaleString("en-NG")}`;
    const t = s.totals;
    const lines = [
      `Your statement (${new Date(s.generatedAt).toLocaleDateString()})`,
      "",
      `Properties: ${t.properties}   Tenancies: ${t.tenancies}`,
      `Charged: ${naira(t.chargedKobo)}`,
      `Collected: ${naira(t.collectedKobo)}`,
      `Settled to you: ${naira(t.netToLandlordKobo)}`,
      `Outstanding: ${naira(t.outstandingKobo)}`,
    ];
    return [{ type: "text", text: lines.join("\n") }, this.menu()];
  }

  /** What to tell the landlord after asking the tenant to confirm: exactly what happened, no more. */
  private tenantAskedText(name: string, delivery: NotifyResult["delivery"], token?: string): string {
    const recorded = `✅ Tenancy recorded for ${name}.`;
    const after = 'If they dispute anything, it will appear under "What needs my decision".';
    if (delivery.status === "sent") {
      const via = delivery.channel === "email" ? "an email" : "a WhatsApp message";
      return `${recorded} I've sent ${name} ${via} asking them to confirm the details. ${after}`;
    }
    if (delivery.status === "test_mode") {
      const link = token ? `\n\nTest mode link for the tenant: ${env.WEB_BASE_URL}/t/${token}` : "";
      return `${recorded} Messaging is in test mode, so nothing was sent to ${name}.${link}`;
    }
    if (delivery.status === "failed") {
      return `${recorded} I couldn't send ${name} the confirmation request just now. Choose "Talk to a person" and our team will help.`;
    }
    return `${recorded} There's no WhatsApp number or email for ${name}, so I couldn't ask them to confirm.`;
  }

  private menu(): OutMsg {
    return {
      type: "list",
      text: "What would you like to do?",
      button: "Menu",
      items: [
        { id: "my_actions", title: "What needs my decision" },
        { id: "add_property", title: "Add a property" },
        { id: "buildings", title: "Set up a building" },
        { id: "record_tenancy", title: "Record a tenancy" },
        { id: "new_tenancy", title: "Set up a new tenancy" },
        { id: "my_originations", title: "New tenancies in progress" },
        { id: "draft_agreement", title: "Draft an agreement" },
        { id: "condition_check", title: "Condition check" },
        { id: "renewals", title: "Renewals due" },
        { id: "end_tenancy", title: "End a tenancy" },
        { id: "my_closeouts", title: "Close-outs in progress" },
        { id: "collect_rent", title: "Collect rent" },
        { id: "report_issue", title: "Report a problem" },
        { id: "my_issues", title: "My issues" },
        { id: "send_notice", title: "Send a notice" },
        { id: "my_properties", title: "My properties" },
        { id: "my_statement", title: "My statement" },
        { id: "scope", title: "Scope of management" },
        { id: "my_data", title: "My data rights" },
        { id: "human", title: "Talk to a person" },
      ],
    };
  }

  // ---- Helpers ----

  private isYes(text: string): boolean {
    return this.ai.classify(text) === "affirm";
  }

  private async resolveParticipant(address: string): Promise<{ participant: { id: string; displayName: string }; isNew: boolean }> {
    const valueHash = this.crypto.valueHash(address);
    const contact = await this.prisma.contactPoint.findUnique({ where: { channel_valueHash: { channel: "WHATSAPP", valueHash } }, include: { participant: true } });
    if (contact) return { participant: contact.participant, isNew: false };

    const participant = await this.prisma.$transaction(async (tx) => {
      const p = await tx.participant.create({ data: { displayName: "Landlord", kind: "LANDLORD", status: "ACTIVE", phoneVerified: true } });
      await tx.contactPoint.create({ data: { participantId: p.id, channel: "WHATSAPP", valueHash, valueEncrypted: this.crypto.encrypt(address), verifiedAt: new Date(), primary: true } });
      // Combined acceptance of Terms, Mandate and Privacy (ACC-02).
      const docs = await tx.termsDocument.findMany({ include: { versions: { orderBy: { version: "desc" }, take: 1 } } });
      const acc = await tx.termsAcceptance.create({ data: { participantId: p.id, channel: "whatsapp" } });
      for (const d of docs) for (const v of d.versions) await tx.termsAcceptanceVersion.create({ data: { acceptanceId: acc.id, termsVersionId: v.id } });
      return p;
    });
    return { participant, isNew: true };
  }

  private async loadSession(address: string, participantId: string) {
    const existing = await this.prisma.conversationSession.findUnique({ where: { channel_address: { channel: "whatsapp", address } } });
    if (existing) return existing;
    return this.prisma.conversationSession.create({ data: { channel: "whatsapp", address, participantId } });
  }

  private async setSession(address: string, participantId: string, flow: string | null, step: string | null, data: any) {
    await this.prisma.conversationSession.upsert({
      where: { channel_address: { channel: "whatsapp", address } },
      update: { flow, step, data, participantId, resumableUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      create: { channel: "whatsapp", address, participantId, flow, step, data },
    });
  }

  private async log(address: string, direction: "in" | "out", body: string) {
    await this.prisma.messageLog.create({ data: { channel: "whatsapp", address, direction, body } });
  }

  private async finish(address: string, messages: OutMsg[]): Promise<{ messages: OutMsg[] }> {
    for (const m of messages) await this.log(address, "out", m.text);
    return { messages };
  }
}
